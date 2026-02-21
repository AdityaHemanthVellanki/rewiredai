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
      description: "Get calendar events for a date range.",
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
        "Schedule a study block on the student's calendar. The agent should suggest optimal times based on their schedule and habits.",
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
            description: "Whether to sync to Google Calendar",
          },
        },
        required: ["title", "start_time", "end_time"],
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
];
