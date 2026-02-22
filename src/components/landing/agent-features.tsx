"use client";

import { motion } from "motion/react";
import { Activity, Brain, ListOrdered, AlertTriangle } from "lucide-react";

const agentFeatures = [
  {
    icon: Activity,
    title: "Continuous Background Reasoning",
    description:
      "Checks your emails, deadlines, grades, and calendar on a loop. Takes proactive action without you asking.",
    size: "large" as const,
    gradient: "from-purple-600/20 to-blue-600/20",
  },
  {
    icon: Brain,
    title: "Memory & Personalization",
    description:
      "Learns when you study best, which courses you procrastinate on, and adapts its nudges to your patterns.",
    size: "normal" as const,
    gradient: "from-pink-600/20 to-rose-600/20",
  },
  {
    icon: ListOrdered,
    title: "Task Prioritization",
    description:
      'Maintains a ranked priority queue of what you should be doing right now. Your #1 task is always front and center.',
    size: "normal" as const,
    gradient: "from-green-600/20 to-emerald-600/20",
  },
  {
    icon: AlertTriangle,
    title: "Escalation Logic",
    description:
      'Gentle at first. Gets more aggressive as deadlines approach. Ignore it 3 times? It blocks your Friday night.',
    size: "large" as const,
    gradient: "from-orange-600/20 to-amber-600/20",
  },
];

export function AgentFeatures() {
  return (
    <section className="relative overflow-hidden border-t border-white/[0.06] bg-white/[0.02] py-32">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-16 text-center"
        >
          <span className="mb-4 inline-block text-sm font-medium uppercase tracking-widest text-purple-400">
            The Agent
          </span>
          <h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-5xl">
            Not just a tool.{" "}
            <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              An agent.
            </span>
          </h2>
          <p className="mx-auto max-w-xl text-lg text-muted-foreground">
            Rewired thinks continuously in the background — even when
            you&apos;re not using it.
          </p>
        </motion.div>

        <div className="grid gap-5 sm:grid-cols-2">
          {agentFeatures.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className={`group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] p-8 transition-all duration-500 hover:border-white/[0.15] ${
                feature.size === "large" ? "sm:col-span-2" : ""
              }`}
            >
              {/* Hover gradient background */}
              <div
                className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 transition-opacity duration-500 group-hover:opacity-100`}
              />

              <div className="relative">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                    <feature.icon className="h-5 w-5 text-purple-400" />
                  </div>
                  {/* Live indicator */}
                  <div className="flex items-center gap-1.5 rounded-full border border-green-500/20 bg-green-500/10 px-2.5 py-0.5 text-xs text-green-400">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-500" />
                    </span>
                    Always on
                  </div>
                </div>
                <h3 className="mb-2 text-xl font-semibold">{feature.title}</h3>
                <p className="leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
