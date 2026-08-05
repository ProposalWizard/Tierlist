import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { CHALLENGE_DRAFT_MODE } from "@/lib/challengeRoom";

/**
 * Create a Challenge draft room.
 *
 * Uses the same draft_rooms / draft_room_players tables as every other mode, so
 * there is nothing new to migrate. settings.draftMode marks it as ours; the
 * draft state itself goes on american_state once the host starts.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const body = await req.json().catch(() => ({})) as { eraStart?: number; eraEnd?: number };
  const eraStart = Number.isFinite(Number(body.eraStart)) ? Number(body.eraStart) : 2007;
  const eraEnd = Number.isFinite(Number(body.eraEnd)) ? Number(body.eraEnd) : 2026;

  const service = createServiceClient();

  // Built char by char from a fixed alphabet. A toString(36) slice can come out
  // shorter than six characters, producing a room the join screen can never
  // accept.
  const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const makeCode = () => Array.from({ length: 6 }, () =>
    ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join("");

  let code = makeCode();
  for (let i = 0; i < 10; i++) {
    const { data: clash } = await service.from("draft_rooms").select("id").eq("code", code).maybeSingle();
    if (!clash) break;
    code = makeCode();
  }

  const { data: room, error } = await service
    .from("draft_rooms")
    .insert({
      code,
      host_id: user.id,
      status: "lobby",
      settings: { draftMode: CHALLENGE_DRAFT_MODE, eraStart, eraEnd },
    })
    .select("id, code")
    .single();

  if (error || !room) {
    return NextResponse.json({ error: error?.message ?? "Could not create room" }, { status: 500 });
  }

  const { data: profile } = await service
    .from("user_profiles")
    .select("username, team_name")
    .eq("user_id", user.id)
    .maybeSingle();

  const { error: playerErr } = await service.from("draft_room_players").insert({
    room_id: room.id,
    user_id: user.id,
    display_name: profile?.username || user.email?.split("@")[0] || "Player",
    team_name: profile?.team_name || null,
    status: "drafting",
  });
  if (playerErr) {
    return NextResponse.json({ error: playerErr.message }, { status: 500 });
  }

  return NextResponse.json({ code: room.code, roomId: room.id });
}
