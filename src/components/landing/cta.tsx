"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CTA() {
  return (
    <section className="relative overflow-hidden py-32">
      {/* Aurora background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="animate-float-1 absolute left-1/3 top-1/3 h-[400px] w-[600px] rounded-full bg-purple-600/15 blur-[150px]" />
        <div className="animate-float-3 absolute bottom-1/3 right-1/3 h-[400px] w-[600px] rounded-full bg-pink-600/10 blur-[150px]" />
      </div>

      <div className="relative mx-auto max-w-4xl px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <h2 className="mb-6 text-4xl font-bold tracking-tight sm:text-6xl">
            Ready to get your life{" "}
            <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-[size:200%_auto] bg-clip-text text-transparent animate-gradient-x">
              together?
            </span>
          </h2>
          <p className="mx-auto mb-10 max-w-xl text-lg text-muted-foreground">
            Join thousands of students who stopped drowning in admin and started
            actually learning.
          </p>

          <Link href="/login">
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="inline-block"
            >
              <Button
                size="lg"
                className="group relative overflow-hidden bg-purple-600 px-10 py-6 text-lg shadow-2xl shadow-purple-500/30 transition-all hover:bg-purple-500 hover:shadow-purple-500/50"
              >
                <span className="relative z-10 flex items-center text-lg">
                  Get Started Free
                  <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                </span>
                <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
              </Button>
            </motion.div>
          </Link>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="mt-6 text-sm text-muted-foreground/50"
          >
            Free forever. No credit card. No strings.
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
}
