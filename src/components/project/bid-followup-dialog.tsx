"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Trophy, XCircle, BookOpen, Clock } from "lucide-react";
import type { Project } from "@/lib/types";

interface BidFollowupDialogProps {
  open: boolean;
  project: Project;
  onClose: () => void;
  onUpdate: (updates: Partial<Project>) => Promise<void>;
}

export function BidFollowupDialog({ open, project, onClose, onUpdate }: BidFollowupDialogProps) {
  const router = useRouter();
  const [step, setStep] = useState<"result" | "knowledge">("result");
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const handleWon = async () => {
    await onUpdate({ bid_result: "won" });
    setStep("knowledge");
  };

  const handleLost = async () => {
    await onUpdate({ bid_result: "lost", bid_followup_dismissed: true });
    onClose();
  };

  const handleAddToKB = async () => {
    setSaving(true);
    try {
      // Determine project type from confirmed_info if available
      const projectType = project.confirmed_info?.project_type?.value === "public" ? "public" : "private";

      const res = await fetch("/api/knowledge-base", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: project.title || "Untitled Project",
          project_type: projectType,
          start_date: project.construction_start_date || null,
          end_date: null,
          prevailing_wage: false,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        await onUpdate({ bid_followup_dismissed: true });
        onClose();
        router.push(`/knowledge/${data.project.id}`);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSkipKB = async () => {
    await onUpdate({ bid_followup_dismissed: true });
    onClose();
  };

  const handleRemindLater = () => {
    // Just close without saving bid_result — popup will show again next visit
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative bg-[#18181b] rounded-2xl shadow-xl w-full max-w-md p-6 mx-4 border border-gray-800">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-100">
            {step === "result" ? "Bid Follow-up" : "Knowledge Base"}
          </h2>
          <button
            onClick={handleRemindLater}
            className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {step === "result" ? (
          <div>
            <p className="text-sm text-gray-400 mb-2">
              The bid award date for <span className="text-gray-200 font-medium">{project.title || "this project"}</span> has passed.
            </p>
            <p className="text-sm text-gray-300 mb-6">
              Did you win this bid?
            </p>

            <div className="flex gap-3 mb-4">
              <button
                onClick={handleWon}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-green-600/20 border border-green-700 text-green-400 font-semibold text-sm hover:bg-green-600/30 transition-colors"
              >
                <Trophy className="w-4 h-4" />
                Won
              </button>
              <button
                onClick={handleLost}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-red-600/10 border border-red-800 text-red-400 font-semibold text-sm hover:bg-red-600/20 transition-colors"
              >
                <XCircle className="w-4 h-4" />
                Lost
              </button>
            </div>

            <button
              onClick={handleRemindLater}
              className="w-full flex items-center justify-center gap-2 py-2.5 text-sm text-gray-500 hover:text-gray-400 transition-colors"
            >
              <Clock className="w-3.5 h-3.5" />
              Remind me later
            </button>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-2 mb-2 text-green-400">
              <Trophy className="w-4 h-4" />
              <span className="text-sm font-medium">Congratulations!</span>
            </div>
            <p className="text-sm text-gray-400 mb-6">
              Would you like to add this project to your Knowledge Base? This helps improve future estimates.
            </p>

            <div className="flex gap-3">
              <button
                onClick={handleSkipKB}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:text-gray-300 border border-gray-700 hover:bg-gray-800 transition-colors"
              >
                Not now
              </button>
              <button
                onClick={handleAddToKB}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                <BookOpen className="w-4 h-4" />
                {saving ? "Creating..." : "Add to Knowledge Base"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
