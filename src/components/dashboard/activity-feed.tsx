"use client";

import {
  Bell,
  Brain,
  Mail,
  AlertTriangle,
  CheckCircle2,
  Zap,
  ChevronRight,
} from "lucide-react";

interface FeedItem {
  id: string;
  type: "nudge" | "insight" | "email" | "achievement";
  title: string;
  message: string;
  severity?: "gentle" | "firm" | "urgent" | "nuclear";
  category?: string;
  timestamp: string;
  actionUrl?: string;
}

interface ActivityFeedProps {
  items: FeedItem[];
}

export function ActivityFeed({ items }: ActivityFeedProps) {
  if (items.length === 0) {
    return (
      <div className="flex h-[160px] items-center justify-center text-sm text-muted-foreground">
        No recent activity. Rewired will start sending you updates soon.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item, index) => {
        const config = getItemConfig(item);
        const isRecent = isWithinHour(item.timestamp);

        return (
          <div
            key={item.id}
            className={`animate-slide-in-right group flex items-start gap-3 rounded-lg border p-3 transition-all duration-200 hover-lift ${config.border} ${config.bg}`}
            style={{
              ["--stagger-delay" as string]: `${index * 0.06}s`,
            }}
          >
            <div className={`relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${config.iconBg} transition-transform duration-200 group-hover:scale-110`}>
              {config.icon}
              {isRecent && (
                <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-purple-400 animate-status-dot" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold">{item.title}</span>
                <span className="text-[10px] text-muted-foreground">
                  {formatTimeAgo(item.timestamp)}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                {item.message}
              </p>
            </div>
            {item.actionUrl && (
              <a href={item.actionUrl} className="mt-1 shrink-0">
                <ChevronRight className="h-4 w-4 text-muted-foreground/30 transition-transform group-hover:translate-x-0.5" />
              </a>
            )}
          </div>
        );
      })}
    </div>
  );
}

function isWithinHour(dateStr: string): boolean {
  const now = new Date();
  const date = new Date(dateStr);
  return now.getTime() - date.getTime() < 3600000;
}

function getItemConfig(item: FeedItem) {
  if (item.type === "nudge") {
    const severity = item.severity || "gentle";
    const configs = {
      gentle: {
        border: "border-blue-500/15",
        bg: "bg-blue-500/5",
        iconBg: "bg-blue-500/15",
        icon: <Bell className="h-3.5 w-3.5 text-blue-400" />,
      },
      firm: {
        border: "border-yellow-500/20",
        bg: "bg-yellow-500/5",
        iconBg: "bg-yellow-500/15",
        icon: <Bell className="h-3.5 w-3.5 text-yellow-400" />,
      },
      urgent: {
        border: "border-orange-500/25",
        bg: "bg-orange-500/5",
        iconBg: "bg-orange-500/20",
        icon: <Zap className="h-3.5 w-3.5 text-orange-400" />,
      },
      nuclear: {
        border: "border-red-500/30",
        bg: "bg-red-500/5",
        iconBg: "bg-red-500/20",
        icon: <AlertTriangle className="h-3.5 w-3.5 text-red-400" />,
      },
    };
    return configs[severity];
  }

  if (item.type === "insight") {
    return {
      border: "border-purple-500/15",
      bg: "bg-purple-500/5",
      iconBg: "bg-purple-500/15",
      icon: <Brain className="h-3.5 w-3.5 text-purple-400" />,
    };
  }

  if (item.type === "email") {
    return {
      border: "border-border/30",
      bg: "",
      iconBg: "bg-white/5",
      icon: <Mail className="h-3.5 w-3.5 text-muted-foreground" />,
    };
  }

  return {
    border: "border-emerald-500/15",
    bg: "bg-emerald-500/5",
    iconBg: "bg-emerald-500/15",
    icon: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />,
  };
}

function formatTimeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMs / 3600000);
  const diffD = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffH < 24) return `${diffH}h ago`;
  if (diffD === 1) return "yesterday";
  return `${diffD}d ago`;
}
