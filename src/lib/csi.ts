/** CSI division helpers: sanitize stored values and compute display amounts. */

export interface CsiLineInput {
  id: string;
  qty: number | null;
  rate: number | null;
  amount: number;
}

export interface CsiDisplayValues {
  displayRate: number | null;
  displayAmount: number;
}

/** Clamp negative AI/user values and keep amount consistent with qty × rate. */
export function sanitizeCsiDivision<T extends CsiLineInput>(d: T): T {
  let rate = d.rate;
  let amount = d.amount ?? 0;

  // AI occasionally outputs negative rate+amount pairs; treat as sign error.
  if ((rate ?? 0) < 0 && amount < 0) {
    rate = rate != null ? Math.abs(rate) : rate;
    amount = Math.abs(amount);
  }

  if (rate != null && rate < 0) rate = 0;
  if (amount < 0) amount = 0;

  if (d.qty != null && d.qty > 0 && rate != null) {
    amount = Math.round(d.qty * rate);
  }

  return { ...d, rate, amount };
}

export function sanitizeCsiDivisions<T extends CsiLineInput>(divisions: T[]): T[] {
  return divisions.map(sanitizeCsiDivision);
}

/** Scale stored CSI rows so their amounts sum to targetHardCost (post-sanitize). */
export function normalizeCsiDivisionsToTarget<
  T extends CsiLineInput & { per_sf?: number },
>(divisions: T[], targetHardCost: number, gfa = 0): T[] {
  const cleaned = sanitizeCsiDivisions(divisions);
  const rawCsiTotal = cleaned.reduce((s, d) => s + (d.amount || 0), 0);
  if (rawCsiTotal <= 0 || targetHardCost <= 0) return cleaned;

  const normFactor = targetHardCost / rawCsiTotal;
  const normalized = cleaned.map((d) => {
    let newRate: number | null;
    let newAmount: number;

    if (d.qty != null && d.qty > 0 && d.rate != null) {
      newRate = Math.round(d.rate * normFactor * 100) / 100;
      newAmount = Math.round(d.qty * newRate);
    } else if (d.qty != null && d.qty > 0) {
      newAmount = Math.round((d.amount || 0) * normFactor);
      newRate = Math.round((newAmount / d.qty) * 100) / 100;
    } else {
      newAmount = Math.round((d.amount || 0) * normFactor);
      newRate =
        d.rate != null ? Math.round(d.rate * normFactor * 100) / 100 : null;
    }

    return {
      ...d,
      rate: newRate,
      amount: newAmount,
      ...(gfa > 0
        ? { per_sf: Math.round((newAmount / gfa) * 100) / 100 }
        : {}),
    };
  });

  const normTotal = normalized.reduce((s, d) => s + d.amount, 0);
  const delta = Math.round(targetHardCost) - normTotal;
  if (delta !== 0 && normalized.length > 0) {
    const largest = normalized.reduce(
      (max, d) => (d.amount > max.amount ? d : max),
      normalized[0]
    );
    largest.amount += delta;
    if (largest.qty != null && largest.qty > 0) {
      largest.rate = Math.round((largest.amount / largest.qty) * 100) / 100;
    }
    if (gfa > 0) {
      largest.per_sf = Math.round((largest.amount / gfa) * 100) / 100;
    }
  }

  return normalized;
}

export function computeCsiScaleFactor(
  divisions: CsiLineInput[],
  scenarioTotal: number,
  hardPct: number
): number {
  const targetHardCost = scenarioTotal * (hardPct / 100);
  const rawCsiTotal = divisions.reduce((s, d) => s + Math.max(0, d.amount || 0), 0);
  if (rawCsiTotal <= 0 || targetHardCost <= 0) return 1;
  return targetHardCost / rawCsiTotal;
}

/**
 * Derive per-row display rate/amount (scaled) and correct rounding drift so the
 * sum matches targetHardCost when provided.
 */
export function computeCsiDisplayAmounts(
  divisions: CsiLineInput[],
  scaleFactor: number,
  targetHardCost?: number
): Map<string, CsiDisplayValues> {
  const rows = divisions.map((d) => {
    const sanitized = sanitizeCsiDivision(d);
    const safeRate =
      sanitized.rate != null ? Math.max(0, sanitized.rate) : null;
    const displayRate =
      safeRate != null ? Math.round(safeRate * scaleFactor) : null;
    const displayAmount =
      sanitized.qty != null && displayRate != null
        ? sanitized.qty * displayRate
        : Math.round(Math.max(0, sanitized.amount || 0) * scaleFactor);
    return { id: d.id, qty: sanitized.qty, displayRate, displayAmount };
  });

  if (targetHardCost != null && rows.length > 0) {
    const total = rows.reduce((s, r) => s + r.displayAmount, 0);
    const delta = Math.round(targetHardCost) - total;
    if (delta !== 0) {
      const largest = rows.reduce(
        (max, r) => (r.displayAmount > max.displayAmount ? r : max),
        rows[0]
      );
      largest.displayAmount += delta;
      if (largest.qty != null && largest.qty > 0) {
        largest.displayRate = Math.round(largest.displayAmount / largest.qty);
      }
    }
  }

  return new Map(
    rows.map((r) => [
      r.id,
      { displayRate: r.displayRate, displayAmount: r.displayAmount },
    ])
  );
}

export type CsiExcelExportStyle = "detail" | "final";

/** Total row for CSI Hard Cost Excel sheets (matches Summary hard cost). */
export function buildCsiHardCostTotalRow(
  hardCostTotal: number,
  gfa: number,
  style: CsiExcelExportStyle
): Record<string, string | number | null> {
  const amount = Math.round(hardCostTotal);
  const perSf = gfa > 0 ? Number((amount / gfa).toFixed(2)) : 0;
  const shared = {
    Qty: null as number | null,
    Unit: "",
    Rate: null as number | null,
    Amount: amount,
    "$/SF": perSf,
    Confidence: "",
  };
  if (style === "detail") {
    return { "CSI Code": "", Description: "TOTAL HARD COST", ...shared };
  }
  return {
    "CSI Code": "",
    "CSI Description": "TOTAL HARD COST",
    Description: "",
    ...shared,
  };
}

export function appendCsiHardCostTotalRow<T extends { Amount: number }>(
  rows: T[],
  hardCostTotal: number,
  gfa: number,
  style: CsiExcelExportStyle
): T[] {
  if (rows.length === 0) return rows;
  return [
    ...rows,
    buildCsiHardCostTotalRow(hardCostTotal, gfa, style) as T,
  ];
}
