import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { seedReplacementDraftIfReady } from "@/lib/americanReplacementSeed";
import type { AmericanState } from "@/lib/americanDraft";
import type { DraftPlayer } from "@/lib/seasonSimulator";

/**
 * Submit one manager's between-season position: the squad they are left with
 * after departures and any sale, and how many replacements they are owed.
 *
 * The last manager to submit also seeds the replacement draft, in the same
 * request. Doing it here rather than behind a host button means nobody has to
 * coordinate, and the seeding write is conditional so two simultaneous final
 * submissions cannot produce two different pools.
 */
export async function POST(
  req: Request,
  { params }: { params: { code: string } }
) {
  const body = await req.json().catch(() => null) as {
    squad?: DraftPlayer[];
    vacancies?: number;
    needsGk?: boolean;
  } | null;

  if (!body || !Array.isArray(body.squad)) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const count = Number(body.vacancies);
  if (!Number.isInteger(count) || count < 0 || count > 3) {
    return NextResponse.json({ error: "vacancies must be between 0 and 3" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const service = createServiceClient();
  const code = params.code.toUpperCase();

  const { data: room, error: roomErr } = await service
    .from("draft_rooms")
    .select("id, american_state, settings, season_number")
    .eq("code", code)
    .maybeSingle();

  if (roomErr) return NextResponse.json({ error: roomErr.message }, { status: 500 });
  if (!room) return new Response("Room not found", { status: 404 });

  // ── Guards ────────────────────────────────────────────────────────────────
  // Without these, ANY logged-in user could POST to ANY room code (they are
  // short, enumerable, and draft_rooms is world-readable) and the write below
  // would replace american_state — which holds picks, pick_order and
  // round_players — with a two-key object, permanently bricking a live draft.

  // 1. The caller must actually be in this room, and not eliminated.
  const { data: me, error: meErr } = await service
    .from("draft_room_players")
    .select("user_id, status")
    .eq("room_id", room.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (meErr) return NextResponse.json({ error: meErr.message }, { status: 500 });
  if (!me) return NextResponse.json({ error: "You are not in this room" }, { status: 403 });
  if (me.status === "out") {
    return NextResponse.json({ error: "You have been eliminated from this room" }, { status: 403 });
  }

  // 2. The room must be running an American draft at all.
  if ((room.settings as { draftMode?: string } | null)?.draftMode !== "american") {
    return NextResponse.json({ error: "This room is not in American draft mode" }, { status: 400 });
  }

  // 3. Never while an initial draft is live — that is the state this would
  //    otherwise overwrite. Only a finished draft may be superseded by the
  //    between-season replacement round.
  const existing = room.american_state as AmericanState | null;
  if (existing && existing.mode !== "replacement" && !existing.complete) {
    return NextResponse.json(
      { error: "A draft is already in progress in this room" },
      { status: 409 }
    );
  }

  // Persist the reduced squad so the pool can exclude everyone still owned. The
  // status stays "drafting" — the squad is not final until it has been arranged.
  const { error: squadErr } = await service
    .from("draft_room_players")
    .update({ squad: body.squad })
    .eq("room_id", room.id)
    .eq("user_id", user.id);
  if (squadErr) {
    return NextResponse.json({ error: `Could not save your squad: ${squadErr.message}` }, { status: 500 });
  }

  const { data: allPlayers, error: playersErr } = await service
    .from("draft_room_players")
    .select("user_id, status, squad, actual_finish")
    .eq("room_id", room.id);
  if (playersErr) {
    return NextResponse.json({ error: playersErr.message }, { status: 500 });
  }

  // Relegated managers are out of the competition and take no part.
  const active = (allPlayers ?? []).filter(p => p.status !== "out");

  // Merge this manager's entry into pending_vacancies, then CHECK IT SURVIVED.
  //
  // This is a read-modify-write on a shared JSONB column. Two managers
  // submitting within the same moment both read {A}, then write {A,B} and
  // {A,C} — last write wins and one of them vanishes. Both got HTTP 200, so
  // neither client ever retried, and "everyone is in" could never become true:
  // the whole room waited forever. Re-reading after the write and retrying
  // when our own entry is missing makes every writer converge.
  //
  // Only pending_vacancies is carried forward. Spreading the whole previous
  // state dragged complete:true and seeded:true from the last season into this
  // one, so the draft was skipped and could never be seeded again.
  const mine = { count, needsGk: !!body.needsGk };
  let pending: Record<string, { count: number; needsGk: boolean }> = {};
  let everyoneIn = false;
  let merged = false;

  for (let attempt = 0; attempt < 5; attempt++) {
    const current = attempt === 0
      ? (room.american_state as AmericanState | null)
      : ((await service.from("draft_rooms").select("american_state").eq("id", room.id).maybeSingle())
          .data?.american_state as AmericanState | null) ?? null;

    // A completed state belongs to the previous season — start fresh.
    const stale = current?.complete === true;
    pending = { ...(stale ? {} : (current?.pending_vacancies ?? {})) };
    pending[user.id] = mine;
    everyoneIn = active.every(p => pending[p.user_id] !== undefined);

    // Once everyone is in, fall through to the seeding block below, which has
    // its own conditional claim and is safe to race on.
    if (everyoneIn) { merged = true; break; }

    const { error } = await service
      .from("draft_rooms")
      .update({ american_state: { mode: "replacement", pending_vacancies: pending } })
      .eq("id", room.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const { data: check } = await service
      .from("draft_rooms")
      .select("american_state")
      .eq("id", room.id)
      .maybeSingle();
    const after = (check?.american_state as AmericanState | null)?.pending_vacancies ?? {};
    if (after[user.id] !== undefined) { merged = true; break; }
    // Someone overwrote us — go round again with their state as the base.
  }

  if (!merged) {
    return NextResponse.json(
      { error: "Could not record your squad — please try again." },
      { status: 503 }
    );
  }

  if (!everyoneIn) {
    return NextResponse.json({
      ok: true,
      waiting: true,
      submitted: Object.keys(pending).length,
      total: active.length,
    });
  }

  // Everyone is in — seed the draft. Shared with the leave route, so a manager
  // quitting can also complete the set.
  const outcome = await seedReplacementDraftIfReady(service, room.id);
  if (outcome.status === "error") {
    return NextResponse.json({ error: `Could not start the draft: ${outcome.message}` }, { status: 500 });
  }
  if (outcome.status === "waiting") {
    return NextResponse.json({ ok: true, waiting: true, submitted: outcome.submitted, total: outcome.total });
  }
  if (outcome.status === "no-vacancies") {
    return NextResponse.json({ ok: true, complete: true, noVacancies: true });
  }
  return NextResponse.json({
    ok: true,
    started: true,
    ...(outcome.status === "already-seeded" ? { alreadySeeded: true } : {}),
  });
}
