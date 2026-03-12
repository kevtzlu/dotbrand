"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, AlertCircle } from "lucide-react";
import { useProject } from "@/lib/useProject";
import { OverviewTab } from "@/components/project/overview-tab";
import { DetailTab } from "@/components/project/detail-tab";
import { FinalTab } from "@/components/project/final-tab";

type TabKey = "overview" | "detail" | "final";

const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "01 Overview" },
  { key: "detail", label: "02 Detail" },
  { key: "final", label: "03 Final" },
];

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { project, loading, error, updateProject, runEstimate, generateQuestions } =
    useProject(id);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [isEstimating, setIsEstimating] = useState(false);
  const [isOverviewEstimating, setIsOverviewEstimating] = useState(false);

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
    try {
      await runEstimate("overview");
    } catch (err: any) {
      console.error("Overview re-estimation failed:", err);
    } finally {
      setIsOverviewEstimating(false);
    }
  };

  const handleRunDetail = async () => {
    setIsEstimating(true);
    try {
      await runEstimate("detail");
    } catch (err: any) {
      console.error("Detail estimation failed:", err);
    } finally {
      setIsEstimating(false);
    }
  };

  const handleRunFinal = async () => {
    setIsEstimating(true);
    try {
      await runEstimate("final");
    } catch (err: any) {
      console.error("Final estimation failed:", err);
    } finally {
      setIsEstimating(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#09090b]">
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
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-1 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === key
                  ? "border-white text-white"
                  : "border-transparent text-gray-500 hover:text-gray-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === "overview" && (
          <OverviewTab
            project={project}
            onUpdate={updateProject}
            onNavigateToDetail={() => setActiveTab("detail")}
            onGenerateQuestions={generateQuestions}
            runEstimate={handleRunOverviewEstimate}
            isEstimating={isOverviewEstimating}
          />
        )}
        {activeTab === "detail" && (
          <DetailTab
            project={project}
            onUpdate={updateProject}
            onRunEstimate={handleRunDetail}
            onNavigateToFinal={() => {
              updateProject({ status: "final" });
              setActiveTab("final");
            }}
            isEstimating={isEstimating}
          />
        )}
        {activeTab === "final" && (
          <FinalTab
            project={project}
            onUpdate={updateProject}
            onRunFinal={handleRunFinal}
            isEstimating={isEstimating}
          />
        )}
      </div>
    </div>
  );
}
