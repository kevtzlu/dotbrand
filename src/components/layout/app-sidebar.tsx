"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useUser, SignOutButton } from "@clerk/nextjs";
import {
  Plus,
  FolderOpen,
  UserCircle,
  Clock,
  LogOut,
  Box,
} from "lucide-react";
import { useState } from "react";

const NAV_ITEMS = [
  { href: "/upload", icon: Plus, label: "New Project" },
  { href: "/projects", icon: FolderOpen, label: "Projects" },
  { href: "/account", icon: UserCircle, label: "Account" },
  { href: "/history", icon: Clock, label: "Old Records" },
] as const;

export function AppSidebar() {
  const pathname = usePathname();
  const { user } = useUser();
  const [showLogout, setShowLogout] = useState(false);

  return (
    <aside className="w-[60px] h-full shrink-0 flex flex-col items-center border-r border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] py-4 gap-2">
      {/* Logo */}
      <Link
        href="/projects"
        className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white mb-4 hover:bg-blue-700 transition-colors"
        title="Estimait"
      >
        <Box className="w-5 h-5" />
      </Link>

      {/* Nav icons */}
      <nav className="flex flex-col items-center gap-1 flex-1">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const isActive =
            pathname === href ||
            (href === "/projects" && pathname.startsWith("/projects/"));
          return (
            <Link
              key={href}
              href={href}
              title={label}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-gray-400 hover:bg-black/5 dark:hover:bg-white/5 hover:text-gray-600 dark:hover:text-gray-300"
              }`}
            >
              <Icon className="w-5 h-5" />
            </Link>
          );
        })}
      </nav>

      {/* Bottom: user avatar */}
      <div className="relative">
        <button
          onClick={() => setShowLogout((v) => !v)}
          className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          title={user?.fullName || "Account"}
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

        {showLogout && (
          <div className="absolute left-14 bottom-0 z-50 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-xl py-1 w-36">
            <SignOutButton redirectUrl="/sign-in">
              <button className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <LogOut className="w-3.5 h-3.5" />
                Sign out
              </button>
            </SignOutButton>
          </div>
        )}
      </div>
    </aside>
  );
}
