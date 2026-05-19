"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  CheckCircle2,
  DollarSign,
  Calendar,
} from "lucide-react";
import type { KnowledgeProject, UploadedFile, KnowledgeDocSlot } from "@/lib/types";
import {
  KNOWLEDGE_DOC_SLOTS,
  KNOWLEDGE_REQUIRED_DOC_SLOTS,
  knowledgeSlotHasFiles,
  toFileArray,
} from "@/lib/types";
import { DocUploadSlot } from "@/components/knowledge/doc-upload-slot";

const REQUIRED_COUNT = KNOWLEDGE_REQUIRED_DOC_SLOTS.length;

export default function KnowledgeDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [project, setProject] = useState<KnowledgeProject | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/knowledge-base/${id}`)
      .then((r) => r.json())
      .then((data) => setProject(data.project))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  const saveSlot = async (field: string, files: UploadedFile[]) => {
    const res = await fetch(`/api/knowledge-base/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: files }),
    });
    if (res.ok) {
      const data = await res.json();
      setProject(data.project);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-gray-500">Project not found</p>
      </div>
    );
  }

  const requiredFilledCount = KNOWLEDGE_REQUIRED_DOC_SLOTS.filter((key) =>
    knowledgeSlotHasFiles(project[key])
  ).length;

  return (
    <div className="h-full overflow-y-auto bg-[#f9fafb] dark:bg-[#09090b]">
      <div className="max-w-3xl mx-auto p-8">
        <button
          onClick={() => router.push("/knowledge")}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Knowledge Base
        </button>

        <div className="mb-8">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {project.name}
              </h1>
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    project.project_type === "public"
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                      : "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                  }`}
                >
                  {project.project_type === "public" ? "Public Works" : "Private"}
                </span>
                {(project.start_date || project.end_date) && (
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <Calendar className="w-3 h-3" />
                    {project.start_date
                      ? new Date(project.start_date).toLocaleDateString()
                      : "?"}
                    {" - "}
                    {project.end_date
                      ? new Date(project.end_date).toLocaleDateString()
                      : "?"}
                  </span>
                )}
                {project.prevailing_wage && (
                  <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                    <DollarSign className="w-3 h-3" />
                    Prevailing Wage
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {project.is_complete ? (
          <div className="mb-6 flex items-center gap-3 rounded-2xl border border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10 p-4">
            <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
            <div>
              <p className="text-sm font-medium text-green-800 dark:text-green-300">
                Required documents uploaded
              </p>
              <p className="text-xs text-green-600/70 dark:text-green-400/70 mt-0.5">
                Owner Bid and Estimating documents are on file. This project is ready for AI reference.
              </p>
            </div>
          </div>
        ) : (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {requiredFilledCount}/{REQUIRED_COUNT} required documents uploaded
              </span>
            </div>
            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${(requiredFilledCount / REQUIRED_COUNT) * 100}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Upload Owner Bid Documents and Estimating Documents to complete this project.
            </p>
          </div>
        )}

        <div className="space-y-3">
          {KNOWLEDGE_DOC_SLOTS.map((slot) => (
            <DocUploadSlot
              key={slot.key}
              label={slot.required ? `${slot.label} *` : slot.label}
              description={slot.description}
              currentFiles={toFileArray(project[slot.key as KnowledgeDocSlot])}
              conversationId={project.conversation_id}
              onFilesChanged={(files) => saveSlot(slot.key, files)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
