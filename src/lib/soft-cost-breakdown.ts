export interface SoftCostBreakdownItem {
  label: string;
  pct: number;
}

export const DEFAULT_SOFT_COST_BREAKDOWN: SoftCostBreakdownItem[] = [
  { label: "Design & Engineering Fees", pct: 35 },
  { label: "Permits & Inspections", pct: 15 },
  { label: "Insurance & Bonding", pct: 12 },
  { label: "Project Management", pct: 18 },
  { label: "Contingency", pct: 20 },
];

export function buildSoftCostSheetRows(
  softCostTotal: number,
  breakdown: SoftCostBreakdownItem[]
) {
  const rows = breakdown.map((item) => ({
    Category: item.label,
    "% of Soft": item.pct,
    Amount: Math.round(softCostTotal * (item.pct / 100)),
  }));
  const totalPct = breakdown.reduce((s, b) => s + b.pct, 0);
  rows.push({
    Category: "TOTAL SOFT COST",
    "% of Soft": Math.round(totalPct * 10) / 10,
    Amount: Math.round(softCostTotal),
  });
  return rows;
}
