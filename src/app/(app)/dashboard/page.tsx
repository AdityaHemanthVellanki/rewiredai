import { createClient } from "@/lib/supabase/server";
import {
  Clock,
  Bell,
  BookOpen,
  GraduationCap,
  Flame,
  Target,
  Mail,
  Brain,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { getEscalationBgColor } from "@/lib/agent/escalation";
import type { Assignment, Nudge, StudyBlock, Grade, Course, EmailSummary } from "@/types";

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
    { data: grades },
    { data: courses },
    { data: emailSummaries },
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
      .from("assignments")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "completed")
      .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
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
    supabase
      .from("email_summaries")
      .select("*")
      .eq("user_id", user.id)
      .order("received_at", { ascending: false })
      .limit(5),
  ]);

  const typedAssignments = (assignments || []) as Assignment[];
  const typedNudges = (nudges || []) as Nudge[];
  const typedStudyBlocks = (studyBlocks || []) as StudyBlock[];
  const typedGrades = (grades || []) as Grade[];
  const typedCourses = (courses || []) as Course[];
  const typedEmails = (emailSummaries || []) as EmailSummary[];
  const completedThisWeek = (completedAssignments || []).length;

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

  // Smart priority task: score by urgency * importance * ignored_count
  const priorityTask = typedAssignments
    .filter((a) => a.status !== "completed")
    .sort((a, b) => {
      const aHours = Math.max(
        (new Date(a.due_date).getTime() - Date.now()) / 3600000,
        0.1
      );
      const bHours = Math.max(
        (new Date(b.due_date).getTime() - Date.now()) / 3600000,
        0.1
      );
      const aScore = (1 / aHours) * (1 + (a.weight || 0)) * (1 + a.ignored_count * 0.5);
      const bScore = (1 / bHours) * (1 + (b.weight || 0)) * (1 + b.ignored_count * 0.5);
      return bScore - aScore;
    })[0] || null;

  // Generate quick insights
  const insights = generateInsights(
    typedAssignments,
    typedGrades,
    courseGrades,
    studyHoursThisWeek,
    completedThisWeek,
    typedEmails
  );

  // Separate pending vs overdue for display
  const overdueCount = typedAssignments.filter((a) => a.status === "overdue").length;
  const pendingAssignments = typedAssignments.filter((a) => a.status !== "overdue");

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
                {priorityTask.status === "overdue" ? (
                  <span className="text-red-400">OVERDUE</span>
                ) : (
                  <>Due {formatRelativeDate(priorityTask.due_date)}</>
                )}
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

      {/* Agent Insights */}
      {insights.length > 0 && (
        <Card className="border-blue-500/20 bg-blue-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Brain className="h-4 w-4 text-blue-400" />
              <span className="text-blue-400">Agent Insights</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {insights.map((insight, i) => (
              <div key={i} className="flex items-start gap-2">
                {insight.type === "warning" ? (
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange-400" />
                ) : (
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-400" />
                )}
                <p className="text-sm text-muted-foreground">{insight.message}</p>
              </div>
            ))}
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
            <div className="text-2xl font-bold">{pendingAssignments.length}</div>
            <p className="text-xs text-muted-foreground">
              {pendingAssignments.filter((a) => {
                const h = (new Date(a.due_date).getTime() - Date.now()) / 3600000;
                return h <= 72 && h > 0;
              }).length}{" "}
              due within 3 days
              {overdueCount > 0 && (
                <span className="ml-1 text-red-400">
                  • {overdueCount} overdue
                </span>
              )}
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
                const isOverdue = a.status === "overdue";
                return (
                  <div
                    key={a.id}
                    className={`flex items-center justify-between rounded-lg border p-3 ${
                      isOverdue
                        ? "border-red-500/30 bg-red-500/5"
                        : "border-border/50"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{a.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {a.course && (a.course as Course).name} •{" "}
                        {formatRelativeDate(a.due_date)}
                      </p>
                    </div>
                    <Badge
                      variant={isOverdue || hoursLeft <= 24 ? "destructive" : "secondary"}
                      className="ml-2 shrink-0"
                    >
                      {isOverdue
                        ? "OVERDUE"
                        : hoursLeft <= 0
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

        {/* Recent Nudges & Emails */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              {typedNudges.length > 0 ? (
                <Bell className="h-5 w-5 text-purple-400" />
              ) : (
                <Mail className="h-5 w-5 text-purple-400" />
              )}
              {typedNudges.length > 0 ? "Recent Nudges" : "Latest Emails"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {typedNudges.length > 0 ? (
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
            ) : typedEmails.length > 0 ? (
              typedEmails.slice(0, 5).map((e) => (
                <div
                  key={e.id}
                  className="rounded-lg border border-border/50 p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">{e.subject}</p>
                    <Badge
                      variant="outline"
                      className={`shrink-0 text-xs capitalize ${
                        e.category === "professor"
                          ? "border-blue-500/30 text-blue-400"
                          : e.category === "financial_aid"
                            ? "border-green-500/30 text-green-400"
                            : e.category === "campus_admin"
                              ? "border-yellow-500/30 text-yellow-400"
                              : "text-muted-foreground"
                      }`}
                    >
                      {e.category.replace("_", " ")}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    From: {e.from}
                  </p>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {e.summary}
                  </p>
                  {e.action_required && (
                    <p className="mt-1 text-xs font-medium text-orange-400">
                      Action needed{e.suggested_action ? `: ${e.suggested_action}` : ""}
                    </p>
                  )}
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                No nudges or emails yet. Sync your emails from Settings to get started.
              </p>
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

// Generate deterministic insights from available data
function generateInsights(
  assignments: Assignment[],
  grades: Grade[],
  courseGrades: { course: Course; average: number | null; letterGrade: string }[],
  studyHours: number,
  completedThisWeek: number,
  emails: EmailSummary[]
): { message: string; type: "info" | "warning" }[] {
  const insights: { message: string; type: "info" | "warning" }[] = [];

  // Overdue assignments warning
  const overdueCount = assignments.filter((a) => a.status === "overdue").length;
  if (overdueCount > 0) {
    insights.push({
      message: `You have ${overdueCount} overdue assignment${overdueCount > 1 ? "s" : ""}. Check if you can still submit late — talk to your professor.`,
      type: "warning",
    });
  }

  // Assignments due within 24 hours
  const urgentCount = assignments.filter((a) => {
    const h = (new Date(a.due_date).getTime() - Date.now()) / 3600000;
    return h > 0 && h <= 24 && a.status !== "completed";
  }).length;
  if (urgentCount > 0) {
    insights.push({
      message: `${urgentCount} assignment${urgentCount > 1 ? "s" : ""} due in the next 24 hours. Focus time!`,
      type: "warning",
    });
  }

  // Dropping grades
  const droppingCourses = courseGrades.filter(
    (c) => c.average !== null && c.average < 70
  );
  if (droppingCourses.length > 0) {
    insights.push({
      message: `Your grade in ${droppingCourses.map((c) => c.course.name).join(", ")} is below C. Consider scheduling extra study time.`,
      type: "warning",
    });
  }

  // Study hours tracking
  if (studyHours >= 15) {
    insights.push({
      message: `Great work! You've studied ${studyHours.toFixed(1)} hours this week.`,
      type: "info",
    });
  } else if (studyHours < 5 && assignments.length > 3) {
    insights.push({
      message: `Only ${studyHours.toFixed(1)} study hours logged this week with ${assignments.length} pending assignments. Time to ramp up.`,
      type: "warning",
    });
  }

  // Completed assignments this week
  if (completedThisWeek > 0) {
    insights.push({
      message: `You completed ${completedThisWeek} assignment${completedThisWeek > 1 ? "s" : ""} this week. Keep it up!`,
      type: "info",
    });
  }

  // Action-required emails
  const actionEmails = emails.filter((e) => e.action_required);
  if (actionEmails.length > 0) {
    insights.push({
      message: `${actionEmails.length} email${actionEmails.length > 1 ? "s" : ""} need${actionEmails.length === 1 ? "s" : ""} your attention${actionEmails[0].suggested_action ? `: "${actionEmails[0].suggested_action}"` : ""}.`,
      type: "warning",
    });
  }

  return insights.slice(0, 4); // Max 4 insights
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
