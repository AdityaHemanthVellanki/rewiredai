"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send,
  Sparkles,
  Loader2,
  BookOpen,
  Calendar,
  ExternalLink,
  ArrowDown,
  GraduationCap,
  Mail,
  BarChart3,
  Clock,
  Search,
  Brain,
  Zap,
  CheckCircle2,
  Target,
  TrendingUp,
  CalendarDays,
  BookMarked,
  Bot,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// ─── Types ───────────────────────────────────────────────────────────────────

interface EventCard {
  type: "study_block_created" | "calendar_event_created";
  title: string;
  start: string;
  end: string;
  id: string;
}

interface ToolStatus {
  name: string;
  status: "running" | "done";
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  eventCards?: EventCard[];
  toolStatuses?: ToolStatus[];
  isAutoBrief?: boolean;
}

// ─── Tool display config ─────────────────────────────────────────────────────

const TOOL_DISPLAY: Record<string, { label: string; icon: React.ReactNode }> = {
  // Data fetching
  get_deadlines: { label: "Checking deadlines", icon: <CalendarDays className="h-3 w-3" /> },
  get_grades: { label: "Pulling grades", icon: <GraduationCap className="h-3 w-3" /> },
  get_calendar_events: { label: "Reading calendar", icon: <CalendarDays className="h-3 w-3" /> },
  get_email_summaries: { label: "Scanning emails", icon: <Mail className="h-3 w-3" /> },
  get_study_stats: { label: "Checking study stats", icon: <BarChart3 className="h-3 w-3" /> },
  get_course_summary: { label: "Loading course details", icon: <BookOpen className="h-3 w-3" /> },
  get_all_courses: { label: "Loading all courses", icon: <BookOpen className="h-3 w-3" /> },
  get_profile: { label: "Reading profile", icon: <Bot className="h-3 w-3" /> },
  get_agent_memory: { label: "Recalling context", icon: <Brain className="h-3 w-3" /> },
  // Study blocks
  create_study_block: { label: "Creating study block", icon: <Clock className="h-3 w-3" /> },
  update_study_block: { label: "Updating study block", icon: <Clock className="h-3 w-3" /> },
  delete_study_block: { label: "Removing study block", icon: <Clock className="h-3 w-3" /> },
  // Calendar
  create_google_calendar_event: { label: "Adding calendar event", icon: <Calendar className="h-3 w-3" /> },
  update_google_calendar_event: { label: "Updating calendar event", icon: <Calendar className="h-3 w-3" /> },
  delete_google_calendar_event: { label: "Removing calendar event", icon: <Calendar className="h-3 w-3" /> },
  // Sync
  sync_canvas: { label: "Syncing Canvas", icon: <Zap className="h-3 w-3" /> },
  sync_emails: { label: "Syncing emails", icon: <Mail className="h-3 w-3" /> },
  // Intelligence
  predict_semester_gpa: { label: "Projecting semester GPA", icon: <TrendingUp className="h-3 w-3" /> },
  detect_grade_cliffs: { label: "Detecting grade cliffs", icon: <Target className="h-3 w-3" /> },
  get_study_effectiveness: { label: "Analyzing study patterns", icon: <BarChart3 className="h-3 w-3" /> },
  generate_weekly_strategy: { label: "Building weekly plan", icon: <Brain className="h-3 w-3" /> },
  generate_daily_plan: { label: "Creating today's plan", icon: <Brain className="h-3 w-3" /> },
  run_what_if: { label: "Running simulation", icon: <Search className="h-3 w-3" /> },
  analyze_course_grade: { label: "Analyzing course grade", icon: <GraduationCap className="h-3 w-3" /> },
  calculate_grade_needed: { label: "Calculating target grade", icon: <Target className="h-3 w-3" /> },
  // Actions
  auto_schedule_study: { label: "Auto-scheduling study time", icon: <Sparkles className="h-3 w-3" /> },
  update_assignment_status: { label: "Updating assignment", icon: <BookMarked className="h-3 w-3" /> },
  create_nudge: { label: "Creating reminder", icon: <Zap className="h-3 w-3" /> },
  save_agent_memory: { label: "Saving context", icon: <Brain className="h-3 w-3" /> },
  mark_email_handled: { label: "Marking email handled", icon: <CheckCircle2 className="h-3 w-3" /> },
  update_profile: { label: "Updating profile", icon: <Bot className="h-3 w-3" /> },
  log_mood: { label: "Logging mood", icon: <Sparkles className="h-3 w-3" /> },
  parse_syllabus: { label: "Parsing syllabus", icon: <BookOpen className="h-3 w-3" /> },
};

function getToolDisplay(name: string) {
  return TOOL_DISPLAY[name] || { label: name.replace(/_/g, " "), icon: <Zap className="h-3 w-3" /> };
}

// ─── Quick Actions ───────────────────────────────────────────────────────────

const quickActions = [
  { label: "What's due this week?", icon: <CalendarDays className="h-3.5 w-3.5" /> },
  { label: "Auto-schedule study time", icon: <Clock className="h-3.5 w-3.5" /> },
  { label: "Check my grades", icon: <GraduationCap className="h-3.5 w-3.5" /> },
  { label: "What should I focus on?", icon: <Target className="h-3.5 w-3.5" /> },
  { label: "Check my emails", icon: <Mail className="h-3.5 w-3.5" /> },
  { label: "I'm stressed, help me plan", icon: <Brain className="h-3.5 w-3.5" /> },
  { label: "What grade do I need?", icon: <TrendingUp className="h-3.5 w-3.5" /> },
  { label: "Sync my Canvas", icon: <Zap className="h-3.5 w-3.5" /> },
];

// ─── Event Card Component ────────────────────────────────────────────────────

function EventCardComponent({ card }: { card: EventCard }) {
  const isStudyBlock = card.type === "study_block_created";

  const startDate = new Date(card.start);
  const endDate = new Date(card.end);
  const timeRange = `${startDate.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} – ${endDate.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  const dateLabel = startDate.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });

  return (
    <div className="animate-message-in mt-2">
      <div
        className={cn(
          "group relative overflow-hidden rounded-xl border p-3.5 transition-all duration-200 hover:scale-[1.01]",
          isStudyBlock
            ? "border-purple-500/20 bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-transparent"
            : "border-blue-500/20 bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent"
        )}
      >
        {/* Shimmer effect on hover */}
        <div className={cn(
          "pointer-events-none absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100",
          isStudyBlock
            ? "bg-gradient-to-r from-transparent via-purple-500/5 to-transparent animate-shimmer"
            : "bg-gradient-to-r from-transparent via-blue-500/5 to-transparent animate-shimmer"
        )} />

        <div className="relative flex items-start gap-3">
          <div className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
            isStudyBlock ? "bg-purple-500/15" : "bg-blue-500/15"
          )}>
            {isStudyBlock ? (
              <BookOpen className="h-4 w-4 text-purple-400" />
            ) : (
              <Calendar className="h-4 w-4 text-blue-400" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className={cn(
              "truncate text-sm font-semibold",
              isStudyBlock ? "text-purple-200" : "text-blue-200"
            )}>
              {card.title}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {dateLabel} &middot; {timeRange}
            </p>
          </div>
          <a
            href="/schedule"
            className={cn(
              "flex shrink-0 items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-all",
              isStudyBlock
                ? "bg-purple-500/10 text-purple-400 hover:bg-purple-500/20"
                : "bg-blue-500/10 text-blue-400 hover:bg-blue-500/20"
            )}
          >
            View <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </div>
  );
}

// ─── Tool Status Indicator ───────────────────────────────────────────────────

function ToolStatusIndicator({ statuses }: { statuses: ToolStatus[] }) {
  // Show only the latest running tool (or the last completed one)
  const running = statuses.filter((s) => s.status === "running");
  const display = running.length > 0 ? running[running.length - 1] : null;

  if (!display) return null;

  const tool = getToolDisplay(display.name);

  return (
    <div className="animate-fade-in flex items-center gap-2 py-1.5">
      <div className="flex h-5 w-5 items-center justify-center rounded-md bg-purple-500/15 text-purple-400 animate-tool-pulse">
        {tool.icon}
      </div>
      <span className="text-xs text-muted-foreground">{tool.label}...</span>
      <div className="flex gap-0.5">
        <div className="h-1 w-1 rounded-full bg-purple-400/60 animate-typing-dot-1" />
        <div className="h-1 w-1 rounded-full bg-purple-400/60 animate-typing-dot-2" />
        <div className="h-1 w-1 rounded-full bg-purple-400/60 animate-typing-dot-3" />
      </div>
    </div>
  );
}

// ─── Typing Indicator ────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="animate-message-left flex items-start gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500/20 to-indigo-500/20">
        <Bot className="h-4 w-4 text-purple-400" />
      </div>
      <div className="rounded-2xl rounded-tl-md border border-border/30 bg-card/80 px-4 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-purple-400/70 animate-typing-dot-1" />
          <div className="h-2 w-2 rounded-full bg-purple-400/70 animate-typing-dot-2" />
          <div className="h-2 w-2 rounded-full bg-purple-400/70 animate-typing-dot-3" />
        </div>
      </div>
    </div>
  );
}

// ─── Markdown Renderer ───────────────────────────────────────────────────────

function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
        strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
        em: ({ children }) => <em className="text-muted-foreground">{children}</em>,
        ul: ({ children }) => <ul className="mb-2 list-disc space-y-0.5 pl-4 last:mb-0">{children}</ul>,
        ol: ({ children }) => <ol className="mb-2 list-decimal space-y-0.5 pl-4 last:mb-0">{children}</ol>,
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        h1: ({ children }) => <h1 className="mb-2 mt-3 text-base font-bold first:mt-0">{children}</h1>,
        h2: ({ children }) => <h2 className="mb-1.5 mt-2.5 text-sm font-bold first:mt-0">{children}</h2>,
        h3: ({ children }) => <h3 className="mb-1 mt-2 text-sm font-semibold first:mt-0">{children}</h3>,
        code: ({ className, children }) => {
          const isInline = !className;
          if (isInline) {
            return (
              <code className="rounded-md bg-white/10 px-1.5 py-0.5 text-[13px] text-purple-300">
                {children}
              </code>
            );
          }
          return (
            <code className="block overflow-x-auto rounded-lg bg-black/30 p-3 text-[13px]">
              {children}
            </code>
          );
        },
        pre: ({ children }) => <pre className="mb-2 last:mb-0">{children}</pre>,
        hr: () => <hr className="my-3 border-border/30" />,
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-purple-400 underline decoration-purple-400/30 underline-offset-2 transition-colors hover:text-purple-300 hover:decoration-purple-300/50">
            {children}
          </a>
        ),
        blockquote: ({ children }) => (
          <blockquote className="mb-2 border-l-2 border-purple-500/30 pl-3 text-muted-foreground last:mb-0">
            {children}
          </blockquote>
        ),
        table: ({ children }) => (
          <div className="mb-2 overflow-x-auto rounded-lg border border-border/30 last:mb-0">
            <table className="min-w-full text-xs">{children}</table>
          </div>
        ),
        th: ({ children }) => (
          <th className="border-b border-border/30 bg-white/5 px-3 py-1.5 text-left font-semibold">{children}</th>
        ),
        td: ({ children }) => (
          <td className="border-b border-border/10 px-3 py-1.5">{children}</td>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

// ─── Main Chat Page ──────────────────────────────────────────────────────────

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const autoBriefSent = useRef(false);

  // Auto-resize textarea
  const adjustTextarea = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
  }, []);

  // Scroll to bottom
  const scrollToBottom = useCallback((smooth = true) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "instant" });
  }, []);

  // Track scroll position for show/hide scroll button
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const onScroll = () => {
      const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
      setShowScrollBtn(!isNearBottom);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // Auto-scroll on new messages
  useEffect(() => {
    scrollToBottom(true);
  }, [messages, scrollToBottom]);

  // Load chat history, then auto-brief if empty
  useEffect(() => {
    async function loadHistory() {
      try {
        const res = await fetch("/api/agent/chat?history=true");
        if (res.ok) {
          const data = await res.json();
          const history = data.messages || [];
          setMessages(history);
          setIsInitialized(true);

          if (history.length === 0) {
            autoBriefSent.current = true;
            setTimeout(() => {
              sendMessage(
                "Give me a full status briefing. Check my grades, upcoming deadlines, study progress, any emails I should know about, and tell me what I should focus on right now. Be thorough."
              );
            }, 600);
          }
          return;
        }
      } catch {
        // ignore
      }
      setIsInitialized(true);
    }
    loadHistory();
  }, []);

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    const isAutoBriefMsg = autoBriefSent.current && messages.length === 0;
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: content.trim(),
      created_at: new Date().toISOString(),
      isAutoBrief: isAutoBriefMsg,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    try {
      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content.trim() }),
      });

      if (!res.ok) throw new Error("Failed to send message");

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "",
        created_at: new Date().toISOString(),
        toolStatuses: [],
      };

      setMessages((prev) => [...prev, assistantMessage]);

      if (reader) {
        let done = false;
        while (!done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;
          if (value) {
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split("\n");
            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const data = line.slice(6);
                if (data === "[DONE]") continue;
                try {
                  const parsed = JSON.parse(data);
                  if (parsed.content) {
                    assistantMessage.content += parsed.content;
                    setMessages((prev) => [
                      ...prev.slice(0, -1),
                      { ...assistantMessage },
                    ]);
                  } else if (parsed.event_card) {
                    assistantMessage.eventCards = [
                      ...(assistantMessage.eventCards || []),
                      parsed.event_card,
                    ];
                    setMessages((prev) => [
                      ...prev.slice(0, -1),
                      { ...assistantMessage },
                    ]);
                  } else if (parsed.tool_status) {
                    assistantMessage.toolStatuses = [
                      ...(assistantMessage.toolStatuses || []),
                      parsed.tool_status,
                    ];
                    setMessages((prev) => [
                      ...prev.slice(0, -1),
                      { ...assistantMessage },
                    ]);
                  }
                } catch {
                  assistantMessage.content += data;
                  setMessages((prev) => [
                    ...prev.slice(0, -1),
                    { ...assistantMessage },
                  ]);
                }
              }
            }
          }
        }
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Sorry, something went wrong. Please try again.",
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col md:h-[calc(100vh-3rem)]">
      {/* Messages area */}
      <div
        ref={scrollContainerRef}
        className="relative flex-1 overflow-y-auto scroll-smooth"
      >
        {!isInitialized ? (
          <div className="flex h-full items-center justify-center">
            <div className="flex flex-col items-center gap-3 animate-fade-in">
              <div className="relative">
                <div className="absolute -inset-3 rounded-full bg-purple-500/20 blur-xl" />
                <Loader2 className="relative h-8 w-8 animate-spin text-purple-400" />
              </div>
              <p className="text-sm text-muted-foreground">Loading chat...</p>
            </div>
          </div>
        ) : messages.length === 0 ? (
          /* ─── Empty State ──────────────────────────────────────── */
          <div className="flex h-full flex-col items-center justify-center px-4 py-12">
            <div className="w-full max-w-lg animate-slide-up">
              {/* Hero */}
              <div className="relative mb-8 flex flex-col items-center">
                <div className="relative">
                  <div className="absolute -inset-6 rounded-full bg-gradient-to-br from-purple-500/20 via-indigo-500/10 to-blue-500/20 blur-2xl" />
                  <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500/20 to-indigo-500/20 ring-1 ring-purple-500/20">
                    {autoBriefSent.current ? (
                      <Loader2 className="h-9 w-9 animate-spin text-purple-400" />
                    ) : (
                      <Sparkles className="h-9 w-9 text-purple-400" />
                    )}
                  </div>
                </div>

                <div className="mt-5 text-center">
                  {autoBriefSent.current ? (
                    <>
                      <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-300 via-purple-200 to-indigo-300 bg-clip-text text-transparent">
                        Preparing your briefing
                      </h2>
                      <p className="mt-2 text-sm text-muted-foreground max-w-xs mx-auto">
                        Rewired is checking your grades, deadlines, emails, and study progress right now.
                      </p>
                      <div className="mt-4 flex items-center justify-center gap-1.5">
                        <div className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-typing-dot-1" />
                        <div className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-typing-dot-2" />
                        <div className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-typing-dot-3" />
                      </div>
                    </>
                  ) : (
                    <>
                      <h2 className="text-2xl font-bold">Hey, what&apos;s up?</h2>
                      <p className="mt-2 text-sm text-muted-foreground max-w-sm mx-auto">
                        I&apos;m Rewired, your AI academic assistant. Ask me anything about your courses, grades, schedule, or emails.
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* Quick actions grid */}
              {!autoBriefSent.current && (
                <div className="grid grid-cols-2 gap-2">
                  {quickActions.map((action, i) => (
                    <button
                      key={action.label}
                      onClick={() => sendMessage(action.label)}
                      className="group flex items-center gap-2.5 rounded-xl border border-border/30 bg-card/50 px-3.5 py-3 text-left text-sm transition-all duration-200 hover:border-purple-500/30 hover:bg-purple-500/5 hover:scale-[1.02] active:scale-[0.98]"
                      style={{ animationDelay: `${i * 50}ms` }}
                    >
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/5 text-muted-foreground transition-colors group-hover:bg-purple-500/10 group-hover:text-purple-400">
                        {action.icon}
                      </div>
                      <span className="text-xs font-medium text-muted-foreground transition-colors group-hover:text-foreground">
                        {action.label}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ─── Message List ─────────────────────────────────────── */
          <div className="mx-auto max-w-3xl space-y-1 px-4 py-4">
            {messages.map((msg, idx) => {
              const isUser = msg.role === "user";
              const isLast = idx === messages.length - 1;
              const isStreaming = isLast && msg.role === "assistant" && isLoading;

              // Hide the auto-brief user message (it's system-initiated)
              const isAutoBrief = msg.isAutoBrief || (isUser && msg.content?.startsWith("Give me a full status briefing"));
              if (isAutoBrief && isUser) return null;

              // Skip assistant messages with no real content (empty/whitespace-only)
              if (!isUser && !msg.content?.trim() && !isStreaming) return null;

              return (
                <div key={msg.id}>
                  <div
                    className={cn(
                      "flex gap-3 py-2",
                      isUser ? "justify-end" : "justify-start",
                      isUser ? "animate-message-right" : "animate-message-left"
                    )}
                  >
                    {/* Bot avatar */}
                    {!isUser && (
                      <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500/20 to-indigo-500/20 ring-1 ring-purple-500/10">
                        <Bot className="h-4 w-4 text-purple-400" />
                      </div>
                    )}

                    <div className={cn("min-w-0", isUser ? "max-w-[80%] flex flex-col items-end" : "max-w-[85%]")}>
                      {/* Tool statuses or thinking indicator (when no content yet) */}
                      {!isUser && !msg.content && isStreaming && (
                        msg.toolStatuses && msg.toolStatuses.some(s => s.status === "running") ? (
                          <ToolStatusIndicator statuses={msg.toolStatuses} />
                        ) : (
                          <div className="animate-fade-in flex items-center gap-2 py-1.5">
                            <div className="flex h-5 w-5 items-center justify-center rounded-md bg-purple-500/15 text-purple-400 animate-tool-pulse">
                              <Brain className="h-3 w-3" />
                            </div>
                            <span className="text-xs text-muted-foreground">Thinking...</span>
                            <div className="flex gap-0.5">
                              <div className="h-1 w-1 rounded-full bg-purple-400/60 animate-typing-dot-1" />
                              <div className="h-1 w-1 rounded-full bg-purple-400/60 animate-typing-dot-2" />
                              <div className="h-1 w-1 rounded-full bg-purple-400/60 animate-typing-dot-3" />
                            </div>
                          </div>
                        )
                      )}

                      {/* Message bubble */}
                      {msg.content && (
                        <div
                          className={cn(
                            "relative overflow-hidden transition-all",
                            isUser
                              ? "rounded-2xl rounded-tr-md bg-gradient-to-br from-purple-600 to-purple-700 px-4 py-2.5 text-white shadow-lg shadow-purple-500/10"
                              : "rounded-2xl rounded-tl-md border border-border/20 bg-card/80 px-4 py-3 shadow-sm backdrop-blur-sm"
                          )}
                        >
                          {isUser ? (
                            <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
                          ) : (
                            <div className="text-sm leading-relaxed">
                              <MarkdownContent content={msg.content} />
                              {isStreaming && (
                                <span className="inline-block h-4 w-0.5 animate-pulse bg-purple-400 ml-0.5 align-text-bottom" />
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Tool status while streaming (below message content) */}
                      {!isUser && msg.toolStatuses && msg.toolStatuses.length > 0 && msg.content && isStreaming && (
                        <ToolStatusIndicator statuses={msg.toolStatuses} />
                      )}

                      {/* Event cards */}
                      {msg.eventCards?.map((card, i) => (
                        <EventCardComponent key={i} card={card} />
                      ))}

                      {/* Timestamp */}
                      <p className={cn(
                        "mt-1 text-[10px] text-muted-foreground/50 transition-opacity",
                        isUser ? "text-right" : "text-left"
                      )}>
                        {formatTime(msg.created_at)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Typing indicator */}
            {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
              <TypingIndicator />
            )}

            <div ref={bottomRef} />
          </div>
        )}

        {/* Scroll to bottom button */}
        {showScrollBtn && messages.length > 0 && (
          <button
            onClick={() => scrollToBottom()}
            className="animate-fade-in absolute bottom-4 left-1/2 -translate-x-1/2 flex h-8 w-8 items-center justify-center rounded-full border border-border/30 bg-card/90 shadow-lg backdrop-blur-sm transition-all hover:bg-card hover:scale-110 active:scale-95"
          >
            <ArrowDown className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Quick actions pill bar (when chatting) */}
      {messages.length > 0 && !isLoading && (
        <div className="animate-fade-in border-t border-border/10 px-4 py-2">
          <div className="mx-auto flex max-w-3xl gap-1.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            {quickActions.slice(0, 5).map((action) => (
              <button
                key={action.label}
                onClick={() => sendMessage(action.label)}
                className="flex shrink-0 items-center gap-1.5 rounded-full border border-border/20 bg-card/50 px-3 py-1.5 text-[11px] font-medium text-muted-foreground transition-all duration-200 hover:border-purple-500/30 hover:bg-purple-500/5 hover:text-foreground active:scale-95"
              >
                {action.icon}
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="border-t border-border/20 bg-background/80 backdrop-blur-lg">
        <div className="mx-auto max-w-3xl p-3">
          <div className="flex items-end gap-2 rounded-2xl border border-border/30 bg-card/50 p-1.5 transition-all duration-200 focus-within:border-purple-500/30 focus-within:ring-1 focus-within:ring-purple-500/10 focus-within:shadow-lg focus-within:shadow-purple-500/5">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                adjustTextarea();
              }}
              onKeyDown={handleKeyDown}
              placeholder="Ask Rewired anything..."
              className="flex-1 resize-none bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground/50"
              rows={1}
              style={{ maxHeight: "160px" }}
            />
            <Button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isLoading}
              size="icon"
              className={cn(
                "h-9 w-9 shrink-0 rounded-xl transition-all duration-200",
                input.trim()
                  ? "bg-purple-600 shadow-lg shadow-purple-500/20 hover:bg-purple-500 hover:shadow-purple-500/30 hover:scale-105 active:scale-95"
                  : "bg-white/5 text-muted-foreground"
              )}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="mt-1.5 text-center text-[10px] text-muted-foreground/30">
            Rewired can make mistakes. Always verify important academic info.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;

  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
