import type { OverviewQA, OverviewQAOption, Project, RoughEstimate } from "@/lib/types";

/** Frozen overview total — anchor for Q&A adjustments (set when overview pipeline completes). */
export function getQaEstimateAnchor(project: Project): RoughEstimate | null {
  return project.base_estimate ?? project.rough_estimate ?? null;
}

/** @deprecated Use getQaEstimateAnchor */
export const getQaMultiplierBase = getQaEstimateAnchor;

function optionUsesDollarDeltas(opt: OverviewQAOption): boolean {
  return opt.cost_delta_min != null || opt.cost_delta_max != null;
}

function questionUsesDollarDeltas(q: OverviewQA): boolean {
  return q.options.some(optionUsesDollarDeltas);
}

function getRecommendedOption(q: OverviewQA): OverviewQAOption | undefined {
  return (
    q.options.find((o) => o.recommended) ||
    q.options.find((o) => o.id === "a") ||
    q.options[0]
  );
}

function getOptionDollarDelta(opt: OverviewQAOption): { min: number; max: number } {
  return {
    min: Number(opt.cost_delta_min) || 0,
    max: Number(opt.cost_delta_max) || 0,
  };
}

/**
 * Dollar-additive model (preferred):
 *   adjusted = overview_anchor + Σ (selected_delta − recommended_delta)
 *
 * Picking the document-recommended option leaves the anchor unchanged.
 * Picking a cheaper scope subtracts; picking a richer scope adds.
 */
export function computeInstantEstimateDollarAdditive(
  anchor: RoughEstimate,
  questions: OverviewQA[],
  gfa?: number
): RoughEstimate | null {
  if (!questions.some((q) => q.answered && q.selected_option)) return null;

  let deltaMin = 0;
  let deltaMax = 0;
  let usedDollar = false;

  for (const q of questions) {
    if (!q.answered || !q.selected_option || !questionUsesDollarDeltas(q)) continue;
    const selected = q.options.find((o) => o.id === q.selected_option);
    const recommended = getRecommendedOption(q);
    if (!selected || !recommended) continue;

    const sel = getOptionDollarDelta(selected);
    const rec = getOptionDollarDelta(recommended);
    deltaMin += sel.min - rec.min;
    deltaMax += sel.max - rec.max;
    usedDollar = true;
  }

  if (!usedDollar) return null;

  const min = Math.max(0, Math.round(anchor.min + deltaMin));
  const max = Math.max(min, Math.round(anchor.max + deltaMax));

  if (gfa && gfa > 0) {
    return {
      min,
      max,
      per_sf_min: Math.round(min / gfa),
      per_sf_max: Math.round(max / gfa),
      prevailing_wage: anchor.prevailing_wage,
    };
  }

  const midScale = anchor.min > 0 ? min / anchor.min : 1;
  const maxScale = anchor.max > 0 ? max / anchor.max : 1;
  return {
    min,
    max,
    per_sf_min: Math.round(anchor.per_sf_min * midScale),
    per_sf_max: Math.round(anchor.per_sf_max * maxScale),
    prevailing_wage: anchor.prevailing_wage,
  };
}

/** Legacy % multiplier model — kept for older projects without cost_delta_*. */
export function computeInstantEstimateMultiplier(
  anchor: RoughEstimate,
  questions: OverviewQA[]
): RoughEstimate {
  let deltaSum = 0;
  for (const q of questions) {
    if (q.answered && q.selected_option) {
      const opt = q.options.find((o) => o.id === q.selected_option);
      if (opt?.cost_adjustment != null) {
        deltaSum += opt.cost_adjustment - 1.0;
      }
    }
  }
  const multiplier = 1.0 + deltaSum;
  return {
    min: Math.round(anchor.min * multiplier),
    max: Math.round(anchor.max * multiplier),
    per_sf_min: Math.round(anchor.per_sf_min * multiplier),
    per_sf_max: Math.round(anchor.per_sf_max * multiplier),
    prevailing_wage: anchor.prevailing_wage,
  };
}

export function computeInstantEstimateFromQA(
  anchor: RoughEstimate,
  questions: OverviewQA[],
  gfa?: number
): RoughEstimate {
  const dollar = computeInstantEstimateDollarAdditive(anchor, questions, gfa);
  if (dollar) return dollar;
  return computeInstantEstimateMultiplier(anchor, questions);
}

export function computeProjectInstantEstimate(
  project: Project,
  questions: OverviewQA[]
): RoughEstimate | null {
  const anchor = getQaEstimateAnchor(project);
  if (!anchor) return null;
  const hasOptionAnswer = questions.some((q) => q.answered && q.selected_option);
  if (!hasOptionAnswer) return null;

  const gfa = parseFloat(
    String(project.confirmed_info?.gfa_sqft?.value ?? project.extracted_info?.gfa_sqft?.value ?? 0)
  );
  return computeInstantEstimateFromQA(anchor, questions, gfa > 0 ? gfa : undefined);
}

/**
 * When overview re-runs after Q&A, cap AI output so it cannot wildly exceed
 * the deterministic Q&A adjustment.
 */
export function capRoughEstimateToQaInstant(
  aiRough: RoughEstimate,
  instant: RoughEstimate | null,
  maxOvershootRatio = 1.15
): { estimate: RoughEstimate; capped: boolean } {
  if (!instant) return { estimate: aiRough, capped: false };

  const instantMid = (instant.min + instant.max) / 2;
  const aiMid = (aiRough.min + aiRough.max) / 2;
  const ceiling = instant.max * maxOvershootRatio;

  if (aiMid <= ceiling) return { estimate: aiRough, capped: false };

  const scale = ceiling / aiMid;
  return {
    estimate: {
      min: Math.round(aiRough.min * scale),
      max: Math.round(Math.min(aiRough.max * scale, ceiling)),
      per_sf_min: Math.round(aiRough.per_sf_min * scale),
      per_sf_max: Math.round(aiRough.per_sf_max * scale),
      prevailing_wage: aiRough.prevailing_wage,
    },
    capped: true,
  };
}
