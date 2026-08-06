import { NextResponse } from "next/server";
import { buildBriefSequence } from "@/lib/challengeDraft";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Start a Challenge draft: pick the fourteen briefs this run will play.
 *
 * Generated server-side rather than in the browser because choosing them needs
 * the real player pool — a brief that cannot fill a ten-card board (a
 * nationality with four Premier League players, say) has to be discarded before
 * anyone sees it.
 *
 * The dev sandbox keeps no server state: the client holds the sequence and
 * sends each brief's ID back per round, and the rule for that ID is rebuilt
 * server-side, so a tampered brief cannot widen its own pool.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({})) as {
    eraStart?: number; eraEnd?: number; prime?: boolean; playerCount?: number;
  };

  const opts = {
    eraStart: Number.isFinite(Number(body.eraStart)) ? Number(body.eraStart) : 2007,
    eraEnd: Number.isFinite(Number(body.eraEnd)) ? Number(body.eraEnd) : 2026,
    prime: body.prime === true,
  };

  try {
    const service = createServiceClient();
    // Boards grow with the room, so a brief has to be deep enough for THIS
    // room — a nationality with eleven players is fine solo and unusable for
    // three managers.
    const briefs = await buildBriefSequence(service, opts, Number(body.playerCount) || 1);
    if (briefs.length === 0) {
      return NextResponse.json(
        { error: "No usable briefs — is the Premier League player data imported?" },
        { status: 500 }
      );
    }
    return NextResponse.json({ briefs, opts });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not start the draft" },
      { status: 500 }
    );
  }
}
