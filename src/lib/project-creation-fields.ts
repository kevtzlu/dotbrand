import { normalizeConfirmedInfo } from "@/lib/confirmed-info";
import type { ConfirmedField, ContractType, RoughEstimate } from "@/lib/types";

export function contractTypeToDeliveryMethod(contractType: ContractType): string {
  return contractType === "design_build" ? "Design-Build" : "Design-Bid-Build";
}

/** Fields the user sets in the new-project dialog — must override AI scan results. */
export function getUserConfirmedCreationFields(
  projectScope: "public" | "private",
  contractType: ContractType,
  prevailingWage: boolean
): Record<string, ConfirmedField> {
  return {
    project_type: {
      value: projectScope,
      confidence: "high",
      source: "user",
    },
    delivery_method: {
      value: contractTypeToDeliveryMethod(contractType),
      confidence: "high",
      source: "user",
    },
    is_prevailing_wage: {
      value: prevailingWage ? "Yes" : "No",
      confidence: "high",
      source: "user",
    },
  };
}

function isUserConfirmed(field: ConfirmedField | undefined): boolean {
  return field?.source === "user" && field.confidence === "high";
}

/** Backfill delivery_method from projects.contract_type when not user-confirmed. */
export function applyContractTypeDefaults(
  info: Record<string, ConfirmedField>,
  contractType: ContractType | null | undefined
): Record<string, ConfirmedField> {
  if (!contractType || isUserConfirmed(info.delivery_method)) return info;
  return {
    ...info,
    delivery_method: {
      value: contractTypeToDeliveryMethod(contractType),
      confidence: "high",
      source: "user",
    },
  };
}

/** Backfill is_prevailing_wage from projects.prevailing_wage when not user-confirmed. */
export function applyPrevailingWageDefaults(
  info: Record<string, ConfirmedField>,
  prevailingWage: boolean | null | undefined
): Record<string, ConfirmedField> {
  if (prevailingWage == null) return info;
  if (isUserConfirmed(info.is_prevailing_wage)) return info;
  return {
    ...info,
    is_prevailing_wage: {
      value: prevailingWage ? "Yes" : "No",
      confidence: "high",
      source: "user",
    },
  };
}

export function applyProjectCreationDefaults(
  info: Record<string, ConfirmedField>,
  options: {
    contractType?: ContractType | null;
    prevailingWage?: boolean | null;
  }
): Record<string, ConfirmedField> {
  return applyPrevailingWageDefaults(
    applyContractTypeDefaults(info, options.contractType),
    options.prevailingWage
  );
}

/** Parse Yes/No (and common variants) from confirmed_info or scan text. */
export function parsePrevailingWageValue(value: unknown): boolean {
  const s = String(value ?? "")
    .toLowerCase()
    .trim();
  if (!s) return false;
  if (/^(no|n|false|0|not\b|none|n\/a)\b/.test(s)) return false;
  if (/^(yes|y|true|1|required|applicable)\b/.test(s)) return true;
  return s.includes("yes") || (s.includes("prevailing") && !/\bno\b/.test(s));
}

export function isPrevailingWageEnabled(
  info: Record<string, ConfirmedField>
): boolean {
  const field = info.is_prevailing_wage;
  if (!field?.value) return false;
  return parsePrevailingWageValue(field.value);
}

export function stampRoughEstimateWithPw(
  rough: RoughEstimate,
  prevailingWage: boolean
): RoughEstimate {
  return { ...rough, prevailing_wage: prevailingWage };
}

/** True when rough_estimate exists and matches the current PW setting. */
export function isRoughEstimateFreshForPw(
  rough: RoughEstimate | null | undefined,
  prevailingWage: boolean
): rough is RoughEstimate {
  if (!rough) return false;
  if (rough.prevailing_wage === undefined) return true;
  return rough.prevailing_wage === prevailingWage;
}

export function detectPrevailingWageChange(
  prevailingWageColumn: boolean,
  confirmedInfo: Record<string, ConfirmedField> | undefined,
  updates: Partial<{
    prevailing_wage: boolean;
    confirmed_info: Record<string, ConfirmedField>;
  }>,
  contractType?: ContractType | null
): boolean {
  if (
    updates.prevailing_wage !== undefined &&
    updates.prevailing_wage !== prevailingWageColumn
  ) {
    return true;
  }
  const incoming = updates.confirmed_info?.is_prevailing_wage?.value;
  if (incoming === undefined) return false;
  const prevEnabled = isPrevailingWageEnabled(
    applyProjectCreationDefaults(normalizeConfirmedInfo(confirmedInfo || {}), {
      contractType,
      prevailingWage: prevailingWageColumn,
    })
  );
  return parsePrevailingWageValue(incoming) !== prevEnabled;
}

/**
 * Injects $/SF sanity benchmarks into the Overview prompt so the AI self-corrects
 * before outputting a wildly inflated estimate.
 *
 * @param buildingType  The detected/confirmed building type string (may be mixed, e.g. "warehouse + office")
 * @param gfa           Total project GFA in SF (0 if unknown)
 */
export function buildPerSfSanityBlock(buildingType?: string | null, gfa?: number): string {
  const gfaLine = gfa && gfa > 0
    ? `- Project GFA: ${gfa.toLocaleString()} SF — your rough_estimate total should equal per_sf × GFA.`
    : "";

  return `
== PER-SF RATE SANITY CHECK (MANDATORY — run BEFORE outputting rough_estimate) ==
Level B Total Project Budget = Hard Cost + Soft Cost combined.
Typical California all-in $/SF benchmarks (2024–2025):

| Building Type                       | Level B $/SF Range |
|-------------------------------------|--------------------|
| Tilt-up Warehouse / Industrial      | $100 – $350 /SF    |
| Light Manufacturing / R&D Shell     | $150 – $450 /SF    |
| Corporate Office / HQ (mid-rise)    | $300 – $700 /SF    |
| Mixed Industrial + Office Campus    | $200 – $550 /SF    |
| High-Tech / Semiconductor Fab       | $600 – $1,500 /SF  |
| Medical Office / Clinic             | $400 – $900 /SF    |
| Hospital / Surgery Center           | $700 – $2,000 /SF  |
| K-12 / Higher Education             | $300 – $800 /SF    |
| Retail / Grocery                    | $150 – $500 /SF    |
${gfaLine}
SELF-CHECK RULE:
1. Compute: your rough_estimate.max ÷ GFA = implied $/SF.
2. Compare to the benchmark row that BEST matches this project's building type: "${buildingType || "unknown"}".
3. If implied $/SF is MORE THAN 2× the high end of the matching row → your unit rates are wrong.
   Common causes: applied hospital/lab rates to a warehouse; applied prevailing-wage multiplier when PW=NO;
   used a reference project's total budget instead of $/SF unit rates.
4. FIX by re-deriving from correct unit rates, NOT by scaling down the wrong total.

DOCUMENT FINANCIAL FIGURES WARNING:
Uploaded BOD/RFP documents may reference: campus totals, prior project budgets, owner budgets, land costs,
equipment purchase prices, or any dollar figures unrelated to THIS estimate's construction cost.
Do NOT use any dollar figure found in the documents as your estimate — re-derive from GFA × unit rates × multipliers.
`;
}

/** Guardrails when historical case database or KB projects appear in prompts. */
export function buildCaseDatabaseGuardBlock(prevailingWage: boolean): string {
  const pwLabel = prevailingWage ? "YES" : "NO";
  return `
== CASE DATABASE / HISTORICAL PROJECT RULES (MANDATORY) ==
User-confirmed Prevailing Wage = ${pwLabel}.
- NEVER output CASE_002, Advantech, or any historical Final_Cost / Cost_Per_SF / total budget as your estimate.
- Historical cases with Prevailing_Wage=Yes embed ~1.30x–1.50x labor uplift — INVALID when user confirmed PW=NO.
- When PW=${pwLabel}, re-derive ALL totals from THIS project's GFA × unit rates × applicable multipliers.
- Similar project names or uploaded documents do NOT authorize copying historical totals.
- Use case data only to sanity-check unit rates after adjusting for PW status and GFA difference.
`;
}

/** Mandatory estimate instructions so Layer prompts do not override user PW choice. */
export function buildPrevailingWageEstimateBlock(enabled: boolean): string {
  if (enabled) {
    return `
== PREVAILING WAGE (USER-CONFIRMED — MANDATORY) ==
Status: YES — Apply prevailing wage labor rates and multipliers.
- Use Prevailing_Wage_Multiplier per Layer 1 / Layer 2 (typically 1.30x–1.50x for full CA prevailing wage).
- Price labor at prevailing wage rates, NOT open-shop rates.
`;
  }
  return `
== PREVAILING WAGE (USER-CONFIRMED — MANDATORY) ==
Status: NO — Do NOT apply prevailing wage pricing.
- Set Prevailing_Wage_Multiplier = 1.00 exactly (no 1.30x–1.50x PW labor uplift).
- Use standard open-shop / regional labor multipliers only.
- IGNORE Davis-Bacon, DIR, or prevailing wage language in uploaded documents for this estimate.
- California location or public project type alone does NOT enable prevailing wage when status is NO.
`;
}
