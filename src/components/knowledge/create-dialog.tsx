"use client";

import { useRef, useState } from "react";
import { CalendarDays, X } from "lucide-react";

function DateInput({
  value,
  onChange,
  placeholder = "Select date",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const display = value
    ? new Date(value + "T00:00:00").toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : placeholder;

  return (
    <div
      className="relative w-full flex items-center px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#09090b] cursor-pointer focus-within:ring-2 focus-within:ring-primary/30"
      onClick={() => ref.current?.showPicker()}
    >
      <span className={`flex-1 text-sm select-none ${value ? "text-gray-900 dark:text-gray-100" : "text-gray-400"}`}>
        {display}
      </span>
      <CalendarDays className="w-4 h-4 text-gray-400 flex-shrink-0" />
      <input
        ref={ref}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
        tabIndex={-1}
      />
    </div>
  );
}

interface CreateDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function CreateKnowledgeDialog({ open, onClose, onCreated }: CreateDialogProps) {
  const [name, setName] = useState("");
  const [projectType, setProjectType] = useState<"public" | "private">("private");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [prevailingWage, setPrevailingWage] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    try {
      const res = await fetch("/api/knowledge-base", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          project_type: projectType,
          start_date: startDate || null,
          end_date: endDate || null,
          prevailing_wage: prevailingWage,
        }),
      });
      if (res.ok) {
        setName("");
        setProjectType("private");
        setStartDate("");
        setEndDate("");
        setPrevailingWage(false);
        onCreated();
        onClose();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-[#18181b] rounded-2xl shadow-xl w-full max-w-md p-6 mx-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            New Knowledge Project
          </h2>
          <button
            onClick={onClose}
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
                onClick={() => setProjectType("public")}
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

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Start Date
              </label>
              <DateInput value={startDate} onChange={setStartDate} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                End Date
              </label>
              <DateInput value={endDate} onChange={setEndDate} />
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
            disabled={!name.trim() || saving}
            className="w-full py-2.5 bg-primary text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Creating..." : "Create Project"}
          </button>
        </form>
      </div>
    </div>
  );
}
