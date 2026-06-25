import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient();

  const { data: userObj } = await service
    .from("user_objectives")
    .select("completed_at, claimed_at")
    .eq("user_id", user.id)
    .eq("objective_id", params.id)
    .single();

  if (!userObj?.completed_at) return NextResponse.json({ error: "Not completed" }, { status: 400 });
  if (userObj.claimed_at) return NextResponse.json({ error: "Already claimed" }, { status: 400 });

  const { data: obj } = await service
    .from("objectives")
    .select("id, title, xp_reward, card_image_url, card_name")
    .eq("id", params.id)
    .single();

  if (!obj) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await service
    .from("user_objectives")
    .update({ claimed_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("objective_id", params.id);

  return NextResponse.json({ ok: true, objective: obj });
}
