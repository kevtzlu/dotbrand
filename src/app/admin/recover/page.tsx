"use client"

import { useState } from "react"
import { Search, UserCheck, AlertCircle, CheckCircle2, Loader2, ArrowLeft, MessageSquare, User, Clock, LayoutGrid } from "lucide-react"
import Link from "next/link"

interface ConversationPreview {
    id: string
    title: string
    timestamp: number
    messageCount: number
    currentUserId: string | null
    stageSnapshotCount: number
}

type AssignStatus = "idle" | "loading" | "success" | "error"

export default function RecoverPage() {
    const [conversationId, setConversationId] = useState("")
    const [userId, setUserId] = useState("")
    const [preview, setPreview] = useState<ConversationPreview | null>(null)
    const [searchLoading, setSearchLoading] = useState(false)
    const [searchError, setSearchError] = useState("")
    const [assignStatus, setAssignStatus] = useState<AssignStatus>("idle")
    const [assignError, setAssignError] = useState("")
    const [assignedTo, setAssignedTo] = useState("")

    const handleSearch = async () => {
        if (!conversationId.trim()) return
        setSearchLoading(true)
        setSearchError("")
        setPreview(null)
        setAssignStatus("idle")
        setAssignError("")
        setAssignedTo("")
        try {
            const res = await fetch(`/api/admin/recover?conversation_id=${encodeURIComponent(conversationId.trim())}`)
            const data = await res.json()
            if (!res.ok) {
                setSearchError(data.error || "查詢失敗")
                return
            }
            setPreview(data.conversation)
        } catch (e: any) {
            setSearchError(e.message || "查詢時發生錯誤")
        } finally {
            setSearchLoading(false)
        }
    }

    const handleAssign = async () => {
        if (!preview || !userId.trim()) return
        setAssignStatus("loading")
        setAssignError("")
        try {
            const res = await fetch("/api/admin/recover", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    conversation_id: preview.id,
                    user_id: userId.trim(),
                }),
            })
            const data = await res.json()
            if (!res.ok) {
                setAssignError(data.error || "指派失敗")
                setAssignStatus("error")
                return
            }
            setAssignedTo(data.assigned_to)
            setAssignStatus("success")
            setPreview(prev => prev ? { ...prev, currentUserId: data.assigned_to } : prev)
        } catch (e: any) {
            setAssignError(e.message || "指派時發生錯誤")
            setAssignStatus("error")
        }
    }

    const formatTime = (timestamp: number) => {
        return new Date(timestamp).toLocaleString("zh-TW", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
        })
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-[#09090b] py-10 px-4">
            <div className="max-w-2xl mx-auto space-y-6">
                {/* Back link */}
                <Link
                    href="/"
                    className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    返回 Estimait
                </Link>

                {/* Header card */}
                <div className="bg-white dark:bg-[#18181b] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
                    <div className="px-8 py-6 border-b border-gray-100 dark:border-gray-800">
                        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">對話復原工具</h1>
                        <p className="text-sm text-gray-500 mt-1">透過 Conversation ID 查詢對話，並將其指派給指定使用者。</p>
                    </div>

                    <div className="px-8 py-6 space-y-6">
                        {/* Step 1: Search */}
                        <div className="space-y-3">
                            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center font-bold">1</span>
                                查詢對話
                            </h2>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={conversationId}
                                    onChange={e => setConversationId(e.target.value)}
                                    onKeyDown={e => { if (e.key === "Enter") handleSearch() }}
                                    placeholder="輸入 Conversation ID（例如：abc123）"
                                    className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all font-mono"
                                />
                                <button
                                    onClick={handleSearch}
                                    disabled={searchLoading || !conversationId.trim()}
                                    className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                                >
                                    {searchLoading
                                        ? <Loader2 className="w-4 h-4 animate-spin" />
                                        : <Search className="w-4 h-4" />
                                    }
                                    查詢
                                </button>
                            </div>

                            {/* Search error */}
                            {searchError && (
                                <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-600 dark:text-red-400">
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    {searchError}
                                </div>
                            )}
                        </div>

                        {/* Preview */}
                        {preview && (
                            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-4 space-y-3">
                                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 truncate">{preview.title || "(無標題)"}</h3>
                                <div className="grid grid-cols-2 gap-3 text-xs text-gray-500 dark:text-gray-400">
                                    <div className="flex items-center gap-1.5">
                                        <Clock className="w-3.5 h-3.5 shrink-0" />
                                        <span>{formatTime(preview.timestamp)}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                                        <span>{preview.messageCount} 則訊息</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <LayoutGrid className="w-3.5 h-3.5 shrink-0" />
                                        <span>{preview.stageSnapshotCount} 個 Stage 快照</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <User className="w-3.5 h-3.5 shrink-0" />
                                        {preview.currentUserId ? (
                                            <span className="font-mono truncate text-amber-600 dark:text-amber-400">{preview.currentUserId}</span>
                                        ) : (
                                            <span className="text-gray-400 italic">尚未指派</span>
                                        )}
                                    </div>
                                </div>
                                <div className="pt-1 border-t border-gray-200 dark:border-gray-700">
                                    <p className="text-[11px] text-gray-400 font-mono">ID: {preview.id}</p>
                                </div>
                            </div>
                        )}

                        {/* Step 2: Assign */}
                        {preview && (
                            <div className="space-y-3">
                                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                    <span className="w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center font-bold">2</span>
                                    指派給使用者
                                </h2>

                                {assignStatus === "success" ? (
                                    <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl text-sm text-green-700 dark:text-green-400">
                                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                                        <span>已成功指派給 <span className="font-mono font-semibold">{assignedTo}</span></span>
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={userId}
                                                onChange={e => setUserId(e.target.value)}
                                                onKeyDown={e => { if (e.key === "Enter") handleAssign() }}
                                                placeholder="輸入 User ID（例如：user_xxxxxxxxx）"
                                                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all font-mono"
                                            />
                                            <button
                                                onClick={handleAssign}
                                                disabled={assignStatus === "loading" || !userId.trim()}
                                                className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                                            >
                                                {assignStatus === "loading"
                                                    ? <Loader2 className="w-4 h-4 animate-spin" />
                                                    : <UserCheck className="w-4 h-4" />
                                                }
                                                指派
                                            </button>
                                        </div>

                                        {assignError && (
                                            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-600 dark:text-red-400">
                                                <AlertCircle className="w-4 h-4 shrink-0" />
                                                {assignError}
                                            </div>
                                        )}
                                    </>
                                )}

                                {/* Re-assign after success */}
                                {assignStatus === "success" && (
                                    <button
                                        onClick={() => {
                                            setAssignStatus("idle")
                                            setUserId("")
                                            setAssignError("")
                                        }}
                                        className="text-xs text-primary hover:underline"
                                    >
                                        重新指派給其他使用者
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Admin note */}
                <p className="text-xs text-center text-gray-400">
                    此頁面僅限管理員存取。未授權的請求將被 API 拒絕（403）。
                </p>
            </div>
        </div>
    )
}
