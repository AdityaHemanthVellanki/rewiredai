import { createClient } from "@/lib/supabase/server";
import {
  Clock,
  Bell,
  BookOpen,
  GraduationCap,
  Flame,
  Target,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { getEscalationBgColor } from "@/lib/agent/escalation";
import type { Assignment, Nudge, StudyBlock, Grade, Course } from "@/types";

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
    { data: nudges },
    { data: studyBlocks },
    { data: grades },
    { data: courses },
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase
      .from("assignments")
      .select("*, course:courses(*)")
      .eq("user_id", user.id)
      .neq("status", "completed")
      .order("due_date", { ascending: true })
      .limit(10),
    supabase
      .from("nudges")
      .select("*, assignment:assignments(*)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("study_blocks")
      .select("*")
      .eq("user_id", user.id)
      .gte("start_time", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .lte("start_time", new Date().toISOString()),
    supabase
      .from("grades")
      .select("*, course:courses(*)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase.from("courses").select("*").eq("user_id", user.id),
  ]);

  const typedAssignments = (assignments || []) as Assignment[];
  const typedNudges = (nudges || []) as Nudge[];
  const typedStudyBlocks = (studyBlocks || []) as StudyBlock[];
  const typedGrades = (grades || []) as Grade[];
  const typedCourses = (courses || []) as Course[];

  // Calculate study hours this week
  const studyHoursThisWeek = typedStudyBlocks
    .filter((sb) => sb.status === "completed")
    .reduce((total, sb) => {
      const start = new Date(sb.start_time).getTime();
      const end = new Date(sb.end_time).getTime();
      return total + (end - start) / (1000 * 60 * 60);
    }, 0);

  // Calculate course grades
  const courseGrades = typedCourses.map((course) => {
    const courseGradeList = typedGrades.filter((g) => g.course_id === course.id);
    if (courseGradeList.length === 0) return { course, average: null, letterGrade: "N/A" };

    let weightedSum = 0;
    let totalWeight = 0;
    for (const g of courseGradeList) {
      if (g.score !== null && g.max_score !== null && g.max_score > 0) {
        const pct = (g.score / g.max_score) * 100;
        const w = g.weight || 1;
        weightedSum += pct * w;
        totalWeight += w;
      }
    }
    const average = totalWeight > 0 ? weightedSum / totalWeight : null;
    return {
      course,
      average,
      letterGrade: average !== null ? getLetterGrade(average) : "N/A",
    };
  });

  // Find priority task
  const priorityTask = typedAssignments[0] || null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            Hey, {profile?.full_name?.split(" ")[0] || "there"} 👋
          </h1>
          <p className="text-muted-foreground">
            Here&apos;s what&apos;s going on in your life right now.
          </p>
        </div>
        {profile?.streak_count > 0 && (
          <div className="flex items-center gap-2 rounded-full bg-orange-500/10 px-4 py-2 text-orange-400">
            <Flame className="h-5 w-5" />
            <span className="text-sm font-bold">{profile.streak_count} day streak</span>
          </div>
        )}
      </div>

      {/* Priority Task */}
      {priorityTask && (
        <Card className="border-purple-500/30 bg-purple-500/5">
          <CardContent className="flex items-center gap-4 p-6">
            <Target className="h-8 w-8 text-purple-400" />
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-purple-400">
                Your Most Important Thing Right Now
              </p>
              <p className="text-lg font-semibold">{priorityTask.title}</p>
              <p className="text-sm text-muted-foreground">
                Due{" "}
                {formatRelativeDate(priorityTask.due_date)}
                {priorityTask.course && (
                  <span className="ml-2 text-purple-400">
                    • {(priorityTask.course as Course).name}
                  </span>
                )}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Upcoming Deadlines */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Upcoming Deadlines
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{typedAssignments.length}</div>
            <p className="text-xs text-muted-foreground">
              {typedAssignments.filter((a) => {
                const h = (new Date(a.due_date).getTime() - Date.now()) / 3600000;
                return h <= 72 && h > 0;
              }).length}{" "}
              due within 3 days
            </p>
          </CardContent>
        </Card>

        {/* Study Hours */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Study Hours This Week
            </CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {studyHoursThisWeek.toFixed(1)}h
            </div>
            <Progress value={Math.min((studyHoursThisWeek / 20) * 100, 100)} className="mt-2" />
            <p className="mt-1 text-xs text-muted-foreground">
              of 20h weekly target
            </p>
          </CardContent>
        </Card>

        {/* Active Nudges */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Nudges
            </CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {typedNudges.filter((n) => n.status === "pending" || n.status === "sent").length}
            </div>
            <p className="text-xs text-muted-foreground">
              {typedNudges.filter((n) => n.severity === "urgent" || n.severity === "nuclear").length}{" "}
              urgent
            </p>
          </CardContent>
        </Card>

        {/* Courses */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Courses
            </CardTitle>
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{typedCourses.length}</div>
            <p className="text-xs text-muted-foreground">
              {courseGrades.filter((c) => c.average !== null && c.average >= 80).length} on track
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Two-column layout */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upcoming Deadlines List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="h-5 w-5 text-purple-400" />
              Upcoming Deadlines
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {typedAssignments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No upcoming deadlines. Enjoy the peace!
              </p>
            ) : (
              typedAssignments.slice(0, 5).map((a) => {
                const hoursLeft =
                  (new Date(a.due_date).getTime() - Date.now()) / 3600000;
                return (
                  <div
                    key={a.id}
                    className="flex items-center justify-between rounded-lg border border-border/50 p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{a.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {a.course && (a.course as Course).name} •{" "}
                        {formatRelativeDate(a.due_date)}
                      </p>
                    </div>
                    <Badge
                      variant={hoursLeft <= 24 ? "destructive" : "secondary"}
                      className="ml-2 shrink-0"
                    >
                      {hoursLeft <= 0
                        ? "OVERDUE"
                        : hoursLeft <= 24
                          ? `${Math.round(hoursLeft)}h`
                          : `${Math.round(hoursLeft / 24)}d`}
                    </Badge>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Recent Nudges */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Bell className="h-5 w-5 text-purple-400" />
              Recent Nudges
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {typedNudges.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No nudges yet. Rewired is watching...
              </p>
            ) : (
              typedNudges.slice(0, 5).map((n) => (
                <div
                  key={n.id}
                  className={`rounded-lg border p-3 ${getEscalationBgColor(n.severity)}`}
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs capitalize">
                      {n.severity}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(n.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="mt-1 text-sm">{n.message}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Grade Overview */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <GraduationCap className="h-5 w-5 text-purple-400" />
              Grade Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            {courseGrades.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Add courses to start tracking your grades.
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {courseGrades.map(({ course, average, letterGrade }) => (
                  <div
                    key={course.id}
                    className="rounded-lg border border-border/50 p-4"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: course.color }}
                      />
                      <span className="text-sm font-medium">{course.name}</span>
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-2xl font-bold">{letterGrade}</span>
                      {average !== null && (
                        <span className="text-sm text-muted-foreground">
                          {average.toFixed(1)}%
                        </span>
                      )}
                    </div>
                    {average !== null && (
                      <Progress
                        value={average}
                        className="mt-2"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours < 0) return "overdue";
  if (diffHours < 1) return "in less than an hour";
  if (diffHours < 24) return `in ${Math.round(diffHours)} hours`;
  if (diffHours < 48) return "tomorrow";
  if (diffHours < 168) return `in ${Math.round(diffHours / 24)} days`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
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
