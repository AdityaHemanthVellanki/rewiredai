// ============================================
// Rewired — Core Type Definitions
// ============================================

// --- User Profile ---
export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  timezone: string;
  semester_goals: string[];
  personal_why: string | null;
  personal_fears: string | null;
  mantras: string[];
  productivity_peak_hours: string[];
  sleep_window: { sleep: string; wake: string };
  escalation_mode: "gentle" | "standard" | "aggressive";
  gpa_target: number | null;
  streak_count: number;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

// --- Google Connected Account ---
export interface GoogleAccount {
  id: string;
  user_id: string;
  google_email: string;
  access_token: string;
  refresh_token: string;
  token_expires_at: string;
  scopes: string[];
  created_at: string;
}

// --- Course ---
export interface Course {
  id: string;
  user_id: string;
  name: string;
  code: string | null;
  professor: string | null;
  schedule: string | null;
  syllabus_url: string | null;
  color: string;
  grading_rubric: GradingWeight[];
  created_at: string;
}

export interface GradingWeight {
  category: string;
  weight: number;
}

// --- Assignment / Deadline ---
export type AssignmentPriority = "low" | "medium" | "high" | "critical";
export type AssignmentStatus = "pending" | "in_progress" | "completed" | "overdue";
export type AssignmentSource = "syllabus" | "email" | "manual" | "calendar" | "lms";

export interface Assignment {
  id: string;
  user_id: string;
  course_id: string | null;
  title: string;
  description: string | null;
  due_date: string;
  priority: AssignmentPriority;
  status: AssignmentStatus;
  weight: number | null;
  estimated_hours: number | null;
  source: AssignmentSource;
  reminder_stage: number;
  ignored_count: number;
  confidence_score: number | null;
  created_at: string;
  // joined
  course?: Course;
}

// --- Grade ---
export interface Grade {
  id: string;
  user_id: string;
  course_id: string;
  assignment_id: string | null;
  title: string;
  score: number | null;
  max_score: number | null;
  weight: number | null;
  agent_feedback: string | null;
  created_at: string;
  // joined
  course?: Course;
}

// --- Study Block ---
export type StudyBlockStatus = "scheduled" | "completed" | "skipped";

export interface StudyBlock {
  id: string;
  user_id: string;
  course_id: string | null;
  assignment_id: string | null;
  title: string;
  start_time: string;
  end_time: string;
  google_event_id: string | null;
  status: StudyBlockStatus;
  created_at: string;
  // joined
  course?: Course;
  assignment?: Assignment;
}

// --- Chat Message ---
export interface ChatMessage {
  id: string;
  user_id: string;
  role: "user" | "assistant";
  content: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// --- Agent Memory ---
export type MemoryCategory = "habit" | "preference" | "pattern" | "escalation" | "mood";

export interface AgentMemory {
  id: string;
  user_id: string;
  key: string;
  value: Record<string, unknown>;
  category: MemoryCategory;
  updated_at: string;
}

// --- Nudge ---
export type NudgeSeverity = "gentle" | "firm" | "urgent" | "nuclear";
export type NudgeStatus = "pending" | "sent" | "seen" | "dismissed" | "acted_on";

export interface Nudge {
  id: string;
  user_id: string;
  assignment_id: string | null;
  message: string;
  severity: NudgeSeverity;
  status: NudgeStatus;
  escalation_count: number;
  created_at: string;
  sent_at: string | null;
  // joined
  assignment?: Assignment;
}

// --- Mood Entry ---
export interface MoodEntry {
  id: string;
  user_id: string;
  mood_score: number; // 1-5
  free_text: string | null;
  agent_response: string | null;
  triggered_support_mode: boolean;
  created_at: string;
}

// --- Email Summary ---
export type EmailCategory =
  | "professor"
  | "financial_aid"
  | "campus_admin"
  | "clubs"
  | "spam"
  | "personal";

export interface EmailSummary {
  id: string;
  user_id: string;
  gmail_message_id: string;
  from: string;
  subject: string;
  summary: string;
  category: EmailCategory;
  priority_score: number; // 1-10
  action_required: boolean;
  suggested_action: string | null;
  action_due_date: string | null;
  is_handled: boolean;
  received_at: string;
  created_at: string;
}

// --- Agent Activity Log ---
export interface AgentActivity {
  id: string;
  user_id: string;
  action: string;
  description: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}
