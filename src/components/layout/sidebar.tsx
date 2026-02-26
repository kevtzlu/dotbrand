"use client"

import { useState, useEffect, useRef } from "react";
import { MessageSquare, PlusCircle, Box, PanelLeftClose, Pencil, Check, X, MoreVertical, Trash2, Building2, MapPin, Percent, Upload, Save, CheckCircle2, AlertCircle, Loader2, ChevronDown } from "lucide-react";
import { SignOutButton, useUser } from "@clerk/nextjs";
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

interface GCProfile {
    company_name: string;
    hq_address: string;
    logo_url: string;
    contingency_pct: number;
    fee_pct: number;
}

function ProfileModal({ onClose }: { onClose: () => void }) {
    const { user } = useUser();
    const [activeTab, setActiveTab] = useState<"account" | "company">("account");
    const [profile, setProfile] = useState<GCProfile>({
        company_name: "",
        hq_address: "",
        logo_url: "",
        contingency_pct: 10,
        fee_pct: 5,
    });
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isUploadingLogo, setIsUploadingLogo] = useState(false);
    const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
    const [errorMsg, setErrorMsg] = useState("");
    const logoInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const res = await fetch("/api/profile");
                if (res.ok) {
                    const data = await res.json();
                    if (data.profile) {
                        setProfile({
                            company_name: data.profile.company_name || "",
                            hq_address: data.profile.hq_address || "",
                            logo_url: data.profile.logo_url || "",
                            contingency_pct: data.profile.contingency_pct ?? 10,
                            fee_pct: data.profile.fee_pct ?? 5,
                        });
                    }
                }
            } catch (e) {
                console.error("Failed to load profile", e);
            } finally {
                setIsLoading(false);
            }
        };
        fetchProfile();
    }, []);

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsUploadingLogo(true);
        setErrorMsg("");
        try {
            const formData = new FormData();
            formData.append("file", file);
            const res = await fetch("/api/upload", { method: "POST", body: formData });
            if (res.ok) {
                const data = await res.json();
                if (data.success) {
                    setProfile(prev => ({ ...prev, logo_url: data.url }));
                } else {
                    setErrorMsg("Logo upload failed: " + data.error);
                }
            } else {
                setErrorMsg("Logo upload failed (HTTP " + res.status + ")");
            }
        } catch (err: any) {
            setErrorMsg("Logo upload error: " + err.message);
        } finally {
            setIsUploadingLogo(false);
            if (logoInputRef.current) logoInputRef.current.value = "";
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        setSaveStatus("idle");
        setErrorMsg("");
        try {
            const res = await fetch("/api/profile", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(profile),
            });
            if (res.ok) {
                setSaveStatus("success");
                setTimeout(() => setSaveStatus("idle"), 3000);
            } else {
                const data = await res.json();
                setErrorMsg(data.error || "Save failed");
                setSaveStatus("error");
            }
        } catch (err: any) {
            setErrorMsg(err.message);
            setSaveStatus("error");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-start p-4" onClick={onClose}>
            <div
                className="w-80 bg-white dark:bg-[#18181b] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-2xl overflow-hidden mb-2 ml-1"
                onClick={e => e.stopPropagation()}
            >
                {/* Tabs */}
                <div className="flex border-b border-gray-100 dark:border-gray-800">
                    <button
                        onClick={() => setActiveTab("account")}
                        className={`flex-1 py-3 text-xs font-semibold transition-colors ${activeTab === "account" ? "text-primary border-b-2 border-primary" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"}`}
                    >
                        Account
                    </button>
                    <button
                        onClick={() => setActiveTab("company")}
                        className={`flex-1 py-3 text-xs font-semibold transition-colors ${activeTab === "company" ? "text-primary border-b-2 border-primary" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"}`}
                    >
                        Company Profile
                    </button>
                </div>

                {activeTab === "account" ? (
                    <div className="p-4 flex flex-col gap-2">
                        <div className="px-2 py-1.5 text-xs text-gray-500 border-b border-gray-100 dark:border-gray-800 mb-1">
                            {user?.primaryEmailAddress?.emailAddress || ""}
                        </div>
                        <button
                            onClick={() => {
                                const url = user?.primaryEmailAddress?.emailAddress
                                    ? `mailto:${user.primaryEmailAddress.emailAddress}`
                                    : undefined;
                                window.location.href = "/user-profile#password";
                            }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
                        >
                            Update password
                        </button>
                        <SignOutButton redirectUrl="/sign-in">
                            <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left">
                                Sign out
                            </button>
                        </SignOutButton>
                        <button
                            onClick={async () => {
                                if (window.confirm("Are you sure you want to delete your account? This cannot be undone.")) {
                                    await user?.delete();
                                    window.location.href = "/sign-in";
                                }
                            }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-left"
                        >
                            Delete account
                        </button>
                    </div>
                ) : (
                    <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
                        {isLoading ? (
                            <div className="flex justify-center py-6">
                                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                            </div>
                        ) : (
                            <>
                                {/* Company Name */}
                                <div className="space-y-1.5">
                                    <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300">
                                        <Building2 className="w-3.5 h-3.5 text-primary" /> Company Name
                                    </label>
                                    <input
                                        type="text"
                                        value={profile.company_name}
                                        onChange={e => setProfile(prev => ({ ...prev, company_name: e.target.value }))}
                                        placeholder="Acme Construction Inc."
                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                                    />
                                </div>

                                {/* HQ Address */}
                                <div className="space-y-1.5">
                                    <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300">
                                        <MapPin className="w-3.5 h-3.5 text-primary" /> HQ Address
                                    </label>
                                    <input
                                        type="text"
                                        value={profile.hq_address}
                                        onChange={e => setProfile(prev => ({ ...prev, hq_address: e.target.value }))}
                                        placeholder="123 Main St, San Francisco, CA"
                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                                    />
                                </div>

                                {/* Logo Upload */}
                                <div className="space-y-1.5">
                                    <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300">
                                        <Upload className="w-3.5 h-3.5 text-primary" /> Company Logo
                                    </label>
                                    <div className="flex items-center gap-3">
                                        {profile.logo_url ? (
                                            <img src={profile.logo_url} alt="Logo" className="w-10 h-10 object-contain rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-0.5" />
                                        ) : (
                                            <div className="w-10 h-10 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                                                <Building2 className="w-4 h-4 text-gray-300 dark:text-gray-600" />
                                            </div>
                                        )}
                                        <div>
                                            <input type="file" ref={logoInputRef} onChange={handleLogoUpload} accept="image/*" className="hidden" />
                                            <button
                                                onClick={() => logoInputRef.current?.click()}
                                                disabled={isUploadingLogo}
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
                                            >
                                                {isUploadingLogo ? <><Loader2 className="w-3 h-3 animate-spin" /> Uploading...</> : <><Upload className="w-3 h-3" /> Upload</>}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Contingency % and Fee % */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300">
                                            <Percent className="w-3.5 h-3.5 text-primary" /> Contingency %
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="number" min={0} max={100} step={0.5}
                                                value={profile.contingency_pct}
                                                onChange={e => setProfile(prev => ({ ...prev, contingency_pct: parseFloat(e.target.value) || 0 }))}
                                                className="w-full px-3 py-2 pr-6 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                                            />
                                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">%</span>
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300">
                                            <Percent className="w-3.5 h-3.5 text-primary" /> GC Fee %
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="number" min={0} max={100} step={0.5}
                                                value={profile.fee_pct}
                                                onChange={e => setProfile(prev => ({ ...prev, fee_pct: parseFloat(e.target.value) || 0 }))}
                                                className="w-full px-3 py-2 pr-6 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                                            />
                                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">%</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Error */}
                                {errorMsg && (
                                    <div className="flex items-center gap-2 p-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-600 dark:text-red-400">
                                        <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {errorMsg}
                                    </div>
                                )}

                                {/* Save */}
                                <button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
                                >
                                    {isSaving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...</>
                                        : saveStatus === "success" ? <><CheckCircle2 className="w-3.5 h-3.5" /> Saved!</>
                                            : <><Save className="w-3.5 h-3.5" /> Save Profile</>}
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export function Sidebar({ className, onClose, history, activeId, onSelect, onNewChat, onRename, onDelete }: SidebarProps) {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState("");
    const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
    const [profileOpen, setProfileOpen] = useState(false);
    const { user } = useUser();

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

    // Close menus when clicking elsewhere
    useEffect(() => {
        const handleClick = () => setMenuOpenId(null);
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    return (
        <>
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

                {/* Footer — Avatar button only */}
                <div className="p-4 border-t border-sidebar-border">
                    <button
                        onClick={(e) => { e.stopPropagation(); setProfileOpen(v => !v); }}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors group"
                    >
                        {user?.imageUrl ? (
                            <img src={user.imageUrl} alt="avatar" className="w-8 h-8 rounded-full object-cover shrink-0 ring-2 ring-primary/20" />
                        ) : (
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                <span className="text-primary text-sm font-bold">{user?.firstName?.[0] || "U"}</span>
                            </div>
                        )}
                        <div className="flex-1 text-left overflow-hidden">
                            <div className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">
                                {user?.fullName || user?.firstName || "My Account"}
                            </div>
                            <div className="text-[10px] text-gray-400 truncate">
                                {user?.primaryEmailAddress?.emailAddress || ""}
                            </div>
                        </div>
                        <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${profileOpen ? "rotate-180" : ""}`} />
                    </button>
                </div>
            </div>

            {/* Profile Modal */}
            {profileOpen && <ProfileModal onClose={() => setProfileOpen(false)} />}
        </>
    );
}
