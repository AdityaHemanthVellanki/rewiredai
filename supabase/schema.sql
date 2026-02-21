-- ============================================
-- Rewired — Database Schema
-- Run this in Supabase SQL Editor
-- ============================================
--
-- IMPORTANT: Also create a Storage bucket for avatars:
--   1. Go to Supabase Dashboard → Storage
--   2. Create a new bucket called "avatars"
--   3. Set it to Public
--   4. Add a policy: allow authenticated users to upload/update/delete
--      their own files (path starts with their user ID)
-- ============================================

-- Profiles (extends Supabase auth.users)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  avatar_url text,
  timezone text default 'America/New_York',
  semester_goals text[] default '{}',
  personal_why text,
  personal_fears text,
  mantras text[] default '{}',
  productivity_peak_hours text[] default '{}',
  sleep_window jsonb default '{"sleep": "23:00", "wake": "08:00"}',
  escalation_mode text check (escalation_mode in ('gentle', 'standard', 'aggressive')) default 'standard',
  gpa_target numeric,
  streak_count int default 0,
  onboarding_completed boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, email, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.email,
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Google connected accounts (tokens from Supabase Google OAuth)
create table if not exists google_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null unique,
  google_email text not null,
  access_token text not null,
  refresh_token text not null,
  token_expires_at timestamptz not null,
  scopes text[] not null,
  created_at timestamptz default now()
);

-- Canvas LMS connections (OAuth tokens from Canvas)
create table if not exists canvas_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null unique,
  canvas_base_url text not null,
  access_token text not null,
  refresh_token text,
  token_expires_at timestamptz,
  student_name text,
  last_synced_at timestamptz,
  created_at timestamptz default now()
);

-- Courses
create table if not exists courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  name text not null,
  code text,
  professor text,
  schedule text,
  syllabus_url text,
  color text default '#6366f1',
  grading_rubric jsonb default '[]',
  created_at timestamptz default now()
);

-- Assignments / Deadlines
create table if not exists assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  course_id uuid references courses(id) on delete cascade,
  title text not null,
  description text,
  due_date timestamptz not null,
  priority text check (priority in ('low', 'medium', 'high', 'critical')) default 'medium',
  status text check (status in ('pending', 'in_progress', 'completed', 'overdue')) default 'pending',
  weight numeric,
  estimated_hours numeric,
  source text check (source in ('syllabus', 'email', 'manual', 'calendar', 'lms')) default 'manual',
  reminder_stage int default 0,
  ignored_count int default 0,
  confidence_score numeric,
  created_at timestamptz default now()
);

-- Grades
create table if not exists grades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  course_id uuid references courses(id) on delete cascade not null,
  assignment_id uuid references assignments(id) on delete set null,
  title text not null,
  score numeric,
  max_score numeric,
  weight numeric,
  agent_feedback text,
  created_at timestamptz default now()
);

-- Study Blocks
create table if not exists study_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  course_id uuid references courses(id) on delete set null,
  assignment_id uuid references assignments(id) on delete set null,
  title text not null,
  start_time timestamptz not null,
  end_time timestamptz not null,
  google_event_id text,
  status text check (status in ('scheduled', 'completed', 'skipped')) default 'scheduled',
  created_at timestamptz default now()
);

-- Chat Messages
create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  role text check (role in ('user', 'assistant')) not null,
  content text not null,
  metadata jsonb,
  created_at timestamptz default now()
);

-- Agent Memory
create table if not exists agent_memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  key text not null,
  value jsonb not null,
  category text check (category in ('habit', 'preference', 'pattern', 'escalation', 'mood')) not null,
  updated_at timestamptz default now(),
  unique(user_id, key)
);

-- Nudges
create table if not exists nudges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  assignment_id uuid references assignments(id) on delete set null,
  message text not null,
  severity text check (severity in ('gentle', 'firm', 'urgent', 'nuclear')) default 'gentle',
  status text check (status in ('pending', 'sent', 'seen', 'dismissed', 'acted_on')) default 'pending',
  escalation_count int default 0,
  created_at timestamptz default now(),
  sent_at timestamptz
);

-- Mood Entries
create table if not exists mood_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  mood_score int check (mood_score between 1 and 5) not null,
  free_text text,
  agent_response text,
  triggered_support_mode boolean default false,
  created_at timestamptz default now()
);

-- Email Summaries
create table if not exists email_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  gmail_message_id text not null,
  sender text not null,
  subject text not null,
  summary text not null,
  category text check (category in ('professor', 'financial_aid', 'campus_admin', 'clubs', 'spam', 'personal')) default 'personal',
  priority_score int check (priority_score between 1 and 10) default 5,
  action_required boolean default false,
  suggested_action text,
  action_due_date timestamptz,
  is_handled boolean default false,
  received_at timestamptz not null,
  created_at timestamptz default now(),
  unique(user_id, gmail_message_id)
);

-- Agent Activity Log
create table if not exists agent_activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  action text not null,
  description text not null,
  metadata jsonb,
  created_at timestamptz default now()
);

-- ============================================
-- Row Level Security
-- ============================================

alter table profiles enable row level security;
alter table google_accounts enable row level security;
alter table canvas_connections enable row level security;
alter table courses enable row level security;
alter table assignments enable row level security;
alter table grades enable row level security;
alter table study_blocks enable row level security;
alter table chat_messages enable row level security;
alter table agent_memory enable row level security;
alter table nudges enable row level security;
alter table mood_entries enable row level security;
alter table email_summaries enable row level security;
alter table agent_activity_log enable row level security;

-- Profiles: users can read/update their own profile
create policy "Users can view own profile" on profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);

-- Google accounts: users manage their own
create policy "Users can manage own google accounts" on google_accounts for all using (auth.uid() = user_id);

-- Canvas connections
create policy "Users can manage own canvas connections" on canvas_connections for all using (auth.uid() = user_id);

-- Courses
create policy "Users can manage own courses" on courses for all using (auth.uid() = user_id);

-- Assignments
create policy "Users can manage own assignments" on assignments for all using (auth.uid() = user_id);

-- Grades
create policy "Users can manage own grades" on grades for all using (auth.uid() = user_id);

-- Study Blocks
create policy "Users can manage own study blocks" on study_blocks for all using (auth.uid() = user_id);

-- Chat Messages
create policy "Users can manage own chat messages" on chat_messages for all using (auth.uid() = user_id);

-- Agent Memory
create policy "Users can manage own agent memory" on agent_memory for all using (auth.uid() = user_id);

-- Nudges
create policy "Users can manage own nudges" on nudges for all using (auth.uid() = user_id);

-- Mood Entries
create policy "Users can manage own mood entries" on mood_entries for all using (auth.uid() = user_id);

-- Email Summaries
create policy "Users can manage own email summaries" on email_summaries for all using (auth.uid() = user_id);

-- Agent Activity Log
create policy "Users can view own agent activity" on agent_activity_log for all using (auth.uid() = user_id);

-- ============================================
-- Indexes for performance
-- ============================================

create index if not exists idx_assignments_user_due on assignments(user_id, due_date);
create index if not exists idx_assignments_status on assignments(user_id, status);
create index if not exists idx_grades_course on grades(user_id, course_id);
create index if not exists idx_study_blocks_user_time on study_blocks(user_id, start_time);
create index if not exists idx_chat_messages_user on chat_messages(user_id, created_at);
create index if not exists idx_nudges_user_status on nudges(user_id, status);
create index if not exists idx_email_summaries_user on email_summaries(user_id, created_at);
create index if not exists idx_mood_entries_user on mood_entries(user_id, created_at);
