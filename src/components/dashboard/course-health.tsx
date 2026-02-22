"use client";

import {
  BarChart,
  Bar,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";

interface CourseHealthData {
  courseId: string;
  courseName: string;
  courseCode: string | null;
  color: string;
  average: number | null;
  letterGrade: string;
  gradeCount: number;
  recentGrades: { score: number; maxScore: number }[];
  trend: "improving" | "declining" | "stable" | "new";
  riskLevel: "on_track" | "warning" | "at_risk" | "critical";
  canvasScore: number | null;
}

interface CourseHealthGridProps {
  courses: CourseHealthData[];
  gpaTarget: number | null;
}

export function CourseHealthGrid({ courses, gpaTarget }: CourseHealthGridProps) {
  if (courses.length === 0) {
    return (
      <div className="flex h-[180px] items-center justify-center text-sm text-muted-foreground">
        No courses yet. Add courses from the Courses page or sync from Canvas.
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {courses.map((course) => (
        <CourseCard key={course.courseId} course={course} gpaTarget={gpaTarget} />
      ))}
    </div>
  );
}

function CourseCard({
  course,
  gpaTarget,
}: {
  course: CourseHealthData;
  gpaTarget: number | null;
}) {
  const displayScore = course.canvasScore ?? course.average;
  const targetPct = gpaTarget ? gpaToPercent(gpaTarget) : null;
  const isAboveTarget = displayScore !== null && targetPct !== null && displayScore >= targetPct;

  // Mini bar chart data from recent grades
  const miniData = course.recentGrades.slice(-6).map((g, i) => ({
    idx: i,
    pct: g.maxScore > 0 ? (g.score / g.maxScore) * 100 : 0,
  }));

  const riskColors = {
    on_track: "border-emerald-500/20",
    warning: "border-yellow-500/30",
    at_risk: "border-orange-500/30",
    critical: "border-red-500/40",
  };

  const riskBg = {
    on_track: "bg-emerald-500/5",
    warning: "bg-yellow-500/5",
    at_risk: "bg-orange-500/5",
    critical: "bg-red-500/5",
  };

  const riskIcons = {
    on_track: <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />,
    warning: <ShieldAlert className="h-3.5 w-3.5 text-yellow-400" />,
    at_risk: <AlertTriangle className="h-3.5 w-3.5 text-orange-400" />,
    critical: <AlertTriangle className="h-3.5 w-3.5 text-red-400" />,
  };

  const trendIcons = {
    improving: <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />,
    declining: <TrendingDown className="h-3.5 w-3.5 text-red-400" />,
    stable: <Minus className="h-3.5 w-3.5 text-muted-foreground" />,
    new: null,
  };

  return (
    <div
      className={`relative overflow-hidden rounded-xl border p-4 transition-all hover:scale-[1.01] ${riskColors[course.riskLevel]} ${riskBg[course.riskLevel]}`}
    >
      {/* Course color accent bar */}
      <div
        className="absolute left-0 top-0 h-full w-1 rounded-l-xl"
        style={{ backgroundColor: course.color }}
      />

      <div className="ml-2">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-semibold">{course.courseName}</span>
              {riskIcons[course.riskLevel]}
            </div>
            {course.courseCode && (
              <span className="text-xs text-muted-foreground">{course.courseCode}</span>
            )}
          </div>
          <div className="ml-2 text-right">
            <div className="text-2xl font-bold tracking-tight">{course.letterGrade}</div>
            {displayScore !== null && (
              <div className="text-xs text-muted-foreground">
                {displayScore.toFixed(1)}%
              </div>
            )}
          </div>
        </div>

        {/* Progress bar */}
        {displayScore !== null && (
          <div className="mt-3">
            <div className="relative h-2 w-full overflow-hidden rounded-full bg-white/5">
              <div
                className="absolute left-0 top-0 h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(displayScore, 100)}%`,
                  background: `linear-gradient(90deg, ${course.color}99, ${course.color})`,
                }}
              />
              {targetPct && (
                <div
                  className="absolute top-0 h-full w-0.5 bg-yellow-400/60"
                  style={{ left: `${Math.min(targetPct, 100)}%` }}
                  title={`GPA Target: ${gpaTarget}`}
                />
              )}
            </div>
            <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
              <div className="flex items-center gap-1">
                {trendIcons[course.trend]}
                <span className="capitalize">{course.trend}</span>
              </div>
              {targetPct && (
                <span className={isAboveTarget ? "text-emerald-400" : "text-yellow-400"}>
                  {isAboveTarget ? "Above" : "Below"} target
                </span>
              )}
            </div>
          </div>
        )}

        {/* Mini sparkline */}
        {miniData.length >= 2 && (
          <div className="mt-2 h-[32px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={miniData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <Bar dataKey="pct" radius={[2, 2, 0, 0]}>
                  {miniData.map((entry, index) => (
                    <Cell
                      key={index}
                      fill={
                        entry.pct >= 90
                          ? "#34d399"
                          : entry.pct >= 70
                            ? course.color
                            : entry.pct >= 60
                              ? "#fbbf24"
                              : "#ef4444"
                      }
                      fillOpacity={index === miniData.length - 1 ? 1 : 0.4}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="mt-1 text-[10px] text-muted-foreground">
          {course.gradeCount} grade{course.gradeCount !== 1 ? "s" : ""} recorded
          {course.canvasScore !== null && " (Canvas)"}
        </div>
      </div>
    </div>
  );
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
