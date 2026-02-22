"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import {
  motion,
  useInView,
  useMotionValue,
  useSpring,
} from "motion/react";
import { ArrowRight, Sparkles, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";

function AnimatedCounter({
  value,
  suffix = "",
}: {
  value: number;
  suffix?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, { stiffness: 50, damping: 20 });

  useEffect(() => {
    if (inView) {
      motionValue.set(value);
    }
  }, [inView, value, motionValue]);

  useEffect(() => {
    const unsubscribe = spring.on("change", (v) => {
      if (ref.current) {
        ref.current.textContent = Math.round(v).toLocaleString() + suffix;
      }
    });
    return unsubscribe;
  }, [spring, suffix]);

  return <span ref={ref}>0{suffix}</span>;
}

const heroWords = ["Stop", "managing."];
const gradientWords = ["Start", "living."];

const stats = [
  { value: 2500, suffix: "+", label: "Students" },
  { value: 50000, suffix: "+", label: "Deadlines Tracked" },
  { value: 98, suffix: "%", label: "On-Time Rate" },
];

export function Hero() {
  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 pt-16">
      {/* Animated gradient orbs */}
      <div className="pointer-events-none absolute inset-0">
        <div className="animate-float-1 absolute left-1/4 top-1/4 h-[500px] w-[500px] rounded-full bg-purple-600/20 blur-[120px]" />
        <div className="animate-float-2 absolute right-1/4 top-1/3 h-[400px] w-[400px] rounded-full bg-pink-600/15 blur-[120px]" />
        <div className="animate-float-3 absolute bottom-1/4 left-1/3 h-[350px] w-[350px] rounded-full bg-blue-600/10 blur-[120px]" />
      </div>

      {/* Grid pattern */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_70%)]" />

      <div className="relative z-10 mx-auto max-w-5xl text-center">
        {/* Animated badge */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mb-8 inline-flex items-center gap-2 rounded-full border border-purple-500/20 bg-purple-500/10 px-4 py-1.5 text-sm text-purple-300 backdrop-blur-sm"
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-purple-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-purple-500" />
          </span>
          AI-powered life admin for students
          <Sparkles className="h-3.5 w-3.5" />
        </motion.div>

        {/* Animated heading */}
        <h1 className="mb-6 text-5xl font-bold leading-[1.1] tracking-tight sm:text-7xl lg:text-8xl">
          <span className="block overflow-hidden">
            {heroWords.map((word, i) => (
              <motion.span
                key={word}
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{
                  duration: 0.6,
                  delay: 0.4 + i * 0.1,
                  ease: [0.25, 0.46, 0.45, 0.94],
                }}
                className="mr-4 inline-block"
              >
                {word}
              </motion.span>
            ))}
          </span>
          <span className="block overflow-hidden">
            {gradientWords.map((word, i) => (
              <motion.span
                key={word}
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{
                  duration: 0.6,
                  delay: 0.6 + i * 0.1,
                  ease: [0.25, 0.46, 0.45, 0.94],
                }}
                className="mr-4 inline-block bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-[size:200%_auto] bg-clip-text text-transparent animate-gradient-x"
              >
                {word}
              </motion.span>
            ))}
          </span>
        </h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl"
        >
          Rewired is an autonomous AI agent that reads your email, tracks your
          deadlines, manages your calendar, monitors your grades, and nudges you
          before disaster strikes.
        </motion.p>

        {/* CTA Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1 }}
          className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center"
        >
          <Link href="/login">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                size="lg"
                className="group relative overflow-hidden bg-purple-600 px-8 text-lg shadow-2xl shadow-purple-500/25 transition-all hover:bg-purple-500 hover:shadow-purple-500/40"
              >
                <span className="relative z-10 flex items-center">
                  Get Started Free
                  <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                </span>
                <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
              </Button>
            </motion.div>
          </Link>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 1.2 }}
          className="mt-6 text-sm text-muted-foreground/60"
        >
          No credit card required. Built for students who are trying their best.
        </motion.p>

        {/* Stats bar */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.4 }}
          className="mt-16 flex flex-wrap items-center justify-center gap-8 sm:gap-16"
        >
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-2xl font-bold text-foreground sm:text-3xl">
                <AnimatedCounter value={stat.value} suffix={stat.suffix} />
              </div>
              <div className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">
                {stat.label}
              </div>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          <ChevronDown className="h-6 w-6 text-muted-foreground/40" />
        </motion.div>
      </motion.div>
    </section>
  );
}
