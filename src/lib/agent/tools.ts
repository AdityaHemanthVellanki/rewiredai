import type { ChatCompletionTool } from "openai/resources/chat/completions";

export const agentTools: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "get_deadlines",
      description:
        "Get upcoming deadlines/assignments for the student. Can filter by course, status, or time range.",
      parameters: {
        type: "object",
        properties: {
          course_id: { type: "string", description: "Filter by specific course ID" },
          status: {
            type: "string",
            enum: ["pending", "in_progress", "completed", "overdue"],
            description: "Filter by status",
          },
          days_ahead: {
            type: "number",
            description: "Number of days to look ahead (default 7)",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_grades",
      description:
        "Get current grades for the student. Can filter by course. Returns individual grades and calculated course averages.",
      parameters: {
        type: "object",
        properties: {
          course_id: { type: "string", description: "Filter by specific course ID" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_calendar_events",
      description:
        "Get the student's FULL schedule for a date range — includes Google Calendar events (classes, meetings, etc.) AND Rewired study blocks. ALWAYS use this before scheduling anything to check for conflicts.",
      parameters: {
        type: "object",
        properties: {
          start_date: { type: "string", description: "Start date (ISO 8601)" },
          end_date: { type: "string", description: "End date (ISO 8601)" },
        },
        required: ["start_date", "end_date"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_email_summaries",
      description:
        "Get recent email summaries. Can filter by category or priority.",
      parameters: {
        type: "object",
        properties: {
          category: {
            type: "string",
            enum: ["professor", "financial_aid", "campus_admin", "clubs", "spam", "personal"],
          },
          min_priority: {
            type: "number",
            description: "Minimum priority score (1-10)",
          },
          unhandled_only: {
            type: "boolean",
            description: "Only show unhandled emails",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_study_block",
      description:
        "Schedule a study block on the student's calendar. ALWAYS call get_calendar_events first to find a free slot. Always set sync_to_google=true so it appears on their Google Calendar.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Study block title" },
          course_id: { type: "string", description: "Associated course" },
          assignment_id: { type: "string", description: "Associated assignment" },
          start_time: { type: "string", description: "Start time (ISO 8601)" },
          end_time: { type: "string", description: "End time (ISO 8601)" },
          sync_to_google: {
            type: "boolean",
            description: "Whether to sync to Google Calendar (default true)",
          },
        },
        required: ["title", "start_time", "end_time"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_study_block",
      description:
        "Update an existing study block — change title, time, status, or course. Can also reschedule it.",
      parameters: {
        type: "object",
        properties: {
          study_block_id: { type: "string", description: "Study block ID" },
          title: { type: "string", description: "New title" },
          start_time: { type: "string", description: "New start time (ISO 8601)" },
          end_time: { type: "string", description: "New end time (ISO 8601)" },
          status: {
            type: "string",
            enum: ["scheduled", "completed", "skipped"],
            description: "New status",
          },
        },
        required: ["study_block_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_study_block",
      description:
        "Delete a study block. Also removes it from Google Calendar if it was synced.",
      parameters: {
        type: "object",
        properties: {
          study_block_id: { type: "string", description: "Study block ID" },
        },
        required: ["study_block_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_google_calendar_event",
      description:
        "Create an event directly on the student's Google Calendar (for non-study things like meetings, office hours, etc.).",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Event title" },
          description: { type: "string", description: "Event description" },
          start_time: { type: "string", description: "Start time (ISO 8601)" },
          end_time: { type: "string", description: "End time (ISO 8601)" },
        },
        required: ["title", "start_time", "end_time"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_google_calendar_event",
      description:
        "Delete an event from the student's Google Calendar by event ID.",
      parameters: {
        type: "object",
        properties: {
          event_id: { type: "string", description: "Google Calendar event ID" },
        },
        required: ["event_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_nudge",
      description:
        "Create a nudge/reminder for the student about an assignment or task.",
      parameters: {
        type: "object",
        properties: {
          message: { type: "string", description: "The nudge message" },
          assignment_id: { type: "string", description: "Related assignment" },
          severity: {
            type: "string",
            enum: ["gentle", "firm", "urgent", "nuclear"],
          },
        },
        required: ["message", "severity"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_assignment_status",
      description: "Update the status of an assignment.",
      parameters: {
        type: "object",
        properties: {
          assignment_id: { type: "string", description: "Assignment ID" },
          status: {
            type: "string",
            enum: ["pending", "in_progress", "completed"],
          },
        },
        required: ["assignment_id", "status"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "calculate_grade_needed",
      description:
        "Calculate what score the student needs on a remaining assignment/exam to achieve a target grade in a course.",
      parameters: {
        type: "object",
        properties: {
          course_id: { type: "string", description: "Course ID" },
          target_grade: {
            type: "number",
            description: "Target grade percentage (e.g., 80 for B-)",
          },
          remaining_assignment_weight: {
            type: "number",
            description: "Weight of the remaining assignment as percentage",
          },
        },
        required: ["course_id", "target_grade"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_agent_memory",
      description:
        "Recall stored information about the student's habits, preferences, and patterns.",
      parameters: {
        type: "object",
        properties: {
          category: {
            type: "string",
            enum: ["habit", "preference", "pattern", "escalation", "mood"],
          },
          key: { type: "string", description: "Specific memory key to look up" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "save_agent_memory",
      description:
        "Save an observation about the student's habits, preferences, or patterns for future reference.",
      parameters: {
        type: "object",
        properties: {
          key: { type: "string", description: "Memory key (e.g., 'study_preference_time')" },
          value: { type: "object", description: "The data to remember" },
          category: {
            type: "string",
            enum: ["habit", "preference", "pattern", "escalation", "mood"],
          },
        },
        required: ["key", "value", "category"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_study_stats",
      description:
        "Get study statistics — hours studied this week, completion rates, streak info.",
      parameters: {
        type: "object",
        properties: {
          period: {
            type: "string",
            enum: ["today", "this_week", "this_month"],
            description: "Time period for stats",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "sync_canvas",
      description:
        "Re-sync assignments, submissions, and grades from Canvas LMS. Updates assignment statuses based on what the student has actually submitted. Use this when the student asks to refresh their Canvas data or when assignment statuses might be stale.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "sync_emails",
      description:
        "Check for new emails from the student's Gmail. Returns count of new emails found. Use this when the student asks about new emails or wants to check for updates.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "auto_schedule_study",
      description:
        "Automatically schedule optimal study blocks for the student's upcoming assignments. Fetches their REAL Google Calendar to avoid scheduling over classes/meetings. Considers peak productivity hours, sleep schedule, and deadline urgency. Creates up to 5 study blocks and syncs them to Google Calendar.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "mark_email_handled",
      description:
        "Mark an email summary as handled/dealt with. Use this after the student confirms they've addressed an action-required email.",
      parameters: {
        type: "object",
        properties: {
          email_id: { type: "string", description: "Email summary ID" },
        },
        required: ["email_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_course_summary",
      description:
        "Get a comprehensive summary of a specific course: current grade, upcoming assignments, recent grades, and study time spent. Use this when the student asks about a specific course.",
      parameters: {
        type: "object",
        properties: {
          course_id: { type: "string", description: "Course ID" },
        },
        required: ["course_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_all_courses",
      description:
        "Get a list of all the student's courses with IDs. Use this first when you need to reference a course by ID but only have the name.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_profile",
      description:
        "Update the student's profile settings — peak productivity hours, sleep window, escalation mode, GPA target, semester goals, etc.",
      parameters: {
        type: "object",
        properties: {
          productivity_peak_hours: {
            type: "array",
            items: { type: "string" },
            description: "Peak productivity hours as array of HH:MM strings (e.g. ['09:00', '10:00', '14:00'])",
          },
          sleep_window: {
            type: "object",
            properties: {
              sleep: { type: "string", description: "Bedtime (HH:MM)" },
              wake: { type: "string", description: "Wake time (HH:MM)" },
            },
            description: "Sleep schedule",
          },
          escalation_mode: {
            type: "string",
            enum: ["gentle", "standard", "aggressive"],
            description: "How aggressively to nudge about procrastination",
          },
          gpa_target: {
            type: "number",
            description: "Target GPA (e.g. 3.5)",
          },
          semester_goals: {
            type: "array",
            items: { type: "string" },
            description: "Semester goals",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_profile",
      description:
        "Get the student's current profile settings — peak hours, sleep window, escalation mode, GPA target, goals.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
];
