import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createServiceClient();

  // Active, published, non-expired objectives (XP or card reward)
  let { data: objectives, error } = await supabase
    .from("objectives")
    .select("*")
    .eq("is_active", true)
    .eq("is_published", true)
    .or("expires_at.is.null,expires_at.gt.now()")
    .order("sort_order", { ascending: true });

  if (error) {
    // is_published column may not exist yet — fall back without the filter
    const fallback = await supabase
      .from("objectives")
      .select("*")
      .eq("is_active", true)
      .or("expires_at.is.null,expires_at.gt.now()")
      .order("sort_order", { ascending: true });
    if (fallback.error) return NextResponse.json({ error: fallback.error.message }, { status: 500 });
    objectives = fallback.data;
  }

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
