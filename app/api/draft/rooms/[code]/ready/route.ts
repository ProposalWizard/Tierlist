import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { squad, avg_ovr, team_strength } = await req.json();

  const service = createServiceClient();

  const { data: room } = await service
    .from("draft_rooms")
    .select("id")
    .eq("code", code.toUpperCase())
    .maybeSingle();

  if (!room) return new Response("Room not found", { status: 404 });

  const { error } = await service
    .from("draft_room_players")
    .update({ squad, avg_ovr, team_strength, status: "ready" })
    .eq("room_id", room.id)
    .eq("user_id", user.id);

  if (error) return new Response("Failed to submit squad", { status: 500 });

  return Response.json({ ok: true });
}
