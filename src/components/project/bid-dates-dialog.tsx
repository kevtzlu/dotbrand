"use client";

import { useState, useRef, useEffect } from "react";
import { X, CalendarDays } from "lucide-react";

interface BidDatesDialogProps {
  open: boolean;
  initialBidDate?: string;
  initialConstructionDate?: string;
  onClose: () => void;
  onSave: (dates: { bid_award_date: string; construction_start_date: string }) => void;
}

/** Format YYYY-MM-DD to English display like "Mar 30, 2026" */
function formatDateEN(dateStr: string): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function DateInput({
  value,
  onChange,
  placeholder,
  required,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  required?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const openPicker = () => {
    inputRef.current?.showPicker();
  };

  return (
    <div className="relative">
      {/* Native date input — visually hidden but kept in DOM for form validation & picker */}
      <input
        ref={inputRef}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="sr-only"
        tabIndex={-1}
      />
      {/* Visible styled display — entire area is clickable */}
      <div
        onClick={openPicker}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") openPicker(); }}
        className="flex items-center justify-between w-full px-3 py-2 rounded-xl border border-gray-700 bg-[#09090b] text-sm cursor-pointer hover:border-gray-600 focus:ring-2 focus:ring-blue-500/30 transition-colors"
      >
        <span className={value ? "text-gray-100" : "text-gray-500"}>
          {value ? formatDateEN(value) : placeholder}
        </span>
        <CalendarDays className="w-4 h-4 text-gray-500 shrink-0" />
      </div>
    </div>
  );
}

export function BidDatesDialog({ open, initialBidDate = "", initialConstructionDate = "", onClose, onSave }: BidDatesDialogProps) {
  const [bidAwardDate, setBidAwardDate] = useState(initialBidDate);
  const [constructionStartDate, setConstructionStartDate] = useState(initialConstructionDate);

  // Sync state when dialog opens with new initial values
  useEffect(() => {
    if (open) {
      setBidAwardDate(initialBidDate);
      setConstructionStartDate(initialConstructionDate);
    }
  }, [open, initialBidDate, initialConstructionDate]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bidAwardDate || !constructionStartDate) return;
    onSave({
      bid_award_date: bidAwardDate,
      construction_start_date: constructionStartDate,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-[#18181b] rounded-2xl shadow-xl w-full max-w-md p-6 mx-4 border border-gray-800">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-bold text-gray-100">Project Dates</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm text-gray-400 mb-5">
          Set key dates for this project so we can follow up after the bid is awarded.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Bid Award Date *
            </label>
            <DateInput
              value={bidAwardDate}
              onChange={setBidAwardDate}
              placeholder="Select date"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              When will the bid be awarded?
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Construction Start Date *
            </label>
            <DateInput
              value={constructionStartDate}
              onChange={setConstructionStartDate}
              placeholder="Select date"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Expected construction start date
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:text-gray-300 border border-gray-700 hover:bg-gray-800 transition-colors"
            >
              Skip
            </button>
            <button
              type="submit"
              disabled={!bidAwardDate || !constructionStartDate}
              className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save Dates
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
