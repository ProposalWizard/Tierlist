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

  const { teamName } = await req.json().catch(() => ({}));
  const trimmed = typeof teamName === "string" ? teamName.trim().slice(0, 30) : "";

  const service = createServiceClient();

  const { data: room } = await service
    .from("draft_rooms")
    .select("id")
    .eq("code", code.toUpperCase())
    .maybeSingle();

  if (!room) return new Response("Room not found", { status: 404 });

  const { error } = await service
    .from("draft_room_players")
    .update({ team_name: trimmed || null })
    .eq("room_id", room.id)
    .eq("user_id", user.id);

  if (error) return new Response("Failed to update team name", { status: 500 });

  return Response.json({ teamName: trimmed || null });
}
