import type { CSIDivision } from "@/lib/types";

/** Map uploaded filenames to GC-action keywords for cross-division matching. */
export const UPLOAD_DOC_MATCHERS: {
  filePattern: RegExp;
  actionPattern: RegExp;
  label: string;
}[] = [
  {
    filePattern: /geotech|geological|soil\s*report|bearing/i,
    actionPattern: /geotech|geological|soil|bearing/i,
    label: "geotechnical",
  },
  {
    filePattern: /environmental|phase\s*i{1,2}|esa\b/i,
    actionPattern: /environmental|phase\s*i/i,
    label: "environmental",
  },
  {
    filePattern: /survey|topo|boundary/i,
    actionPattern: /survey|topograph/i,
    label: "survey",
  },
  {
    filePattern: /utility|sue\b|locat/i,
    actionPattern: /utility|sue|locat/i,
    label: "utility",
  },
  { filePattern: /paleo/i, actionPattern: /paleo/i, label: "paleontological" },
];

export function actionPatternsForUpload(filenames: string[]): RegExp[] {
  const patterns: RegExp[] = [];
  for (const name of filenames) {
    for (const { filePattern, actionPattern } of UPLOAD_DOC_MATCHERS) {
      if (filePattern.test(name)) patterns.push(actionPattern);
    }
  }
  return patterns;
}

export function divisionMatchesUploadedDoc(
  div: Pick<CSIDivision, "ai_gc_actions" | "confidence_reason">,
  actionPatterns: RegExp[]
): boolean {
  if (actionPatterns.length === 0) return false;
  const haystack = `${div.ai_gc_actions || ""} ${div.confidence_reason || ""}`;
  return actionPatterns.some((p) => p.test(haystack));
}

/** Division IDs to partially refine after an upload (never the full table). */
export function divisionIdsForDocRefine(
  divisions: CSIDivision[],
  options: {
    primaryDivisionId?: string | null;
    uploadedFilenames: string[];
    extraDivisionIds?: string[];
  }
): string[] {
  const ids = new Set<string>();
  if (options.primaryDivisionId) ids.add(options.primaryDivisionId);

  for (const id of options.extraDivisionIds || []) {
    if (id) ids.add(id);
  }

  const patterns = actionPatternsForUpload(options.uploadedFilenames);
  if (patterns.length > 0) {
    for (const d of divisions) {
      if (divisionMatchesUploadedDoc(d, patterns)) ids.add(d.id);
    }
  }

  return [...ids];
}
