import type { MonteCarloResult, RoughEstimate } from "@/lib/types";

/**
 * Reasonable Level-B total project budget $/SF bounds by building type.
 * "total" = hard + soft combined (Level B).
 * Keyed by lowercase substring match against building_type string.
 */
const BUILDING_TYPE_PER_SF_LIMITS: Record<string, { min: number; max: number }> = {
  "warehouse":        { min: 80,  max: 350 },
  "industrial":       { min: 80,  max: 450 },
  "manufacturing":    { min: 120, max: 600 },
  "distribution":     { min: 80,  max: 350 },
  "office":           { min: 200, max: 750 },
  "r&d":              { min: 250, max: 850 },
  "research":         { min: 300, max: 950 },
  "medical":          { min: 500, max: 1600 },
  "hospital":         { min: 600, max: 2000 },
  "laboratory":       { min: 500, max: 1600 },
  "lab":              { min: 500, max: 1600 },
  "education":        { min: 200, max: 750 },
  "school":           { min: 200, max: 750 },
  "retail":           { min: 100, max: 500 },
  "hospitality":      { min: 150, max: 700 },
  "hotel":            { min: 150, max: 700 },
  "residential":      { min: 150, max: 600 },
  "mixed":            { min: 150, max: 750 },
};

/** Absolute ceiling per SF for any project type — anything above is a clear AI hallucination. */
const ABSOLUTE_MAX_PER_SF = 3000;

/**
 * Returns the expected $/SF bounds for a building type string.
 * Falls back to a wide generic range if no match.
 */
export function getBuildingTypePerSfBounds(
  buildingType?: string | null
): { min: number; max: number; matched: string | null } {
  if (!buildingType) return { min: 80, max: 2000, matched: null };
  const lower = buildingType.toLowerCase();
  for (const [key, bounds] of Object.entries(BUILDING_TYPE_PER_SF_LIMITS)) {
    if (lower.includes(key)) return { ...bounds, matched: key };
  }
  return { min: 80, max: 2000, matched: null };
}

/**
 * After Overview AI response, validate and clamp rough_estimate if per_sf is unreasonably high.
 * Prevents wildly inflated Overview from polluting all downstream phases.
 *
 * Returns the (possibly clamped) estimate and a diagnostic log string.
 */
export function clampRoughEstimateToReasonableBounds(
  rough: RoughEstimate,
  gfa: number,
  buildingType?: string | null
): { estimate: RoughEstimate; clamped: boolean; log: string } {
  if (!gfa || gfa <= 0) {
    return { estimate: rough, clamped: false, log: "[Anchor] GFA unknown — skipping per-SF clamp." };
  }

  const perSfMax = rough.max / gfa;
  const perSfMin = rough.min / gfa;
  const { min: expectedMin, max: expectedMax, matched } = getBuildingTypePerSfBounds(buildingType);

  // Anything above the absolute ceiling is definitely wrong.
  const clampCeiling = Math.min(expectedMax * 2.5, ABSOLUTE_MAX_PER_SF);

  if (perSfMax <= clampCeiling) {
    return {
      estimate: rough,
      clamped: false,
      log: `[Anchor] Overview $/SF check OK: $${Math.round(perSfMin)}–$${Math.round(perSfMax)}/SF (${matched ?? "generic"} limit: $${expectedMin}–$${expectedMax}/SF)`,
    };
  }

  // Clamp: target a per_sf_max of 1.5× the expected maximum for the type.
  const targetPerSfMax = Math.min(expectedMax * 1.5, ABSOLUTE_MAX_PER_SF / 2);
  const targetPerSfMin = Math.max(expectedMin * 0.8, targetPerSfMax * 0.7);
  const clampedMin = Math.round(targetPerSfMin * gfa);
  const clampedMax = Math.round(targetPerSfMax * gfa);

  const log =
    `[Anchor] ⚠️ Overview $/SF CLAMPED: raw $${Math.round(perSfMax).toLocaleString()}/SF far exceeds ` +
    `${matched ?? "generic"} ceiling $${clampCeiling.toLocaleString()}/SF. ` +
    `Clamped to $${Math.round(targetPerSfMin)}–$${Math.round(targetPerSfMax)}/SF ` +
    `($${clampedMin.toLocaleString()}–$${clampedMax.toLocaleString()} total for ${gfa.toLocaleString()} SF). ` +
    `Original: $${rough.min.toLocaleString()}–$${rough.max.toLocaleString()}.`;

  return {
    estimate: {
      ...rough,
      min: clampedMin,
      max: clampedMax,
      per_sf_min: Math.round(targetPerSfMin),
      per_sf_max: Math.round(targetPerSfMax),
    },
    clamped: true,
    log,
  };
}

/**
 * If detail monte_carlo diverges from overview rough estimate (e.g. KB case copy),
 * rescale to stay within the overview band. Tighter tolerance (20%) to prevent
 * compounding errors when Overview itself is already anchored/clamped.
 */
export function anchorMonteCarloToRough(
  monteCarlo: MonteCarloResult,
  rough: RoughEstimate,
  maxDeviationRatio = 0.20
): MonteCarloResult {
  const roughMid = (rough.min + rough.max) / 2;
  const lower = rough.min * (1 - maxDeviationRatio);
  const upper = rough.max * (1 + maxDeviationRatio);

  if (monteCarlo.mid >= lower && monteCarlo.mid <= upper) {
    return monteCarlo;
  }

  // Large divergence (e.g. copied historical total) → snap to overview midpoint
  const clampedMid =
    monteCarlo.mid > upper * 1.5 || monteCarlo.mid < lower * 0.5
      ? roughMid
      : Math.max(lower, Math.min(upper, monteCarlo.mid));

  if (clampedMid === monteCarlo.mid) return monteCarlo;

  const scale = clampedMid / monteCarlo.mid;
  console.warn(
    `[Estimate] Detail mid $${monteCarlo.mid.toLocaleString()} outside overview anchor ` +
      `$${lower.toLocaleString()}–$${upper.toLocaleString()}, rescaling to $${Math.round(clampedMid).toLocaleString()}`
  );

  return {
    conservative: Math.round(monteCarlo.conservative * scale),
    mid: Math.round(clampedMid),
    optimistic: Math.round(monteCarlo.optimistic * scale),
  };
}
