"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Hammer, ScrollText, X } from "lucide-react";
import { createPortal } from "react-dom";
import { DatePickerField } from "@/components/ui/date-picker-field";

interface NewProjectDialogProps {
  open: boolean;
  onClose: () => void;
}

export function NewProjectDialog({ open, onClose }: NewProjectDialogProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [name, setName] = useState("");
  const [projectType, setProjectType] = useState<"public" | "private">("private");
  const [contractType, setContractType] = useState<"design_build" | "design_bid_build" | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [prevailingWage, setPrevailingWage] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!open || !mounted) return null;

  const canContinue =
    name.trim().length > 0 &&
    (projectType === "public" || (projectType === "private" && contractType !== null));

  const handleClose = () => {
    onClose();
    setName("");
    setProjectType("private");
    setContractType(null);
    setStartDate("");
    setEndDate("");
    setPrevailingWage(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canContinue) return;

    const params = new URLSearchParams();
    params.set("scope", projectType);
    params.set("contract", projectType === "private" ? contractType! : "design_bid_build");
    if (name.trim()) params.set("title", name.trim());
    if (startDate) params.set("start_date", startDate);
    if (endDate) params.set("end_date", endDate);
    if (prevailingWage) params.set("prevailing_wage", "1");

    handleClose();
    router.push(`/upload?${params.toString()}`);
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />
      <div className="relative bg-white dark:bg-[#18181b] rounded-2xl shadow-xl w-full max-w-md p-6 mx-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            New Project
          </h2>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Project Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Project Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Downtown Office Renovation"
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#09090b] text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              required
            />
          </div>

          {/* Project Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Project Type *
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setProjectType("public"); setContractType(null); }}
                className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                  projectType === "public"
                    ? "bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-400"
                    : "border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800"
                }`}
              >
                Public Works
              </button>
              <button
                type="button"
                onClick={() => setProjectType("private")}
                className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                  projectType === "private"
                    ? "bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-400"
                    : "border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800"
                }`}
              >
                Private
              </button>
            </div>
          </div>

          {/* Contract Type (Private only) */}
          {projectType === "private" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Contract Type *
              </label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setContractType("design_build")}
                  className={`flex-1 flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium border transition-all ${
                    contractType === "design_build"
                      ? "bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-400"
                      : "border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800"
                  }`}
                >
                  <Hammer className="w-4 h-4 shrink-0" />
                  <span>Design-Build</span>
                </button>
                <div className="relative group flex-1">
                  <button
                    type="button"
                    aria-disabled="true"
                    tabIndex={-1}
                    className="w-full flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium border border-gray-200 text-gray-400 dark:border-gray-700 dark:text-gray-600 cursor-not-allowed"
                  >
                    <ScrollText className="w-4 h-4 shrink-0" />
                    <span>Design-Bid-Build</span>
                  </button>
                  <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-50 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs font-medium px-2 py-1 rounded-md whitespace-nowrap shadow-lg">
                      Coming Soon
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Start Date
              </label>
              <DatePickerField value={startDate} onChange={setStartDate} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                End Date
              </label>
              <DatePickerField value={endDate} onChange={setEndDate} />
            </div>
          </div>

          {/* Prevailing Wage */}
          <div className="flex items-center justify-between py-2">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Prevailing Wage
              </label>
              <p className="text-xs text-gray-400 mt-0.5">
                Does this project require prevailing wage rates?
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPrevailingWage(!prevailingWage)}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                prevailingWage ? "bg-primary" : "bg-gray-300 dark:bg-gray-600"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${
                  prevailingWage ? "translate-x-5" : ""
                }`}
              />
            </button>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={!canContinue}
            className="w-full py-2.5 bg-primary text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Continue to Upload
          </button>
        </form>
      </div>
    </div>,
    document.body
  );
}
