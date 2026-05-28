"use client";

import { useState, useEffect } from "react";
import { X, CalendarDays } from "lucide-react";
import { DatePickerField } from "@/components/ui/date-picker-field";

interface BidDatesDialogProps {
  open: boolean;
  initialBidDate?: string;
  initialConstructionDate?: string;
  onClose: () => void;
  onSave: (dates: { bid_award_date: string; construction_start_date: string }) => void;
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
            <DatePickerField
              variant="dark"
              value={bidAwardDate}
              onChange={setBidAwardDate}
              placeholder="Select date"
            />
            <p className="text-xs text-gray-500 mt-1">
              When will the bid be awarded?
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Construction Start Date *
            </label>
            <DatePickerField
              variant="dark"
              value={constructionStartDate}
              onChange={setConstructionStartDate}
              placeholder="Select date"
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
