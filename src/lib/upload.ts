export async function uploadToR2(
  buffer: ArrayBuffer,
  mimeType: string,
  displayName: string
): Promise<string> {
  const ext =
    displayName.slice(displayName.lastIndexOf(".")).toLowerCase() || "";
  const safeFileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}${ext}`;
  const pathname = `uploads/${safeFileName}`;

  const signRes = await fetch("/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pathname }),
  });
  if (!signRes.ok) throw new Error(`Failed to get presigned URL: ${signRes.status}`);
  const { presignedUrl, url } = await signRes.json();

  const putRes = await fetch(presignedUrl, {
    method: "PUT",
    body: buffer,
  });
  if (!putRes.ok) throw new Error(`Upload failed: ${putRes.status}`);

  return url;
}

export async function embedDocument(
  blobUrl: string,
  fileName: string,
  conversationId: string,
  options?: {
    originalFileName?: string;
    chunkOffset?: number;
    clearMatchingParts?: boolean;
  }
): Promise<{ chunks: number }> {
  const res = await fetch("/api/rag-embed", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      blobUrl,
      fileName,
      conversationId,
      ...options,
    }),
  });
  const data = await res.json();
  return { chunks: data.chunks ?? 0 };
}

export const ACCEPTED_EXTENSIONS = [
  ".txt", ".md", ".yaml", ".py", ".pdf", ".doc", ".docx",
  ".ppt", ".pptx", ".xlsx", ".xls", ".csv",
  ".jpg", ".jpeg", ".gif", ".png", ".webp", ".dwg", ".zip",
];

export const MAX_FILE_SIZE = 200 * 1024 * 1024;
export const TOTAL_LIMIT = 600 * 1024 * 1024;

export function getExtension(name: string): string {
  return "." + name.slice((name.lastIndexOf(".") - 1 >>> 0) + 2).toLowerCase();
}

export function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  if (bytes >= 1024) return (bytes / 1024).toFixed(1) + " KB";
  return bytes + " B";
}
