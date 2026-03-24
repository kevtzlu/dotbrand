"use client";

import { Calendar, Trash2, DollarSign, Shield } from "lucide-react";
import type { KnowledgeProject, KNOWLEDGE_DOC_SLOTS } from "@/lib/types";
import { KNOWLEDGE_DOC_SLOTS as DOC_SLOTS } from "@/lib/types";

interface ProjectCardProps {
  project: KnowledgeProject;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
}

const TYPE_BADGES: Record<string, string> = {
  public: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  private: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
};

export function KnowledgeProjectCard({ project, onClick, onDelete }: ProjectCardProps) {
  const filledCount = DOC_SLOTS.filter((s) => project[s.key] != null).length;

  return (
    <div
      onClick={onClick}
      className="group relative bg-white dark:bg-[#18181b] rounded-2xl border border-gray-200 dark:border-gray-800 p-5 cursor-pointer hover:shadow-lg hover:border-primary/30 transition-all"
    >
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate flex-1 mr-2">
          {project.name}
        </h3>
        <span
          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 ${
            TYPE_BADGES[project.project_type] || TYPE_BADGES.private
          }`}
        >
          {project.project_type === "public" ? "Public Works" : "Private"}
        </span>
      </div>

      <div className="space-y-1.5 text-xs text-gray-500 mb-4">
        {(project.start_date || project.end_date) && (
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3 h-3" />
            <span>
              {project.start_date
                ? new Date(project.start_date).toLocaleDateString()
                : "?"}
              {" - "}
              {project.end_date
                ? new Date(project.end_date).toLocaleDateString()
                : "?"}
            </span>
          </div>
        )}
        {project.prevailing_wage && (
          <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
            <DollarSign className="w-3 h-3" />
            <span>Prevailing Wage</span>
          </div>
        )}
      </div>

      {/* Document completion dots */}
      <div className="flex items-center gap-2">
        <div className="flex gap-1">
          {DOC_SLOTS.map((slot) => (
            <div
              key={slot.key}
              title={slot.label}
              className={`w-2 h-2 rounded-full ${
                project[slot.key]
                  ? "bg-green-500"
                  : "bg-gray-200 dark:bg-gray-700"
              }`}
            />
          ))}
        </div>
        <span className="text-[10px] text-gray-400">
          {filledCount}/5
        </span>
        {project.is_complete && (
          <Shield className="w-3 h-3 text-green-500 ml-auto" />
        )}
      </div>

      {/* Delete button */}
      <button
        onClick={onDelete}
        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-all"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
