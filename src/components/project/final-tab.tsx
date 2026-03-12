"use client";

import { useState, useMemo } from "react";
import {
  Download,
  FileText,
  FileSpreadsheet,
  ChevronDown,
  ChevronUp,
  Pencil,
  Check,
  X,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import type { Project, CostSummaryRow } from "@/lib/types";
import jsPDF from "jspdf";
import * as XLSX from "xlsx";

function formatCurrency(val: number): string {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}K`;
  return `$${val.toFixed(0)}`;
}

interface FinalTabProps {
  project: Project;
  onUpdate: (updates: Partial<Project>) => Promise<void>;
  onRunFinal: () => Promise<void>;
  isEstimating: boolean;
}

export function FinalTab({
  project,
  onUpdate,
  onRunFinal,
  isEstimating,
}: FinalTabProps) {
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [editingCell, setEditingCell] = useState<{
    row: number;
    field: string;
  } | null>(null);
  const [editValue, setEditValue] = useState("");

  const hasFinal = project.final_total_cost != null;
  const ratio = project.hard_soft_ratio || { hard_pct: 85, soft_pct: 15 };

  // Calculate costs from CSI divisions if final not yet computed
  const computedTotal = useMemo(() => {
    if (hasFinal) return project.final_total_cost!;
    return (project.csi_divisions || []).reduce(
      (s, d) => s + (d.amount || 0),
      0
    );
  }, [hasFinal, project.final_total_cost, project.csi_divisions]);

  const hardCost = hasFinal
    ? project.final_hard_cost!
    : computedTotal * (ratio.hard_pct / 100);
  const softCost = hasFinal
    ? project.final_soft_cost!
    : computedTotal * (ratio.soft_pct / 100);

  const handleRatioChange = (hard: number) => {
    const clamped = Math.max(50, Math.min(95, hard));
    const newRatio = { hard_pct: clamped, soft_pct: 100 - clamped };
    const newHard = computedTotal * (clamped / 100);
    const newSoft = computedTotal * ((100 - clamped) / 100);
    onUpdate({
      hard_soft_ratio: newRatio,
      final_hard_cost: newHard,
      final_soft_cost: newSoft,
      final_total_cost: computedTotal,
    });
  };

  const costSummary = project.final_cost_summary || [];

  const handleStartEdit = (row: number, field: string, currentValue: any) => {
    setEditingCell({ row, field });
    setEditValue(String(currentValue ?? ""));
  };

  const handleSaveEdit = async () => {
    if (!editingCell) return;
    const { row, field } = editingCell;
    const numVal = parseFloat(editValue) || 0;

    const updated = costSummary.map((r, i) => {
      if (i !== row) return r;
      const newRow = { ...r, [field]: numVal };
      if (field === "hq_building" || field === "aasc_building") {
        newRow.total = (newRow.hq_building || 0) + (newRow.aasc_building || 0);
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

    // CSI Sheet
    const csiData = (project.csi_divisions || []).map((d) => ({
      "CSI Code": d.csi_code,
      "CSI Description": d.csi_description,
      Description: d.description,
      Qty: d.qty,
      Unit: d.unit,
      Rate: d.rate,
      Amount: d.amount,
      "$/SF": d.per_sf,
      Confidence: d.confidence,
    }));
    const csiSheet = XLSX.utils.json_to_sheet(csiData);
    XLSX.utils.book_append_sheet(wb, csiSheet, "CSI Divisions");

    // Summary sheet
    if (costSummary.length > 0) {
      const summaryData = costSummary.map((r) => ({
        Category: r.category,
        "HQ Building": r.hq_building,
        "AASC Building": r.aasc_building,
        Total: r.total,
        "$/SF": r.per_sf,
        Confidence: r.confidence,
      }));
      const summarySheet = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, summarySheet, "Cost Summary");
    }

    XLSX.writeFile(wb, `${project.title || "estimate"}_boq.xlsx`);
  };

  return (
    <div className="h-full overflow-y-auto p-6 space-y-8">
      {/* Generate final if not done */}
      {!hasFinal && (
        <div className="flex flex-col items-center justify-center py-8">
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

      {/* Section 1: Three cost cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-2xl p-5 text-center bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40">
          <div className="text-[10px] font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400 mb-2">
            Hard Cost
          </div>
          <div className="text-2xl font-black text-blue-700 dark:text-blue-300">
            {formatCurrency(hardCost)}
          </div>
        </div>
        <div className="rounded-2xl p-5 text-center bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40">
          <div className="text-[10px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400 mb-2">
            Soft Cost
          </div>
          <div className="text-2xl font-black text-amber-700 dark:text-amber-300">
            {formatCurrency(softCost)}
          </div>
        </div>
        <div className="rounded-2xl p-5 text-center bg-green-50/50 dark:bg-green-950/20 border border-green-200 dark:border-green-900/40 ring-4 ring-green-500/10">
          <div className="text-[10px] font-bold uppercase tracking-widest text-green-600 dark:text-green-400 mb-2">
            Total Cost
          </div>
          <div className="text-2xl font-black text-green-700 dark:text-green-300">
            {formatCurrency(computedTotal)}
          </div>
        </div>
      </div>

      {/* Section 2: Ratio slider */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold">Adjust Hard / Soft Ratio</h3>
        <div className="flex items-center gap-4">
          <span className="text-xs font-bold text-blue-600 dark:text-blue-400 w-20">
            HARD {ratio.hard_pct}%
          </span>
          <input
            type="range"
            min={50}
            max={95}
            value={ratio.hard_pct}
            onChange={(e) => handleRatioChange(parseInt(e.target.value))}
            className="flex-1 h-2 rounded-full appearance-none bg-gray-200 dark:bg-gray-700 accent-primary cursor-pointer"
          />
          <span className="text-xs font-bold text-amber-600 dark:text-amber-400 w-20 text-right">
            SOFT {ratio.soft_pct}%
          </span>
        </div>
      </div>

      {/* Section 3: Cost Summary table */}
      {costSummary.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold">Cost Summary</h3>
          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900 text-gray-500 text-left">
                  <th className="px-3 py-2.5 font-semibold">Category</th>
                  <th className="px-3 py-2.5 font-semibold text-right">
                    HQ Building
                  </th>
                  <th className="px-3 py-2.5 font-semibold text-right">
                    AASC Building
                  </th>
                  <th className="px-3 py-2.5 font-semibold text-right">
                    Total
                  </th>
                  <th className="px-3 py-2.5 font-semibold text-right">
                    $/SF
                  </th>
                  <th className="px-3 py-2.5 font-semibold text-center w-12">
                    Conf.
                  </th>
                  <th className="px-3 py-2.5 w-8" />
                </tr>
              </thead>
              <tbody>
                {costSummary.map((row, i) => (
                  <tr
                    key={i}
                    className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 cursor-pointer"
                    onClick={() =>
                      setExpandedRow(expandedRow === i ? null : i)
                    }
                  >
                    <td className="px-3 py-2 font-medium text-gray-800 dark:text-gray-200">
                      {row.category}
                    </td>
                    <td className="px-3 py-2 text-right">
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
                          className="w-24 px-1 py-0.5 text-right rounded border border-primary bg-white dark:bg-gray-800 outline-none text-xs"
                        />
                      ) : (
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartEdit(i, "hq_building", row.hq_building);
                          }}
                          className="hover:text-primary cursor-pointer"
                        >
                          {formatCurrency(row.hq_building)}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
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
                          className="w-24 px-1 py-0.5 text-right rounded border border-primary bg-white dark:bg-gray-800 outline-none text-xs"
                        />
                      ) : (
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartEdit(
                              i,
                              "aasc_building",
                              row.aasc_building
                            );
                          }}
                          className="hover:text-primary cursor-pointer"
                        >
                          {formatCurrency(row.aasc_building)}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold">
                      {formatCurrency(row.total)}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-500">
                      ${row.per_sf?.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <div
                        className={`w-3 h-3 rounded-full mx-auto ${
                          row.confidence === "high"
                            ? "bg-green-500"
                            : "bg-red-500"
                        }`}
                      />
                    </td>
                    <td className="px-2 py-2 text-gray-400">
                      {expandedRow === i ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Section 4: Download */}
      <div className="p-6 rounded-2xl bg-green-50/50 dark:bg-green-950/10 border border-green-200 dark:border-green-900/40 space-y-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-green-600" />
          <p className="text-sm font-semibold text-green-700 dark:text-green-400">
            All checks passed. Your estimate is ready to download.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleExportPDF}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-colors"
          >
            <FileText className="w-4 h-4" />
            Download PDF Report
          </button>
          <button
            onClick={handleExportExcel}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Download Excel BOQ
          </button>
        </div>
      </div>
    </div>
  );
}
