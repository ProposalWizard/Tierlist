import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

// Removes the caller from a room. Without this, leaving is purely client-side:
// the departed player's row lingers forever, "allReady" can never become true
// and the room deadlocks — and a departed HOST (who gates start/simulate/
// next-season) kills the room outright.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const service = createServiceClient();

  const { data: room } = await service
    .from("draft_rooms")
    .select("id, host_id, status")
    .eq("code", code.toUpperCase())
    .maybeSingle();

  if (!room) return Response.json({ ok: true, roomClosed: true });

  const { data: players } = await service
    .from("draft_room_players")
    .select("user_id, joined_at, status")
    .eq("room_id", room.id)
    .order("joined_at", { ascending: true });

  const others = (players ?? []).filter(p => p.user_id !== user.id);

  if (room.host_id === user.id) {
    if (others.length === 0 || room.status === "lobby") {
      // Empty room, or host abandons before the game starts → close the room
      // (players cascade). Remaining lobby members are told it closed.
      await service.from("draft_rooms").delete().eq("id", room.id);
      return Response.json({ ok: true, roomClosed: true });
    }
    // Mid-game: hand the host role to the longest-joined remaining player who
    // is still in the competition (not "out") so start/simulate/next-season
    // stay operable, then remove the leaver.
    const nextHost = others.find(p => p.status !== "out");
    if (!nextHost) {
      // Only "out" (relegated) players remain — close the room.
      await service.from("draft_rooms").delete().eq("id", room.id);
      return Response.json({ ok: true, roomClosed: true });
    }
    await service.from("draft_rooms").update({ host_id: nextHost.user_id }).eq("id", room.id);
  }

  await service
    .from("draft_room_players")
    .delete()
    .eq("room_id", room.id)
    .eq("user_id", user.id);

  return Response.json({ ok: true });
}
