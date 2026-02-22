"use client";

import { Clock, AlertTriangle, CheckCircle2, Zap } from "lucide-react";

interface DeadlineItem {
  id: string;
  title: string;
  courseName: string;
  courseColor: string;
  dueDate: string;
  hoursLeft: number;
  status: "overdue" | "urgent" | "soon" | "upcoming" | "later";
  weight: number | null;
  isOverdue: boolean;
}

interface DeadlinePipelineProps {
  deadlines: DeadlineItem[];
}

export function DeadlinePipeline({ deadlines }: DeadlinePipelineProps) {
  if (deadlines.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
        <div className="text-center">
          <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-400/50" />
          <p>All clear! No upcoming deadlines.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {deadlines.map((deadline, index) => {
        const urgencyConfig = getUrgencyConfig(deadline.status);

        return (
          <div
            key={deadline.id}
            className={`animate-slide-in-right group relative flex items-center gap-3 rounded-lg border p-3 transition-all duration-200 hover-lift ${urgencyConfig.border} ${urgencyConfig.bg}`}
            style={{
              ["--stagger-delay" as string]: `${index * 0.06}s`,
            }}
          >
            {index < deadlines.length - 1 && (
              <div className="absolute bottom-0 left-[22px] top-full h-2 w-px bg-gradient-to-b from-border/30 to-transparent" />
            )}

            <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${urgencyConfig.iconBg} transition-transform duration-200 group-hover:scale-110`}>
              {urgencyConfig.icon}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <div
                  className="h-2 w-2 shrink-0 rounded-full transition-transform duration-200 group-hover:scale-125"
                  style={{ backgroundColor: deadline.courseColor }}
                />
                <span className="truncate text-sm font-medium">{deadline.title}</span>
                {deadline.weight && deadline.weight > 0 && (
                  <span className="shrink-0 rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {deadline.weight} pts
                  </span>
                )}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {deadline.courseName}
              </div>
            </div>

            <div className={`shrink-0 text-right ${urgencyConfig.textColor}`}>
              <div className={`text-sm font-semibold ${deadline.isOverdue ? "animate-overdue-pulse" : ""}`}>
                {deadline.isOverdue ? (
                  "OVERDUE"
                ) : deadline.hoursLeft < 1 ? (
                  "<1h"
                ) : deadline.hoursLeft < 24 ? (
                  `${Math.round(deadline.hoursLeft)}h`
                ) : (
                  `${Math.round(deadline.hoursLeft / 24)}d`
                )}
              </div>
              <div className="text-[10px] text-muted-foreground">
                {formatDeadlineDate(deadline.dueDate)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function getUrgencyConfig(status: DeadlineItem["status"]) {
  switch (status) {
    case "overdue":
      return {
        border: "border-red-500/30",
        bg: "bg-red-500/5",
        iconBg: "bg-red-500/20",
        icon: <AlertTriangle className="h-3.5 w-3.5 text-red-400" />,
        textColor: "text-red-400",
      };
    case "urgent":
      return {
        border: "border-orange-500/30",
        bg: "bg-orange-500/5",
        iconBg: "bg-orange-500/20",
        icon: <Zap className="h-3.5 w-3.5 text-orange-400" />,
        textColor: "text-orange-400",
      };
    case "soon":
      return {
        border: "border-yellow-500/20",
        bg: "bg-yellow-500/5",
        iconBg: "bg-yellow-500/15",
        icon: <Clock className="h-3.5 w-3.5 text-yellow-400" />,
        textColor: "text-yellow-400",
      };
    case "upcoming":
      return {
        border: "border-blue-500/15",
        bg: "bg-blue-500/5",
        iconBg: "bg-blue-500/15",
        icon: <Clock className="h-3.5 w-3.5 text-blue-400" />,
        textColor: "text-blue-400",
      };
    default:
      return {
        border: "border-border/30",
        bg: "",
        iconBg: "bg-white/5",
        icon: <Clock className="h-3.5 w-3.5 text-muted-foreground" />,
        textColor: "text-muted-foreground",
      };
  }
}

function formatDeadlineDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
