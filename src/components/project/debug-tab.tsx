"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send,
  Loader2,
  Download,
  FileText,
  Image,
  Trash2,
  ChevronDown,
  Paperclip,
  X,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import type { Project, DebugMessage, DebugAttachment } from "@/lib/types";

interface DebugTabProps {
  project: Project;
  onUpdate: (updates: Partial<Project>) => Promise<void>;
}

export function DebugTab({ project, onUpdate }: DebugTabProps) {
  const [messages, setMessages] = useState<DebugMessage[]>(
    project.debug_messages || []
  );
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<DebugAttachment[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Sync from project if externally updated
  useEffect(() => {
    if (!isStreaming && project.debug_messages?.length) {
      setMessages(project.debug_messages);
    }
  }, [project.debug_messages, isStreaming]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const saveMessages = useCallback(
    (msgs: DebugMessage[]) => {
      // Strip base64 data from attachments before persisting to DB
      const stripped = msgs.map((m) => ({
        ...m,
        attachments: m.attachments?.map(({ data, ...rest }) => ({
          ...rest,
          data: "",  // don't store base64 in DB
        })),
      }));
      onUpdate({ debug_messages: stripped }).catch((err) =>
        console.error("Failed to save debug messages:", err)
      );
    },
    [onUpdate]
  );

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newAttachments: DebugAttachment[] = [];
    for (const file of Array.from(files)) {
      // 20MB limit
      if (file.size > 20 * 1024 * 1024) {
        alert(`File "${file.name}" is too large (max 20MB)`);
        continue;
      }
      const buffer = await file.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(buffer).reduce((s, b) => s + String.fromCharCode(b), "")
      );
      newAttachments.push({
        name: file.name,
        type: file.type || "application/octet-stream",
        data: base64,
        size: file.size,
      });
    }
    setPendingFiles((prev) => [...prev, ...newAttachments]);
    // Reset input so same file can be re-selected
    e.target.value = "";
  };

  const removePendingFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  const handleSend = async () => {
    const text = input.trim();
    if ((!text && pendingFiles.length === 0) || isStreaming) return;

    const attachments = pendingFiles.length > 0 ? [...pendingFiles] : undefined;
    const displayContent = text || (attachments ? attachments.map((f) => `📎 ${f.name}`).join(", ") : "");

    const userMsg: DebugMessage = {
      role: "user",
      content: displayContent,
      timestamp: Date.now(),
      attachments,
    };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setPendingFiles([]);
    setIsStreaming(true);

    // Add placeholder assistant message
    const assistantMsg: DebugMessage = {
      role: "assistant",
      content: "",
      timestamp: Date.now(),
    };
    const withAssistant = [...newMessages, assistantMsg];
    setMessages(withAssistant);

    try {
      abortRef.current = new AbortController();
      const res = await fetch(`/api/projects/${project.id}/debug-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({
            role: m.role,
            content: m.content,
            attachments: m.attachments,
          })),
        }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        throw new Error(`API error: ${res.status}`);
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === "delta") {
              fullContent += data.text;
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  ...updated[updated.length - 1],
                  content: fullContent,
                };
                return updated;
              });
            } else if (data.type === "error") {
              fullContent += `\n\n⚠️ Error: ${data.message}`;
            }
          } catch {
            // skip malformed SSE
          }
        }
      }

      // Save completed messages
      const finalMessages = [
        ...newMessages,
        { role: "assistant" as const, content: fullContent, timestamp: Date.now() },
      ];
      setMessages(finalMessages);
      saveMessages(finalMessages);
    } catch (err: any) {
      if (err.name === "AbortError") return;
      console.error("Debug chat error:", err);
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          content: `⚠️ Error: ${err.message}`,
        };
        return updated;
      });
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClear = () => {
    if (isStreaming) return;
    setMessages([]);
    saveMessages([]);
  };

  // ── Export functions ──

  const exportMarkdown = () => {
    const md = messages
      .map((m) => {
        const role = m.role === "user" ? "## 🧑 User" : "## 🤖 AI";
        const time = new Date(m.timestamp).toLocaleString();
        return `${role}\n_${time}_\n\n${m.content}`;
      })
      .join("\n\n---\n\n");

    const header = `# AI Review — ${project.title || "Project"}\n_Exported: ${new Date().toLocaleString()}_\n\n---\n\n`;
    const blob = new Blob([header + md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.title || "project"}_ai_review.md`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExport(false);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;
    const maxWidth = pageWidth - margin * 2;
    let y = 20;

    doc.setFontSize(16);
    doc.text(`AI Review — ${project.title || "Project"}`, margin, y);
    y += 10;
    doc.setFontSize(8);
    doc.text(`Exported: ${new Date().toLocaleString()}`, margin, y);
    y += 12;

    for (const m of messages) {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text(m.role === "user" ? "User:" : "AI:", margin, y);
      y += 6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const lines = doc.splitTextToSize(m.content, maxWidth);
      for (const line of lines) {
        if (y > 280) {
          doc.addPage();
          y = 20;
        }
        doc.text(line, margin, y);
        y += 4.5;
      }
      y += 6;
    }

    doc.save(`${project.title || "project"}_ai_review.pdf`);
    setShowExport(false);
  };

  const exportScreenshot = async () => {
    if (!chatAreaRef.current) return;
    try {
      const canvas = await html2canvas(chatAreaRef.current, {
        backgroundColor: "#0d0d0f",
        scale: 2,
      });
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `${project.title || "project"}_ai_review.png`;
      a.click();
    } catch (err) {
      console.error("Screenshot failed:", err);
    }
    setShowExport(false);
  };

  return (
    <div className="flex flex-col h-full bg-[#0d0d0f]">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <h2 className="text-sm font-bold text-gray-200">AI Review</h2>
        <div className="flex items-center gap-2">
          {/* Export dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowExport(!showExport)}
              disabled={messages.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-300 bg-gray-800 rounded-lg hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Export
              <ChevronDown className="w-3 h-3" />
            </button>
            {showExport && (
              <div className="absolute right-0 top-full mt-1 w-44 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden">
                <button
                  onClick={exportMarkdown}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-300 hover:bg-gray-700 transition-colors"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Markdown (.md)
                </button>
                <button
                  onClick={exportPDF}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-300 hover:bg-gray-700 transition-colors"
                >
                  <FileText className="w-3.5 h-3.5" />
                  PDF (.pdf)
                </button>
                <button
                  onClick={exportScreenshot}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-300 hover:bg-gray-700 transition-colors"
                >
                  <Image className="w-3.5 h-3.5" />
                  Screenshot (.png)
                </button>
              </div>
            )}
          </div>

          {/* Clear */}
          <button
            onClick={handleClear}
            disabled={messages.length === 0 || isStreaming}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-red-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={chatAreaRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
            <p className="text-sm mb-2">Ask AI about its estimation decisions</p>
            <p className="text-xs text-gray-600">
              e.g. &quot;Why is Div 03 concrete so expensive?&quot; or
              &quot;What data supports the foundation cost?&quot;
            </p>
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-xl px-4 py-3 text-sm ${
                m.role === "user"
                  ? "bg-primary/20 text-gray-100 rounded-br-sm"
                  : "bg-gray-800/60 text-gray-200 rounded-bl-sm"
              }`}
            >
              {m.role === "assistant" ? (
                <div className="prose prose-invert prose-sm max-w-none [&_table]:text-xs [&_th]:px-2 [&_td]:px-2">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {m.content || (isStreaming && i === messages.length - 1 ? "..." : "")}
                  </ReactMarkdown>
                </div>
              ) : (
                <div>
                  {m.attachments && m.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {m.attachments.map((att, ai) => (
                        <span
                          key={ai}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-primary/10 text-[11px] text-primary"
                        >
                          <Paperclip className="w-3 h-3" />
                          {att.name}
                          <span className="text-gray-500">({formatFileSize(att.size)})</span>
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="whitespace-pre-wrap">{m.content}</p>
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-gray-800 p-3 space-y-2">
        {/* Pending files */}
        {pendingFiles.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {pendingFiles.map((f, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-gray-800 border border-gray-700 text-[11px] text-gray-300"
              >
                <Paperclip className="w-3 h-3 text-gray-500" />
                {f.name}
                <span className="text-gray-500">({formatFileSize(f.size)})</span>
                <button
                  onClick={() => removePendingFile(i)}
                  className="ml-0.5 hover:text-red-400 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.xlsx,.xls,.csv,.doc,.docx,.txt,.png,.jpg,.jpeg,.gif,.webp"
            onChange={handleFileSelect}
            className="hidden"
          />
          {/* Attach button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isStreaming}
            className="shrink-0 flex items-center justify-center w-10 h-10 rounded-xl text-gray-400 hover:text-gray-200 hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Attach file"
          >
            <Paperclip className="w-4 h-4" />
          </button>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about AI decisions..."
            rows={1}
            className="flex-1 resize-none bg-gray-800/50 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-primary/50 transition-colors"
            style={{ minHeight: "40px", maxHeight: "120px" }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "40px";
              el.style.height = Math.min(el.scrollHeight, 120) + "px";
            }}
          />
          <button
            onClick={handleSend}
            disabled={(!input.trim() && pendingFiles.length === 0) || isStreaming}
            className="shrink-0 flex items-center justify-center w-10 h-10 rounded-xl bg-primary text-white hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {isStreaming ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
