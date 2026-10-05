import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdmin, roleOf } from "@/lib/admin";

/**
 * Who is signed in: { isAdmin, isTester }. isAdmin is exactly the old answer;
 * isTester (added 5 Oct 2026, tester access) is true for testers AND admins.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ isAdmin: false, isTester: false });
  const [admin, role] = await Promise.all([isAdmin(user.id), roleOf(user.id)]);
  return NextResponse.json({ isAdmin: admin, isTester: admin || role !== "player" });
}
