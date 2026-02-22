"use client";

import { useState } from "react";
import {
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  MessageSquare,
  Sparkles,
  ChevronRight,
} from "lucide-react";

interface PlanItem {
  id: string;
  type: "study" | "deadline" | "event" | "break" | "review";
  title: string;
  courseName?: string;
  courseColor?: string;
  startTime: string;
  endTime?: string;
  reason: string;
  priority: "high" | "medium" | "low";
  isCompleted?: boolean;
}

interface TodaysPlanProps {
  planItems: PlanItem[];
  greeting: string;
  topInsight: string | null;
}

export function TodaysPlan({ planItems, greeting, topInsight }: TodaysPlanProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const now = new Date();
  const currentHour = now.getHours();
  const timeOfDay = currentHour < 12 ? "morning" : currentHour < 17 ? "afternoon" : "evening";

  return (
    <div className="space-y-4">
      {/* AI Greeting */}
      <div className="flex items-start gap-3 rounded-xl bg-gradient-to-r from-purple-500/10 via-blue-500/10 to-indigo-500/10 p-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-purple-500/20">
          <Sparkles className="h-4 w-4 text-purple-400" />
        </div>
        <div>
          <p className="text-sm font-medium">{greeting}</p>
          {topInsight && (
            <p className="mt-1 text-xs text-muted-foreground">{topInsight}</p>
          )}
        </div>
      </div>

      {/* Timeline */}
      {planItems.length === 0 ? (
        <div className="flex h-[120px] items-center justify-center rounded-xl border border-dashed border-border/30 text-center">
          <div>
            <Calendar className="mx-auto mb-2 h-6 w-6 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              No plan for this {timeOfDay} yet.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Ask Rewired to build your schedule!
            </p>
          </div>
        </div>
      ) : (
        <div className="relative space-y-1">
          {/* Vertical timeline line */}
          <div className="absolute bottom-2 left-[18px] top-2 w-px bg-gradient-to-b from-purple-500/30 via-blue-500/20 to-transparent" />

          {planItems.map((item) => {
            const isExpanded = expandedId === item.id;
            const typeConfig = getTypeConfig(item.type);
            const timeStr = formatTime(item.startTime);
            const isPast = new Date(item.startTime) < now;

            return (
              <div
                key={item.id}
                className={`group relative flex cursor-pointer items-start gap-3 rounded-lg p-2.5 transition-all hover:bg-white/[0.02] ${
                  isPast && !item.isCompleted ? "opacity-50" : ""
                }`}
                onClick={() => setExpandedId(isExpanded ? null : item.id)}
              >
                {/* Timeline dot */}
                <div
                  className={`relative z-10 mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full ${
                    item.isCompleted
                      ? "bg-emerald-500/20"
                      : item.priority === "high"
                        ? "bg-purple-500/20 ring-2 ring-purple-500/30"
                        : "bg-white/10"
                  }`}
                >
                  {item.isCompleted ? (
                    <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                  ) : (
                    <div
                      className={`h-1.5 w-1.5 rounded-full ${
                        item.priority === "high" ? "bg-purple-400" : "bg-white/40"
                      }`}
                    />
                  )}
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      {timeStr}
                    </span>
                    {typeConfig.icon}
                    {item.courseColor && (
                      <div
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: item.courseColor }}
                      />
                    )}
                  </div>
                  <p
                    className={`mt-0.5 text-sm font-medium ${
                      item.isCompleted ? "text-muted-foreground line-through" : ""
                    }`}
                  >
                    {item.title}
                  </p>
                  {item.courseName && (
                    <p className="text-[11px] text-muted-foreground">{item.courseName}</p>
                  )}

                  {/* Expanded reason */}
                  {isExpanded && (
                    <div className="mt-2 rounded-md bg-white/[0.03] p-2.5">
                      <div className="flex items-center gap-1.5 text-[10px] font-medium text-purple-400">
                        <Sparkles className="h-3 w-3" />
                        Why this matters
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{item.reason}</p>
                    </div>
                  )}
                </div>

                {/* Expand indicator */}
                <ChevronRight
                  className={`mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground/30 transition-transform ${
                    isExpanded ? "rotate-90" : ""
                  }`}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Quick action */}
      <a
        href="/chat"
        className="flex items-center gap-2 rounded-lg border border-purple-500/20 bg-purple-500/5 p-3 text-sm transition-all hover:bg-purple-500/10"
      >
        <MessageSquare className="h-4 w-4 text-purple-400" />
        <span className="text-purple-300">Ask Rewired to adjust your plan</span>
        <ChevronRight className="ml-auto h-4 w-4 text-purple-400/50" />
      </a>
    </div>
  );
}

function getTypeConfig(type: PlanItem["type"]) {
  switch (type) {
    case "study":
      return { icon: <BookOpen className="h-3 w-3 text-purple-400" /> };
    case "deadline":
      return { icon: <Clock className="h-3 w-3 text-red-400" /> };
    case "event":
      return { icon: <Calendar className="h-3 w-3 text-blue-400" /> };
    case "review":
      return { icon: <BookOpen className="h-3 w-3 text-emerald-400" /> };
    default:
      return { icon: <Clock className="h-3 w-3 text-muted-foreground" /> };
  }
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
