"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, Paperclip, UploadCloud, X } from "lucide-react";
import {
  uploadToR2,
  embedDocument,
  ACCEPTED_EXTENSIONS,
  MAX_FILE_SIZE,
  formatFileSize,
} from "@/lib/upload";
import type { UploadedFile } from "@/lib/types";

interface AddMoreInfoDialogProps {
  open: boolean;
  conversationId: string;
  onClose: () => void;
  onUploaded: (newFiles: UploadedFile[]) => Promise<void>;
}

export function AddMoreInfoDialog({
  open,
  conversationId,
  onClose,
  onUploaded,
}: AddMoreInfoDialogProps) {
  const [mounted, setMounted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (!open) {
      setFiles([]);
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [open]);

  if (!open || !mounted) return null;

  const handlePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || []);
    if (picked.length === 0) return;
    const oversized = picked.filter((f) => f.size > MAX_FILE_SIZE);
    if (oversized.length > 0) {
      alert(
        `These files exceed the ${formatFileSize(MAX_FILE_SIZE)} limit:\n${oversized
          .map((f) => f.name)
          .join("\n")}`
      );
      return;
    }
    setFiles((prev) => [...prev, ...picked]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRemove = (name: string, size: number) => {
    setFiles((prev) => prev.filter((f) => !(f.name === name && f.size === size)));
  };

  const handleUpload = async () => {
    if (files.length === 0 || uploading) return;
    setUploading(true);
    try {
      const newFiles: UploadedFile[] = [];
      for (const file of files) {
        const buffer = await file.arrayBuffer();
        const url = await uploadToR2(buffer, file.type || "application/octet-stream", file.name);
        await embedDocument(url, file.name, conversationId);
        newFiles.push({
          name: file.name,
          url,
          size: file.size,
          type: file.type || "application/octet-stream",
        });
      }
      await onUploaded(newFiles);
      onClose();
    } catch (err) {
      console.error("Add more info upload failed:", err);
      alert("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-[#18181b] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xl w-full max-w-lg p-6 mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Add more info</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm text-gray-500 mb-4">
          Upload additional documents. Overview will regenerate using previous files plus these new files.
        </p>

        <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-4">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
          >
            <UploadCloud className="w-4 h-4" />
            Select files
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handlePick}
            accept={ACCEPTED_EXTENSIONS.join(",")}
            className="hidden"
          />
        </div>

        <div className="mt-4 space-y-2 max-h-48 overflow-y-auto">
          {files.map((f, idx) => (
            <div
              key={`${f.name}-${f.size}-${idx}`}
              className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Paperclip className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <span className="text-xs text-gray-700 dark:text-gray-200 truncate">{f.name}</span>
              </div>
              <button
                onClick={() => handleRemove(f.name, f.size)}
                className="text-gray-400 hover:text-red-500"
                disabled={uploading}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={uploading}
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={uploading || files.length === 0}
            className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold disabled:opacity-50 inline-flex items-center gap-2"
          >
            {uploading && <Loader2 className="w-4 h-4 animate-spin" />}
            Upload & Regenerate
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
