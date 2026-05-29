import type { ConfirmedField } from "@/lib/types";

const USER_LOCKED_FIELDS = new Set([
  "project_type",
  "delivery_method",
  "is_prevailing_wage",
]);

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
