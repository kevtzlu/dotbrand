"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Loader2, AlertCircle, Lock, CalendarDays, BookOpen, Plus } from "lucide-react";
import { useProject } from "@/lib/useProject";
import { OverviewTab } from "@/components/project/overview-tab";
import { DetailTab } from "@/components/project/detail-tab";
import { DebugTab } from "@/components/project/debug-tab";
import { BidDatesDialog } from "@/components/project/bid-dates-dialog";
import { BidFollowupDialog } from "@/components/project/bid-followup-dialog";
import type { Project, OverviewQA } from "@/lib/types";
import { ESTIMATION_STALE_MS } from "@/lib/types";
import { detailEstimateInvalidation } from "@/lib/project-invalidation";
import { AddMoreInfoDialog } from "@/components/project/add-more-info-dialog";

type TabKey = "overview" | "detail" | "debug";

function buildOverviewQAAnswersKey(questions: OverviewQA[]): string {
  return questions
    .map((q) => `${q.id}:${q.selected_option ?? ""}:${q.answer ?? ""}`)
    .join("|");
}

const showBetaFeatures = process.env.NEXT_PUBLIC_SHOW_BETA_FEATURES === "true";

const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "01 Overview" },
  { key: "detail", label: "02 Detail" },
  ...(showBetaFeatures ? [{ key: "debug" as TabKey, label: "🔍 Review" }] : []),
];

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { project, loading, error, updateProject, runEstimate, generateQuestions, refetch } =
    useProject(id);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  // Local state for instant UI feedback when user clicks estimate button
  const [localEstimating, setLocalEstimating] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  // Bid dates dialog: auto-open on first overview visit when no dates, or manually via button
  const [bidDatesDialogOpen, setBidDatesDialogOpen] = useState(false);
  const [bidDatesAutoShown, setBidDatesAutoShown] = useState(false);
  const showBidDatesDialog =
    bidDatesDialogOpen ||
    (!bidDatesAutoShown &&
      project != null &&
      !loading &&
      activeTab === "overview" &&
      project.bid_award_date == null);

  // Bid followup dialog: show 24h after bid_award_date when no result recorded
  const [bidFollowupDismissed, setBidFollowupDismissed] = useState(false);
  const [bidFollowupActive, setBidFollowupActive] = useState(false);
  // Manual "Add to KB" re-open: shown when bid result is set but not yet added to KB
  const [addToKBOpen, setAddToKBOpen] = useState(false);
  const [addMoreInfoOpen, setAddMoreInfoOpen] = useState(false);
  const [isAddMoreInfoProcessing, setIsAddMoreInfoProcessing] = useState(false);
  // Survives tab switches — prevents spurious overview re-runs that wipe detail data
  const overviewEstimatedQAKeyRef = useRef<string | null>(null);
  const overviewEstimateInFlightRef = useRef(false);
  const showBidFollowup =
    !bidFollowupDismissed &&
    !showBidDatesDialog &&
    project != null &&
    !loading &&
    project.bid_award_date != null &&
    project.bid_result == null &&
    !project.bid_followup_dismissed &&
    nowMs > new Date(project.bid_award_date).getTime() + 24 * 60 * 60 * 1000;

  const canAddToKB =
    project != null &&
    project.bid_result != null &&
    project.kb_project_id == null;

  // Keep dialog mounted after it first appears, even if project state changes optimistically.
  useEffect(() => {
    if (showBidFollowup) {
      queueMicrotask(() => setBidFollowupActive(true));
    }
  }, [showBidFollowup]);

  // Derive estimating state from DB (survives navigation) + local state (instant feedback)
  const dbIsEstimating =
    project?.estimating_phase != null &&
    project?.estimating_started_at != null &&
    nowMs - new Date(project.estimating_started_at).getTime() < ESTIMATION_STALE_MS;

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const isEstimating =
    localEstimating === "detail" ||
    (dbIsEstimating && project?.estimating_phase === "detail");
  const isOverviewEstimating =
    localEstimating === "overview" ||
    (dbIsEstimating && project?.estimating_phase === "overview");

  // Clear stale estimating state once the lock expires
  useEffect(() => {
    if (
      project?.estimating_phase &&
      project?.estimating_started_at &&
      nowMs - new Date(project.estimating_started_at).getTime() > ESTIMATION_STALE_MS
    ) {
      updateProject({ estimating_phase: null, estimating_started_at: null });
    }
  }, [project?.estimating_phase, project?.estimating_started_at, nowMs, updateProject]);

  // Detect when background estimation completes (phase transitions to null via polling)
  const prevPhaseRef = useRef(project?.estimating_phase);
  useEffect(() => {
    const prev = prevPhaseRef.current;
    prevPhaseRef.current = project?.estimating_phase;
    if (prev != null && project?.estimating_phase == null) {
      queueMicrotask(() => {
        setLocalEstimating(null);
        if (project?.estimating_error) {
          setApiError(project.estimating_error);
        }
      });
    }
  }, [project?.estimating_phase, project?.estimating_error]);

  // Safety timeout: clear localEstimating if it's been set for longer than ESTIMATION_STALE_MS.
  // This prevents the UI from spinning forever if the polling/transition detection fails.
  const localEstimatingSetAt = useRef<number | null>(null);
  useEffect(() => {
    if (localEstimating) {
      localEstimatingSetAt.current = Date.now();
      const timer = setTimeout(() => {
        setLocalEstimating(null);
        setApiError("Estimation timed out. Please try again.");
      }, ESTIMATION_STALE_MS);
      return () => clearTimeout(timer);
    } else {
      localEstimatingSetAt.current = null;
    }
  }, [localEstimating]);

  // --- Tab navigation guards ---
  const canGoDetail = useMemo(() => {
    if (!project) return false;
    const questions = project.overview_qa || [];
    return questions.length > 0 && questions.every((q) => q.answered);
  }, [project]);

  const handleTabClick = useCallback(
    (key: TabKey) => {
      if (key === "detail" && !canGoDetail) return;
      setActiveTab(key);
    },
    [canGoDetail]
  );

  // --- Invalidation wrappers ---
  // When editing overview data while detail/final already generated → invalidate them
  const handleOverviewUpdate = useCallback(
    async (updates: Partial<Project>) => {
      if (!project) return;
      const touchesOverviewData =
        updates.confirmed_info || updates.overview_qa || updates.rough_estimate;
      if (project.monte_carlo && touchesOverviewData) {
        await updateProject({
          ...updates,
          ...detailEstimateInvalidation(),
        });
      } else {
        await updateProject(updates);
      }
    },
    [project, updateProject]
  );

  // When editing detail data while final already generated → invalidate final
  const handleDetailUpdate = useCallback(
    async (updates: Partial<Project>) => {
      if (!project) return;
      const touchesDetailData =
        updates.csi_divisions ||
        updates.selected_scenario !== undefined;
      if (project.final_total_cost != null && touchesDetailData) {
        await updateProject({
          ...updates,
          final_hard_cost: null,
          final_soft_cost: null,
          final_total_cost: null,
          final_cost_summary: [],
          status: "detail",
        });
      } else {
        await updateProject(updates);
      }
    },
    [project, updateProject]
  );

  const handleRunOverviewEstimate = useCallback(async () => {
    if (!project) return;
    setLocalEstimating("overview");
    setApiError(null);
    try {
      if (project.monte_carlo) {
        await updateProject(detailEstimateInvalidation());
      }
      await runEstimate("overview");
      // 202 accepted — polling will clear localEstimating when done
    } catch (err: unknown) {
      // Immediate errors (409 conflict etc.)
      console.error("Overview re-estimation failed:", err);
      setApiError(err instanceof Error ? err.message : "Overview estimation failed");
      setLocalEstimating(null);
      overviewEstimatedQAKeyRef.current = null;
    }
  }, [project, updateProject, runEstimate]);

  // Seed tracking from DB on load so reloads / tab switches don't re-trigger overview
  useEffect(() => {
    if (!project) return;
    const questions = project.overview_qa || [];
    const allAnswered =
      questions.length > 0 && questions.every((q) => q.answered);
    if (!allAnswered) return;
    const qaKey = buildOverviewQAAnswersKey(questions);
    if (
      overviewEstimatedQAKeyRef.current === null &&
      (project.rough_estimate || project.monte_carlo)
    ) {
      overviewEstimatedQAKeyRef.current = qaKey;
    }
  }, [project]);

  // Re-run overview only when Q&A answers actually change (not on tab remount)
  useEffect(() => {
    if (!project || overviewEstimateInFlightRef.current) return;
    const questions = project.overview_qa || [];
    const allAnswered =
      questions.length > 0 && questions.every((q) => q.answered);
    if (!allAnswered || isOverviewEstimating) return;

    const qaKey = buildOverviewQAAnswersKey(questions);
    if (overviewEstimatedQAKeyRef.current === qaKey) return;

    if (dbIsEstimating && project.estimating_phase === "overview") {
      overviewEstimatedQAKeyRef.current = qaKey;
      return;
    }
    if (dbIsEstimating && project.estimating_phase != null) return;

    overviewEstimatedQAKeyRef.current = qaKey;
    overviewEstimateInFlightRef.current = true;
    void handleRunOverviewEstimate().finally(() => {
      overviewEstimateInFlightRef.current = false;
    });
  }, [
    project,
    isOverviewEstimating,
    dbIsEstimating,
    handleRunOverviewEstimate,
  ]);

  const handleOverviewQAChanged = useCallback(() => {
    overviewEstimatedQAKeyRef.current = null;
  }, []);

  useEffect(() => {
    if (searchParams.get("addMoreInfo") === "1") {
      queueMicrotask(() => {
        setAddMoreInfoOpen(true);
        router.replace(`/projects/${id}`);
      });
    }
  }, [searchParams, id, router]);

  const handleRunDetail = useCallback(async () => {
    if (!project) return;

    if (dbIsEstimating && project.estimating_phase === "overview") {
      setApiError("Overview estimate is still running. Please wait before generating detail.");
      return;
    }

    setLocalEstimating("detail");
    setApiError(null);
    try {
      await runEstimate("detail");
      // 202 accepted — polling will clear localEstimating when done
    } catch (err: unknown) {
      console.error("Detail estimation failed:", err);
      setApiError(err instanceof Error ? err.message : "Detail estimation failed");
      setLocalEstimating(null);
    }
  }, [project, dbIsEstimating, runEstimate]);

  const handleRetryDetail = async () => {
    // Clear stuck estimating state in DB, then re-run
    await updateProject({ estimating_phase: null, estimating_started_at: null });
    setLocalEstimating(null);
    setApiError(null);
    // Small delay to let DB clear before re-triggering
    await new Promise((r) => setTimeout(r, 500));
    handleRunDetail();
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3">
        <AlertCircle className="w-8 h-8 text-red-500" />
        <p className="text-sm text-red-600">
          {error || "Project not found"}
        </p>
        <button
          onClick={() => router.push("/projects")}
          className="text-sm text-primary hover:underline"
        >
          Back to Projects
        </button>
      </div>
    );
  }


  return (
    <div className="h-full flex flex-col bg-[#09090b]">
      {/* API error banner */}
      {apiError && (
        <div className="shrink-0 px-6 py-3 bg-red-900/20 border-b border-red-800 flex items-start gap-2 text-sm text-red-400">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <p className="flex-1">{apiError}</p>
          <button onClick={() => setApiError(null)} className="text-red-400 hover:text-red-300">
            <span className="sr-only">Dismiss</span>&times;
          </button>
        </div>
      )}
      {/* Header with tabs */}
      <div className="shrink-0 bg-[#111113] border-b border-gray-800">
        <div className="flex items-center justify-between px-6 h-12">
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-semibold text-gray-100 truncate">
              {project.title || "project name"}
            </h1>
            <button
              onClick={() => setBidDatesDialogOpen(true)}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors"
              title="Set bid award & construction dates"
            >
              <CalendarDays className="w-3.5 h-3.5" />
              {project.bid_award_date
                ? new Date(project.bid_award_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                : "Set dates"}
            </button>
            {canAddToKB && (
              <button
                onClick={() => setAddToKBOpen(true)}
                className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-900/20 border border-blue-800/50 transition-colors"
                title="Add this project to Knowledge Base"
              >
                <BookOpen className="w-3.5 h-3.5" />
                Add to KB
              </button>
            )}
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex items-center px-6 gap-4">
          <div className="flex gap-4">
            {TABS.map(({ key, label }) => {
              const isDisabled =
                (key === "detail" && !canGoDetail);
              const isActive = activeTab === key;

              return (
                <button
                  key={key}
                  onClick={() => handleTabClick(key)}
                  disabled={isDisabled}
                  className={`px-1 py-2.5 text-sm font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                    isActive
                      ? "border-white text-white"
                      : isDisabled
                      ? "border-transparent text-gray-700 cursor-not-allowed"
                      : "border-transparent text-gray-500 hover:text-gray-300"
                  }`}
                >
                  {isDisabled && <Lock className="w-3 h-3" />}
                  {label}
                </button>
              );
            })}
          </div>
          {activeTab === "overview" && (
            <div className="flex items-center gap-2">
              {isAddMoreInfoProcessing && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Updating...
                </span>
              )}
              <button
                onClick={() => setAddMoreInfoOpen(true)}
                disabled={isAddMoreInfoProcessing}
                className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-primary border border-primary/40 hover:bg-primary/10 transition-colors disabled:opacity-50"
                title="add more info"
                aria-label="add more info"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === "overview" && (
          <OverviewTab
            project={project}
            onUpdate={handleOverviewUpdate}
            onNavigateToDetail={() => setActiveTab("detail")}
            onGenerateQuestions={generateQuestions}
            onOverviewQAChanged={handleOverviewQAChanged}
            isEstimating={isOverviewEstimating}
          />
        )}
        {activeTab === "detail" && (
          <DetailTab
            project={project}
            onUpdate={handleDetailUpdate}
            onRunEstimate={handleRunDetail}
            onRetryEstimate={handleRetryDetail}
            isEstimating={isEstimating}
            isOverviewEstimating={isOverviewEstimating}
          />
        )}
        {activeTab === "debug" && (
          <DebugTab project={project} onUpdate={updateProject} />
        )}
      </div>

      {/* Bid dates popup — shown on first visit to overview when dates not set */}
      <BidDatesDialog
        open={showBidDatesDialog}
        initialBidDate={project?.bid_award_date ?? ""}
        initialConstructionDate={project?.construction_start_date ?? ""}
        onClose={() => { setBidDatesDialogOpen(false); setBidDatesAutoShown(true); }}
        onSave={async (dates) => {
          await updateProject(dates);
          setBidDatesDialogOpen(false);
          setBidDatesAutoShown(true);
        }}
      />

      {/* Bid followup popup — shown 24h after bid award date */}
      {project && bidFollowupActive && (
        <BidFollowupDialog
          open={bidFollowupActive}
          project={project}
          onClose={() => {
            setBidFollowupDismissed(true);
            setBidFollowupActive(false);
          }}
          onUpdate={updateProject}
        />
      )}

      {/* Manual "Add to KB" dialog — opened via header button */}
      {project && addToKBOpen && (
        <BidFollowupDialog
          open={addToKBOpen}
          project={project}
          onClose={() => setAddToKBOpen(false)}
          onUpdate={updateProject}
          kbOnly
        />
      )}

      {project && (
        <AddMoreInfoDialog
          open={addMoreInfoOpen}
          conversationId={project.conversation_id || `conv-${project.id}`}
          onClose={() => setAddMoreInfoOpen(false)}
          onUploaded={async (newFiles) => {
            const targetProject = project;
            const projectId = targetProject.id;
            const conversationId = targetProject.conversation_id || `conv-${targetProject.id}`;

            setIsAddMoreInfoProcessing(true);
            setApiError(null);

            // Fire-and-forget to keep popup close snappy.
            void (async () => {
              try {
                await updateProject({
                  conversation_id: conversationId,
                  uploaded_files: [...(targetProject.uploaded_files || []), ...newFiles],
                });

                const rescanRes = await fetch(`/api/projects/${projectId}/rescan-overview`, {
                  method: "POST",
                });
                if (!rescanRes.ok) {
                  let msg = "Failed to rescan project info";
                  try {
                    const body = await rescanRes.json();
                    msg = body?.error || msg;
                  } catch {
                    // ignore parse errors
                  }
                  throw new Error(msg);
                }

                await generateQuestions();
                await runEstimate("overview");
              } catch (err) {
                console.error("Add more info pipeline failed:", err);
                setApiError(
                  err instanceof Error
                    ? err.message
                    : "Add more info processing failed"
                );
              } finally {
                setIsAddMoreInfoProcessing(false);
                await refetch();
              }
            })();
          }}
        />
      )}
    </div>
  );
}
