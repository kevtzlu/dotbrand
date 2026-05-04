"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Trophy, XCircle, BookOpen, Clock, File } from "lucide-react";
import type { Project, UploadedFile } from "@/lib/types";
import { KNOWLEDGE_DOC_SLOTS } from "@/lib/types";

interface BidFollowupDialogProps {
  open: boolean;
  project: Project;
  onClose: () => void;
  onUpdate: (updates: Partial<Project>) => Promise<void>;
}

const ALL_SLOT_OPTIONS = [
  ...KNOWLEDGE_DOC_SLOTS.map((s) => ({ value: s.key, label: s.label })),
  { value: "doc_other_files", label: "Other Files" },
];

function guessSlot(file: UploadedFile): string {
  const name = file.name.toLowerCase();
  if (file.type.startsWith("image/")) return "doc_google_maps";
  if (name.includes("draw") || name.includes("plan") || name.includes("blueprint") || name.includes("arch")) return "doc_drawings";
  if (name.includes("bod") || name.includes("rfp") || name.includes("bid") || name.includes("scope") || name.includes("spec")) return "doc_bod";
  if (name.includes("final") || name.includes("actual") || name.includes("as-built")) return "doc_final_est";
  if (name.includes("initial") || name.includes("estimate") || name.includes("est") || file.type.includes("spreadsheet") || name.endsWith(".xlsx")) return "doc_initial_est";
  return "doc_other_files";
}

export function BidFollowupDialog({ open, project, onClose, onUpdate }: BidFollowupDialogProps) {
  const router = useRouter();
  const [step, setStep] = useState<"result" | "knowledge">("result");
  const [saving, setSaving] = useState(false);
  const [slotAssignments, setSlotAssignments] = useState<Record<string, string>>(() => {
    const assignments: Record<string, string> = {};
    for (const f of project.uploaded_files || []) {
      assignments[f.url] = guessSlot(f);
    }
    return assignments;
  });

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
      const projectType = project.confirmed_info?.project_type?.value === "public" ? "public" : "private";

      // Group uploaded files by their assigned slot
      const slotFiles: Record<string, UploadedFile[]> = {};
      for (const f of project.uploaded_files || []) {
        const slot = slotAssignments[f.url] || "doc_other_files";
        if (!slotFiles[slot]) slotFiles[slot] = [];
        slotFiles[slot].push(f);
      }

      const res = await fetch("/api/knowledge-base", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: project.title || "Untitled Project",
          project_type: projectType,
          start_date: project.construction_start_date || null,
          end_date: null,
          prevailing_wage: false,
          ...slotFiles,
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
            <p className="text-sm text-gray-400 mb-4">
              Would you like to add this project to your Knowledge Base? This helps improve future estimates.
            </p>

            {/* Uploaded files slot assignment */}
            {(project.uploaded_files || []).length > 0 && (
              <div className="mb-5">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Uploaded Files
                </p>
                <div className="space-y-2">
                  {project.uploaded_files.map((f) => (
                    <div key={f.url} className="flex items-center gap-2 rounded-lg bg-gray-800/60 border border-gray-700 px-3 py-2">
                      <File className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span className="text-xs text-gray-300 flex-1 truncate min-w-0" title={f.name}>
                        {f.name}
                      </span>
                      <select
                        value={slotAssignments[f.url] || "doc_other_files"}
                        onChange={(e) =>
                          setSlotAssignments((prev) => ({ ...prev, [f.url]: e.target.value }))
                        }
                        className="shrink-0 text-[11px] bg-gray-700 border border-gray-600 rounded px-2 py-1 text-gray-200 focus:outline-none focus:border-blue-500"
                      >
                        {ALL_SLOT_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
