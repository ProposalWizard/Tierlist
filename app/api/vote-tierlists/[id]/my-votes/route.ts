/**
 * GET /api/vote-tierlists/[id]/my-votes?voter_id=<uuid>
 *
 * Returns the current voter's selections for every image in a vote tierlist.
 * For logged-in users the auth session is used; for anonymous users the
 * voter_id query param (a UUID stored in the browser's localStorage) is used.
 *
 * Response: Record<imageId, tierLabel>
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Anonymous voter ids are namespaced with "anon:" (matching the vote route)
  // so they can't be used to read a logged-in user's ballot.
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  let voterId: string | null;
  if (user) {
    voterId = user.id;
  } else {
    const raw = new URL(request.url).searchParams.get("voter_id");
    voterId = raw && UUID_RE.test(raw) ? `anon:${raw}` : null;
  }

  if (!voterId) return NextResponse.json({});

  const { data, error } = await supabase
    .from("vote_tierlist_votes")
    .select("image_id, tier_label")
    .eq("vote_tierlist_id", id)
    .eq("voter_id", voterId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const result: Record<string, string> = {};
  for (const row of data ?? []) {
    result[row.image_id] = row.tier_label;
  }
  return NextResponse.json(result);
}
