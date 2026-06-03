"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  FileText,
  FileSpreadsheet,
  Pencil,
  Check,
  X,
  Loader2,
  CheckCircle2,
  ArrowLeft,
} from "lucide-react";
import type { Project, CostSummaryRow } from "@/lib/types";
import {
  DEFAULT_SOFT_COST_BREAKDOWN,
  buildSoftCostSheetRows,
} from "@/lib/soft-cost-breakdown";
import { appendCsiHardCostTotalRow } from "@/lib/csi";
import jsPDF from "jspdf";
import * as XLSX from "xlsx";

function formatCurrency(val: number): string {
  if (val >= 1_000_000_000) return `$${(val / 1_000_000_000).toFixed(2)}B`;
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(2)}K`;
  return `$${val.toFixed(2)}`;
}

interface FinalTabProps {
  project: Project;
  onUpdate: (updates: Partial<Project>) => Promise<void>;
  onRunFinal: () => Promise<void>;
  onNavigateBack?: () => void;
  isEstimating: boolean;
}

export function FinalTab({
  project,
  onUpdate,
  onRunFinal,
  onNavigateBack,
  isEstimating,
}: FinalTabProps) {
  const [selectedRow, setSelectedRow] = useState<number | null>(null);
  const [editingCell, setEditingCell] = useState<{
    row: number;
    field: string;
  } | null>(null);
  const [editValue, setEditValue] = useState("");

  const hasFinal = project.final_total_cost != null;
  const ratio = project.hard_soft_ratio || { hard_pct: 85, soft_pct: 15 };
  const autoTriggered = useRef(false);
  const [localHard, setLocalHard] = useState(ratio.hard_pct);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync local slider state when project data changes externally
  useEffect(() => {
    setLocalHard(ratio.hard_pct);
  }, [ratio.hard_pct]);

  const handleRatioChange = useCallback((value: number) => {
    const hard = Math.round(value);
    setLocalHard(hard);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onUpdate({ hard_soft_ratio: { hard_pct: hard, soft_pct: 100 - hard } });
    }, 300);
  }, [onUpdate]);

  // Auto-start final report generation when tab mounts without data
  useEffect(() => {
    if (!hasFinal && !isEstimating && !autoTriggered.current) {
      autoTriggered.current = true;
      onRunFinal();
    }
  }, [hasFinal, isEstimating, onRunFinal]);

  // Scale factor: match selected Monte Carlo scenario
  const scaleFactor = useMemo(() => {
    const mc = project.monte_carlo;
    const scenario = project.selected_scenario || "mid";
    if (!mc || !mc.mid || scenario === "mid") return 1;
    return mc[scenario] / mc.mid;
  }, [project.monte_carlo, project.selected_scenario]);

  const computedTotal = useMemo(() => {
    if (hasFinal) return project.final_total_cost! * scaleFactor;
    return (project.csi_divisions || []).reduce(
      (s, d) => s + (d.amount || 0),
      0
    ) * scaleFactor;
  }, [hasFinal, project.final_total_cost, project.csi_divisions, scaleFactor]);

  // Always derive hard/soft from local slider value so changes are instant
  const hardCost = computedTotal * (localHard / 100);
  const softCost = computedTotal * ((100 - localHard) / 100);

  const costSummary = project.final_cost_summary || [];

  const gfa = parseFloat(
    String(
      project.confirmed_info?.gfa_sqft?.value ||
        project.extracted_info?.gfa_sqft?.value ||
        0
    )
  );

  const totalRow = useMemo(() => {
    if (costSummary.length === 0) return null;
    return {
      hq: costSummary.reduce((s, r) => s + (r.hq_building || 0), 0) * scaleFactor,
      aasc: costSummary.reduce((s, r) => s + (r.aasc_building || 0), 0) * scaleFactor,
      total: costSummary.reduce((s, r) => s + (r.total || 0), 0) * scaleFactor,
    };
  }, [costSummary, scaleFactor]);

  const handleStartEdit = (row: number, field: string, currentValue: any) => {
    setEditingCell({ row, field });
    setEditValue(String(currentValue ?? ""));
  };

  const handleSaveEdit = async () => {
    if (!editingCell) return;
    const { row, field } = editingCell;
    const numVal = parseFloat(editValue) || 0;

    // Convert back to mid-baseline for storage when in a non-mid scenario
    const baseVal = scaleFactor !== 1 ? numVal / scaleFactor : numVal;

    const updated = costSummary.map((r, i) => {
      if (i !== row) return r;
      const newRow = { ...r, [field]: baseVal };
      if (field === "hq_building" || field === "aasc_building") {
        newRow.total = (newRow.hq_building || 0) + (newRow.aasc_building || 0);
        if (gfa > 0) {
          newRow.per_sf = newRow.total / gfa;
        }
      }
      return newRow;
    });

    await onUpdate({ final_cost_summary: updated });
    setEditingCell(null);
  };

  // PDF export
  const handleExportPDF = () => {
    const doc = new jsPDF();
    const info = project.confirmed_info || {};

    doc.setFontSize(18);
    doc.text(project.title || "Project Estimate", 14, 22);

    doc.setFontSize(10);
    let y = 35;

    // Project specs
    doc.setFontSize(12);
    doc.text("Project Specifications", 14, y);
    y += 8;
    doc.setFontSize(9);
    Object.entries(info).forEach(([key, val]: [string, any]) => {
      doc.text(`${key.replace(/_/g, " ")}: ${val?.value ?? "N/A"}`, 14, y);
      y += 5;
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
    });

    // Cost summary
    y += 5;
    doc.setFontSize(12);
    doc.text("Cost Summary", 14, y);
    y += 8;
    doc.setFontSize(9);
    doc.text(`Scenario: ${(project.selected_scenario || "mid").toUpperCase()}`, 14, y);
    y += 5;
    doc.text(`Hard Cost: ${formatCurrency(hardCost)}`, 14, y);
    y += 5;
    doc.text(`Soft Cost: ${formatCurrency(softCost)}`, 14, y);
    y += 5;
    doc.text(`Total: ${formatCurrency(computedTotal)}`, 14, y);
    y += 10;

    // Risks
    if (project.risks?.length) {
      doc.setFontSize(12);
      doc.text("Risk Factors", 14, y);
      y += 8;
      doc.setFontSize(9);
      project.risks.forEach((r) => {
        doc.text(
          `[${r.probability}] ${r.title} — ${r.cost_impact}`,
          14,
          y
        );
        y += 5;
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
      });
    }

    // CSI Divisions
    y += 5;
    doc.setFontSize(12);
    doc.text("CSI Division Breakdown", 14, y);
    y += 8;
    doc.setFontSize(8);
    (project.csi_divisions || []).forEach((d) => {
      doc.text(
        `${d.csi_code} ${d.csi_description}: ${formatCurrency(d.amount)} (${d.confidence})`,
        14,
        y
      );
      y += 4;
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
    });

    doc.save(`${project.title || "estimate"}_report.pdf`);
  };

  // Excel export
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    const scenario = (project.selected_scenario || "mid").toUpperCase();
    const softPct = 100 - localHard;

    const overviewData = [
      { Item: "Scenario", Value: scenario },
      { Item: "Total Estimate", Value: Math.round(computedTotal) },
      { Item: `Hard Cost (${localHard}%)`, Value: Math.round(hardCost) },
      { Item: `Soft Cost (${softPct}%)`, Value: Math.round(softCost) },
      ...(gfa > 0
        ? [
            { Item: "GFA (SF)", Value: gfa },
            {
              Item: "Cost per SF",
              Value: Number((computedTotal / gfa).toFixed(2)),
            },
          ]
        : []),
    ];
    const overviewSheet = XLSX.utils.json_to_sheet(overviewData);
    XLSX.utils.book_append_sheet(wb, overviewSheet, "Summary");

    const softCostSheet = XLSX.utils.json_to_sheet(
      buildSoftCostSheetRows(softCost, DEFAULT_SOFT_COST_BREAKDOWN)
    );
    XLSX.utils.book_append_sheet(wb, softCostSheet, "Soft Cost");

    // CSI Sheet (scaled by scenario)
    const csiData = appendCsiHardCostTotalRow(
      (project.csi_divisions || []).map((d) => ({
        "CSI Code": d.csi_code,
        "CSI Description": d.csi_description,
        Description: d.description,
        Qty: d.qty,
        Unit: d.unit,
        Rate: d.rate,
        Amount: Math.round(d.amount * scaleFactor),
        "$/SF": Number(((d.per_sf || 0) * scaleFactor).toFixed(2)),
        Confidence: d.confidence,
      })),
      hardCost,
      gfa,
      "final"
    );
    const csiSheet = XLSX.utils.json_to_sheet(csiData);
    XLSX.utils.book_append_sheet(wb, csiSheet, "CSI Divisions");

    // Cost category summary
    if (costSummary.length > 0) {
      const summaryData = costSummary.map((r) => ({
        Category: r.category,
        "HQ Building": Math.round(r.hq_building * scaleFactor),
        "AASC Building": Math.round(r.aasc_building * scaleFactor),
        "Campus Total": Math.round(r.total * scaleFactor),
        "$/SF": Number(((r.per_sf || 0) * scaleFactor).toFixed(2)),
        Confidence: r.confidence,
      }));
      const summarySheet = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, summarySheet, "Cost Summary");
    }

    XLSX.writeFile(wb, `${project.title || "estimate"}_boq.xlsx`);
  };

  const selectedRowData = selectedRow !== null ? costSummary[selectedRow] : null;

  return (
    <div className="flex h-full bg-[#0d0d0f]">
      {/* Main content area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {/* Generate final if not done */}
        {!hasFinal && (
          <div className="flex flex-col items-center justify-center py-12">
            <p className="text-sm text-gray-500 mb-4">
              Ready to generate the final cost report based on confirmed estimates.
            </p>
            <button
              onClick={onRunFinal}
              disabled={isEstimating}
              className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isEstimating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating Final Report...
                </>
              ) : (
                "Generate Final Report"
              )}
            </button>
          </div>
        )}

        {hasFinal && (
          <>
            {/* Section 1: Three cost cards — Hard + Soft = Final */}
            <div className="flex items-center gap-3">
              {/* Hard Cost */}
              <div className="flex-1 rounded-2xl p-5 text-center bg-lime-600">
                <div className="text-[10px] font-bold uppercase tracking-widest text-lime-100 mb-2">
                  HARD COST
                </div>
                <div className="text-3xl font-black text-white">
                  {formatCurrency(hardCost)}
                </div>
              </div>

              <span className="text-2xl font-bold text-gray-500">+</span>

              {/* Soft Cost */}
              <div className="flex-1 rounded-2xl p-5 text-center bg-teal-600">
                <div className="text-[10px] font-bold uppercase tracking-widest text-teal-100 mb-2">
                  SOFT COST
                </div>
                <div className="text-3xl font-black text-white">
                  {formatCurrency(softCost)}
                </div>
              </div>

              <span className="text-2xl font-bold text-gray-500">=</span>

              {/* Final Total */}
              <div className="flex-1 rounded-2xl p-5 text-center bg-orange-500">
                <div className="text-[10px] font-bold uppercase tracking-widest text-orange-100 mb-2">
                  FINAL
                </div>
                <div className="text-3xl font-black text-white">
                  {formatCurrency(computedTotal)}
                </div>
              </div>
            </div>

            {/* Section 2: Hard/Soft ratio slider */}
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
                    handleRatioChange(pct);
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
                <div className="absolute inset-y-0 left-0 right-0 flex rounded-sm overflow-hidden my-0.5">
                  <div className="bg-amber-500" style={{ width: `${localHard}%` }} />
                  <div className="bg-gray-600" style={{ width: `${100 - localHard}%` }} />
                </div>
                <div
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-5 rounded-sm bg-white shadow-md border border-gray-300 group-hover:scale-110 transition-transform"
                  style={{ left: `${localHard}%` }}
                />
              </div>
            </div>

            {/* Section 3: Campus Cost Summary */}
            {costSummary.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-black text-white">
                  SECTION 3: CAMPUS COST SUMMARY
                </h3>

                <div className="overflow-x-auto rounded-lg border border-gray-800">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-[#1e293b] text-gray-300 text-left">
                        <th className="px-3 py-3 font-semibold">Cost Category</th>
                        <th className="px-3 py-3 font-semibold text-right">
                          HQ Building
                        </th>
                        <th className="px-3 py-3 font-semibold text-right">
                          AASC Building
                        </th>
                        <th className="px-3 py-3 font-semibold text-right">
                          Campus Total
                        </th>
                        <th className="px-3 py-3 font-semibold text-right">
                          $/SF
                        </th>
                        <th className="px-3 py-3 font-semibold text-center w-16">
                          Confidence
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {costSummary.map((row, i) => (
                        <tr
                          key={i}
                          onClick={() => setSelectedRow(selectedRow === i ? null : i)}
                          className="border-t border-gray-800 hover:bg-gray-800/40 transition-colors cursor-pointer"
                        >
                          <td className="px-3 py-2.5 font-semibold text-gray-200">
                            {row.category}
                          </td>
                          {/* Editable: HQ Building */}
                          <td className="px-3 py-2.5 text-right text-gray-300">
                            {editingCell?.row === i &&
                            editingCell.field === "hq_building" ? (
                              <input
                                autoFocus
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleSaveEdit();
                                  if (e.key === "Escape") setEditingCell(null);
                                }}
                                onBlur={handleSaveEdit}
                                onClick={(e) => e.stopPropagation()}
                                className="w-24 px-1 py-0.5 text-right rounded border border-primary bg-gray-900 outline-none text-xs text-white"
                              />
                            ) : (
                              <span
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStartEdit(i, "hq_building", Math.round(row.hq_building * scaleFactor));
                                }}
                                className="cursor-pointer hover:text-primary transition-colors"
                              >
                                {formatCurrency(row.hq_building * scaleFactor)}
                              </span>
                            )}
                          </td>
                          {/* Editable: AASC Building */}
                          <td className="px-3 py-2.5 text-right text-gray-300">
                            {editingCell?.row === i &&
                            editingCell.field === "aasc_building" ? (
                              <input
                                autoFocus
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleSaveEdit();
                                  if (e.key === "Escape") setEditingCell(null);
                                }}
                                onBlur={handleSaveEdit}
                                onClick={(e) => e.stopPropagation()}
                                className="w-24 px-1 py-0.5 text-right rounded border border-primary bg-gray-900 outline-none text-xs text-white"
                              />
                            ) : (
                              <span
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStartEdit(
                                    i,
                                    "aasc_building",
                                    Math.round(row.aasc_building * scaleFactor)
                                  );
                                }}
                                className="cursor-pointer hover:text-primary transition-colors"
                              >
                                {formatCurrency(row.aasc_building * scaleFactor)}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right font-semibold text-white">
                            {formatCurrency(row.total * scaleFactor)}
                          </td>
                          <td className="px-3 py-2.5 text-right text-gray-400">
                            ${((row.per_sf || 0) * scaleFactor).toFixed(2)}
                          </td>
                          {/* Confidence dot */}
                          <td className="px-3 py-2.5 text-center">
                            <div
                              className={`w-3 h-3 rounded-full mx-auto ${
                                row.confidence === "high"
                                  ? "bg-green-500"
                                  : "bg-red-500 animate-pulse"
                              }`}
                            />
                          </td>
                        </tr>
                      ))}
                      {/* Total row */}
                      {totalRow && (
                        <tr className="border-t-2 border-gray-700 bg-[#1e293b]/50">
                          <td className="px-3 py-2.5 font-bold text-gray-300">
                            TOTAL
                          </td>
                          <td className="px-3 py-2.5 text-right font-bold text-gray-300">
                            {formatCurrency(totalRow.hq)}
                          </td>
                          <td className="px-3 py-2.5 text-right font-bold text-gray-300">
                            {formatCurrency(totalRow.aasc)}
                          </td>
                          <td className="px-3 py-2.5 text-right font-black text-white">
                            {formatCurrency(totalRow.total)}
                          </td>
                          <td className="px-3 py-2.5 text-right text-gray-400">
                            {gfa > 0
                              ? `$${(totalRow.total / gfa).toFixed(2)}`
                              : "-"}
                          </td>
                          <td />
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Right panel */}
      {hasFinal && (
        <div className="w-[340px] shrink-0 overflow-y-auto p-5 border-l border-gray-800 bg-[#0c0c0e]">
          {/* Back button */}
          {onNavigateBack && (
            <button
              onClick={onNavigateBack}
              className="mb-5 text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1 uppercase tracking-wide font-semibold"
            >
              <ArrowLeft className="w-3 h-3" /> Back to Previous Stage
            </button>
          )}

          {/* Row detail or default content */}
          {selectedRowData ? (
            <div className="space-y-4">
              <button
                onClick={() => setSelectedRow(null)}
                className="mb-2 text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1"
              >
                <X className="w-3 h-3" /> Back to overview
              </button>
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">
                {selectedRowData.category}
              </h3>
              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-lg bg-blue-950/30 border border-blue-900/40">
                  <div className="font-semibold text-blue-400 mb-1">Source</div>
                  <div className="text-blue-200">
                    BOD
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-purple-950/30 border border-purple-900/40">
                  <div className="font-semibold text-purple-400 mb-1">Benchmark</div>
                  <div className="text-purple-200">
                    HQ: {formatCurrency(selectedRowData.hq_building)} | AASC: {formatCurrency(selectedRowData.aasc_building)}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-gray-800/50 border border-gray-700">
                  <div className="flex items-center gap-2 text-gray-500">
                    <Pencil className="w-3 h-3" />
                    <span>
                      Click any number in the table to edit. Changes update the
                      total automatically.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Edit instructions */}
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-gray-800/50 border border-gray-700 text-xs">
                  <div className="flex items-center gap-2 text-gray-400">
                    <Pencil className="w-3 h-3" />
                    <span>
                      Click any number in the table to edit. Changes update
                      the total automatically.
                    </span>
                  </div>
                </div>
              </div>

              {/* All checks passed */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span className="text-xs font-semibold text-emerald-400">
                    All checks passed. Ready to download.
                  </span>
                </div>
              </div>

              {/* Download buttons */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">
                  DOWNLOAD
                </h3>
                <button
                  onClick={handleExportPDF}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-red-600 text-white rounded-xl font-semibold text-sm hover:bg-red-700 transition-colors"
                >
                  <FileText className="w-4 h-4" />
                  PDF Report
                </button>
                <button
                  onClick={handleExportExcel}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 text-white rounded-xl font-semibold text-sm hover:bg-emerald-700 transition-colors"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  Excel BOQ
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
