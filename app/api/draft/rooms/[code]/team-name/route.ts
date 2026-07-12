import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isReservedTeamName } from "@/lib/seasonSimulator";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { teamName } = await req.json().catch(() => ({}));
  const trimmed = typeof teamName === "string" ? teamName.trim().slice(0, 30) : "";

  const service = createServiceClient();

  const { data: room } = await service
    .from("draft_rooms")
    .select("id, season_number")
    .eq("code", code.toUpperCase())
    .maybeSingle();

  if (!room) return new Response("Room not found", { status: 404 });

  // Team names are locked after season 1: European qualification matches the
  // player against the carried-over league table BY NAME, so a season-2
  // rename would silently void a UCL/UEL spot and leave the old name as a
  // ghost team in the table.
  if ((room.season_number ?? 1) > 1) {
    return new Response("Team names are locked after season 1", { status: 409 });
  }

  if (trimmed) {
    // The shared league table is keyed by team name — an AI-club name or a
    // name another player already took would merge two teams into one
    // corrupted row for everyone in the room.
    if (isReservedTeamName(trimmed)) {
      return new Response("That name belongs to a league club — pick something unique", { status: 409 });
    }
    // Escape LIKE wildcards so a name containing % or _ can't false-match
    const escaped = trimmed.replace(/[\\%_]/g, (c) => `\\${c}`);
    const { data: clash } = await service
      .from("draft_room_players")
      .select("id")
      .eq("room_id", room.id)
      .neq("user_id", user.id)
      .ilike("team_name", escaped)
      .maybeSingle();
    if (clash) {
      return new Response("Another player already has that team name", { status: 409 });
    }
  }

  const { error } = await service
    .from("draft_room_players")
    .update({ team_name: trimmed || null })
    .eq("room_id", room.id)
    .eq("user_id", user.id);

  if (error) return new Response("Failed to update team name", { status: 500 });

  return Response.json({ teamName: trimmed || null });
}
