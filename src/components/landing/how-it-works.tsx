"use client";

import { motion } from "motion/react";

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

export function HowItWorks() {
  return (
    <section className="relative overflow-hidden border-y border-white/[0.06] bg-white/[0.02] py-32">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-20 text-center"
        >
          <span className="mb-4 inline-block text-sm font-medium uppercase tracking-widest text-purple-400">
            How it works
          </span>
          <h2 className="text-3xl font-bold tracking-tight sm:text-5xl">
            Three steps to{" "}
            <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              sanity
            </span>
          </h2>
        </motion.div>

        <div className="relative grid gap-12 sm:grid-cols-3 sm:gap-8">
          {/* Connecting line */}
          <div className="absolute top-8 left-[20%] right-[20%] hidden h-px sm:block">
            <motion.div
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1, delay: 0.5 }}
              className="h-full w-full origin-left bg-gradient-to-r from-purple-500/50 via-pink-500/50 to-purple-500/50"
            />
          </div>

          {steps.map((step, index) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: index * 0.2 }}
              className="relative text-center"
            >
              <div className="relative z-10 mx-auto mb-6 flex h-16 w-16 items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-purple-500/10 animate-ping-slow" />
                <div className="relative flex h-14 w-14 items-center justify-center rounded-full border-2 border-purple-500/30 bg-background text-xl font-bold text-purple-400 shadow-lg shadow-purple-500/10">
                  {step.number}
                </div>
              </div>
              <h3 className="mb-3 text-xl font-semibold">{step.title}</h3>
              <p className="leading-relaxed text-muted-foreground">
                {step.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
