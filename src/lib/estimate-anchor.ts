import type { MonteCarloResult, RoughEstimate } from "@/lib/types";

/**
 * If detail monte_carlo diverges wildly from overview rough estimate (e.g. KB case copy),
 * rescale to the overview midpoint. Allows moderate CSI-level deviation via maxDeviationRatio.
 */
export function anchorMonteCarloToRough(
  monteCarlo: MonteCarloResult,
  rough: RoughEstimate,
  maxDeviationRatio = 0.35
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
