import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

function genCode(): string {
  const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let c = "";
  for (let i = 0; i < 6; i++) c += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return c;
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const service = createServiceClient();
  const { data: profile } = await service
    .from("user_profiles")
    .select("username, team_name")
    .eq("user_id", user.id)
    .maybeSingle();
  const displayName = profile?.team_name || profile?.username || user.email?.split("@")[0] || "Player";

  // Unique 6-char code
  let code = genCode();
  for (let i = 0; i < 10; i++) {
    const { data } = await service
      .from("american_draft_rooms")
      .select("id")
      .eq("code", code)
      .maybeSingle();
    if (!data) break;
    code = genCode();
  }

  const { data: room, error } = await service
    .from("american_draft_rooms")
    .insert({ code, host_id: user.id })
    .select("id, code")
    .single();

  if (error || !room) {
    return new Response(
      `Failed to create room: ${error?.message ?? "no data returned"} (code: ${error?.code ?? "?"})`,
      { status: 500 }
    );
  }

  await service.from("american_draft_participants").insert({
    room_id: room.id,
    user_id: user.id,
    display_name: displayName,
  });

  return NextResponse.json({ code: room.code, room_id: room.id });
}
