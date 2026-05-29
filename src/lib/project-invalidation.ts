import type { Project } from "@/lib/types";

/** Clears detail/final estimate outputs so they can be regenerated from updated overview inputs. */
export function detailEstimateInvalidation(): Partial<Project> {
  return {
    monte_carlo: null,
    risks: [],
    csi_divisions: [],
    ai_guesses: [],
    ai_evidence: [],
    hard_soft_ratio: { hard_pct: 85, soft_pct: 15 },
    final_hard_cost: null,
    final_soft_cost: null,
    final_total_cost: null,
    final_cost_summary: [],
    status: "overview",
  };
}
