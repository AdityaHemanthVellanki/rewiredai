"use client";

import { useEffect, useRef } from "react";

/**
 * BackgroundSync — invisible component that silently syncs all user data
 * on every page load. Placed in the app layout so it runs everywhere.
 *
 * Syncs: Canvas courses/assignments/grades → Gmail emails → Agent processing
 * Uses sessionStorage to throttle (max once per 5 minutes per sync type).
 */

const THROTTLE_MS = 5 * 60 * 1000; // 5 minutes

function shouldSync(key: string): boolean {
  if (typeof window === "undefined") return false;
  const last = sessionStorage.getItem(`rewired_sync_${key}`);
  if (!last) return true;
  return Date.now() - parseInt(last, 10) > THROTTLE_MS;
}

function markSynced(key: string) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(`rewired_sync_${key}`, String(Date.now()));
}

export function BackgroundSync() {
  const hasRun = useRef(false);

  useEffect(() => {
    // Prevent double-run in strict mode
    if (hasRun.current) return;
    hasRun.current = true;

    async function runSyncs() {
      // 1. Canvas sync (silent, fire-and-forget)
      if (shouldSync("canvas")) {
        try {
          const res = await fetch("/api/canvas/sync", { method: "POST" });
          if (res.ok) markSynced("canvas");
        } catch {
          // silent failure
        }
      }

      // 2. Email sync (silent, fire-and-forget)
      if (shouldSync("emails")) {
        try {
          const res = await fetch("/api/google/emails", { method: "POST" });
          if (res.ok) markSynced("emails");
        } catch {
          // silent failure
        }
      }

      // 3. Agent background processing (silent, fire-and-forget)
      if (shouldSync("agent")) {
        try {
          const res = await fetch("/api/agent/process", { method: "POST" });
          if (res.ok) markSynced("agent");
        } catch {
          // silent failure
        }
      }
    }

    // Small delay so it doesn't block initial page render
    const timer = setTimeout(runSyncs, 1500);
    return () => clearTimeout(timer);
  }, []);

  // Renders nothing — completely invisible
  return null;
}
