import { getAzureOpenAI } from "@/lib/azure-openai";

export interface ParsedDeadline {
  title: string;
  due_date: string;
  type: "assignment" | "exam" | "quiz" | "project" | "other";
  weight_percent: number | null;
  description: string | null;
  confidence: number; // 0-1
}

export interface ParsedSyllabus {
  course_name: string;
  professor: string | null;
  schedule: string | null;
  grading_rubric: { category: string; weight: number }[];
  deadlines: ParsedDeadline[];
}

export async function parseSyllabusText(
  pdfText: string,
  courseHint?: string
): Promise<ParsedSyllabus> {
  const client = getAzureOpenAI();

  const response = await client.chat.completions.create({
    model: process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are an expert at parsing college course syllabi. Extract structured data from the syllabus text provided. Be thorough — find every assignment, exam, quiz, and project with its due date. For the grading rubric, extract all categories and their weights. If dates are relative (e.g., "Week 5"), estimate based on a standard semester starting in January or August. Assign a confidence score (0-1) to each deadline based on how certain you are about the extracted date.

Return valid JSON matching this exact schema:
{
  "course_name": "string",
  "professor": "string or null",
  "schedule": "string describing class meeting times or null",
  "grading_rubric": [{"category": "string", "weight": number}],
  "deadlines": [{
    "title": "string",
    "due_date": "ISO 8601 date string",
    "type": "assignment|exam|quiz|project|other",
    "weight_percent": number or null,
    "description": "brief description or null",
    "confidence": number between 0 and 1
  }]
}`,
      },
      {
        role: "user",
        content: `${courseHint ? `Course hint: ${courseHint}\n\n` : ""}Syllabus text:\n\n${pdfText}`,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.1,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("No response from AI");

  return JSON.parse(content) as ParsedSyllabus;
}
