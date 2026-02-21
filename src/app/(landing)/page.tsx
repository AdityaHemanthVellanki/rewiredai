import Link from "next/link";
import {
  Mail,
  Calendar,
  Clock,
  GraduationCap,
  BookOpen,
  Bell,
  Zap,
  Brain,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  {
    icon: Mail,
    title: "Reads Your Email",
    description:
      "Scans your inbox, categorizes emails, summarizes them in plain English, and flags anything you actually need to act on.",
  },
  {
    icon: Calendar,
    title: "Manages Your Calendar",
    description:
      "Knows your schedule, finds free windows, and auto-places study blocks when deadlines approach. Syncs with Google Calendar.",
  },
  {
    icon: Clock,
    title: "Tracks Every Deadline",
    description:
      "Parses your syllabi, scans emails, and builds a master deadline registry. Never miss another assignment again.",
  },
  {
    icon: GraduationCap,
    title: "Monitors Your Grades",
    description:
      'Calculates weighted averages, projects final grades, and tells you exactly what you need on the final to get that B+.',
  },
  {
    icon: BookOpen,
    title: "Auto-Schedules Study Time",
    description:
      "Analyzes your workload and habits, then creates optimal study blocks around your existing commitments.",
  },
  {
    icon: Bell,
    title: "Nudges Before Disaster",
    description:
      "Escalating reminders that get more aggressive the longer you procrastinate. Ignored it 3 times? Friday night is now blocked.",
  },
];

const steps = [
  {
    number: "01",
    title: "Connect Your Accounts",
    description:
      "Sign in with Google. Connect your email and calendar. Upload your syllabi. That's it.",
  },
  {
    number: "02",
    title: "Rewired Learns Your Life",
    description:
      "It reads your emails, parses your deadlines, maps your schedule, and understands your habits.",
  },
  {
    number: "03",
    title: "Sit Back (Kind Of)",
    description:
      "Rewired runs your life ops in the background. It nudges, schedules, and keeps you on track — so you can actually focus.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="fixed top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <Zap className="h-6 w-6 text-purple-500" />
            <span className="text-xl font-bold">Rewired</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost" size="sm">
                Log in
              </Button>
            </Link>
            <Link href="/login">
              <Button size="sm" className="bg-purple-600 hover:bg-purple-700">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative flex min-h-screen flex-col items-center justify-center px-6 pt-16">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-900/20 via-background to-background" />
        <div className="relative z-10 mx-auto max-w-4xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-purple-500/20 bg-purple-500/10 px-4 py-1.5 text-sm text-purple-400">
            <Sparkles className="h-4 w-4" />
            AI-powered life admin for students
          </div>
          <h1 className="mb-6 text-5xl font-bold leading-tight tracking-tight sm:text-7xl">
            Stop managing.
            <br />
            <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Start living.
            </span>
          </h1>
          <p className="mb-8 text-lg text-muted-foreground sm:text-xl">
            Rewired is an autonomous AI agent that reads your email, tracks your
            deadlines, manages your calendar, monitors your grades, and nudges
            you before disaster strikes.
          </p>
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link href="/login">
              <Button
                size="lg"
                className="bg-purple-600 px-8 text-lg hover:bg-purple-700"
              >
                Get Started Free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
          <p className="mt-6 text-sm text-muted-foreground">
            No credit card required. Built for students who are trying their best.
          </p>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold sm:text-4xl">
              Everything running in the background
            </h2>
            <p className="text-lg text-muted-foreground">
              While you focus on actually learning, Rewired handles the rest.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group rounded-xl border border-border/50 bg-card/50 p-6 transition-all hover:border-purple-500/30 hover:bg-card"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-purple-500/10">
                  <feature.icon className="h-6 w-6 text-purple-400" />
                </div>
                <h3 className="mb-2 text-lg font-semibold">{feature.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="border-y border-border/40 bg-card/30 py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold sm:text-4xl">
              Three steps to sanity
            </h2>
          </div>
          <div className="grid gap-8 sm:grid-cols-3">
            {steps.map((step) => (
              <div key={step.number} className="text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-purple-500/10 text-xl font-bold text-purple-400">
                  {step.number}
                </div>
                <h3 className="mb-2 text-lg font-semibold">{step.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Viral Section */}
      <section className="py-24">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <div className="rounded-2xl border border-purple-500/20 bg-gradient-to-b from-purple-500/10 to-transparent p-12">
            <Brain className="mx-auto mb-6 h-12 w-12 text-purple-400" />
            <blockquote className="mb-6 text-2xl font-bold italic sm:text-3xl">
              &ldquo;AI forced me to stop procrastinating for 7 days.&rdquo;
            </blockquote>
            <p className="text-muted-foreground">
              Rewired doesn&apos;t judge you. It just helps you get there.
              <br />
              Built for students who are trying their best.
            </p>
          </div>
        </div>
      </section>

      {/* Agent Layer */}
      <section className="border-t border-border/40 bg-card/30 py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold sm:text-4xl">
              Not just a tool. An agent.
            </h2>
            <p className="text-lg text-muted-foreground">
              Rewired thinks continuously in the background — even when
              you&apos;re not using it.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            {[
              {
                title: "Continuous Background Reasoning",
                description:
                  "Checks your emails, deadlines, grades, and calendar on a loop. Takes proactive action without you asking.",
              },
              {
                title: "Memory & Personalization",
                description:
                  "Learns when you study best, which courses you procrastinate on, and adapts its nudges to your patterns.",
              },
              {
                title: "Task Prioritization",
                description:
                  'Maintains a ranked priority queue of what you should be doing right now. Your #1 task is always front and center.',
              },
              {
                title: "Escalation Logic",
                description:
                  'Gentle at first. Gets more aggressive as deadlines approach. Ignore it 3 times? It blocks your Friday night.',
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-xl border border-border/50 bg-card/50 p-6"
              >
                <h3 className="mb-2 text-lg font-semibold">{item.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="mb-4 text-3xl font-bold sm:text-4xl">
            Ready to get your life together?
          </h2>
          <p className="mb-8 text-lg text-muted-foreground">
            Join thousands of students who stopped drowning in admin and started
            actually learning.
          </p>
          <Link href="/login">
            <Button
              size="lg"
              className="bg-purple-600 px-8 text-lg hover:bg-purple-700"
            >
              Get Started Free
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 py-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Zap className="h-4 w-4 text-purple-500" />
            Rewired
          </div>
          <p className="text-sm text-muted-foreground">
            The AI doesn&apos;t judge you. It just helps you get there.
          </p>
        </div>
      </footer>
    </div>
  );
}
