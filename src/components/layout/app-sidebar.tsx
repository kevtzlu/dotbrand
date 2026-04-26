"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useUser, SignOutButton } from "@clerk/nextjs";
import {
  Plus,
  FolderOpen,
  BookOpen,
  UserCircle,
  Clock,
  LogOut,
  HelpCircle,
} from "lucide-react";
import { useState } from "react";
import { OnboardingModal } from "./onboarding-modal";

const showBetaFeatures = process.env.NEXT_PUBLIC_SHOW_BETA_FEATURES === "true";

const NAV_ITEMS = [
  { href: "/upload", icon: Plus, label: "New Project" },
  { href: "/projects", icon: FolderOpen, label: "Projects" },
  { href: "/knowledge", icon: BookOpen, label: "Knowledge Base" },
  { href: "/account", icon: UserCircle, label: "Account" },
  ...(showBetaFeatures ? [{ href: "/history", icon: Clock, label: "Old Records" }] : []),
];

export function AppSidebar() {
  const pathname = usePathname();
  const { user } = useUser();
  const [showLogout, setShowLogout] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  return (
    <aside className="w-[60px] h-full shrink-0 flex flex-col items-center border-r border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] py-4 gap-2">
      {/* Top: user avatar */}
      <div className="relative mb-2 group">
        <button
          onClick={() => setShowLogout((v) => !v)}
          className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
        >
          {user?.imageUrl ? (
            <img
              src={user.imageUrl}
              alt="avatar"
              className="w-8 h-8 rounded-full object-cover ring-2 ring-primary/20"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-primary text-sm font-bold">
                {user?.firstName?.[0] || "U"}
              </span>
            </div>
          )}
        </button>

        {/* Tooltip */}
        <div className="pointer-events-none absolute left-14 top-1/2 -translate-y-1/2 z-50 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs font-medium px-2 py-1 rounded-md whitespace-nowrap shadow-lg">
            {user?.fullName || "Account"}
          </div>
        </div>

        {showLogout && (
          <div className="absolute left-14 top-0 z-50 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-xl py-1 w-36">
            <SignOutButton>
              <button className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer">
                <LogOut className="w-3.5 h-3.5" />
                Sign out
              </button>
            </SignOutButton>
          </div>
        )}
      </div>

      {/* Nav icons */}
      <nav className="flex flex-col items-center gap-1 flex-1">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const isActive =
            pathname === href ||
            (href === "/projects" && pathname.startsWith("/projects/")) ||
            (href === "/knowledge" && pathname.startsWith("/knowledge/"));
          return (
            <div key={href} className="relative group">
              <Link
                href={href}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-gray-400 hover:bg-black/5 dark:hover:bg-white/5 hover:text-gray-600 dark:hover:text-gray-300"
                }`}
              >
                <Icon className="w-5 h-5" />
              </Link>
              {/* Tooltip */}
              <div className="pointer-events-none absolute left-14 top-1/2 -translate-y-1/2 z-50 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs font-medium px-2 py-1 rounded-md whitespace-nowrap shadow-lg">
                  {label}
                </div>
              </div>
            </div>
          );
        })}
      </nav>

      {/* Bottom: help button */}
      <div className="relative group mt-2">
        <button
          onClick={() => setShowOnboarding(true)}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-400 hover:bg-black/5 dark:hover:bg-white/5 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          <HelpCircle className="w-5 h-5" />
        </button>
        <div className="pointer-events-none absolute left-14 top-1/2 -translate-y-1/2 z-50 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs font-medium px-2 py-1 rounded-md whitespace-nowrap shadow-lg">
            Tutorial
          </div>
        </div>
      </div>

      <OnboardingModal open={showOnboarding} onClose={() => setShowOnboarding(false)} />
    </aside>
  );
}
