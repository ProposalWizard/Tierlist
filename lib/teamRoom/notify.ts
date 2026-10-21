/**
 * lib/teamRoom/notify.ts — phone notifications for the Team room (Harry,
 * 20 Oct 2026: "when I @Leo @Mikey, do they get added on their phone?
 * Because that is also needed").
 *
 * Who gets a buzz, and what it says. Pure: no React, no database, no
 * web-push, so it is tested with fakes (tests/star/teamRoomNotify.mts).
 *
 *   @Mikey in the chat            → Mikey
 *   @all / @everyone / @team      → the other two
 *   a reply to your message       → you
 *   a point (👉) sent to you      → you
 *   a job given to you (To-do)    → you
 *   a job pushed for you          → you (team/jobs.json, once, if new)
 *
 * Never the sender. One buzz per message per person. Buzzes from one chat
 * thread share a tag, so the phone shows one line that counts up, not a
 * pile (the worker, public/admin/team-sw.js, adds "+2 more").
 *
 * Each person's devices are kept in their own sign-in account's details
 * (TEAM_ROOM.push.devicesKey), not in a table (Harry: no new SQL).
 */
import { TEAM_PEOPLE, TEAM_ROOM, isTeamPerson, type TeamPerson } from "./config";
import { parseMessage, quoteLine } from "./extras";
import { isJobMarker, jobOwners, type TeamJob } from "./jobs";
import type { TeamMessage, TeamTask } from "./logic";

/** Why someone gets the buzz. When several apply, the first in this list names it. */
export type RingWhy = "point" | "reply" | "mention" | "all" | "task" | "job";
const ORDER: RingWhy[] = ["point", "reply", "mention", "all", "task", "job"];

/** What the worker shows. `url` opens on tap; `tag` groups a thread. */
export interface PushPayload { title: string; body: string; tag: string; url: string; icon?: string }
export interface Ring { person: TeamPerson; why: RingWhy }

const ALL = /(^|[^\w@])@(all|everyone|team)\b/i;
/** "@all", "@everyone" or "@team" anywhere in the words ("x@all.com" does not count). */
export const mentionsAll = (text: string) => ALL.test(text ?? "");

/** One entry per person, the strongest reason kept, the sender left out. Board order. */
function pick(rings: Ring[], sender: TeamPerson): Ring[] {
  const best = new Map<TeamPerson, RingWhy>();
  for (const r of rings) {
    if (r.person === sender || !isTeamPerson(r.person)) continue;
    const had = best.get(r.person);
    if (!had || ORDER.indexOf(r.why) < ORDER.indexOf(had)) best.set(r.person, r.why);
  }
  return TEAM_PEOPLE.filter((p) => best.has(p)).map((p) => ({ person: p, why: best.get(p)! }));
}

/**
 * Who a chat message rings. `answers` = the message it replies to (its
 * author is told), or null.
 */
export function ringsForMessage(m: Pick<TeamMessage, "person" | "body">, answers: Pick<TeamMessage, "person"> | null): Ring[] {
  const p = parseMessage(m.body);
  const rings: Ring[] = [];
  for (const c of p.cards) for (const x of c.point?.to ?? []) rings.push({ person: x, why: "point" });
  if (p.replyTo && answers) rings.push({ person: answers.person, why: "reply" });
  for (const x of p.mentions) rings.push({ person: x, why: "mention" });
  if (mentionsAll(p.text)) for (const x of TEAM_PEOPLE) rings.push({ person: x, why: "all" });
  return pick(rings, m.person);
}

/**
 * A note under a patch note, an idea or a push (Harry, 21 Oct 2026: "you should
 * be able to @ someone" in patch-note notes). @Name rings that person, @all the
 * other two. Never the writer.
 */
export function ringsForNote(n: { person: TeamPerson; body: string }): Ring[] {
  const rings: Ring[] = [];
  for (const x of parseMessage(n.body).mentions) rings.push({ person: x, why: "mention" });
  if (mentionsAll(n.body)) for (const x of TEAM_PEOPLE) rings.push({ person: x, why: "all" });
  return pick(rings, n.person);
}

/** "> quoted line" rows at the top of a note are the lines it is about; the rest is what was said. */
export function splitQuotes(body: string): { quotes: string[]; text: string } {
  const lines = (body ?? "").split("\n");
  const quotes: string[] = [];
  let i = 0;
  for (; i < lines.length && /^>\s?/.test(lines[i]); i++) quotes.push(lines[i].replace(/^>\s?/, "").trim());
  return { quotes: quotes.filter(Boolean), text: lines.slice(i).join("\n").trim() };
}

export function payloadForNote(n: { person: TeamPerson; body: string; target_kind: string; target_id: string }, why: RingWhy): PushPayload {
  const where = n.target_kind === "patch" ? `patch notes v${n.target_id}` : n.target_kind === "idea" ? "an idea" : "a push";
  const { quotes, text } = splitQuotes(n.body);
  const body = cut(`${text}${quotes.length ? ` (about: “${quotes[0]}”${quotes.length > 1 ? ` +${quotes.length - 1}` : ""})` : ""}`, 160);
  const url = n.target_kind === "patch" ? `${TEAM_ROOM.home}?tab=notes&v=${encodeURIComponent(n.target_id)}&notes=1`
    : n.target_kind === "idea" ? `${TEAM_ROOM.home}?tab=ideas` : TEAM_ROOM.home;
  return { title: `${n.person} ${why === "all" ? "noted for the team" : "mentioned you"} on ${where}`, body, tag: `kib-note-${n.target_kind}-${n.target_id}`, url, icon: TEAM_ROOM.push.icon };
}

/** A job typed on the board for someone else rings them. Your own, or a pushed job's tick row, rings nobody. */
export function ringsForTask(t: Pick<TeamTask, "owner" | "made_by" | "title">): Ring[] {
  if (isJobMarker(t) || t.owner === t.made_by) return [];
  return pick([{ person: t.owner, why: "task" }], t.made_by);
}

/** A pushed job rings its owners ("all" = each of the three), never whoever asked for it. */
export function ringsForJob(j: Pick<TeamJob, "owner" | "from">): Ring[] {
  return pick(jobOwners(j).map((person) => ({ person, why: "job" as const })), j.from);
}

/** Does the text even need asking about? (The phone skips the trip for "ok 👍".) */
export function mayRing(body: string): boolean {
  return /@|^\[re:|kib-point=/i.test(body ?? "");
}

const cut = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

/** Chat buzzes: one tag per reply thread, one for the rest of the chat. */
export function chatTag(body: string): string {
  const r = parseMessage(body).replyTo;
  return r ? `kib-chat-${r}` : "kib-chat";
}

export function payloadForMessage(m: Pick<TeamMessage, "id" | "person" | "body" | "image_url">, why: RingWhy): PushPayload {
  const title =
    why === "point" ? `${m.person} pointed at something for you`
      : why === "reply" ? `${m.person} replied to you`
        : why === "all" ? `${m.person} to the team`
          : `${m.person} mentioned you`;
  return { title, body: cut(quoteLine(m, 160), 160), tag: chatTag(m.body), url: `${TEAM_ROOM.home}?tab=chat&m=${m.id}`, icon: TEAM_ROOM.push.icon };
}

export function payloadForTask(t: Pick<TeamTask, "made_by" | "title">): PushPayload {
  return { title: `${t.made_by} gave you a job`, body: cut(t.title, 160), tag: "kib-todo", url: `${TEAM_ROOM.home}?tab=todo`, icon: TEAM_ROOM.push.icon };
}

export function payloadForJob(j: Pick<TeamJob, "from" | "title">): PushPayload {
  return { title: `New job from ${j.from}`, body: cut(j.title, 160), tag: "kib-todo", url: `${TEAM_ROOM.home}?tab=todo`, icon: TEAM_ROOM.push.icon };
}

export const TEST_PAYLOAD: PushPayload = {
  title: "Phone notifications are on",
  body: "You'll get a buzz when someone @'s you, replies to you or gives you a job.",
  tag: "kib-test", url: `${TEAM_ROOM.home}?tab=todo`, icon: TEAM_ROOM.push.icon,
};

/* ── Pushed jobs: ring once each, only while new ─────────────────────── */

/**
 * The pushed jobs to ring now: asked for by id, still in the jobs file,
 * added in the last day (TEAM_ROOM.push.jobFreshMs, and not in the future),
 * and per person not rung before (`rung` = job ids each person has had).
 */
export function jobsToRing(
  jobs: TeamJob[], ids: readonly string[], now: number, rung: Partial<Record<TeamPerson, readonly string[]>>,
): { job: TeamJob; to: TeamPerson[] }[] {
  const want = new Set(ids);
  const out: { job: TeamJob; to: TeamPerson[] }[] = [];
  for (const j of jobs) {
    const age = now - (Date.parse(j.added) || 0);
    if (!want.has(j.id) || age < -5 * 60_000 || age > TEAM_ROOM.push.jobFreshMs) continue;
    const to = ringsForJob(j).map((r) => r.person).filter((p) => !(rung[p] ?? []).includes(j.id));
    if (to.length) out.push({ job: j, to });
  }
  return out;
}

/** Remember the jobs a person has been rung for (newest kept). */
export function withRungJobs(list: unknown, ids: readonly string[], cap = 200): string[] {
  const had = Array.isArray(list) ? list.filter((x): x is string => typeof x === "string") : [];
  return [...had.filter((x) => !ids.includes(x)), ...ids].slice(-cap);
}

/* ── Devices (kept in the account's details) ─────────────────────────── */

/** One phone or computer: where the push service reaches it, and its two keys. */
export interface PushDevice { endpoint: string; p256dh: string; auth: string; at: string }

/** The devices kept on an account, cleaned. Anything odd is left out (never throws). */
export function cleanDevices(raw: unknown): PushDevice[] {
  if (!Array.isArray(raw)) return [];
  const out: PushDevice[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const d = r as Record<string, unknown>;
    const ok = (v: unknown, max: number): v is string => typeof v === "string" && v.length > 0 && v.length <= max;
    if (!ok(d.endpoint, 1000) || !/^https:\/\//.test(d.endpoint) || !ok(d.p256dh, 200) || !ok(d.auth, 100)) continue;
    if (out.some((x) => x.endpoint === d.endpoint)) continue;
    out.push({ endpoint: d.endpoint, p256dh: d.p256dh, auth: d.auth, at: typeof d.at === "string" ? d.at : "" });
  }
  return out;
}

/** A browser subscription (PushSubscription.toJSON()) as a device, or null if it is not one. */
export function deviceFrom(sub: { endpoint?: string | null; keys?: Record<string, string> | null } | null | undefined, now: number): PushDevice | null {
  const d = cleanDevices([{ endpoint: sub?.endpoint, p256dh: sub?.keys?.p256dh, auth: sub?.keys?.auth, at: new Date(now).toISOString() }]);
  return d[0] ?? null;
}

/** Add (or refresh) a device: newest first, the same address only once, at most `max`. */
export function withDevice(list: PushDevice[], d: PushDevice, max: number = TEAM_ROOM.push.maxDevices): PushDevice[] {
  return [d, ...list.filter((x) => x.endpoint !== d.endpoint)].slice(0, max);
}

export function withoutDevices(list: PushDevice[], endpoints: readonly string[]): PushDevice[] {
  return list.filter((x) => !endpoints.includes(x.endpoint));
}

/** The push service's answer that the device has gone for good (uninstalled, turned off, expired). */
export const isGone = (status: number | undefined) => status === 404 || status === 410;

/* ── Sending (the parts the server wires to web-push and Supabase) ───── */

/** A device this new is never dropped as gone (the push service can lag behind a fresh subscription). */
export const NEW_DEVICE_GRACE_MS = 2 * 60_000;

export interface Delivery {
  sent: number;
  /** Devices dropped because the push service said they are gone. */
  dropped: number;
  failed: number;
  /** People asked for who have no device switched on. */
  noDevice: TeamPerson[];
}

/**
 * Send each person their buzz on each of their devices, and drop a device
 * the push service says is gone. `send` throws with `statusCode` on a
 * refusal (as web-push does).
 */
export async function deliver(opts: {
  rings: { person: TeamPerson; payload: PushPayload }[];
  devicesOf: (p: TeamPerson) => Promise<PushDevice[] | null>;
  saveDevices: (p: TeamPerson, list: PushDevice[]) => Promise<void>;
  send: (d: PushDevice, body: string) => Promise<unknown>;
  now?: number;
}): Promise<Delivery> {
  const out: Delivery = { sent: 0, dropped: 0, failed: 0, noDevice: [] };
  const now = opts.now ?? Date.now();
  // Seen 20 Oct 2026: Google's push service answered 410 to a subscription a few
  // seconds old, then took it fine 15 s later. So a device turned on in the last
  // couple of minutes is never dropped, only counted as failed.
  const settled = (d: PushDevice) => now - (Date.parse(d.at) || 0) > NEW_DEVICE_GRACE_MS;
  await Promise.all(opts.rings.map(async ({ person, payload }) => {
    const devices = (await opts.devicesOf(person)) ?? [];
    if (!devices.length) { out.noDevice.push(person); return; }
    const body = JSON.stringify(payload);
    const gone: string[] = [];
    await Promise.all(devices.map(async (d) => {
      try { await opts.send(d, body); out.sent++; } catch (e) {
        if (isGone((e as { statusCode?: number })?.statusCode) && settled(d)) gone.push(d.endpoint); else out.failed++;
      }
    }));
    if (gone.length) {
      // Read again just before writing, so a device added meanwhile stays.
      const now = (await opts.devicesOf(person)) ?? devices;
      await opts.saveDevices(person, withoutDevices(now, gone));
      out.dropped += gone.length;
    }
  }));
  out.noDevice = TEAM_PEOPLE.filter((p) => out.noDevice.includes(p));
  return out;
}

/** Remembers what was already rung on this server, so a repeated ask rings nobody twice. */
export class RungBefore {
  private seen = new Map<string, number>();
  constructor(private cap = 500) {}
  /** True the first time a key is seen; false after. */
  first(key: string): boolean {
    if (this.seen.has(key)) return false;
    this.seen.set(key, Date.now());
    if (this.seen.size > this.cap) this.seen.delete(this.seen.keys().next().value as string);
    return true;
  }
  forget(key: string) { this.seen.delete(key); }
}
