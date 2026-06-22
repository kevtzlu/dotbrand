import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import type { CSIDivision, OverviewQA, Project, RiskItem } from "@/lib/types";
import type { SoftCostBreakdownItem } from "@/lib/soft-cost-breakdown";
import { computeHardCostContingency } from "@/lib/csi";

export interface BudgetProposalExportInput {
  companyName: string;
  project: Project;
  selectedScenario: "conservative" | "mid" | "optimistic";
  hardPct: number;
  contingencyPct: number;
  softBreakdown: SoftCostBreakdownItem[];
  scenarioTotal: number;
  hardCost: number;
  softCost: number;
}

function formatCurrencyFull(val: number): string {
  return `$${Math.round(val).toLocaleString()}`;
}

function formatCurrencyRate(val: number): string {
  return `$ ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function fieldValue(
  info: Record<string, { value?: string | number | boolean }>,
  keys: string[],
  fallback = "TBD"
): string {
  for (const key of keys) {
    const val = info[key]?.value;
    if (val != null && String(val).trim()) return String(val);
  }
  return fallback;
}

function estimateStage(status: Project["status"]): string {
  switch (status) {
    case "overview":
      return "Stage 1 — Conceptual Budget";
    case "detail":
      return "Stage 2 — Schematic Budget (Based on Initial BOD)";
    case "final":
    case "completed":
      return "Stage 3 — Detailed Budget";
    default:
      return "Stage 2 — Schematic Budget";
  }
}

function formatCostRange(min?: number, max?: number): string {
  if (min == null && max == null) return "TBD";
  if (min != null && max != null && min !== max) {
    return `${formatCurrencyFull(min)} – ${formatCurrencyFull(max)}`;
  }
  const val = min ?? max ?? 0;
  return val >= 0 ? `+${formatCurrencyFull(val)}` : formatCurrencyFull(val);
}

function deriveAlternates(
  qa: OverviewQA[],
  risks: RiskItem[]
): { no: string; description: string; cost: string }[] {
  const alternates: { no: string; description: string; cost: string }[] = [];
  let idx = 1;

  for (const q of qa) {
    if (!q.answered) continue;
    const selected = q.selected_option;
    for (const opt of q.options) {
      if (opt.id === selected) continue;
      const hasDelta =
        opt.cost_delta_min != null ||
        opt.cost_delta_max != null ||
        opt.cost_adjustment != null;
      if (!hasDelta && !opt.description) continue;
      alternates.push({
        no: String(idx++).padStart(2, "0"),
        description: `${q.item_title || q.question}: ${opt.label}`,
        cost: formatCostRange(opt.cost_delta_min, opt.cost_delta_max),
      });
    }
  }

  for (const r of risks) {
    alternates.push({
      no: String(idx++).padStart(2, "0"),
      description: r.title,
      cost: r.cost_impact || "TBD",
    });
  }

  return alternates;
}

const DEFAULT_EXCLUSIONS = [
  "Permit and plan check fees unless specifically included in soft cost.",
  "Bonds, including Payment & Performance, Completion, Maintenance, and Warranty.",
  "Owner's contingency.",
  "All alternates unless accepted at time of contract.",
  "Cost escalation beyond the project duration stated in this estimate.",
  "Due diligence documents including geotechnical reports not provided at time of estimate.",
  "Testing, handling, or removal of hazardous materials of any kind.",
  "Costs due to discovery of differing, concealed, or unforeseen site conditions.",
];

function deriveExclusions(qa: OverviewQA[]): string[] {
  const fromQA: string[] = [];
  for (const q of qa) {
    if (!q.answered) continue;
    const answer = q.free_text_answer || q.answer || "";
    if (
      /exclud|not in scope|owner.furnish|owner.provid|not included|by owner|ofe|out of scope/i.test(
        answer
      )
    ) {
      fromQA.push(`${q.item_title || q.question}: ${answer}`);
    }
  }
  return [...fromQA, ...DEFAULT_EXCLUSIONS];
}

function heading(text: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel] = HeadingLevel.HEADING_2) {
  return new Paragraph({ text, heading: level, spacing: { before: 240, after: 120 } });
}

function body(text: string, bold = false) {
  return new Paragraph({
    spacing: { after: 80 },
    children: [new TextRun({ text, bold })],
  });
}

function bullet(text: string) {
  return new Paragraph({
    text,
    bullet: { level: 0 },
    spacing: { after: 60 },
  });
}

function tableCell(text: string, opts?: { bold?: boolean; align?: (typeof AlignmentType)[keyof typeof AlignmentType] }) {
  return new TableCell({
    children: [
      new Paragraph({
        alignment: opts?.align,
        children: [new TextRun({ text, bold: opts?.bold })],
      }),
    ],
  });
}

function budgetTableRow(cells: string[], header = false) {
  return new TableRow({
    children: cells.map((text, i) =>
      tableCell(text, {
        bold: header,
        align: i > 0 ? AlignmentType.RIGHT : AlignmentType.LEFT,
      })
    ),
  });
}

function buildProposedBudgetRows(
  input: BudgetProposalExportInput,
  gfa: number,
  buildingLabel: string
): TableRow[] {
  const { hardCost, softCost, scenarioTotal, contingencyPct } = input;
  const contingency = computeHardCostContingency(hardCost, contingencyPct);
  const hardLine = hardCost - contingency;
  const unitCost = gfa > 0 ? scenarioTotal / gfa : 0;
  const hardUnitCost = gfa > 0 ? hardLine / gfa : 0;

  return [
    budgetTableRow(["Description", "Quantity", "Unit Cost", "Cost"], true),
    budgetTableRow([
      `${buildingLabel} (Hard Cost)`,
      gfa > 0 ? `${Math.round(gfa).toLocaleString()} SF` : "1 LS",
      gfa > 0 ? formatCurrencyRate(hardUnitCost) : "—",
      formatCurrencyFull(hardLine),
    ]),
    ...(contingency > 0
      ? [
          budgetTableRow([
            `Contingency (${contingencyPct}%)`,
            "1 LS",
            "—",
            formatCurrencyFull(contingency),
          ]),
        ]
      : []),
    budgetTableRow([
      "Soft Cost & Design-Stage Contingency",
      "1 LS",
      "—",
      formatCurrencyFull(softCost),
    ]),
    budgetTableRow([
      "Project Total",
      gfa > 0 ? `${Math.round(gfa).toLocaleString()} SF` : "1 LS",
      gfa > 0 ? formatCurrencyRate(unitCost) : "—",
      formatCurrencyFull(scenarioTotal),
    ]),
  ];
}

function buildPriceItemRows(
  divisions: CSIDivision[],
  csiScale: number,
  gfa: number,
  contingencyPct: number,
  contingencyAmount: number
): TableRow[] {
  const rows: TableRow[] = [
    budgetTableRow(
      ["Code", "Description", "Qty", "Unit", "Unit Cost", "Amount", "$/SF"],
      true
    ),
  ];

  for (const d of divisions) {
    const rate = d.rate != null ? d.rate * csiScale : null;
    const amt =
      d.qty != null && rate != null
        ? d.qty * rate
        : (d.amount || 0) * csiScale;
    rows.push(
      budgetTableRow([
        d.csi_code || "—",
        d.csi_description || d.description || "—",
        d.qty != null ? d.qty.toLocaleString() : "—",
        d.unit || "—",
        rate != null ? formatCurrencyRate(rate) : "—",
        formatCurrencyFull(amt),
        gfa > 0 ? formatCurrencyRate(amt / gfa) : "—",
      ])
    );
  }

  if (contingencyAmount > 0) {
    rows.push(
      budgetTableRow([
        "",
        `Contingency (${contingencyPct}%)`,
        "1",
        "LS",
        formatCurrencyRate(contingencyAmount),
        formatCurrencyFull(contingencyAmount),
        gfa > 0 ? formatCurrencyRate(contingencyAmount / gfa) : "—",
      ])
    );
  }

  return rows;
}

export async function buildBudgetProposalDocument(
  input: BudgetProposalExportInput
): Promise<Document> {
  const { companyName, project, hardCost, softCost, scenarioTotal, contingencyPct } =
    input;
  const info = project.confirmed_info || {};
  const extracted = project.extracted_info || {};
  const gfa = parseFloat(
    String(info.gfa_sqft?.value ?? extracted.gfa_sqft?.value ?? 0)
  );
  const buildingType = fieldValue(info, ["building_type"], "");
  const buildingLabel = buildingType
    ? `${buildingType} — Hard Cost`
    : "Building — Hard Cost";

  const divisions = project.csi_divisions || [];
  const contingencyAmount = computeHardCostContingency(hardCost, contingencyPct);
  const csiTarget = hardCost - contingencyAmount;
  const rawTotal = divisions.reduce((s, d) => s + (d.amount || 0), 0);
  const csiScale =
    rawTotal > 0 && csiTarget > 0 ? csiTarget / rawTotal : 1;

  const summaryPairs: [string, string][] = [
    ["Date:", formatDate(new Date())],
    ["Project Name:", project.title || fieldValue(info, ["project_name"], "TBD")],
    [
      "Location:",
      fieldValue(info, ["location", "address"], fieldValue(extracted, ["location"], "TBD")),
    ],
    ["Client:", fieldValue(info, ["client", "owner", "client_name"], "TBD")],
    ["Client POC:", fieldValue(info, ["client_poc", "poc", "client_contact"], "TBD")],
    ["Estimate Stage:", estimateStage(project.status)],
    [
      "Project Duration:",
      fieldValue(info, ["target_date", "project_duration", "duration"], "TBD"),
    ],
    [
      "Size:",
      gfa > 0
        ? `${Math.round(gfa).toLocaleString()} SF`
        : fieldValue(info, ["gfa_sqft"], "TBD"),
    ],
  ];

  const children: (Paragraph | Table)[] = [];

  // Title block
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [
        new TextRun({ text: companyName || "General Contractor", bold: true, size: 36 }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [new TextRun({ text: "PRE-CONSTRUCTION COST INTELLIGENCE", bold: true, size: 22 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({ text: "BUDGET ESTIMATE", bold: true, size: 28 })],
    }),
    body(
      `${companyName || "The GC"} submits the following document as the schematic-level budget estimate for the referenced project.`
    )
  );

  // Project Summary
  children.push(heading("Summary"));
  for (const [label, value] of summaryPairs) {
    children.push(
      new Paragraph({
        spacing: { after: 40 },
        children: [
          new TextRun({ text: label, bold: true }),
          new TextRun({ text: ` ${value}` }),
        ],
      })
    );
  }

  // Proposed Budget
  children.push(
    heading(
      "Proposed Budget (Includes general conditions, insurance, and fee):"
    ),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: buildProposedBudgetRows(input, gfa, buildingLabel),
    })
  );

  // Documents
  children.push(heading("Documents"));
  const files = project.uploaded_files || [];
  if (files.length === 0) {
    children.push(body("No documents uploaded."));
  } else {
    for (const f of files) {
      children.push(bullet(f.name));
    }
  }

  // Assumptions and Clarifications
  children.push(heading("Assumptions and Clarifications"));
  const guesses = project.ai_guesses || [];
  if (guesses.length === 0) {
    children.push(body("No assumptions recorded. Run estimation to populate this section."));
  } else {
    guesses.forEach((g, i) => {
      children.push(
        bullet(`A${i + 1}. ${g.item} — ${g.value}`),
        ...(g.reasoning
          ? [body(`   ${g.reasoning}`)]
          : [])
      );
    });
  }

  // Alternates
  children.push(
    heading("Alternates: Not Included in the base budget estimate")
  );
  const alternates = deriveAlternates(project.overview_qa || [], project.risks || []);
  if (alternates.length === 0) {
    children.push(body("No alternates identified."));
  } else {
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          budgetTableRow(["Alternate No.", "Description", "Additional Cost"], true),
          ...alternates.map((a) =>
            budgetTableRow([a.no, a.description, a.cost])
          ),
        ],
      })
    );
  }

  // Exclusions
  children.push(heading("Exclusions"));
  for (const ex of deriveExclusions(project.overview_qa || [])) {
    children.push(bullet(ex));
  }

  // Price Item List
  children.push(heading("Price Item List"));
  if (divisions.length === 0) {
    children.push(body("No price items available."));
  } else {
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: buildPriceItemRows(
          divisions,
          csiScale,
          gfa,
          contingencyPct,
          contingencyAmount
        ),
      }),
      body(
        `Total Hard Cost: ${formatCurrencyFull(hardCost)} | Soft Cost: ${formatCurrencyFull(softCost)} | Project Total: ${formatCurrencyFull(scenarioTotal)}`,
        true
      )
    );
  }

  return new Document({
    sections: [{ properties: {}, children }],
  });
}

export async function downloadBudgetProposalDocx(
  input: BudgetProposalExportInput
): Promise<void> {
  const doc = await buildBudgetProposalDocument(input);
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const safeName = (input.project.title || "estimate")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "_");
  a.href = url;
  a.download = `${safeName}_Budget_Proposal.docx`;
  a.click();
  URL.revokeObjectURL(url);
}
