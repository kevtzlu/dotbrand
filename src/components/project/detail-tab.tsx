"use client";

import { useState, useMemo, useEffect, useRef, Fragment } from "react";
import {
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Pencil,
  Check,
  CheckCircle,
  X,
  Loader2,
  ArrowRight,
  Lightbulb,
  FileSearch,
  FileSpreadsheet,
  AlertTriangle,
  Upload,
  Plus,
  Trash2,
} from "lucide-react";
import * as XLSX from "xlsx";
import type {
  Project,
  CSIDivision,
  RiskItem,
  AIGuess,
  AIEvidence,
  UploadedFile,
} from "@/lib/types";
import {
  DEFAULT_SOFT_COST_BREAKDOWN,
  buildSoftCostSheetRows,
  type SoftCostBreakdownItem,
} from "@/lib/soft-cost-breakdown";
import { uploadToR2, embedDocument, ACCEPTED_EXTENSIONS, MAX_FILE_SIZE, formatFileSize } from "@/lib/upload";
import {
  computeCsiDisplayAmounts,
  computeCsiScaleFactor,
  normalizeCsiDivisionsToTarget,
  sanitizeCsiDivision,
} from "@/lib/csi";
import {
  divisionIdsForDocRefine,
  divisionMatchesUploadedDoc,
  actionPatternsForUpload,
} from "@/lib/csi-doc-match";
interface DetailTabProps {
  project: Project;
  onUpdate: (updates: Partial<Project>) => Promise<void>;
  onRunEstimate: () => Promise<void>;
  onRetryEstimate: () => Promise<void>;
  isEstimating: boolean;
  isOverviewEstimating?: boolean;
}

function formatCurrency(val: number): string {
  if (val >= 1_000_000_000) return `$${(val / 1_000_000_000).toFixed(2)}B`;
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(2)}K`;
  return `$${val.toFixed(2)}`;
}

function formatCurrencyFull(val: number): string {
  return `$${Math.round(val).toLocaleString()}`;
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

// -- Section 3: Hard/Soft Ratio Slider --
function RatioSection({
  localHard,
  onSliderChange,
}: {
  localHard: number;
  onSliderChange: (value: number) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="text-xs font-bold uppercase tracking-widest text-gray-400">
        HARD COST {localHard}% vs. SOFT COST {100 - localHard}%
      </div>
      <div
        className="relative h-5 cursor-pointer group"
        onPointerDown={(e) => {
          const bar = e.currentTarget;
          const rect = bar.getBoundingClientRect();
          const update = (clientX: number) => {
            const pct = Math.round(
              Math.min(99, Math.max(50, ((clientX - rect.left) / rect.width) * 100))
            );
            onSliderChange(pct);
          };
          update(e.clientX);
          const onMove = (ev: PointerEvent) => update(ev.clientX);
          const onUp = () => {
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
          };
          window.addEventListener("pointermove", onMove);
          window.addEventListener("pointerup", onUp);
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
      >
        {/* Color bar */}
        <div className="absolute inset-y-0 left-0 right-0 flex rounded-sm overflow-hidden my-0.5">
          <div className="bg-amber-500" style={{ width: `${localHard}%` }} />
          <div className="bg-gray-600" style={{ width: `${100 - localHard}%` }} />
        </div>
        {/* Thumb indicator */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-5 rounded-sm bg-white shadow-md border border-gray-300 group-hover:scale-110 transition-transform"
          style={{ left: `${localHard}%` }}
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
  hardPct,
}: {
  project: Project;
  onUpdate: (u: Partial<Project>) => Promise<void>;
  onSelectRow: (row: CSIDivision | null) => void;
  selectedScenario: "conservative" | "mid" | "optimistic";
  monteCarlo: { conservative: number; mid: number; optimistic: number } | null;
  hardPct: number;
}) {
  const [editingCell, setEditingCell] = useState<{
    rowId: string;
    field: string;
  } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [insertAfterIdx, setInsertAfterIdx] = useState<number | null>(null);
  const emptyNewRow = { csi_code: "", csi_description: "", qty: "", unit: "", rate: "", amount: "" };
  const [newRow, setNewRow] = useState(emptyNewRow);
  const repairedNegatives = useRef(false);
  const divisions = [...(project.csi_divisions || [])].sort((a, b) => {
    const normalize = (code: string) => (code || "").replace(/\s+/g, "").padEnd(6, "0");
    return normalize(a.csi_code).localeCompare(normalize(b.csi_code), undefined, { numeric: true });
  });

  const targetHardCost = useMemo(() => {
    if (!monteCarlo?.mid) return null;
    const scenarioTotal = monteCarlo[selectedScenario] || monteCarlo.mid;
    return scenarioTotal * (hardPct / 100);
  }, [monteCarlo, selectedScenario, hardPct]);

  const scaleFactor = useMemo(() => {
    if (!monteCarlo?.mid || targetHardCost == null) return 1;
    const scenarioTotal = monteCarlo[selectedScenario] || monteCarlo.mid;
    return computeCsiScaleFactor(divisions, scenarioTotal, hardPct);
  }, [monteCarlo, selectedScenario, hardPct, divisions, targetHardCost]);

  const displayById = useMemo(
    () =>
      computeCsiDisplayAmounts(
        divisions,
        scaleFactor,
        targetHardCost ?? undefined
      ),
    [divisions, scaleFactor, targetHardCost]
  );

  const gfa = parseFloat(
    String(
      project.confirmed_info?.gfa_sqft?.value ||
        project.extracted_info?.gfa_sqft?.value ||
        0
    )
  );

  // Repair legacy rows where AI returned negative rate/amount pairs.
  useEffect(() => {
    if (repairedNegatives.current || targetHardCost == null) return;
    const raw = project.csi_divisions || [];
    const hasNegative = raw.some(
      (d) => (d.rate ?? 0) < 0 || (d.amount ?? 0) < 0
    );
    if (!hasNegative) return;
    repairedNegatives.current = true;
    void onUpdate({
      csi_divisions: normalizeCsiDivisionsToTarget(raw, targetHardCost, gfa),
    });
  }, [project.csi_divisions, targetHardCost, gfa, onUpdate]);

  const buildingType =
    project.confirmed_info?.building_type?.value ||
    project.extracted_info?.building_type?.value ||
    "";
  const floors =
    project.confirmed_info?.floors?.value ||
    project.extracted_info?.floors?.value ||
    "";

  const totalAmount = useMemo(
    () =>
      targetHardCost != null
        ? Math.round(targetHardCost)
        : [...displayById.values()].reduce((s, v) => s + v.displayAmount, 0),
    [displayById, targetHardCost]
  );

  const scenarioLabel = useMemo(() => {
    if (selectedScenario === "mid") return "Mid scenario (baseline)";
    if (!monteCarlo || !monteCarlo.mid) return selectedScenario === "conservative" ? "Conservative scenario" : "Optimistic scenario";
    const scenarioTotal = monteCarlo[selectedScenario];
    const pct = ((scenarioTotal / monteCarlo.mid - 1) * 100).toFixed(1);
    const sign = scenarioTotal >= monteCarlo.mid ? "+" : "";
    return `${selectedScenario === "conservative" ? "Conservative" : "Optimistic"} scenario (${sign}${pct}%)`;
  }, [selectedScenario, monteCarlo]);

  const handleStartEdit = (rowId: string, field: string, currentValue: any) => {
    setEditingCell({ rowId, field });
    setEditValue(String(currentValue ?? ""));
  };

  const handleSaveEdit = async () => {
    if (!editingCell) return;
    const { rowId, field } = editingCell;
    const numVal = Math.max(0, parseFloat(editValue) || 0);

    // Rate and amount are both scaled for display; unscale on save
    const baseVal = (field === "amount" || field === "rate") && scaleFactor !== 1
      ? numVal / scaleFactor
      : numVal;

    const updated = divisions.map((d) => {
      if (d.id !== rowId) return d;
      const newDiv = sanitizeCsiDivision({ ...d, [field]: baseVal } as CSIDivision);
      if (field === "qty" || field === "rate") {
        const qty = field === "qty" ? baseVal : d.qty || 0;
        const rate = field === "rate" ? baseVal : d.rate || 0;
        newDiv.amount = Math.round(qty * rate);
      }
      if (field === "amount") {
        newDiv.amount = baseVal;
        if (d.qty && d.qty > 0) {
          newDiv.rate = baseVal / d.qty;
        }
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

    // Recalculate Monte Carlo to match new CSI total
    // CSI total = MC[scenario] × hardPct% → MC[scenario] = CSI total / (hardPct / 100)
    const newRawTotal = updated.reduce((s, d) => s + (d.amount || 0), 0);
    let updatedMC = monteCarlo ? { ...monteCarlo } : null;
    if (updatedMC && newRawTotal > 0) {
      const oldRawTotal = divisions.reduce((s, d) => s + (d.amount || 0), 0);
      if (oldRawTotal > 0) {
        const ratio = newRawTotal / oldRawTotal;
        updatedMC = {
          conservative: Math.round(updatedMC.conservative * ratio),
          mid: Math.round(updatedMC.mid * ratio),
          optimistic: Math.round(updatedMC.optimistic * ratio),
        };
      }
    }

    await onUpdate({
      csi_divisions: updated,
      edit_history: newHistory,
      ...(updatedMC ? { monte_carlo: updatedMC } : {}),
    });
    setEditingCell(null);
  };

  const cancelNewRow = () => {
    setInsertAfterIdx(null);
    setNewRow(emptyNewRow);
  };

  const handleSaveNewRow = async () => {
    if (!newRow.csi_description) return;
    const qty = parseFloat(newRow.qty) || null;
    const displayRate = parseFloat(newRow.rate) || null;
    const rawRate = displayRate != null && scaleFactor !== 1 ? displayRate / scaleFactor : displayRate;

    let rawAmount: number;
    if (qty != null && rawRate != null) {
      rawAmount = qty * rawRate;
    } else {
      const displayAmount = parseFloat(newRow.amount) || 0;
      rawAmount = scaleFactor !== 1 ? displayAmount / scaleFactor : displayAmount;
    }

    const newDiv: CSIDivision = {
      id: `user-${Date.now()}`,
      csi_code: newRow.csi_code || "—",
      csi_description: newRow.csi_description,
      description: "",
      qty,
      unit: newRow.unit,
      rate: rawRate,
      amount: rawAmount,
      per_sf: gfa > 0 ? rawAmount / gfa : 0,
      confidence: "high" as const,
    };

    const idx = insertAfterIdx ?? divisions.length - 1;
    const updated = [
      ...divisions.slice(0, idx + 1),
      newDiv,
      ...divisions.slice(idx + 1),
    ];

    const oldRawTotal = divisions.reduce((s, d) => s + (d.amount || 0), 0);
    const newRawTotal = updated.reduce((s, d) => s + (d.amount || 0), 0);
    let updatedMC = monteCarlo ? { ...monteCarlo } : null;
    if (updatedMC && newRawTotal > 0 && oldRawTotal > 0) {
      const ratio = newRawTotal / oldRawTotal;
      updatedMC = {
        conservative: Math.round(updatedMC.conservative * ratio),
        mid: Math.round(updatedMC.mid * ratio),
        optimistic: Math.round(updatedMC.optimistic * ratio),
      };
    }

    await onUpdate({
      csi_divisions: updated,
      ...(updatedMC ? { monte_carlo: updatedMC } : {}),
    });
    setInsertAfterIdx(null);
    setNewRow(emptyNewRow);
  };

  const handleDeleteRow = async (rowId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = divisions.filter((d) => d.id !== rowId);
    const oldRawTotal = divisions.reduce((s, d) => s + (d.amount || 0), 0);
    const newRawTotal = updated.reduce((s, d) => s + (d.amount || 0), 0);
    let updatedMC = monteCarlo ? { ...monteCarlo } : null;
    if (updatedMC && oldRawTotal > 0) {
      const ratio = newRawTotal > 0 ? newRawTotal / oldRawTotal : 0;
      updatedMC = {
        conservative: Math.round(updatedMC.conservative * ratio),
        mid: Math.round(updatedMC.mid * ratio),
        optimistic: Math.round(updatedMC.optimistic * ratio),
      };
    }
    await onUpdate({
      csi_divisions: updated,
      ...(updatedMC ? { monte_carlo: updatedMC } : {}),
    });
  };

  // Display amount computed from current new-row inputs (in display/scaled units)
  const newRowDisplayAmount = useMemo(() => {
    const q = parseFloat(newRow.qty);
    const r = parseFloat(newRow.rate);
    if (!isNaN(q) && q > 0 && !isNaN(r) && r > 0) return q * r;
    const a = parseFloat(newRow.amount);
    return isNaN(a) ? null : a;
  }, [newRow.qty, newRow.rate, newRow.amount]);

  const newRowHasQtyRate = parseFloat(newRow.qty) > 0 && parseFloat(newRow.rate) > 0;

  // Renders a thin clickable separator between rows.
  // When hovered, a blue insert-line + "+" pill appears ON the border.
  // When insertAfterIdx matches, renders the new-row form instead.
  const renderInsertPoint = (idx: number) => {
    if (insertAfterIdx === idx) return newRowForm;
    if (insertAfterIdx !== null) return null;
    return (
      <tr
        key={`sep-${idx}`}
        className="group/sep cursor-pointer"
        onClick={() => setInsertAfterIdx(idx)}
      >
        <td
          colSpan={9}
          className="p-0 border-t border-gray-800 group-hover/sep:border-primary/50 transition-colors relative"
          style={{ height: "8px", lineHeight: 0 }}
        >
          <div className="absolute inset-x-0 top-0 -translate-y-1/2 flex items-center px-3 opacity-0 group-hover/sep:opacity-100 transition-opacity pointer-events-none z-10">
            <div className="flex-1 h-px bg-primary/70" />
            <div className="mx-2 w-4 h-4 rounded-full bg-primary flex items-center justify-center shrink-0 shadow">
              <Plus className="w-2.5 h-2.5 text-white" />
            </div>
            <div className="flex-1 h-px bg-primary/70" />
          </div>
        </td>
      </tr>
    );
  };

  const newRowForm = (
    <tr className="border-t border-primary/40 bg-blue-950/20">
      <td className="px-2 py-2">
        <input
          placeholder="Div XX"
          value={newRow.csi_code}
          onChange={(e) => setNewRow((p) => ({ ...p, csi_code: e.target.value }))}
          onKeyDown={(e) => { if (e.key === "Escape") cancelNewRow(); }}
          className="w-full px-1.5 py-1 rounded border border-gray-600 bg-gray-900 text-white text-xs outline-none focus:border-primary font-mono"
        />
      </td>
      <td className="px-2 py-2">
        <input
          placeholder="Description *"
          value={newRow.csi_description}
          autoFocus
          onChange={(e) => setNewRow((p) => ({ ...p, csi_description: e.target.value }))}
          onKeyDown={(e) => { if (e.key === "Enter") handleSaveNewRow(); if (e.key === "Escape") cancelNewRow(); }}
          className="w-full px-1.5 py-1 rounded border border-gray-600 bg-gray-900 text-white text-xs outline-none focus:border-primary"
        />
      </td>
      <td className="px-2 py-2">
        <input
          type="number"
          min={0}
          placeholder="0"
          value={newRow.qty}
          onChange={(e) => setNewRow((p) => ({ ...p, qty: e.target.value }))}
          onKeyDown={(e) => { if (e.key === "Escape") cancelNewRow(); }}
          className="w-20 px-1.5 py-1 rounded border border-gray-600 bg-gray-900 text-white text-xs text-right outline-none focus:border-primary"
        />
      </td>
      <td className="px-2 py-2">
        <input
          placeholder="SF"
          value={newRow.unit}
          onChange={(e) => setNewRow((p) => ({ ...p, unit: e.target.value }))}
          onKeyDown={(e) => { if (e.key === "Escape") cancelNewRow(); }}
          className="w-14 px-1.5 py-1 rounded border border-gray-600 bg-gray-900 text-white text-xs outline-none focus:border-primary"
        />
      </td>
      <td className="px-2 py-2">
        <input
          type="number"
          min={0}
          placeholder="$0"
          value={newRow.rate}
          onChange={(e) => setNewRow((p) => ({ ...p, rate: e.target.value, amount: "" }))}
          onKeyDown={(e) => { if (e.key === "Escape") cancelNewRow(); }}
          className="w-20 px-1.5 py-1 rounded border border-gray-600 bg-gray-900 text-white text-xs text-right outline-none focus:border-primary"
        />
      </td>
      <td className="px-2 py-2 text-right">
        {newRowHasQtyRate ? (
          <span className="text-xs font-semibold text-white">
            {newRowDisplayAmount != null ? formatCurrencyFull(newRowDisplayAmount) : "—"}
          </span>
        ) : (
          <input
            type="number"
            min={0}
            placeholder="$0"
            value={newRow.amount}
            onChange={(e) => setNewRow((p) => ({ ...p, amount: e.target.value }))}
            onKeyDown={(e) => { if (e.key === "Escape") cancelNewRow(); }}
            className="w-24 px-1.5 py-1 rounded border border-gray-600 bg-gray-900 text-white text-xs text-right outline-none focus:border-primary"
          />
        )}
      </td>
      <td className="px-2 py-2 text-right text-gray-400 text-xs">
        {gfa > 0 && newRowDisplayAmount != null && newRowDisplayAmount > 0
          ? `$${(newRowDisplayAmount / gfa).toFixed(2)}`
          : "-"}
      </td>
      <td />
      <td className="px-2 py-2">
        <div className="flex items-center gap-1">
          <button
            onClick={handleSaveNewRow}
            disabled={!newRow.csi_description}
            title="Save"
            className="p-1 rounded text-emerald-400 hover:text-emerald-300 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
          <button onClick={cancelNewRow} title="Cancel" className="p-1 rounded text-gray-500 hover:text-gray-300">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );

  return (
    <div className="space-y-4">
      {/* Building header */}
      <div>
        <h3 className="text-lg font-black text-white">HARD COST DETAIL</h3>
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
              <th className="px-3 py-3 font-semibold text-center w-24">
                Supported Doc.
              </th>
              <th className="px-2 py-3 w-16" />
            </tr>
          </thead>
          <tbody>
            {renderInsertPoint(-1)}
            {divisions.map((div, divIdx) => {
              const isEditingRow = editingCell?.rowId === div.id;
              const display = displayById.get(div.id);
              const displayRate = display?.displayRate ?? null;
              const displayAmount = display?.displayAmount ?? 0;
              const hasBreakdown = div.qty != null && displayRate != null;
              return (
                <Fragment key={div.id}>
                  <tr
                    onClick={() => onSelectRow(div)}
                    className="group hover:bg-gray-800/40 transition-colors cursor-pointer"
                  >
                    <td className="px-3 py-2.5 font-mono font-semibold text-gray-400">
                      {div.csi_code || "—"}
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
                            handleStartEdit(div.id, "rate", displayRate ?? 0);
                          }}
                          className="cursor-pointer hover:text-primary transition-colors"
                        >
                          {displayRate != null ? `$${displayRate.toLocaleString()}` : "-"}
                        </span>
                      )}
                    </td>
                    {/* Editable: amount (derived from qty × rate) */}
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
                        <div className="relative group/amt inline-block">
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartEdit(div.id, "amount", Math.round(displayAmount));
                            }}
                            className="cursor-pointer hover:text-primary transition-colors"
                          >
                            {formatCurrencyFull(displayAmount)}
                          </span>
                          {hasBreakdown && (
                            <div className="absolute bottom-full right-0 mb-2 hidden group-hover/amt:block z-30 whitespace-nowrap px-3 py-1.5 bg-gray-900 text-gray-300 text-[10px] rounded-lg shadow-xl border border-gray-700 pointer-events-none">
                              {div.qty!.toLocaleString()} {div.unit} &times; ${displayRate!.toLocaleString()}/{div.unit} = {formatCurrencyFull(displayAmount)}
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right text-gray-400">
                      {gfa > 0 ? `$${(displayAmount / gfa).toFixed(2)}` : "-"}
                    </td>
                    {/* Supported Doc. — document-backed estimate */}
                    <td className="px-3 py-2.5 text-center">
                      {div.confidence === "high" && (
                        <Check className="w-4 h-4 text-primary mx-auto" />
                      )}
                    </td>
                    {/* Row actions */}
                    <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => handleDeleteRow(div.id, e)}
                          title="Delete row"
                          className="p-1 rounded text-gray-500 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {renderInsertPoint(divIdx)}
                </Fragment>
              );
            })}
            {/* Total row */}
            <tr className="border-t-2 border-gray-700 bg-[#1e293b]/50">
              <td className="px-3 py-2.5 font-bold text-gray-300" colSpan={5}>
                TOTAL
              </td>
              <td className="px-3 py-2.5 text-right font-black text-white">
                {formatCurrencyFull(totalAmount)}
              </td>
              <td className="px-3 py-2.5 text-right text-gray-400">
                {gfa > 0 ? `$${(totalAmount / gfa).toFixed(2)}` : "-"}
              </td>
              <td />
              <td />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// -- Section 5: Soft Cost Summary --
function SoftCostSection({
  monteCarlo,
  selectedScenario,
  softPct,
  breakdown,
  onBreakdownChange,
}: {
  monteCarlo: { conservative: number; mid: number; optimistic: number } | null;
  selectedScenario: "conservative" | "mid" | "optimistic";
  softPct: number;
  breakdown: SoftCostBreakdownItem[];
  onBreakdownChange: (breakdown: SoftCostBreakdownItem[]) => void;
}) {
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");

  if (!monteCarlo) return null;

  const scenarioTotal = monteCarlo[selectedScenario] || monteCarlo.mid;
  const softCost = scenarioTotal * (softPct / 100);
  const totalPct = breakdown.reduce((s, b) => s + b.pct, 0);

  const handleStartEdit = (i: number) => {
    setEditingIdx(i);
    setEditValue(String(breakdown[i].pct));
  };

  const handleSaveEdit = () => {
    if (editingIdx === null) return;
    const val = Math.max(0, parseFloat(editValue) || 0);
    onBreakdownChange(
      breakdown.map((b, i) => (i === editingIdx ? { ...b, pct: val } : b))
    );
    setEditingIdx(null);
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-black text-white">SOFT COST SUMMARY</h3>
        <p className="text-sm text-gray-400 mt-1">
          {softPct}% of total estimate = {formatCurrencyFull(softCost)}
        </p>
      </div>
      <div className="overflow-x-auto rounded-lg border border-gray-800">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-[#1e293b] text-gray-300 text-left">
              <th className="px-3 py-3 font-semibold">Category</th>
              <th className="px-3 py-3 font-semibold text-right">% of Soft</th>
              <th className="px-3 py-3 font-semibold text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {breakdown.map((item, i) => (
              <tr key={i} className="border-t border-gray-800 hover:bg-gray-800/30">
                <td className="px-3 py-2.5 text-gray-200">{item.label}</td>
                <td className="px-3 py-2 text-right">
                  {editingIdx === i ? (
                    <div className="flex items-center justify-end gap-1">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.5}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveEdit();
                          if (e.key === "Escape") setEditingIdx(null);
                        }}
                        autoFocus
                        className="w-16 px-1.5 py-0.5 rounded bg-gray-800 border border-gray-600 text-white text-right focus:outline-none focus:border-primary"
                      />
                      <span className="text-gray-400">%</span>
                      <button onClick={handleSaveEdit} className="text-emerald-400 hover:text-emerald-300">
                        <Check className="w-3 h-3" />
                      </button>
                      <button onClick={() => setEditingIdx(null)} className="text-gray-500 hover:text-gray-300">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleStartEdit(i)}
                      className="group flex items-center justify-end gap-1 w-full text-gray-400 hover:text-white transition-colors"
                    >
                      {item.pct}%
                      <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity" />
                    </button>
                  )}
                </td>
                <td className="px-3 py-2.5 text-right font-semibold text-white">
                  {formatCurrencyFull(softCost * (item.pct / 100))}
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-gray-700 bg-[#1e293b]/50">
              <td className="px-3 py-2.5 font-bold text-gray-300">TOTAL SOFT COST</td>
              <td className={`px-3 py-2.5 text-right font-semibold ${Math.round(totalPct) !== 100 ? "text-amber-400" : "text-gray-400"}`}>
                {totalPct.toFixed(1)}%
              </td>
              <td className="px-3 py-2.5 text-right font-black text-white">
                {formatCurrencyFull(softCost)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      {Math.round(totalPct) !== 100 && (
        <p className="text-xs text-amber-400">Breakdown totals {totalPct.toFixed(1)}% — amounts shown are proportional to each % entered.</p>
      )}
    </div>
  );
}

// -- Section 6: Right Panel — Assumptions & Validations + Guesses/Evidence --
async function refineCsiDivisions(
  projectId: string,
  body: {
    primary_division_id?: string | null;
    division_ids?: string[];
    uploaded_filenames: string[];
  }
): Promise<{ project: Project; refined_ids: string[] }> {
  const maxAttempts = 3;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await fetch(`/api/projects/${projectId}/refine-csi`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) return res.json();
    const err = await res.json().catch(() => ({}));
    const retryable =
      res.status === 400 &&
      typeof err.error === "string" &&
      err.error.includes("not indexed");
    if (retryable && attempt < maxAttempts - 1) {
      await new Promise((r) => setTimeout(r, 2500));
      continue;
    }
    throw new Error(err.error || "Failed to refine estimate lines");
  }
  throw new Error("Failed to refine estimate lines");
}

function ExplanationPanel({
  project,
  selectedRow,
  onUpdate,
  isEstimating,
}: {
  project: Project;
  selectedRow: CSIDivision | null;
  onUpdate: (u: Partial<Project>) => Promise<void>;
  isEstimating: boolean;
}) {
  const [guessOpen, setGuessOpen] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [refining, setRefining] = useState(false);
  const [relatedChecked, setRelatedChecked] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset upload state when selected row changes
  useEffect(() => {
    setUploadSuccess(false);
    setRelatedChecked(new Set());
  }, [selectedRow?.id]);

  const handleConfirm = async (ids: string[]) => {
    const updated = (project.csi_divisions || []).map(d =>
      ids.includes(d.id) ? { ...d, confidence: "high" as const } : d
    );
    await onUpdate({ csi_divisions: updated });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const oversized = Array.from(files).filter(f => f.size > MAX_FILE_SIZE);
    if (oversized.length > 0) {
      alert(`These files exceed the ${formatFileSize(MAX_FILE_SIZE)} limit:\n${oversized.map(f => f.name).join("\n")}`);
      return;
    }

    const fileList = Array.from(files);
    const actionPatterns = actionPatternsForUpload(fileList.map((f) => f.name));

    setUploading(true);
    const newFiles: UploadedFile[] = [];
    try {
      const conversationId = project.conversation_id || `conv-${project.id}`;
      for (const file of fileList) {
        const buffer = await file.arrayBuffer();
        const url = await uploadToR2(buffer, file.type, file.name);
        await embedDocument(url, file.name, conversationId);
        newFiles.push({ name: file.name, url, size: file.size, type: file.type });
      }
      await onUpdate({
        conversation_id: conversationId,
        uploaded_files: [...(project.uploaded_files || []), ...newFiles],
      });
      setUploadSuccess(true);

      const divisionIds = divisionIdsForDocRefine(project.csi_divisions || [], {
        primaryDivisionId: selectedRow?.id,
        uploadedFilenames: fileList.map((f) => f.name),
      });

      const relatedIds = divisionIds.filter((id) => id !== selectedRow?.id);
      if (relatedIds.length > 0) {
        setRelatedChecked(new Set(relatedIds));
      }

      if (!isEstimating) {
        setRefining(true);
        try {
          const { project: refinedProject } = await refineCsiDivisions(project.id, {
            primary_division_id: selectedRow?.id,
            uploaded_filenames: fileList.map((f) => f.name),
          });
          await onUpdate({ csi_divisions: refinedProject.csi_divisions });
        } catch (err) {
          console.error("Partial refine after upload failed:", err);
          alert(
            err instanceof Error
              ? err.message
              : "Files uploaded, but line-item refresh failed. Try again in a few seconds."
          );
        } finally {
          setRefining(false);
        }
      }
    } catch (err) {
      console.error("Upload failed:", err);
      alert("Upload failed. Please try again.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const otherLowConfidence = (project.csi_divisions || []).filter(
    d => d.confidence === "low" && d.id !== selectedRow?.id
  );

  const toggleRelated = (id: string) => {
    setRelatedChecked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // When a CSI row is selected, show its explanation
  if (selectedRow) {
    return (
      <div className="space-y-5">
        <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">
          {selectedRow.csi_code} — {selectedRow.csi_description}
        </h3>

        {/* Estimation basis — each section's content split into bullet points */}
        <div className="space-y-4">
          {/* Source — only shown when derived from user-provided documents */}
          {selectedRow.ai_source && (
            <div className="space-y-1.5">
              <div className="text-[11px] font-semibold text-blue-400 uppercase tracking-wide">
                Source
              </div>
              <ul className="space-y-1 text-xs text-blue-200">
                {selectedRow.ai_source.split(/(?<=[.;])\s+|\n+/).filter(Boolean).map((line, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-blue-500 shrink-0 mt-0.5">&bull;</span>
                    <span>{line.replace(/[.;]+$/, "").trim()}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Benchmark */}
          <div className="space-y-1.5">
            <div className="text-[11px] font-semibold text-purple-400 uppercase tracking-wide">
              Benchmark
            </div>
            {selectedRow.ai_benchmark ? (
              <ul className="space-y-1 text-xs text-purple-200">
                {selectedRow.ai_benchmark.split(/(?<=[.;])\s+|\n+/).filter(Boolean).map((line, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-purple-500 shrink-0 mt-0.5">&bull;</span>
                    <span>{line.replace(/[.;]+$/, "").trim()}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-gray-500 italic">Not specified</p>
            )}
          </div>

          {/* Details */}
          {selectedRow.description && selectedRow.description !== selectedRow.csi_description && (
            <div className="space-y-1.5">
              <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                Details
              </div>
              <ul className="space-y-1 text-xs text-gray-300">
                {selectedRow.description.split(/(?<=[.;])\s+|\n+/).filter(Boolean).map((line, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-gray-500 shrink-0 mt-0.5">&bull;</span>
                    <span>{line.replace(/[.;]+$/, "").trim()}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Low confidence reason + GC actions */}
        {selectedRow.confidence === "low" && (
          <div className="space-y-4">
            {selectedRow.confidence_reason && (
              <div className="p-3 rounded-lg bg-amber-950/30 border border-amber-900/40">
                <div className="flex items-center gap-1.5 font-semibold text-amber-400 mb-1 text-xs">
                  <AlertTriangle className="w-3 h-3" />
                  Low Confidence
                </div>
                <div className="text-xs text-amber-200">{selectedRow.confidence_reason}</div>
              </div>
            )}

            {/* GC action items */}
            {selectedRow.ai_gc_actions && (
              <div className="space-y-2">
                <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                  GC Action Required
                </div>
                <p className="text-[11px] text-gray-500">
                  To improve confidence for this item, the GC should provide:
                </p>
                <ul className="space-y-1.5 text-xs text-gray-300">
                  {selectedRow.ai_gc_actions.split("|").filter(Boolean).map((action, i) => {
                    const dashIdx = action.indexOf(" — ");
                    const title = dashIdx !== -1 ? action.slice(0, dashIdx).trim() : action.trim();
                    const desc = dashIdx !== -1 ? action.slice(dashIdx + 3).trim() : null;
                    return (
                      <li key={i} className="flex gap-2">
                        <span className="text-gray-500 shrink-0">&bull;</span>
                        <span>
                          <span className="font-semibold text-gray-200">{title}</span>
                          {desc && <span> — {desc}</span>}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {/* Upload supporting document */}
            <div className="p-3 rounded-lg bg-gray-800/50 border border-gray-700 space-y-2">
              <div className="font-semibold text-gray-400 text-xs">Upload Document</div>
              <p className="text-gray-500 text-[10px]">
                Upload any of the above documents (PDF, XLSX, DOCX, images). Only this line and
                other items that need the same report (e.g. geotech) will be updated — your other
                manual edits are kept.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                accept={ACCEPTED_EXTENSIONS.join(",")}
                onChange={handleFileUpload}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || refining || isEstimating}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-dashed border-gray-600 hover:border-gray-400 text-gray-400 hover:text-gray-200 text-xs transition-colors disabled:opacity-50"
              >
                {uploading ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading...</>
                ) : refining ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Updating affected lines...</>
                ) : isEstimating ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Full estimation running...</>
                ) : (
                  <><Upload className="w-3.5 h-3.5" /> Choose files</>
                )}
              </button>
            </div>

            {/* Confirm without re-estimate — when amounts are acceptable but GC verified scope */}
            <button
              onClick={() => handleConfirm([selectedRow.id])}
              disabled={refining || isEstimating}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-semibold transition-colors disabled:opacity-50"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              Accept estimate as-is
            </button>

            {/* After upload: related divisions that share the same document need */}
            {uploadSuccess && otherLowConfidence.length > 0 && (
              <div className="p-3 rounded-lg bg-gray-800/50 border border-gray-700 space-y-2">
                <div className="font-semibold text-gray-400 text-[11px]">
                  Related items (same document type)
                </div>
                <p className="text-[10px] text-gray-500">
                  These were included in the partial update if they matched the upload. Confirm
                  any that still look correct without changing amounts.
                </p>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {otherLowConfidence.map(d => (
                    <label
                      key={d.id}
                      className="flex items-center gap-2 text-[11px] text-gray-300 cursor-pointer hover:text-white"
                    >
                      <input
                        type="checkbox"
                        checked={relatedChecked.has(d.id)}
                        onChange={() => toggleRelated(d.id)}
                        className="rounded border-gray-600 bg-gray-800 text-green-500 focus:ring-green-500 focus:ring-offset-0"
                      />
                      <span className="font-mono text-gray-500">{d.csi_code}</span>
                      {d.csi_description}
                    </label>
                  ))}
                </div>
                {relatedChecked.size > 0 && (
                  <button
                    onClick={() => handleConfirm(Array.from(relatedChecked))}
                    className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-[11px] font-semibold transition-colors"
                  >
                    <CheckCircle className="w-3 h-3" />
                    Confirm {relatedChecked.size} item{relatedChecked.size > 1 ? "s" : ""}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* High confidence — tip */}
        {selectedRow.confidence === "high" && (
          <div className="p-3 rounded-lg bg-green-950/20 border border-green-900/30 text-xs text-green-300 flex items-start gap-2">
            <CheckCircle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-green-500" />
            <span>This item has high confidence. No additional documents needed.</span>
          </div>
        )}

        <div className="p-3 rounded-lg bg-gray-800/50 border border-gray-700">
          <div className="flex items-center gap-2 text-gray-500 text-xs">
            <Pencil className="w-3 h-3" />
            <span>
              Click any number in the table to edit. Changes update the total
              automatically.
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Default: show guesses and evidence
  const guesses = project.ai_guesses || [];
  const evidence = project.ai_evidence || [];

  const lowConfidenceItems = (project.csi_divisions || []).filter(d => d.confidence === "low");

  return (
    <div className="space-y-6">
      {/* AI Assumptions / Guesses */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">
          KEY ASSUMPTIONS
        </h3>
        {guesses.length === 0 ? (
          <p className="text-[11px] text-gray-500 italic">Run estimation to see assumptions.</p>
        ) : (
          <ol className="space-y-2">
            {guesses.map((g: AIGuess, i: number) => (
              <li key={i}>
                <button
                  onClick={() => setGuessOpen(guessOpen === i ? null : i)}
                  className="w-full text-left group"
                >
                  <div className="flex gap-2 text-[11px]">
                    <span className="text-gray-500 font-mono shrink-0">A{i + 1}.</span>
                    <div className="flex-1">
                      <span className="text-gray-200">{g.item}</span>
                      <span className="text-gray-500 ml-1">— {g.value}</span>
                    </div>
                    <ChevronDown className={`w-3 h-3 text-gray-600 shrink-0 mt-0.5 transition-transform ${guessOpen === i ? "rotate-180" : ""}`} />
                  </div>
                </button>
                {guessOpen === i && g.reasoning && (
                  <div className="ml-6 mt-1.5 p-2 rounded bg-amber-950/20 border border-amber-900/40 text-[11px] text-amber-200">
                    <span className="font-semibold text-amber-400">Reasoning: </span>
                    {g.reasoning}
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* Validations / Evidence */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">
          VALIDATIONS
        </h3>
        {evidence.length === 0 ? (
          <p className="text-[11px] text-gray-500 italic">Run estimation to see validations.</p>
        ) : (
          <ul className="space-y-2">
            {evidence.map((e: AIEvidence, i: number) => (
              <li key={i} className="flex gap-2 text-[11px]">
                <span className="shrink-0 mt-0.5">
                  <Check className="w-3 h-3 text-emerald-400" />
                </span>
                <div>
                  <span className="text-gray-200">{e.item}</span>
                  <span className="text-gray-500 ml-1">— {e.value}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* GC Required Actions Summary */}
      {lowConfidenceItems.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-widest text-amber-400">
            GC ACTION REQUIRED
          </h3>
          <p className="text-[11px] text-gray-400">
            The following {lowConfidenceItems.length} item{lowConfidenceItems.length > 1 ? "s have" : " has"} low confidence. Click each row in the table to see details and upload documents.
          </p>
          <ul className="space-y-1.5">
            {lowConfidenceItems.map(d => (
              <li key={d.id} className="flex gap-2 text-[11px]">
                <span className="text-amber-500 shrink-0 mt-0.5">
                  <AlertTriangle className="w-3 h-3" />
                </span>
                <span className="text-gray-300">
                  <span className="font-mono text-gray-500">{d.csi_code}</span>{" "}
                  {d.csi_description}
                </span>
              </li>
            ))}
          </ul>
          <div className="p-3 rounded-lg bg-gray-800/50 border border-gray-700 space-y-2">
            <div className="text-[11px] font-semibold text-gray-400">GC should provide:</div>
            <ul className="space-y-1 text-[11px] text-gray-300">
              <li className="flex gap-2">
                <span className="text-gray-500">&bull;</span>
                Subcontractor quotes or bids for each flagged scope
              </li>
              <li className="flex gap-2">
                <span className="text-gray-500">&bull;</span>
                Technical specs, material data sheets, or shop drawings
              </li>
              <li className="flex gap-2">
                <span className="text-gray-500">&bull;</span>
                Verified quantity take-offs from field or drawings
              </li>
              <li className="flex gap-2">
                <span className="text-gray-500">&bull;</span>
                Site-specific reports (geotech, environmental, survey)
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

// -- Main Detail Tab --
export function DetailTab({
  project,
  onUpdate,
  onRunEstimate,
  onRetryEstimate,
  isEstimating,
  isOverviewEstimating = false,
}: DetailTabProps) {
  const [selectedRow, setSelectedRow] = useState<CSIDivision | null>(null);
  const resolvedSelectedRow = useMemo(() => {
    if (!selectedRow) return null;
    return project.csi_divisions?.find(d => d.id === selectedRow.id) || null;
  }, [selectedRow, project.csi_divisions]);
  const hasMC = !!project.monte_carlo;
  const autoTriggered = useRef(false);
  const prevHasMC = useRef(hasMC);
  const profileApplied = useRef(false);
  const ratio = project.hard_soft_ratio || { hard_pct: 85, soft_pct: 15 };
  const [localHard, setLocalHard] = useState(ratio.hard_pct);
  const [softBreakdown, setSoftBreakdown] = useState(DEFAULT_SOFT_COST_BREAKDOWN);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLocalHard(ratio.hard_pct);
  }, [ratio.hard_pct]);

  // When MC first arrives, apply the user's profile soft_cost_pct as the initial ratio
  // (only if the ratio is still at the system default of 85/15)
  useEffect(() => {
    if (!hasMC || profileApplied.current) return;
    if (ratio.hard_pct !== 85 || ratio.soft_pct !== 15) {
      profileApplied.current = true;
      return;
    }
    profileApplied.current = true;
    fetch("/api/profile")
      .then((r) => r.json())
      .then((data) => {
        const softPct = data.profile?.soft_cost_pct;
        if (softPct != null && softPct > 0 && softPct < 100) {
          const hard = Math.round(100 - softPct);
          setLocalHard(hard);
          onUpdate({ hard_soft_ratio: { hard_pct: hard, soft_pct: 100 - hard } });
        }
      })
      .catch(() => {/* ignore */});
  }, [hasMC]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSliderChange = (value: number) => {
    const hard = Math.round(value);
    setLocalHard(hard);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onUpdate({ hard_soft_ratio: { hard_pct: hard, soft_pct: 100 - hard } });
    }, 300);
  };

  // When overview edits invalidate detail data, allow auto-estimate to run again
  useEffect(() => {
    if (prevHasMC.current && !hasMC) {
      autoTriggered.current = false;
      profileApplied.current = false;
    }
    prevHasMC.current = hasMC;
  }, [hasMC]);

  // Auto-start estimation when tab mounts without data — but not while overview
  // re-estimation is already running (would cause a 409 conflict).
  useEffect(() => {
    if (hasMC || isEstimating || isOverviewEstimating || autoTriggered.current) return;
    autoTriggered.current = true;
    onRunEstimate().catch(() => {
      autoTriggered.current = false;
    });
  }, [hasMC, isEstimating, isOverviewEstimating, onRunEstimate]);

  // ── Export helpers (scenario-aware) ──
  const selectedScenario = project.selected_scenario || "mid";
  const mc = project.monte_carlo;

  const scenarioTotal = mc ? mc[selectedScenario] : 0;
  const hardCostExport = scenarioTotal * (localHard / 100);
  const softCostExport = scenarioTotal * ((100 - localHard) / 100);

  const gfaExport = parseFloat(
    String(
      project.confirmed_info?.gfa_sqft?.value ||
        project.extracted_info?.gfa_sqft?.value ||
        0
    )
  );

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    const divisions = project.csi_divisions || [];
    const csiScale = (() => {
      const rawTotal = divisions.reduce((s, d) => s + (d.amount || 0), 0);
      if (rawTotal <= 0 || !mc) return 1;
      return (mc[selectedScenario] * (localHard / 100)) / rawTotal;
    })();

    // Summary sheet
    const summaryData = [
      { Item: "Scenario", Value: selectedScenario.toUpperCase() },
      { Item: "Total Estimate", Value: Math.round(scenarioTotal) },
      { Item: `Hard Cost (${localHard}%)`, Value: Math.round(hardCostExport) },
      { Item: `Soft Cost (${100 - localHard}%)`, Value: Math.round(softCostExport) },
      ...(gfaExport > 0 ? [{ Item: "GFA (SF)", Value: gfaExport }, { Item: "Cost per SF", Value: Number((scenarioTotal / gfaExport).toFixed(2)) }] : []),
    ];
    const summarySheet = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summarySheet, "Summary");

    const softCostSheet = XLSX.utils.json_to_sheet(
      buildSoftCostSheetRows(softCostExport, softBreakdown)
    );
    XLSX.utils.book_append_sheet(wb, softCostSheet, "Soft Cost");

    // CSI Sheet (scaled)
    const csiData = divisions.map((d) => {
      const dRate = d.rate != null ? d.rate * csiScale : null;
      const dAmt = (d.qty != null && dRate != null) ? d.qty * dRate : (d.amount || 0) * csiScale;
      return {
        "CSI Code": d.csi_code,
        "Description": d.csi_description,
        Qty: d.qty,
        Unit: d.unit,
        Rate: dRate != null ? Math.round(dRate * 100) / 100 : null,
        Amount: Math.round(dAmt),
        "$/SF": gfaExport > 0 ? Number((dAmt / gfaExport).toFixed(2)) : 0,
        Confidence: d.confidence,
      };
    });
    const csiSheet = XLSX.utils.json_to_sheet(csiData);
    XLSX.utils.book_append_sheet(wb, csiSheet, "CSI Hard Cost");

    // Risks sheet
    if (project.risks?.length) {
      const riskData = project.risks.map((r) => ({
        Rank: r.rank,
        Risk: r.title,
        Probability: r.probability,
        "Cost Impact": r.cost_impact,
        Mitigation: r.mitigation,
      }));
      const riskSheet = XLSX.utils.json_to_sheet(riskData);
      XLSX.utils.book_append_sheet(wb, riskSheet, "Risks");
    }

    XLSX.writeFile(wb, `${project.title || "estimate"}_report.xlsx`);
  };

  return (
    <div className="flex h-full bg-[#0d0d0f]">
      {/* Main content area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {/* Run estimation button if no data yet */}
        {!hasMC && (
          <div className="flex flex-col items-center justify-center py-12">
            <p className="text-sm text-gray-500 mb-4">
              {isOverviewEstimating
                ? "Overview estimate is running. Detail generation will start automatically when it completes."
                : isEstimating
                ? "Estimation is running. This may take a few minutes."
                : "Ready to generate a detailed cost estimation based on the confirmed project information."}
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={onRunEstimate}
                disabled={isEstimating || isOverviewEstimating}
                className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {isEstimating || isOverviewEstimating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {isOverviewEstimating ? "Waiting for Overview..." : "Running Estimation..."}
                  </>
                ) : (
                  "Generate Detailed Estimate"
                )}
              </button>
              {isEstimating && (
                <button
                  onClick={onRetryEstimate}
                  className="flex items-center gap-2 px-4 py-3 bg-gray-700 text-gray-200 rounded-xl font-semibold hover:bg-gray-600 transition-colors text-sm"
                >
                  Cancel & Retry
                </button>
              )}
            </div>
          </div>
        )}

        {hasMC && (
          <>
            <MonteCarloSection project={project} onUpdate={onUpdate} />
            <RiskSection risks={project.risks} />
            <RatioSection localHard={localHard} onSliderChange={handleSliderChange} />
            <CSITable
              project={project}
              onUpdate={onUpdate}
              onSelectRow={setSelectedRow}
              selectedScenario={project.selected_scenario || "mid"}
              monteCarlo={project.monte_carlo}
              hardPct={localHard}
            />
            <SoftCostSection
              monteCarlo={project.monte_carlo}
              selectedScenario={project.selected_scenario || "mid"}
              softPct={100 - localHard}
              breakdown={softBreakdown}
              onBreakdownChange={setSoftBreakdown}
            />

            {/* Export buttons */}
            <div className="pt-4 border-t border-gray-800 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">
                EXPORT REPORT
              </h3>
              <button
                onClick={handleExportExcel}
                className="flex items-center justify-center gap-2 py-3 px-6 bg-emerald-600 text-white rounded-xl font-semibold text-sm hover:bg-emerald-700 transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Excel BOQ
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
          <ExplanationPanel
            project={project}
            selectedRow={resolvedSelectedRow}
            onUpdate={onUpdate}
            isEstimating={isEstimating}
          />
        </div>
      )}
    </div>
  );
}
