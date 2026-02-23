import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { dualWriteCreate } from "@/lib/solana/dual-write";
import { DataType } from "@/lib/solana/constants";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const courseId = searchParams.get("course_id");

  let query = supabase
    .from("grades")
    .select("*, course:courses(*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (courseId) query = query.eq("course_id", courseId);

  const { data: grades, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ grades });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  const { data: grade, error } = await supabase
    .from("grades")
    .insert({
      user_id: user.id,
      course_id: body.course_id,
      assignment_id: body.assignment_id || null,
      title: body.title,
      score: body.score,
      max_score: body.max_score,
      weight: body.weight || null,
      agent_feedback: body.agent_feedback || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Dual-write to Solana
  if (grade) {
    const { id, user_id, solana_index, course, ...onChainData } = grade;
    const { count } = await supabase
      .from("grades")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .not("solana_index", "is", null);
    const nextIndex = count ?? 0;
    dualWriteCreate(user.id, DataType.Grade, nextIndex, onChainData)
      .then((result) => {
        if (result) {
          supabase.from("grades").update({ solana_index: result.index }).eq("id", id).then(() => {});
        }
      })
      .catch(console.error);
  }

  return NextResponse.json({ grade });
}
