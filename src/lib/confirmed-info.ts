import type { ConfirmedField } from "@/lib/types";

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
