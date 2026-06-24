import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createServiceClient();

  // Active, published, non-expired objectives with visible XP
  let query = supabase
    .from("objectives")
    .select("*")
    .eq("is_active", true)
    .gt("xp_reward", 0)
    .or("expires_at.is.null,expires_at.gt.now()")
    .order("sort_order", { ascending: true });
  try { query = query.eq("is_published", true); } catch { /* column may not exist yet */ }
  const { data: objectives, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const serverSupabase = await createClient();
  const { data: { user } } = await serverSupabase.auth.getUser();

  let completed: string[] = [];
  let completedObjectives: typeof objectives = [];

  if (user) {
    const { data: userObjs } = await supabase
      .from("user_objectives")
      .select("objective_id")
      .eq("user_id", user.id);
    completed = (userObjs ?? []).map(o => o.objective_id);

    // Fetch full details for completed objectives (even if expired)
    if (completed.length > 0) {
      const { data: completedData } = await supabase
        .from("objectives")
        .select("*")
        .in("id", completed);
      completedObjectives = completedData ?? [];
    }
  }

  return NextResponse.json({
    objectives: objectives ?? [],
    completed,
    completedObjectives,
  });
}
