"use client";

import { useState, useEffect, useRef } from "react";
import {
  Building2,
  MapPin,
  Percent,
  Upload,
  Save,
  CheckCircle2,
  AlertCircle,
  Loader2,
  User,
  Lock,
  Trash2,
} from "lucide-react";
import { useUser, SignOutButton } from "@clerk/nextjs";

interface GCProfile {
  company_name: string;
  hq_address: string;
  logo_url: string;
  contingency_pct: number;
  fee_pct: number;
}

export default function AccountPage() {
  const { user } = useUser();
  const [activeTab, setActiveTab] = useState<"account" | "company">("company");
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
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">(
    "idle"
  );
  const [errorMsg, setErrorMsg] = useState("");
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((data) => {
        if (data.profile) {
          setProfile({
            company_name: data.profile.company_name || "",
            hq_address: data.profile.hq_address || "",
            logo_url: data.profile.logo_url || "",
            contingency_pct: data.profile.contingency_pct ?? 10,
            fee_pct: data.profile.fee_pct ?? 5,
          });
        }
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
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
          setProfile((prev) => ({ ...prev, logo_url: data.url }));
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message);
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

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-[#f9fafb] dark:bg-[#09090b] py-10 px-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">
          Account Settings
        </h1>

        {/* Tab switcher */}
        <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
          {(["account", "company"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-colors ${
                activeTab === tab
                  ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm"
                  : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              {tab === "account" ? "Account" : "Company Profile"}
            </button>
          ))}
        </div>

        <div className="bg-white dark:bg-[#18181b] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
          {activeTab === "account" ? (
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-xl">
                {user?.imageUrl ? (
                  <img
                    src={user.imageUrl}
                    alt="avatar"
                    className="w-14 h-14 rounded-full object-cover ring-2 ring-primary/20"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="w-6 h-6 text-primary" />
                  </div>
                )}
                <div>
                  <div className="font-semibold text-gray-900 dark:text-gray-100">
                    {user?.fullName || "User"}
                  </div>
                  <div className="text-sm text-gray-500">
                    {user?.primaryEmailAddress?.emailAddress}
                  </div>
                </div>
              </div>

              <SignOutButton redirectUrl="/sign-in">
                <button className="w-full flex items-center gap-2 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  <Lock className="w-4 h-4" />
                  Sign Out
                </button>
              </SignOutButton>

              <button
                onClick={async () => {
                  if (
                    confirm(
                      "Are you sure you want to delete your account? This cannot be undone."
                    )
                  ) {
                    await user?.delete();
                    window.location.href = "/sign-in";
                  }
                }}
                className="w-full flex items-center gap-2 px-4 py-3 rounded-xl border border-red-200 dark:border-red-800 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete Account
              </button>
            </div>
          ) : (
            <div className="p-6 space-y-6">
              {/* Company Name */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                  <Building2 className="w-4 h-4 text-primary" />
                  Company Name
                </label>
                <input
                  type="text"
                  value={profile.company_name}
                  onChange={(e) =>
                    setProfile((p) => ({ ...p, company_name: e.target.value }))
                  }
                  placeholder="Acme Construction Inc."
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
                  onChange={(e) =>
                    setProfile((p) => ({ ...p, hq_address: e.target.value }))
                  }
                  placeholder="123 Main St, San Francisco, CA"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                />
              </div>

              {/* Logo */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                  <Upload className="w-4 h-4 text-primary" />
                  Company Logo
                </label>
                <div className="flex items-center gap-4">
                  {profile.logo_url ? (
                    <img
                      src={profile.logo_url}
                      alt="Logo"
                      className="w-14 h-14 object-contain rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-1"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                      <Building2 className="w-5 h-5 text-gray-300" />
                    </div>
                  )}
                  <input
                    type="file"
                    ref={logoInputRef}
                    onChange={handleLogoUpload}
                    accept="image/*"
                    className="hidden"
                  />
                  <button
                    onClick={() => logoInputRef.current?.click()}
                    disabled={isUploadingLogo}
                    className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
                  >
                    {isUploadingLogo ? "Uploading..." : "Upload"}
                  </button>
                </div>
              </div>

              {/* Rates */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                    <Percent className="w-4 h-4 text-primary" />
                    Contingency %
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={profile.contingency_pct}
                    onChange={(e) =>
                      setProfile((p) => ({
                        ...p,
                        contingency_pct: parseFloat(e.target.value) || 0,
                      }))
                    }
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                    <Percent className="w-4 h-4 text-primary" />
                    GC Fee %
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={profile.fee_pct}
                    onChange={(e) =>
                      setProfile((p) => ({
                        ...p,
                        fee_pct: parseFloat(e.target.value) || 0,
                      }))
                    }
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                  />
                </div>
              </div>

              {errorMsg && (
                <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-600">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {errorMsg}
                </div>
              )}

              <button
                onClick={handleSave}
                disabled={isSaving}
                className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Saving...
                  </>
                ) : saveStatus === "success" ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" /> Saved!
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" /> Save Profile
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
