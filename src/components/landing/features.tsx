"use client";

import { useRef, useState } from "react";
import { motion } from "motion/react";
import {
  Mail,
  Calendar,
  Clock,
  GraduationCap,
  BookOpen,
  Bell,
} from "lucide-react";

const features = [
  {
    icon: Mail,
    title: "Reads Your Email",
    description:
      "Scans your inbox, categorizes emails, summarizes them in plain English, and flags anything you actually need to act on.",
    gradient: "from-blue-500 to-cyan-500",
    glow: "group-hover:shadow-blue-500/20",
  },
  {
    icon: Calendar,
    title: "Manages Your Calendar",
    description:
      "Knows your schedule, finds free windows, and auto-places study blocks when deadlines approach. Syncs with Google Calendar.",
    gradient: "from-purple-500 to-pink-500",
    glow: "group-hover:shadow-purple-500/20",
  },
  {
    icon: Clock,
    title: "Tracks Every Deadline",
    description:
      "Parses your syllabi, scans emails, and builds a master deadline registry. Never miss another assignment again.",
    gradient: "from-orange-500 to-red-500",
    glow: "group-hover:shadow-orange-500/20",
  },
  {
    icon: GraduationCap,
    title: "Monitors Your Grades",
    description:
      'Calculates weighted averages, projects final grades, and tells you exactly what you need on the final to get that B+.',
    gradient: "from-green-500 to-emerald-500",
    glow: "group-hover:shadow-green-500/20",
  },
  {
    icon: BookOpen,
    title: "Auto-Schedules Study Time",
    description:
      "Analyzes your workload and habits, then creates optimal study blocks around your existing commitments.",
    gradient: "from-violet-500 to-purple-500",
    glow: "group-hover:shadow-violet-500/20",
  },
  {
    icon: Bell,
    title: "Nudges Before Disaster",
    description:
      "Escalating reminders that get more aggressive the longer you procrastinate. Ignored it 3 times? Friday night is now blocked.",
    gradient: "from-pink-500 to-rose-500",
    glow: "group-hover:shadow-pink-500/20",
  },
];

function FeatureCard({
  feature,
  index,
}: {
  feature: (typeof features)[0];
  index: number;
}) {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 transition-all duration-500 hover:border-white/[0.15] hover:shadow-2xl ${feature.glow}`}
    >
      {/* Mouse follow gradient */}
      {isHovered && (
        <div
          className="pointer-events-none absolute -inset-px opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{
            background: `radial-gradient(400px circle at ${mousePos.x}px ${mousePos.y}px, rgba(168, 85, 247, 0.1), transparent 40%)`,
          }}
        />
      )}

      <div
        className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${feature.gradient} shadow-lg`}
      >
        <feature.icon className="h-6 w-6 text-white" />
      </div>
      <h3 className="mb-2 text-lg font-semibold tracking-tight">
        {feature.title}
      </h3>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {feature.description}
      </p>
    </motion.div>
  );
}

export function Features() {
  return (
    <section className="relative py-32">
      {/* Subtle background */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-900/10 via-transparent to-transparent" />

      <div className="relative mx-auto max-w-6xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-16 text-center"
        >
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-4 inline-block text-sm font-medium uppercase tracking-widest text-purple-400"
          >
            Features
          </motion.span>
          <h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-5xl">
            Everything running in the{" "}
            <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              background
            </span>
          </h2>
          <p className="mx-auto max-w-xl text-lg text-muted-foreground">
            While you focus on actually learning, Rewired handles the rest.
          </p>
        </motion.div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <FeatureCard key={feature.title} feature={feature} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
