import { differenceInHours } from "date-fns";
import type { Assignment, NudgeSeverity } from "@/types";

/**
 * 5-stage escalation logic from the spec:
 * Stage 1 — 7 days out: Gentle awareness
 * Stage 2 — 3 days out: Planning nudge
 * Stage 3 — 24 hours out: Active alert
 * Stage 4 — 6 hours out: Urgent escalation
 * Stage 5 — Ignored: Nuclear (auto-block calendar)
 */

export interface EscalationResult {
  stage: number;
  severity: NudgeSeverity;
  message: string;
  shouldBlockCalendar: boolean;
}

export function calculateEscalation(
  assignment: Assignment,
  studentName: string
): EscalationResult | null {
  if (assignment.status === "completed") return null;

  const now = new Date();
  const dueDate = new Date(assignment.due_date);
  const hoursRemaining = differenceInHours(dueDate, now);

  // Already overdue
  if (hoursRemaining < 0) {
    return {
      stage: 5,
      severity: "nuclear",
      message: `${assignment.title} is OVERDUE. It was due ${Math.abs(Math.round(hoursRemaining / 24))} day(s) ago. Can you still submit it late? Talk to your professor ASAP.`,
      shouldBlockCalendar: false,
    };
  }

  // Check if student has been ignoring nudges
  if (assignment.ignored_count >= 3) {
    return {
      stage: 5,
      severity: "nuclear",
      message: `${studentName}, you've ignored this 3 times. I'm locking in study time for you. ${assignment.title} is due in ${Math.round(hoursRemaining)} hours and you haven't started.`,
      shouldBlockCalendar: true,
    };
  }

  // Stage 4 — 6 hours out
  if (hoursRemaining <= 6) {
    return {
      stage: 4,
      severity: "urgent",
      message: `URGENT: ${assignment.title} is due in ${Math.round(hoursRemaining)} hours. This is not a drill. Drop everything and focus on this NOW.`,
      shouldBlockCalendar: false,
    };
  }

  // Stage 3 — 24 hours out
  if (hoursRemaining <= 24) {
    return {
      stage: 3,
      severity: "urgent",
      message: `Tomorrow: ${assignment.title}. Here's what you still need to do. Want me to block off time right now?`,
      shouldBlockCalendar: false,
    };
  }

  // Stage 2 — 3 days out
  if (hoursRemaining <= 72) {
    return {
      stage: 2,
      severity: "firm",
      message: `You have ${assignment.title} due in ${Math.round(hoursRemaining / 24)} days. Want me to block some study time on your calendar?`,
      shouldBlockCalendar: false,
    };
  }

  // Stage 1 — 7 days out
  if (hoursRemaining <= 168) {
    return {
      stage: 1,
      severity: "gentle",
      message: `Hey, your ${assignment.title} is in ${Math.round(hoursRemaining / 24)} days. You might want to start thinking about it.`,
      shouldBlockCalendar: false,
    };
  }

  return null; // No escalation needed yet
}

export function getEscalationColor(severity: NudgeSeverity): string {
  switch (severity) {
    case "gentle":
      return "text-blue-400";
    case "firm":
      return "text-yellow-400";
    case "urgent":
      return "text-orange-400";
    case "nuclear":
      return "text-red-400";
  }
}

export function getEscalationBgColor(severity: NudgeSeverity): string {
  switch (severity) {
    case "gentle":
      return "bg-blue-500/10 border-blue-500/20";
    case "firm":
      return "bg-yellow-500/10 border-yellow-500/20";
    case "urgent":
      return "bg-orange-500/10 border-orange-500/20";
    case "nuclear":
      return "bg-red-500/10 border-red-500/20";
  }
}
