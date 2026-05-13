"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { OnboardingModal } from "@/components/layout/onboarding-modal";

const syncKey = (userId: string) => `user_db_sync_done_${userId}`;
const onboardingKey = (userId: string) => `onboarding_pending_${userId}`;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoaded } = useUser();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);

  // Show onboarding immediately if the user just signed up
  useEffect(() => {
    if (sessionStorage.getItem("show_onboarding_after_signup") === "1") {
      sessionStorage.removeItem("show_onboarding_after_signup");
      setShowOnboarding(true);
    }
  }, []);

  useEffect(() => {
    if (!isLoaded || !user) return;

    const SYNC_KEY = syncKey(user.id);
    const ONBOARDING_KEY = onboardingKey(user.id);

    // Always fetch fresh role from DB on every mount
    const fetchRole = async () => {
      try {
        const res = await fetch("/api/auth/role");
        if (res.ok) {
          const { role } = await res.json();
          if (role) setUserRole(role);
        }
      } catch (error) {
        console.error(error);
      }
    };

    void fetchRole();

    if (sessionStorage.getItem(SYNC_KEY) === "1") {
      // Restore onboarding state if it was pending before remount
      if (sessionStorage.getItem(ONBOARDING_KEY) === "1") {
        setShowOnboarding(true);
      }
      return;
    }

    const syncUserToDb = async () => {
      try {
        const response = await fetch("/api/auth/sync", { method: "POST" });
        if (!response.ok) {
          throw new Error(`User sync failed: ${response.status}`);
        }

        const { user: syncedUser } = await response.json();

        if (!syncedUser?.onboarding_shown) {
          sessionStorage.setItem(ONBOARDING_KEY, "1");
          setShowOnboarding(true);
        }

        sessionStorage.setItem(SYNC_KEY, "1");
      } catch (error) {
        console.error(error);
      }
    };

    void syncUserToDb();
  }, [isLoaded, user]);

  async function handleCloseOnboarding() {
    setShowOnboarding(false);
    if (user) {
      sessionStorage.removeItem(onboardingKey(user.id));
    }
    try {
      await fetch("/api/auth/onboarding", { method: "POST" });
    } catch (error) {
      console.error(error);
    }
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
