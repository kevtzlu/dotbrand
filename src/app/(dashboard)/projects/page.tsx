"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Loader2,
  FolderOpen,
  Building2,
  MapPin,
  Calendar,
  DollarSign,
  MoreHorizontal,
} from "lucide-react";
import type { Project } from "@/lib/types";
import { ESTIMATION_STALE_MS } from "@/lib/types";
import { BidFollowupDialog } from "@/components/project/bid-followup-dialog";
import { NewProjectDialog } from "@/components/project/new-project-dialog";
import { AddMoreInfoDialog } from "@/components/project/add-more-info-dialog";

const STATUS_COLORS: Record<string, string> = {
  uploading: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  overview: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  detail: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  final: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  completed: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
};

function isProjectEstimating(p: Project): boolean {
  return (
    p.estimating_phase != null &&
    p.estimating_started_at != null &&
    Date.now() - new Date(p.estimating_started_at).getTime() < ESTIMATION_STALE_MS
  );
}

export default function ProjectListPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [bidFollowupDismissed, setBidFollowupDismissed] = useState(false);
  const [followupProjectLocked, setFollowupProjectLocked] = useState<Project | null>(null);
  const [showNewProject, setShowNewProject] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [addMoreInfoProject, setAddMoreInfoProject] = useState<Project | null>(null);
  const [processingProjectIds, setProcessingProjectIds] = useState<string[]>([]);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/projects");
      const data = await res.json();
      setProjects(data.projects || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Find first project needing bid followup (24h past bid_award_date, no result)
  const followupProject = useMemo(() => {
    if (bidFollowupDismissed || loading) return null;
    return projects.find(
      (p) =>
        p.bid_award_date != null &&
        p.bid_result == null &&
        !p.bid_followup_dismissed &&
        Date.now() > new Date(p.bid_award_date).getTime() + 24 * 60 * 60 * 1000
    ) ?? null;
  }, [projects, loading, bidFollowupDismissed]);

  // Keep dialog mounted after first match so optimistic updates/fetches don't unmount it mid-flow.
  useEffect(() => {
    if (followupProject) {
      setFollowupProjectLocked(followupProject);
    }
  }, [followupProject]);

  // Keep locked project data fresh while dialog is open.
  useEffect(() => {
    if (!followupProjectLocked) return;
    const refreshed = projects.find((p) => p.id === followupProjectLocked.id);
    if (refreshed) {
      setFollowupProjectLocked(refreshed);
    }
  }, [projects, followupProjectLocked]);

  const handleFollowupUpdate = useCallback(async (updates: Partial<Project>) => {
    const targetProject = followupProjectLocked ?? followupProject;
    if (!targetProject) return;
    const res = await fetch(`/api/projects/${targetProject.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (res.ok) {
      fetchProjects();
    }
  }, [followupProjectLocked, followupProject, fetchProjects]);

  // Initial fetch
  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Poll every 3s when any project is actively estimating
  const hasEstimating = useMemo(
    () => projects.some(isProjectEstimating),
    [projects]
  );
  const hasBackgroundProcessing = processingProjectIds.length > 0;

  useEffect(() => {
    if (!hasEstimating && !hasBackgroundProcessing) return;
    const interval = setInterval(fetchProjects, 3000);
    return () => clearInterval(interval);
  }, [hasEstimating, hasBackgroundProcessing, fetchProjects]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this project? This cannot be undone.")) return;
    await fetch(`/api/projects/${id}`, { method: "DELETE" });
    setProjects((prev) => prev.filter((p) => p.id !== id));
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-[#f9fafb] dark:bg-[#09090b]">
      <div className="max-w-5xl mx-auto p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Projects
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {projects.length} project{projects.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            onClick={() => setShowNewProject(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            New Project
          </button>
        </div>

        {/* Project grid */}
        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <FolderOpen className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4" />
            <p className="text-gray-500 mb-4">No projects yet</p>
            <button
              onClick={() => setShowNewProject(true)}
              className="text-primary font-semibold hover:underline"
            >
              Create your first project
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((p) => {
              const info = p.confirmed_info || p.extracted_info || {};
              const buildingType =
                info.building_type?.value || info.building_type || "";
              const location =
                info.location?.value || info.location || "";
              const roughMin = p.rough_estimate?.min;
              const mc = p.monte_carlo;
              const estimating = isProjectEstimating(p);
              const isProcessing = processingProjectIds.includes(p.id);

              return (
                <div
                  key={p.id}
                  onClick={() => router.push(`/projects/${p.id}`)}
                  className="group relative bg-white dark:bg-[#18181b] rounded-2xl border border-gray-200 dark:border-gray-800 p-5 cursor-pointer hover:shadow-lg hover:border-primary/30 transition-all"
                >
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate flex-1 mr-2">
                      {p.title || "Untitled Project"}
                    </h3>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isProcessing ? (
                        <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Updating...
                        </span>
                      ) : estimating ? (
                        <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Estimating...
                        </span>
                      ) : (
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 ${STATUS_COLORS[p.status] || STATUS_COLORS.uploading}`}
                        >
                          {p.status}
                        </span>
                      )}
                      <div ref={menuOpenId === p.id ? menuRef : null} className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuOpenId((prev) => (prev === p.id ? null : p.id));
                          }}
                          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-200 transition-all opacity-0 group-hover:opacity-100"
                        >
                          <MoreHorizontal className="w-3.5 h-3.5" />
                        </button>
                        {menuOpenId === p.id && (
                          <div
                            className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-xl z-20 overflow-hidden py-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => {
                                setMenuOpenId(null);
                                setAddMoreInfoProject(p);
                              }}
                              className="w-full text-left px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                            >
                              Add more info
                            </button>
                            <div className="border-t border-gray-100 dark:border-gray-800 my-1" />
                            <button
                              onClick={(e) => {
                                setMenuOpenId(null);
                                handleDelete(p.id, e);
                              }}
                              className="w-full text-left px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs text-gray-500 mb-4">
                    {buildingType && (
                      <div className="flex items-center gap-1.5">
                        <Building2 className="w-3 h-3" />
                        <span>{String(buildingType)}</span>
                      </div>
                    )}
                    {location && (
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3 h-3" />
                        <span>{String(location)}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3 h-3" />
                      <span>
                        {new Date(p.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {mc ? (
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                      <DollarSign className="w-3 h-3" />
                      <span>
                        Est. ${(mc.optimistic / 1_000_000).toFixed(1)}M&ndash;$
                        {(mc.conservative / 1_000_000).toFixed(1)}M
                      </span>
                    </div>
                  ) : roughMin != null ? (
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                      <DollarSign className="w-3 h-3" />
                      <span>
                        Est. ${(roughMin / 1_000_000).toFixed(1)}M&ndash;$
                        {((p.rough_estimate?.max || roughMin) / 1_000_000).toFixed(1)}M
                      </span>
                    </div>
                  ) : null}

                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bid followup popup for projects past their bid award date */}
      {followupProjectLocked && (
        <BidFollowupDialog
          open={!!followupProjectLocked}
          project={followupProjectLocked}
          onClose={() => {
            setBidFollowupDismissed(true);
            setFollowupProjectLocked(null);
          }}
          onUpdate={handleFollowupUpdate}
        />
      )}

      <NewProjectDialog open={showNewProject} onClose={() => setShowNewProject(false)} />

      {addMoreInfoProject && (
        <AddMoreInfoDialog
          open={!!addMoreInfoProject}
          conversationId={addMoreInfoProject.conversation_id || `conv-${addMoreInfoProject.id}`}
          onClose={() => setAddMoreInfoProject(null)}
          onUploaded={async (newFiles) => {
            const targetProject = addMoreInfoProject;
            if (!targetProject) return;

            const projectId = targetProject.id;
            const conversationId = targetProject.conversation_id || `conv-${targetProject.id}`;

            setProcessingProjectIds((prev) =>
              prev.includes(projectId) ? prev : [...prev, projectId]
            );
            setProjects((prev) =>
              prev.map((proj) =>
                proj.id === projectId
                  ? {
                      ...proj,
                      conversation_id: conversationId,
                      uploaded_files: [...(proj.uploaded_files || []), ...newFiles],
                    }
                  : proj
              )
            );

            void (async () => {
              try {
                const updateRes = await fetch(`/api/projects/${projectId}`, {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    conversation_id: conversationId,
                    uploaded_files: [...(targetProject.uploaded_files || []), ...newFiles],
                  }),
                });
                if (!updateRes.ok) {
                  throw new Error("Failed to save uploaded files");
                }

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

                const questionRes = await fetch(`/api/projects/${projectId}/generate-questions`, {
                  method: "POST",
                });
                if (!questionRes.ok) {
                  throw new Error("Failed to generate questions");
                }

                const estimateRes = await fetch(`/api/projects/${projectId}/estimate`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ phase: "overview" }),
                });
                if (!estimateRes.ok) {
                  throw new Error("Failed to regenerate overview");
                }
              } catch (err) {
                console.error("Add more info pipeline failed:", err);
                alert("Add more info processing failed. Please try again.");
              } finally {
                setProcessingProjectIds((prev) =>
                  prev.filter((id) => id !== projectId)
                );
                fetchProjects();
              }
            })();
          }}
        />
      )}

    </div>
  );
}
