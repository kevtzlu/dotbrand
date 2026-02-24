"use client"

import { useState, useEffect, useRef } from "react"
import { Building2, MapPin, Percent, Upload, Save, CheckCircle2, AlertCircle, Loader2, ArrowLeft } from "lucide-react"
import Link from "next/link"

interface GCProfile {
    company_name: string
    hq_address: string
    logo_url: string
    contingency_pct: number
    fee_pct: number
}

export default function SettingsPage() {
    const [profile, setProfile] = useState<GCProfile>({
        company_name: "",
        hq_address: "",
        logo_url: "",
        contingency_pct: 10,
        fee_pct: 5,
    })
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [isUploadingLogo, setIsUploadingLogo] = useState(false)
    const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle")
    const [errorMsg, setErrorMsg] = useState("")
    const logoInputRef = useRef<HTMLInputElement>(null)

    // Load existing profile on mount
    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const res = await fetch("/api/profile")
                if (res.ok) {
                    const data = await res.json()
                    if (data.profile) {
                        setProfile({
                            company_name: data.profile.company_name || "",
                            hq_address: data.profile.hq_address || "",
                            logo_url: data.profile.logo_url || "",
                            contingency_pct: data.profile.contingency_pct ?? 10,
                            fee_pct: data.profile.fee_pct ?? 5,
                        })
                    }
                }
            } catch (e) {
                console.error("Failed to load profile", e)
            } finally {
                setIsLoading(false)
            }
        }
        fetchProfile()
    }, [])

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setIsUploadingLogo(true)
        setErrorMsg("")
        try {
            const formData = new FormData()
            formData.append("file", file)
            const res = await fetch("/api/upload", { method: "POST", body: formData })
            if (res.ok) {
                const data = await res.json()
                if (data.success) {
                    setProfile(prev => ({ ...prev, logo_url: data.url }))
                } else {
                    setErrorMsg("Logo upload failed: " + data.error)
                }
            } else {
                setErrorMsg("Logo upload failed (HTTP " + res.status + ")")
            }
        } catch (err: any) {
            setErrorMsg("Logo upload error: " + err.message)
        } finally {
            setIsUploadingLogo(false)
            if (logoInputRef.current) logoInputRef.current.value = ""
        }
    }

    const handleSave = async () => {
        setIsSaving(true)
        setSaveStatus("idle")
        setErrorMsg("")
        try {
            const res = await fetch("/api/profile", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(profile),
            })
            if (res.ok) {
                setSaveStatus("success")
                setTimeout(() => setSaveStatus("idle"), 3000)
            } else {
                const data = await res.json()
                setErrorMsg(data.error || "Save failed")
                setSaveStatus("error")
            }
        } catch (err: any) {
            setErrorMsg(err.message)
            setSaveStatus("error")
        } finally {
            setIsSaving(false)
        }
    }

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#09090b]">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-[#09090b] py-10 px-4">
            <div className="max-w-2xl mx-auto">
                {/* Back link */}
                <Link
                    href="/"
                    className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 mb-6 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Estimait
                </Link>

                <div className="bg-white dark:bg-[#18181b] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
                    {/* Header */}
                    <div className="px-8 py-6 border-b border-gray-100 dark:border-gray-800">
                        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">GC Profile Settings</h1>
                        <p className="text-sm text-gray-500 mt-1">Configure your company profile for estimates and reports.</p>
                    </div>

                    <div className="px-8 py-6 space-y-6">
                        {/* Company Name */}
                        <div className="space-y-2">
                            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                                <Building2 className="w-4 h-4 text-primary" />
                                Company Name
                            </label>
                            <input
                                type="text"
                                value={profile.company_name}
                                onChange={e => setProfile(prev => ({ ...prev, company_name: e.target.value }))}
                                placeholder="e.g. Acme Construction Inc."
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                            />
                        </div>

                        {/* HQ Address */}
                        <div className="space-y-2">
                            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                                <MapPin className="w-4 h-4 text-primary" />
                                HQ Address
                            </label>
                            <input
                                type="text"
                                value={profile.hq_address}
                                onChange={e => setProfile(prev => ({ ...prev, hq_address: e.target.value }))}
                                placeholder="e.g. 123 Main St, San Francisco, CA 94105"
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                            />
                        </div>

                        {/* Logo Upload */}
                        <div className="space-y-2">
                            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                                <Upload className="w-4 h-4 text-primary" />
                                Company Logo
                            </label>
                            <div className="flex items-center gap-4">
                                {profile.logo_url ? (
                                    <img
                                        src={profile.logo_url}
                                        alt="Company Logo"
                                        className="w-16 h-16 object-contain rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-1"
                                    />
                                ) : (
                                    <div className="w-16 h-16 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                                        <Building2 className="w-6 h-6 text-gray-300 dark:text-gray-600" />
                                    </div>
                                )}
                                <div className="flex-1">
                                    <input
                                        type="file"
                                        ref={logoInputRef}
                                        onChange={handleLogoUpload}
                                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                                        className="hidden"
                                    />
                                    <button
                                        onClick={() => logoInputRef.current?.click()}
                                        disabled={isUploadingLogo}
                                        className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
                                    >
                                        {isUploadingLogo ? (
                                            <><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</>
                                        ) : (
                                            <><Upload className="w-4 h-4" /> Upload Logo</>
                                        )}
                                    </button>
                                    <p className="text-xs text-gray-400 mt-1">PNG, JPG, WebP or SVG. Max 10MB.</p>
                                </div>
                            </div>
                        </div>

                        {/* Contingency % and Fee % */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                                    <Percent className="w-4 h-4 text-primary" />
                                    Contingency %
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        min={0}
                                        max={100}
                                        step={0.5}
                                        value={profile.contingency_pct}
                                        onChange={e => setProfile(prev => ({ ...prev, contingency_pct: parseFloat(e.target.value) || 0 }))}
                                        className="w-full px-4 py-2.5 pr-8 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                                    <Percent className="w-4 h-4 text-primary" />
                                    Fee %
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        min={0}
                                        max={100}
                                        step={0.5}
                                        value={profile.fee_pct}
                                        onChange={e => setProfile(prev => ({ ...prev, fee_pct: parseFloat(e.target.value) || 0 }))}
                                        className="w-full px-4 py-2.5 pr-8 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                                </div>
                            </div>
                        </div>

                        {/* Error message */}
                        {errorMsg && (
                            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-600 dark:text-red-400">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                {errorMsg}
                            </div>
                        )}

                        {/* Save Button */}
                        <div className="pt-2">
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="w-full flex items-center justify-center gap-2 py-3 px-6 bg-primary text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                            >
                                {isSaving ? (
                                    <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                                ) : saveStatus === "success" ? (
                                    <><CheckCircle2 className="w-4 h-4" /> Saved!</>
                                ) : (
                                    <><Save className="w-4 h-4" /> Save Profile</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
