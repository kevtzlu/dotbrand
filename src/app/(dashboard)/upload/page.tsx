"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  UploadCloud,
  FileText,
  FileSpreadsheet,
  Image,
  X,
  Paperclip,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Send,
  Globe2,
  Building2,
  ScrollText,
  Hammer,
} from "lucide-react";
import {
  uploadToR2,
  embedDocument,
  ACCEPTED_EXTENSIONS,
  MAX_FILE_SIZE,
  TOTAL_LIMIT,
  getExtension,
  formatFileSize,
} from "@/lib/upload";

interface AttachedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  buffer: ArrayBuffer;
}

const SCAN_STEPS = [
  "Uploading files",
  "Scanning documents with AI",
  "Generating strategic questions",
  "Calculating rough estimate",
  "All set!",
];

export default function UploadPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectScope = (searchParams.get("scope") || "private") as "public" | "private";
  const contractType = (searchParams.get("contract") || "design_bid_build") as "design_build" | "design_bid_build";
  const isDesignBidBuild = contractType === "design_bid_build";

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Scanning state
  const [isScanning, setIsScanning] = useState(false);
  const [scanStep, setScanStep] = useState(0);
  const [showThinking, setShowThinking] = useState(false);
  const [aiThinking, setAiThinking] = useState("");

  const readFileSafe = (f: File): Promise<AttachedFile | null> =>
    new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () =>
        resolve({
          id: Math.random().toString(36).substring(2, 9),
          name: f.name,
          size: f.size,
          type: f.type || "application/octet-stream",
          buffer: reader.result as ArrayBuffer,
        });
      reader.onerror = () => resolve(null);
      reader.readAsArrayBuffer(f);
    });

  const validateAndAdd = useCallback(
    async (files: File[]) => {
      setUploadError(null);
      const results: AttachedFile[] = [];
      let err = "";
      let total = attachedFiles.reduce((s, f) => s + f.size, 0);

      for (const f of files) {
        const ext = getExtension(f.name);
        if (f.name.includes(".") && !ACCEPTED_EXTENSIONS.includes(ext)) {
          err += `Unsupported: ${f.name}\n`;
          continue;
        }
        if (f.size > MAX_FILE_SIZE) {
          err += `Too large (>200MB): ${f.name}\n`;
          continue;
        }
        if (total + f.size > TOTAL_LIMIT) {
          err += `Total limit exceeded: ${f.name}\n`;
          continue;
        }
        total += f.size;
        const entry = await readFileSafe(f);
        if (entry) results.push(entry);
        else err += `Failed to read: ${f.name}\n`;
      }

      if (err) setUploadError(err.trim());
      if (results.length > 0) {
        setAttachedFiles((prev) => [...prev, ...results]);
      }
    },
    [attachedFiles]
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    validateAndAdd(Array.from(e.target.files));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (id: string) => {
    setAttachedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleStartEstimation = async () => {
    if (attachedFiles.length === 0) return;
    setIsScanning(true);
    setScanStep(0);
    setAiThinking("");

    try {
      // Step 0: "Uploading files"
      const convId = `conv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const projRes = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: null,
          status: "uploading",
          conversation_id: convId,
          contract_type: contractType,
          uploaded_files: attachedFiles.map((f) => ({
            name: f.name,
            size: f.size,
            type: f.type,
            url: "",
          })),
        }),
      });
      const { project } = await projRes.json();
      const projectId = project.id;

      // Upload files to R2 + RAG embed (server handles large PDFs natively)
      const blobUrls: { url: string; name: string; size: number }[] = [];
      for (const f of attachedFiles) {
        const ext = getExtension(f.name);
        const isPdf = ext === ".pdf";

        const url = await uploadToR2(
          f.buffer,
          f.type || "application/octet-stream",
          f.name
        );
        if (isPdf) {
          await embedDocument(url, f.name, convId);
        }
        blobUrls.push({ url, name: f.name, size: f.size });
      }

      // Update project with file URLs
      await fetch(`/api/projects/${projectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uploaded_files: blobUrls.map((b) => ({
            name: b.name,
            url: b.url,
            size: b.size,
            type: "application/octet-stream",
          })),
        }),
      });

      // Step 1: "Scanning documents with AI"
      setScanStep(1);

      const bidFormInstruction = isDesignBidBuild ? `

CRITICAL — BID FORM DETECTION (Design-Bid-Build / Public Works):
Carefully scan ALL uploaded documents for any section titled "Bid Form", "Bid Schedule", "Bid Proposal", "Schedule of Bid Items", "Bid Item List", or similar required pricing format. These are typically found in Divisions 00 or 01 of project specifications.

If a Bid Form is found:
1. Extract the EXACT structure: section headings, bid item numbers, descriptions, units of measure, and any required notes
2. Return the complete bid form structure in the "bid_form" field of your response
3. This structure WILL be used as the required format for the final cost estimate

Return format MUST include the bid_form field:
{
  "title": "...",
  "fields": { ... },
  "bid_form": {
    "found": true,
    "title": "Bid Form Section 00410",
    "sections": [
      {
        "section_title": "Site Work",
        "items": [
          { "item_no": "1", "description": "Earthwork - Grading and Excavation", "unit": "LS", "notes": "Lump sum including all labor and materials" }
        ]
      }
    ]
  }
}

If NO Bid Form is found, return: "bid_form": { "found": false, "sections": [] }` : "";

      const scanPrompt = `Scan all uploaded project documents. Extract project information: project name, location/zip code, building type, total GFA (sf), floors, occupancy class, target date, whether it is a public or private project, prevailing wage requirement, construction type (new/renovation), and any other key parameters. Return a JSON object with field names as keys and objects with 'value', 'confidence' (high/low), and 'source' (document/ai) as values. Also provide a short project title.${bidFormInstruction}

Base format: { "title": "...", "fields": { "project_name": { "value": "...", "confidence": "high", "source": "document" }, ... } }`;

      const formData = new FormData();
      formData.append("message", scanPrompt);
      formData.append("history", JSON.stringify([]));
      formData.append("conversationId", convId);
      formData.append("blobUrls", JSON.stringify(blobUrls));

      const chatRes = await fetch("/api/chat", {
        method: "POST",
        body: formData,
      });

      if (chatRes.ok && chatRes.body) {
        const reader = chatRes.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let fullResponse = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const jsonStr = line.slice(6).trim();
            if (!jsonStr) continue;
            try {
              const event = JSON.parse(jsonStr);
              if (event.type === "delta" && event.text) {
                fullResponse += event.text;
                setAiThinking(fullResponse);
              }
            } catch {
              /* skip */
            }
          }
        }

        // Try to parse the AI response as JSON
        let parsed: any = null;
        try {
          const cleaned = fullResponse
            .replace(/```json\s*/g, "")
            .replace(/```\s*/g, "")
            .trim();
          const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            parsed = JSON.parse(jsonMatch[0]);
          }
        } catch {
          /* non-JSON response, use as-is */
        }

        // Save extracted info to project
        const updatePayload: Record<string, any> = {
          status: "overview",
          chat_messages: [
            { role: "user", content: "Scan uploaded documents", timestamp: Date.now() },
            { role: "assistant", content: fullResponse, timestamp: Date.now() },
          ],
        };

        if (parsed?.fields) {
          updatePayload.extracted_info = parsed.fields;
          // Merge project_type from URL param into confirmed_info
          updatePayload.confirmed_info = {
            ...parsed.fields,
            project_type: {
              value: projectScope,
              confidence: "high",
              source: "user",
            },
          };
        }
        if (parsed?.title) {
          updatePayload.title = parsed.title;
        }
        // Save detected bid form if found
        if (isDesignBidBuild && parsed?.bid_form?.found && parsed.bid_form.sections?.length > 0) {
          updatePayload.bid_form_items = parsed.bid_form.sections;
        }

        await fetch(`/api/projects/${projectId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatePayload),
        });
      }

      // Step 2: "Generating strategic questions" — fire both in parallel
      setScanStep(2);

      let completedCount = 0;
      const advanceOnComplete = () => {
        completedCount++;
        if (completedCount === 1) setScanStep(3); // "Calculating rough estimate"
      };

      const questionsPromise = fetch(`/api/projects/${projectId}/generate-questions`, {
        method: "POST",
      }).then((res) => {
        advanceOnComplete();
        return res;
      });

      const estimatePromise = fetch(`/api/projects/${projectId}/estimate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phase: "overview" }),
      }).then((res) => {
        advanceOnComplete();
        return res;
      });

      const results = await Promise.allSettled([questionsPromise, estimatePromise]);
      const errors: string[] = [];
      for (const result of results) {
        if (result.status === "rejected") {
          console.error("Non-fatal upload step failed:", result.reason);
          errors.push(result.reason?.message || "Unknown error");
        } else if (!result.value.ok) {
          try {
            const body = await result.value.json();
            const msg = body.error || `Request failed (${result.value.status})`;
            console.error("Non-fatal upload step failed:", msg);
            errors.push(msg);
          } catch {
            errors.push(`Request failed (${result.value.status})`);
          }
        }
      }
      if (errors.length > 0) {
        setUploadError(errors.join("\n"));
        setIsScanning(false);
        return;
      }

      // Step 4: "All set!"
      setScanStep(SCAN_STEPS.length - 1);

      // Short delay then navigate
      await new Promise((r) => setTimeout(r, 800));
      router.push(`/projects/${projectId}`);
    } catch (err: any) {
      setIsScanning(false);
      setUploadError(`Upload failed: ${err.message}`);
    }
  };

  // -- Scanning screen --
  if (isScanning) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 bg-[#f9fafb] dark:bg-[#09090b]">
        <div className="w-full max-w-md">
          <div className="bg-white dark:bg-[#18181b] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                <Loader2 className="w-5 h-5 text-white animate-spin" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  Analyzing your project
                </h2>
                <p className="text-xs text-gray-500">
                  This may take a minute...
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {SCAN_STEPS.map((step, idx) => {
                const isDone = scanStep > idx;
                const isActive = scanStep === idx;
                return (
                  <div
                    key={idx}
                    className={`flex items-center gap-3 text-sm transition-all duration-500 ${
                      isDone
                        ? "text-green-600 dark:text-green-400"
                        : isActive
                          ? "text-blue-600 dark:text-blue-400"
                          : "text-gray-300 dark:text-gray-600"
                    }`}
                  >
                    <span className="w-5 text-center text-base">
                      {isDone ? "\u2705" : isActive ? "\u23F3" : "\u25CB"}
                    </span>
                    <span className={isActive ? "font-medium" : ""}>
                      {step}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Show AI thinking toggle */}
            {aiThinking && (
              <div className="mt-6 border-t border-gray-100 dark:border-gray-800 pt-4">
                <button
                  onClick={() => setShowThinking((v) => !v)}
                  className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                >
                  {showThinking ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                  {showThinking ? "Hide" : "Show"} AI thinking process
                </button>
                {showThinking && (
                  <div className="mt-3 max-h-48 overflow-y-auto rounded-lg bg-gray-50 dark:bg-gray-900 p-3 text-xs text-gray-600 dark:text-gray-400 font-mono whitespace-pre-wrap">
                    {aiThinking}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // -- Upload screen --
  const scopeLabel = projectScope === "public" ? "Public Works" : "Private";
  const contractLabel = contractType === "design_build" ? "Design-Build" : "Design-Bid-Build";
  const ScopeIcon = projectScope === "public" ? Globe2 : Building2;
  const ContractIcon = contractType === "design_build" ? Hammer : ScrollText;

  return (
    <div className="h-full flex flex-col items-center justify-center p-8 bg-[#f9fafb] dark:bg-[#09090b]">
      {/* Error toast */}
      {uploadError && (
        <div className="mb-4 w-full max-w-lg p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-600 dark:text-red-400 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <p className="whitespace-pre-wrap flex-1">{uploadError}</p>
          <button onClick={() => setUploadError(null)}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Project type badge */}
      <div className="mb-4 flex items-center gap-2">
        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold border border-primary/20">
          <ScopeIcon className="w-3.5 h-3.5" />
          {scopeLabel}
        </span>
        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs font-semibold border border-gray-200 dark:border-gray-700">
          <ContractIcon className="w-3.5 h-3.5" />
          {contractLabel}
        </span>
        {isDesignBidBuild && (
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-xs font-semibold border border-amber-200 dark:border-amber-700">
            Bid Form auto-detection enabled
          </span>
        )}
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const rawFiles: File[] = [];
          if (e.dataTransfer.items) {
            for (let i = 0; i < e.dataTransfer.items.length; i++) {
              const f = e.dataTransfer.items[i].getAsFile();
              if (f) rawFiles.push(f);
            }
          } else {
            for (let i = 0; i < e.dataTransfer.files.length; i++) {
              rawFiles.push(e.dataTransfer.files[i]);
            }
          }
          if (rawFiles.length > 0) validateAndAdd(rawFiles);
        }}
        onClick={(e) => {
          if (!(e.target as HTMLElement).closest("button"))
            fileInputRef.current?.click();
        }}
        className={`w-full max-w-lg cursor-pointer rounded-3xl border-2 border-dashed transition-all duration-200 flex flex-col items-center justify-center gap-5 py-14 px-8 select-none ${
          isDragging
            ? "border-primary bg-primary/5 dark:bg-primary/10 scale-[1.02]"
            : "border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 hover:border-primary/60 hover:bg-primary/5"
        }`}
      >
        <div
          className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors ${isDragging ? "bg-primary/20" : "bg-gray-100 dark:bg-gray-800"}`}
        >
          <UploadCloud
            className={`w-8 h-8 ${isDragging ? "text-primary" : "text-gray-400"}`}
          />
        </div>

        <div className="text-center space-y-1.5">
          <p className="text-lg font-bold text-gray-800 dark:text-gray-100">
            Upload your project files to get started
          </p>
          <p className="text-sm text-gray-500">
            Drag & drop files here, or{" "}
            <span className="text-primary font-semibold underline underline-offset-2">
              click to browse
            </span>
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          {[
            { icon: <FileText className="w-3.5 h-3.5" />, label: "BOD" },
            {
              icon: <FileText className="w-3.5 h-3.5" />,
              label: "Civil Engineering",
            },
            {
              icon: <FileText className="w-3.5 h-3.5" />,
              label: "Architectural Design",
            },
            { icon: <FileText className="w-3.5 h-3.5" />, label: "RFP" },
            {
              icon: <FileSpreadsheet className="w-3.5 h-3.5" />,
              label: "Specifications",
            },
            { icon: <Image className="w-3.5 h-3.5" />, label: "Drawings" },
          ].map(({ icon, label }) => (
            <span
              key={label}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-600 dark:text-gray-400 shadow-sm"
            >
              {icon} {label}
            </span>
          ))}
        </div>

        <div className="text-center space-y-1">
          <p className="text-xs text-gray-400 font-medium">
            Accepted: PDF, DOCX, XLSX, DWG, JPG, PNG, GIF
          </p>
          <p className="text-xs text-gray-400">Max 200MB per file · 600MB total</p>
        </div>
      </div>

      <input
        type="file"
        multiple
        ref={fileInputRef}
        onChange={handleFileSelect}
        className="hidden"
        accept={ACCEPTED_EXTENSIONS.join(",")}
      />

      {/* Attached files + start button */}
      {attachedFiles.length > 0 && (
        <div className="mt-6 w-full max-w-lg space-y-3">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            {attachedFiles.length} file{attachedFiles.length > 1 ? "s" : ""}{" "}
            ready
          </p>
          <div className="flex flex-wrap gap-2">
            {attachedFiles.map((f) => (
              <div
                key={f.id}
                className="flex items-center gap-2 bg-white dark:bg-[#18181b] border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2 text-sm shadow-sm"
              >
                <Paperclip className="w-3.5 h-3.5 text-gray-400" />
                <span className="truncate max-w-[180px] font-medium text-gray-700 dark:text-gray-300">
                  {f.name}
                </span>
                <span className="text-xs text-gray-400 font-mono">
                  ({formatFileSize(f.size)})
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(f.id);
                  }}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={handleStartEstimation}
            className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Send className="w-4 h-4" /> Start Estimation
          </button>
        </div>
      )}
    </div>
  );
}
