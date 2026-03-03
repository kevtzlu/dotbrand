"use client"

import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { Sidebar } from "@/components/layout/sidebar"
import { ChatInterface } from "@/components/layout/chat-interface"
import { ChartPanel } from "@/components/layout/chart-panel"
import { PanelLeft, ChevronLeft } from "lucide-react"
import { parseEstimationData } from "@/lib/parseEstimationData"

export type Message = {
  role: "assistant" | "user";
  content: string;
  attachments?: { name: string; size: number }[];
};

export type ChartType = 'monte-carlo' | 'pie' | 'bar' | 'line';

export type EstimationData = {
  projectName?: string;
  location?: string;
  gfa?: string;
  buildingType?: string;
  wageType?: string;
  seismicCategory?: string;
  p10: number;
  p50: number;
  p80: number;
  mean?: number;
  histogram?: { cost: string; frequency: number }[];
  breakdown?: { name: string; value: number }[];
  risks?: { title: string; description: string }[];
  chartType?: ChartType;
  chartData?: any[];
  timestamp: number;
  stage?: string;
}

export type StageSnapshot = {
  stage: string;
  label: string;
  data: EstimationData;
  completedAt: number;
};

export type Conversation = {
  id: string;
  title: string;
  timestamp: number;
  messages: Message[];
  share_token?: string | null;
  stageSnapshots?: StageSnapshot[];
};

const STAGE_LABELS: Record<string, string> = {
  A: "Stage A — Project Brief",
  B: "Stage B — Scope Definition",
  C: "Stage C — System Selection",
  D: "Stage D — Quantity Takeoff",
  E: "Stage E — Monte Carlo",
  F: "Stage F — Final Report",
};

function upsertSnapshot(existing: StageSnapshot[], snapshot: StageSnapshot): StageSnapshot[] {
  const idx = existing.findIndex(s => s.stage === snapshot.stage);
  if (idx >= 0) {
    return existing.map((s, i) => (i === idx ? snapshot : s));
  }
  const order = "ABCDEF";
  const inserted = [...existing, snapshot];
  inserted.sort((a, b) => order.indexOf(a.stage) - order.indexOf(b.stage));
  return inserted;
}

export default function Home() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isChartPanelOpen, setIsChartPanelOpen] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [estimationData, setEstimationData] = useState<EstimationData | null>(null)
  const [stageSnapshots, setStageSnapshots] = useState<StageSnapshot[]>([])
  const [activeStage, setActiveStage] = useState<string | null>(null)
  const [hasMonteCarlo, setHasMonteCarlo] = useState(false)
  const [chatKey, setChatKey] = useState(0)

  // Ref so snapshot saves always use the latest activeId without stale closure
  const activeIdRef = useRef<string | null>(null)
  useEffect(() => { activeIdRef.current = activeId }, [activeId])

  const handleChartDataDetected = useCallback((data: EstimationData) => {
    // Priority Rule: If Monte Carlo is already done, don't replace it with other charts
    if (hasMonteCarlo && data.chartType !== 'monte-carlo') return;

    setEstimationData(data);

    if (data.chartType === 'monte-carlo') {
      setHasMonteCarlo(true);
      setIsChartPanelOpen(true);
    }

    if (data.stage) {
      const snapshot: StageSnapshot = {
        stage: data.stage,
        label: STAGE_LABELS[data.stage] ?? `Stage ${data.stage}`,
        data,
        completedAt: Date.now(),
      };
      setActiveStage(data.stage);
      setStageSnapshots(prev => upsertSnapshot(prev, snapshot));

      // Persist snapshot to DB immediately
      const convId = activeIdRef.current;
      if (convId) {
        setConversations(prev => {
          const conv = prev.find(c => c.id === convId);
          if (!conv) return prev;
          const updatedSnapshots = upsertSnapshot(conv.stageSnapshots ?? [], snapshot);
          const updated = { ...conv, stageSnapshots: updatedSnapshots };
          fetch("/api/conversations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updated),
          }).catch(e => console.error("Failed to save stage snapshots", e));
          return prev.map(c => (c.id === convId ? updated : c));
        });
      }
    }
  }, [hasMonteCarlo]);

  // Load conversations from DB on mount
  useEffect(() => {
    fetch("/api/conversations")
      .then(res => res.ok ? res.json() : Promise.reject(res))
      .then(data => setConversations(data.conversations ?? []))
      .catch(e => console.error("Failed to load conversations", e))
  }, [])

  const activeConversation = useMemo(
    () => conversations.find(c => c.id === activeId),
    [activeId, conversations]
  );

  // Restore stage snapshots and estimationData when switching conversations
  useEffect(() => {
    if (!activeConversation) {
      setEstimationData(null);
      setStageSnapshots([]);
      setActiveStage(null);
      setIsChartPanelOpen(false);
      setHasMonteCarlo(false);
      return;
    }

    const savedSnapshots = activeConversation.stageSnapshots ?? [];

    if (savedSnapshots.length > 0) {
      setStageSnapshots(savedSnapshots);
      const hasMC = savedSnapshots.some(s => s.data.chartType === 'monte-carlo');
      setHasMonteCarlo(hasMC);
      // Show the most recent (last in sorted order) snapshot
      const last = savedSnapshots[savedSnapshots.length - 1];
      setEstimationData(last.data);
      setActiveStage(last.stage);
      if (hasMC) setIsChartPanelOpen(true);
    } else {
      // Backward compat: rebuild Stage E from messages
      const data = parseEstimationData(activeConversation.messages);
      if (data) {
        setEstimationData(data);
        setHasMonteCarlo(data.chartType === 'monte-carlo');
        const fallbackSnapshot: StageSnapshot = {
          stage: data.stage ?? 'E',
          label: STAGE_LABELS[data.stage ?? 'E'] ?? 'Stage E — Monte Carlo',
          data,
          completedAt: data.timestamp,
        };
        setStageSnapshots([fallbackSnapshot]);
        setActiveStage(data.stage ?? 'E');
      } else {
        setEstimationData(null);
        setHasMonteCarlo(false);
        setStageSnapshots([]);
        setActiveStage(null);
        setIsChartPanelOpen(false);
      }
    }
  }, [activeConversation?.id]);

  const handleStageSelect = (stage: string) => {
    const snapshot = stageSnapshots.find(s => s.stage === stage);
    if (snapshot) {
      setEstimationData(snapshot.data);
      setActiveStage(stage);
    }
  };

  const handleSelectConversation = (id: string) => {
    if (id === activeId) return;
    setActiveId(id);
  }

  const handleUpdateConversation = (id: string, messages: Message[], title?: string) => {
    setConversations(prev => prev.map(c => {
      if (c.id === id) {
        const updated = {
          ...c,
          messages,
          title: title || c.title,
          timestamp: Date.now()
        }
        fetch("/api/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updated),
        }).catch(e => console.error("Failed to update conversation", e))
        return updated
      }
      return c
    }))
  }

  const handleCreateConversation = (messages: Message[], title: string, predefinedId?: string) => {
    const newId = predefinedId || Math.random().toString(36).substring(7)
    // Use PROJECT 01, 02... for short/empty titles
    const finalTitle = (title && title.trim().length >= 5)
      ? title
      : (() => {
          const projectCount = conversations.filter(c => /^PROJECT\s+\d+/i.test(c.title)).length + 1;
          return `PROJECT ${String(projectCount).padStart(2, '0')}`;
        })();
    const newConv: Conversation = {
      id: newId,
      title: finalTitle,
      timestamp: Date.now(),
      messages,
      stageSnapshots: [],
    }
    setConversations(prev => [newConv, ...prev])
    setActiveId(newId)
    fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newConv),
    }).catch(e => console.error("Failed to save conversation", e))
    return newId
  }

  const handleRenameConversation = (id: string, newTitle: string) => {
    setConversations(prev => prev.map(c => {
      if (c.id !== id) return c
      const updated = { ...c, title: newTitle }
      fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      }).catch(e => console.error("Failed to rename conversation", e))
      return updated
    }))
  }

  const handleDeleteConversation = (id: string) => {
    setConversations(prev => {
      const filtered = prev.filter(c => c.id !== id);
      // If we deleted the active conversation, switch to the first available one
      if (activeId === id) {
        if (filtered.length > 0) {
          setActiveId(filtered[0].id);
        } else {
          setActiveId(null);
          setEstimationData(null);
          setStageSnapshots([]);
          setActiveStage(null);
          setIsChartPanelOpen(false);
        }
      }
      return filtered;
    });
    fetch(`/api/conversations?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    }).catch(e => console.error("Failed to delete conversation", e))
  }

  const handleNewChat = () => {
    setActiveId(null)
    setEstimationData(null)
    setStageSnapshots([])
    setActiveStage(null)
    setIsChartPanelOpen(false)
    setHasMonteCarlo(false)
    setChatKey(k => k + 1)
  }

  return (
    <main className="flex h-screen w-full overflow-hidden bg-background relative selection:bg-primary/10">

      {/* Sidebar Toggle Button (when closed) */}
      {!isSidebarOpen && (
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-50 bg-white dark:bg-[#18181b] border border-l-0 border-panel-border text-gray-500 hover:text-gray-900 dark:hover:text-white p-1.5 rounded-r-lg shadow-sm"
        >
          <PanelLeft className="w-5 h-5" />
        </button>
      )}

      {/* Left Column: History Sidebar */}
      <div
        className={`${isSidebarOpen ? "w-[250px] opacity-100" : "w-0 opacity-0 px-0 border-none"
          } shrink-0 h-full transition-all duration-300 overflow-hidden relative border-r border-panel-border`}
      >
        <Sidebar
          onClose={() => setIsSidebarOpen(false)}
          history={conversations}
          activeId={activeId}
          onSelect={handleSelectConversation}
          onNewChat={handleNewChat}
          onRename={handleRenameConversation}
          onDelete={handleDeleteConversation}
          className="h-full"
        />
      </div>

      {/* Main Content Area: Chat + Chart Panel */}
      <div className="flex-1 flex flex-row min-w-0 h-full relative overflow-hidden">
        {/* Chat Area (always visible) */}
        <main className="flex-1 min-w-0 h-full bg-[#f9fafb] dark:bg-[#09090b] relative transition-all duration-300 overflow-hidden">
          <ChatInterface
            key={chatKey}
            className="h-full"
            activeConversation={activeConversation}
            onUpdate={handleUpdateConversation}
            onCreate={handleCreateConversation}
            onOpenDataPanel={() => setIsChartPanelOpen(true)}
            onChartDataDetected={handleChartDataDetected}
          />

          {/* Re-open Chart Panel Button — right edge, vertically centered */}
          {!isChartPanelOpen && estimationData && (
            <button
              onClick={() => setIsChartPanelOpen(true)}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-50 bg-primary text-white p-2 rounded-l-lg shadow-lg hover:bg-blue-700 transition-colors"
              title="Show estimation panel"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
        </main>

        {/* Chart Panel (slides in/out) */}
        <ChartPanel
          className={`shrink-0 h-full transition-all duration-300 ease-in-out border-l border-panel-border ${isChartPanelOpen ? 'w-[40%] opacity-100' : 'w-0 opacity-0 overflow-hidden border-none'
            }`}
          onClose={() => setIsChartPanelOpen(false)}
          data={estimationData}
          stageSnapshots={stageSnapshots}
          activeStage={activeStage}
          onStageSelect={handleStageSelect}
        />
      </div>
    </main>
  );
}
