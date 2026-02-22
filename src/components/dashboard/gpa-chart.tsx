"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface GradeDataPoint {
  date: string;
  label: string;
  percentage: number;
  course: string;
  courseColor: string;
}

interface GpaChartProps {
  gradeHistory: GradeDataPoint[];
  gpaTarget: number | null;
}

export function GpaChart({ gradeHistory, gpaTarget }: GpaChartProps) {
  if (gradeHistory.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
        No grade data yet. Grades will appear here as they sync from Canvas.
      </div>
    );
  }

  const courseMap = new Map<string, { color: string; points: { date: string; pct: number }[] }>();
  for (const g of gradeHistory) {
    const existing = courseMap.get(g.course);
    if (existing) {
      existing.points.push({ date: g.date, pct: g.percentage });
    } else {
      courseMap.set(g.course, {
        color: g.courseColor,
        points: [{ date: g.date, pct: g.percentage }],
      });
    }
  }

  const allDates = [...new Set(gradeHistory.map((g) => g.date))].sort();
  const courseNames = [...courseMap.keys()];

  const chartData = allDates.map((date) => {
    const point: Record<string, number | string> = { date: formatDate(date) };
    let totalPct = 0;
    let totalCourses = 0;

    for (const [courseName, courseData] of courseMap) {
      const gradesUpToDate = courseData.points.filter((p) => p.date <= date);
      if (gradesUpToDate.length > 0) {
        const avg =
          gradesUpToDate.reduce((s, g) => s + g.pct, 0) / gradesUpToDate.length;
        point[courseName] = Math.round(avg * 10) / 10;
        totalPct += avg;
        totalCourses++;
      }
    }

    if (totalCourses > 0) {
      point["Overall"] = Math.round((totalPct / totalCourses) * 10) / 10;
    }

    return point;
  });

  const colorMap: Record<string, string> = {};
  for (const [name, data] of courseMap) {
    colorMap[name] = data.color;
  }

  const targetPercent = gpaTarget ? gpaToPercent(gpaTarget) : null;

  return (
    <div className="animate-fade-in" style={{ animationDelay: "0.2s" }}>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="overallGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
            </linearGradient>
            {courseNames.map((name) => (
              <linearGradient key={name} id={`gradient-${name.replace(/\s/g, "")}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={colorMap[name] || "#6366f1"} stopOpacity={0.15} />
                <stop offset="95%" stopColor={colorMap[name] || "#6366f1"} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="date"
            tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }}
            axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "rgba(30, 30, 30, 0.95)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "8px",
              fontSize: "12px",
            }}
            labelStyle={{ color: "rgba(255,255,255,0.7)" }}
            formatter={(value) => [`${value}%`, ""]}
          />
          {targetPercent && (
            <Area
              type="monotone"
              dataKey={() => targetPercent}
              stroke="#facc15"
              strokeDasharray="6 4"
              strokeWidth={1}
              fill="none"
              name={`GPA Target (${gpaTarget})`}
              dot={false}
            />
          )}
          {courseNames.map((name) => (
            <Area
              key={name}
              type="monotone"
              dataKey={name}
              stroke={colorMap[name] || "#6366f1"}
              strokeWidth={1.5}
              fill={`url(#gradient-${name.replace(/\s/g, "")})`}
              dot={false}
              connectNulls
              name={name}
            />
          ))}
          <Area
            type="monotone"
            dataKey="Overall"
            stroke="#a78bfa"
            strokeWidth={2.5}
            fill="url(#overallGradient)"
            dot={false}
            connectNulls
            name="Overall Average"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function gpaToPercent(gpa: number): number {
  if (gpa >= 4.0) return 93;
  if (gpa >= 3.7) return 90;
  if (gpa >= 3.3) return 87;
  if (gpa >= 3.0) return 83;
  if (gpa >= 2.7) return 80;
  if (gpa >= 2.3) return 77;
  if (gpa >= 2.0) return 73;
  return 70;
}
