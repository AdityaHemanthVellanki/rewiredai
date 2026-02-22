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
  Heart,
  Target,
  SlidersHorizontal,
  Bell,
  Link2,
  Sun,
  Moon,
  Shield,
  Flame,
  Swords,
  Lock,
  Quote,
  GraduationCap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";

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
    subtitle: "Let's set up your profile so I can start helping you.",
    icon: Sparkles,
    color: "purple",
  },
  {
    title: "Connect Canvas",
    subtitle:
      "Import your courses, assignments, and grades automatically from Canvas LMS.",
    icon: Link2,
    color: "blue",
  },
  {
    title: "Your Personalized Settings",
    subtitle:
      "I analyzed your Canvas and Google Calendar data to configure everything for you.",
    icon: Brain,
    color: "purple",
  },
  {
    title: "What drives you?",
    subtitle:
      "Why are you in college? I'll use this to motivate you when things get hard.",
    icon: Heart,
    color: "rose",
  },
  {
    title: "This semester",
    subtitle: "What do you want to accomplish? Set your targets.",
    icon: Target,
    color: "amber",
  },
  {
    title: "Fine-tune your settings",
    subtitle:
      "Review what I configured \u2014 adjust anything that doesn't feel right.",
    icon: SlidersHorizontal,
    color: "cyan",
  },
  {
    title: "How hard should I push?",
    subtitle:
      "I picked this based on your Canvas history. Feel free to change it.",
    icon: Bell,
    color: "purple",
  },
];

const stepIconColors: Record<string, string> = {
  purple: "from-purple-500/20 to-purple-600/20 text-purple-400 shadow-purple-500/10",
  blue: "from-blue-500/20 to-blue-600/20 text-blue-400 shadow-blue-500/10",
  rose: "from-rose-500/20 to-rose-600/20 text-rose-400 shadow-rose-500/10",
  amber: "from-amber-500/20 to-amber-600/20 text-amber-400 shadow-amber-500/10",
  cyan: "from-cyan-500/20 to-cyan-600/20 text-cyan-400 shadow-cyan-500/10",
};

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[calc(100vh-7rem)] items-center justify-center md:min-h-[calc(100vh-3rem)]">
          <div className="flex flex-col items-center gap-4">
            <div className="animate-glow-pulse flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-500/10">
              <Zap className="h-8 w-8 text-purple-400" />
            </div>
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        </div>
      }
    >
      <OnboardingContent />
    </Suspense>
  );
}

function OnboardingContent() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [isSaving, setIsSaving] = useState(false);

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

  const [isConnectingCanvas, setIsConnectingCanvas] = useState(false);
  const [canvasConnected, setCanvasConnected] = useState(false);
  const [canvasStudentName, setCanvasStudentName] = useState("");
  const [canvasUrl, setCanvasUrl] = useState(
    "https://umamherst.instructure.com"
  );
  const [canvasToken, setCanvasToken] = useState("");

  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState("");

  const [autoConfig, setAutoConfig] = useState<AutoConfig | null>(null);
  const [isAutoConfiguring, setIsAutoConfiguring] = useState(false);
  const [autoConfigRan, setAutoConfigRan] = useState(false);

  const [isExpressSetup, setIsExpressSetup] = useState(false);

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
            if (json.profile?.full_name) {
              setStep(2);
            }
          }
        }
      } catch {
        // ignore
      }
    }
    loadProfile();
  }, []);

  function goToStep(newStep: number) {
    setDirection(newStep > step ? 1 : -1);
    setStep(newStep);
  }

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

        setData((prev) => ({
          ...prev,
          productivity_peak: config.productivity_peak_hours.join(", "),
          sleep_time: config.sleep_window.sleep,
          wake_time: config.sleep_window.wake,
          escalation_mode: config.escalation_mode,
          gpa_target: config.gpa_target
            ? String(config.gpa_target)
            : prev.gpa_target,
        }));
      }
    } catch {
      // Silently fall back to defaults
    } finally {
      setIsAutoConfiguring(false);
    }
  }

  useEffect(() => {
    if (step === 2 && !autoConfigRan) {
      runAutoConfig();
    }
  }, [step]);

  async function handleExpressSetup() {
    setIsExpressSetup(true);
    try {
      const configRes = await fetch("/api/profile/auto-configure", {
        method: "POST",
      });
      let config: AutoConfig | null = null;
      if (configRes.ok) {
        config = await configRes.json();
      }

      await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: data.full_name || null,
          gpa_target: config?.gpa_target ?? 3.5,
          productivity_peak_hours: config?.productivity_peak_hours ?? [
            "09:00",
            "10:00",
            "14:00",
            "15:00",
          ],
          sleep_window: config?.sleep_window ?? {
            sleep: "23:00",
            wake: "08:00",
          },
          escalation_mode: config?.escalation_mode ?? "standard",
          onboarding_completed: true,
        }),
      });

      fetch("/api/canvas/sync", { method: "POST" }).catch(() => {});
      fetch("/api/google/emails", { method: "POST" }).catch(() => {});

      toast.success("Express setup complete! Let's go.");
      router.push("/dashboard");
    } catch {
      toast.error("Express setup failed, please continue manually.");
      setIsExpressSetup(false);
    }
  }

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

  const currentStep = steps[step];
  const StepIcon = currentStep.icon;
  const iconColor = stepIconColors[currentStep.color] || stepIconColors.purple;

  return (
    <div className="flex min-h-[calc(100vh-7rem)] items-center justify-center md:min-h-[calc(100vh-3rem)]">
      {/* Floating background orbs */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div
          className="absolute h-[300px] w-[300px] rounded-full opacity-30 animate-float-1"
          style={{
            background:
              "radial-gradient(circle, rgba(139,92,246,0.08), transparent 70%)",
            top: "10%",
            left: "15%",
          }}
        />
        <div
          className="absolute h-[200px] w-[200px] rounded-full opacity-30 animate-float-2"
          style={{
            background:
              "radial-gradient(circle, rgba(99,102,241,0.06), transparent 70%)",
            bottom: "20%",
            right: "10%",
          }}
        />
        <div
          className="absolute h-[250px] w-[250px] rounded-full opacity-20 animate-float-3"
          style={{
            background:
              "radial-gradient(circle, rgba(168,85,247,0.06), transparent 70%)",
            top: "50%",
            right: "30%",
          }}
        />
      </div>

      <div className="relative z-10 w-full max-w-lg px-4">
        {/* ===== Step indicator dots ===== */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            type: "spring" as const,
            stiffness: 400,
            damping: 30,
          }}
          className="mb-8"
        >
          <div className="flex items-center justify-center gap-2">
            {steps.map((s, i) => {
              const isCompleted = i < step;
              const isCurrent = i === step;
              return (
                <div key={i} className="flex items-center gap-2">
                  <motion.div
                    animate={{
                      scale: isCurrent ? 1 : 0.85,
                      opacity: isCurrent ? 1 : isCompleted ? 0.8 : 0.4,
                    }}
                    transition={{
                      type: "spring" as const,
                      stiffness: 400,
                      damping: 25,
                    }}
                    className={`relative flex h-8 w-8 items-center justify-center rounded-full transition-colors duration-300 ${
                      isCurrent
                        ? "bg-purple-500/20 ring-2 ring-purple-500/40"
                        : isCompleted
                          ? "bg-emerald-500/15"
                          : "bg-white/[0.04]"
                    }`}
                  >
                    {isCompleted ? (
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                    ) : (
                      <span
                        className={`text-xs font-semibold ${
                          isCurrent
                            ? "text-purple-400"
                            : "text-muted-foreground/50"
                        }`}
                      >
                        {i + 1}
                      </span>
                    )}
                    {isCurrent && (
                      <motion.div
                        layoutId="step-ring"
                        className="absolute inset-0 rounded-full ring-2 ring-purple-400/50"
                        transition={{
                          type: "spring" as const,
                          stiffness: 400,
                          damping: 30,
                        }}
                      />
                    )}
                  </motion.div>
                  {i < steps.length - 1 && (
                    <div
                      className={`hidden h-px w-4 sm:block transition-colors duration-300 ${
                        isCompleted ? "bg-emerald-500/30" : "bg-border/30"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* ===== Glass card container ===== */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring" as const, stiffness: 400, damping: 30 }}
          className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 shadow-xl shadow-black/10 backdrop-blur-xl sm:p-8"
        >
          {/* Animated gradient border accent on top */}
          <div className="absolute inset-x-0 top-0 h-px animate-border-shimmer" />

          {/* Skip all button */}
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="animate-glow-pulse flex h-7 w-7 items-center justify-center rounded-lg bg-purple-500/15">
                <Zap className="h-3.5 w-3.5 text-purple-400" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">
                Step {step + 1} of {steps.length}
              </span>
            </div>
            <button
              onClick={handleSkipAll}
              disabled={isSaving}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground/60 transition-all hover:bg-white/[0.04] hover:text-muted-foreground active-press"
            >
              <SkipForward className="h-3 w-3" />
              Skip all
            </button>
          </div>

          {/* ===== Step content with AnimatePresence ===== */}
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              initial={{
                opacity: 0,
                x: direction * 50,
                filter: "blur(6px)",
              }}
              animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
              exit={{
                opacity: 0,
                x: direction * -50,
                filter: "blur(6px)",
              }}
              transition={{
                type: "spring" as const,
                stiffness: 400,
                damping: 30,
              }}
            >
              {/* Step icon + title */}
              <div className="mb-6">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{
                    type: "spring" as const,
                    stiffness: 400,
                    damping: 25,
                    delay: 0.05,
                  }}
                  className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br shadow-lg ${iconColor}`}
                >
                  <StepIcon className="h-6 w-6" />
                </motion.div>
                <motion.h2
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    type: "spring" as const,
                    stiffness: 400,
                    damping: 30,
                    delay: 0.08,
                  }}
                  className="text-xl font-bold tracking-tight sm:text-2xl"
                >
                  {currentStep.title}
                </motion.h2>
                <motion.p
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    type: "spring" as const,
                    stiffness: 400,
                    damping: 30,
                    delay: 0.12,
                  }}
                  className="mt-1 text-sm text-muted-foreground"
                >
                  {currentStep.subtitle}
                </motion.p>
              </div>

              {/* ============================== */}
              {/* Step 0: Profile — Name + Avatar */}
              {/* ============================== */}
              {step === 0 && (
                <div className="space-y-6">
                  {/* Express Setup banner */}
                  {canvasConnected && (
                    <motion.button
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        type: "spring" as const,
                        stiffness: 400,
                        damping: 30,
                        delay: 0.15,
                      }}
                      onClick={handleExpressSetup}
                      disabled={isExpressSetup}
                      className="group w-full overflow-hidden rounded-xl border border-purple-500/25 bg-gradient-to-r from-purple-500/[0.08] via-blue-500/[0.06] to-indigo-500/[0.08] p-4 text-left transition-all hover:border-purple-500/40 hover:from-purple-500/[0.12] hover:via-blue-500/[0.10] hover:to-indigo-500/[0.12] hover-lift active-press"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500/20 to-indigo-500/20 shadow-lg shadow-purple-500/10 transition-transform group-hover:scale-105">
                          {isExpressSetup ? (
                            <Loader2 className="h-5 w-5 animate-spin text-purple-400" />
                          ) : (
                            <Zap className="h-5 w-5 text-purple-400" />
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-purple-300">
                            {isExpressSetup
                              ? "Setting up..."
                              : "Express Setup"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {isExpressSetup
                              ? "AI is configuring your optimal settings..."
                              : "Skip everything \u2014 AI will auto-configure from Canvas + Calendar."}
                          </p>
                        </div>
                        {!isExpressSetup && (
                          <ArrowRight className="ml-auto h-4 w-4 text-purple-400/50 transition-transform group-hover:translate-x-0.5" />
                        )}
                      </div>
                    </motion.button>
                  )}

                  {/* Avatar */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{
                      type: "spring" as const,
                      stiffness: 400,
                      damping: 30,
                      delay: 0.18,
                    }}
                    className="flex flex-col items-center gap-3"
                  >
                    <div className="relative">
                      {/* Glow ring behind avatar */}
                      <div className="absolute -inset-2 rounded-full bg-gradient-to-br from-purple-500/15 to-indigo-500/15 blur-md animate-breathe" />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploadingAvatar}
                        className="group relative h-28 w-28 overflow-hidden rounded-full border-2 border-white/10 shadow-xl shadow-purple-500/10 transition-all duration-300 hover:border-purple-500/50 hover:shadow-[0_0_30px_rgba(139,92,246,0.2)]"
                      >
                        {avatarPreview ? (
                          <motion.img
                            key={avatarPreview}
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{
                              type: "spring" as const,
                              stiffness: 400,
                              damping: 20,
                            }}
                            src={avatarPreview}
                            alt="Profile"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-purple-500/10 to-indigo-500/10 text-3xl font-bold text-purple-400">
                            {initials}
                          </div>
                        )}
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
                          {isUploadingAvatar ? (
                            <Loader2 className="h-6 w-6 animate-spin text-white" />
                          ) : (
                            <Camera className="h-6 w-6 text-white" />
                          )}
                        </div>
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground/60">
                      Click to upload a profile pic
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      className="hidden"
                    />
                  </motion.div>

                  {/* Name field */}
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      type: "spring" as const,
                      stiffness: 400,
                      damping: 30,
                      delay: 0.22,
                    }}
                    className="rounded-xl border border-border/30 bg-white/[0.02] p-4"
                  >
                    <label className="mb-2 block text-sm font-medium text-muted-foreground">
                      What should I call you?
                    </label>
                    <Input
                      value={data.full_name}
                      onChange={(e) =>
                        setData({ ...data, full_name: e.target.value })
                      }
                      placeholder="Your name"
                      autoFocus
                      className="border-white/10 bg-white/[0.03]"
                    />
                  </motion.div>
                </div>
              )}

              {/* ============================== */}
              {/* Step 1: Canvas Connection       */}
              {/* ============================== */}
              {step === 1 && (
                <div className="space-y-4">
                  {canvasConnected ? (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{
                        type: "spring" as const,
                        stiffness: 400,
                        damping: 30,
                      }}
                      className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.04] p-6 text-center"
                    >
                      <motion.div
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{
                          type: "spring" as const,
                          stiffness: 400,
                          damping: 15,
                          delay: 0.15,
                        }}
                        className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 shadow-lg shadow-emerald-500/10"
                      >
                        <Check className="h-7 w-7 text-emerald-400" />
                      </motion.div>
                      <p className="text-lg font-semibold text-emerald-400">
                        Canvas Connected!
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {canvasStudentName
                          ? `Signed in as ${canvasStudentName}. `
                          : ""}
                        Your courses and assignments are being imported.
                      </p>
                      <button
                        onClick={handleExpressSetup}
                        disabled={isExpressSetup}
                        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 py-3 text-sm font-medium text-white shadow-lg shadow-purple-500/20 transition-all hover:bg-purple-700 hover:shadow-purple-500/30 active-press"
                      >
                        {isExpressSetup ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Zap className="h-4 w-4" />
                        )}
                        {isExpressSetup
                          ? "Setting up..."
                          : "Express Setup \u2014 Let AI handle the rest"}
                      </button>
                    </motion.div>
                  ) : (
                    <div className="space-y-4">
                      <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          type: "spring" as const,
                          stiffness: 400,
                          damping: 30,
                          delay: 0.08,
                        }}
                        className="rounded-xl border border-border/30 bg-white/[0.02] p-4 space-y-3"
                      >
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
                            Canvas URL
                          </label>
                          <Input
                            value={canvasUrl}
                            onChange={(e) => setCanvasUrl(e.target.value)}
                            placeholder="https://your-school.instructure.com"
                            className="border-white/10 bg-white/[0.03]"
                          />
                        </div>
                        <div>
                          <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                            <Lock className="h-3 w-3" />
                            Access Token
                          </label>
                          <Input
                            type="password"
                            value={canvasToken}
                            onChange={(e) => setCanvasToken(e.target.value)}
                            placeholder="Paste your Canvas access token"
                            className="border-white/10 bg-white/[0.03]"
                          />
                          <a
                            href="https://community.canvaslms.com/t5/Student-Guide/How-do-I-manage-API-access-tokens-as-a-student/ta-p/273"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 inline-flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 transition-colors"
                          >
                            How to generate a token
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </motion.div>
                      <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          type: "spring" as const,
                          stiffness: 400,
                          damping: 30,
                          delay: 0.15,
                        }}
                      >
                        <Button
                          onClick={connectCanvas}
                          disabled={isConnectingCanvas || !canvasToken}
                          className="w-full gap-2 bg-red-600 text-white h-11 shadow-lg shadow-red-500/15 hover:bg-red-700 hover:shadow-red-500/25 active-press"
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
                      </motion.div>
                    </div>
                  )}
                </div>
              )}

              {/* ============================== */}
              {/* Step 2: Auto-Config Results     */}
              {/* ============================== */}
              {step === 2 && (
                <div className="space-y-4">
                  {isAutoConfiguring ? (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{
                        type: "spring" as const,
                        stiffness: 400,
                        damping: 30,
                      }}
                      className="rounded-xl border border-purple-500/25 bg-purple-500/[0.04] p-8 text-center"
                    >
                      <div className="relative mx-auto mb-5 h-16 w-16">
                        {/* Orbiting dots */}
                        <div
                          className="absolute inset-0"
                          style={{
                            animation: "orbit 3s linear infinite",
                            ["--orbit-radius" as string]: "32px",
                          }}
                        >
                          <div className="h-2 w-2 rounded-full bg-purple-400" />
                        </div>
                        <div
                          className="absolute inset-0"
                          style={{
                            animation: "orbit 3s linear infinite reverse",
                            ["--orbit-radius" as string]: "24px",
                            animationDelay: "-1s",
                          }}
                        >
                          <div className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                        </div>
                        <motion.div
                          animate={{ scale: [1, 1.08, 1] }}
                          transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: "easeInOut",
                          }}
                          className="absolute inset-0 flex items-center justify-center rounded-full bg-purple-500/10"
                        >
                          <Brain className="h-7 w-7 text-purple-400" />
                        </motion.div>
                      </div>
                      <p className="text-lg font-semibold text-purple-300">
                        Analyzing your data...
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Checking Canvas submissions, grades, and Google Calendar
                        to find your optimal settings.
                      </p>
                      <div className="mx-auto mt-5 h-1.5 w-56 overflow-hidden rounded-full bg-white/5">
                        <motion.div
                          className="h-full rounded-full bg-gradient-to-r from-purple-500 to-indigo-500"
                          initial={{ width: "0%" }}
                          animate={{ width: "85%" }}
                          transition={{ duration: 4, ease: "easeOut" }}
                        />
                      </div>
                    </motion.div>
                  ) : autoConfig ? (
                    <div className="space-y-3">
                      {autoConfig.reasoning.workload_summary && (
                        <InsightCard
                          index={0}
                          label="Workload"
                          icon={<GraduationCap className="h-3.5 w-3.5" />}
                          value={autoConfig.reasoning.workload_summary}
                          stats={
                            [
                              autoConfig.signals.total_courses > 0
                                ? `${autoConfig.signals.total_courses} courses`
                                : null,
                              autoConfig.signals.upcoming_assignments > 0
                                ? `${autoConfig.signals.upcoming_assignments} upcoming`
                                : null,
                            ].filter(Boolean) as string[]
                          }
                        />
                      )}

                      {autoConfig.signals.on_time_rate !== null && (
                        <InsightCard
                          index={1}
                          label="Submission History"
                          icon={<Check className="h-3.5 w-3.5" />}
                          value={autoConfig.reasoning.escalation_reason}
                          stats={
                            [
                              `${autoConfig.signals.on_time_rate}% on-time`,
                              autoConfig.signals.late_rate
                                ? `${autoConfig.signals.late_rate}% late`
                                : null,
                              autoConfig.signals.missing_rate
                                ? `${autoConfig.signals.missing_rate}% missed`
                                : null,
                            ].filter(Boolean) as string[]
                          }
                          color={
                            (autoConfig.signals.on_time_rate || 0) >= 80
                              ? "green"
                              : (autoConfig.signals.on_time_rate || 0) >= 60
                                ? "yellow"
                                : "red"
                          }
                        />
                      )}

                      {autoConfig.signals.current_avg_score !== null && (
                        <InsightCard
                          index={2}
                          label="Current Performance"
                          icon={<Target className="h-3.5 w-3.5" />}
                          value={autoConfig.reasoning.gpa_reason}
                          stats={[
                            `Avg: ${autoConfig.signals.current_avg_score}%`,
                          ]}
                          color={
                            autoConfig.signals.current_avg_score >= 85
                              ? "green"
                              : autoConfig.signals.current_avg_score >= 70
                                ? "yellow"
                                : "red"
                          }
                        />
                      )}

                      {autoConfig.signals.weekly_class_hours > 0 && (
                        <InsightCard
                          index={3}
                          label="Schedule Analysis"
                          icon={
                            <SlidersHorizontal className="h-3.5 w-3.5" />
                          }
                          value={autoConfig.reasoning.peak_hours_reason}
                          stats={
                            [
                              `~${autoConfig.signals.weekly_class_hours}hrs/week`,
                              autoConfig.signals.busiest_day
                                ? `Busiest: ${autoConfig.signals.busiest_day}`
                                : null,
                            ].filter(Boolean) as string[]
                          }
                        />
                      )}

                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          type: "spring" as const,
                          stiffness: 400,
                          damping: 30,
                          delay: 0.35,
                        }}
                        className="flex items-start gap-2 rounded-lg bg-purple-500/[0.04] border border-purple-500/15 p-3"
                      >
                        <Info className="h-4 w-4 text-purple-400 mt-0.5 shrink-0" />
                        <p className="text-xs text-muted-foreground">
                          All settings are pre-filled based on this analysis.
                          Review and adjust in the next steps.
                        </p>
                      </motion.div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-border/30 bg-white/[0.02] p-8 text-center">
                      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.04]">
                        <Brain className="h-6 w-6 text-muted-foreground/40" />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Connect Canvas and Google to get personalized settings,
                        or continue to set them manually.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* ============================== */}
              {/* Step 3: Personal Why            */}
              {/* ============================== */}
              {step === 3 && (
                <div className="space-y-4">
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      type: "spring" as const,
                      stiffness: 400,
                      damping: 30,
                      delay: 0.1,
                    }}
                    className="relative rounded-xl border border-rose-500/15 bg-rose-500/[0.03] p-4"
                  >
                    <Quote className="absolute right-3 top-3 h-8 w-8 text-rose-500/10" />
                    <Textarea
                      value={data.personal_why}
                      onChange={(e) =>
                        setData({ ...data, personal_why: e.target.value })
                      }
                      placeholder="e.g., I want to be the first in my family to graduate and get into med school. My mom works two jobs so I can be here, and I'm not going to waste that."
                      rows={5}
                      autoFocus
                      className="relative border-0 bg-transparent resize-none focus-visible:ring-0 placeholder:text-muted-foreground/30"
                    />
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      type: "spring" as const,
                      stiffness: 400,
                      damping: 30,
                      delay: 0.18,
                    }}
                    className="flex items-start gap-2 rounded-lg bg-white/[0.02] border border-border/20 p-3"
                  >
                    <Lock className="h-3.5 w-3.5 text-muted-foreground/40 mt-0.5 shrink-0" />
                    <p className="text-xs text-muted-foreground/60">
                      This stays completely private. I&apos;ll use your exact
                      words when you need a reminder of why you&apos;re doing
                      this.
                    </p>
                  </motion.div>
                </div>
              )}

              {/* ============================== */}
              {/* Step 4: Goals + GPA             */}
              {/* ============================== */}
              {step === 4 && (
                <div className="space-y-4">
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      type: "spring" as const,
                      stiffness: 400,
                      damping: 30,
                      delay: 0.1,
                    }}
                    className="rounded-xl border border-border/30 bg-white/[0.02] p-4 space-y-3"
                  >
                    <label className="block text-sm font-medium text-muted-foreground">
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
                      className="border-white/10 bg-white/[0.03]"
                    />
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      type: "spring" as const,
                      stiffness: 400,
                      damping: 30,
                      delay: 0.18,
                    }}
                    className="rounded-xl border border-border/30 bg-white/[0.02] p-4"
                  >
                    <label className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <Target className="h-3.5 w-3.5 text-amber-400" />
                      GPA target
                      {autoConfig?.gpa_target && (
                        <span className="rounded-full bg-purple-500/10 px-2 py-0.5 text-xs text-purple-400">
                          AI: {autoConfig.gpa_target}
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
                      className="border-white/10 bg-white/[0.03]"
                    />
                  </motion.div>
                </div>
              )}

              {/* ============================== */}
              {/* Step 5: Productivity Settings   */}
              {/* ============================== */}
              {step === 5 && (
                <div className="space-y-4">
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      type: "spring" as const,
                      stiffness: 400,
                      damping: 30,
                      delay: 0.1,
                    }}
                    className="rounded-xl border border-border/30 bg-white/[0.02] p-4"
                  >
                    <label className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      Peak productivity hours
                      {autoConfig &&
                        autoConfig.productivity_peak_hours.length > 0 && (
                          <span className="rounded-full bg-purple-500/10 px-2 py-0.5 text-xs text-purple-400">
                            AI configured
                          </span>
                        )}
                    </label>
                    <Input
                      value={data.productivity_peak}
                      onChange={(e) =>
                        setData({
                          ...data,
                          productivity_peak: e.target.value,
                        })
                      }
                      placeholder="09:00, 10:00, 14:00, 15:00"
                      autoFocus
                      className="border-white/10 bg-white/[0.03]"
                    />
                    {autoConfig?.reasoning.peak_hours_reason && (
                      <p className="mt-2 text-xs text-muted-foreground/60">
                        {autoConfig.reasoning.peak_hours_reason}
                      </p>
                    )}
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      type: "spring" as const,
                      stiffness: 400,
                      damping: 30,
                      delay: 0.18,
                    }}
                    className="grid grid-cols-2 gap-3"
                  >
                    <div className="rounded-xl border border-border/30 bg-white/[0.02] p-4">
                      <label className="mb-2 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                        <Moon className="h-3.5 w-3.5 text-indigo-400" />
                        Sleep
                        {autoConfig && (
                          <span className="rounded-full bg-purple-500/10 px-1.5 py-0.5 text-[10px] text-purple-400">
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
                        className="border-white/10 bg-white/[0.03]"
                      />
                    </div>
                    <div className="rounded-xl border border-border/30 bg-white/[0.02] p-4">
                      <label className="mb-2 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                        <Sun className="h-3.5 w-3.5 text-amber-400" />
                        Wake
                        {autoConfig && (
                          <span className="rounded-full bg-purple-500/10 px-1.5 py-0.5 text-[10px] text-purple-400">
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
                        className="border-white/10 bg-white/[0.03]"
                      />
                    </div>
                  </motion.div>

                  {autoConfig?.reasoning.sleep_reason && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.25 }}
                      className="text-xs text-muted-foreground/60"
                    >
                      {autoConfig.reasoning.sleep_reason}
                    </motion.p>
                  )}
                </div>
              )}

              {/* ============================== */}
              {/* Step 6: Nudge Intensity         */}
              {/* ============================== */}
              {step === 6 && (
                <div className="space-y-3">
                  {(["gentle", "standard", "aggressive"] as const).map(
                    (mode, modeIndex) => {
                      const isRecommended =
                        autoConfig?.escalation_mode === mode;
                      const modeConfig = {
                        gentle: {
                          icon: (
                            <Shield className="h-5 w-5 text-emerald-400" />
                          ),
                          gradient:
                            "from-emerald-500/[0.06] to-emerald-500/[0.02]",
                          activeBorder: "border-emerald-500/40",
                          activeGlow:
                            "shadow-[0_0_20px_rgba(16,185,129,0.08)]",
                          desc: "Friendly reminders. No guilt trips. I'll suggest but never force.",
                        },
                        standard: {
                          icon: <Flame className="h-5 w-5 text-amber-400" />,
                          gradient:
                            "from-amber-500/[0.06] to-amber-500/[0.02]",
                          activeBorder: "border-amber-500/40",
                          activeGlow:
                            "shadow-[0_0_20px_rgba(245,158,11,0.08)]",
                          desc: "I'll be direct. If you're procrastinating, I'll call it out \u2014 with love.",
                        },
                        aggressive: {
                          icon: <Swords className="h-5 w-5 text-red-400" />,
                          gradient: "from-red-500/[0.06] to-red-500/[0.02]",
                          activeBorder: "border-red-500/40",
                          activeGlow: "shadow-[0_0_20px_rgba(239,68,68,0.08)]",
                          desc: "Full accountability mode. I will block your free time if you ignore me.",
                        },
                      };
                      const mc = modeConfig[mode];
                      const isActive = data.escalation_mode === mode;

                      return (
                        <motion.button
                          key={mode}
                          initial={{ opacity: 0, y: 14 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{
                            type: "spring" as const,
                            stiffness: 400,
                            damping: 30,
                            delay: modeIndex * 0.08,
                          }}
                          onClick={() =>
                            setData({ ...data, escalation_mode: mode })
                          }
                          className={`group relative flex w-full items-start gap-4 overflow-hidden rounded-xl border p-4 text-left transition-all duration-200 active-press ${
                            isActive
                              ? `${mc.activeBorder} bg-gradient-to-r ${mc.gradient} ${mc.activeGlow}`
                              : "border-border/30 bg-white/[0.01] hover:border-border/50 hover:bg-white/[0.03]"
                          }`}
                        >
                          {isActive && (
                            <motion.div
                              layoutId="onboarding-escalation"
                              className={`absolute inset-0 rounded-xl border-2 ${mc.activeBorder}`}
                              transition={{
                                type: "spring" as const,
                                stiffness: 400,
                                damping: 30,
                              }}
                            />
                          )}
                          <div
                            className={`relative mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform ${
                              isActive
                                ? "bg-white/[0.06]"
                                : "bg-white/[0.03]"
                            } ${isActive ? "scale-105" : "group-hover:scale-105"}`}
                          >
                            {mc.icon}
                          </div>
                          <div className="relative min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold capitalize">
                                {mode}
                              </p>
                              {isRecommended && (
                                <span className="rounded-full bg-purple-500/15 px-2 py-0.5 text-[10px] font-medium text-purple-400 flex items-center gap-1">
                                  <Brain className="h-2.5 w-2.5" />
                                  AI pick
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 text-sm text-muted-foreground">
                              {mc.desc}
                            </p>
                          </div>
                        </motion.button>
                      );
                    }
                  )}
                  {autoConfig?.reasoning.escalation_reason && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        type: "spring" as const,
                        stiffness: 400,
                        damping: 30,
                        delay: 0.3,
                      }}
                      className="flex items-start gap-2 rounded-lg bg-purple-500/[0.04] border border-purple-500/15 p-3"
                    >
                      <Brain className="h-4 w-4 text-purple-400 mt-0.5 shrink-0" />
                      <p className="text-xs text-muted-foreground">
                        {autoConfig.reasoning.escalation_reason}
                      </p>
                    </motion.div>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* ===== Navigation ===== */}
          <div className="mt-8 flex items-center justify-between border-t border-border/20 pt-6">
            <Button
              variant="ghost"
              onClick={() => goToStep(step - 1)}
              disabled={step === 0}
              className="gap-2 text-muted-foreground active-press"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>

            <div className="flex items-center gap-2">
              {step < steps.length - 1 && (
                <Button
                  variant="ghost"
                  onClick={() => goToStep(step + 1)}
                  className="gap-1 text-muted-foreground/60 hover:text-muted-foreground active-press"
                >
                  Skip
                  <SkipForward className="h-3 w-3" />
                </Button>
              )}

              {step < steps.length - 1 ? (
                <Button
                  onClick={() => goToStep(step + 1)}
                  disabled={step === 2 && isAutoConfiguring}
                  className="gap-2 bg-purple-600 shadow-lg shadow-purple-500/20 hover:bg-purple-700 hover:shadow-purple-500/30 active-press"
                >
                  {step === 2 && isAutoConfiguring ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  Next
                  <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  onClick={handleFinish}
                  disabled={isSaving}
                  className="gap-2 bg-purple-600 shadow-lg shadow-purple-500/25 hover:bg-purple-700 hover:shadow-purple-500/35 active-press animate-glow-pulse"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  Let&apos;s Go
                </Button>
              )}
            </div>
          </div>
        </motion.div>

        {/* Subtle branding footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-6 text-center text-[11px] text-muted-foreground/30"
        >
          Rewired AI &mdash; Your academic co-pilot
        </motion.p>
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
  index = 0,
  icon,
}: {
  label: string;
  value: string;
  stats?: string[];
  color?: "purple" | "green" | "yellow" | "red";
  index?: number;
  icon?: React.ReactNode;
}) {
  const borderColors = {
    purple: "border-purple-500/15",
    green: "border-emerald-500/15",
    yellow: "border-amber-500/15",
    red: "border-red-500/15",
  };
  const bgColors = {
    purple: "bg-purple-500/[0.03]",
    green: "bg-emerald-500/[0.03]",
    yellow: "bg-amber-500/[0.03]",
    red: "bg-red-500/[0.03]",
  };
  const iconColors = {
    purple: "text-purple-400 bg-purple-500/10",
    green: "text-emerald-400 bg-emerald-500/10",
    yellow: "text-amber-400 bg-amber-500/10",
    red: "text-red-400 bg-red-500/10",
  };
  const statBgColors = {
    purple: "bg-purple-500/10 text-purple-400",
    green: "bg-emerald-500/10 text-emerald-400",
    yellow: "bg-amber-500/10 text-amber-400",
    red: "bg-red-500/10 text-red-400",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        type: "spring" as const,
        stiffness: 400,
        damping: 30,
        delay: index * 0.08,
      }}
      className={`rounded-xl border ${borderColors[color]} ${bgColors[color]} p-4 hover-lift transition-all`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {icon && (
            <div
              className={`flex h-5 w-5 items-center justify-center rounded ${iconColors[color]}`}
            >
              {icon}
            </div>
          )}
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
        </div>
        {stats && stats.length > 0 && (
          <div className="flex gap-1.5">
            {stats.map((stat) => (
              <span
                key={stat}
                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statBgColors[color]}`}
              >
                {stat}
              </span>
            ))}
          </div>
        )}
      </div>
      <p className="text-sm text-foreground/70">{value}</p>
    </motion.div>
  );
}
