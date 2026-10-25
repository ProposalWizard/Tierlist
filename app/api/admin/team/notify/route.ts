/**
 * /api/admin/team/notify — the Team room's phone notifications (admins only).
 *
 * GET  → { ready, publicKey }: is the private key set (TEAM_PUSH_PRIVATE_KEY)?
 * POST → ring people, after the sender's phone has saved a row:
 *   { table: "team_messages", id }  a chat message (@name, @all, a reply, a point)
 *   { table: "team_tasks", id }     a job typed on the board for someone else
 *   { table: "team_notes", id }     a note with @name / @all (patch-note notes, ideas, pushes)
 *   { jobs: ["id", …] }             pushed jobs the phone has just seen (team/jobs.json)
 *   { patches: true }               new patch notes in this deploy (any admin page asks once a visit)
 *   { test: true }                  a test buzz to your own devices
 *
 * Never trusts words from the phone: it reads the row itself with the
 * service role, checks the caller wrote it and that it is new (10 minutes),
 * and works out who to ring (lib/teamRoom/notify.ts). Pushed jobs are read
 * from GitHub here too, and each person is rung for a job once ever
 * (remembered in their account, app_metadata.teamPushJobs).
 *
 * Patch notes (Harry, 21 Oct 2026): the list is the archive THIS deploy was
 * built with (lib/patchNotesData.ts), never the phone's. Each new version
 * (published from TEAM_ROOM.inboxFrom, within 3 days) rings everyone but its
 * author once ever, as one buzz per person; the versions rung are kept in
 * each account (app_metadata.teamPushPatches). So the first admin to open an
 * admin page after a patch-notes deploy rings the team. No table, no SQL.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isAdmin } from "@/lib/admin";
import { offlineDevPlayEnabled } from "@/lib/star/devMode";
import { BUNDLED_JOBS, TEAM_ROOM, isTeamPerson, type TeamPerson } from "@/lib/teamRoom/config";
import { fetchTeamJobs } from "@/lib/teamRoom/jobs";
import type { TeamMessage, TeamTask } from "@/lib/teamRoom/logic";
import {
  RungBefore, TEST_PAYLOAD, jobsToRing, payloadForDm, payloadForJob, payloadForMessage, payloadForNote, payloadForTask, ringsForDm, ringsForMessage, ringsForNote, ringsForTask, withRungJobs,
  type PushPayload,
} from "@/lib/teamRoom/notify";
import { parseMessage } from "@/lib/teamRoom/extras";
import { pushReady, ring, rungJobsOf, rungPatchesOf, saveRungJobs, saveRungPatches, teamAccounts } from "@/lib/teamRoom/notifyServer";
import { patchesToRing, payloadForPatches, withRungPatches } from "@/lib/teamRoom/inbox";
import { patchReadKey } from "@/lib/teamRoom/extras";
import { BUILT_IN_PATCH_NOTES } from "@/lib/patchNotesData";

export const dynamic = "force-dynamic";

/** Rows already rung by this server (a second ask for the same row rings nobody). */
const rungBefore = new RungBefore(500);

async function caller(): Promise<{ id: string } | NextResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!(await isAdmin(user.id))) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  return { id: user.id };
}

export async function GET() {
  if (!offlineDevPlayEnabled()) {
    const c = await caller();
    if (c instanceof NextResponse) return c;
  }
  return NextResponse.json({ ready: pushReady(), publicKey: TEAM_ROOM.push.publicKey }, { headers: { "Cache-Control": "no-store" } });
}

const fresh = (iso: string) => Date.now() - (Date.parse(iso) || 0) <= TEAM_ROOM.push.freshMs;

export async function POST(req: Request) {
  const c = await caller();
  if (c instanceof NextResponse) return c;
  if (!pushReady()) return NextResponse.json({ ok: false, off: true, error: "Notifications aren't switched on yet (TEAM_PUSH_PRIVATE_KEY)." });

  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; } catch { return NextResponse.json({ error: "Bad request." }, { status: 400 }); }

  const sb = createServiceClient();
  let accounts: Partial<Record<TeamPerson, string>>;
  try { accounts = await teamAccounts(sb); } catch (e) {
    return NextResponse.json({ error: `Could not read the team list (${(e as Error).message}).` }, { status: 500 });
  }
  const me = (Object.keys(accounts) as TeamPerson[]).find((p) => accounts[p] === c.id) ?? null;
  if (!me) return NextResponse.json({ error: "Pick your name in the Team room first." }, { status: 403 });

  // A test buzz to your own devices (the one time the sender is rung).
  if (body.test === true) {
    const d = await ring(sb, accounts, [{ person: me, payload: TEST_PAYLOAD }]);
    return NextResponse.json({ ok: true, ...d });
  }

  // Pushed jobs: read from GitHub here (never the phone's list), rung once per person.
  if (Array.isArray(body.jobs)) {
    const ids = body.jobs.filter((x): x is string => typeof x === "string").slice(0, 20);
    const read = await fetchTeamJobs({
      fetch: (url, init) => fetch(url, { ...init, cache: "no-store" }),
      bundled: BUNDLED_JOBS,
      token: process.env.GITHUB_TOKEN?.trim() || null,
      repo: process.env.GITHUB_REPO?.trim() || undefined,
    });
    const people = (Object.keys(accounts) as TeamPerson[]);
    const had: Partial<Record<TeamPerson, string[]>> = {};
    await Promise.all(people.map(async (p) => { had[p] = await rungJobsOf(sb, accounts[p]!); }));
    const todo = jobsToRing(read.jobs, ids, Date.now(), had).filter(({ job }) => rungBefore.first(`j:${job.id}`));
    if (!todo.length) return NextResponse.json({ ok: true, sent: 0, jobs: 0 });
    // Mark them first: two phones asking at once must not ring twice.
    const newFor: Partial<Record<TeamPerson, string[]>> = {};
    for (const { job, to } of todo) for (const p of to) (newFor[p] ??= []).push(job.id);
    await Promise.all((Object.keys(newFor) as TeamPerson[]).map((p) => saveRungJobs(sb, accounts[p]!, withRungJobs(had[p], newFor[p]!))));
    const rings = todo.flatMap(({ job, to }) => to.map((person) => ({ person, payload: payloadForJob(job) })));
    const d = await ring(sb, accounts, rings);
    return NextResponse.json({ ok: true, jobs: todo.length, ...d });
  }

  // New patch notes in the archive this deploy carries: one buzz each person, once per version.
  if (body.patches === true) {
    const notes = BUILT_IN_PATCH_NOTES.map((n) => ({ version: n.version, title: n.title, publishedAt: n.publishedAt, updatedAt: n.updatedAt, updateNote: n.updateNote }));
    const people = (Object.keys(accounts) as TeamPerson[]);
    const had: Partial<Record<TeamPerson, string[]>> = {};
    await Promise.all(people.map(async (p) => { had[p] = await rungPatchesOf(sb, accounts[p]!); }));
    const todo = patchesToRing(notes, Date.now(), had)
      .filter((t) => accounts[t.person])
      .map((t) => ({ ...t, notes: t.notes.filter((n) => rungBefore.first(`p:${t.person}:${patchReadKey(n)}`)) }))
      .filter((t) => t.notes.length);
    if (!todo.length) return NextResponse.json({ ok: true, sent: 0, patches: 0 });
    // Mark them first: two phones asking at once must not ring twice.
    await Promise.all(todo.map((t) => saveRungPatches(sb, accounts[t.person]!, withRungPatches(had[t.person], t.notes.map((n) => patchReadKey(n))))));
    const d = await ring(sb, accounts, todo.map((t) => ({ person: t.person, payload: payloadForPatches(t.notes) })));
    return NextResponse.json({ ok: true, patches: todo.reduce((n, t) => n + t.notes.length, 0), ...d });
  }

  const id = Number(body.id);
  if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ error: "Which row?" }, { status: 400 });

  let rings: { person: TeamPerson; payload: PushPayload }[] = [];
  if (body.table === "team_messages") {
    const { data: m } = await sb.from("team_messages").select("id, person, body, image_url, created_at").eq("id", id).maybeSingle();
    const row = m as (Pick<TeamMessage, "id" | "person" | "body" | "image_url" | "created_at">) | null;
    if (!row) return NextResponse.json({ error: "No such message." }, { status: 404 });
    if (row.person !== me) return NextResponse.json({ error: "Only the sender can ring for a message." }, { status: 403 });
    if (!fresh(row.created_at)) return NextResponse.json({ ok: true, sent: 0, stale: true });
    if (!rungBefore.first(`m:${id}`)) return NextResponse.json({ ok: true, sent: 0, again: true });
    // A reply may sit behind a channel tag ("[#ideas] [re:12] …"): parseMessage reads both.
    const re = parseMessage(row.body).replyTo;
    let answers: { person: TeamPerson } | null = null;
    if (re) {
      const { data: a } = await sb.from("team_messages").select("person").eq("id", Number(re)).maybeSingle();
      if (a && isTeamPerson((a as { person: string }).person)) answers = { person: (a as { person: TeamPerson }).person };
    }
    rings = ringsForMessage(row, answers).map((r) => ({ person: r.person, payload: payloadForMessage(row, r.why) }));
  } else if (body.table === "team_dms") {
    // A private DM (team_room_v3.sql). The site's key can read it; the row rules
    // keep it from everyone else. Only its sender rings, only for its one reader.
    const { data: d } = await sb.from("team_dms").select("id, from_person, to_person, body, created_at").eq("id", id).maybeSingle();
    const row = d as { id: number; from_person: TeamPerson; to_person: TeamPerson; body: string; created_at: string } | null;
    if (!row) return NextResponse.json({ error: "No such message." }, { status: 404 });
    if (row.from_person !== me) return NextResponse.json({ error: "Only the sender can ring for a message." }, { status: 403 });
    if (!fresh(row.created_at)) return NextResponse.json({ ok: true, sent: 0, stale: true });
    if (!rungBefore.first(`d:${id}`)) return NextResponse.json({ ok: true, sent: 0, again: true });
    rings = ringsForDm(row).map((r) => ({ person: r.person, payload: payloadForDm(row) }));
  } else if (body.table === "team_tasks") {
    const { data: t } = await sb.from("team_tasks").select("id, owner, made_by, title, created_at").eq("id", id).maybeSingle();
    const row = t as (Pick<TeamTask, "id" | "owner" | "made_by" | "title" | "created_at">) | null;
    if (!row) return NextResponse.json({ error: "No such job." }, { status: 404 });
    if (row.made_by !== me) return NextResponse.json({ error: "Only whoever gave the job can ring for it." }, { status: 403 });
    if (!fresh(row.created_at)) return NextResponse.json({ ok: true, sent: 0, stale: true });
    if (!rungBefore.first(`t:${id}`)) return NextResponse.json({ ok: true, sent: 0, again: true });
    rings = ringsForTask(row).map((r) => ({ person: r.person, payload: payloadForTask(row) }));
  } else if (body.table === "team_notes") {
    const { data: n } = await sb.from("team_notes").select("id, person, body, target_kind, target_id, created_at").eq("id", id).maybeSingle();
    const row = n as { id: number; person: TeamPerson; body: string; target_kind: string; target_id: string; created_at: string } | null;
    if (!row) return NextResponse.json({ error: "No such note." }, { status: 404 });
    if (row.person !== me) return NextResponse.json({ error: "Only the writer can ring for a note." }, { status: 403 });
    if (!fresh(row.created_at)) return NextResponse.json({ ok: true, sent: 0, stale: true });
    if (!rungBefore.first(`n:${id}`)) return NextResponse.json({ ok: true, sent: 0, again: true });
    rings = ringsForNote(row).map((r) => ({ person: r.person, payload: payloadForNote(row, r.why) }));
  } else {
    return NextResponse.json({ error: "Which table?" }, { status: 400 });
  }
  if (!rings.length) return NextResponse.json({ ok: true, sent: 0 });
  const d = await ring(sb, accounts, rings);
  return NextResponse.json({ ok: true, ...d });
}
