"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Project } from "@/lib/types";
import { ESTIMATION_STALE_MS } from "@/lib/types";

export function useProject(id: string) {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${id}`);
      if (!res.ok) throw new Error("Failed to load project");
      const { project: data } = await res.json();
      setProject(data);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  // Poll every 3s while an estimation is actively running (not stale)
  const isEstimatingRef = useRef(false);
  useEffect(() => {
    if (!project?.estimating_phase || !project?.estimating_started_at) {
      isEstimatingRef.current = false;
      return;
    }
    const elapsed = Date.now() - new Date(project.estimating_started_at).getTime();
    if (elapsed > ESTIMATION_STALE_MS) {
      isEstimatingRef.current = false;
      return;
    }
    isEstimatingRef.current = true;
    const interval = setInterval(fetchProject, 3000);
    return () => clearInterval(interval);
  }, [project?.estimating_phase, project?.estimating_started_at, fetchProject]);

  const updateProject = useCallback(
    async (updates: Partial<Project>) => {
      // Optimistic local update
      setProject((prev) => (prev ? { ...prev, ...updates } as Project : prev));

      try {
        const res = await fetch(`/api/projects/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
        if (!res.ok) throw new Error("Failed to update");
        const { project: updated } = await res.json();
        setProject(updated);
      } catch (e: any) {
        setError(e.message);
        // Revert on error
        fetchProject();
      }
    },
    [id, fetchProject]
  );

  const runEstimate = useCallback(
    async (phase: "overview" | "detail" | "final") => {
      const res = await fetch(`/api/projects/${id}/estimate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phase }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Estimation failed");
      }
      const { data } = await res.json();
      await fetchProject();
      return data;
    },
    [id, fetchProject]
  );

  const generateQuestions = useCallback(async () => {
    const res = await fetch(`/api/projects/${id}/generate-questions`, {
      method: "POST",
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to generate questions");
    }
    const { questions } = await res.json();
    await fetchProject();
    return questions;
  }, [id, fetchProject]);

  return { project, loading, error, updateProject, runEstimate, generateQuestions, refetch: fetchProject };
}
