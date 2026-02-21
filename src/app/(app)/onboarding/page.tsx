"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Zap, ArrowRight, ArrowLeft, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const steps = [
  {
    title: "Welcome to Rewired",
    subtitle: "Let's get to know you so I can actually help.",
  },
  {
    title: "What's your big goal?",
    subtitle:
      "Why are you in college? This isn't a test — I'll use this to motivate you when things get hard.",
  },
  {
    title: "This semester",
    subtitle: "What do you want to accomplish?",
  },
  {
    title: "How you work best",
    subtitle: "Help me schedule your study time at the right moments.",
  },
  {
    title: "How hard should I push?",
    subtitle: "Choose your nudge intensity. You can always change this later.",
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [data, setData] = useState({
    full_name: "",
    personal_why: "",
    semester_goals: "",
    gpa_target: "",
    productivity_peak: "",
    sleep_time: "23:00",
    wake_time: "08:00",
    escalation_mode: "standard" as "gentle" | "standard" | "aggressive",
  });

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
        toast.success("You're all set! Let's go.");
        router.push("/dashboard");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsSaving(false);
    }
  }

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

        <div className="mb-2 flex items-center gap-2">
          <Zap className="h-5 w-5 text-purple-500" />
          <span className="text-sm text-muted-foreground">
            Step {step + 1} of {steps.length}
          </span>
        </div>

        <h2 className="mb-1 text-2xl font-bold">{steps[step].title}</h2>
        <p className="mb-8 text-muted-foreground">{steps[step].subtitle}</p>

        {/* Step content */}
        {step === 0 && (
          <div className="space-y-4">
            <div>
              <label className="mb-1 text-sm text-muted-foreground">
                What should I call you?
              </label>
              <Input
                value={data.full_name}
                onChange={(e) => setData({ ...data, full_name: e.target.value })}
                placeholder="Your name"
                autoFocus
              />
            </div>
          </div>
        )}

        {step === 1 && (
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

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <label className="mb-1 text-sm text-muted-foreground">
                Semester goals (one per line)
              </label>
              <Textarea
                value={data.semester_goals}
                onChange={(e) =>
                  setData({ ...data, semester_goals: e.target.value })
                }
                placeholder={"Make the Dean's List\nSubmit my research paper\nGet an internship offer"}
                rows={4}
                autoFocus
              />
            </div>
            <div>
              <label className="mb-1 text-sm text-muted-foreground">
                GPA target
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

        {step === 3 && (
          <div className="space-y-4">
            <div>
              <label className="mb-1 text-sm text-muted-foreground">
                When are you most productive? (e.g., 10:00-13:00, 19:00-22:00)
              </label>
              <Input
                value={data.productivity_peak}
                onChange={(e) =>
                  setData({ ...data, productivity_peak: e.target.value })
                }
                placeholder="10:00-13:00, 19:00-22:00"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 text-sm text-muted-foreground">
                  I usually sleep at
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
                <label className="mb-1 text-sm text-muted-foreground">
                  I usually wake up at
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
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3">
            {(["gentle", "standard", "aggressive"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setData({ ...data, escalation_mode: mode })}
                className={`w-full rounded-xl border p-4 text-left transition-colors ${
                  data.escalation_mode === mode
                    ? "border-purple-500 bg-purple-500/10"
                    : "border-border/50 hover:border-border"
                }`}
              >
                <p className="font-semibold capitalize">{mode}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {mode === "gentle" &&
                    "Friendly reminders. No guilt trips. I'll suggest but never force."}
                  {mode === "standard" &&
                    "I'll be direct. If you're procrastinating, I'll call it out — with love."}
                  {mode === "aggressive" &&
                    "Full accountability mode. I will block your free time if you ignore me. You asked for this."}
                </p>
              </button>
            ))}
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

          {step < steps.length - 1 ? (
            <Button
              onClick={() => setStep(step + 1)}
              className="bg-purple-600 hover:bg-purple-700"
            >
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
  );
}
