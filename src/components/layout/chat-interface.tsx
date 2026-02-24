"use client"

import { useState, useEffect, useRef } from 'react'
import { Paperclip, Send, AlertCircle, Bot, User, CheckCircle2, Loader2, PanelRightOpen, X, BarChart3 } from "lucide-react"
import JSZip from "jszip"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { ExportToolbar } from "@/components/ui/export-toolbar"

import { Message, Conversation, EstimationData } from "@/app/page"

interface ChatInterfaceProps {
    className?: string;
    onOpenDataPanel?: () => void;
    activeConversation?: Conversation;
    onUpdate: (id: string, messages: Message[], title?: string) => void;
    onCreate: (messages: Message[], title: string) => string;
    onChartDataDetected: (data: EstimationData) => void;
}

export function ChatInterface({ className, onOpenDataPanel, activeConversation, onUpdate, onCreate, onChartDataDetected }: ChatInterfaceProps) {
    const WELCOME_MESSAGE: Message = {
        role: "assistant",
        content: "Hello. I am Estimait, your construction estimation AI. Please describe your project (e.g., Warehouse, Healthcare, or Commercial) and upload relevant documents.",
    };

    const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE])
    const [input, setInput] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [isStreaming, setIsStreaming] = useState(false)
    const [thinkingStep, setThinkingStep] = useState(0)
    const [detectedType, setDetectedType] = useState<string | null>(null)
    const [processingLargeFiles, setProcessingLargeFiles] = useState(false)

    // Scroll anchor ref
    const messagesEndRef = useRef<HTMLDivElement>(null)

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }

    const messagesLength = messages.length;

    // Parse messages for Monte Carlo and Chart data
    useEffect(() => {
        if (messagesLength === 0) return;
        const lastMsg = messages[messagesLength - 1];
        if (lastMsg?.role === "assistant" && !isStreaming) {
            const content = lastMsg.content;

            // Problem 3: Robust Monte Carlo Parsing
            const p10Match = content.match(/P10[^\$]*\$([\d,]+)/i);
            const p50Match = content.match(/P50[^\$]*\$([\d,]+)/i);
            const p80Match = content.match(/P80[^\$]*\$([\d,]+)/i);

            const isMonteCarloComplete = /P50|Monte Carlo|ITERATIONS/i.test(content);

            // Gate: only show Monte Carlo panel after Stage E (final estimation) is complete
            const isStageEComplete = messages.some(m =>
                m.role === "assistant" && (
                    m.content.includes("Stage E") ||
                    m.content.includes("Monte Carlo") ||
                    m.content.includes("ITERATIONS") ||
                    m.content.includes("Final Cost Estimate") ||
                    m.content.includes("Probabilistic Estimate")
                )
            );

            if ((p50Match || isMonteCarloComplete) && isStageEComplete) {
                const parseNum = (s: string | undefined) => s ? parseFloat(s.replace(/,/g, '')) : 0;

                const p50 = parseNum(p50Match?.[1]);
                const p10 = p10Match ? parseNum(p10Match[1]) : p50 * 0.85;
                const p80 = p80Match ? parseNum(p80Match[1]) : p50 * 1.25;

                const gfaMatch = content.match(/(?:GFA|Area|Square Feet)[:\s]+([\d,]+)/i);
                const locationMatch = content.match(/Location[:\s]+([^\n]+)/i);
                const projectMatch = content.match(/Project[:\s]+([^\n]+)/i);

                const newData: EstimationData = {
                    projectName: projectMatch?.[1]?.trim(),
                    location: locationMatch?.[1]?.trim(),
                    gfa: gfaMatch?.[1]?.trim() ? `${gfaMatch[1]} SF` : undefined,
                    p10,
                    p50,
                    p80,
                    chartType: 'monte-carlo',
                    timestamp: Date.now()
                };

                // Histogram generation
                const mean = newData.p50;
                const stdDev = (newData.p80 - newData.p10) / 2.56 || p50 * 0.1;
                const histogram = [];
                for (let i = -3; i <= 3; i += 0.5) {
                    const c = mean + i * stdDev;
                    histogram.push({
                        cost: `$${Math.round(c / 1000000)}M`,
                        frequency: Math.floor(Math.exp(-0.5 * i * i) * 100)
                    });
                }
                newData.histogram = histogram;

                // Category Breakdown with Fallback
                const coreMatch = content.match(/Core[^\d%]*(\d+)%/i);
                const mepMatch = content.match(/MEP[^\d%]*(\d+)%/i);
                const interiorMatch = content.match(/Interior[^\d%]*(\d+)%/i);
                const otherMatch = content.match(/Other[^\d%]*(\d+)%/i);

                if (coreMatch || mepMatch || interiorMatch) {
                    newData.breakdown = [
                        { name: 'Core & Shell', value: p50 * (parseNum(coreMatch?.[1]) / 100 || 0.4) },
                        { name: 'MEP', value: p50 * (parseNum(mepMatch?.[1]) / 100 || 0.3) },
                        { name: 'Interior', value: p50 * (parseNum(interiorMatch?.[1]) / 100 || 0.2) },
                        { name: 'Other', value: p50 * (parseNum(otherMatch?.[1]) / 100 || 0.1) },
                    ];
                } else {
                    // Default fallback: 40/30/20/10
                    newData.breakdown = [
                        { name: 'Core & Shell', value: p50 * 0.4 },
                        { name: 'MEP', value: p50 * 0.3 },
                        { name: 'Interior', value: p50 * 0.2 },
                        { name: 'Other', value: p50 * 0.1 },
                    ];
                }

                // Risk Drivers Extraction
                const risks: string[] = [];
                const tableRegex = /\|(.+)\|.*\n\|(?:[\s-]*:?[\s-]*\|)+\n((?:\|.*\|\n?)+)/g;
                let m;
                while ((m = tableRegex.exec(content)) !== null) {
                    const rows = m[2].trim().split('\n');
                    rows.forEach(row => {
                        if (row.toLowerCase().includes('critical') || row.toLowerCase().includes('high')) {
                            const cells = row.split('|').map(c => c.trim()).filter(Boolean);
                            if (cells.length >= 2) risks.push(cells[0]);
                        }
                    });
                }
                if (risks.length > 0) newData.risks = risks;

                onChartDataDetected(newData);
                return;
            }

            // Fallback for other non-Monte Carlo charts (Tables/Lists)
            const tableRegex = /\|(.+)\|.*\n\|(?:[\s-]*:?[\s-]*\|)+\n((?:\|.*\|\n?)+)/g;
            const tableMatch = tableRegex.exec(content);

            if (tableMatch) {
                const headers = tableMatch[1].split('|').map(h => h.trim()).filter(Boolean);
                const rows = tableMatch[2].trim().split('\n').map(r => r.split('|').map(c => c.trim()).filter(Boolean));

                if (headers.length >= 2 && rows.length >= 2) {
                    const chartData = rows
                        .filter(r => Array.isArray(r) && r.length >= 2 && r[1] != null && r[1] !== '')
                        .map(r => ({
                            name: r[0],
                            value: parseFloat(r[1].replace(/[^\d.]/g, '')) || r[1]
                        }));

                    let sortedData = [...chartData];
                    const isTime = headers.some(h => /Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|Year|Month|Date|Quarter/i.test(h)) ||
                        rows.some(r => /Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/i.test(r[0]));

                    if (!isTime) {
                        sortedData.sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0));
                    }

                    onChartDataDetected({
                        chartType: isTime ? 'line' : 'bar',
                        chartData: sortedData,
                        p10: 0, p50: 0, p80: 0,
                        timestamp: Date.now()
                    });
                    return;
                }
            }

            const listRegex = /(?:^|\n)([\w\s&]+)[:\s]+(?:\$)?([\d,]+(?:\.\d+)?)(?:\s?[MKB]|%?)?/gi;
            const listMatches = [...content.matchAll(listRegex)];

            if (listMatches.length >= 3) {
                const chartData = listMatches.map(m => ({
                    name: m[1].trim(),
                    value: parseFloat(m[2].replace(/,/g, ''))
                })).slice(0, 8);

                const sortedData = chartData.sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0));

                onChartDataDetected({
                    chartType: 'pie',
                    chartData: sortedData,
                    p10: 0, p50: 0, p80: 0,
                    timestamp: Date.now()
                });
            }
        }
    }, [messagesLength, isStreaming]);

    // Sync state when activeConversation changes
    useEffect(() => {
        if (activeConversation) {
            setMessages(activeConversation.messages);
        } else {
            setMessages([WELCOME_MESSAGE]);
        }
        setAttachedFiles([]);
        setSessionFiles([]);
    }, [activeConversation]);

    // Current turn's pending attachment state (cleared after send)
    const [attachedFiles, setAttachedFiles] = useState<{ id: string; name: string; size: number; file: File | Blob }[]>([])
    const [uploadError, setUploadError] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Session-persistent files: accumulated across ALL turns so file context is never lost
    const [sessionFiles, setSessionFiles] = useState<{ name: string; blob: Blob | File }[]>([])

    const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200MB
    const TOTAL_LIMIT = 500 * 1024 * 1024; // 500MB
    const ACCEPTED_EXTENSIONS = ['.txt', '.md', '.yaml', '.py', '.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xlsx', '.xls', '.csv', '.jpg', '.jpeg', '.gif', '.png', '.webp', '.zip'];

    // Auto-scroll on content updates
    useEffect(() => {
        scrollToBottom()
    }, [messages, attachedFiles, isLoading, processingLargeFiles])

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        setUploadError(null);
        if (!e.target.files) return;

        const files = Array.from(e.target.files);
        const newAttached: typeof attachedFiles = [];
        let errorMsg = "";

        const currentTotal = attachedFiles.reduce((acc, f) => acc + f.size, 0);
        let potentialNewTotal = currentTotal;

        for (const f of files) {
            const ext = "." + f.name.slice((f.name.lastIndexOf(".") - 1 >>> 0) + 2).toLowerCase();

            if (f.name.includes('.') && !ACCEPTED_EXTENSIONS.includes(ext)) {
                errorMsg += `\nUnsupported file type: ${f.name}`;
                continue;
            }

            if (f.size > MAX_FILE_SIZE) {
                errorMsg += `\nFile too large (max 200MB): ${f.name}`;
                continue;
            }

            if (potentialNewTotal + f.size > TOTAL_LIMIT) {
                errorMsg += `\nTotal upload limit exceeded (max 500MB). Skipping: ${f.name}`;
                continue;
            }

            potentialNewTotal += f.size;
            newAttached.push({
                id: Math.random().toString(36).substring(7),
                name: f.name,
                size: f.size,
                file: f
            });
        }

        if (errorMsg) {
            setUploadError(errorMsg.trim());
        }

        setAttachedFiles(prev => [...prev, ...newAttached]);

        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    }

    const removeFile = (id: string) => {
        setAttachedFiles(prev => prev.filter(f => f.id !== id));
    }

    const formatSize = (bytes: number) => {
        if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
        if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return bytes + ' B';
    }

    const handleSend = async () => {
        if ((!input.trim() && attachedFiles.length === 0) || isLoading) return

        const userMsg = input.trim()
        setInput("")

        let extractedFiles: { name: string, blob: Blob | File }[] = [];
        let extractedFileNames: string[] = [];
        let errorMsg = "";

        for (const f of attachedFiles) {
            const ext = "." + f.name.slice((f.name.lastIndexOf(".") - 1 >>> 0) + 2).toLowerCase();
            if (ext === '.zip') {
                try {
                    const zip = await JSZip.loadAsync(f.file);
                    for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
                        if (zipEntry.dir) continue;
                        const extractedExt = "." + relativePath.slice((relativePath.lastIndexOf(".") - 1 >>> 0) + 2).toLowerCase();
                        if (relativePath.includes('.') && !ACCEPTED_EXTENSIONS.includes(extractedExt)) continue;

                        const blob = await zipEntry.async("blob");
                        if (blob.size > MAX_FILE_SIZE) {
                            errorMsg += `Extracted file too large: ${relativePath}. `;
                            continue;
                        }
                        extractedFileNames.push(relativePath);
                        extractedFiles.push({ name: relativePath, blob });
                    }
                } catch (err) {
                    errorMsg += `Failed to read ZIP: ${f.name}. `;
                }
            } else {
                extractedFileNames.push(f.name);
                extractedFiles.push({ name: f.name, blob: f.file });
            }
        }

        if (errorMsg) {
            setUploadError(errorMsg.trim());
        }

        const displayAttachments = attachedFiles.map(f => ({ name: f.name, size: f.size }));
        const apiMsgContent = userMsg
            + (extractedFileNames.length > 0 ? `\n\n[Attached Files: ${extractedFileNames.join(', ')}]` : '');

        // Merge newly extracted files into the persistent session store
        const newSessionFiles = extractedFiles.filter(
            nf => !sessionFiles.some(sf => sf.name === nf.name)
        ).map(f => ({ name: f.name, blob: f.blob }));
        const updatedSessionFiles = [...sessionFiles, ...newSessionFiles];
        setSessionFiles(updatedSessionFiles);

        setMessages(prev => [...prev, {
            role: "user",
            content: userMsg,
            attachments: displayAttachments
        }])
        setAttachedFiles([])
        setUploadError(null)
        setIsLoading(true)

        // Show processing message if any file is > 50MB, total is significant, or there is a PDF
        const isLarge = extractedFiles.some(f => f.blob.size > 50 * 1024 * 1024 || f.name.toLowerCase().endsWith('.pdf')) || extractedFiles.length > 5;
        setProcessingLargeFiles(isLarge);

        // Simple heuristic to detect building type for dynamic injection
        let bType = detectedType;
        if (!bType) {
            const lowMsg = userMsg.toLowerCase();
            if (lowMsg.includes("warehouse") || lowMsg.includes("logistic") || lowMsg.includes("distribution")) bType = "warehouse";
            else if (lowMsg.includes("healthcare") || lowMsg.includes("medical") || lowMsg.includes("hospital")) bType = "healthcare";
            else if (lowMsg.includes("commercial") || lowMsg.includes("office")) bType = "commercial";

            if (bType) setDetectedType(bType);
        }

        // Upload new files to Vercel Blob Storage first, then pass URLs to /api/chat
        // Only upload files that are not already in the session (avoid re-uploading)
        const newlyUploadedBlobUrls: { url: string; name: string; size: number }[] = [];
        let currentTurnUploadFailed = false;
        for (const f of newSessionFiles) {
            try {
                const uploadForm = new FormData();
                uploadForm.append("file", f.blob, f.name);
                const uploadRes = await fetch("/api/upload", { method: "POST", body: uploadForm });
                if (uploadRes.ok) {
                    const uploadData = await uploadRes.json();
                    if (uploadData.success) {
                        newlyUploadedBlobUrls.push({ url: uploadData.url, name: f.name, size: (f.blob as Blob).size });
                    } else {
                        console.error(`[Upload] Server rejected ${f.name}:`, uploadData.error);
                        currentTurnUploadFailed = true;
                    }
                } else {
                    console.error(`[Upload] HTTP error for ${f.name}:`, uploadRes.status);
                    currentTurnUploadFailed = true;
                }
            } catch (err) {
                console.error(`[Upload] Failed to upload ${f.name} to Blob:`, err);
                currentTurnUploadFailed = true;
            }
        }

        // If any file in this turn failed to upload, abort and show error to user
        if (currentTurnUploadFailed) {
            setUploadError("File upload failed. Please check your connection and try again.");
            setIsLoading(false);
            setProcessingLargeFiles(false);
            return;
        }

        // Merge blob URLs into session (persist across turns)
        const previousBlobUrls = (sessionFiles as any[]).filter((sf: any) => sf.blobUrl).map((sf: any) => ({ url: sf.blobUrl, name: sf.name, size: sf.size || 0 }));
        const updatedBlobUrls = [
            ...previousBlobUrls,
            ...newlyUploadedBlobUrls
        ];

        // Update session files to include blob URLs for persistence
        const updatedSessionFilesWithBlob = updatedSessionFiles.map(sf => {
            const blobEntry = newlyUploadedBlobUrls.find(b => b.name === sf.name);
            return blobEntry ? { ...sf, blobUrl: blobEntry.url, size: blobEntry.size } : sf;
        });
        setSessionFiles(updatedSessionFilesWithBlob as any);

        const formData = new FormData();
        formData.append("message", apiMsgContent);
        formData.append("history", JSON.stringify(messages));
        if (bType) formData.append("buildingType", bType);

        // Always pass blob URLs to /api/chat (no raw binary transfer)
        if (updatedBlobUrls.length > 0) {
            formData.append("blobUrls", JSON.stringify(updatedBlobUrls));
        }

        try {
            // Start thinking panel animation
            setThinkingStep(0);
            const THINKING_STEPS = [
                "Reading project documents",
                "Extracting project data",
                "Assessing structural system",
                "Calculating quantities",
                "Running cost model",
            ];
            // Advance through steps every 900ms until first token
            let stepIdx = 0;
            const stepTimer = setInterval(() => {
                stepIdx = Math.min(stepIdx + 1, THINKING_STEPS.length - 1);
                setThinkingStep(stepIdx);
            }, 900);

            const res = await fetch("/api/chat", { method: "POST", body: formData });

            if (!res.ok || !res.body) {
                clearInterval(stepTimer);
                const errData = await res.json().catch(() => ({ error: 'Unknown error' }));
                const errorMsg: Message = { role: "assistant", content: `Error: ${errData.error}` };
                setMessages(prev => [...prev, errorMsg]);

                // Update parent state with the error message
                const finalMsgs = [...messages, { role: "user", content: userMsg, attachments: displayAttachments } as Message, errorMsg];
                if (activeConversation) {
                    onUpdate(activeConversation.id, finalMsgs);
                } else {
                    onCreate(finalMsgs, userMsg.slice(0, 40) + (userMsg.length > 40 ? "..." : ""));
                }
                return;
            }

            // Start streaming — add empty assistant message to fill in real-time
            clearInterval(stepTimer);
            setIsStreaming(true);
            setThinkingStep(THINKING_STEPS.length); // mark all done
            setMessages(prev => [...prev, { role: "assistant", content: "" }]);

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";
            let fullAssistantResponse = "";

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
                            fullAssistantResponse += event.text;
                            setMessages(prev => {
                                const msgs = [...prev];
                                const last = msgs[msgs.length - 1];
                                if (last?.role === "assistant") {
                                    msgs[msgs.length - 1] = { ...last, content: last.content + event.text };
                                }
                                return msgs;
                            });
                        } else if (event.type === "error") {
                            const errorMsg = `\n\n[Error: ${event.error}]`;
                            fullAssistantResponse += errorMsg;
                            setMessages(prev => {
                                const msgs = [...prev];
                                const last = msgs[msgs.length - 1];
                                if (last?.role === "assistant") {
                                    msgs[msgs.length - 1] = { ...last, content: last.content + errorMsg };
                                }
                                return msgs;
                            });
                        }
                    } catch { /* ignore parse errors */ }
                }
            }

            // After stream finishes, sync with parent state
            const assistantMsg: Message = { role: "assistant", content: fullAssistantResponse };
            const finalMsgs = [...messages, { role: "user", content: userMsg, attachments: displayAttachments } as Message, assistantMsg];

            if (activeConversation) {
                onUpdate(activeConversation.id, finalMsgs);
            } else {
                // Generate a title from the first user message
                const title = userMsg.length > 50 ? userMsg.slice(0, 50).trim() + "..." : userMsg;
                onCreate(finalMsgs, title);
            }

        } catch (err: any) {
            const errorMsg: Message = { role: "assistant", content: `Failed to connect: ${err.message}` };
            setMessages(prev => [...prev, errorMsg]);

            const finalMsgs = [...messages, { role: "user", content: userMsg, attachments: displayAttachments } as Message, errorMsg];
            if (activeConversation) {
                onUpdate(activeConversation.id, finalMsgs);
            } else {
                onCreate(finalMsgs, userMsg.slice(0, 40) + "...");
            }
        } finally {
            setIsLoading(false);
            setIsStreaming(false);
            setThinkingStep(0);
            setProcessingLargeFiles(false);
        }
    }

    return (
        <div className={`h-full max-h-full flex flex-col bg-background overflow-hidden ${className}`}>
            {/* Header */}
            <div className="h-14 border-b border-panel-border flex items-center px-6 shrink-0 bg-white/50 dark:bg-black/50 backdrop-blur-md">
                <h1 className="font-medium text-gray-900 dark:text-gray-100 truncate">
                    {activeConversation?.title || "New Project Estimation"}
                </h1>
            </div>

            {/* Chat Area - ensuring min-h-0 for proper flex overflow behavior */}
            <div id="chat-scroll-area" className="flex-1 overflow-y-auto p-6 scroll-smooth min-h-0">
                <div id="pdf-content" className="space-y-6">
                    {messages.map((msg, i) => (
                        <div key={i} className={`flex gap-4 max-w-3xl mx-auto ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                            {/* Avatar */}
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'assistant' ? 'bg-primary text-white' : 'bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
                                }`}>
                                {msg.role === 'assistant' ? <Bot className="w-5 h-5" /> : <User className="w-5 h-5" />}
                            </div>

                            {/* Message Bubble */}
                            <div className={`flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                <div className="text-xs text-gray-500 font-medium px-1">
                                    {msg.role === 'assistant' ? 'Estimait AI' : 'You'}
                                </div>
                                <div className={`flex flex-col gap-2 w-full max-w-[85%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                    {msg.content && (
                                        <div className={`py-3 px-4 rounded-2xl ${msg.role === 'user'
                                            ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 inline-block whitespace-pre-wrap'
                                            : 'text-gray-800 dark:text-gray-200 w-full'
                                            }`}>
                                            {msg.role === 'assistant' ? (
                                                <ReactMarkdown
                                                    remarkPlugins={[remarkGfm]}
                                                    components={{
                                                        h1: ({ children }) => <h1 className="text-xl font-bold mt-4 mb-2 text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700 pb-1">{children}</h1>,
                                                        h2: ({ children }) => <h2 className="text-lg font-bold mt-4 mb-2 text-gray-900 dark:text-gray-100">{children}</h2>,
                                                        h3: ({ children }) => <h3 className="text-base font-semibold mt-3 mb-1.5 text-gray-800 dark:text-gray-200">{children}</h3>,
                                                        p: ({ children }) => <div className="mb-3 leading-relaxed last:mb-0">{children}</div>,
                                                        ul: ({ children }) => <ul className="list-disc list-outside pl-5 mb-3 space-y-1">{children}</ul>,
                                                        ol: ({ children }) => <ol className="list-decimal list-outside pl-5 mb-3 space-y-1">{children}</ol>,
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
                                                        th: ({ children }) => <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left font-semibold text-gray-800 dark:text-gray-200">{children}</th>,
                                                        td: ({ children }) => <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-gray-700 dark:text-gray-300">{children}</td>,
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
                                        <div className={`flex flex-wrap gap-1.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                            {msg.attachments.map((att, idx) => (
                                                <div key={idx} className="flex items-center gap-1.5 bg-white dark:bg-[#18181b] border border-gray-200 dark:border-gray-800 shadow-sm rounded-lg px-2.5 py-1.5 text-xs transition-all">
                                                    <Paperclip className="w-3.5 h-3.5 text-gray-400" />
                                                    <span className="truncate max-w-[150px] font-medium text-gray-700 dark:text-gray-300">
                                                        {att.name}
                                                    </span>
                                                    <span className="text-gray-400 font-mono">
                                                        ({formatSize(att.size)})
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}

                    {/* Export Toolbar - shows only after Stage F (Final Recommendation) */}
                    {(() => {
                        const isFinalStageComplete = messages.some(m =>
                            m.role === 'assistant' && (
                                m.content.includes('Stage F') ||
                                m.content.includes('Final Report & Recommendation') ||
                                m.content.includes('最終摘要') ||
                                m.content.includes('Estimation Complete') ||
                                m.content.includes('Full report is ready')
                            )
                        );

                        if (!isFinalStageComplete) return null;

                        return (
                            <div className="max-w-3xl mx-auto w-full space-y-3">
                                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold px-4 py-2 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-xl">
                                    <CheckCircle2 className="w-5 h-5" />
                                    <span>✅ 估算完成 — 請下載您的最終報告</span>
                                </div>
                                <ExportToolbar
                                    messages={messages}
                                    projectName={messages[0]?.content.slice(0, 30) || "Project-Estimate"}
                                />
                            </div>
                        );
                    })()}

                    {isLoading && !isStreaming && (() => {
                        const STEPS = [
                            "Reading project documents",
                            "Extracting project data",
                            "Assessing structural system",
                            "Calculating quantities",
                            "Running cost model",
                        ];
                        return (
                            <div className="flex gap-4 max-w-3xl mx-auto">
                                <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center shrink-0 mt-1">
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                </div>
                                <div className="border border-gray-200 dark:border-gray-700 rounded-2xl bg-white dark:bg-gray-900 shadow-sm px-5 py-4 min-w-[260px]">
                                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 tracking-wide uppercase">🔍 Estimait is analyzing...</p>
                                    {processingLargeFiles && (
                                        <p className="text-[11px] font-medium text-blue-600 dark:text-blue-400 mb-3 flex items-center gap-1.5 animate-pulse">
                                            {attachedFiles.some(f => f.name.toLowerCase().endsWith('.pdf'))
                                                ? "📄 Large PDF detected — splitting into chunks for processing..."
                                                : "📄 Processing large files... this may take 1-2 minutes"}
                                        </p>
                                    )}
                                    <div className="space-y-2">
                                        {STEPS.map((step, idx) => {
                                            const isDone = thinkingStep > idx;
                                            const isActive = thinkingStep === idx;
                                            return (
                                                <div key={idx} className={`flex items-center gap-2.5 text-sm transition-all duration-300 ${isDone ? 'text-green-600 dark:text-green-400' : isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-300 dark:text-gray-600'}`}>
                                                    <span className="w-4 text-center shrink-0 text-base leading-none">
                                                        {isDone ? '✅' : isActive ? '⏳' : '○'}
                                                    </span>
                                                    <span className={isActive ? 'font-medium' : ''}>{step}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        );
                    })()}

                    {/* Dynamic Injection Indicator */}
                    {detectedType && !isLoading && (
                        <div className="max-w-3xl mx-auto border border-blue-100 dark:border-blue-900/30 rounded-xl bg-blue-50/50 dark:bg-blue-900/10 overflow-hidden mt-4">
                            <div className="px-4 py-3 flex items-center gap-2 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                                <CheckCircle2 className="w-4 h-4 text-blue-500" />
                                <span className="text-sm font-medium text-blue-700 dark:text-blue-400 select-none">
                                    Injected Layer 2 Configuration for: {detectedType.toUpperCase()}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Scroll Anchor */}
                    <div ref={messagesEndRef} className="h-2" />

                </div>
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white dark:bg-[#09090b] border-t border-panel-border shrink-0">
                <div className="max-w-3xl mx-auto flex flex-col gap-2">

                    {/* Upload Error banner */}
                    {uploadError && (
                        <div className="p-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-600 dark:text-red-400 flex items-start gap-2 max-w-3xl mx-auto w-full">
                            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                            <p className="whitespace-pre-wrap font-medium flex-1">{uploadError}</p>
                            <button onClick={() => setUploadError(null)} className="ml-auto p-1 -mr-1 text-red-400 hover:text-red-600 transition-colors">
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    )}

                    {/* Attached Files tags */}
                    {attachedFiles.length > 0 && (
                        <div className="max-h-[120px] overflow-y-auto mb-4 pr-1 custom-scrollbar">
                            <div className="flex flex-wrap gap-2 max-w-3xl mx-auto w-full">
                                {attachedFiles.map(f => (
                                    <div key={f.id} className="flex items-center gap-2 bg-white dark:bg-[#18181b] border border-gray-200 dark:border-gray-800 shadow-sm rounded-lg px-2.5 py-1.5 text-sm transition-all hover:border-gray-300 dark:hover:border-gray-700">
                                        <span className="truncate max-w-[200px] font-medium text-gray-700 dark:text-gray-300">
                                            {f.name}
                                        </span>
                                        <span className="text-xs text-gray-400 font-mono italic">
                                            ({formatSize(f.size)})
                                        </span>
                                        <button
                                            onClick={() => removeFile(f.id)}
                                            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 ml-0.5 p-0.5 rounded transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="relative flex items-end gap-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-2 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-all">

                        {/* Hidden file input */}
                        <input
                            type="file"
                            multiple
                            ref={fileInputRef}
                            onChange={handleFileSelect}
                            className="hidden"
                            accept=".txt,.md,.yaml,.py,.pdf,.doc,.docx,.ppt,.pptx,.xlsx,.xls,.csv,.jpg,.jpeg,.gif,.png,.webp,.zip"
                        />

                        {/* File Upload Button */}
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-xl transition-colors shrink-0"
                            title="Upload files"
                        >
                            <Paperclip className="w-5 h-5" />
                        </button>

                        {/* Text Input */}
                        <textarea
                            id="chat-input"
                            name="chat-input"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                            className="flex-1 max-h-48 min-h-[44px] bg-transparent border-none focus:ring-0 resize-none py-3 px-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 outline-none"
                            placeholder="Ask Estimait to estimate a warehouse..."
                            rows={1}
                        />

                        {/* Send Button */}
                        <button
                            onClick={handleSend}
                            disabled={isLoading || (!input.trim() && attachedFiles.length === 0)}
                            className="p-3 bg-primary text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0 mb-0.5"
                        >
                            <Send className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="flex justify-between items-center mt-2 px-2">
                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span>AI can make mistakes. Verify important estimates.</span>
                        </div>
                        <div className="text-xs text-gray-500">
                            Accepted: txt, md, yaml, py, pdf, docx, pptx, xlsx, csv, jpg, png, zip
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
