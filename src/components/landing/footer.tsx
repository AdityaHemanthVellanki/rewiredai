"use client";

import { motion } from "motion/react";
import { Zap } from "lucide-react";

export function Footer() {
  return (
    <footer className="relative border-t border-white/[0.06] py-12">
      {/* Gradient line at top */}
      <div className="absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-transparent via-purple-500/50 to-transparent" />

      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 sm:flex-row">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="flex items-center gap-2 text-sm text-muted-foreground"
        >
          <Zap className="h-4 w-4 text-purple-500" />
          <span className="font-medium text-foreground">Rewired</span>
          <span className="text-muted-foreground/50">&middot;</span>
          <span>&copy; 2025</span>
        </motion.div>
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-sm text-muted-foreground/50"
        >
          The AI doesn&apos;t judge you. It just helps you get there.
        </motion.p>
      </div>
    </footer>
  );
}
