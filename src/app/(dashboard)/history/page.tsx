"use client";

import { useState, useEffect } from "react";
import {
  Loader2,
  MessageSquare,
  Clock,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { LegacyConversation } from "@/lib/types";

export default function HistoryPage() {
  const [conversations, setConversations] = useState<LegacyConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/conversations")
      .then((r) => r.json())
      .then((data) => setConversations(data.conversations || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-[#f9fafb] dark:bg-[#09090b]">
      <div className="max-w-4xl mx-auto p-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Legacy Records
        </h1>
        <p className="text-sm text-gray-500 mb-8">
          Previous estimation conversations from the old version. Read-only.
        </p>

        {conversations.length === 0 ? (
          <div className="text-center py-20">
            <Clock className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <p className="text-gray-500">No legacy records found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {conversations.map((conv) => {
              const isExpanded = expandedId === conv.id;
              return (
                <div
                  key={conv.id}
                  className="bg-white dark:bg-[#18181b] rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden"
                >
                  <button
                    onClick={() =>
                      setExpandedId(isExpanded ? null : conv.id)
                    }
                    className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    <MessageSquare className="w-4 h-4 text-gray-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                        {conv.title}
                      </div>
                      <div className="text-[10px] text-gray-500 mt-0.5">
                        {new Date(conv.timestamp).toLocaleDateString()} ·{" "}
                        {conv.messages.length} messages
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="border-t border-gray-100 dark:border-gray-800 max-h-[60vh] overflow-y-auto p-4 space-y-3">
                      {conv.messages.map((msg, i) => (
                        <div
                          key={i}
                          className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                              msg.role === "user"
                                ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                                : "bg-blue-50 dark:bg-blue-950/20 text-gray-800 dark:text-gray-200 border border-blue-100 dark:border-blue-900/40"
                            }`}
                          >
                            <div className="whitespace-pre-wrap break-words">
                              {msg.content.slice(0, 2000)}
                              {msg.content.length > 2000 && "..."}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
