"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Loader2,
  FolderOpen,
  Building2,
  MapPin,
  Calendar,
  DollarSign,
  Trash2,
} from "lucide-react";
import type { Project } from "@/lib/types";

const STATUS_COLORS: Record<string, string> = {
  uploading: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  overview: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  detail: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  final: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  completed: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
};

export default function ProjectListPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data) => setProjects(data.projects || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

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
            onClick={() => router.push("/upload")}
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
              onClick={() => router.push("/upload")}
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
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 ${STATUS_COLORS[p.status] || STATUS_COLORS.uploading}`}
                    >
                      {p.status}
                    </span>
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

                  {roughMin != null && (
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                      <DollarSign className="w-3 h-3" />
                      <span>
                        Est. ${(roughMin / 1_000_000).toFixed(1)}M&ndash;$
                        {((p.rough_estimate?.max || roughMin) / 1_000_000).toFixed(1)}M
                      </span>
                    </div>
                  )}

                  {/* Delete button */}
                  <button
                    onClick={(e) => handleDelete(p.id, e)}
                    className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
