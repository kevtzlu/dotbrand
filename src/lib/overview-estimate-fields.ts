import type { ConfirmedField, RoughEstimate } from "@/lib/types";
import { stampRoughEstimateWithPw } from "@/lib/project-creation-fields";

/** Overview fields that should trigger estimate invalidation / recalculation. */
export const ESTIMATE_DRIVING_FIELDS = [
  "gfa_sqft",
  "building_type",
  "location",
  "zip_code",
  "floors",
  "construction_type",
  "project_subtype",
  "is_public",
  "structural_system",
  "cleanroom_class",
  "occupancy_class",
] as const;

export type EstimateDrivingField = (typeof ESTIMATE_DRIVING_FIELDS)[number];

export const PROPORTIONAL_ESTIMATE_FIELDS = new Set<EstimateDrivingField>([
  "gfa_sqft",
]);

export const UNIT_PRICE_ESTIMATE_FIELDS = new Set<EstimateDrivingField>(
  ESTIMATE_DRIVING_FIELDS.filter((f) => f !== "gfa_sqft")
);

export interface EstimateFieldChange {
  field: EstimateDrivingField;
  oldValue: string;
  newValue: string;
}

function fieldValueString(field: ConfirmedField | undefined): string {
  return String(field?.value ?? "").trim();
}

export function parseNumericFieldValue(value: unknown): number {
  const n = parseFloat(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Stable key of estimate-driving confirmed_info values. */
export function buildOverviewEstimateInputKey(
  info: Record<string, ConfirmedField>
): string {
  return ESTIMATE_DRIVING_FIELDS.map(
    (key) => `${key}:${fieldValueString(info[key])}`
  ).join("|");
}

export function stampRoughEstimateWithInputs(
  rough: RoughEstimate,
  confirmedInfo: Record<string, ConfirmedField>,
  prevailingWage: boolean
): RoughEstimate {
  return {
    ...stampRoughEstimateWithPw(rough, prevailingWage),
    inputs_key: buildOverviewEstimateInputKey(confirmedInfo),
  };
}

export function detectEstimateDrivingFieldChanges(
  prevInfo: Record<string, ConfirmedField>,
  nextInfo: Record<string, ConfirmedField>
): EstimateFieldChange[] {
  const changes: EstimateFieldChange[] = [];
  for (const field of ESTIMATE_DRIVING_FIELDS) {
    const oldValue = fieldValueString(prevInfo[field]);
    const newValue = fieldValueString(nextInfo[field]);
    if (oldValue !== newValue) {
      changes.push({ field, oldValue, newValue });
    }
  }
  return changes;
}

export function hasUnitPriceEstimateFieldChange(
  changes: EstimateFieldChange[]
): boolean {
  return changes.some((c) => UNIT_PRICE_ESTIMATE_FIELDS.has(c.field));
}

export function hasProportionalEstimateFieldChange(
  changes: EstimateFieldChange[]
): boolean {
  return changes.some((c) => PROPORTIONAL_ESTIMATE_FIELDS.has(c.field));
}

/** Scale totals when GFA changes; $/SF stays constant. */
export function scaleRoughEstimateForGfaChange(
  rough: RoughEstimate,
  oldGfa: number,
  newGfa: number
): RoughEstimate {
  if (oldGfa <= 0 || newGfa <= 0 || oldGfa === newGfa) return rough;
  const scale = newGfa / oldGfa;
  return {
    ...rough,
    min: Math.max(0, Math.round(rough.min * scale)),
    max: Math.max(0, Math.round(rough.max * scale)),
    per_sf_min: rough.per_sf_min,
    per_sf_max: rough.per_sf_max,
    prevailing_wage: rough.prevailing_wage,
    inputs_key: rough.inputs_key,
  };
}

export function applyProportionalEstimateAdjustments(
  rough: RoughEstimate,
  prevInfo: Record<string, ConfirmedField>,
  nextInfo: Record<string, ConfirmedField>,
  changes: EstimateFieldChange[]
): RoughEstimate {
  let adjusted = rough;
  if (changes.some((c) => c.field === "gfa_sqft")) {
    const oldGfa = parseNumericFieldValue(prevInfo.gfa_sqft?.value);
    const newGfa = parseNumericFieldValue(nextInfo.gfa_sqft?.value);
    adjusted = scaleRoughEstimateForGfaChange(adjusted, oldGfa, newGfa);
  }
  return adjusted;
}

/** True when rough_estimate reflects current overview driving inputs. */
export function isRoughEstimateFreshForInputs(
  rough: RoughEstimate | null | undefined,
  confirmedInfo: Record<string, ConfirmedField>
): boolean {
  if (!rough) return false;
  if (!rough.inputs_key) return true;
  return rough.inputs_key === buildOverviewEstimateInputKey(confirmedInfo);
}

export function isRoughEstimateDisplayable(
  rough: RoughEstimate | null | undefined,
  confirmedInfo: Record<string, ConfirmedField>,
  prevailingWageEnabled: boolean,
  legacyPrevailingWageColumn?: boolean
): rough is RoughEstimate {
  if (!rough) return false;
  const pwFresh =
    rough.prevailing_wage === undefined
      ? legacyPrevailingWageColumn === undefined ||
        legacyPrevailingWageColumn === prevailingWageEnabled
      : rough.prevailing_wage === prevailingWageEnabled;
  if (!pwFresh) return false;
  return isRoughEstimateFreshForInputs(rough, confirmedInfo);
}
