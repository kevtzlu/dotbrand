import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlignTable,
  WidthType,
} from "docx";
import type { CSIDivision, OverviewQA, Project, RiskItem } from "@/lib/types";
import type { SoftCostBreakdownItem } from "@/lib/soft-cost-breakdown";
import { buildSoftCostSheetRows } from "@/lib/soft-cost-breakdown";
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

// ── Brand / layout tokens (matched to sample .docx) ──
const PAGE_WIDTH_DXA = 9360;
const FONT = "Calibri";

const NAVY = "1B3F6B";
const LIGHT_BLUE = "D9E8F5";
const ALT_ROW = "F5F5F5";
const WHITE = "FFFFFF";
const TEXT_MUTED = "555555";
const TEXT_SUBTLE = "888888";

const BODY_SIZE = 20; // 10pt
const SMALL_SIZE = 16; // 8pt
const SUBTITLE_SIZE = 15; // 7.5pt
const TITLE_SIZE = 26; // 13pt
const COMPANY_SIZE = 28; // 14pt

const CELL_MARGIN = { top: 80, bottom: 80, left: 140, right: 140 };
const TABLE_BORDERS = {
  top: { style: BorderStyle.SINGLE, size: 4, color: "BFBFBF" },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: "BFBFBF" },
  left: { style: BorderStyle.SINGLE, size: 4, color: "BFBFBF" },
  right: { style: BorderStyle.SINGLE, size: 4, color: "BFBFBF" },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: "BFBFBF" },
  insideVertical: { style: BorderStyle.SINGLE, size: 4, color: "BFBFBF" },
};
const NO_BORDERS = {
  top: { style: BorderStyle.NONE, size: 0, color: WHITE },
  bottom: { style: BorderStyle.NONE, size: 0, color: WHITE },
  left: { style: BorderStyle.NONE, size: 0, color: WHITE },
  right: { style: BorderStyle.NONE, size: 0, color: WHITE },
  insideHorizontal: { style: BorderStyle.NONE, size: 0, color: WHITE },
  insideVertical: { style: BorderStyle.NONE, size: 0, color: WHITE },
};

type CellBorders = {
  top: { style: (typeof BorderStyle)[keyof typeof BorderStyle]; size: number; color: string };
  bottom: { style: (typeof BorderStyle)[keyof typeof BorderStyle]; size: number; color: string };
  left: { style: (typeof BorderStyle)[keyof typeof BorderStyle]; size: number; color: string };
  right: { style: (typeof BorderStyle)[keyof typeof BorderStyle]; size: number; color: string };
  insideHorizontal: { style: (typeof BorderStyle)[keyof typeof BorderStyle]; size: number; color: string };
  insideVertical: { style: (typeof BorderStyle)[keyof typeof BorderStyle]; size: number; color: string };
};

type Align = (typeof AlignmentType)[keyof typeof AlignmentType];

interface CellOpts {
  width?: number;
  colSpan?: number;
  fill?: string;
  bold?: boolean;
  color?: string;
  size?: number;
  align?: Align;
  vAlign?: (typeof VerticalAlignTable)[keyof typeof VerticalAlignTable];
  borders?: CellBorders;
  italic?: boolean;
}

function formatCurrencyFull(val: number): string {
  return `$${Math.round(val).toLocaleString()}`;
}

function formatCurrencyRate(val: number): string {
  return `$ ${val.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const SQFT_PER_PING = 35.583175;

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

function fieldValueFromSources(
  confirmed: Record<string, { value?: string | number | boolean }>,
  extracted: Record<string, { value?: string | number | boolean }>,
  keys: string[],
  fallback = "TBD"
): string {
  const fromConfirmed = fieldValue(confirmed, keys, "");
  if (fromConfirmed) return fromConfirmed;
  return fieldValue(extracted, keys, fallback);
}

function parseDateValue(raw: string): Date | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatShortDate(raw: string): string {
  const parsed = parseDateValue(raw);
  if (!parsed) return raw;
  return parsed.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatProjectDuration(
  confirmed: Record<string, { value?: string | number | boolean }>,
  extracted: Record<string, { value?: string | number | boolean }>,
  project: Project
): string {
  const start = fieldValueFromSources(
    confirmed,
    extracted,
    ["start_date", "construction_start_date"],
    ""
  );
  const end = fieldValueFromSources(
    confirmed,
    extracted,
    ["end_date", "estimated_completion", "target_completion_date"],
    ""
  );

  if (start && end) {
    return `${formatShortDate(start)} – ${formatShortDate(end)}`;
  }
  if (start) return `From ${formatShortDate(start)}`;
  if (end) return `Until ${formatShortDate(end)}`;

  if (project.construction_start_date) {
    return `Construction start: ${formatShortDate(project.construction_start_date)}`;
  }

  return fieldValueFromSources(
    confirmed,
    extracted,
    ["target_date", "project_duration", "duration", "date_range"],
    "TBD"
  );
}

function formatSizePing(
  confirmed: Record<string, { value?: string | number | boolean }>,
  extracted: Record<string, { value?: string | number | boolean }>,
  gfaSqft: number
): string {
  const pingRaw = fieldValueFromSources(
    confirmed,
    extracted,
    ["gfa_ping", "total_ping", "area_ping", "ping"],
    ""
  );
  if (pingRaw) {
    const ping = parseFloat(pingRaw.replace(/,/g, ""));
    if (!Number.isNaN(ping) && ping > 0) {
      return `${Math.round(ping).toLocaleString()} 坪`;
    }
    return `${pingRaw} 坪`;
  }

  if (gfaSqft > 0) {
    const ping = gfaSqft / SQFT_PER_PING;
    return `${Math.round(ping).toLocaleString()} 坪`;
  }

  return "TBD";
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

function textRun(
  text: string,
  opts?: { bold?: boolean; color?: string; size?: number; italic?: boolean }
) {
  return new TextRun({
    text,
    font: FONT,
    bold: opts?.bold,
    italics: opts?.italic,
    color: opts?.color ?? "000000",
    size: opts?.size ?? BODY_SIZE,
  });
}

function styledCell(text: string, opts: CellOpts = {}) {
  return new TableCell({
    width: opts.width ? { size: opts.width, type: WidthType.DXA } : undefined,
    columnSpan: opts.colSpan,
    shading: opts.fill
      ? { fill: opts.fill, type: ShadingType.CLEAR, color: "auto" }
      : undefined,
    verticalAlign: opts.vAlign ?? VerticalAlignTable.CENTER,
    margins: CELL_MARGIN,
    borders: opts.borders ?? TABLE_BORDERS,
    children: [
      new Paragraph({
        alignment: opts.align ?? AlignmentType.LEFT,
        spacing: { before: 0, after: 0 },
        children: [
          textRun(text, {
            bold: opts.bold,
            color: opts.color,
            size: opts.size,
            italic: opts.italic,
          }),
        ],
      }),
    ],
  });
}

function styledCellRuns(runs: TextRun[], opts: CellOpts = {}) {
  return new TableCell({
    width: opts.width ? { size: opts.width, type: WidthType.DXA } : undefined,
    columnSpan: opts.colSpan,
    shading: opts.fill
      ? { fill: opts.fill, type: ShadingType.CLEAR, color: "auto" }
      : undefined,
    verticalAlign: opts.vAlign ?? VerticalAlignTable.CENTER,
    margins: CELL_MARGIN,
    borders: opts.borders ?? TABLE_BORDERS,
    children: [
      new Paragraph({
        alignment: opts.align ?? AlignmentType.LEFT,
        spacing: { before: 0, after: 0 },
        children: runs,
      }),
    ],
  });
}

function fixedTable(columnWidths: number[], rows: TableRow[]) {
  return new Table({
    width: { size: PAGE_WIDTH_DXA, type: WidthType.DXA },
    columnWidths,
    layout: TableLayoutType.FIXED,
    rows,
  });
}

function sectionBanner(title: string) {
  return fixedTable([PAGE_WIDTH_DXA], [
    new TableRow({
      children: [
        styledCell(title, {
          width: PAGE_WIDTH_DXA,
          fill: NAVY,
          bold: true,
          color: WHITE,
          size: BODY_SIZE,
        }),
      ],
    }),
  ]);
}

function spacer(after = 120) {
  return new Paragraph({ spacing: { after } });
}

function buildHeaderTable(companyName: string, intro: string) {
  return fixedTable([3000, 6360], [
    new TableRow({
      children: [
        styledCellRuns(
          [
            ...(companyName
              ? [
                  textRun(companyName, {
                    bold: true,
                    size: COMPANY_SIZE,
                    color: NAVY,
                  }),
                  textRun("\n"),
                ]
              : []),
            textRun("PRE-CONSTRUCTION COST INTELLIGENCE", {
              size: SUBTITLE_SIZE,
              color: TEXT_SUBTLE,
            }),
          ],
          { width: 3000, borders: NO_BORDERS, vAlign: VerticalAlignTable.BOTTOM }
        ),
        styledCellRuns(
          [
            textRun("BUDGET ESTIMATE", {
              bold: true,
              size: TITLE_SIZE,
              color: NAVY,
            }),
            textRun("\n"),
            textRun(intro, { size: SMALL_SIZE, color: TEXT_MUTED }),
          ],
          {
            width: 6360,
            align: AlignmentType.RIGHT,
            borders: NO_BORDERS,
            vAlign: VerticalAlignTable.BOTTOM,
          }
        ),
      ],
    }),
  ]);
}

function buildKeyValueTable(
  title: string,
  pairs: [string, string][],
  columnWidths: [number, number] = [2100, 7260]
) {
  const rows: TableRow[] = [
    new TableRow({
      children: [
        styledCell(title, {
          width: PAGE_WIDTH_DXA,
          colSpan: 2,
          fill: NAVY,
          bold: true,
          color: WHITE,
        }),
      ],
    }),
  ];

  pairs.forEach(([label, value], i) => {
    const fill = i % 2 === 0 ? WHITE : ALT_ROW;
    rows.push(
      new TableRow({
        children: [
          styledCell(label, {
            width: columnWidths[0],
            fill,
            bold: true,
          }),
          styledCell(value, { width: columnWidths[1], fill }),
        ],
      })
    );
  });

  return fixedTable(columnWidths, rows);
}

function buildDataTable(
  title: string,
  headers: string[],
  dataRows: string[][],
  columnWidths: number[],
  opts?: { totalRow?: string[]; includeTitleRow?: boolean }
) {
  const colCount = headers.length;
  const rows: TableRow[] = [];

  if (opts?.includeTitleRow !== false && title) {
    rows.push(
      new TableRow({
        children: [
          styledCell(title, {
            width: PAGE_WIDTH_DXA,
            colSpan: colCount,
            fill: NAVY,
            bold: true,
            color: WHITE,
          }),
        ],
      })
    );
  }

  rows.push(
    new TableRow({
      children: headers.map((h, i) =>
        styledCell(h, {
          width: columnWidths[i],
          fill: LIGHT_BLUE,
          bold: true,
        })
      ),
    })
  );

  dataRows.forEach((cells, i) => {
    const fill = i % 2 === 0 ? ALT_ROW : WHITE;
    rows.push(
      new TableRow({
        children: cells.map((text, ci) =>
          styledCell(text, { width: columnWidths[ci], fill })
        ),
      })
    );
  });

  if (opts?.totalRow) {
    rows.push(
      new TableRow({
        children: opts.totalRow.map((text, ci) =>
          styledCell(text, {
            width: columnWidths[ci],
            fill: WHITE,
            bold: true,
          })
        ),
      })
    );
  }

  return fixedTable(columnWidths, rows);
}

function buildAlternatesTable(
  alternates: { no: string; description: string; cost: string }[]
) {
  const columnWidths = [937, 5734, 2689];
  const rows: TableRow[] = [
    new TableRow({
      children: columnWidths.map((w, i) =>
        styledCell(
          ["Alternate No.", "Description", "Additional Cost"][i],
          { width: w, fill: LIGHT_BLUE, bold: true }
        )
      ),
    }),
  ];

  alternates.forEach((alt, i) => {
    const fill = i % 2 === 0 ? ALT_ROW : WHITE;
    rows.push(
      new TableRow({
        children: [
          styledCell(alt.no, { width: columnWidths[0], fill }),
          styledCell(alt.description, { width: columnWidths[1], fill }),
          styledCell(alt.cost, { width: columnWidths[2], fill }),
        ],
      })
    );
  });

  return fixedTable(columnWidths, rows);
}

function assumptionParagraphs(
  guesses: Project["ai_guesses"]
): Paragraph[] {
  if (!guesses?.length) {
    return [
      new Paragraph({
        spacing: { after: 80 },
        children: [
          textRun(
            "No assumptions recorded. Run estimation to populate this section.",
            { color: TEXT_MUTED }
          ),
        ],
      }),
    ];
  }

  const paras: Paragraph[] = [];
  guesses.forEach((g, i) => {
    paras.push(
      new Paragraph({
        spacing: { before: i === 0 ? 0 : 120, after: 40 },
        children: [
          textRun(`${g.item}`, { bold: true }),
          textRun(` — ${g.value}`),
        ],
      })
    );
    if (g.reasoning) {
      paras.push(
        new Paragraph({
          spacing: { after: 60 },
          indent: { left: 360 },
          children: [textRun(g.reasoning, { color: TEXT_MUTED, size: SMALL_SIZE })],
        })
      );
    }
  });
  return paras;
}

function exclusionParagraphs(exclusions: string[]): Paragraph[] {
  return exclusions.map(
    (text) =>
      new Paragraph({
        spacing: { after: 60 },
        bullet: { level: 0 },
        children: [textRun(text)],
      })
  );
}

function buildProposedBudgetRows(
  input: BudgetProposalExportInput,
  gfa: number,
  buildingLabel: string
): string[][] {
  const { hardCost, softCost, scenarioTotal, contingencyPct } = input;
  const contingency = computeHardCostContingency(hardCost, contingencyPct);
  const hardLine = hardCost - contingency;
  const unitCost = gfa > 0 ? scenarioTotal / gfa : 0;
  const hardUnitCost = gfa > 0 ? hardLine / gfa : 0;

  const rows: string[][] = [
    [
      `${buildingLabel} (Hard Cost)`,
      gfa > 0 ? `${Math.round(gfa).toLocaleString()} SF` : "1 LS",
      gfa > 0 ? formatCurrencyRate(hardUnitCost) : "—",
      formatCurrencyFull(hardLine),
    ],
  ];

  if (contingency > 0) {
    rows.push([
      `Contingency (${contingencyPct}%)`,
      "1 LS",
      "—",
      formatCurrencyFull(contingency),
    ]);
  }

  rows.push(
    ["Soft Cost & Design-Stage Contingency", "1 LS", "—", formatCurrencyFull(softCost)]
  );

  return rows;
}

function buildProposedBudgetTotalRow(
  input: BudgetProposalExportInput,
  gfa: number
): string[] {
  const { scenarioTotal } = input;
  const unitCost = gfa > 0 ? scenarioTotal / gfa : 0;
  return [
    "Project Total",
    gfa > 0 ? `${Math.round(gfa).toLocaleString()} SF` : "1 LS",
    gfa > 0 ? formatCurrencyRate(unitCost) : "—",
    formatCurrencyFull(scenarioTotal),
  ];
}

function buildPriceItemRows(
  divisions: CSIDivision[],
  csiScale: number,
  gfa: number,
  contingencyPct: number,
  contingencyAmount: number
): string[][] {
  const rows: string[][] = [];

  for (const d of divisions) {
    const rate = d.rate != null ? d.rate * csiScale : null;
    const amt =
      d.qty != null && rate != null
        ? d.qty * rate
        : (d.amount || 0) * csiScale;
    rows.push([
      d.csi_code || "—",
      d.csi_description || d.description || "—",
      d.qty != null ? d.qty.toLocaleString() : "—",
      d.unit || "—",
      rate != null ? formatCurrencyRate(rate) : "—",
      formatCurrencyFull(amt),
      gfa > 0 ? formatCurrencyRate(amt / gfa) : "—",
    ]);
  }

  if (contingencyAmount > 0) {
    rows.push([
      "",
      `Contingency (${contingencyPct}%)`,
      "1",
      "LS",
      formatCurrencyRate(contingencyAmount),
      formatCurrencyFull(contingencyAmount),
      gfa > 0 ? formatCurrencyRate(contingencyAmount / gfa) : "—",
    ]);
  }

  return rows;
}

function buildSoftCostTableRows(
  softCostTotal: number,
  breakdown: SoftCostBreakdownItem[]
): { dataRows: string[][]; totalRow: string[] } {
  const rows = buildSoftCostSheetRows(softCostTotal, breakdown);
  const total = rows[rows.length - 1];
  const dataRows = rows.slice(0, -1).map((row) => [
    row.Category,
    `${row["% of Soft"]}%`,
    formatCurrencyFull(row.Amount),
  ]);
  return {
    dataRows,
    totalRow: [total.Category, "", formatCurrencyFull(total.Amount)],
  };
}

export async function buildBudgetProposalDocument(
  input: BudgetProposalExportInput
): Promise<Document> {
  const {
    companyName,
    project,
    hardCost,
    softCost,
    scenarioTotal,
    contingencyPct,
    softBreakdown,
  } = input;
  const info = project.confirmed_info || {};
  const extracted = project.extracted_info || {};
  const gfa = parseFloat(
    String(info.gfa_sqft?.value ?? extracted.gfa_sqft?.value ?? 0)
  );
  const buildingType = fieldValueFromSources(info, extracted, ["building_type"], "");
  const buildingLabel = buildingType || "Building";

  const divisions = project.csi_divisions || [];
  const contingencyAmount = computeHardCostContingency(hardCost, contingencyPct);
  const csiTarget = hardCost - contingencyAmount;
  const rawTotal = divisions.reduce((s, d) => s + (d.amount || 0), 0);
  const csiScale =
    rawTotal > 0 && csiTarget > 0 ? csiTarget / rawTotal : 1;

  const gcLabel = companyName || "General Contractor";
  const intro = `${gcLabel} submits the following document as the schematic-level budget estimate for the referenced project.`;

  const summaryPairs: [string, string][] = [
    ["Date:", formatDate(new Date())],
    [
      "Project Name:",
      project.title ||
        fieldValueFromSources(info, extracted, ["project_name"], "TBD"),
    ],
    [
      "Location:",
      fieldValueFromSources(
        info,
        extracted,
        ["location", "address"],
        "TBD"
      ),
    ],
    [
      "Client:",
      fieldValueFromSources(
        info,
        extracted,
        ["client", "owner", "client_name", "owner_name", "client_company"],
        "TBD"
      ),
    ],
    [
      "Client POC:",
      fieldValueFromSources(
        info,
        extracted,
        [
          "client_poc",
          "poc",
          "client_contact",
          "point_of_contact",
          "owner_contact",
          "contact_name",
        ],
        "TBD"
      ),
    ],
    ["Estimate Stage:", estimateStage(project.status)],
    ["Project Duration:", formatProjectDuration(info, extracted, project)],
    ["Size:", formatSizePing(info, extracted, gfa)],
  ];

  const files = project.uploaded_files || [];
  const documentPairs: [string, string][] =
    files.length > 0
      ? files.map((f, i) => [`Document ${i + 1}:`, f.name])
      : [["Reference:", "No documents uploaded."]];

  const alternates = deriveAlternates(project.overview_qa || [], project.risks || []);
  const exclusions = deriveExclusions(project.overview_qa || []);
  const softCostTable = buildSoftCostTableRows(softCost, softBreakdown);

  const budgetColumnWidths = [3960, 2100, 1650, 1650];
  const priceColumnWidths = [1000, 3000, 900, 800, 1360, 1600, 700];
  const softCostColumnWidths = [4680, 2340, 2340];

  const children: (Paragraph | Table)[] = [
    buildHeaderTable(companyName, intro),
    spacer(160),
    buildKeyValueTable("Summary", summaryPairs),
    spacer(160),
    buildDataTable(
      "Proposed Budget (Includes general conditions, insurance, and fee):",
      ["Description", "Quantity", "Unit Cost", "Cost"],
      buildProposedBudgetRows(input, gfa, buildingLabel),
      budgetColumnWidths,
      { totalRow: buildProposedBudgetTotalRow(input, gfa) }
    ),
    spacer(160),
    buildKeyValueTable("Documents", documentPairs),
    spacer(160),
    sectionBanner("Assumptions and Clarifications"),
    ...assumptionParagraphs(project.ai_guesses),
    spacer(160),
    sectionBanner("Alternates: Not Included in the base budget estimate"),
    ...(alternates.length > 0
      ? [buildAlternatesTable(alternates)]
      : [
          new Paragraph({
            spacing: { before: 80, after: 80 },
            children: [textRun("No alternates identified.", { color: TEXT_MUTED })],
          }),
        ]),
    spacer(160),
    sectionBanner("Exclusions"),
    ...exclusionParagraphs(exclusions),
    spacer(160),
    sectionBanner("Price Item List"),
    spacer(80),
    ...(divisions.length > 0
      ? [
          buildDataTable(
            "",
            ["Code", "Description", "Qty", "Unit", "Unit Cost", "Amount", "$/SF"],
            buildPriceItemRows(
              divisions,
              csiScale,
              gfa,
              contingencyPct,
              contingencyAmount
            ),
            priceColumnWidths,
            { includeTitleRow: false }
          ),
          new Paragraph({
            spacing: { before: 120 },
            children: [
              textRun(
                `Total Hard Cost: ${formatCurrencyFull(hardCost)}    Soft Cost: ${formatCurrencyFull(softCost)}    Project Total: ${formatCurrencyFull(scenarioTotal)}`,
                { bold: true, color: NAVY }
              ),
            ],
          }),
          spacer(160),
          buildDataTable(
            "Soft Cost Breakdown",
            ["Category", "% of Soft", "Amount"],
            softCostTable.dataRows,
            softCostColumnWidths,
            { totalRow: softCostTable.totalRow }
          ),
        ]
      : [
          new Paragraph({
            children: [textRun("No price items available.", { color: TEXT_MUTED })],
          }),
          spacer(160),
          buildDataTable(
            "Soft Cost Breakdown",
            ["Category", "% of Soft", "Amount"],
            softCostTable.dataRows,
            softCostColumnWidths,
            { totalRow: softCostTable.totalRow }
          ),
        ]),
  ];

  return new Document({
    styles: {
      default: {
        document: {
          run: { font: FONT, size: BODY_SIZE, color: "000000" },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
          },
        },
        children,
      },
    ],
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
