import { NextResponse } from "next/server";
import { briefById, fetchChallengeRound, MIN_BRIEF_POOL } from "@/lib/challengeDraft";
import { playerNameKey } from "@/lib/americanDraft";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * The ten cards for one brief.
 *
 * Takes a brief ID, not a rule. The rule is looked up server-side from the
 * brief catalogue, so a client cannot hand back a widened or invented brief to
 * fish for better players.
 *
 * `taken` is everyone already drafted this run — sent by the client because the
 * sandbox holds no server state. That is fine here: it can only ever REMOVE
 * players from what you are offered, so the worst a tampered list achieves is a
 * thinner board.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({})) as {
    briefId?: string;
    taken?: { sofifa_id?: string; name?: string }[];
    eraStart?: number; eraEnd?: number; prime?: boolean;
  };

  const brief = body.briefId ? briefById(body.briefId) : undefined;
  if (!brief) {
    return NextResponse.json({ error: "Unknown brief" }, { status: 400 });
  }

  const excludeKeys = new Set<string>();
  for (const p of (body.taken ?? []).slice(0, 200)) {
    if (p?.sofifa_id) excludeKeys.add(`id:${p.sofifa_id}`);
    const nk = playerNameKey(p?.name ?? "");
    if (nk) excludeKeys.add(`name:${nk}`);
  }

  const opts = {
    eraStart: Number.isFinite(Number(body.eraStart)) ? Number(body.eraStart) : 2007,
    eraEnd: Number.isFinite(Number(body.eraEnd)) ? Number(body.eraEnd) : 2026,
    prime: body.prime === true,
  };

  try {
    const service = createServiceClient();
    const players = await fetchChallengeRound(service, brief, excludeKeys, opts, MIN_BRIEF_POOL);

    if (players.length === 0) {
      return NextResponse.json(
        { error: `No players left for "${brief.title}".`, players: [] },
        { status: 409 }
      );
    }
    // A short board is playable — say so rather than failing the round.
    return NextResponse.json({ players, short: players.length < MIN_BRIEF_POOL });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not load this round" },
      { status: 500 }
    );
  }
}
