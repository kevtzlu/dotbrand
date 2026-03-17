"use client";

import { useState, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, AlertCircle, Lock } from "lucide-react";
import { useProject } from "@/lib/useProject";
import { OverviewTab } from "@/components/project/overview-tab";
import { DetailTab } from "@/components/project/detail-tab";
import { DebugTab } from "@/components/project/debug-tab";
import type { Project } from "@/lib/types";

type TabKey = "overview" | "detail" | "debug";

const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "01 Overview" },
  { key: "detail", label: "02 Detail" },
  { key: "debug", label: "🔍 Review" },
];

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { project, loading, error, updateProject, runEstimate, generateQuestions } =
    useProject(id);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [isEstimating, setIsEstimating] = useState(false);
  const [isOverviewEstimating, setIsOverviewEstimating] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

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
      const touchesOverviewData = updates.confirmed_info || updates.overview_qa;
      if (project.monte_carlo && touchesOverviewData) {
        await updateProject({
          ...updates,
          monte_carlo: null,
          risks: [],
          csi_divisions: [],
          ai_guesses: [],
          ai_evidence: [],
          hard_soft_ratio: { hard_pct: 85, soft_pct: 15 },
          final_hard_cost: null,
          final_soft_cost: null,
          final_total_cost: null,
          final_cost_summary: [],
          status: "overview",
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

  const handleRunOverviewEstimate = async () => {
    setIsOverviewEstimating(true);
    setApiError(null);
    try {
      await runEstimate("overview");
    } catch (err: any) {
      console.error("Overview re-estimation failed:", err);
      setApiError(err.message || "Overview estimation failed");
    } finally {
      setIsOverviewEstimating(false);
    }
  };

  const handleRunDetail = async () => {
    setIsEstimating(true);
    setApiError(null);
    try {
      await runEstimate("detail");
    } catch (err: any) {
      console.error("Detail estimation failed:", err);
      setApiError(err.message || "Detail estimation failed");
    } finally {
      setIsEstimating(false);
    }
  };


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
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex px-6 gap-4">
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
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === "overview" && (
          <OverviewTab
            project={project}
            onUpdate={handleOverviewUpdate}
            onNavigateToDetail={() => setActiveTab("detail")}
            onGenerateQuestions={generateQuestions}
            runEstimate={handleRunOverviewEstimate}
            isEstimating={isOverviewEstimating}
          />
        )}
        {activeTab === "detail" && (
          <DetailTab
            project={project}
            onUpdate={handleDetailUpdate}
            onRunEstimate={handleRunDetail}
            isEstimating={isEstimating}
          />
        )}
        {activeTab === "debug" && (
          <DebugTab project={project} onUpdate={updateProject} />
        )}
      </div>
    </div>
  );
}
