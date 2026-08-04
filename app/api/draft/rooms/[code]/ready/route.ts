import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { computeTeamStrength } from "@/lib/seasonSimulator";
import { sanitizeSquad, MAX_SQUAD } from "@/lib/squadSanitize";
import type { DraftPlayer } from "@/lib/seasonSimulator";

// A drafted squad is 11 starters plus subs; season 2+ can add signings. Anything
// outside this range is not a squad this game can produce.
const MIN_SQUAD = 11;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  // An empty or malformed body used to throw here and surface as a 500.
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return new Response("Invalid request body", { status: 400 });
  }

  const rawSquad = (body as { squad?: unknown }).squad;
  if (!Array.isArray(rawSquad) || rawSquad.length < MIN_SQUAD || rawSquad.length > MAX_SQUAD) {
    return new Response(`Squad must be an array of ${MIN_SQUAD}-${MAX_SQUAD} players`, { status: 400 });
  }

  // Ratings are clamped and every entry must look like a player. This bounds the
  // damage from a hand-crafted request; it does NOT prove the squad was actually
  // drafted, since the client-side spin leaves no server record of what was
  // offered. Verifying that would need the offered pool persisted per player.
  //
  // Shared with the simulate route, which re-applies it to the STORED squad —
  // draft_room_players is directly writable by its owner, so a squad can reach
  // the league without ever passing through here.
  const squad: DraftPlayer[] = sanitizeSquad(rawSquad);
  if (squad.length !== rawSquad.length) {
    return new Response("Invalid player in squad", { status: 400 });
  }

  // Derived from the squad server-side — never taken from the request. The
  // client used to supply these and the simulate route trusts them, so a
  // hand-sent team_strength decided the shared league.
  const { teamStrength: team_strength, avgOvr: avg_ovr } = computeTeamStrength(squad);

  const service = createServiceClient();

  const { data: room } = await service
    .from("draft_rooms")
    .select("id, status")
    .eq("code", code.toUpperCase())
    .maybeSingle();

  if (!room) return new Response("Room not found", { status: 404 });

  // A ready submitted while the previous season is still "complete" would be
  // wiped moments later by the host's next-season reset, deadlocking the room
  // (the player looks unready forever but their client thinks it submitted).
  // Reject it; the client retries until the host has advanced the season.
  if (room.status === "complete") {
    return new Response("Waiting for host to start the next season", { status: 409 });
  }

  // Relegated players ("out") are eliminated from the competition and must not
  // be able to re-enter the league by submitting a squad.
  const { data: myRow } = await service
    .from("draft_room_players")
    .select("status")
    .eq("room_id", room.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (myRow?.status === "out") {
    return new Response("Relegated players cannot submit a squad", { status: 409 });
  }

  const { error } = await service
    .from("draft_room_players")
    .update({ squad, avg_ovr, team_strength, status: "ready" })
    .eq("room_id", room.id)
    .eq("user_id", user.id);

  if (error) return new Response("Failed to submit squad", { status: 500 });

  return Response.json({ ok: true });
}
