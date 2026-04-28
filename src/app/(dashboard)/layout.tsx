"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { OnboardingModal } from "@/components/layout/onboarding-modal";

const ONBOARDING_KEY = "onboarding_shown";
const USER_SYNC_KEY = "user_db_sync_done";
const USER_ROLE_KEY = "user_role";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoaded } = useUser();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem(USER_ROLE_KEY);
    }
    return null;
  });

  useEffect(() => {
    if (!isLoaded || !user) return;
    const seen = localStorage.getItem(ONBOARDING_KEY);
    if (!seen) {
      setShowOnboarding(true);
    }
  }, [isLoaded, user]);

  useEffect(() => {
    if (!isLoaded || !user) return;
    if (sessionStorage.getItem(USER_SYNC_KEY) === "1") {
      const cached = sessionStorage.getItem(USER_ROLE_KEY);
      if (cached) setUserRole(cached);
      return;
    }

    const syncUserToDb = async () => {
      try {
        const response = await fetch("/api/auth/sync", { method: "POST" });
        if (!response.ok) {
          throw new Error(`User sync failed: ${response.status}`);
        }

        const { user: syncedUser } = await response.json();
        if (syncedUser?.role) {
          sessionStorage.setItem(USER_ROLE_KEY, syncedUser.role);
          setUserRole(syncedUser.role);
        }

        sessionStorage.setItem(USER_SYNC_KEY, "1");
      } catch (error) {
        console.error(error);
      }
    };

    void syncUserToDb();
  }, [isLoaded, user]);

  function handleCloseOnboarding() {
    localStorage.setItem(ONBOARDING_KEY, "1");
    setShowOnboarding(false);
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <AppSidebar isAdmin={userRole === "admin"} />
      <main className="flex-1 min-w-0 h-full overflow-hidden">
        {children}
      </main>
      <OnboardingModal open={showOnboarding} onClose={handleCloseOnboarding} />
    </div>
  );
}
