import { createClient } from "@/lib/supabase/server";
import {
  Clock,
  GraduationCap,
  Flame,
  Target,
  Brain,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  BarChart3,
  CalendarDays,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Assignment, Nudge, StudyBlock, Grade, Course, EmailSummary } from "@/types";

// Dashboard visualization components
import { GpaChart } from "@/components/dashboard/gpa-chart";
import { CourseHealthGrid } from "@/components/dashboard/course-health";
import { StudyAnalytics } from "@/components/dashboard/study-analytics";
import { DeadlinePipeline } from "@/components/dashboard/deadline-pipeline";
import { TodaysPlan } from "@/components/dashboard/todays-plan";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { DashboardShell, DashboardSection } from "@/components/dashboard/dashboard-shell";
import { AnimatedCounter } from "@/components/ui/animated-counter";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Fetch all dashboard data in parallel
  const [
    { data: profile },
    { data: assignments },
    { data: completedAssignments },
    { data: nudges },
    { data: studyBlocks },
    { data: todayStudyBlocks },
    { data: grades },
    { data: courses },
    { data: emailSummaries },
    { data: agentLogs },
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase
      .from("assignments")
      .select("*, course:courses(*)")
      .eq("user_id", user.id)
      .neq("status", "completed")
      .order("due_date", { ascending: true })
      .limit(15),
    supabase
      .from("assignments")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "completed")
      .gte(
        "created_at",
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      ),
    supabase
      .from("nudges")
      .select("*, assignment:assignments(*)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(8),
    // Study blocks from past 14 days for analytics
    supabase
      .from("study_blocks")
      .select("*, course:courses(*)")
      .eq("user_id", user.id)
      .gte(
        "start_time",
        new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
      ),
    // Today's study blocks
    supabase
      .from("study_blocks")
      .select("*, course:courses(*)")
      .eq("user_id", user.id)
      .gte("start_time", new Date().toISOString().split("T")[0] + "T00:00:00")
      .lte("start_time", new Date().toISOString().split("T")[0] + "T23:59:59")
      .order("start_time"),
    supabase
      .from("grades")
      .select("*, course:courses(*)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true }),
    supabase.from("courses").select("*").eq("user_id", user.id),
    supabase
      .from("email_summaries")
      .select("*")
      .eq("user_id", user.id)
      .order("received_at", { ascending: false })
      .limit(5),
    supabase
      .from("agent_activity_log")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(3),
  ]);

  const typedAssignments = (assignments || []) as Assignment[];
  const typedNudges = (nudges || []) as Nudge[];
  const allStudyBlocks = (studyBlocks || []) as StudyBlock[];
  const typedGrades = (grades || []) as Grade[];
  const typedCourses = (courses || []) as Course[];
  const typedEmails = (emailSummaries || []) as EmailSummary[];
  const typedTodayBlocks = (todayStudyBlocks || []) as StudyBlock[];
  const completedThisWeek = (completedAssignments || []).length;

  // Suppress unused variable warnings
  void agentLogs;

  // ====== DATA PROCESSING ======

  // 1. Study hours — this week (Monday to now)
  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const mondayStart = new Date(now);
  mondayStart.setDate(now.getDate() - mondayOffset);
  mondayStart.setHours(0, 0, 0, 0);

  const thisWeekBlocks = allStudyBlocks.filter(
    (sb) => new Date(sb.start_time) >= mondayStart && new Date(sb.start_time) <= now
  );

  const studyHoursThisWeek = thisWeekBlocks
    .filter((sb) => sb.status === "completed")
    .reduce((total, sb) => {
      const start = new Date(sb.start_time).getTime();
      const end = new Date(sb.end_time).getTime();
      return total + (end - start) / (1000 * 60 * 60);
    }, 0);

  // Build per-day study data for the week chart
  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const weekData = dayNames.map((dayShort, i) => {
    const dayDate = new Date(mondayStart);
    dayDate.setDate(mondayStart.getDate() + i);
    const dayStr = dayDate.toISOString().split("T")[0];

    const dayBlocks = thisWeekBlocks.filter((sb) => {
      const blockDate = new Date(sb.start_time).toISOString().split("T")[0];
      return blockDate === dayStr && sb.status === "completed";
    });

    const hours = dayBlocks.reduce((total, sb) => {
      const start = new Date(sb.start_time).getTime();
      const end = new Date(sb.end_time).getTime();
      return total + (end - start) / (1000 * 60 * 60);
    }, 0);

    return {
      day: dayStr,
      dayShort,
      hours: Math.round(hours * 10) / 10,
      blocks: dayBlocks.length,
      isToday: dayDate.toISOString().split("T")[0] === now.toISOString().split("T")[0],
    };
  });

  const completedBlocks = thisWeekBlocks.filter((sb) => sb.status === "completed").length;
  const skippedBlocks = thisWeekBlocks.filter((sb) => sb.status === "skipped").length;

  // 2. Course grades + health data
  const courseHealthData = typedCourses.map((course) => {
    const courseGradeList = typedGrades.filter((g) => g.course_id === course.id);
    const validGrades = courseGradeList.filter(
      (g) => g.score !== null && g.max_score !== null && g.max_score > 0
    );

    let average: number | null = null;
    if (validGrades.length > 0) {
      let earned = 0;
      let possible = 0;
      for (const g of validGrades) {
        earned += g.score!;
        possible += g.max_score!;
      }
      average = (earned / possible) * 100;
    }

    // Determine trend from last 3 vs previous 3
    let trend: "improving" | "declining" | "stable" | "new" = "new";
    if (validGrades.length >= 4) {
      const sorted = [...validGrades].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      const recent = sorted.slice(0, 3);
      const older = sorted.slice(-3);
      const recentAvg =
        recent.reduce((s, g) => s + g.score! / g.max_score!, 0) / recent.length;
      const olderAvg =
        older.reduce((s, g) => s + g.score! / g.max_score!, 0) / older.length;
      if (recentAvg > olderAvg + 0.03) trend = "improving";
      else if (recentAvg < olderAvg - 0.03) trend = "declining";
      else trend = "stable";
    } else if (validGrades.length > 0) {
      trend = "stable";
    }

    // Risk level
    let riskLevel: "on_track" | "warning" | "at_risk" | "critical" = "on_track";
    const targetPct = profile?.gpa_target
      ? gpaToPercent(profile.gpa_target)
      : 80;
    if (average !== null) {
      if (average < 60) riskLevel = "critical";
      else if (average < 70) riskLevel = "at_risk";
      else if (average < targetPct) riskLevel = "warning";
    }

    return {
      courseId: course.id,
      courseName: course.name,
      courseCode: course.code,
      color: course.color,
      average,
      letterGrade: average !== null ? getLetterGrade(average) : "N/A",
      gradeCount: validGrades.length,
      recentGrades: validGrades.slice(-6).map((g) => ({
        score: g.score!,
        maxScore: g.max_score!,
      })),
      trend,
      riskLevel,
      canvasScore: null as number | null,
    };
  });

  // 3. GPA chart data
  const gradeHistory = typedGrades
    .filter((g) => g.score !== null && g.max_score !== null && g.max_score > 0)
    .map((g) => ({
      date: g.created_at,
      label: g.title,
      percentage: Math.round((g.score! / g.max_score!) * 1000) / 10,
      course: g.course?.name || "Unknown",
      courseColor: g.course?.color || "#6366f1",
    }));

  // 4. Deadline pipeline
  const deadlinePipeline = typedAssignments.slice(0, 8).map((a) => {
    const hoursLeft =
      (new Date(a.due_date).getTime() - Date.now()) / (1000 * 60 * 60);
    const isOverdue = a.status === "overdue" || hoursLeft < 0;

    let status: "overdue" | "urgent" | "soon" | "upcoming" | "later";
    if (isOverdue) status = "overdue";
    else if (hoursLeft <= 24) status = "urgent";
    else if (hoursLeft <= 72) status = "soon";
    else if (hoursLeft <= 168) status = "upcoming";
    else status = "later";

    return {
      id: a.id,
      title: a.title,
      courseName: a.course ? (a.course as Course).name : "General",
      courseColor: a.course ? (a.course as Course).color : "#6366f1",
      dueDate: a.due_date,
      hoursLeft,
      status,
      weight: a.weight,
      isOverdue,
    };
  });

  // 5. Today's plan — combine study blocks + deadlines due today
  const todayStr = now.toISOString().split("T")[0];
  const todayPlanItems = buildTodaysPlan(
    typedTodayBlocks,
    typedAssignments,
    todayStr,
    courseHealthData
  );

  // 6. Priority task — grade-risk-aware
  const priorityTask = computePriorityTask(typedAssignments, courseHealthData);

  // 7. Activity feed
  const feedItems = buildActivityFeed(typedNudges, typedEmails);

  // 8. Smart greeting + insight
  const firstName = profile?.full_name?.split(" ")[0] || "there";
  const greeting = buildGreeting(
    firstName,
    typedAssignments,
    courseHealthData,
    studyHoursThisWeek,
    completedThisWeek
  );
  const topInsight = buildTopInsight(
    typedAssignments,
    courseHealthData,
    studyHoursThisWeek
  );

  // 9. Overall stats
  const overdueCount = typedAssignments.filter(
    (a) => a.status === "overdue"
  ).length;
  const coursesAtRisk = courseHealthData.filter(
    (c) => c.riskLevel === "at_risk" || c.riskLevel === "critical"
  ).length;
  const overallGpa = computeOverallGpa(courseHealthData);

  return (
    <DashboardShell>
      {/* ====== HEADER ====== */}
      <DashboardSection>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Dashboard
            </h1>
            <p className="text-sm text-muted-foreground">
              {now.toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {profile?.streak_count > 0 && (
              <div className="flex items-center gap-1.5 rounded-full bg-orange-500/10 px-3 py-1.5 text-orange-400 hover-lift">
                <Flame className="h-4 w-4" />
                <span className="text-sm font-bold">{profile.streak_count}d</span>
              </div>
            )}
            {overallGpa !== null && (
              <div className="flex items-center gap-1.5 rounded-full bg-purple-500/10 px-3 py-1.5 text-purple-400 hover-lift">
                <GraduationCap className="h-4 w-4" />
                <span className="text-sm font-bold">{overallGpa}</span>
              </div>
            )}
          </div>
        </div>
      </DashboardSection>

      {/* ====== HERO: PRIORITY + QUICK STATS ====== */}
      <DashboardSection>
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Priority Task — big hero card */}
          {priorityTask ? (
            <Card className="relative overflow-hidden border-purple-500/20 bg-gradient-to-br from-purple-500/10 via-transparent to-indigo-500/5 lg:col-span-2 hover-lift animate-glow-pulse">
              <div className="absolute right-0 top-0 h-32 w-32 bg-purple-500/5 blur-3xl" />
              <CardContent className="relative flex items-center gap-5 p-6">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-purple-500/15">
                  <Target className="h-7 w-7 text-purple-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-purple-400/80">
                    Focus right now
                  </p>
                  <p className="mt-1 truncate text-lg font-bold">
                    {priorityTask.title}
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {priorityTask.reason}
                  </p>
                </div>
                <a
                  href="/chat"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-500/15 text-purple-400 transition-all hover:bg-purple-500/25 hover:scale-110 active-press"
                >
                  <ArrowRight className="h-5 w-5" />
                </a>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-emerald-500/20 bg-emerald-500/5 lg:col-span-2 hover-lift">
              <CardContent className="flex items-center gap-4 p-6">
                <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                <div>
                  <p className="text-sm font-medium text-emerald-400">
                    All caught up!
                  </p>
                  <p className="text-sm text-muted-foreground">
                    No urgent tasks. Great job staying on top of things.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quick Stats Column */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-1 lg:gap-3">
            <div className="flex items-center gap-3 rounded-xl border border-border/40 p-3 hover-lift transition-all">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-500/10">
                <Clock className="h-4 w-4 text-orange-400" />
              </div>
              <div>
                <div className="text-lg font-bold leading-none">
                  <AnimatedCounter value={typedAssignments.length} />
                </div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">
                  deadlines
                  {overdueCount > 0 && (
                    <span className="ml-1 text-red-400 animate-overdue-pulse">
                      ({overdueCount} overdue)
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-xl border border-border/40 p-3 hover-lift transition-all">
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                  coursesAtRisk > 0 ? "bg-red-500/10" : "bg-emerald-500/10"
                }`}
              >
                {coursesAtRisk > 0 ? (
                  <AlertTriangle className="h-4 w-4 text-red-400" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                )}
              </div>
              <div>
                <div className="text-lg font-bold leading-none">
                  <AnimatedCounter value={coursesAtRisk > 0 ? coursesAtRisk : typedCourses.length} />
                </div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">
                  {coursesAtRisk > 0 ? "courses at risk" : "courses on track"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </DashboardSection>

      {/* ====== TODAY'S PLAN ====== */}
      <DashboardSection>
        <Card className="border-border/30 hover-lift">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base gradient-underline">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-purple-500/20 to-blue-500/20">
                <Sparkles className="h-3.5 w-3.5 text-purple-400" />
              </div>
              Today&apos;s Plan
              <Badge variant="secondary" className="ml-auto text-[10px]">
                AI-Powered
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TodaysPlan
              planItems={todayPlanItems}
              greeting={greeting}
              topInsight={topInsight}
            />
          </CardContent>
        </Card>
      </DashboardSection>

      {/* ====== MAIN GRID: GRADES + STUDY ====== */}
      <DashboardSection>
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Grade Performance */}
          <Card className="border-border/30 hover-lift">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base gradient-underline">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-purple-500/15">
                  <TrendingUp className="h-3.5 w-3.5 text-purple-400" />
                </div>
                Grade Trajectory
                {profile?.gpa_target && (
                  <span className="ml-auto text-xs font-normal text-muted-foreground">
                    Target: {profile.gpa_target} GPA
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <GpaChart
                gradeHistory={gradeHistory}
                gpaTarget={profile?.gpa_target || null}
              />
            </CardContent>
          </Card>

          {/* Study Analytics */}
          <Card className="border-border/30 hover-lift">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base gradient-underline">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-500/15">
                  <BarChart3 className="h-3.5 w-3.5 text-blue-400" />
                </div>
                Study Analytics
                <span className="ml-auto text-xs font-normal text-muted-foreground">
                  this week
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <StudyAnalytics
                weekData={weekData}
                totalHours={studyHoursThisWeek}
                completedBlocks={completedBlocks}
                skippedBlocks={skippedBlocks}
                weeklyTarget={20}
              />
            </CardContent>
          </Card>
        </div>
      </DashboardSection>

      {/* ====== COURSE HEALTH GRID ====== */}
      <DashboardSection>
        <Card className="border-border/30 hover-lift">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base gradient-underline">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-500/15">
                <GraduationCap className="h-3.5 w-3.5 text-indigo-400" />
              </div>
              Course Health
              <span className="ml-auto text-xs font-normal text-muted-foreground">
                {courseHealthData.filter((c) => c.average !== null).length} of{" "}
                {courseHealthData.length} with grades
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CourseHealthGrid
              courses={courseHealthData}
              gpaTarget={profile?.gpa_target || null}
            />
          </CardContent>
        </Card>
      </DashboardSection>

      {/* ====== BOTTOM: DEADLINES + ACTIVITY FEED ====== */}
      <DashboardSection>
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Deadline Pipeline */}
          <Card className="border-border/30 hover-lift">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base gradient-underline">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-orange-500/15">
                  <CalendarDays className="h-3.5 w-3.5 text-orange-400" />
                </div>
                Deadline Pipeline
                <Badge
                  variant={overdueCount > 0 ? "destructive" : "secondary"}
                  className="ml-auto text-[10px]"
                >
                  {typedAssignments.length} active
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DeadlinePipeline deadlines={deadlinePipeline} />
            </CardContent>
          </Card>

          {/* Activity Feed */}
          <Card className="border-border/30 hover-lift">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base gradient-underline">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500/15">
                  <Brain className="h-3.5 w-3.5 text-emerald-400" />
                </div>
                Agent Activity
                <a
                  href="/chat"
                  className="ml-auto flex items-center gap-1 text-xs font-normal text-purple-400 hover:text-purple-300 transition-colors"
                >
                  Chat <ArrowRight className="h-3 w-3" />
                </a>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ActivityFeed items={feedItems} />
            </CardContent>
          </Card>
        </div>
      </DashboardSection>
    </DashboardShell>
  );
}

// ====== HELPER FUNCTIONS ======

function buildTodaysPlan(
  todayBlocks: StudyBlock[],
  assignments: Assignment[],
  todayStr: string,
  courseHealth: Array<{
    courseId: string;
    courseName: string;
    color: string;
    riskLevel: string;
    average: number | null;
  }>
) {
  const items: Array<{
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
  }> = [];

  // Add study blocks
  for (const sb of todayBlocks) {
    const courseInfo = courseHealth.find((c) => c.courseId === sb.course_id);
    const isAtRisk =
      courseInfo?.riskLevel === "at_risk" || courseInfo?.riskLevel === "critical";

    items.push({
      id: sb.id,
      type: sb.google_event_id ? "event" : "study",
      title: sb.title,
      courseName: courseInfo?.courseName || sb.course?.name,
      courseColor: courseInfo?.color || sb.course?.color,
      startTime: sb.start_time,
      endTime: sb.end_time,
      reason: isAtRisk
        ? `${courseInfo?.courseName} needs attention — grade is at ${courseInfo?.average?.toFixed(1) ?? "?"}%`
        : "Scheduled study session to stay on track",
      priority: isAtRisk ? "high" : "medium",
      isCompleted: sb.status === "completed",
    });
  }

  // Add deadlines due today
  const todayDeadlines = assignments.filter(
    (a) => a.due_date.startsWith(todayStr) && a.status !== "completed"
  );
  for (const a of todayDeadlines) {
    const courseInfo = courseHealth.find((c) => c.courseId === a.course_id);
    items.push({
      id: `deadline-${a.id}`,
      type: "deadline",
      title: a.title,
      courseName: a.course ? (a.course as Course).name : undefined,
      courseColor: courseInfo?.color || a.course?.color,
      startTime: a.due_date,
      reason: a.weight
        ? `Worth ${a.weight} points — don't miss this deadline`
        : "Due today — make sure this is submitted",
      priority: "high",
    });
  }

  // Sort by time
  items.sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );

  return items;
}

function computePriorityTask(
  assignments: Assignment[],
  courseHealth: Array<{
    courseId: string;
    courseName: string;
    riskLevel: string;
    average: number | null;
  }>
) {
  const pending = assignments
    .filter((a) => a.status !== "completed")
    .sort((a, b) => {
      const aDate = new Date(a.due_date).getTime();
      const bDate = new Date(b.due_date).getTime();
      const aWeight = a.weight || 0;
      const bWeight = b.weight || 0;

      const aRisk = courseHealth.find((c) => c.courseId === a.course_id);
      const bRisk = courseHealth.find((c) => c.courseId === b.course_id);
      const aRiskBoost =
        aRisk?.riskLevel === "critical"
          ? 3
          : aRisk?.riskLevel === "at_risk"
            ? 2
            : aRisk?.riskLevel === "warning"
              ? 1.5
              : 1;
      const bRiskBoost =
        bRisk?.riskLevel === "critical"
          ? 3
          : bRisk?.riskLevel === "at_risk"
            ? 2
            : bRisk?.riskLevel === "warning"
              ? 1.5
              : 1;

      const aScore =
        (1 / Math.max(aDate - Date.now(), 1)) *
        (1 + aWeight) *
        aRiskBoost *
        (1 + a.ignored_count * 0.5);
      const bScore =
        (1 / Math.max(bDate - Date.now(), 1)) *
        (1 + bWeight) *
        bRiskBoost *
        (1 + b.ignored_count * 0.5);
      return bScore - aScore;
    });

  if (pending.length === 0) return null;

  const top = pending[0];
  const hoursLeft = Math.round(
    (new Date(top.due_date).getTime() - Date.now()) / (1000 * 60 * 60)
  );
  const courseInfo = courseHealth.find((c) => c.courseId === top.course_id);
  const riskNote =
    courseInfo && (courseInfo.riskLevel === "at_risk" || courseInfo.riskLevel === "critical")
      ? ` — ${courseInfo.courseName} at ${courseInfo.average?.toFixed(1)}%`
      : "";

  const courseName = top.course ? (top.course as Course).name : "";

  return {
    title: top.title,
    reason:
      top.status === "overdue"
        ? `OVERDUE${riskNote}${courseName ? ` • ${courseName}` : ""}`
        : hoursLeft <= 0
          ? `OVERDUE${riskNote}`
          : `Due in ${hoursLeft < 24 ? `${hoursLeft} hours` : `${Math.round(hoursLeft / 24)} days`}${
              top.weight ? ` • ${top.weight} pts` : ""
            }${riskNote}${courseName ? ` • ${courseName}` : ""}`,
  };
}

function buildActivityFeed(nudges: Nudge[], emails: EmailSummary[]) {
  const items: Array<{
    id: string;
    type: "nudge" | "insight" | "email" | "achievement";
    title: string;
    message: string;
    severity?: "gentle" | "firm" | "urgent" | "nuclear";
    category?: string;
    timestamp: string;
    actionUrl?: string;
  }> = [];

  for (const n of nudges.slice(0, 4)) {
    items.push({
      id: n.id,
      type: "nudge",
      title:
        n.severity === "nuclear"
          ? "Critical Alert"
          : n.severity === "urgent"
            ? "Urgent Nudge"
            : "Reminder",
      message: n.message,
      severity: n.severity,
      timestamp: n.created_at,
    });
  }

  for (const e of emails.filter((e) => e.action_required).slice(0, 3)) {
    items.push({
      id: e.id,
      type: "email",
      title: e.subject,
      message: e.summary,
      category: e.category,
      timestamp: e.received_at,
    });
  }

  // Sort by time, newest first
  items.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return items.slice(0, 6);
}

function buildGreeting(
  firstName: string,
  assignments: Assignment[],
  courseHealth: Array<{ riskLevel: string }>,
  studyHours: number,
  completedThisWeek: number
): string {
  const now = new Date();
  const hour = now.getHours();
  const timeGreeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const overdueCount = assignments.filter((a) => a.status === "overdue").length;
  const atRiskCount = courseHealth.filter(
    (c) => c.riskLevel === "at_risk" || c.riskLevel === "critical"
  ).length;

  if (overdueCount > 0 && atRiskCount > 0) {
    return `${timeGreeting}, ${firstName}. You have ${overdueCount} overdue assignment${overdueCount > 1 ? "s" : ""} and ${atRiskCount} course${atRiskCount > 1 ? "s" : ""} that need attention. Let's get you back on track.`;
  }
  if (overdueCount > 0) {
    return `${timeGreeting}, ${firstName}. You have ${overdueCount} overdue item${overdueCount > 1 ? "s" : ""} — let's tackle ${overdueCount === 1 ? "it" : "them"} first.`;
  }
  if (completedThisWeek >= 3) {
    return `${timeGreeting}, ${firstName}! You've crushed ${completedThisWeek} assignments this week. Keep that momentum going.`;
  }
  if (studyHours >= 10) {
    return `${timeGreeting}, ${firstName}. ${studyHours.toFixed(1)} study hours logged this week — solid work.`;
  }
  return `${timeGreeting}, ${firstName}. Here's your personalized plan for today.`;
}

function buildTopInsight(
  assignments: Assignment[],
  courseHealth: Array<{ courseName: string; riskLevel: string; average: number | null }>,
  studyHours: number
): string | null {
  const critical = courseHealth.find((c) => c.riskLevel === "critical");
  if (critical) {
    return `${critical.courseName} is at ${critical.average?.toFixed(1)}% — focus your study time here to bring it back up.`;
  }

  const urgentDeadlines = assignments.filter((a) => {
    const h = (new Date(a.due_date).getTime() - Date.now()) / 3600000;
    return h > 0 && h <= 24 && a.status !== "completed";
  });
  if (urgentDeadlines.length > 0) {
    return `${urgentDeadlines.length} deadline${urgentDeadlines.length > 1 ? "s" : ""} in the next 24 hours. Prioritize ${urgentDeadlines[0].title}.`;
  }

  const atRisk = courseHealth.filter((c) => c.riskLevel === "at_risk");
  if (atRisk.length > 0) {
    return `${atRisk.map((c) => c.courseName).join(" and ")} ${atRisk.length > 1 ? "are" : "is"} at risk — schedule extra study sessions.`;
  }

  if (studyHours < 5 && assignments.length > 3) {
    return `Only ${studyHours.toFixed(1)} study hours this week with ${assignments.length} pending assignments. Time to ramp up.`;
  }

  return null;
}

function computeOverallGpa(
  courseHealth: Array<{ average: number | null; letterGrade: string }>
): string | null {
  const withGrades = courseHealth.filter((c) => c.average !== null);
  if (withGrades.length === 0) return null;

  const totalPct =
    withGrades.reduce((sum, c) => sum + c.average!, 0) / withGrades.length;

  if (totalPct >= 93) return "4.0";
  if (totalPct >= 90) return "3.7";
  if (totalPct >= 87) return "3.3";
  if (totalPct >= 83) return "3.0";
  if (totalPct >= 80) return "2.7";
  if (totalPct >= 77) return "2.3";
  if (totalPct >= 73) return "2.0";
  if (totalPct >= 70) return "1.7";
  if (totalPct >= 67) return "1.3";
  if (totalPct >= 60) return "1.0";
  return "0.0";
}

function getLetterGrade(pct: number): string {
  if (pct >= 93) return "A";
  if (pct >= 90) return "A-";
  if (pct >= 87) return "B+";
  if (pct >= 83) return "B";
  if (pct >= 80) return "B-";
  if (pct >= 77) return "C+";
  if (pct >= 73) return "C";
  if (pct >= 70) return "C-";
  if (pct >= 67) return "D+";
  if (pct >= 60) return "D";
  return "F";
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
