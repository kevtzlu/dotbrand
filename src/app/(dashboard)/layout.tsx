"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { OnboardingModal } from "@/components/layout/onboarding-modal";

const ONBOARDING_KEY = "onboarding_shown";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoaded } = useUser();
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (!isLoaded || !user) return;
    const seen = localStorage.getItem(ONBOARDING_KEY);
    if (!seen) {
      setShowOnboarding(true);
    }
  }, [isLoaded, user]);

  function handleCloseOnboarding() {
    localStorage.setItem(ONBOARDING_KEY, "1");
    setShowOnboarding(false);
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <AppSidebar />
      <main className="flex-1 min-w-0 h-full overflow-hidden">
        {children}
      </main>
      <OnboardingModal open={showOnboarding} onClose={handleCloseOnboarding} />
    </div>
  );
}
