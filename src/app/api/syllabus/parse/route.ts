import { createClient } from "@/lib/supabase/server";
import { parseSyllabusText } from "@/lib/parsers/syllabus";
import { NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File;
  const courseId = formData.get("course_id") as string;

  if (!file || !courseId) {
    return NextResponse.json(
      { error: "Missing file or course_id" },
      { status: 400 }
    );
  }

  // Get course info for context
  const { data: course } = await supabase
    .from("courses")
    .select("name, code")
    .eq("id", courseId)
    .eq("user_id", user.id)
    .single();

  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  try {
    // Parse PDF
    const buffer = Buffer.from(await file.arrayBuffer());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parser = new PDFParse(buffer) as any;
    await parser.load();
    const pdfText: string = parser.getText();

    if (!pdfText.trim()) {
      return NextResponse.json(
        { error: "Could not extract text from PDF" },
        { status: 400 }
      );
    }

    // Use AI to parse syllabus
    const parsed = await parseSyllabusText(
      pdfText,
      `${course.code || ""} ${course.name}`
    );

    // Update course with grading rubric and professor
    if (parsed.grading_rubric.length > 0 || parsed.professor) {
      await supabase
        .from("courses")
        .update({
          grading_rubric: parsed.grading_rubric,
          professor: parsed.professor || course.code,
          schedule: parsed.schedule,
        })
        .eq("id", courseId)
        .eq("user_id", user.id);
    }

    // Create assignments from extracted deadlines
    let deadlinesCreated = 0;
    for (const deadline of parsed.deadlines) {
      const { error } = await supabase.from("assignments").insert({
        user_id: user.id,
        course_id: courseId,
        title: deadline.title,
        due_date: deadline.due_date,
        weight: deadline.weight_percent,
        source: "syllabus",
        description: deadline.description,
        confidence_score: deadline.confidence,
        priority:
          deadline.type === "exam"
            ? "high"
            : deadline.type === "project"
              ? "high"
              : "medium",
      });
      if (!error) deadlinesCreated++;
    }

    return NextResponse.json({
      deadlines_created: deadlinesCreated,
      grading_rubric: parsed.grading_rubric,
      course_name: parsed.course_name,
    });
  } catch (err) {
    console.error("Syllabus parse error:", err);
    return NextResponse.json(
      { error: "Failed to parse syllabus" },
      { status: 500 }
    );
  }
}
