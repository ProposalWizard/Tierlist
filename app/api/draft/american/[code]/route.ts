import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET(
  _req: Request,
  { params }: { params: { code: string } }
) {
  const service = createServiceClient();

  const { data: room } = await service
    .from("american_draft_rooms")
    .select("*")
    .eq("code", params.code.toUpperCase())
    .maybeSingle();

  if (!room) return new Response("Room not found", { status: 404 });

  const { data: participants } = await service
    .from("american_draft_participants")
    .select("*")
    .eq("room_id", room.id)
    .order("joined_at");

  return NextResponse.json({ room, participants: participants || [] });
}
