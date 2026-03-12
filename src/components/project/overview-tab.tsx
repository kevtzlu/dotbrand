"use client";

import { useState, useRef, useEffect } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  Pencil,
  Check,
  X,
  Send,
  Loader2,
  ArrowRight,
  ArrowLeft,
  ChevronRight,
} from "lucide-react";
import type {
  Project,
  ConfirmedField,
  OverviewQA,
  OverviewQAOption,
} from "@/lib/types";

// ── Field label mapping ──

const FIELD_LABELS: Record<string, string> = {
  project_name: "Project",
  location: "Location",
  zip_code: "Zip Code",
  building_type: "Building Type",
  gfa_sqft: "GFA",
  floors: "Floors",
  occupancy_class: "Occupancy Class",
  target_date: "Duration",
  is_public: "Public Project",
  is_prevailing_wage: "Labor",
  construction_type: "Construction Type",
  project_subtype: "Project Subtype",
  delivery_method: "Delivery Method",
  structural_system: "Structural System",
  power_density: "Power Density",
  hvac_redundancy: "HVAC Redundancy",
  key_constraint: "Key Constraint",
  cleanroom_class: "Cleanroom Class",
  floor_loading: "Floor Loading",
  motivation: "Motivation",
};

// ── Props ──

interface OverviewTabProps {
  project: Project;
  onUpdate: (updates: Partial<Project>) => Promise<void>;
  onNavigateToDetail: () => void;
  onGenerateQuestions?: () => Promise<any>;
  runEstimate?: () => Promise<any>;
  isEstimating?: boolean;
}

// ── Section 1: Project Info Grid (top-left) ──

function ProjectInfoGrid({
  project,
  onUpdate,
}: {
  project: Project;
  onUpdate: (updates: Partial<Project>) => Promise<void>;
}) {
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const confirmedInfo = project.confirmed_info || {};
  const fields = Object.entries(confirmedInfo);

  const handleStartEdit = (key: string, field: ConfirmedField) => {
    setEditingField(key);
    setEditValue(String(field.value));
  };

  const handleSaveEdit = async (key: string) => {
    if (!editingField) return;
    const oldField = confirmedInfo[key];
    const newInfo = {
      ...confirmedInfo,
      [key]: {
        ...oldField,
        value: editValue,
        confidence: "high" as const,
        source: "user" as const,
        edited_at: new Date().toISOString(),
      },
    };
    const newHistory = [
      ...(project.edit_history || []),
      {
        field: key,
        old_value: String(oldField?.value ?? ""),
        new_value: editValue,
        timestamp: Date.now(),
        tab: "overview" as const,
      },
    ];
    await onUpdate({ confirmed_info: newInfo, edit_history: newHistory });
    setEditingField(null);
  };

  if (fields.length === 0) {
    return (
      <p className="text-sm text-gray-400 italic p-4">
        No information extracted yet. Upload documents to begin.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-x-6 gap-y-1 max-h-72 overflow-y-auto custom-scrollbar">
      {fields.map(([key, field]) => {
        const f = field as ConfirmedField;
        const label = FIELD_LABELS[key] || key.replace(/_/g, " ");
        const isLow = f.confidence === "low";
        const isEditing = editingField === key;

        return (
          <div
            key={key}
            className="group flex items-start gap-2 py-1.5 min-w-0"
          >
            <div className="shrink-0 mt-0.5">
              {isLow ? (
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <span className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">
                {label}:{" "}
              </span>
              {isEditing ? (
                <div className="flex flex-col gap-1 mt-0.5">
                  <textarea
                    autoFocus
                    rows={3}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSaveEdit(key);
                      }
                      if (e.key === "Escape") setEditingField(null);
                    }}
                    className="px-2 py-1 text-xs rounded border border-primary bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none w-64 resize-y"
                  />
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => handleSaveEdit(key)}
                      className="text-green-500 hover:text-green-600"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setEditingField(null)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  className={`text-xs font-medium text-gray-100 ${isLow ? "text-amber-300" : ""
                    }`}
                >
                  {String(f.value)}
                  {isLow && (
                    <span className="ml-1 text-[10px] text-amber-500 font-normal">
                      (需確認)
                    </span>
                  )}
                </div>
              )}
            </div>

            {!isEditing && (
              <button
                onClick={() => handleStartEdit(key, f)}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-white/10 text-gray-500 hover:text-gray-300 transition-all shrink-0"
              >
                <Pencil className="w-3 h-3" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Section 2: Rough Estimate (bottom-left) ──

function RoughEstimateDisplay({ project, isEstimating }: { project: Project; isEstimating?: boolean }) {
  const roughEst = project.rough_estimate;

  const midpoint = roughEst
    ? (roughEst.min + roughEst.max) / 2
    : null;

  const formatLarge = (val: number) => {
    if (val >= 1_000_000_000) return `$${(val / 1_000_000_000).toFixed(1)}B`;
    if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(0)}M`;
    if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}K`;
    return `$${val.toFixed(0)}`;
  };

  return (
    <div className="flex flex-col items-start">
      <div className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-1">
        Current Estimate
      </div>
      <div className="text-4xl font-black text-white leading-none">
        {midpoint ? formatLarge(midpoint) : "—"}
      </div>
      {roughEst && (
        <div className="text-[10px] text-gray-500 mt-1.5">
          {formatLarge(roughEst.min)} – {formatLarge(roughEst.max)}
          {roughEst.per_sf_min != null && (
            <span className="ml-2">
              ${roughEst.per_sf_min.toFixed(0)} – ${roughEst.per_sf_max.toFixed(0)}/SF
            </span>
          )}
        </div>
      )}
      {isEstimating && (
        <div className="flex items-center gap-2 mt-1.5">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
          <span className="text-[10px] text-gray-500">Recalculating...</span>
        </div>
      )}
    </div>
  );
}

// ── Section 3: Question Cards (middle column) ──

function QuestionCardList({
  questions,
  selectedId,
  onSelect,
}: {
  questions: OverviewQA[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (questions.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-gray-500 italic text-center px-4">
          AI questions will appear here after document analysis.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4 overflow-y-auto h-full custom-scrollbar">
      {questions.map((q) => {
        const isSelected = selectedId === q.id;
        return (
          <button
            key={q.id}
            onClick={() => onSelect(q.id)}
            className={`w-full text-left rounded-xl border p-4 transition-all ${isSelected
                ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                : q.answered
                  ? "border-gray-700 bg-gray-900/30 opacity-70"
                  : "border-gray-700 bg-gray-900/50 hover:border-gray-500 hover:bg-gray-900/70"
              }`}
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="text-[10px] uppercase tracking-wider font-bold text-primary">
                {q.item_title}
              </div>
              {q.answered && (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              )}
            </div>

            <div className="text-xs text-gray-300 mb-2 leading-relaxed">
              <span className="font-semibold text-gray-400">AI INSIGHT: </span>
              {q.ai_insight.length > 120
                ? q.ai_insight.slice(0, 120) + "..."
                : q.ai_insight}
            </div>

            {q.answered && q.answer ? (
              <div className="text-[10px] text-emerald-400 mt-1">
                答案：{q.answer.slice(0, 60)}
                {q.answer.length > 60 && "..."}
              </div>
            ) : (
              <div className="text-[10px] text-gray-500 mt-1 flex items-center gap-1">
                click to see the question...
                <ChevronRight className="w-3 h-3" />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Section 4: Answer Panel (right column) ──

function AnswerPanel({
  question,
  questions,
  onAnswer,
  onNavigatePrev,
  onNavigateNext,
  isFirst,
  isLast,
}: {
  question: OverviewQA | null;
  questions: OverviewQA[];
  onAnswer: (
    questionId: string,
    selectedOption: string,
    freeText: string
  ) => Promise<void>;
  onNavigatePrev: () => void;
  onNavigateNext: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [freeText, setFreeText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (question) {
      setSelectedOption(question.selected_option || null);
      setFreeText(question.free_text_answer || "");
    }
  }, [question?.id]);

  if (!question) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 text-sm p-6">
        <p className="text-center">
          Select a question from the list to review and answer.
        </p>
      </div>
    );
  }

  const handleSubmit = async () => {
    if (!selectedOption && !freeText.trim()) return;
    setSubmitting(true);
    try {
      await onAnswer(question.id, selectedOption || "", freeText);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Navigation bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-800 shrink-0">
        <button
          onClick={onNavigatePrev}
          disabled={isFirst}
          className="text-[10px] uppercase tracking-wider font-bold text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1 transition-colors"
        >
          <ArrowLeft className="w-3 h-3" />
          Back to Previous Stage
        </button>
        <button
          onClick={onNavigateNext}
          disabled={isLast}
          className="text-[10px] uppercase tracking-wider font-bold text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1 transition-colors"
        >
          Skip to Next Stage
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      {/* Question content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar">
        <div>
          <div className="text-[10px] uppercase tracking-wider font-bold text-primary mb-2">
            {question.item_title}
          </div>
        </div>

        {question.strategic_context && (
          <div>
            <div className="text-[10px] uppercase tracking-wider font-bold text-gray-500 mb-1.5">
              Strategic Decision
            </div>
            <p className="text-xs text-gray-300 leading-relaxed">
              {question.strategic_context}
            </p>
          </div>
        )}

        <div>
          <div className="text-[10px] uppercase tracking-wider font-bold text-gray-500 mb-1.5">
            AI Analysis
          </div>
          <p className="text-xs text-gray-300 leading-relaxed">
            {question.ai_insight}
          </p>
        </div>

        {/* Options */}
        <div className="space-y-2">
          {question.options.map((opt: OverviewQAOption) => {
            const isSelected = selectedOption === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => setSelectedOption(opt.id)}
                disabled={question.answered}
                className={`w-full text-left rounded-lg border p-3 transition-all ${isSelected
                    ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                    : "border-gray-700 bg-gray-900/40 hover:border-gray-500"
                  } ${question.answered ? "cursor-default" : ""}`}
              >
                <div className="flex items-start gap-2">
                  <div
                    className={`mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${isSelected
                        ? "border-primary bg-primary"
                        : "border-gray-600"
                      }`}
                  >
                    {isSelected && (
                      <div className="w-1.5 h-1.5 rounded-full bg-white" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-gray-200">
                        [{opt.id.toUpperCase()}] {opt.label}
                      </span>
                      {opt.recommended && (
                        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-emerald-900/40 text-emerald-400 border border-emerald-800">
                          建議選項
                        </span>
                      )}
                    </div>
                    {opt.description && (
                      <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
                        {opt.description}
                      </p>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Free text input */}
        {!question.answered && (
          <div>
            <textarea
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              placeholder="Additional notes or custom answer..."
              className="w-full px-3 py-2 text-xs rounded-lg border border-gray-700 bg-gray-900/40 text-gray-200 placeholder:text-gray-600 outline-none resize-none min-h-[60px] focus:border-primary transition-colors"
              rows={3}
            />
          </div>
        )}
      </div>

      {/* Submit button */}
      {!question.answered && (
        <div className="p-4 border-t border-gray-800 shrink-0">
          <button
            onClick={handleSubmit}
            disabled={(!selectedOption && !freeText.trim()) || submitting}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-white text-sm rounded-lg font-semibold hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            {submitting ? "Submitting..." : "Submit Answer"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main OverviewTab ──

export function OverviewTab({
  project,
  onUpdate,
  onNavigateToDetail,
  onGenerateQuestions,
  runEstimate,
  isEstimating,
}: OverviewTabProps) {
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(
    null
  );
  const [isGenerating, setIsGenerating] = useState(false);

  const questions: OverviewQA[] = project.overview_qa || [];
  const selectedQuestion =
    questions.find((q) => q.id === selectedQuestionId) || null;

  const selectedIndex = selectedQuestion
    ? questions.findIndex((q) => q.id === selectedQuestion.id)
    : -1;

  const allAnswered =
    questions.length > 0 && questions.every((q) => q.answered);

  const handleGenerateQuestions = async () => {
    if (!onGenerateQuestions) return;
    setIsGenerating(true);
    try {
      await onGenerateQuestions();
    } catch (err: any) {
      console.error("Failed to generate questions:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAnswer = async (
    questionId: string,
    selectedOption: string,
    freeText: string
  ) => {
    const updatedQA = questions.map((q) => {
      if (q.id !== questionId) return q;

      const optionLabel =
        q.options.find((o) => o.id === selectedOption)?.label || "";
      const answerText = freeText
        ? `${optionLabel}${optionLabel ? " — " : ""}${freeText}`
        : optionLabel;

      return {
        ...q,
        selected_option: selectedOption,
        free_text_answer: freeText,
        answered: true,
        answer: answerText,
      };
    });

    const updatedQuestion = updatedQA.find((q) => q.id === questionId);
    if (updatedQuestion?.affected_fields?.length) {
      const newInfo = { ...project.confirmed_info };
      for (const fieldKey of updatedQuestion.affected_fields) {
        if (newInfo[fieldKey]) {
          newInfo[fieldKey] = {
            ...newInfo[fieldKey],
            confidence: "high" as const,
            source: "user" as const,
            edited_at: new Date().toISOString(),
          };
        }
      }
      await onUpdate({ overview_qa: updatedQA, confirmed_info: newInfo });

      // Re-run rough estimate with updated confirmed_info
      if (runEstimate) {
        runEstimate().catch((err: any) => {
          console.error("Re-estimation after answer failed:", err);
        });
      }
    } else {
      await onUpdate({ overview_qa: updatedQA });
    }

    // Auto-advance to next unanswered question
    const nextUnanswered = updatedQA.find(
      (q) => !q.answered && q.id !== questionId
    );
    if (nextUnanswered) {
      setSelectedQuestionId(nextUnanswered.id);
    }
  };

  const handleNavigatePrev = () => {
    if (selectedIndex > 0) {
      setSelectedQuestionId(questions[selectedIndex - 1].id);
    }
  };

  const handleNavigateNext = () => {
    if (selectedIndex < questions.length - 1) {
      setSelectedQuestionId(questions[selectedIndex + 1].id);
    }
  };

  return (
    <div className="flex h-full bg-[#0d0d0f]">
      {/* ── Left Column: Project Info (top) + Estimate (bottom) ── */}
      <div className="w-[70%] shrink-0 flex flex-col border-r border-gray-800">
        {/* Project Info */}
        <div className="p-5 shrink-0">
          <ProjectInfoGrid project={project} onUpdate={onUpdate} />
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Rough Estimate */}
          <div className="p-5 border-t border-gray-800">
            <RoughEstimateDisplay project={project} isEstimating={isEstimating} />
          </div>

          {/* ── Middle Column: Question Cards ── */}
          <div className="flex-1 flex flex-col border-r border-gray-800 overflow-y-auto">
            <div className="flex-1 min-h-0">
              {questions.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-4 p-6">
                  <p className="text-xs text-gray-500 text-center">
                    Generate strategic questions based on the uploaded documents and
                    extracted project information.
                  </p>
                  <button
                    onClick={handleGenerateQuestions}
                    disabled={isGenerating || !onGenerateQuestions}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50 transition-colors"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      "Generate Questions"
                    )}
                  </button>
                </div>
              ) : (
                <QuestionCardList
                  questions={questions}
                  selectedId={selectedQuestionId}
                  onSelect={setSelectedQuestionId}
                />
              )}
            </div>

            {/* Proceed to Detail button */}
            {allAnswered && (
              <div className="p-4 border-t border-gray-800 shrink-0">
                <button
                  onClick={onNavigateToDetail}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-600 text-white text-sm rounded-lg font-semibold hover:bg-emerald-700 transition-colors"
                >
                  <ArrowRight className="w-4 h-4" />
                  Proceed to Detail
                </button>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* ── Right Column: Answer Panel ── */}
      <div className="flex-1 min-w-0 flex flex-col w-[30%]">
        <AnswerPanel
          question={selectedQuestion}
          questions={questions}
          onAnswer={handleAnswer}
          onNavigatePrev={handleNavigatePrev}
          onNavigateNext={handleNavigateNext}
          isFirst={selectedIndex <= 0}
          isLast={selectedIndex >= questions.length - 1}
        />
      </div>
    </div>
  );
}
