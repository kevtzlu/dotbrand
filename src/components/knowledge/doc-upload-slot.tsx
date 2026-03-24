"use client";

import { useState, useRef } from "react";
import {
  Upload,
  CheckCircle2,
  Loader2,
  FileText,
  RefreshCw,
} from "lucide-react";
import { uploadToR2, embedDocument, ACCEPTED_EXTENSIONS, MAX_FILE_SIZE } from "@/lib/upload";
import type { UploadedFile } from "@/lib/types";

// Image extensions that should not be RAG-embedded (no extractable text)
const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp"];

interface DocUploadSlotProps {
  label: string;
  description: string;
  currentFile: UploadedFile | null;
  conversationId: string;
  onUploaded: (file: UploadedFile) => void;
}

export function DocUploadSlot({
  label,
  description,
  currentFile,
  conversationId,
  onUploaded,
}: DocUploadSlotProps) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      alert(`Unsupported file type: ${ext}`);
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      alert("File exceeds 200MB limit");
      return;
    }

    setUploading(true);
    try {
      const buffer = await file.arrayBuffer();
      const url = await uploadToR2(buffer, file.type, file.name);

      // Only embed text-parseable documents (skip images)
      const isImage = IMAGE_EXTENSIONS.includes(ext);
      if (!isImage) {
        await embedDocument(url, file.name, conversationId);
      }

      const uploaded: UploadedFile = {
        name: file.name,
        url,
        size: file.size,
        type: file.type,
      };
      onUploaded(uploaded);
    } catch (err) {
      console.error("Upload failed:", err);
      alert("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  if (uploading) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 p-6 flex flex-col items-center justify-center min-h-[120px]">
        <Loader2 className="w-6 h-6 animate-spin text-primary mb-2" />
        <p className="text-sm text-primary font-medium">Uploading...</p>
      </div>
    );
  }

  if (currentFile) {
    return (
      <div className="rounded-2xl border border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10 p-4">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-0.5">
              {label}
            </p>
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <FileText className="w-3 h-3" />
              <span className="truncate">{currentFile.name}</span>
              <span>({(currentFile.size / 1024).toFixed(0)} KB)</span>
            </div>
          </div>
          <button
            onClick={() => inputRef.current?.click()}
            className="p-1.5 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/20 text-gray-400 hover:text-gray-600 transition-colors"
            title="Replace file"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={onFileSelect}
        />
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
      className={`rounded-2xl border-2 border-dashed p-6 flex flex-col items-center justify-center min-h-[120px] cursor-pointer transition-all ${
        dragOver
          ? "border-primary bg-primary/5"
          : "border-gray-200 dark:border-gray-700 hover:border-primary/30 hover:bg-gray-50 dark:hover:bg-gray-800/50"
      }`}
    >
      <Upload className="w-5 h-5 text-gray-400 mb-2" />
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
      </p>
      <p className="text-xs text-gray-400 mt-1">{description}</p>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={onFileSelect}
      />
    </div>
  );
}
