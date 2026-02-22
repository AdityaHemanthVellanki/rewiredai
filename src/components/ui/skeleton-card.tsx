"use client";

import { cn } from "@/lib/utils";

interface SkeletonCardProps {
  variant?: "stat" | "chart" | "list" | "card";
  className?: string;
}

export function SkeletonCard({ variant = "card", className }: SkeletonCardProps) {
  if (variant === "stat") {
    return (
      <div className={cn("rounded-xl border border-border/30 p-4", className)}>
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg animate-skeleton bg-white/5" />
          <div className="space-y-2">
            <div className="h-5 w-12 rounded animate-skeleton bg-white/5" />
            <div className="h-3 w-16 rounded animate-skeleton bg-white/5" />
          </div>
        </div>
      </div>
    );
  }

  if (variant === "chart") {
    return (
      <div className={cn("rounded-xl border border-border/30 p-6", className)}>
        <div className="mb-4 flex items-center gap-2">
          <div className="h-6 w-6 rounded-md animate-skeleton bg-white/5" />
          <div className="h-4 w-32 rounded animate-skeleton bg-white/5" />
        </div>
        <div className="flex items-end gap-2 h-[160px]">
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className="flex-1 rounded-t animate-skeleton bg-white/5"
              style={{ height: `${30 + Math.random() * 60}%` }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (variant === "list") {
    return (
      <div className={cn("rounded-xl border border-border/30 p-6", className)}>
        <div className="mb-4 flex items-center gap-2">
          <div className="h-6 w-6 rounded-md animate-skeleton bg-white/5" />
          <div className="h-4 w-32 rounded animate-skeleton bg-white/5" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-7 w-7 rounded-full animate-skeleton bg-white/5" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-3/4 rounded animate-skeleton bg-white/5" />
                <div className="h-2.5 w-1/2 rounded animate-skeleton bg-white/5" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Default card
  return (
    <div className={cn("rounded-xl border border-border/30 p-6", className)}>
      <div className="mb-4 flex items-center gap-2">
        <div className="h-6 w-6 rounded-md animate-skeleton bg-white/5" />
        <div className="h-4 w-40 rounded animate-skeleton bg-white/5" />
      </div>
      <div className="space-y-3">
        <div className="h-3 w-full rounded animate-skeleton bg-white/5" />
        <div className="h-3 w-5/6 rounded animate-skeleton bg-white/5" />
        <div className="h-3 w-3/4 rounded animate-skeleton bg-white/5" />
      </div>
    </div>
  );
}

export function SkeletonDashboard() {
  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="h-7 w-32 rounded animate-skeleton bg-white/5" />
          <div className="h-4 w-48 rounded animate-skeleton bg-white/5" />
        </div>
        <div className="flex gap-2">
          <div className="h-8 w-16 rounded-full animate-skeleton bg-white/5" />
          <div className="h-8 w-16 rounded-full animate-skeleton bg-white/5" />
        </div>
      </div>
      {/* Hero */}
      <div className="grid gap-4 lg:grid-cols-3">
        <SkeletonCard className="lg:col-span-2" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
          <SkeletonCard variant="stat" />
          <SkeletonCard variant="stat" />
        </div>
      </div>
      {/* Main grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        <SkeletonCard variant="chart" />
        <SkeletonCard variant="chart" />
      </div>
      <SkeletonCard variant="list" />
    </div>
  );
}
