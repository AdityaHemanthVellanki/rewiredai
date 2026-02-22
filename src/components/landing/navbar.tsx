"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className={`fixed top-0 z-50 w-full transition-all duration-500 ${
        scrolled
          ? "border-b border-white/10 bg-background/60 backdrop-blur-2xl shadow-lg shadow-purple-500/5"
          : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="group flex items-center gap-2">
          <motion.div
            whileHover={{ rotate: 180 }}
            transition={{ duration: 0.3 }}
          >
            <Zap className="h-6 w-6 text-purple-500 transition-all group-hover:text-purple-400 group-hover:drop-shadow-[0_0_8px_rgba(168,85,247,0.5)]" />
          </motion.div>
          <span className="text-xl font-bold">Rewired</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/login">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground"
            >
              Log in
            </Button>
          </Link>
          <Link href="/login">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                size="sm"
                className="relative bg-purple-600 hover:bg-purple-500 shadow-lg shadow-purple-500/25 transition-shadow hover:shadow-purple-500/40"
              >
                Get Started
              </Button>
            </motion.div>
          </Link>
        </div>
      </div>
    </motion.nav>
  );
}
