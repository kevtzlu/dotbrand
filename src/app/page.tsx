"use client"

import { useState, useEffect } from "react"
import { Sidebar } from "@/components/layout/sidebar"
import { ChatInterface } from "@/components/layout/chat-interface"
import { ChartPanel } from "@/components/layout/chart-panel"
import { PanelLeftClose, PanelLeft, PanelRightClose, BarChart3 } from "lucide-react"

export type Message = {
  role: "assistant" | "user";
  content: string;
  attachments?: { name: string; size: number }[];
};

export type Conversation = {
  id: string;
  title: string;
  timestamp: number;
  messages: Message[];
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
}

export default function Home() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isChartPanelOpen, setIsChartPanelOpen] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [estimationData, setEstimationData] = useState<EstimationData | null>(null)
  const [hasMonteCarlo, setHasMonteCarlo] = useState(false)
  const [chatKey, setChatKey] = useState(0)

  const handleChartDataDetected = (data: EstimationData) => {
    // Priority Rule: If Monte Carlo is already done, don't replace it with other charts
    if (hasMonteCarlo && data.chartType !== 'monte-carlo') {
      return;
    }

    setEstimationData(data);

    if (data.chartType === 'monte-carlo') {
      setHasMonteCarlo(true);
      setIsChartPanelOpen(true);
    }
  };

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("estimait_history")
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setConversations(parsed)
      } catch (e) {
        console.error("Failed to parse history", e)
      }
    }
  }, [])

  // Save to localStorage when conversations change
  useEffect(() => {
    localStorage.setItem("estimait_history", JSON.stringify(conversations))
  }, [conversations])

  const activeConversation = conversations.find(c => c.id === activeId)

  const handleSelectConversation = (id: string) => {
    setActiveId(id)
    setEstimationData(null)
    setIsChartPanelOpen(false)
  }

  const handleUpdateConversation = (id: string, messages: Message[], title?: string) => {
    setConversations(prev => prev.map(c => {
      if (c.id === id) {
        return {
          ...c,
          messages,
          title: title || c.title,
          timestamp: Date.now()
        }
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
      messages
    }
    setConversations(prev => [newConv, ...prev])
    setActiveId(newId)
    return newId
  }

  const handleRenameConversation = (id: string, newTitle: string) => {
    setConversations(prev => prev.map(c =>
      c.id === id ? { ...c, title: newTitle } : c
    ))
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
          setIsChartPanelOpen(false);
        }
      }
      return filtered;
    });
  }

  const handleNewChat = () => {
    setActiveId(null)
    setEstimationData(null)
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
            activeConversation={conversations.find(c => c.id === activeId)}
            onUpdate={handleUpdateConversation}
            onCreate={handleCreateConversation}
            onOpenDataPanel={() => setIsChartPanelOpen(true)}
            onChartDataDetected={handleChartDataDetected}
          />

          {/* Re-open Chart Panel Button */}
          {!isChartPanelOpen && estimationData && (
            <button
              onClick={() => setIsChartPanelOpen(true)}
              className="absolute top-4 right-4 p-2 bg-white dark:bg-[#18181b] rounded-full shadow-lg border border-panel-border text-primary hover:scale-110 transition-all z-20"
              title="Open Analysis Dashboard"
            >
              <BarChart3 className="w-5 h-5" />
            </button>
          )}
        </main>

        {/* Chart Panel (slides in/out) */}
        <ChartPanel
          className={`shrink-0 h-full transition-all duration-300 ease-in-out border-l border-panel-border ${isChartPanelOpen ? 'w-[40%] opacity-100' : 'w-0 opacity-0 overflow-hidden border-none'
            }`}
          onClose={() => setIsChartPanelOpen(false)}
          data={estimationData}
        />
      </div>
    </main>
  );
}
