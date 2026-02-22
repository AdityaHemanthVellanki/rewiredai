"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Zap,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Sparkles,
  Camera,
  Check,
  SkipForward,
  ExternalLink,
  Brain,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface AutoConfig {
  productivity_peak_hours: string[];
  sleep_window: { sleep: string; wake: string };
  escalation_mode: "gentle" | "standard" | "aggressive";
  gpa_target: number | null;
  reasoning: {
    peak_hours_reason: string;
    sleep_reason: string;
    escalation_reason: string;
    gpa_reason: string;
    workload_summary: string;
  };
  signals: {
    total_courses: number;
    total_assignments: number;
    upcoming_assignments: number;
    on_time_rate: number | null;
    late_rate: number | null;
    missing_rate: number | null;
    current_avg_score: number | null;
    weekly_class_hours: number;
    busiest_day: string | null;
    earliest_class: string | null;
    latest_event: string | null;
  };
}

const steps = [
  {
    title: "Welcome to Rewired",
    subtitle: "Let's set up your profile.",
  },
  {
    title: "Connect Canvas",
    subtitle:
      "Import your courses, assignments, and grades automatically from Canvas LMS.",
  },
  {
    title: "Your Personalized Settings",
    subtitle:
      "I analyzed your Canvas and Google Calendar data to configure everything for you.",
  },
  {
    title: "What's your big goal?",
    subtitle:
      "Why are you in college? I'll use this to motivate you when things get hard.",
  },
  {
    title: "This semester",
    subtitle: "What do you want to accomplish?",
  },
  {
    title: "Fine-tune your settings",
    subtitle: "Review what I configured — adjust anything that doesn't feel right.",
  },
  {
    title: "How hard should I push?",
    subtitle: "I picked this based on your Canvas history. Feel free to change it.",
  },
];

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}>
      <OnboardingContent />
    </Suspense>
  );
}

function OnboardingContent() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  // Profile data
  const [data, setData] = useState({
    full_name: "",
    avatar_url: "",
    personal_why: "",
    semester_goals: "",
    gpa_target: "",
    productivity_peak: "",
    sleep_time: "23:00",
    wake_time: "08:00",
    escalation_mode: "standard" as "gentle" | "standard" | "aggressive",
  });

  // Canvas connection
  const [isConnectingCanvas, setIsConnectingCanvas] = useState(false);
  const [canvasConnected, setCanvasConnected] = useState(false);
  const [canvasStudentName, setCanvasStudentName] = useState("");
  const [canvasUrl, setCanvasUrl] = useState("https://umamherst.instructure.com");
  const [canvasToken, setCanvasToken] = useState("");

  // Avatar upload
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState("");

  // Auto-config state
  const [autoConfig, setAutoConfig] = useState<AutoConfig | null>(null);
  const [isAutoConfiguring, setIsAutoConfiguring] = useState(false);
  const [autoConfigRan, setAutoConfigRan] = useState(false);

  // Load existing profile data (e.g., name + avatar from Google)
  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await fetch("/api/profile");
        if (res.ok) {
          const json = await res.json();
          if (json.profile) {
            setData((prev) => ({
              ...prev,
              full_name: json.profile.full_name || "",
              avatar_url: json.profile.avatar_url || "",
            }));
            setAvatarPreview(json.profile.avatar_url || "");
          }
          if (json.canvasConnected) {
            setCanvasConnected(true);
            setCanvasStudentName(json.canvasInfo?.student_name || "");
          }
        }
      } catch {
        // ignore
      }
    }
    loadProfile();
  }, []);

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);
    setAvatarPreview(previewUrl);

    setIsUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append("avatar", file);

      const res = await fetch("/api/avatar", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const json = await res.json();
        setData((prev) => ({ ...prev, avatar_url: json.avatar_url }));
        setAvatarPreview(json.avatar_url);
        toast.success("Profile pic updated!");
      } else {
        const json = await res.json();
        toast.error(json.error || "Upload failed");
        setAvatarPreview(data.avatar_url);
      }
    } catch {
      toast.error("Upload failed");
      setAvatarPreview(data.avatar_url);
    } finally {
      setIsUploadingAvatar(false);
    }
  }

  async function connectCanvas() {
    if (!canvasUrl || !canvasToken) {
      toast.error("Please enter your Canvas URL and access token.");
      return;
    }
    setIsConnectingCanvas(true);
    try {
      const res = await fetch("/api/canvas/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canvasUrl, accessToken: canvasToken }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setCanvasConnected(true);
        setCanvasStudentName(json.studentName || "");
        toast.success("Canvas connected!");

        // Auto-sync courses
        fetch("/api/canvas/sync", { method: "POST" })
          .then((r) => r.json())
          .then((syncData) => {
            if (syncData.success) {
              toast.success(
                `Imported ${syncData.coursesCreated} courses and ${syncData.assignmentsCreated} assignments.`
              );
            }
          })
          .catch(() => {});
      } else {
        toast.error(json.error || "Failed to connect Canvas");
      }
    } catch {
      toast.error("Failed to connect Canvas");
    } finally {
      setIsConnectingCanvas(false);
    }
  }

  // Run auto-config when entering the auto-config step
  async function runAutoConfig() {
    if (autoConfigRan) return;
    setIsAutoConfiguring(true);
    try {
      const res = await fetch("/api/profile/auto-configure", {
        method: "POST",
      });
      if (res.ok) {
        const config: AutoConfig = await res.json();
        setAutoConfig(config);
        setAutoConfigRan(true);

        // Pre-fill the form with auto-configured values
        setData((prev) => ({
          ...prev,
          productivity_peak: config.productivity_peak_hours.join(", "),
          sleep_time: config.sleep_window.sleep,
          wake_time: config.sleep_window.wake,
          escalation_mode: config.escalation_mode,
          gpa_target: config.gpa_target ? String(config.gpa_target) : prev.gpa_target,
        }));
      }
    } catch {
      // Silently fall back to defaults
    } finally {
      setIsAutoConfiguring(false);
    }
  }

  // Trigger auto-config when step 2 (auto-config step) is reached
  useEffect(() => {
    if (step === 2 && !autoConfigRan) {
      runAutoConfig();
    }
  }, [step]);

  async function handleFinish() {
    setIsSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: data.full_name,
          personal_why: data.personal_why,
          semester_goals: data.semester_goals
            .split("\n")
            .filter((g) => g.trim()),
          gpa_target: data.gpa_target ? parseFloat(data.gpa_target) : null,
          productivity_peak_hours: data.productivity_peak
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          sleep_window: { sleep: data.sleep_time, wake: data.wake_time },
          escalation_mode: data.escalation_mode,
          onboarding_completed: true,
        }),
      });

      if (res.ok) {
        // Fire-and-forget syncs after onboarding completes
        fetch("/api/canvas/sync", { method: "POST" }).catch(() => {});
        fetch("/api/google/emails", { method: "POST" }).catch(() => {});
        toast.success("You're all set! Let's go.");
        router.push("/dashboard");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsSaving(false);
    }
  }

  function handleSkipAll() {
    setIsSaving(true);
    fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        full_name: data.full_name || null,
        onboarding_completed: true,
      }),
    })
      .then((res) => {
        if (res.ok) {
          router.push("/dashboard");
        }
      })
      .catch(() => toast.error("Something went wrong"))
      .finally(() => setIsSaving(false));
  }

  const initials = data.full_name
    ? data.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  return (
    <div className="flex min-h-[calc(100vh-7rem)] items-center justify-center md:min-h-[calc(100vh-3rem)]">
      <div className="w-full max-w-lg px-4">
        {/* Progress bar */}
        <div className="mb-8 flex gap-1">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i <= step ? "bg-purple-500" : "bg-border"
              }`}
            />
          ))}
        </div>

        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-purple-500" />
            <span className="text-sm text-muted-foreground">
              Step {step + 1} of {steps.length}
            </span>
          </div>
          <button
            onClick={handleSkipAll}
            disabled={isSaving}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <SkipForward className="h-3 w-3" />
            Skip all
          </button>
        </div>

        <h2 className="mb-1 text-2xl font-bold">{steps[step].title}</h2>
        <p className="mb-8 text-muted-foreground">{steps[step].subtitle}</p>

        {/* Step 0: Profile — Name + Avatar */}
        {step === 0 && (
          <div className="space-y-6">
            <div className="flex flex-col items-center gap-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingAvatar}
                className="group relative h-24 w-24 overflow-hidden rounded-full border-2 border-border/50 transition-colors hover:border-purple-500"
              >
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt="Profile"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-purple-500/10 text-2xl font-bold text-purple-400">
                    {initials}
                  </div>
                )}
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                  {isUploadingAvatar ? (
                    <Loader2 className="h-6 w-6 animate-spin text-white" />
                  ) : (
                    <Camera className="h-6 w-6 text-white" />
                  )}
                </div>
              </button>
              <p className="text-xs text-muted-foreground">
                Click to upload a profile pic
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-muted-foreground">
                What should I call you?
              </label>
              <Input
                value={data.full_name}
                onChange={(e) =>
                  setData({ ...data, full_name: e.target.value })
                }
                placeholder="Your name"
                autoFocus
              />
            </div>
          </div>
        )}

        {/* Step 1: Canvas — Personal Access Token */}
        {step === 1 && (
          <div className="space-y-4">
            {canvasConnected ? (
              <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-6 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
                  <Check className="h-6 w-6 text-green-400" />
                </div>
                <p className="font-semibold text-green-400">
                  Canvas Connected!
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {canvasStudentName
                    ? `Signed in as ${canvasStudentName}. `
                    : ""}
                  Your courses and assignments are being imported.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm text-muted-foreground">
                    Canvas URL
                  </label>
                  <Input
                    value={canvasUrl}
                    onChange={(e) => setCanvasUrl(e.target.value)}
                    placeholder="https://your-school.instructure.com"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-muted-foreground">
                    Access Token
                  </label>
                  <Input
                    type="password"
                    value={canvasToken}
                    onChange={(e) => setCanvasToken(e.target.value)}
                    placeholder="Paste your Canvas access token"
                  />
                  <a
                    href="https://community.canvaslms.com/t5/Student-Guide/How-do-I-manage-API-access-tokens-as-a-student/ta-p/273"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300"
                  >
                    How to generate a token
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <Button
                  onClick={connectCanvas}
                  disabled={isConnectingCanvas || !canvasToken}
                  className="w-full gap-2 bg-red-600 hover:bg-red-700 text-white h-11"
                >
                  {isConnectingCanvas ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <div className="flex h-5 w-5 items-center justify-center rounded bg-white/20 text-[10px] font-bold">
                      C
                    </div>
                  )}
                  Connect Canvas
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Auto-Config Results */}
        {step === 2 && (
          <div className="space-y-4">
            {isAutoConfiguring ? (
              <div className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-8 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-purple-500/10">
                  <Brain className="h-7 w-7 text-purple-400 animate-pulse" />
                </div>
                <p className="font-semibold text-purple-400">
                  Analyzing your data...
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Checking your Canvas submissions, grades, and Google Calendar to configure optimal settings.
                </p>
                <Loader2 className="mx-auto mt-4 h-5 w-5 animate-spin text-purple-400" />
              </div>
            ) : autoConfig ? (
              <div className="space-y-3">
                {/* Workload */}
                {autoConfig.reasoning.workload_summary && (
                  <InsightCard
                    label="Workload"
                    value={autoConfig.reasoning.workload_summary}
                    stats={[
                      autoConfig.signals.total_courses > 0 ? `${autoConfig.signals.total_courses} courses` : null,
                      autoConfig.signals.upcoming_assignments > 0 ? `${autoConfig.signals.upcoming_assignments} upcoming` : null,
                    ].filter(Boolean) as string[]}
                  />
                )}

                {/* Submission Behavior */}
                {autoConfig.signals.on_time_rate !== null && (
                  <InsightCard
                    label="Submission History"
                    value={autoConfig.reasoning.escalation_reason}
                    stats={[
                      `${autoConfig.signals.on_time_rate}% on-time`,
                      autoConfig.signals.late_rate ? `${autoConfig.signals.late_rate}% late` : null,
                      autoConfig.signals.missing_rate ? `${autoConfig.signals.missing_rate}% missed` : null,
                    ].filter(Boolean) as string[]}
                    color={
                      (autoConfig.signals.on_time_rate || 0) >= 80
                        ? "green"
                        : (autoConfig.signals.on_time_rate || 0) >= 60
                          ? "yellow"
                          : "red"
                    }
                  />
                )}

                {/* Grades */}
                {autoConfig.signals.current_avg_score !== null && (
                  <InsightCard
                    label="Current Performance"
                    value={autoConfig.reasoning.gpa_reason}
                    stats={[`Avg: ${autoConfig.signals.current_avg_score}%`]}
                    color={
                      autoConfig.signals.current_avg_score >= 85
                        ? "green"
                        : autoConfig.signals.current_avg_score >= 70
                          ? "yellow"
                          : "red"
                    }
                  />
                )}

                {/* Schedule */}
                {autoConfig.signals.weekly_class_hours > 0 && (
                  <InsightCard
                    label="Schedule Analysis"
                    value={autoConfig.reasoning.peak_hours_reason}
                    stats={[
                      `~${autoConfig.signals.weekly_class_hours}hrs/week in classes`,
                      autoConfig.signals.busiest_day ? `Busiest: ${autoConfig.signals.busiest_day}` : null,
                      autoConfig.signals.earliest_class ? `Earliest class: ${autoConfig.signals.earliest_class}` : null,
                    ].filter(Boolean) as string[]}
                  />
                )}

                <div className="flex items-start gap-2 rounded-lg bg-purple-500/5 border border-purple-500/20 p-3 mt-2">
                  <Info className="h-4 w-4 text-purple-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    All settings are pre-filled based on this analysis. You can review and adjust them in the next steps.
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-border/50 bg-card p-6 text-center">
                <p className="text-muted-foreground">
                  Connect Canvas and Google to get personalized settings, or continue to set them manually.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Personal Why */}
        {step === 3 && (
          <div className="space-y-4">
            <Textarea
              value={data.personal_why}
              onChange={(e) =>
                setData({ ...data, personal_why: e.target.value })
              }
              placeholder="e.g., I want to be the first in my family to graduate and get into med school. My mom works two jobs so I can be here, and I'm not going to waste that."
              rows={5}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              This stays private. I&apos;ll use your exact words when you need a
              reminder of why you&apos;re doing this.
            </p>
          </div>
        )}

        {/* Step 4: Goals + GPA */}
        {step === 4 && (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">
                Semester goals (one per line)
              </label>
              <Textarea
                value={data.semester_goals}
                onChange={(e) =>
                  setData({ ...data, semester_goals: e.target.value })
                }
                placeholder={
                  "Make the Dean's List\nSubmit my research paper\nGet an internship offer"
                }
                rows={4}
                autoFocus
              />
            </div>
            <div>
              <label className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
                GPA target
                {autoConfig?.gpa_target && (
                  <span className="rounded-full bg-purple-500/10 px-2 py-0.5 text-xs text-purple-400">
                    AI suggested: {autoConfig.gpa_target}
                  </span>
                )}
              </label>
              <Input
                type="number"
                step="0.1"
                min="0"
                max="4"
                value={data.gpa_target}
                onChange={(e) =>
                  setData({ ...data, gpa_target: e.target.value })
                }
                placeholder="3.5"
              />
            </div>
          </div>
        )}

        {/* Step 5: Productivity (with AI pre-fill) */}
        {step === 5 && (
          <div className="space-y-4">
            <div>
              <label className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
                Peak productivity hours
                {autoConfig && autoConfig.productivity_peak_hours.length > 0 && (
                  <span className="rounded-full bg-purple-500/10 px-2 py-0.5 text-xs text-purple-400">
                    AI configured
                  </span>
                )}
              </label>
              <Input
                value={data.productivity_peak}
                onChange={(e) =>
                  setData({ ...data, productivity_peak: e.target.value })
                }
                placeholder="09:00, 10:00, 14:00, 15:00"
                autoFocus
              />
              {autoConfig?.reasoning.peak_hours_reason && (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {autoConfig.reasoning.peak_hours_reason}
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
                  I usually sleep at
                  {autoConfig && (
                    <span className="rounded-full bg-purple-500/10 px-2 py-0.5 text-xs text-purple-400">
                      AI
                    </span>
                  )}
                </label>
                <Input
                  type="time"
                  value={data.sleep_time}
                  onChange={(e) =>
                    setData({ ...data, sleep_time: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
                  I wake up at
                  {autoConfig && (
                    <span className="rounded-full bg-purple-500/10 px-2 py-0.5 text-xs text-purple-400">
                      AI
                    </span>
                  )}
                </label>
                <Input
                  type="time"
                  value={data.wake_time}
                  onChange={(e) =>
                    setData({ ...data, wake_time: e.target.value })
                  }
                />
              </div>
            </div>
            {autoConfig?.reasoning.sleep_reason && (
              <p className="text-xs text-muted-foreground">
                {autoConfig.reasoning.sleep_reason}
              </p>
            )}
          </div>
        )}

        {/* Step 6: Nudge Intensity (with AI recommendation) */}
        {step === 6 && (
          <div className="space-y-3">
            {(["gentle", "standard", "aggressive"] as const).map((mode) => {
              const isRecommended = autoConfig?.escalation_mode === mode;
              return (
                <button
                  key={mode}
                  onClick={() => setData({ ...data, escalation_mode: mode })}
                  className={`w-full rounded-xl border p-4 text-left transition-colors ${
                    data.escalation_mode === mode
                      ? "border-purple-500 bg-purple-500/10"
                      : "border-border/50 hover:border-border"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <p className="font-semibold capitalize">{mode}</p>
                    {isRecommended && (
                      <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-xs text-purple-400 flex items-center gap-1">
                        <Brain className="h-3 w-3" />
                        AI recommended
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {mode === "gentle" &&
                      "Friendly reminders. No guilt trips. I'll suggest but never force."}
                    {mode === "standard" &&
                      "I'll be direct. If you're procrastinating, I'll call it out — with love."}
                    {mode === "aggressive" &&
                      "Full accountability mode. I will block your free time if you ignore me. You asked for this."}
                  </p>
                </button>
              );
            })}
            {autoConfig?.reasoning.escalation_reason && (
              <div className="flex items-start gap-2 rounded-lg bg-purple-500/5 border border-purple-500/20 p-3">
                <Brain className="h-4 w-4 text-purple-400 mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground">
                  {autoConfig.reasoning.escalation_reason}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <div className="mt-8 flex justify-between">
          <Button
            variant="ghost"
            onClick={() => setStep(step - 1)}
            disabled={step === 0}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>

          <div className="flex gap-2">
            {step < steps.length - 1 && (
              <Button
                variant="ghost"
                onClick={() => setStep(step + 1)}
                className="text-muted-foreground"
              >
                Skip
                <SkipForward className="ml-1 h-3 w-3" />
              </Button>
            )}

            {step < steps.length - 1 ? (
              <Button
                onClick={() => setStep(step + 1)}
                disabled={step === 2 && isAutoConfiguring}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {step === 2 && isAutoConfiguring ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={handleFinish}
                disabled={isSaving}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {isSaving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                Let&apos;s Go
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Insight Card Component
// ============================================

function InsightCard({
  label,
  value,
  stats,
  color = "purple",
}: {
  label: string;
  value: string;
  stats?: string[];
  color?: "purple" | "green" | "yellow" | "red";
}) {
  const borderColors = {
    purple: "border-purple-500/20",
    green: "border-green-500/20",
    yellow: "border-yellow-500/20",
    red: "border-red-500/20",
  };
  const bgColors = {
    purple: "bg-purple-500/5",
    green: "bg-green-500/5",
    yellow: "bg-yellow-500/5",
    red: "bg-red-500/5",
  };
  const statBgColors = {
    purple: "bg-purple-500/10 text-purple-400",
    green: "bg-green-500/10 text-green-400",
    yellow: "bg-yellow-500/10 text-yellow-400",
    red: "bg-red-500/10 text-red-400",
  };

  return (
    <div className={`rounded-xl border ${borderColors[color]} ${bgColors[color]} p-4`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        {stats && stats.length > 0 && (
          <div className="flex gap-1.5">
            {stats.map((stat) => (
              <span
                key={stat}
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${statBgColors[color]}`}
              >
                {stat}
              </span>
            ))}
          </div>
        )}
      </div>
      <p className="text-sm text-foreground/80">{value}</p>
    </div>
  );
}
