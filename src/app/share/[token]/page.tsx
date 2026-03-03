"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Bot, User, Box, Paperclip, AlertCircle, Loader2, Lock } from "lucide-react"

interface Message {
    role: "assistant" | "user";
    content: string;
    attachments?: { name: string; size: number }[];
}

interface SharedConversation {
    id: string;
    title: string;
    timestamp: number;
    messages: Message[];
}

function formatSize(bytes: number) {
    if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + " MB";
    if (bytes >= 1024) return (bytes / 1024).toFixed(1) + " KB";
    return bytes + " B";
}

function formatDate(ts: number) {
    return new Date(ts).toLocaleDateString("en-US", {
        year: "numeric", month: "long", day: "numeric",
    });
}

export default function SharePage() {
    const params = useParams();
    const token = params?.token as string;

    const [conversation, setConversation] = useState<SharedConversation | null>(null);
    const [status, setStatus] = useState<"loading" | "ready" | "notfound">("loading");

    useEffect(() => {
        if (!token) return;
        fetch(`/api/share?token=${encodeURIComponent(token)}`)
            .then(res => res.ok ? res.json() : Promise.reject(res.status))
            .then(data => {
                setConversation(data.conversation);
                setStatus("ready");
            })
            .catch(() => setStatus("notfound"));
    }, [token]);

    if (status === "loading") {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#f9fafb]">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    if (status === "notfound" || !conversation) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#f9fafb] text-gray-600">
                <Lock className="w-12 h-12 text-gray-300" />
                <h1 className="text-xl font-semibold text-gray-800">Link not found or no longer active</h1>
                <p className="text-sm text-gray-400">This shared estimate may have been revoked or the link is invalid.</p>
            </div>
        );
    }

    // Parse project overview (P10/P50/P80) from messages
    const allAssistantContent = conversation.messages
        .filter(m => m.role === "assistant")
        .map(m => m.content)
        .join("\n");

    const extractVal = (patterns: RegExp[], text: string): number | null => {
        for (const p of patterns) {
            const m = text.match(p);
            if (m) {
                const n = parseFloat(m[1].replace(/,/g, ""));
                return n < 10000 ? n * 1_000_000 : n;
            }
        }
        return null;
    };

    const p10 = extractVal([
        /\bP10\b[^$\n]{0,15}\$\s*([\d,]+(?:\.\d+)?)\s*M?\b/i,
        /\bP10[:\s=]+\$\s*([\d,]+(?:\.\d+)?)\s*M?\b/i,
    ], allAssistantContent);

    const p50 = extractVal([
        /\bP50\b[^$\n]{0,15}\$\s*([\d,]+(?:\.\d+)?)\s*M?\b/i,
        /\bP50[:\s=]+\$\s*([\d,]+(?:\.\d+)?)\s*M?\b/i,
    ], allAssistantContent);

    const p80 = extractVal([
        /\bP80\b[^$\n]{0,15}\$\s*([\d,]+(?:\.\d+)?)\s*M?\b/i,
        /\bP80[:\s=]+\$\s*([\d,]+(?:\.\d+)?)\s*M?\b/i,
    ], allAssistantContent);

    const hasCostEstimate = p50 !== null && p50 > 0;

    const formatCost = (v: number) => {
        if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
        if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
        return `$${v.toFixed(0)}`;
    };

    return (
        <div className="min-h-screen bg-[#f9fafb] dark:bg-[#09090b]">
            {/* Top Bar */}
            <header className="sticky top-0 z-30 bg-white dark:bg-[#18181b] border-b border-gray-200 dark:border-gray-800 px-6 py-3 flex items-center gap-3 shadow-sm">
                <Box className="w-5 h-5 text-primary shrink-0" />
                <span className="font-semibold text-gray-900 dark:text-gray-100 tracking-tight">Estimait</span>
                <span className="text-gray-300 dark:text-gray-700 select-none">·</span>
                <span className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">Shared Estimate</span>
                <div className="ml-auto flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-xs px-3 py-1.5 rounded-full font-medium">
                    <Lock className="w-3 h-3" />
                    Read-only
                </div>
            </header>

            <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
                {/* Project Header */}
                <div className="bg-white dark:bg-[#18181b] border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">
                        {conversation.title}
                    </h1>
                    <p className="text-sm text-gray-400">{formatDate(conversation.timestamp)}</p>

                    {/* Cost Estimate Overview */}
                    {hasCostEstimate && (
                        <div className="mt-5 grid grid-cols-3 gap-3">
                            {[
                                { label: "P10 — Optimistic", value: p10, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800" },
                                { label: "P50 — Most Likely", value: p50, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800" },
                                { label: "P80 — Conservative", value: p80, color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800" },
                            ].map(({ label, value, color, bg }) => (
                                <div key={label} className={`rounded-xl border p-4 ${bg}`}>
                                    <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">{label}</div>
                                    <div className={`text-2xl font-bold ${color}`}>
                                        {value ? formatCost(value) : "—"}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Conversation */}
                <div className="space-y-6">
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 px-1">Conversation</h2>

                    {conversation.messages.map((msg, i) => (
                        <div key={i} className={`flex gap-4 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                            {/* Avatar */}
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === "assistant" ? "bg-primary text-white" : "bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-300"}`}>
                                {msg.role === "assistant" ? <Bot className="w-5 h-5" /> : <User className="w-5 h-5" />}
                            </div>

                            <div className={`flex flex-col gap-1 ${msg.role === "user" ? "items-end" : "items-start"} max-w-[85%]`}>
                                <div className="text-xs text-gray-500 font-medium px-1">
                                    {msg.role === "assistant" ? "Estimait AI" : "User"}
                                </div>

                                {msg.content && (
                                    <div className={`py-3 px-4 rounded-2xl ${msg.role === "user"
                                        ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 whitespace-pre-wrap text-sm"
                                        : "text-gray-800 dark:text-gray-200 bg-white dark:bg-[#18181b] border border-gray-100 dark:border-gray-800 shadow-sm w-full"
                                    }`}>
                                        {msg.role === "assistant" ? (
                                            <ReactMarkdown
                                                remarkPlugins={[remarkGfm]}
                                                components={{
                                                    h1: ({ children }) => <h1 className="text-xl font-bold mt-4 mb-2 text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700 pb-1">{children}</h1>,
                                                    h2: ({ children }) => <h2 className="text-lg font-bold mt-4 mb-2 text-gray-900 dark:text-gray-100">{children}</h2>,
                                                    h3: ({ children }) => <h3 className="text-base font-semibold mt-3 mb-1.5 text-gray-800 dark:text-gray-200">{children}</h3>,
                                                    p: ({ children }) => <div className="mb-3 leading-relaxed last:mb-0 text-sm">{children}</div>,
                                                    ul: ({ children }) => <ul className="list-disc list-outside pl-5 mb-3 space-y-1 text-sm">{children}</ul>,
                                                    ol: ({ children }) => <ol className="list-decimal list-outside pl-5 mb-3 space-y-1 text-sm">{children}</ol>,
                                                    li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                                                    strong: ({ children }) => <strong className="font-semibold text-gray-900 dark:text-gray-100">{children}</strong>,
                                                    em: ({ children }) => <em className="italic">{children}</em>,
                                                    blockquote: ({ children }) => <blockquote className="border-l-4 border-blue-400 pl-4 italic text-gray-600 dark:text-gray-400 my-3">{children}</blockquote>,
                                                    code: ({ inline, children }: any) => inline
                                                        ? <code className="bg-gray-100 dark:bg-gray-700 rounded px-1.5 py-0.5 text-xs font-mono text-gray-800 dark:text-gray-200">{children}</code>
                                                        : <pre className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3 my-3 overflow-x-auto text-xs font-mono"><code>{children}</code></pre>,
                                                    table: ({ children }) => (
                                                        <div className="overflow-x-auto my-3">
                                                            <table className="w-full border-collapse text-sm">{children}</table>
                                                        </div>
                                                    ),
                                                    thead: ({ children }) => <thead className="bg-gray-50 dark:bg-gray-800">{children}</thead>,
                                                    th: ({ children }) => <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left font-semibold text-gray-800 dark:text-gray-200 text-xs">{children}</th>,
                                                    td: ({ children }) => <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-gray-700 dark:text-gray-300 text-sm">{children}</td>,
                                                    tr: ({ children }) => <tr className="even:bg-gray-50 dark:even:bg-gray-800/50">{children}</tr>,
                                                    hr: () => <hr className="my-4 border-gray-200 dark:border-gray-700" />,
                                                }}
                                            >
                                                {msg.content}
                                            </ReactMarkdown>
                                        ) : (
                                            msg.content
                                        )}
                                    </div>
                                )}

                                {msg.attachments && msg.attachments.length > 0 && (
                                    <div className={`flex flex-wrap gap-1.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                                        {msg.attachments.map((att, idx) => (
                                            <div key={idx} className="flex items-center gap-1.5 bg-white dark:bg-[#18181b] border border-gray-200 dark:border-gray-800 shadow-sm rounded-lg px-2.5 py-1.5 text-xs">
                                                <Paperclip className="w-3.5 h-3.5 text-gray-400" />
                                                <span className="truncate max-w-[150px] font-medium text-gray-700 dark:text-gray-300">{att.name}</span>
                                                <span className="text-gray-400 font-mono">({formatSize(att.size)})</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="text-center py-6 border-t border-gray-200 dark:border-gray-800">
                    <div className="flex items-center justify-center gap-2 text-gray-400 text-xs">
                        <Box className="w-4 h-4 text-primary" />
                        <span>Generated by <strong className="text-gray-600 dark:text-gray-300">Estimait</strong> — AI Construction Cost Estimation</span>
                    </div>
                    <div className="mt-1 flex items-center justify-center gap-1.5 text-xs text-amber-500">
                        <AlertCircle className="w-3 h-3" />
                        AI estimates are indicative only. Always verify with qualified professionals.
                    </div>
                </div>
            </div>
        </div>
    );
}
