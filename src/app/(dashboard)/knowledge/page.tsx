"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, BookOpen, AlertCircle } from "lucide-react";
import type { KnowledgeProject } from "@/lib/types";
import { KnowledgeProjectCard } from "@/components/knowledge/project-card";
import { CreateKnowledgeDialog } from "@/components/knowledge/create-dialog";

export default function KnowledgeBasePage() {
  const router = useRouter();
  const [projects, setProjects] = useState<KnowledgeProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const loadProjects = () => {
    fetch("/api/knowledge-base")
      .then((r) => r.json())
      .then((data) => setProjects(data.projects || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this knowledge project? All uploaded documents will be removed.")) return;
    await fetch(`/api/knowledge-base/${id}`, { method: "DELETE" });
    setProjects((prev) => prev.filter((p) => p.id !== id));
  };

  const completeCount = projects.filter((p) => p.is_complete).length;

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
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Knowledge Base
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {projects.length} project{projects.length !== 1 ? "s" : ""}{" "}
              &middot; {completeCount} complete
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add Project
          </button>
        </div>

        {/* Info banner when < 3 complete projects */}
        {completeCount < 3 && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10 p-4">
            <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                Upload at least 3 completed projects for better AI accuracy
              </p>
              <p className="text-xs text-amber-600/70 dark:text-amber-400/70 mt-1">
                The more past projects you upload with real cost data, the more
                accurately the AI can estimate your new projects. Each project
                needs all 5 documents (BOD, Map, Drawings, Initial Estimate,
                Final Estimate).
              </p>
              <div className="flex items-center gap-2 mt-2">
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className={`w-3 h-3 rounded-full ${
                        i < completeCount
                          ? "bg-green-500"
                          : "bg-gray-200 dark:bg-gray-700"
                      }`}
                    />
                  ))}
                </div>
                <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
                  {completeCount}/3 minimum
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Project grid */}
        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <BookOpen className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4" />
            <p className="text-gray-500 mb-4">No knowledge projects yet</p>
            <button
              onClick={() => setShowCreate(true)}
              className="text-primary font-semibold hover:underline"
            >
              Upload your first past project
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((p) => (
              <KnowledgeProjectCard
                key={p.id}
                project={p}
                onClick={() => router.push(`/knowledge/${p.id}`)}
                onDelete={(e) => handleDelete(p.id, e)}
              />
            ))}
          </div>
        )}
      </div>

      <CreateKnowledgeDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={loadProjects}
      />
    </div>
  );
}
