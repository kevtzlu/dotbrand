import { normalizeConfirmedInfo } from "@/lib/confirmed-info";
import type { ConfirmedField, ContractType, RoughEstimate } from "@/lib/types";

export function contractTypeToDeliveryMethod(contractType: ContractType): string {
  return contractType === "design_build" ? "Design-Build" : "Design-Bid-Build";
}

/** Fields the user sets in the new-project dialog — must override AI scan results. */
export function getUserConfirmedCreationFields(
  projectScope: "public" | "private",
  contractType: ContractType,
  prevailingWage: boolean,
  options?: {
    title?: string;
    startDate?: string;
    endDate?: string;
  }
): Record<string, ConfirmedField> {
  const fields: Record<string, ConfirmedField> = {
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

  const title = options?.title?.trim();
  if (title) {
    fields.project_name = {
      value: title,
      confidence: "high",
      source: "user",
    };
  }
  if (options?.startDate) {
    fields.start_date = {
      value: options.startDate,
      confidence: "high",
      source: "user",
    };
  }
  if (options?.endDate) {
    fields.end_date = {
      value: options.endDate,
      confidence: "high",
      source: "user",
    };
  }

  return fields;
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

/**
 * Labor share of total Level-B budget used to convert craft PW multipliers
 * into a whole-project uplift (labor + non-labor soft/hard).
 */
export const PW_LABOR_SHARE_OF_TOTAL = 0.52;

/** State-level craft PW multipliers (see Docs/PREVAILIING_WAGE.md). */
const STATE_PW_MULTIPLIERS: Record<string, number> = {
  CA: 1.6,
  CALIFORNIA: 1.6,
  NY: 1.75,
  "NEW YORK": 1.75,
  IL: 1.65,
  ILLINOIS: 1.65,
  MA: 1.6,
  MASSACHUSETTS: 1.6,
  NJ: 1.65,
  "NEW JERSEY": 1.65,
  HI: 1.7,
  HAWAII: 1.7,
  AK: 1.55,
  ALASKA: 1.55,
  CT: 1.55,
  CONNECTICUT: 1.55,
  RI: 1.55,
  "RHODE ISLAND": 1.55,
  WA: 1.5,
  WASHINGTON: 1.5,
  DC: 1.5,
  "DISTRICT OF COLUMBIA": 1.5,
};

const DEFAULT_STATE_PW_MULTIPLIER = 1.35;

/** Craft PW multiplier for a project location string (defaults to national avg). */
export function getStatePrevailingWageMultiplier(
  location?: string | null
): number {
  if (!location?.trim()) return DEFAULT_STATE_PW_MULTIPLIER;
  const upper = location.toUpperCase();
  for (const [key, mult] of Object.entries(STATE_PW_MULTIPLIERS)) {
    if (key.length === 2) {
      if (new RegExp(`\\b${key}\\b`).test(upper)) return mult;
    }
  }
  for (const [key, mult] of Object.entries(STATE_PW_MULTIPLIERS)) {
    if (key.length > 2 && upper.includes(key)) return mult;
  }
  return DEFAULT_STATE_PW_MULTIPLIER;
}

/** Whole-project cost factor when PW labor rates replace open-shop labor. */
export function getPwTotalCostFactor(
  location?: string | null,
  laborShareOfTotal = PW_LABOR_SHARE_OF_TOTAL
): number {
  const craftMult = getStatePrevailingWageMultiplier(location);
  return 1 + laborShareOfTotal * (craftMult - 1);
}

function scaleRoughEstimate(rough: RoughEstimate, scale: number): RoughEstimate {
  return {
    min: Math.max(0, Math.round(rough.min * scale)),
    max: Math.max(0, Math.round(rough.max * scale)),
    per_sf_min: Math.max(0, Math.round(rough.per_sf_min * scale)),
    per_sf_max: Math.max(0, Math.round(rough.per_sf_max * scale)),
  };
}

/**
 * Deterministically toggle prevailing wage on an existing rough estimate.
 * Uses inverse factors so yes→no→yes round-trips without stacking.
 */
export function toggleRoughEstimatePrevailingWage(
  rough: RoughEstimate,
  fromPwEnabled: boolean,
  toPwEnabled: boolean,
  location?: string | null
): RoughEstimate {
  if (fromPwEnabled === toPwEnabled) {
    return stampRoughEstimateWithPw(rough, toPwEnabled);
  }

  const factor = getPwTotalCostFactor(location);
  const scale = toPwEnabled ? factor : 1 / factor;
  return stampRoughEstimateWithPw(scaleRoughEstimate(rough, scale), toPwEnabled);
}

export function resolveProjectPrevailingWageEnabled(
  confirmedInfo: Record<string, ConfirmedField> | undefined,
  prevailingWageColumn: boolean,
  contractType?: ContractType | null
): boolean {
  return isPrevailingWageEnabled(
    applyProjectCreationDefaults(normalizeConfirmedInfo(confirmedInfo || {}), {
      contractType,
      prevailingWage: prevailingWageColumn,
    })
  );
}

/**
 * True when rough_estimate exists and matches the current PW setting.
 * Legacy estimates without a stamp are treated as matching the DB column.
 */
export function isRoughEstimateFreshForPw(
  rough: RoughEstimate | null | undefined,
  prevailingWage: boolean,
  legacyPrevailingWageColumn?: boolean
): rough is RoughEstimate {
  if (!rough) return false;
  if (rough.prevailing_wage === undefined) {
    return (
      legacyPrevailingWageColumn === undefined ||
      legacyPrevailingWageColumn === prevailingWage
    );
  }
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
1. Compute: your rough_estimate.max ÷ GFA = implied blended $/SF.
2. For SINGLE building type: compare to the matching benchmark row above for building type "${buildingType || "unknown"}".
   For MIXED / MULTI-BUILDING projects: check each building individually (e.g., HQ office $/SF vs. warehouse $/SF),
   then verify the BLENDED total÷GFA is a reasonable weighted average of the individual building type ranges.
3. If implied $/SF is MORE THAN 1.5× the high end of the matching row → your unit rates are wrong.
   Common causes: applied office/HQ rates to ALL buildings including low-cost warehouse; applied prevailing-wage
   multiplier when PW=NO; used a reference project's total budget instead of $/SF unit rates; stacked too many cost layers.
4. FIX by re-deriving from correct unit rates per building, NOT by scaling down the wrong total.
5. AIM for the MIDPOINT of the applicable $/SF range unless high-cost features (cleanroom, OSHPD, high-bay crane,
   cold storage, semiconductor fab, full glass curtain wall) are explicitly confirmed in the documents.

MULTI-BUILDING WEIGHTED $/SF EXAMPLE:
  Project: 109,117 SF office HQ + 78,945 SF tilt-up warehouse = 188,062 SF total
  Office mid: $480/SF × 109,117 = $52.4M | Warehouse mid: $200/SF × 78,945 = $15.8M
  Total mid: $68.2M → Blended $/SF = $68.2M ÷ 188,062 = $363/SF (NOT $480/SF across the board)

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
