import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET() {
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ count: 0 });

  const service = createServiceClient();
  const { count } = await service
    .from("user_objectives")
    .select("objective_id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .not("completed_at", "is", null)
    .is("claimed_at", null);

  return NextResponse.json({ count: count ?? 0 });
}
