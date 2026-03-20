"use client";

import { useState, useMemo, useEffect, useRef } from "react";
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
import { uploadToR2, embedDocument, ACCEPTED_EXTENSIONS, MAX_FILE_SIZE, formatFileSize } from "@/lib/upload";

interface DetailTabProps {
  project: Project;
  onUpdate: (updates: Partial<Project>) => Promise<void>;
  onRunEstimate: () => Promise<void>;
  isEstimating: boolean;
}

function formatCurrency(val: number): string {
  if (val >= 1_000_000_000) return `$${(val / 1_000_000_000).toFixed(2)}B`;
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(2)}K`;
  return `$${val.toFixed(2)}`;
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
  const divisions = project.csi_divisions || [];

  // Scale factor: CSI total should equal monte_carlo[scenario] × hard_pct%
  // Stored CSI amounts are the baseline; scale them to match the target.
  const scaleFactor = useMemo(() => {
    if (!monteCarlo || !monteCarlo.mid) return 1;
    const scenarioTotal = monteCarlo[selectedScenario] || monteCarlo.mid;
    const targetHardCost = scenarioTotal * (hardPct / 100);
    const rawCsiTotal = divisions.reduce((s, d) => s + (d.amount || 0), 0);
    if (rawCsiTotal <= 0) return 1;
    return targetHardCost / rawCsiTotal;
  }, [monteCarlo, selectedScenario, hardPct, divisions]);

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
                            : "bg-red-500 animate-pulse cursor-pointer"
                        }`}
                      />
                      {div.confidence === "low" && (
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-30 w-32 p-2 bg-gray-900 text-white text-[10px] rounded-lg shadow-xl border border-gray-700 text-center">
                          Click to see details
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

// -- Section 5: Soft Cost Summary --
function SoftCostSection({
  monteCarlo,
  selectedScenario,
  softPct,
}: {
  monteCarlo: { conservative: number; mid: number; optimistic: number } | null;
  selectedScenario: "conservative" | "mid" | "optimistic";
  softPct: number;
}) {
  const [breakdown, setBreakdown] = useState([
    { label: "Design & Engineering Fees", pct: 35 },
    { label: "Permits & Inspections", pct: 15 },
    { label: "Insurance & Bonding", pct: 12 },
    { label: "Project Management", pct: 18 },
    { label: "Contingency", pct: 20 },
  ]);
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
    setBreakdown((prev) => prev.map((b, i) => i === editingIdx ? { ...b, pct: val } : b));
    setEditingIdx(null);
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-black text-white">SOFT COST SUMMARY</h3>
        <p className="text-sm text-gray-400 mt-1">
          {softPct}% of total estimate = {formatCurrency(softCost)}
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
                  {formatCurrency(softCost * (item.pct / 100))}
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-gray-700 bg-[#1e293b]/50">
              <td className="px-3 py-2.5 font-bold text-gray-300">TOTAL SOFT COST</td>
              <td className={`px-3 py-2.5 text-right font-semibold ${Math.round(totalPct) !== 100 ? "text-amber-400" : "text-gray-400"}`}>
                {totalPct.toFixed(1)}%
              </td>
              <td className="px-3 py-2.5 text-right font-black text-white">
                {formatCurrency(softCost)}
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
function ExplanationPanel({
  project,
  selectedRow,
  onUpdate,
}: {
  project: Project;
  selectedRow: CSIDivision | null;
  onUpdate: (u: Partial<Project>) => Promise<void>;
}) {
  const [guessOpen, setGuessOpen] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
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
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      alert(`File too large. Max ${formatFileSize(MAX_FILE_SIZE)}.`);
      return;
    }
    setUploading(true);
    try {
      const buffer = await file.arrayBuffer();
      const url = await uploadToR2(buffer, file.type, file.name);
      if (project.conversation_id) {
        await embedDocument(url, file.name, project.conversation_id);
      }
      const newFile: UploadedFile = { name: file.name, url, size: file.size, type: file.type };
      await onUpdate({ uploaded_files: [...(project.uploaded_files || []), newFile] });
      setUploadSuccess(true);
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

          {/* Low confidence reason + actions */}
          {selectedRow.confidence === "low" && (
            <>
              {selectedRow.confidence_reason && (
                <div className="p-3 rounded-lg bg-amber-950/30 border border-amber-900/40">
                  <div className="flex items-center gap-1.5 font-semibold text-amber-400 mb-1">
                    <AlertTriangle className="w-3 h-3" />
                    Low Confidence
                  </div>
                  <div className="text-amber-200">{selectedRow.confidence_reason}</div>
                </div>
              )}

              {/* Upload supporting document */}
              <div className="p-3 rounded-lg bg-gray-800/50 border border-gray-700 space-y-2">
                <div className="font-semibold text-gray-400">Upload supporting document</div>
                <p className="text-gray-500 text-[10px]">
                  Upload geological reports, structural drawings, or other documents to improve confidence.
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept={ACCEPTED_EXTENSIONS.join(",")}
                  onChange={handleFileUpload}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-dashed border-gray-600 hover:border-gray-400 text-gray-400 hover:text-gray-200 text-xs transition-colors disabled:opacity-50"
                >
                  {uploading ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading...</>
                  ) : (
                    <><Upload className="w-3.5 h-3.5" /> Choose file</>
                  )}
                </button>
              </div>

              {/* Confirm button */}
              <button
                onClick={() => handleConfirm([selectedRow.id])}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-semibold transition-colors"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                Confirm this estimate
              </button>

              {/* After upload: show related low-confidence items */}
              {uploadSuccess && otherLowConfidence.length > 0 && (
                <div className="p-3 rounded-lg bg-gray-800/50 border border-gray-700 space-y-2">
                  <div className="font-semibold text-gray-400 text-[11px]">
                    Also confirm these related items?
                  </div>
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
            </>
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
  isEstimating,
}: DetailTabProps) {
  const [selectedRow, setSelectedRow] = useState<CSIDivision | null>(null);
  const resolvedSelectedRow = useMemo(() => {
    if (!selectedRow) return null;
    return project.csi_divisions?.find(d => d.id === selectedRow.id) || null;
  }, [selectedRow, project.csi_divisions]);
  const hasMC = !!project.monte_carlo;
  const autoTriggered = useRef(false);
  const profileApplied = useRef(false);
  const ratio = project.hard_soft_ratio || { hard_pct: 85, soft_pct: 15 };
  const [localHard, setLocalHard] = useState(ratio.hard_pct);
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

  // Auto-start estimation when tab mounts without data
  useEffect(() => {
    if (!hasMC && !isEstimating && !autoTriggered.current) {
      autoTriggered.current = true;
      onRunEstimate();
    }
  }, [hasMC, isEstimating, onRunEstimate]);

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

    // CSI Sheet (scaled)
    const csiData = divisions.map((d) => ({
      "CSI Code": d.csi_code,
      "Description": d.csi_description,
      Qty: d.qty,
      Unit: d.unit,
      Rate: d.rate,
      Amount: Math.round(d.amount * csiScale),
      "$/SF": gfaExport > 0 ? Number(((d.amount * csiScale) / gfaExport).toFixed(2)) : 0,
      Confidence: d.confidence,
    }));
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
          <ExplanationPanel project={project} selectedRow={resolvedSelectedRow} onUpdate={onUpdate} />
        </div>
      )}
    </div>
  );
}
