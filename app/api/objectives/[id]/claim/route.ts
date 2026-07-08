import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { levelFromXp } from "@/lib/xp";

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

  // Award XP if not yet awarded (idempotent — unique constraint on xp_events deduplicates)
  if (obj.xp_reward > 0) {
    const eventType = `objective_${obj.id}`;
    const { error: xpEventErr } = await service.from("xp_events").insert({
      user_id: user.id,
      event_type: eventType,
      event_ref: eventType,
      xp_awarded: obj.xp_reward,
    });
    if (!xpEventErr) {
      const { data: xpRow } = await service.from("user_xp").select("total_xp").eq("user_id", user.id).maybeSingle();
      const oldXp = xpRow?.total_xp ?? 0;
      const newXp = oldXp + obj.xp_reward;
      const { level: newLevel } = levelFromXp(newXp);
      await service.from("user_xp").upsert({
        user_id: user.id,
        total_xp: newXp,
        current_level: newLevel,
        updated_at: new Date().toISOString(),
      });
    }
    // 23505 = unique violation → XP was already awarded via season check, which is fine
  }

  return NextResponse.json({ ok: true, objective: obj });
}
