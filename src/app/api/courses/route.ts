import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { dualWriteCreate, dualWriteClose } from "@/lib/solana/dual-write";
import { DataType } from "@/lib/solana/constants";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: courses, error } = await supabase
    .from("courses")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ courses });
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

  const { data: course, error } = await supabase
    .from("courses")
    .insert({
      user_id: user.id,
      name: body.name,
      code: body.code || null,
      professor: body.professor || null,
      schedule: body.schedule || null,
      color: body.color || "#6366f1",
      grading_rubric: body.grading_rubric || [],
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Dual-write to Solana (fire-and-forget)
  if (course) {
    const { id, user_id, solana_index, ...onChainData } = course;
    // Get next index from count of existing records
    const { count } = await supabase
      .from("courses")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .not("solana_index", "is", null);
    const nextIndex = count ?? 0;
    dualWriteCreate(user.id, DataType.Course, nextIndex, onChainData)
      .then((result) => {
        if (result) {
          supabase.from("courses").update({ solana_index: result.index }).eq("id", id).then(() => {});
        }
      })
      .catch(console.error);
  }

  return NextResponse.json({ course });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing course ID" }, { status: 400 });
  }

  // Get solana_index before deleting
  const { data: courseToDelete } = await supabase
    .from("courses")
    .select("solana_index")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  const { error } = await supabase
    .from("courses")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Close on-chain record
  if (courseToDelete?.solana_index != null) {
    dualWriteClose(user.id, DataType.Course, courseToDelete.solana_index).catch(console.error);
  }

  return NextResponse.json({ success: true });
}
