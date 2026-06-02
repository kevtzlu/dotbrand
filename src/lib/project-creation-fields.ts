import type { ConfirmedField, ContractType } from "@/lib/types";

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
