import { createClient } from "@/lib/supabase/server";
import { getGoogleAuthUrl } from "@/lib/google/auth";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = getGoogleAuthUrl(user.id);
  return NextResponse.json({ url });
}
