"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  MessageSquare,
  BookOpen,
  Calendar,
  Settings,
  Zap,
  Menu,
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "motion/react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/chat", label: "Chat with Rewired", icon: MessageSquare },
  { href: "/courses", label: "Courses", icon: BookOpen },
  { href: "/schedule", label: "Schedule", icon: Calendar },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="flex h-16 items-center justify-between border-b border-border/50 bg-card/50 px-4 backdrop-blur-xl md:hidden">
      <div className="flex items-center gap-2">
        <div className="animate-glow-pulse rounded-lg p-0.5">
          <Zap className="h-6 w-6 text-purple-500" />
        </div>
        <span className="text-lg font-bold">Rewired</span>
      </div>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="active-press">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-4">
          <div className="mb-6 flex items-center gap-2">
            <div className="animate-glow-pulse rounded-lg p-0.5">
              <Zap className="h-6 w-6 text-purple-500" />
            </div>
            <span className="text-lg font-bold">Rewired</span>
          </div>
          <nav className="space-y-1">
            <AnimatePresence>
              {open &&
                navItems.map((item, index) => {
                  const isActive = pathname === item.href;
                  return (
                    <motion.div
                      key={item.href}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{
                        type: "spring",
                        stiffness: 400,
                        damping: 30,
                        delay: index * 0.05,
                      }}
                    >
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                          isActive
                            ? "bg-purple-500/10 text-purple-400"
                            : "text-muted-foreground hover:bg-accent hover:text-foreground"
                        )}
                      >
                        <item.icon
                          className={cn(
                            "h-5 w-5 transition-transform duration-200 group-hover:scale-110",
                            !isActive && "group-hover:rotate-[-3deg]"
                          )}
                        />
                        {item.label}
                      </Link>
                    </motion.div>
                  );
                })}
            </AnimatePresence>
          </nav>
        </SheetContent>
      </Sheet>
    </div>
  );
}
