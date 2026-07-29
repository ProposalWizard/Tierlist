import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function POST(
  _req: Request,
  { params }: { params: { code: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const service = createServiceClient();

  const { data: room } = await service
    .from("american_draft_rooms")
    .select("id, status, host_id")
    .eq("code", params.code.toUpperCase())
    .maybeSingle();

  if (!room) return new Response("Room not found", { status: 404 });

  // Allow rejoin
  const { data: existing } = await service
    .from("american_draft_participants")
    .select("id")
    .eq("room_id", room.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) return NextResponse.json({ room_id: room.id });

  if (room.status !== "lobby") return new Response("Draft already started", { status: 400 });

  const { data: all } = await service
    .from("american_draft_participants")
    .select("id")
    .eq("room_id", room.id);

  if ((all || []).length >= 6) return new Response("Room is full (max 6)", { status: 400 });

  const { data: profile } = await service
    .from("user_profiles")
    .select("username, team_name")
    .eq("user_id", user.id)
    .maybeSingle();

  const displayName = profile?.team_name || profile?.username || user.email?.split("@")[0] || "Player";

  await service.from("american_draft_participants").insert({
    room_id: room.id,
    user_id: user.id,
    display_name: displayName,
  });

  return NextResponse.json({ room_id: room.id });
}
