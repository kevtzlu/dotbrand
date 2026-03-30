"use client";

import { useState, useRef } from "react";
import {
  Upload,
  CheckCircle2,
  Loader2,
  FileText,
  X,
  Plus,
} from "lucide-react";
import { uploadToR2, embedDocument, ACCEPTED_EXTENSIONS, MAX_FILE_SIZE } from "@/lib/upload";
import type { UploadedFile } from "@/lib/types";

// Image extensions that should not be RAG-embedded (no extractable text)
const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp"];

interface DocUploadSlotProps {
  label: string;
  description: string;
  currentFiles: UploadedFile[];
  conversationId: string;
  onFilesChanged: (files: UploadedFile[]) => void;
}

export function DocUploadSlot({
  label,
  description,
  currentFiles,
  conversationId,
  onFilesChanged,
}: DocUploadSlotProps) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: File[]) => {
    const valid = files.filter((file) => {
      const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
      if (!ACCEPTED_EXTENSIONS.includes(ext)) {
        alert(`Unsupported file type: ${ext}`);
        return false;
      }
      if (file.size > MAX_FILE_SIZE) {
        alert(`${file.name} exceeds 200 MB limit`);
        return false;
      }
      return true;
    });
    if (valid.length === 0) return;

    setUploading(true);
    const added: UploadedFile[] = [];
    try {
      for (const file of valid) {
        const buffer = await file.arrayBuffer();
        const url = await uploadToR2(buffer, file.type, file.name);
        const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
        if (!IMAGE_EXTENSIONS.includes(ext)) {
          await embedDocument(url, file.name, conversationId);
        }
        added.push({ name: file.name, url, size: file.size, type: file.type });
      }
      onFilesChanged([...currentFiles, ...added]);
    } catch (err) {
      console.error("Upload failed:", err);
      alert("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const removeFile = (index: number) => {
    onFilesChanged(currentFiles.filter((_, i) => i !== index));
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) handleFiles(files);
  };

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) handleFiles(files);
    e.target.value = "";
  };

  const hasFiles = currentFiles.length > 0;

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      className={`rounded-2xl border-2 transition-all ${
        dragOver
          ? "border-primary bg-primary/5"
          : hasFiles
          ? "border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10"
          : "border-dashed border-gray-200 dark:border-gray-700 hover:border-primary/30 hover:bg-gray-50 dark:hover:bg-gray-800/50"
      }`}
    >
      {/* Header row */}
      <div
        className={`flex items-center justify-between p-4 ${hasFiles ? "pb-2" : ""}`}
      >
        <div className="flex items-center gap-2">
          {hasFiles ? (
            <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
          ) : (
            <Upload className="w-4 h-4 text-gray-400 shrink-0" />
          )}
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {label}
            </p>
            {!hasFiles && (
              <p className="text-xs text-gray-400">{description}</p>
            )}
          </div>
        </div>

        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 disabled:opacity-50 transition-colors shrink-0 ml-3"
        >
          {uploading ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Plus className="w-3 h-3" />
          )}
          {uploading ? "Uploading…" : "Add files"}
        </button>
      </div>

      {/* File list */}
      {hasFiles && (
        <div className="px-4 pb-4 space-y-1.5">
          {currentFiles.map((file, i) => (
            <div
              key={i}
              className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400"
            >
              <FileText className="w-3 h-3 shrink-0 text-gray-400" />
              <span className="truncate flex-1">{file.name}</span>
              <span className="shrink-0 text-gray-400">
                ({(file.size / 1024).toFixed(0)} KB)
              </span>
              <button
                onClick={() => removeFile(i)}
                className="shrink-0 p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-colors"
                title="Remove file"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Empty click target */}
      {!hasFiles && !uploading && (
        <div
          onClick={() => inputRef.current?.click()}
          className="px-4 pb-5 cursor-pointer text-center"
        >
          <p className="text-xs text-gray-400">
            Click or drag &amp; drop files here
          </p>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={onFileSelect}
      />
    </div>
  );
}
