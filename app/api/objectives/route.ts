import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createServiceClient();
  const { data: objectives, error } = await supabase
    .from("objectives")
    .select("*")
    .eq("is_active", true)
    .gt("xp_reward", 0)
    .order("sort_order", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const serverSupabase = await createClient();
  const { data: { user } } = await serverSupabase.auth.getUser();
  let completed: string[] = [];
  if (user) {
    const { data: userObjs } = await supabase
      .from("user_objectives")
      .select("objective_id")
      .eq("user_id", user.id);
    completed = (userObjs ?? []).map(o => o.objective_id);
  }

  return NextResponse.json({
    objectives: objectives ?? [],
    completed,
  });
}
