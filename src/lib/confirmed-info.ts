import type { ConfirmedField } from "@/lib/types";

const USER_LOCKED_FIELDS = new Set([
  "project_type",
  "project_name",
  "delivery_method",
  "is_prevailing_wage",
  "start_date",
  "end_date",
]);

/** AI scan / alternate keys that should collapse into canonical gfa_sqft. */
const GFA_SQFT_ALIAS_KEYS = [
  "total_gfa",
  "total_gfa_sqft",
  "gfa",
  "building_size",
  "building_gfa",
  "gross_floor_area",
  "area_sqft",
  "size_sqft",
  "project_size",
  "development_size",
  "development_area",
  "object_size",
  "物件開發尺寸",
] as const;

function hasFieldValue(field: ConfirmedField | undefined): boolean {
  return field?.value != null && String(field.value).trim() !== "";
}

/** Collapse legacy duplicate keys into canonical project-info fields. */
export function normalizeConfirmedInfo(
  info: Record<string, ConfirmedField>
): Record<string, ConfirmedField> {
  const result = { ...info };
  const assumption = result.delivery_method_assumption;
  if (assumption) {
    if (!result.delivery_method) {
      result.delivery_method = assumption;
    }
    delete result.delivery_method_assumption;
  }
  // AI scans use alternate keys; creation flow uses "is_prevailing_wage".
  const pwAliasKeys = [
    "prevailing_wage",
    "prevailing_wage_requirement",
    "prevailing_wage_required",
  ] as const;
  for (const key of pwAliasKeys) {
    const alias = result[key];
    if (!alias) continue;
    if (!result.is_prevailing_wage) {
      result.is_prevailing_wage = alias;
    }
    delete result[key];
  }
  // Drop AI commentary duplicates — is_prevailing_wage is the single source of truth.
  for (const key of [
    "prevailing_wage_note",
    "prevailing_wage_notes",
    "prevailing_wage_comment",
    "labor",
  ]) {
    delete result[key];
  }
  // Collapse GFA / development-size aliases into gfa_sqft (required for estimate + export Size).
  for (const key of GFA_SQFT_ALIAS_KEYS) {
    const alias = result[key];
    if (!alias) continue;
    if (!hasFieldValue(result.gfa_sqft) && hasFieldValue(alias)) {
      result.gfa_sqft = alias;
    }
    delete result[key];
  }
  return result;
}

/** Merge AI updates without overwriting user-confirmed creation fields. */
export function mergeConfirmedInfoPreservingUser(
  existing: Record<string, ConfirmedField>,
  incoming: Record<string, ConfirmedField>
): Record<string, ConfirmedField> {
  const base = normalizeConfirmedInfo(existing);
  const merged = normalizeConfirmedInfo({ ...base, ...incoming });
  for (const key of USER_LOCKED_FIELDS) {
    const userField = base[key];
    if (userField?.source === "user" && userField.confidence === "high") {
      merged[key] = userField;
    }
  }
  return merged;
}
