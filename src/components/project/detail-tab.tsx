"use client";

import { useState, useMemo } from "react";
import {
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Pencil,
  Check,
  X,
  Loader2,
  ArrowRight,
  Lightbulb,
  FileSearch,
} from "lucide-react";
import type {
  Project,
  CSIDivision,
  RiskItem,
  AIGuess,
  AIEvidence,
} from "@/lib/types";

interface DetailTabProps {
  project: Project;
  onUpdate: (updates: Partial<Project>) => Promise<void>;
  onRunEstimate: () => Promise<void>;
  onNavigateToFinal: () => void;
  isEstimating: boolean;
}

function formatCurrency(val: number): string {
  if (val >= 1_000_000_000) return `$${(val / 1_000_000_000).toFixed(1)}B`;
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(0)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}K`;
  return `$${val.toFixed(0)}`;
}

// -- Section 1: Monte Carlo --
function MonteCarloSection({
  project,
  onUpdate,
}: {
  project: Project;
  onUpdate: (u: Partial<Project>) => Promise<void>;
}) {
  const mc = project.monte_carlo;
  if (!mc) return null;

  const scenarios = [
    { key: "conservative", label: "CONSERVATIVE", value: mc.conservative },
    { key: "mid", label: "MID PRICE", value: mc.mid },
    { key: "optimistic", label: "OPTIMISTIC", value: mc.optimistic },
  ] as const;

  const selected = project.selected_scenario || "mid";

  return (
    <div className="grid grid-cols-3 gap-4">
      {scenarios.map(({ key, label, value }) => {
        const isSelected = selected === key;
        return (
          <button
            key={key}
            onClick={() => onUpdate({ selected_scenario: key })}
            className={`relative rounded-xl p-5 text-center border transition-all bg-[#18181b] ${
              isSelected
                ? "border-white/30 ring-2 ring-white/10 shadow-lg"
                : "border-gray-800 hover:border-gray-600"
            }`}
          >
            <div className="text-[10px] font-bold uppercase tracking-widest mb-2 text-gray-400">
              {label}
            </div>
            <div className="text-3xl font-black text-white">
              {formatCurrency(value)}
            </div>
            {isSelected && (
              <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                <Check className="w-3 h-3 text-white" />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

// -- Section 2: Risk Bar Chart --
function RiskSection({ risks }: { risks: RiskItem[] }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  if (!risks?.length) return null;

  const topRisks = risks.slice(0, 5);

  // Assign percentage based on rank (visual weight, not actual probability)
  const riskPercentages = [28, 25, 20, 14, 10];
  const barColors = [
    "bg-red-500",
    "bg-orange-500",
    "bg-amber-500",
    "bg-yellow-500",
    "bg-yellow-400",
  ];

  return (
    <div className="space-y-4">
      <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">
        TOP 5 RISK REGISTER
      </h3>
      <div className="space-y-2.5">
        {topRisks.map((risk, i) => {
          const pct = riskPercentages[i] ?? 10;
          return (
            <div key={i}>
              <button
                onClick={() => setOpenIdx(openIdx === i ? null : i)}
                className="w-full flex items-center gap-3 group"
              >
                <span className="text-xs font-semibold text-gray-300 w-[180px] shrink-0 text-left truncate">
                  Risk {String(i + 1).padStart(2, "0")} {risk.title.split(" ").slice(0, 3).join(" ")}
                </span>
                <div className="flex-1 h-5 bg-gray-800 rounded-sm overflow-hidden">
                  <div
                    className={`h-full ${barColors[i]} rounded-sm transition-all`}
                    style={{ width: `${pct * 3}%` }}
                  />
                </div>
                <span className="text-xs font-mono text-gray-400 w-10 text-right">
                  {pct}%
                </span>
              </button>
              {openIdx === i && (
                <div className="ml-[180px] pl-3 mt-2 mb-1 text-xs space-y-1 border-l-2 border-gray-700">
                  <div>
                    <span className="font-semibold text-gray-500">
                      Cost Impact:{" "}
                    </span>
                    <span className="text-gray-300">{risk.cost_impact}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-gray-500">
                      Mitigation:{" "}
                    </span>
                    <span className="text-gray-300">{risk.mitigation}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// -- Section 3: Hard/Soft Ratio Bar --
function RatioSection({
  project,
  onUpdate,
}: {
  project: Project;
  onUpdate: (u: Partial<Project>) => Promise<void>;
}) {
  const ratio = project.hard_soft_ratio || { hard_pct: 85, soft_pct: 15 };

  return (
    <div className="space-y-3">
      <div className="text-xs font-bold uppercase tracking-widest text-gray-400">
        HARD COST {ratio.hard_pct}% vs. SOFT COST {ratio.soft_pct}%
      </div>
      <div className="flex h-4 rounded-sm overflow-hidden">
        <div
          className="bg-amber-500 transition-all"
          style={{ width: `${ratio.hard_pct}%` }}
        />
        <div
          className="bg-gray-600 transition-all"
          style={{ width: `${ratio.soft_pct}%` }}
        />
      </div>
    </div>
  );
}

// -- Section 4: CSI Table --
function CSITable({
  project,
  onUpdate,
  onSelectRow,
  selectedScenario,
  monteCarlo,
}: {
  project: Project;
  onUpdate: (u: Partial<Project>) => Promise<void>;
  onSelectRow: (row: CSIDivision | null) => void;
  selectedScenario: "conservative" | "mid" | "optimistic";
  monteCarlo: { conservative: number; mid: number; optimistic: number } | null;
}) {
  const [editingCell, setEditingCell] = useState<{
    rowId: string;
    field: string;
  } | null>(null);
  const [editValue, setEditValue] = useState("");
  const divisions = project.csi_divisions || [];

  // Scale factor: ratio of selected scenario total to mid baseline
  const scaleFactor = useMemo(() => {
    if (!monteCarlo || !monteCarlo.mid || selectedScenario === "mid") return 1;
    return monteCarlo[selectedScenario] / monteCarlo.mid;
  }, [monteCarlo, selectedScenario]);

  const gfa = parseFloat(
    String(
      project.confirmed_info?.gfa_sqft?.value ||
        project.extracted_info?.gfa_sqft?.value ||
        0
    )
  );

  const buildingType =
    project.confirmed_info?.building_type?.value ||
    project.extracted_info?.building_type?.value ||
    "";
  const floors =
    project.confirmed_info?.floors?.value ||
    project.extracted_info?.floors?.value ||
    "";

  const totalAmount = useMemo(
    () => divisions.reduce((s, d) => s + (d.amount || 0) * scaleFactor, 0),
    [divisions, scaleFactor]
  );

  const scenarioLabel = useMemo(() => {
    if (selectedScenario === "mid") return "Mid scenario (baseline)";
    const pct = ((scaleFactor - 1) * 100).toFixed(1);
    const sign = scaleFactor >= 1 ? "+" : "";
    return `${selectedScenario === "conservative" ? "Conservative" : "Optimistic"} scenario (${sign}${pct}%)`;
  }, [selectedScenario, scaleFactor]);

  const handleStartEdit = (rowId: string, field: string, currentValue: any) => {
    setEditingCell({ rowId, field });
    setEditValue(String(currentValue ?? ""));
  };

  const handleSaveEdit = async () => {
    if (!editingCell) return;
    const { rowId, field } = editingCell;
    const numVal = parseFloat(editValue) || 0;

    // When editing in a non-mid scenario, convert back to mid-baseline for storage
    // qty and rate are not scenario-dependent, only amount is scaled
    const baseVal = field === "amount" && scaleFactor !== 1
      ? numVal / scaleFactor
      : numVal;

    const updated = divisions.map((d) => {
      if (d.id !== rowId) return d;
      const newDiv = { ...d, [field]: baseVal };
      if (field === "qty" || field === "rate") {
        const qty = field === "qty" ? baseVal : d.qty || 0;
        const rate = field === "rate" ? baseVal : d.rate || 0;
        newDiv.amount = qty * rate;
      }
      if (field === "amount") {
        // When directly editing amount, keep qty/rate but update the stored base amount
        newDiv.amount = baseVal;
      }
      if (gfa > 0) {
        newDiv.per_sf = newDiv.amount / gfa;
      }
      return newDiv;
    });

    const oldDiv = divisions.find((d) => d.id === rowId);
    const newHistory = [
      ...(project.edit_history || []),
      {
        field: `csi_${rowId}_${field}`,
        old_value: oldDiv ? (oldDiv as any)[field] : 0,
        new_value: numVal,
        timestamp: Date.now(),
        tab: "detail" as const,
      },
    ];

    await onUpdate({ csi_divisions: updated, edit_history: newHistory });
    setEditingCell(null);
  };

  return (
    <div className="space-y-4">
      {/* Building header */}
      <div>
        <h3 className="text-lg font-black text-white">
          HARD COST DETAIL
        </h3>
        <div className="flex items-center gap-3 mt-1">
          {(gfa > 0 || floors || buildingType) && (
            <p className="text-sm text-gray-400">
              {gfa > 0 && `GFA: ${Number(gfa).toLocaleString()} SF`}
              {floors && ` | ${floors} Stories`}
              {buildingType && ` | ${buildingType}`}
            </p>
          )}
          {scaleFactor !== 1 && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-900/40 text-amber-400 border border-amber-800/50">
              {scenarioLabel}
            </span>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-800">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-[#1e293b] text-gray-300 text-left">
              <th className="px-3 py-3 font-semibold">CSI Division</th>
              <th className="px-3 py-3 font-semibold">Description</th>
              <th className="px-3 py-3 font-semibold text-right">Qty</th>
              <th className="px-3 py-3 font-semibold">Unit</th>
              <th className="px-3 py-3 font-semibold text-right">Rate</th>
              <th className="px-3 py-3 font-semibold text-right">Amount</th>
              <th className="px-3 py-3 font-semibold text-right">$/SF</th>
              <th className="px-3 py-3 font-semibold text-center w-16">
                Confidence
              </th>
            </tr>
          </thead>
          <tbody>
            {divisions.map((div) => {
              const isEditingRow = editingCell?.rowId === div.id;
              return (
                <tr
                  key={div.id}
                  onClick={() => onSelectRow(div)}
                  className="border-t border-gray-800 hover:bg-gray-800/40 transition-colors cursor-pointer"
                >
                  <td className="px-3 py-2.5 font-mono font-semibold text-gray-400">
                    Div {div.csi_code?.split(" ")[0] || div.csi_code}
                  </td>
                  <td className="px-3 py-2.5 text-gray-200 max-w-[220px] truncate">
                    {div.csi_description || div.description}
                  </td>
                  {/* Editable: qty */}
                  <td className="px-3 py-2.5 text-right text-gray-300">
                    {isEditingRow && editingCell?.field === "qty" ? (
                      <input
                        autoFocus
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveEdit();
                          if (e.key === "Escape") setEditingCell(null);
                        }}
                        onBlur={handleSaveEdit}
                        className="w-20 px-1 py-0.5 text-right rounded border border-primary bg-gray-900 outline-none text-xs text-white"
                      />
                    ) : (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartEdit(div.id, "qty", div.qty);
                        }}
                        className="cursor-pointer hover:text-primary transition-colors"
                      >
                        {div.qty?.toLocaleString() ?? "-"}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-gray-500">{div.unit}</td>
                  {/* Editable: rate */}
                  <td className="px-3 py-2.5 text-right text-gray-300">
                    {isEditingRow && editingCell?.field === "rate" ? (
                      <input
                        autoFocus
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveEdit();
                          if (e.key === "Escape") setEditingCell(null);
                        }}
                        onBlur={handleSaveEdit}
                        className="w-20 px-1 py-0.5 text-right rounded border border-primary bg-gray-900 outline-none text-xs text-white"
                      />
                    ) : (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartEdit(div.id, "rate", div.rate);
                        }}
                        className="cursor-pointer hover:text-primary transition-colors"
                      >
                        {div.rate != null ? `$${div.rate.toLocaleString()}` : "-"}
                      </span>
                    )}
                  </td>
                  {/* Editable: amount */}
                  <td className="px-3 py-2.5 text-right font-semibold text-white">
                    {isEditingRow && editingCell?.field === "amount" ? (
                      <input
                        autoFocus
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveEdit();
                          if (e.key === "Escape") setEditingCell(null);
                        }}
                        onBlur={handleSaveEdit}
                        className="w-24 px-1 py-0.5 text-right rounded border border-primary bg-gray-900 outline-none text-xs text-white"
                      />
                    ) : (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartEdit(div.id, "amount", Math.round(div.amount * scaleFactor));
                        }}
                        className="cursor-pointer hover:text-primary transition-colors"
                      >
                        {formatCurrency(div.amount * scaleFactor)}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right text-gray-400">
                    ${((div.per_sf || 0) * scaleFactor).toFixed(2)}
                  </td>
                  {/* Confidence dot */}
                  <td className="px-3 py-2.5 text-center">
                    <div className="relative group inline-block">
                      <div
                        className={`w-3 h-3 rounded-full mx-auto ${
                          div.confidence === "high"
                            ? "bg-green-500"
                            : "bg-red-500 animate-pulse"
                        }`}
                      />
                      {div.confidence === "low" && div.confidence_reason && (
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-30 w-48 p-2 bg-gray-900 text-white text-[10px] rounded-lg shadow-xl border border-gray-700">
                          {div.confidence_reason}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {/* Total row */}
            <tr className="border-t-2 border-gray-700 bg-[#1e293b]/50">
              <td className="px-3 py-2.5 font-bold text-gray-300" colSpan={5}>
                TOTAL
              </td>
              <td className="px-3 py-2.5 text-right font-black text-white">
                {formatCurrency(totalAmount)}
              </td>
              <td className="px-3 py-2.5 text-right text-gray-400">
                {gfa > 0 ? `$${(totalAmount / gfa).toFixed(2)}` : "-"}
              </td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// -- Section 5: Right Panel — Assumptions & Validations + Guesses/Evidence --
function ExplanationPanel({
  project,
  selectedRow,
}: {
  project: Project;
  selectedRow: CSIDivision | null;
}) {
  const [guessOpen, setGuessOpen] = useState<number | null>(null);

  // When a CSI row is selected, show its explanation
  if (selectedRow) {
    return (
      <div className="space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">
          {selectedRow.csi_code} — {selectedRow.csi_description}
        </h3>
        <div className="space-y-3 text-xs">
          <div className="p-3 rounded-lg bg-blue-950/30 border border-blue-900/40">
            <div className="font-semibold text-blue-400 mb-1">Source</div>
            <div className="text-blue-200">
              {selectedRow.ai_source || "Not specified"}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-purple-950/30 border border-purple-900/40">
            <div className="font-semibold text-purple-400 mb-1">Benchmark</div>
            <div className="text-purple-200">
              {selectedRow.ai_benchmark || "Not specified"}
            </div>
          </div>
          {selectedRow.description && selectedRow.description !== selectedRow.csi_description && (
            <div className="p-3 rounded-lg bg-gray-800/50 border border-gray-700">
              <div className="font-semibold text-gray-400 mb-1">Details</div>
              <div className="text-gray-300">{selectedRow.description}</div>
            </div>
          )}
          <div className="p-3 rounded-lg bg-gray-800/50 border border-gray-700">
            <div className="flex items-center gap-2 text-gray-500">
              <Pencil className="w-3 h-3" />
              <span>
                Click any number in the table to edit. Changes update the total
                automatically.
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Default: show guesses and evidence
  const guesses = project.ai_guesses || [];
  const evidence = project.ai_evidence || [];

  return (
    <div className="space-y-6">
      {/* AI Assumptions / Guesses */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">
          KEY ASSUMPTIONS
        </h3>
        <div className="overflow-hidden rounded-lg border border-gray-800">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="bg-[#1e293b] text-gray-400">
                <th className="px-2 py-2 text-left font-semibold w-6">#</th>
                <th className="px-2 py-2 text-left font-semibold">Assumption</th>
                <th className="px-2 py-2 text-left font-semibold">Impact if Wrong</th>
              </tr>
            </thead>
            <tbody>
              {guesses.map((g: AIGuess, i: number) => (
                <tr
                  key={i}
                  className="border-t border-gray-800 hover:bg-gray-800/30 cursor-pointer"
                  onClick={() => setGuessOpen(guessOpen === i ? null : i)}
                >
                  <td className="px-2 py-2 text-gray-500 font-mono">
                    A{i + 1}
                  </td>
                  <td className="px-2 py-2 text-gray-300">{g.item}</td>
                  <td className="px-2 py-2 text-gray-400">{g.value}</td>
                </tr>
              ))}
              {guesses.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-2 py-3 text-gray-500 italic text-center">
                    Run estimation to see assumptions.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {guessOpen !== null && guesses[guessOpen] && (
          <div className="p-3 rounded-lg bg-amber-950/20 border border-amber-900/40 text-[11px] text-amber-200">
            <span className="font-semibold text-amber-400">Reasoning: </span>
            {guesses[guessOpen].reasoning}
          </div>
        )}
      </div>

      {/* Validations / Evidence */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">
          VALIDATIONS
        </h3>
        <div className="overflow-hidden rounded-lg border border-gray-800">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="bg-[#1e293b] text-gray-400">
                <th className="px-2 py-2 text-left font-semibold">Check</th>
                <th className="px-2 py-2 text-left font-semibold">Result</th>
                <th className="px-2 py-2 text-center font-semibold w-14">Status</th>
              </tr>
            </thead>
            <tbody>
              {evidence.map((e: AIEvidence, i: number) => (
                <tr key={i} className="border-t border-gray-800">
                  <td className="px-2 py-2 text-gray-300">{e.item}</td>
                  <td className="px-2 py-2 text-gray-400">{e.value}</td>
                  <td className="px-2 py-2 text-center">
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400">
                      <Check className="w-3 h-3" /> PASS
                    </span>
                  </td>
                </tr>
              ))}
              {evidence.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-2 py-3 text-gray-500 italic text-center">
                    Run estimation to see validations.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// -- Main Detail Tab --
export function DetailTab({
  project,
  onUpdate,
  onRunEstimate,
  onNavigateToFinal,
  isEstimating,
}: DetailTabProps) {
  const [selectedRow, setSelectedRow] = useState<CSIDivision | null>(null);
  const hasMC = !!project.monte_carlo;

  return (
    <div className="flex h-full bg-[#0d0d0f]">
      {/* Main content area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {/* Run estimation button if no data yet */}
        {!hasMC && (
          <div className="flex flex-col items-center justify-center py-12">
            <p className="text-sm text-gray-500 mb-4">
              Ready to generate a detailed cost estimation based on the
              confirmed project information.
            </p>
            <button
              onClick={onRunEstimate}
              disabled={isEstimating}
              className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isEstimating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Running Estimation...
                </>
              ) : (
                "Generate Detailed Estimate"
              )}
            </button>
          </div>
        )}

        {hasMC && (
          <>
            <MonteCarloSection project={project} onUpdate={onUpdate} />
            <RiskSection risks={project.risks} />
            <RatioSection project={project} onUpdate={onUpdate} />
            <CSITable
              project={project}
              onUpdate={onUpdate}
              onSelectRow={setSelectedRow}
              selectedScenario={project.selected_scenario || "mid"}
              monteCarlo={project.monte_carlo}
            />

            {/* Confirm button */}
            <div className="pt-4 border-t border-gray-800">
              <button
                onClick={onNavigateToFinal}
                className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition-colors"
              >
                <Check className="w-4 h-4" />
                Confirm Estimate & Proceed to Final
              </button>
            </div>
          </>
        )}
      </div>

      {/* Right panel */}
      {hasMC && (
        <div className="w-[340px] shrink-0 overflow-y-auto p-5 border-l border-gray-800 bg-[#0c0c0e]">
          {selectedRow && (
            <button
              onClick={() => setSelectedRow(null)}
              className="mb-4 text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1"
            >
              <X className="w-3 h-3" /> Back to overview
            </button>
          )}
          <ExplanationPanel project={project} selectedRow={selectedRow} />
        </div>
      )}
    </div>
  );
}
