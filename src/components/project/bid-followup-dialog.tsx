"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Trophy, XCircle, BookOpen, Clock, File, AlertTriangle } from "lucide-react";
import type { Project, UploadedFile } from "@/lib/types";
import { KNOWLEDGE_DOC_SLOTS } from "@/lib/types";

interface BidFollowupDialogProps {
  open: boolean;
  project: Project;
  onClose: () => void;
  onUpdate: (updates: Partial<Project>) => Promise<void>;
  /** If provided, skip the result step and start directly at the knowledge/add-to-KB step */
  kbOnly?: boolean;
}

type Step = "result" | "knowledge" | "loss-reason" | "loss-knowledge";

const ALL_SLOT_OPTIONS = [
  ...KNOWLEDGE_DOC_SLOTS.map((s) => ({ value: s.key, label: s.label })),
  { value: "doc_other_files", label: "Other Files" },
];

const LOSS_REASON_PRESETS = [
  "Price too high / underbid by competitor",
  "Scope changed after bid submission",
  "Owner selected preferred contractor",
  "Project was cancelled or deferred",
  "Bid submitted late",
  "Technical proposal did not meet requirements",
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

function FileSlotAssignment({
  files,
  slotAssignments,
  onChange,
}: {
  files: UploadedFile[];
  slotAssignments: Record<string, string>;
  onChange: (url: string, slot: string) => void;
}) {
  if (files.length === 0) return null;
  return (
    <div className="mb-5">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
        Assign Uploaded Files
      </p>
      <div className="space-y-2">
        {files.map((f) => (
          <div key={f.url} className="flex items-center gap-2 rounded-lg bg-gray-800/60 border border-gray-700 px-3 py-2">
            <File className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <span className="text-xs text-gray-300 flex-1 truncate min-w-0" title={f.name}>
              {f.name}
            </span>
            <select
              value={slotAssignments[f.url] || "doc_other_files"}
              onChange={(e) => onChange(f.url, e.target.value)}
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
  );
}

export function BidFollowupDialog({ open, project, onClose, onUpdate, kbOnly = false }: BidFollowupDialogProps) {
  const router = useRouter();

  const initialStep: Step = kbOnly
    ? project.bid_result === "lost" ? "loss-knowledge" : "knowledge"
    : "result";

  const [step, setStep] = useState<Step>(initialStep);
  const [saving, setSaving] = useState(false);
  const [lossReason, setLossReason] = useState(project.loss_reason || "");
  const [slotAssignments, setSlotAssignments] = useState<Record<string, string>>(() => {
    const assignments: Record<string, string> = {};
    for (const f of project.uploaded_files || []) {
      assignments[f.url] = guessSlot(f);
    }
    return assignments;
  });

  if (!open) return null;

  const uploadedFiles = project.uploaded_files || [];

  const buildSlotFiles = () => {
    const slotFiles: Record<string, UploadedFile[]> = {};
    for (const f of uploadedFiles) {
      const slot = slotAssignments[f.url] || "doc_other_files";
      if (!slotFiles[slot]) slotFiles[slot] = [];
      slotFiles[slot].push(f);
    }
    return slotFiles;
  };

  const createKnowledgeEntry = async (bidResult: "won" | "lost") => {
    const projectType = project.confirmed_info?.project_type?.value === "public" ? "public" : "private";
    const slotFiles = buildSlotFiles();
    const res = await fetch("/api/knowledge-base", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: project.title || "Untitled Project",
        project_type: projectType,
        contract_type: project.contract_type,
        start_date: project.construction_start_date || null,
        end_date: null,
        prevailing_wage: false,
        ...slotFiles,
      }),
    });
    if (!res.ok) throw new Error("Failed to create knowledge base entry");
    const data = await res.json();
    const updates: Partial<Project> = {
      bid_result: bidResult,
      bid_followup_dismissed: true,
      kb_project_id: data.project.id,
    };
    if (bidResult === "lost" && lossReason.trim()) {
      updates.loss_reason = lossReason.trim();
    }
    await onUpdate(updates);
    return data.project.id as string;
  };

  // ── Won handlers ──

  const handleWon = () => setStep("knowledge");

  const handleAddToKB = async () => {
    setSaving(true);
    try {
      const kbId = await createKnowledgeEntry("won");
      onClose();
      router.push(`/knowledge/${kbId}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSkipKB = async () => {
    await onUpdate({ bid_result: "won", bid_followup_dismissed: true });
    onClose();
  };

  // ── Lost handlers ──

  const handleLost = () => setStep("loss-reason");

  const handleLossReasonSubmit = () => setStep("loss-knowledge");

  const handleLossSkipKB = async () => {
    const updates: Partial<Project> = {
      bid_result: "lost",
      bid_followup_dismissed: true,
    };
    if (lossReason.trim()) updates.loss_reason = lossReason.trim();
    await onUpdate(updates);
    onClose();
  };

  const handleLossAddToKB = async () => {
    setSaving(true);
    try {
      const kbId = await createKnowledgeEntry("lost");
      onClose();
      router.push(`/knowledge/${kbId}`);
    } finally {
      setSaving(false);
    }
  };

  const handleRemindLater = () => onClose();

  const slotOnChange = (url: string, slot: string) =>
    setSlotAssignments((prev) => ({ ...prev, [url]: slot }));

  // ── Title per step ──
  const TITLES: Record<Step, string> = {
    result: "Bid Follow-up",
    knowledge: "Add to Knowledge Base",
    "loss-reason": "Loss Reason",
    "loss-knowledge": "Add to Knowledge Base",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative bg-[#18181b] rounded-2xl shadow-xl w-full max-w-md p-6 mx-4 border border-gray-800 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-100">{TITLES[step]}</h2>
          <button
            onClick={handleRemindLater}
            className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Step: result ── */}
        {step === "result" && (
          <div>
            <p className="text-sm text-gray-400 mb-2">
              The bid award date for{" "}
              <span className="text-gray-200 font-medium">
                {project.title || "this project"}
              </span>{" "}
              has passed.
            </p>
            <p className="text-sm text-gray-300 mb-6">Did you win this bid?</p>

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
        )}

        {/* ── Step: loss-reason ── */}
        {step === "loss-reason" && (
          <div>
            <div className="flex items-center gap-2 mb-2 text-red-400">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm font-medium">What was the reason for losing?</span>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Recording loss reasons helps improve future bidding strategy.
            </p>

            {/* Quick-select presets */}
            <div className="flex flex-wrap gap-2 mb-3">
              {LOSS_REASON_PRESETS.map((preset) => (
                <button
                  key={preset}
                  onClick={() => setLossReason(preset)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    lossReason === preset
                      ? "bg-red-600/20 border-red-700 text-red-300"
                      : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-300"
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>

            {/* Custom text area */}
            <textarea
              value={lossReason}
              onChange={(e) => setLossReason(e.target.value)}
              placeholder="Or describe the reason in your own words..."
              rows={3}
              className="w-full rounded-xl bg-gray-800 border border-gray-700 text-sm text-gray-200 placeholder-gray-600 px-3 py-2.5 resize-none focus:outline-none focus:border-blue-500 mb-4"
            />

            <div className="flex gap-3">
              <button
                onClick={() => setStep("result")}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:text-gray-300 border border-gray-700 hover:bg-gray-800 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleLossReasonSubmit}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* ── Step: loss-knowledge ── */}
        {step === "loss-knowledge" && (
          <div>
            <div className="flex items-center gap-2 mb-2 text-red-400">
              <XCircle className="w-4 h-4" />
              <span className="text-sm font-medium">Bid recorded as lost</span>
            </div>
            {lossReason && (
              <p className="text-xs text-gray-500 mb-3 italic">
                Reason: {lossReason}
              </p>
            )}
            <p className="text-sm text-gray-400 mb-4">
              Would you like to add this project to your Knowledge Base? Even lost bids are valuable references for future estimates.
            </p>

            <FileSlotAssignment
              files={uploadedFiles}
              slotAssignments={slotAssignments}
              onChange={slotOnChange}
            />

            <div className="flex gap-3">
              <button
                onClick={handleLossSkipKB}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:text-gray-300 border border-gray-700 hover:bg-gray-800 transition-colors"
              >
                Not now
              </button>
              <button
                onClick={handleLossAddToKB}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                <BookOpen className="w-4 h-4" />
                {saving ? "Creating..." : "Add to Knowledge Base"}
              </button>
            </div>
          </div>
        )}

        {/* ── Step: knowledge (won) ── */}
        {step === "knowledge" && (
          <div>
            <div className="flex items-center gap-2 mb-2 text-green-400">
              <Trophy className="w-4 h-4" />
              <span className="text-sm font-medium">Congratulations!</span>
            </div>
            <p className="text-sm text-gray-400 mb-4">
              Would you like to add this project to your Knowledge Base? This helps improve future estimates.
            </p>

            <FileSlotAssignment
              files={uploadedFiles}
              slotAssignments={slotAssignments}
              onChange={slotOnChange}
            />

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
