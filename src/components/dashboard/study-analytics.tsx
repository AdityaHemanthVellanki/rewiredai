"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { AnimatedCounter } from "@/components/ui/animated-counter";

interface StudyDay {
  day: string;
  dayShort: string;
  hours: number;
  blocks: number;
  isToday: boolean;
}

interface StudyAnalyticsProps {
  weekData: StudyDay[];
  totalHours: number;
  completedBlocks: number;
  skippedBlocks: number;
  weeklyTarget: number;
}

export function StudyAnalytics({
  weekData,
  totalHours,
  completedBlocks,
  skippedBlocks,
  weeklyTarget,
}: StudyAnalyticsProps) {
  const completionRate =
    completedBlocks + skippedBlocks > 0
      ? Math.round((completedBlocks / (completedBlocks + skippedBlocks)) * 100)
      : 0;

  const targetProgress = Math.min((totalHours / weeklyTarget) * 100, 100);

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg bg-purple-500/10 p-3 text-center hover-lift transition-all">
          <div className="text-xl font-bold text-purple-400">
            <AnimatedCounter value={totalHours} decimals={1} suffix="h" />
          </div>
          <div className="text-[10px] text-muted-foreground">studied</div>
        </div>
        <div className="rounded-lg bg-emerald-500/10 p-3 text-center hover-lift transition-all">
          <div className="text-xl font-bold text-emerald-400">
            <AnimatedCounter value={completionRate} suffix="%" />
          </div>
          <div className="text-[10px] text-muted-foreground">follow-through</div>
        </div>
        <div className="rounded-lg bg-blue-500/10 p-3 text-center hover-lift transition-all">
          <div className="text-xl font-bold text-blue-400">
            <AnimatedCounter value={completedBlocks} />
          </div>
          <div className="text-[10px] text-muted-foreground">sessions</div>
        </div>
      </div>

      {/* Weekly target bar */}
      <div>
        <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
          <span>Weekly target</span>
          <span>
            {totalHours.toFixed(1)} / {weeklyTarget}h
          </span>
        </div>
        <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-white/5">
          <div
            className="absolute left-0 top-0 h-full rounded-full animate-progress-fill"
            style={{
              ["--progress-target" as string]: `${targetProgress}%`,
              background:
                targetProgress >= 100
                  ? "linear-gradient(90deg, #34d399, #10b981)"
                  : targetProgress >= 60
                    ? "linear-gradient(90deg, #a78bfa, #8b5cf6)"
                    : "linear-gradient(90deg, #fbbf24, #f59e0b)",
            }}
          />
        </div>
      </div>

      {/* Bar chart */}
      <div className="h-[140px] animate-fade-in" style={{ animationDelay: "0.3s" }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={weekData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <XAxis
              dataKey="dayShort"
              tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${v}h`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "rgba(30, 30, 30, 0.95)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              formatter={(value) => [`${Number(value).toFixed(1)}h`, "Study time"]}
              labelFormatter={(label) => label}
            />
            <Bar dataKey="hours" radius={[4, 4, 0, 0]} maxBarSize={32}>
              {weekData.map((entry, index) => (
                <Cell
                  key={index}
                  fill={
                    entry.isToday
                      ? "#a78bfa"
                      : entry.hours > 0
                        ? "#6366f1"
                        : "rgba(255,255,255,0.05)"
                  }
                  fillOpacity={entry.isToday ? 1 : 0.7}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
