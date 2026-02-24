"use client"

import { useState, useEffect } from "react";
import { MessageSquare, PlusCircle, Settings, Box, PanelLeftClose, Pencil, Check, X, MoreVertical, Trash2 } from "lucide-react";
import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { Conversation } from "@/app/page";

interface SidebarProps {
    className?: string;
    onClose?: () => void;
    history: Conversation[];
    activeId: string | null;
    onSelect: (id: string) => void;
    onNewChat: () => void;
    onRename: (id: string, newTitle: string) => void;
    onDelete: (id: string) => void;
}

export function Sidebar({ className, onClose, history, activeId, onSelect, onNewChat, onRename, onDelete }: SidebarProps) {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState("");
    const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

    const handleStartEdit = (conv: Conversation) => {
        setEditingId(conv.id);
        setEditValue(conv.title);
        setMenuOpenId(null);
    };

    const handleSaveEdit = (id: string) => {
        if (editValue.trim()) {
            onRename(id, editValue.trim());
        }
        setEditingId(null);
    };

    const handleDelete = (id: string) => {
        if (window.confirm("Are you sure you want to delete this estimate? This action cannot be undone.")) {
            onDelete(id);
        }
        setMenuOpenId(null);
    };

    const formatTime = (timestamp: number) => {
        const now = Date.now();
        const diff = now - timestamp;
        if (diff < 60000) return "Just now";
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return new Date(timestamp).toLocaleDateString();
    };

    // Close menu when clicking elsewhere
    useEffect(() => {
        const handleClick = () => setMenuOpenId(null);
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    return (
        <div className={`h-full bg-sidebar flex flex-col border-r border-sidebar-border ${className}`}>
            {/* Header */}
            <div className="p-4 flex items-center justify-between border-b border-sidebar-border">
                <div className="flex items-center gap-2 font-semibold text-lg tracking-tight">
                    <Box className="w-5 h-5 text-primary" />
                    <span>Estimait</span>
                </div>
                {onClose && (
                    <button onClick={onClose} className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5 text-gray-400 hover:text-gray-600 transition-colors">
                        <PanelLeftClose className="w-5 h-5" />
                    </button>
                )}
            </div>

            {/* New Chat Button */}
            <div className="p-4">
                <button
                    onClick={onNewChat}
                    className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm"
                >
                    <PlusCircle className="w-4 h-4" />
                    New Estimate
                </button>
            </div>

            {/* History List */}
            <div className="flex-1 overflow-y-auto px-2 pb-4">
                <div className="text-xs font-semibold text-gray-500 mb-2 px-2">RECENT</div>
                <div className="space-y-1">
                    {history.length === 0 ? (
                        <div className="text-xs text-gray-400 px-3 py-4 italic">No history yet</div>
                    ) : (
                        history.map((item) => (
                            <div key={item.id} className="relative group">
                                {editingId === item.id ? (
                                    <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-[#18181b] rounded-md border border-primary shadow-sm mx-1">
                                        <input
                                            autoFocus
                                            className="flex-1 bg-transparent border-none focus:ring-0 text-sm outline-none"
                                            value={editValue}
                                            onChange={(e) => setEditValue(e.target.value)}
                                            onBlur={() => handleSaveEdit(item.id)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") handleSaveEdit(item.id);
                                                if (e.key === "Escape") setEditingId(null);
                                            }}
                                        />
                                        <button onClick={() => handleSaveEdit(item.id)} className="text-green-500 hover:text-green-600">
                                            <Check className="w-4 h-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="relative">
                                        <button
                                            onClick={() => onSelect(item.id)}
                                            className={`w-full text-left px-3 py-2.5 rounded-md transition-all flex items-start gap-3 pr-8 ${activeId === item.id
                                                ? "bg-white dark:bg-[#18181b] text-primary shadow-sm border-l-2 border-primary"
                                                : "hover:bg-black/5 dark:hover:bg-white/5 text-gray-600 dark:text-gray-400"
                                                }`}
                                        >
                                            <MessageSquare className={`w-4 h-4 mt-0.5 shrink-0 ${activeId === item.id ? "text-primary" : "text-gray-400"}`} />
                                            <div className="overflow-hidden flex-1">
                                                <div className={`text-sm font-medium truncate ${activeId === item.id ? "text-gray-900 dark:text-white" : ""}`}>
                                                    {item.title}
                                                </div>
                                                <div className="text-[10px] uppercase tracking-wider opacity-60 mt-0.5">{formatTime(item.timestamp)}</div>
                                            </div>
                                        </button>

                                        {/* Context Menu Trigger */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setMenuOpenId(menuOpenId === item.id ? null : item.id);
                                            }}
                                            className={`absolute right-1 top-1/2 -translate-y-1/2 p-1.5 rounded-md transition-all z-10 ${menuOpenId === item.id
                                                ? "opacity-100 bg-white dark:bg-gray-800 shadow-sm"
                                                : "opacity-0 group-hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5"
                                                } text-gray-400 hover:text-gray-600 dark:hover:text-gray-200`}
                                        >
                                            <MoreVertical className="w-4 h-4" />
                                        </button>

                                        {/* Dropdown Menu */}
                                        {menuOpenId === item.id && (
                                            <div
                                                className="absolute right-0 top-full mt-1 w-36 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-xl z-20 overflow-hidden py-1 scale-in-center"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <button
                                                    onClick={() => handleStartEdit(item)}
                                                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                                                >
                                                    <Pencil className="w-3.5 h-3.5 text-blue-500" />
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(item.id)}
                                                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                    Delete
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Footer / Settings */}
            <div className="p-4 border-t border-sidebar-border flex items-center justify-between gap-2">
                <Link href="/settings" className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200 transition-colors">
                    <Settings className="w-4 h-4" />
                    Settings
                </Link>
                <UserButton afterSignOutUrl="/sign-in" />
            </div>
        </div>
    );
}
