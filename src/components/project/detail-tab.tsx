"use client";

import { useState, useMemo } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Pencil,
  Check,
  X,
  Loader2,
  ArrowRight,
  ShieldAlert,
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
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`;
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
    { key: "optimistic", label: "OPTIMISTIC", value: mc.optimistic, color: "emerald" },
    { key: "mid", label: "MID PRICE", value: mc.mid, color: "blue" },
    { key: "conservative", label: "CONSERVATIVE", value: mc.conservative, color: "orange" },
  ] as const;

  const selected = project.selected_scenario || "mid";

  return (
    <div className="grid grid-cols-3 gap-4">
      {scenarios.map(({ key, label, value, color }) => {
        const isSelected = selected === key;
        const bgClass = {
          emerald: "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40",
          blue: "bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/40",
          orange: "bg-orange-50/50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900/40",
        }[color];
        const textClass = {
          emerald: "text-emerald-700 dark:text-emerald-300",
          blue: "text-blue-700 dark:text-blue-300",
          orange: "text-orange-700 dark:text-orange-300",
        }[color];
        const labelClass = {
          emerald: "text-emerald-600 dark:text-emerald-400",
          blue: "text-blue-600 dark:text-blue-400",
          orange: "text-orange-600 dark:text-orange-400",
        }[color];

        return (
          <button
            key={key}
            onClick={() => onUpdate({ selected_scenario: key })}
            className={`relative rounded-2xl p-5 text-center border-2 transition-all ${bgClass} ${
              isSelected ? "ring-4 ring-primary/20 scale-[1.02] shadow-lg" : "hover:scale-[1.01]"
            }`}
          >
            <div className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${labelClass}`}>
              {label}
            </div>
            <div className={`text-3xl font-black ${textClass}`}>
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

// -- Section 2: Risks --
function RiskSection({ risks }: { risks: RiskItem[] }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  if (!risks?.length) return null;

  const topRisks = risks.slice(0, 5);

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold flex items-center gap-2">
        <ShieldAlert className="w-4 h-4 text-orange-500" />
        Top 5 Risk Factors
      </h3>
      <div className="space-y-2">
        {topRisks.map((risk, i) => (
          <div
            key={i}
            className="rounded-xl border border-orange-100 dark:border-orange-900/40 overflow-hidden"
          >
            <button
              onClick={() => setOpenIdx(openIdx === i ? null : i)}
              className="w-full flex items-center gap-3 p-3 bg-orange-50/50 dark:bg-orange-950/20 text-left hover:bg-orange-100 dark:hover:bg-orange-950/40 transition-colors"
            >
              <AlertTriangle className="w-4 h-4 text-orange-500 shrink-0" />
              <span className="flex-1 text-sm font-semibold text-orange-700 dark:text-orange-400">
                {risk.title}
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  risk.probability === "HIGH"
                    ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                    : risk.probability === "MEDIUM"
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                      : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                }`}
              >
                {risk.probability}
              </span>
              {openIdx === i ? (
                <ChevronUp className="w-4 h-4 text-orange-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-orange-400" />
              )}
            </button>
            {openIdx === i && (
              <div className="px-4 py-3 bg-white dark:bg-orange-950/10 text-xs space-y-1 border-t border-orange-100 dark:border-orange-900/30">
                <div>
                  <span className="font-semibold text-gray-600 dark:text-gray-400">
                    Cost Impact:{" "}
                  </span>
                  <span className="text-gray-800 dark:text-gray-200">
                    {risk.cost_impact}
                  </span>
                </div>
                <div>
                  <span className="font-semibold text-gray-600 dark:text-gray-400">
                    Mitigation:{" "}
                  </span>
                  <span className="text-gray-800 dark:text-gray-200">
                    {risk.mitigation}
                  </span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// -- Section 3: Hard/Soft Ratio --
function RatioSection({
  project,
  onUpdate,
}: {
  project: Project;
  onUpdate: (u: Partial<Project>) => Promise<void>;
}) {
  const ratio = project.hard_soft_ratio || { hard_pct: 85, soft_pct: 15 };

  const handleChange = (hard: number) => {
    const clamped = Math.max(50, Math.min(95, hard));
    onUpdate({
      hard_soft_ratio: { hard_pct: clamped, soft_pct: 100 - clamped },
    });
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold">Hard / Soft Cost Ratio</h3>
      <div className="flex items-center gap-4">
        <span className="text-xs font-bold text-blue-600 dark:text-blue-400 w-20">
          HARD {ratio.hard_pct}%
        </span>
        <input
          type="range"
          min={50}
          max={95}
          value={ratio.hard_pct}
          onChange={(e) => handleChange(parseInt(e.target.value))}
          className="flex-1 h-2 rounded-full appearance-none bg-gray-200 dark:bg-gray-700 accent-primary cursor-pointer"
        />
        <span className="text-xs font-bold text-amber-600 dark:text-amber-400 w-20 text-right">
          SOFT {ratio.soft_pct}%
        </span>
      </div>
    </div>
  );
}

// -- Section 4: CSI Table --
function CSITable({
  project,
  onUpdate,
  onSelectRow,
}: {
  project: Project;
  onUpdate: (u: Partial<Project>) => Promise<void>;
  onSelectRow: (row: CSIDivision | null) => void;
}) {
  const [editingCell, setEditingCell] = useState<{
    rowId: string;
    field: string;
  } | null>(null);
  const [editValue, setEditValue] = useState("");
  const divisions = project.csi_divisions || [];

  const gfa = parseFloat(
    String(
      project.confirmed_info?.gfa_sqft?.value ||
        project.extracted_info?.gfa_sqft?.value ||
        0
    )
  );

  const totalAmount = useMemo(
    () => divisions.reduce((s, d) => s + (d.amount || 0), 0),
    [divisions]
  );

  const handleStartEdit = (rowId: string, field: string, currentValue: any) => {
    setEditingCell({ rowId, field });
    setEditValue(String(currentValue ?? ""));
  };

  const handleSaveEdit = async () => {
    if (!editingCell) return;
    const { rowId, field } = editingCell;
    const numVal = parseFloat(editValue) || 0;

    const updated = divisions.map((d) => {
      if (d.id !== rowId) return d;
      const newDiv = { ...d, [field]: numVal };
      // Recalculate amount if qty or rate changed
      if (field === "qty" || field === "rate") {
        const qty = field === "qty" ? numVal : d.qty || 0;
        const rate = field === "rate" ? numVal : d.rate || 0;
        newDiv.amount = qty * rate;
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
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold">CSI Division Breakdown</h3>
        <div className="text-sm font-bold text-primary">
          Total: {formatCurrency(totalAmount)}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-900 text-gray-500 text-left">
              <th className="px-3 py-2.5 font-semibold">CSI</th>
              <th className="px-3 py-2.5 font-semibold">Description</th>
              <th className="px-3 py-2.5 font-semibold text-right">Qty</th>
              <th className="px-3 py-2.5 font-semibold">Unit</th>
              <th className="px-3 py-2.5 font-semibold text-right">Rate</th>
              <th className="px-3 py-2.5 font-semibold text-right">Amount</th>
              <th className="px-3 py-2.5 font-semibold text-right">$/SF</th>
              <th className="px-3 py-2.5 font-semibold text-center w-12">
                Conf.
              </th>
              <th className="px-3 py-2.5 w-8" />
            </tr>
          </thead>
          <tbody>
            {divisions.map((div) => {
              const isEditingRow = editingCell?.rowId === div.id;
              return (
                <tr
                  key={div.id}
                  className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors"
                >
                  <td className="px-3 py-2 font-mono font-semibold text-gray-600 dark:text-gray-400">
                    {div.csi_code}
                  </td>
                  <td className="px-3 py-2 text-gray-800 dark:text-gray-200 max-w-[200px] truncate">
                    {div.csi_description}
                  </td>
                  {/* Editable: qty */}
                  <td className="px-3 py-2 text-right">
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
                        className="w-20 px-1 py-0.5 text-right rounded border border-primary bg-white dark:bg-gray-800 outline-none text-xs"
                      />
                    ) : (
                      <span
                        onClick={() =>
                          handleStartEdit(div.id, "qty", div.qty)
                        }
                        className="cursor-pointer hover:text-primary transition-colors"
                      >
                        {div.qty?.toLocaleString() ?? "-"}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-500">{div.unit}</td>
                  {/* Editable: rate */}
                  <td className="px-3 py-2 text-right">
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
                        className="w-20 px-1 py-0.5 text-right rounded border border-primary bg-white dark:bg-gray-800 outline-none text-xs"
                      />
                    ) : (
                      <span
                        onClick={() =>
                          handleStartEdit(div.id, "rate", div.rate)
                        }
                        className="cursor-pointer hover:text-primary transition-colors"
                      >
                        {div.rate != null ? `$${div.rate.toLocaleString()}` : "-"}
                      </span>
                    )}
                  </td>
                  {/* Editable: amount */}
                  <td className="px-3 py-2 text-right font-semibold">
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
                        className="w-24 px-1 py-0.5 text-right rounded border border-primary bg-white dark:bg-gray-800 outline-none text-xs"
                      />
                    ) : (
                      <span
                        onClick={() =>
                          handleStartEdit(div.id, "amount", div.amount)
                        }
                        className="cursor-pointer hover:text-primary transition-colors"
                      >
                        {formatCurrency(div.amount)}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-500">
                    ${div.per_sf?.toFixed(2) ?? "0.00"}
                  </td>
                  {/* Confidence */}
                  <td className="px-3 py-2 text-center">
                    <div
                      className="relative group inline-block"
                      title={
                        div.confidence === "high"
                          ? "High confidence"
                          : div.confidence_reason || "Low confidence"
                      }
                    >
                      <div
                        className={`w-3 h-3 rounded-full mx-auto ${
                          div.confidence === "high"
                            ? "bg-green-500"
                            : "bg-red-500 animate-pulse"
                        }`}
                      />
                      {div.confidence === "low" && div.confidence_reason && (
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-30 w-48 p-2 bg-gray-900 text-white text-[10px] rounded-lg shadow-xl">
                          {div.confidence_reason}
                        </div>
                      )}
                    </div>
                  </td>
                  {/* Help icon */}
                  <td className="px-2 py-2">
                    <button
                      onClick={() => onSelectRow(div)}
                      className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 text-gray-400 hover:text-primary transition-colors"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// -- Section 5: AI Explanation + Guesses/Evidence --
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
        <h3 className="text-sm font-bold flex items-center gap-2">
          <FileSearch className="w-4 h-4 text-primary" />
          {selectedRow.csi_code} — {selectedRow.csi_description}
        </h3>
        <div className="space-y-3 text-xs">
          <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40">
            <div className="font-semibold text-blue-700 dark:text-blue-400 mb-1">
              Source
            </div>
            <div className="text-blue-900 dark:text-blue-200">
              {selectedRow.ai_source || "Not specified"}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/40">
            <div className="font-semibold text-purple-700 dark:text-purple-400 mb-1">
              Benchmark
            </div>
            <div className="text-purple-900 dark:text-purple-200">
              {selectedRow.ai_benchmark || "Not specified"}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
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

  // Default: show guesses and evidence tables
  const guesses = project.ai_guesses || [];
  const evidence = project.ai_evidence || [];

  return (
    <div className="space-y-6">
      {/* Guesses */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-amber-500" />
          AI Inferences ({guesses.length})
        </h3>
        <div className="space-y-2">
          {guesses.map((g: AIGuess, i: number) => (
            <div
              key={i}
              className="rounded-lg border border-amber-100 dark:border-amber-900/40 overflow-hidden"
            >
              <button
                onClick={() => setGuessOpen(guessOpen === i ? null : i)}
                className="w-full flex items-center gap-2 p-2.5 text-left text-xs hover:bg-amber-50 dark:hover:bg-amber-950/20 transition-colors"
              >
                <span className="flex-1 font-medium text-gray-800 dark:text-gray-200">
                  {g.item}
                </span>
                <span className="font-mono text-amber-600 dark:text-amber-400 shrink-0">
                  {g.value}
                </span>
                {guessOpen === i ? (
                  <ChevronUp className="w-3 h-3 text-gray-400" />
                ) : (
                  <ChevronDown className="w-3 h-3 text-gray-400" />
                )}
              </button>
              {guessOpen === i && (
                <div className="px-3 py-2 bg-amber-50/50 dark:bg-amber-950/10 border-t border-amber-100 dark:border-amber-900/30 text-[11px] text-gray-600 dark:text-gray-400">
                  {g.reasoning}
                </div>
              )}
            </div>
          ))}
          {guesses.length === 0 && (
            <p className="text-xs text-gray-400 italic">
              Run estimation to see AI inferences.
            </p>
          )}
        </div>
      </div>

      {/* Evidence */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <FileSearch className="w-4 h-4 text-green-500" />
          Document Evidence ({evidence.length})
        </h3>
        <div className="space-y-1">
          {evidence.map((e: AIEvidence, i: number) => (
            <div
              key={i}
              className="flex items-center gap-3 p-2.5 rounded-lg bg-green-50/50 dark:bg-green-950/10 border border-green-100 dark:border-green-900/40 text-xs"
            >
              <div className="flex-1">
                <span className="font-medium text-gray-800 dark:text-gray-200">
                  {e.item}
                </span>
                <span className="text-gray-500 ml-2">{e.value}</span>
              </div>
              <span className="text-green-600 dark:text-green-400 text-[10px] shrink-0">
                {e.source_doc} p.{e.page_ref}
              </span>
            </div>
          ))}
          {evidence.length === 0 && (
            <p className="text-xs text-gray-400 italic">
              Run estimation to see document evidence.
            </p>
          )}
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
    <div className="flex h-full">
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
            {/* Section 1: Monte Carlo */}
            <MonteCarloSection project={project} onUpdate={onUpdate} />

            {/* Section 2: Risk Cards */}
            <RiskSection risks={project.risks} />

            {/* Section 3: Hard/Soft Ratio */}
            <RatioSection project={project} onUpdate={onUpdate} />

            {/* Section 4: CSI Table */}
            <CSITable
              project={project}
              onUpdate={onUpdate}
              onSelectRow={setSelectedRow}
            />

            {/* Confirm button */}
            <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
              <button
                onClick={onNavigateToFinal}
                className="w-full flex items-center justify-center gap-2 py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-colors"
              >
                <Check className="w-4 h-4" />
                Confirm Estimate &amp; Proceed to Final
              </button>
            </div>
          </>
        )}
      </div>

      {/* Right panel: Explanation */}
      {hasMC && (
        <div className="w-[340px] shrink-0 overflow-y-auto p-5 border-l border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#0c0c0e]">
          {selectedRow && (
            <button
              onClick={() => setSelectedRow(null)}
              className="mb-4 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-1"
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
