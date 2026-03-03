"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
    PieChart, Pie, Legend, LineChart, Line,
} from "recharts"
import {
    Bot, User, Box, Paperclip, AlertCircle, Loader2, Lock,
    MapPin, Ruler, BarChart3, AlertTriangle, Building2,
    PanelRightClose, ChevronLeft,
} from "lucide-react"
import { parseEstimationData } from "@/lib/parseEstimationData"
import { EstimationData, Message, StageSnapshot } from "@/app/page"

interface SharedConversation {
    id: string;
    title: string;
    timestamp: number;
    messages: Message[];
    stageSnapshots?: StageSnapshot[];
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

function formatCurrency(val: number) {
    return `$${(val / 1_000_000).toFixed(1)}M`;
}

function RiskAccordion({ risks }: { risks?: { title: string; description: string }[] }) {
    const [openIdx, setOpenIdx] = useState<number | null>(null);

    if (!risks?.length) return null;

    return (
        <div className="space-y-3">
            <h3 className="text-sm font-bold flex items-center gap-2 text-gray-800 dark:text-gray-200">
                <AlertTriangle className="w-4 h-4 text-orange-500" /> Critical Risk Drivers
            </h3>
            <div className="flex flex-col gap-2">
                {risks.map((risk, i) => (
                    <div key={i} className="rounded-xl border border-orange-100 dark:border-orange-900/40 overflow-hidden">
                        <button
                            onClick={() => setOpenIdx(openIdx === i ? null : i)}
                            className="w-full flex items-center gap-2 p-3 bg-orange-50 dark:bg-orange-950/20 text-orange-700 dark:text-orange-400 text-xs font-semibold text-left hover:bg-orange-100 dark:hover:bg-orange-950/40 transition-colors"
                        >
                            <span className="shrink-0">⚠️</span>
                            <span className="flex-1 wrap-break-word">{risk.title}</span>
                            <span className="shrink-0 text-orange-400 ml-1">{openIdx === i ? "▲" : "▼"}</span>
                        </button>
                        {openIdx === i && risk.description && (
                            <div className="px-4 py-3 bg-white dark:bg-orange-950/10 text-xs text-gray-600 dark:text-gray-400 leading-relaxed border-t border-orange-100 dark:border-orange-900/30">
                                {risk.description}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

interface ProjectOverviewProps {
    data: EstimationData;
    stageSnapshots: StageSnapshot[];
    activeStage: string | null;
    onStageSelect: (stage: string) => void;
    onClose: () => void;
}

function ProjectOverview({ data, stageSnapshots, activeStage, onStageSelect, onClose }: ProjectOverviewProps) {
    const isMonteCarlo = !data.chartType || data.chartType === "monte-carlo";

    return (
        <div className="h-full flex flex-col bg-white dark:bg-[#18181b] border-l border-gray-200 dark:border-gray-800">
            {/* Sticky header */}
            <div className="shrink-0 border-b border-gray-100 dark:border-gray-800 bg-white/90 dark:bg-[#18181b]/90 backdrop-blur-xl sticky top-0 z-10">
                <div className="px-5 pt-5 pb-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                            <BarChart3 className="w-4 h-4 text-primary shrink-0" />
                            {data.projectName || "Project Overview"}
                        </h2>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
                            {data.location && (
                                <span className="flex items-center gap-1 text-[11px] text-gray-500 uppercase tracking-wider font-medium">
                                    <MapPin className="w-3 h-3 shrink-0" /> {data.location}
                                </span>
                            )}
                            {data.gfa && (
                                <span className="flex items-center gap-1 text-[11px] text-gray-500 uppercase tracking-wider font-medium">
                                    <Ruler className="w-3 h-3" /> {data.gfa}
                                </span>
                            )}
                            {data.buildingType && (
                                <span className="flex items-center gap-1 text-[11px] text-gray-500 uppercase tracking-wider font-medium">
                                    <Building2 className="w-3 h-3" /> {data.buildingType}
                                </span>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors shrink-0 mt-0.5"
                    >
                        <PanelRightClose className="w-5 h-5 text-gray-400" />
                    </button>
                </div>

                {/* Stage Navigator */}
                {stageSnapshots.length > 0 && (
                    <div className="px-5 pb-3 flex items-center gap-2 overflow-x-auto">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest shrink-0">Stages</span>
                        <div className="flex items-center gap-1.5">
                            {stageSnapshots.map((snap) => {
                                const isActive = snap.stage === activeStage;
                                const isMC = snap.data.chartType === "monte-carlo";
                                return (
                                    <button
                                        key={snap.stage}
                                        onClick={() => onStageSelect(snap.stage)}
                                        title={snap.label}
                                        className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all duration-150 whitespace-nowrap
                                            ${isActive
                                                ? isMC
                                                    ? "bg-blue-500 text-white shadow-sm"
                                                    : "bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 shadow-sm"
                                                : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                                            }`}
                                    >
                                        <span>Stage {snap.stage}</span>
                                        {isMC && <span className="text-[9px] opacity-80">MC</span>}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-7">
                {isMonteCarlo ? (
                    <>
                        {/* P10 / P50 / P80 */}
                        <div className="grid grid-cols-3 gap-3">
                            <div className="bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 rounded-2xl p-3 text-center">
                                <div className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-1.5">Optimistic P10</div>
                                <div className="text-xl font-black text-emerald-700 dark:text-emerald-300">{formatCurrency(data.p10)}</div>
                            </div>
                            <div className="bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 rounded-2xl p-3 text-center ring-4 ring-blue-500/10 scale-105">
                                <div className="text-[9px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1.5">Most Likely P50</div>
                                <div className="text-xl font-black text-blue-700 dark:text-blue-300">{formatCurrency(data.p50)}</div>
                            </div>
                            <div className="bg-orange-50/60 dark:bg-orange-950/20 border border-orange-100 dark:border-orange-900/40 rounded-2xl p-3 text-center">
                                <div className="text-[9px] font-bold text-orange-600 dark:text-orange-400 uppercase tracking-widest mb-1.5">Conservative P80</div>
                                <div className="text-xl font-black text-orange-700 dark:text-orange-300">{formatCurrency(data.p80)}</div>
                            </div>
                        </div>

                        {/* Histogram */}
                        {data.histogram && data.histogram.length > 0 && (
                            <div className="space-y-3">
                                <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                    <BarChart3 className="w-4 h-4 text-primary" /> Cost Distribution
                                </h3>
                                <div className="h-40 w-full bg-gray-50 dark:bg-[#121214] rounded-2xl border border-gray-100 dark:border-gray-800 p-3">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={data.histogram}>
                                            <XAxis dataKey="cost" hide />
                                            <Tooltip
                                                cursor={{ fill: "transparent" }}
                                                contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)" }}
                                            />
                                            <Bar dataKey="frequency" radius={[4, 4, 0, 0]}>
                                                {data.histogram.map((_, index) => (
                                                    <Cell key={`cell-${index}`} fill={index < 3 ? "#10b981" : index > 8 ? "#f97316" : "#3b82f6"} opacity={0.8} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        )}

                        {/* Confidence Range */}
                        <div className="space-y-3">
                            <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300">Confidence Range (P10 – P80)</h3>
                            <div className="relative h-10 flex items-center px-4 bg-gray-100 dark:bg-gray-900 rounded-full overflow-hidden">
                                <div className="absolute left-0 right-0 h-1.5 bg-gray-200 dark:bg-gray-800" />
                                <div className="absolute h-3 bg-linear-to-r from-emerald-400 via-blue-500 to-orange-400 rounded-full" style={{ left: "10%", right: "10%" }} />
                                <div className="relative flex justify-between w-full text-[9px] font-black uppercase text-gray-500">
                                    <span>{formatCurrency(data.p10)}</span>
                                    <span className="text-blue-500">{formatCurrency(data.p50)}</span>
                                    <span>{formatCurrency(data.p80)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Category Breakdown */}
                        {data.breakdown && data.breakdown.length > 0 && (
                            <div className="space-y-3">
                                <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300">P50 Category Breakdown</h3>
                                <div className="grid gap-3">
                                    {data.breakdown.map((item, i) => (
                                        <div key={i} className="space-y-1.5">
                                            <div className="flex justify-between text-xs font-semibold gap-2">
                                                <span className="text-gray-600 dark:text-gray-400 flex-1">{item.name}</span>
                                                <span className="shrink-0">{formatCurrency(item.value)} ({(item.value / data.p50 * 100).toFixed(0)}%)</span>
                                            </div>
                                            <div className="h-2 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                                                <div className="h-full bg-primary/60 rounded-full" style={{ width: `${(item.value / data.p50 * 100)}%` }} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Risk Drivers */}
                        <RiskAccordion risks={data.risks} />

                        {/* Footer */}
                        <div className="flex justify-between items-center text-[10px] text-gray-400 uppercase tracking-widest font-bold border-t border-gray-100 dark:border-gray-800 pt-4">
                            <span>Monte Carlo</span>
                            <span>10,000 iter.</span>
                            <span>dotbrand REAL™</span>
                        </div>
                    </>
                ) : (
                    /* Non-Monte Carlo: bar / pie / line */
                    <div className="space-y-6">
                        <h3 className="text-sm font-bold flex items-center gap-2 text-gray-700 dark:text-gray-300">
                            <BarChart3 className="w-4 h-4 text-primary" />
                            {data.chartType === "pie" ? "Distribution Breakdown" :
                                data.chartType === "line" ? "Trend Analysis" : "Comparison Analytics"}
                        </h3>

                        <div className="h-64 w-full bg-gray-50 dark:bg-[#121214] rounded-2xl border border-gray-100 dark:border-gray-800 p-4">
                            <ResponsiveContainer width="100%" height="100%">
                                {data.chartType === "pie" ? (
                                    <PieChart>
                                        <Pie
                                            data={data.chartData}
                                            dataKey="value"
                                            nameKey="name"
                                            cx="50%"
                                            cy="50%"
                                            outerRadius={75}
                                            label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                                        >
                                            {data.chartData?.map((_: any, index: number) => (
                                                <Cell key={`cell-${index}`} fill={[
                                                    "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"
                                                ][index % 6]} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                        <Legend verticalAlign="bottom" height={36} />
                                    </PieChart>
                                ) : data.chartType === "line" ? (
                                    <LineChart data={data.chartData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                                        <XAxis dataKey="name" />
                                        <YAxis tickFormatter={(val) => `$${val >= 1000000 ? (val / 1000000).toFixed(1) + "M" : val}`} />
                                        <Tooltip />
                                        <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={3} dot={{ r: 5 }} />
                                    </LineChart>
                                ) : (
                                    <BarChart data={data.chartData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                                        <XAxis dataKey="name" />
                                        <YAxis tickFormatter={(val) => `$${val >= 1000000 ? (val / 1000000).toFixed(1) + "M" : val}`} />
                                        <Tooltip />
                                        <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                )}
                            </ResponsiveContainer>
                        </div>

                        {/* Data Table */}
                        {data.chartData && data.chartData.length > 0 && (
                            <div className="bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="text-gray-500 text-left border-b border-gray-200 dark:border-gray-800">
                                            <th className="pb-2 font-medium">Category</th>
                                            <th className="pb-2 font-medium text-right">Value</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.chartData.map((item: any, i: number) => (
                                            <tr key={i} className="border-b border-gray-100 dark:border-gray-800/50 last:border-0">
                                                <td className="py-2.5 font-medium">{item.name}</td>
                                                <td className="py-2.5 text-right font-mono">
                                                    {typeof item.value === "number"
                                                        ? (item.value > 1000 ? `$${item.value.toLocaleString()}` : `${item.value}%`)
                                                        : item.value}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default function SharePage() {
    const params = useParams();
    const token = params?.token as string;

    const [conversation, setConversation] = useState<SharedConversation | null>(null);
    const [status, setStatus] = useState<"loading" | "ready" | "notfound">("loading");
    const [isOverviewOpen, setIsOverviewOpen] = useState(true);
    const [activeStage, setActiveStage] = useState<string | null>(null);
    const [stageSnapshots, setStageSnapshots] = useState<StageSnapshot[]>([]);
    const [activeData, setActiveData] = useState<EstimationData | null>(null);

    // Override body overflow for scrollable share page
    useEffect(() => {
        const body = document.body;
        body.style.overflow = "auto";
        body.style.height = "auto";
        return () => {
            body.style.overflow = "";
            body.style.height = "";
        };
    }, []);

    useEffect(() => {
        if (!token) return;
        fetch(`/api/share?token=${encodeURIComponent(token)}`)
            .then(res => res.ok ? res.json() : Promise.reject(res.status))
            .then(data => {
                const conv: SharedConversation = data.conversation;
                setConversation(conv);

                // Build stage snapshots: prefer DB-stored, fallback to parseEstimationData
                const saved = conv.stageSnapshots ?? [];
                if (saved.length > 0) {
                    setStageSnapshots(saved);
                    const last = saved[saved.length - 1];
                    setActiveStage(last.stage);
                    setActiveData(last.data);
                    setIsOverviewOpen(true);
                } else {
                    const parsed = parseEstimationData(conv.messages);
                    if (parsed) {
                        const fallback: StageSnapshot[] = [{
                            stage: parsed.stage ?? "E",
                            label: "Stage E — Monte Carlo",
                            data: parsed,
                            completedAt: parsed.timestamp,
                        }];
                        setStageSnapshots(fallback);
                        setActiveStage(parsed.stage ?? "E");
                        setActiveData(parsed);
                        setIsOverviewOpen(true);
                    }
                }

                setStatus("ready");
            })
            .catch(() => setStatus("notfound"));
    }, [token]);

    const handleStageSelect = (stage: string) => {
        const snapshot = stageSnapshots.find(s => s.stage === stage);
        if (snapshot) {
            setActiveStage(stage);
            setActiveData(snapshot.data);
        }
    };

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

            {/* Two-column layout */}
            <div className="flex">
                {/* Left column: conversation */}
                <div className="flex-1 min-w-0">
                    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
                        {/* Project Title Card */}
                        <div className="bg-white dark:bg-[#18181b] border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">
                                {conversation.title}
                            </h1>
                            <p className="text-sm text-gray-400">{formatDate(conversation.timestamp)}</p>
                        </div>

                        {/* Conversation */}
                        <div className="space-y-6">
                            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 px-1">Conversation</h2>

                            {conversation.messages.map((msg, i) => (
                                <div key={i} className={`flex gap-4 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
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

                {/* Right column: collapsible Overview panel */}
                {activeData && (
                    <div
                        className={`shrink-0 sticky top-[53px] h-[calc(100vh-53px)] transition-all duration-300 ease-in-out overflow-hidden border-l border-gray-200 dark:border-gray-800
                            ${isOverviewOpen ? "w-[400px] opacity-100" : "w-0 opacity-0 border-none"}`}
                    >
                        <ProjectOverview
                            data={activeData}
                            stageSnapshots={stageSnapshots}
                            activeStage={activeStage}
                            onStageSelect={handleStageSelect}
                            onClose={() => setIsOverviewOpen(false)}
                        />
                    </div>
                )}
            </div>

            {/* Floating re-open button when panel is closed */}
            {!isOverviewOpen && activeData && (
                <button
                    onClick={() => setIsOverviewOpen(true)}
                    className="fixed right-0 top-1/2 -translate-y-1/2 z-50 bg-primary text-white p-2 rounded-l-lg shadow-lg hover:bg-blue-700 transition-colors"
                    title="Show project overview"
                >
                    <ChevronLeft className="w-5 h-5" />
                </button>
            )}
        </div>
    );
}
