"use client";

import { motion } from "motion/react";
import { Brain, Quote } from "lucide-react";

export function Testimonial() {
  return (
    <section className="relative overflow-hidden py-32">
      {/* Decorative elements */}
      <div className="pointer-events-none absolute inset-0">
        <div className="animate-float-2 absolute right-1/4 top-1/4 h-[300px] w-[300px] rounded-full bg-purple-600/10 blur-[100px]" />
      </div>

      <div className="relative mx-auto max-w-4xl px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.8 }}
          className="group relative overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.03] p-12 backdrop-blur-sm sm:p-16"
        >
          {/* Hover gradient */}
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-purple-500/10 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

          {/* Decorative quote marks */}
          <Quote className="absolute left-6 top-6 h-12 w-12 text-purple-500/10" />
          <Quote className="absolute bottom-6 right-6 h-12 w-12 rotate-180 text-purple-500/10" />

          <div className="relative text-center">
            <motion.div
              initial={{ scale: 0 }}
              whileInView={{ scale: 1 }}
              viewport={{ once: true }}
              transition={{
                type: "spring",
                stiffness: 200,
                damping: 20,
                delay: 0.2,
              }}
              className="mx-auto mb-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 shadow-xl shadow-purple-500/25"
            >
              <Brain className="h-8 w-8 text-white" />
            </motion.div>

            <blockquote className="mb-8 text-2xl font-bold leading-relaxed sm:text-4xl">
              <motion.span
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: 0.3 }}
              >
                &ldquo;AI forced me to stop procrastinating for{" "}
                <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                  7 days
                </span>
                .&rdquo;
              </motion.span>
            </blockquote>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="text-lg text-muted-foreground"
            >
              Rewired doesn&apos;t judge you. It just helps you get there.
              <br />
              <span className="text-purple-400/80">
                Built for students who are trying their best.
              </span>
            </motion.p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
