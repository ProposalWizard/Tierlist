"use client";
/**
 * lib/teamRoom/store.ts — the Team room's live data, shared by the chat
 * bubble (every admin page) and the Team room tabs (/admin/team).
 *
 * One copy per browser tab: the first screen that asks loads everything and
 * opens one live channel (Supabase Realtime + "who's here now"). Writes go
 * straight to the database; the row rules in team_room.sql check who you are.
 * If the tables are missing, `missing` is true and the screens say which SQL
 * file to run instead of breaking.
 *
 * Channels (Harry, 23 Oct 2026): channels and threads live in the message
 * text (lib/teamRoom/channels.ts), so they need no SQL. New/renamed
 * channels, reactions, private DMs and bot rows need team_room_v3.sql;
 * until it runs `v3` is "off" and those screens say so in place.
 */
import { canonicalPatchVersion } from "@/lib/patchVersionAliases";
import { useSyncExternalStore } from "react";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/imageUtils";
import { offlineDevPlayEnabled } from "@/lib/star/devMode";
import { demoRoom } from "./demo";
import { BUNDLED_JOBS, TEAM_ROOM, isTeamPerson, type TeamPerson } from "./config";
import {
  upsertById, type IdeaStage, type NoteKind, type TeamIdea, type TeamMessage, type TeamNote, type TeamTask, type TeamVote,
} from "./logic";
import { withAck, type AckKind, type ReadMarks, type TeamAck } from "./extras";
import { markerJobId, markerTitle, parseJobs, type JobsRead, type TeamJob } from "./jobs";
import { ringAfter, ringNewJobs } from "./push";
import {
  cleanName, isReaction, isSlug, listChannels, newChannelSlug, withReaction,
  type BotRow, type ChannelReads, type ChannelRow, type Reaction, type TeamDm, type TeamReaction,
} from "./channels";
import { cleanStatus, AWAY_AFTER_MS, type StatusRow } from "./status";
import { BELLS_KEY, NO_BELLS, cleanBells, withBell, withMute, type Bell, type BellPrefs } from "./bells";
import { cleanWelcome, nextVersion, WELCOME_EDITOR, type WelcomeRead, type WelcomeRow } from "./welcome";
import { cleanMark, type BugMark } from "./bugs";

export interface TeamRoomState {
  status: "idle" | "loading" | "ready" | "missing" | "signedOut" | "error";
  error: string | null;
  me: TeamPerson | null;
  /** Names already taken by other accounts. */
  taken: TeamPerson[];
  messages: TeamMessage[];
  ideas: TeamIdea[];
  votes: TeamVote[];
  tasks: TeamTask[];
  notes: TeamNote[];
  online: TeamPerson[];
  live: boolean;
  /** When you last read each part (this browser). */
  read: { chat: number; tasks: number; notes: number; pushNotes: number; patchNotes: number };
  /** The full chat page is on screen (the bubble hides). */
  pageOpen: boolean;
  /** Round two (team_room_v2.sql): "on" = shared; "off" = not run yet, kept on this device only. */
  v2: "unknown" | "on" | "off";
  /** The newest message each person has had on screen. */
  marks: ReadMarks;
  /** "Got it" on a point, "Read and understood" on a patch note. */
  acks: TeamAck[];
  /** Point mode is on: drag a box over the page (Shift+X or the Point button). */
  pointing: boolean;
  /** Jobs that arrived by push (team/jobs.json on GitHub; lib/teamRoom/jobs.ts). */
  jobs: TeamJob[];
  /** Where they came from: read live, or the copy built into the site (null = not loaded yet). */
  jobsFrom: "github" | "bundled" | null;
  /** Pushed jobs you have had on screen in the To-do (this browser): the badge leaves them out. */
  seenJobs: string[];
  /** Round three (team_room_v3.sql): "on" = channels/reactions/DMs shared; "off" = not run yet. */
  v3: "unknown" | "on" | "off";
  /** New and renamed channels (team_channels). */
  channelRows: ChannelRow[];
  reactions: TeamReaction[];
  /** Your own private DMs only: the database's row rules never send anyone else's. */
  dms: TeamDm[];
  /** Posts a future bot wrote (team_bot_posts). */
  botRows: BotRow[];
  /** The newest message read in each channel and DM (this browser). */
  chRead: ChannelReads;
  /** Round four (team_room_v4.sql): status, the first-open note, bug marks. "off" = not run yet. */
  v4: "unknown" | "on" | "off";
  /** Each person's status, do not disturb and schedules (lib/teamRoom/status.ts). */
  statuses: Partial<Record<TeamPerson, StatusRow>>;
  /** The note shown once on first open (lib/teamRoom/welcome.ts), and who has read which version. */
  welcome: WelcomeRow | null;
  welcomeReads: WelcomeRead[];
  /** Bug reports handed on or marked fixed (lib/teamRoom/bugs.ts). */
  bugMarks: BugMark[];
  /** Your 🔔 per channel (lib/teamRoom/bells.ts), kept in your account's details. */
  bells: BellPrefs;
}

const READ_KEY = "kib-team-read";
function loadRead(): TeamRoomState["read"] {
  try {
    const j = JSON.parse(localStorage.getItem(READ_KEY) ?? "{}");
    return { chat: +j.chat || 0, tasks: +j.tasks || 0, notes: +j.notes || 0, pushNotes: +j.pushNotes || 0, patchNotes: +j.patchNotes || 0 };
  } catch { return { chat: 0, tasks: 0, notes: 0, pushNotes: 0, patchNotes: 0 }; }
}

// Until team_room_v2.sql runs, your own seen mark, your own acks and your
// patch-note notes are kept in this browser, and the screens say so.
const SEEN_KEY = "kib-team-seen";
const SEEN_JOBS_KEY = "kib-team-jobs-seen";
const ACKS_KEY = "kib-team-acks";
const LOCAL_NOTES_KEY = "kib-team-local-notes";
const CH_READ_KEY = "kib-team-ch-read";
// Until team_room_v4.sql runs, your status is kept on this device; bells in demo too.
const STATUS_KEY = "kib-team-status";
const BELLS_LOCAL_KEY = "kib-team-bells";
function readJson<T>(key: string, fallback: T): T {
  try { const v = JSON.parse(localStorage.getItem(key) ?? "null"); return v ?? fallback; } catch { return fallback; }
}
function writeJson(key: string, v: unknown) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* private mode */ }
}

let state: TeamRoomState = {
  status: "idle", error: null, me: null, taken: [], messages: [], ideas: [], votes: [], tasks: [], notes: [],
  online: [], live: false, read: { chat: 0, tasks: 0, notes: 0, pushNotes: 0, patchNotes: 0 }, pageOpen: false,
  v2: "unknown", marks: {}, acks: [], pointing: false, jobs: [], jobsFrom: null, seenJobs: [],
  v3: "unknown", channelRows: [], reactions: [], dms: [], botRows: [], chRead: {},
  v4: "unknown", statuses: {}, welcome: null, welcomeReads: [], bugMarks: [], bells: NO_BELLS,
};
const listeners = new Set<() => void>();
function set(patch: Partial<TeamRoomState> | ((s: TeamRoomState) => Partial<TeamRoomState>)) {
  state = { ...state, ...(typeof patch === "function" ? patch(state) : patch) };
  listeners.forEach((l) => l());
}

let sb: ReturnType<typeof createClient> | null = null;
let userId: string | null = null;
let started = false;
let channel: ReturnType<ReturnType<typeof createClient>["channel"]> | null = null;
let poll: ReturnType<typeof setInterval> | null = null;
let jobsPoll: ReturnType<typeof setInterval> | null = null;

/**
 * Pushed jobs, from the site's route (which reads GitHub). If the route
 * can't be reached, the copy built into the site, unless a live list is
 * already here (a passing fault keeps it). Not an admin: stop asking.
 */
async function loadJobs() {
  try {
    const r = await fetch(TEAM_ROOM.jobs.api, { cache: "no-store" });
    if (r.status === 401 || r.status === 403) { if (jobsPoll) clearInterval(jobsPoll); jobsPoll = null; }
    if (!r.ok) throw new Error(String(r.status));
    const j = (await r.json()) as JobsRead;
    if (j.problems?.length) console.warn("Team jobs:", j.problems.join(" "));
    const jobs = parseJobs(j.jobs);
    set({ jobs, jobsFrom: j.from === "github" ? "github" : "bundled" });
    // New pushed jobs ring their owners' phones (once each; the site checks).
    if (!demo) ringNewJobs(jobs);
  } catch {
    set((s) => (s.jobsFrom === "github" ? {} : { jobs: parseJobs(BUNDLED_JOBS), jobsFrom: "bundled" }));
  }
}

const isMissing = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === "42P01" || e.code === "PGRST205" || /does not exist|schema cache/i.test(e.message ?? ""));

async function loadAll() {
  if (!sb) return;
  const [mem, msg, ide, vot, tas, not] = await Promise.all([
    sb.from("team_members").select("user_id, person"),
    sb.from("team_messages").select("*").order("id", { ascending: false }).limit(TEAM_ROOM.loadMessages),
    sb.from("team_ideas").select("*").order("id"),
    sb.from("team_idea_votes").select("idea_id, person"),
    sb.from("team_tasks").select("*").order("id"),
    sb.from("team_notes").select("*").order("id"),
  ]);
  const first = [mem, msg, ide, vot, tas, not].find((r) => r.error)?.error ?? null;
  if (isMissing(first)) { set({ status: "missing", error: null }); return false; }
  if (first) { set({ status: "error", error: first.message }); return false; }
  const members = (mem.data ?? []) as { user_id: string; person: string }[];
  const mine = members.find((m) => m.user_id === userId)?.person;
  set({
    status: "ready", error: null,
    me: isTeamPerson(mine) ? mine : null,
    taken: members.filter((m) => m.user_id !== userId).map((m) => m.person).filter(isTeamPerson),
    messages: ((msg.data ?? []) as TeamMessage[]).reverse(),
    ideas: (ide.data ?? []) as TeamIdea[],
    votes: (vot.data ?? []) as TeamVote[],
    tasks: (tas.data ?? []) as TeamTask[],
    notes: [...((not.data ?? []) as TeamNote[]), ...readJson<TeamNote[]>(LOCAL_NOTES_KEY, [])].map(patchNoteKey),
  });
  await loadV2();
  await loadV3();
  await loadV4();
  loadBells();
  return true;
}

/** Round four's tables. Missing → "off": the room works; status stays on this device, #bugs says it needs setting up. */
async function loadV4() {
  if (!sb) return;
  const [st, wl, wr, bm] = await Promise.all([
    sb.from("team_status").select("*"),
    sb.from("team_welcome").select("*").eq("id", 1).maybeSingle(),
    sb.from("team_welcome_reads").select("person, version, at"),
    sb.from("team_bug_marks").select("*"),
  ]);
  const e = st.error ?? wl.error ?? wr.error ?? bm.error;
  if (e) {
    set({ v4: "off", statuses: localStatus() });
    if (!isMissing(e)) console.warn("Team room v4 could not load:", e.message);
    return;
  }
  const statuses: Partial<Record<TeamPerson, StatusRow>> = {};
  for (const r of (st.data ?? []) as Record<string, unknown>[]) if (isTeamPerson(r.person)) statuses[r.person] = cleanStatus(r, r.person);
  set({
    v4: "on", statuses,
    welcome: cleanWelcome(wl.data as Record<string, unknown> | null),
    welcomeReads: ((wr.data ?? []) as WelcomeRead[]).filter((r) => isTeamPerson(r.person)).map((r) => ({ ...r, version: Number(r.version) })),
    bugMarks: ((bm.data ?? []) as Record<string, unknown>[]).map(cleanMark).filter((m): m is BugMark => !!m),
  });
}
function localStatus(): Partial<Record<TeamPerson, StatusRow>> {
  const me = state.me;
  const raw = readJson<Record<string, unknown> | null>(STATUS_KEY, null);
  return me && raw ? { [me]: cleanStatus(raw, me) } : {};
}
/** Your bells, from your account's details (or this device in a demo). */
async function loadBells() {
  if (demo || !sb) { set({ bells: cleanBells(readJson(BELLS_LOCAL_KEY, null)) }); return; }
  try {
    const { data } = await sb.auth.getUser();
    set({ bells: cleanBells((data.user?.user_metadata as Record<string, unknown> | undefined)?.[BELLS_KEY]) });
  } catch { /* keep the starting setup */ }
}

/** Round three's tables. Missing → "off": channels and threads still work (they live in the text). */
async function loadV3() {
  if (!sb) return;
  const [ch, re, dm, bot] = await Promise.all([
    sb.from("team_channels").select("slug, name, topic, made_by, created_at").order("created_at"),
    sb.from("team_reactions").select("message_id, emoji, person, at"),
    sb.from("team_dms").select("*").order("id", { ascending: false }).limit(TEAM_ROOM.loadMessages),
    sb.from("team_bot_posts").select("*").order("id", { ascending: false }).limit(200),
  ]);
  const e = ch.error ?? re.error ?? dm.error ?? bot.error;
  if (e) {
    set({ v3: "off" });
    if (!isMissing(e)) console.warn("Team room v3 could not load:", e.message);
    return;
  }
  set({
    v3: "on",
    channelRows: (ch.data ?? []) as ChannelRow[],
    reactions: ((re.data ?? []) as TeamReaction[]).filter((r) => isTeamPerson(r.person) && isReaction(r.emoji)).map((r) => ({ ...r, message_id: Number(r.message_id) })),
    dms: ((dm.data ?? []) as TeamDm[]).reverse(),
    botRows: ((bot.data ?? []) as BotRow[]).reverse(),
  });
}

/** Renumbered patch notes (lib/patchVersionAliases.ts): a tick or note saved on an old number counts on the new one. */
function patchAckKey(a: TeamAck): TeamAck {
  return a.kind === "patch" ? { ...a, target: canonicalPatchVersion(a.target) } : a;
}
function patchNoteKey(n: TeamNote): TeamNote {
  return n.target_kind === "patch" ? { ...n, target_id: canonicalPatchVersion(n.target_id) } : n;
}

/** Round two's tables. Missing → "off": everything still works, kept on this device. */
async function loadV2() {
  if (!sb) return;
  const [mk, ak] = await Promise.all([
    sb.from("team_read_marks").select("person, last_seen_id"),
    sb.from("team_acks").select("kind, target, person, at"),
  ]);
  const e = mk.error ?? ak.error;
  if (e) {
    set({ v2: "off", ...localV2() });
    if (!isMissing(e)) console.warn("Team room v2 could not load:", e.message);
    return;
  }
  const marks: ReadMarks = {};
  for (const r of (mk.data ?? []) as { person: string; last_seen_id: number }[]) if (isTeamPerson(r.person)) marks[r.person] = Number(r.last_seen_id) || 0;
  set({ v2: "on", marks, acks: ((ak.data ?? []) as TeamAck[]).filter((a) => isTeamPerson(a.person)).map(patchAckKey) });
}
function localV2(): Pick<TeamRoomState, "marks" | "acks"> {
  const me = state.me;
  const seen = readJson<number>(SEEN_KEY, 0);
  return { marks: me ? { [me]: +seen || 0 } : {}, acks: readJson<TeamAck[]>(ACKS_KEY, []).map(patchAckKey) };
}

type Change = { eventType: "INSERT" | "UPDATE" | "DELETE"; new: Record<string, unknown>; old: Record<string, unknown> };

/** A new row from someone else, as it arrives live: the computer pop-ups listen (lib/teamRoom/popups.ts). */
export type Incoming = { kind: "message"; row: TeamMessage } | { kind: "dm"; row: TeamDm } | { kind: "bot"; row: BotRow };
let incoming: ((x: Incoming) => void) | null = null;
export const setIncomingListener = (f: ((x: Incoming) => void) | null) => { incoming = f; };

function apply(table: string, c: Change) {
  const row = (c.eventType === "DELETE" ? c.old : c.new) as Record<string, unknown>;
  const del = c.eventType === "DELETE";
  if (c.eventType === "INSERT" && incoming) {
    try {
      if (table === "team_messages" && row.person !== state.me && !state.messages.some((m) => m.id === Number(row.id))) incoming({ kind: "message", row: row as unknown as TeamMessage });
      if (table === "team_dms" && row.from_person !== state.me) incoming({ kind: "dm", row: row as unknown as TeamDm });
      if (table === "team_bot_posts") incoming({ kind: "bot", row: row as unknown as BotRow });
    } catch { /* a pop-up never stops the room */ }
  }
  if (table === "team_idea_votes") {
    const v = row as unknown as TeamVote;
    set((s) => {
      const rest = s.votes.filter((x) => !(x.idea_id === v.idea_id && x.person === v.person));
      return { votes: del ? rest : [...rest, { idea_id: v.idea_id, person: v.person }] };
    });
    return;
  }
  if (table === "team_read_marks") {
    if (del || !isTeamPerson(row.person)) return;
    const p = row.person;
    const id = Number(row.last_seen_id) || 0;
    set((s) => ({ marks: { ...s.marks, [p]: Math.max(s.marks[p] ?? 0, id) } }));
    return;
  }
  if (table === "team_acks") {
    const a = patchAckKey(row as unknown as TeamAck);
    if (!isTeamPerson(a.person)) return;
    set((s) => ({ acks: withAck(s.acks, a, !del) }));
    return;
  }
  if (table === "team_reactions") {
    const r = row as unknown as TeamReaction;
    if (!isTeamPerson(r.person) || !isReaction(r.emoji)) return;
    set((s) => ({ reactions: withReaction(s.reactions, { ...r, message_id: Number(r.message_id) }, !del) }));
    return;
  }
  if (table === "team_status") {
    if (!isTeamPerson(row.person)) return;
    const who = row.person;
    set((s) => {
      const statuses = { ...s.statuses };
      if (del) delete statuses[who]; else statuses[who] = cleanStatus(row, who);
      return { statuses };
    });
    return;
  }
  if (table === "team_welcome") {
    if (!del) set({ welcome: cleanWelcome(row) });
    return;
  }
  if (table === "team_welcome_reads") {
    if (del || !isTeamPerson(row.person)) return;
    const r: WelcomeRead = { person: row.person, version: Number(row.version), at: String(row.at ?? new Date().toISOString()) };
    set((s) => ({ welcomeReads: [...s.welcomeReads.filter((x) => !(x.person === r.person && x.version === r.version)), r] }));
    return;
  }
  if (table === "team_bug_marks") {
    const m = cleanMark(row);
    const id = Number(row.post_id);
    set((s) => ({ bugMarks: [...s.bugMarks.filter((x) => x.post_id !== id), ...(del || !m ? [] : [m])] }));
    return;
  }
  if (table === "team_channels") {
    const r = row as unknown as ChannelRow;
    if (!isSlug(r.slug)) return;
    set((s) => {
      const rest = s.channelRows.filter((x) => x.slug !== r.slug);
      return { channelRows: del ? rest : [...rest, r] };
    });
    return;
  }
  const key = ({ team_messages: "messages", team_ideas: "ideas", team_tasks: "tasks", team_notes: "notes", team_dms: "dms", team_bot_posts: "botRows" } as const)[table as "team_messages"];
  if (!key) return;
  set((s) => {
    const list = s[key] as { id: number }[];
    const id = Number(row.id);
    const r = (key as string) === "notes" ? patchNoteKey(row as unknown as TeamNote) : row;
    return { [key]: del ? list.filter((x) => x.id !== id) : upsertById(list, r as unknown as { id: number }) } as Partial<TeamRoomState>;
  });
}

function connect() {
  if (!sb || channel) return;
  const ch = sb.channel("team-room", { config: { presence: { key: userId ?? "anon" } } });
  // Round two's tables join the live link only once they exist: a channel
  // asked to follow a missing table can refuse the whole subscription.
  const tables = ["team_messages", "team_ideas", "team_idea_votes", "team_tasks", "team_notes"];
  if (state.v2 === "on") tables.push("team_read_marks", "team_acks");
  if (state.v3 === "on") tables.push("team_channels", "team_reactions", "team_dms", "team_bot_posts");
  if (state.v4 === "on") tables.push("team_status", "team_welcome", "team_welcome_reads", "team_bug_marks");
  for (const table of tables) {
    ch.on("postgres_changes" as never, { event: "*", schema: "public", table } as never, (p: Change) => apply(table, p));
  }
  // Presence (plan U0.2): "active" = the room is open and used in the last 10 minutes;
  // a tab that is hidden or idle says active: false. Online = active people only (green).
  ch.on("presence", { event: "sync" }, () => {
    const ps = ch.presenceState() as Record<string, { person?: string; active?: boolean }[]>;
    const on = new Set<TeamPerson>();
    Object.values(ps).forEach((arr) => arr.forEach((x) => { if (isTeamPerson(x.person) && x.active !== false) on.add(x.person); }));
    set({ online: Array.from(on) });
  });
  ch.subscribe((s: string) => {
    set({ live: s === "SUBSCRIBED" });
    if (s === "SUBSCRIBED" && state.me) ch.track({ person: state.me, active: isActive() });
  });
  channel = ch;
  watchActivity();
  // If the live link drops, catch up once a minute (like the team board).
  poll = setInterval(() => { if (!state.live) loadAll(); }, 60_000);
}

/* ── Active or away (Slack's rule: away after 10 minutes idle, or the tab hidden) ── */
let lastInput = Date.now();
let activeNow = true;
let watching = false;
const isActive = () => typeof document !== "undefined" && document.visibilityState === "visible" && Date.now() - lastInput < AWAY_AFTER_MS;
function watchActivity() {
  if (watching || typeof window === "undefined") return;
  watching = true;
  const bump = () => { lastInput = Date.now(); recheck(); };
  for (const ev of ["pointerdown", "keydown", "wheel", "touchstart"]) window.addEventListener(ev, bump, { passive: true });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") lastInput = Date.now(); recheck(); });
  setInterval(recheck, 30_000);
}
function recheck() {
  const a = isActive();
  if (a === activeNow) return;
  activeNow = a;
  if (channel && state.me) channel.track({ person: state.me, active: a });
  if (demo && state.me) set((s) => ({ online: a ? Array.from(new Set([...s.online, s.me!])) : s.online.filter((p) => p !== s.me) }));
}

/** A dev build with no database or no sign-in plays with sample rows, kept in this tab only. */
let demo = false;
let demoId = 1000;
// Read when the page first loads: pages tidy their address before the room starts.
const DEMO_NO_V2 = typeof window !== "undefined" && /[?&]teamroom=nov2\b/.test(window.location.search);
// ?teamroom=nov3 shows the screens as they are before team_room_v3.sql runs.
const DEMO_NO_V3 = typeof window !== "undefined" && /[?&]teamroom=nov3\b/.test(window.location.search);
// ?teamroom=nov4 shows the screens before team_room_v4.sql runs; ?teamroom=welcome shows the first-open note.
const DEMO_NO_V4 = typeof window !== "undefined" && /[?&]teamroom=nov4\b/.test(window.location.search);
const DEMO_WELCOME = typeof window !== "undefined" && /[?&]teamroom=welcome\b/.test(window.location.search);
function startDemo() {
  demo = true;
  sb = null;
  const room = demoRoom(Date.now());
  // ?teamroom=nov2 shows the screens as they are before team_room_v2.sql runs.
  const noV2 = DEMO_NO_V2;
  set({ ...room, status: "ready", live: true, read: loadRead(), v2: noV2 ? "off" : "on", v3: DEMO_NO_V3 ? "off" : "on", v4: DEMO_NO_V4 ? "off" : "on", chRead: readJson<ChannelReads>(CH_READ_KEY, room.chRead) });
  if (DEMO_NO_V3) set({ channelRows: [], reactions: [], dms: [], botRows: [] });
  if (DEMO_NO_V4) set({ statuses: {}, welcome: null, welcomeReads: [], bugMarks: [], botRows: room.botRows.filter((r) => r.bot !== "bug") });
  // ?teamroom=welcome shows the first-open note as a new reader would see it.
  if (DEMO_WELCOME) set({ welcomeReads: [] });
  loadBells();
  watchActivity();
  if (noV2) set({ ...localV2(), notes: [...room.notes, ...readJson<TeamNote[]>(LOCAL_NOTES_KEY, [])].map(patchNoteKey) });
}

export function startTeamRoom() {
  if (started || typeof window === "undefined") return;
  started = true;
  set({ status: "loading", read: loadRead(), seenJobs: readJson<string[]>(SEEN_JOBS_KEY, []), chRead: readJson<ChannelReads>(CH_READ_KEY, {}) });
  loadJobs();
  jobsPoll = setInterval(loadJobs, TEAM_ROOM.jobs.refreshMs);
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) { if (offlineDevPlayEnabled()) startDemo(); else set({ status: "error", error: "No database address set." }); return; }
  sb = createClient();
  sb.auth.getUser().then(async ({ data }) => {
    if (!data.user && offlineDevPlayEnabled()) { startDemo(); return; }
    if (!data.user) { set({ status: "signedOut" }); return; }
    userId = data.user.id;
    if (await loadAll()) connect();
  }).catch(() => set({ status: "error", error: "Could not reach the database." }));
}

/** For tests and sign-out: forget everything. */
export function stopTeamRoom() {
  if (channel && sb) sb.removeChannel(channel);
  if (poll) clearInterval(poll);
  if (jobsPoll) clearInterval(jobsPoll);
  channel = null; poll = null; jobsPoll = null; started = false;
}

export function useTeamRoom(): TeamRoomState {
  return useSyncExternalStore(
    (l) => { listeners.add(l); startTeamRoom(); return () => listeners.delete(l); },
    () => state,
    () => state,
  );
}

export function markRead(part: keyof TeamRoomState["read"]) {
  const read = { ...state.read, [part]: Date.now() };
  try { localStorage.setItem(READ_KEY, JSON.stringify(read)); } catch { /* private mode */ }
  set({ read });
}
export const setChatPageOpen = (open: boolean) => set({ pageOpen: open });

// ── Writes ────────────────────────────────────────────────────────────────
type Result = { ok: true } | { ok: false; error: string };
const fail = (e: { message?: string } | null, plain: string): Result => ({ ok: false, error: e?.message ? `${plain} (${e.message})` : plain });

async function insert<T extends { id: number }>(table: string, key: "messages" | "ideas" | "tasks" | "notes", row: Record<string, unknown>, plain: string): Promise<Result> {
  if (demo) {
    const now = new Date().toISOString();
    const full = { id: ++demoId, created_at: now, updated_at: now, pinned: false, image_url: null, page: null, done_at: null, stage: "idea", ...row } as unknown as T;
    set((s) => ({ [key]: upsertById(s[key] as unknown as T[], full) }) as Partial<TeamRoomState>);
    return { ok: true };
  }
  if (!sb) return { ok: false, error: "Not connected yet." };
  const { data, error } = await sb.from(table).insert(row).select().single();
  if (error) return fail(error, plain);
  set((s) => ({ [key]: upsertById(s[key] as unknown as T[], data as T) }) as Partial<TeamRoomState>);
  // An @name, a reply, a point or a job given: ring their phone (lib/teamRoom/push.ts).
  if (table === "team_messages" || table === "team_tasks" || table === "team_notes") ringAfter(table, data as Record<string, unknown>);
  return { ok: true };
}

export async function claimName(person: TeamPerson): Promise<Result> {
  if (demo) { set({ me: person }); return { ok: true }; }
  if (!sb || !userId) return { ok: false, error: "Sign in first." };
  const { error } = await sb.from("team_members").insert({ user_id: userId, person });
  if (error) return fail(error, error.code === "23505" ? `${person} is already taken by another account.` : "Could not save your name.");
  set({ me: person });
  if (state.v2 === "off") set(localV2());
  channel?.track({ person });
  return { ok: true };
}

export async function sendMessage(body: string, file: File | null, page: string | null): Promise<Result> {
  if (!state.me) return { ok: false, error: "Pick your name first." };
  let image_url: string | null = null;
  if (file && demo) image_url = URL.createObjectURL(file);
  if (file && sb && !demo) {
    try {
      const small = await compressImage(file);
      const path = `${TEAM_ROOM.imageFolder}/${crypto.randomUUID()}.webp`;
      const up = await sb.storage.from(TEAM_ROOM.imageBucket).upload(path, small, { contentType: "image/webp", upsert: false });
      if (up.error) return fail(up.error, "The picture didn't upload.");
      image_url = sb.storage.from(TEAM_ROOM.imageBucket).getPublicUrl(up.data.path).data.publicUrl;
    } catch { return { ok: false, error: "That picture could not be read." }; }
  }
  const text = body.trim().slice(0, 2000);
  if (!text && !image_url) return { ok: false, error: "Type something first." };
  // (Read marks are per channel now: the open channel marks itself read, channels.ts.)
  return insert("team_messages", "messages", { person: state.me, body: text, image_url, page: page?.slice(0, 200) ?? null }, "Message not sent.");
}

export async function setPinned(id: number, pinned: boolean): Promise<Result> {
  if (!sb && !demo) return { ok: false, error: "Not connected yet." };
  const { error } = demo ? { error: null } : await sb!.from("team_messages").update({ pinned }).eq("id", id);
  if (error) return fail(error, "Could not pin it.");
  set((s) => ({ messages: s.messages.map((m) => (m.id === id ? { ...m, pinned } : m)) }));
  return { ok: true };
}

async function remove(table: string, key: "messages" | "ideas" | "tasks" | "notes", id: number, plain: string): Promise<Result> {
  if (!sb && !demo) return { ok: false, error: "Not connected yet." };
  const { error } = demo ? { error: null } : await sb!.from(table).delete().eq("id", id);
  if (error) return fail(error, plain);
  set((s) => ({ [key]: (s[key] as { id: number }[]).filter((x) => x.id !== id) }) as Partial<TeamRoomState>);
  return { ok: true };
}
export const deleteMessage = (id: number) => remove("team_messages", "messages", id, "Could not delete it.");

export function addIdea(title: string): Promise<Result> {
  const t = title.trim().slice(0, 140);
  if (!t) return Promise.resolve({ ok: false, error: "Type the idea first." });
  if (!state.me) return Promise.resolve({ ok: false, error: "Pick your name first." });
  return insert("team_ideas", "ideas", { person: state.me, title: t }, "Idea not saved.");
}
export async function moveIdea(id: number, stage: IdeaStage): Promise<Result> {
  if (!sb && !demo) return { ok: false, error: "Not connected yet." };
  const updated_at = new Date().toISOString();
  const { error } = demo ? { error: null } : await sb!.from("team_ideas").update({ stage, updated_at }).eq("id", id);
  if (error) return fail(error, "Could not move it.");
  set((s) => ({ ideas: s.ideas.map((i) => (i.id === id ? { ...i, stage, updated_at } : i)) }));
  return { ok: true };
}
export const deleteIdea = (id: number) => remove("team_ideas", "ideas", id, "Could not delete it.");

export async function toggleVote(ideaId: number): Promise<Result> {
  if ((!sb && !demo) || !state.me) return { ok: false, error: "Pick your name first." };
  const me = state.me;
  const has = state.votes.some((v) => v.idea_id === ideaId && v.person === me);
  const { error } = demo ? { error: null as null | { code?: string; message?: string } } : has
    ? await sb!.from("team_idea_votes").delete().eq("idea_id", ideaId).eq("person", me)
    : await sb!.from("team_idea_votes").insert({ idea_id: ideaId, person: me });
  if (error && error.code !== "23505") return fail(error, "Vote not saved.");
  set((s) => {
    const rest = s.votes.filter((v) => !(v.idea_id === ideaId && v.person === me));
    return { votes: has ? rest : [...rest, { idea_id: ideaId, person: me }] };
  });
  return { ok: true };
}

export function addTask(title: string, owner: TeamPerson | null): Promise<Result> {
  const t = title.trim().slice(0, 200);
  if (!t) return Promise.resolve({ ok: false, error: "Type the job first." });
  if (!state.me) return Promise.resolve({ ok: false, error: "Pick your name first." });
  return insert("team_tasks", "tasks", { owner: owner ?? state.me, made_by: state.me, title: t }, "Job not saved.");
}
export async function tickTask(id: number, done: boolean): Promise<Result> {
  if (!sb && !demo) return { ok: false, error: "Not connected yet." };
  const done_at = done ? new Date().toISOString() : null;
  const { error } = demo ? { error: null } : await sb!.from("team_tasks").update({ done_at }).eq("id", id);
  if (error) return fail(error, "Could not tick it.");
  set((s) => ({ tasks: s.tasks.map((x) => (x.id === id ? { ...x, done_at } : x)) }));
  return { ok: true };
}
export const deleteTask = (id: number) => remove("team_tasks", "tasks", id, "Could not delete it.");

/**
 * Tick (or untick) a pushed job. The job lives in the repo; the tick is your
 * own team_tasks row "[job:<id>] <title>", made on the first tick (the table's
 * rules want a new row not done, so it is made, then ticked). Unticking
 * clears its done_at. No new table, no SQL.
 */
export async function tickJob(job: Pick<TeamJob, "id" | "title">, done: boolean): Promise<Result> {
  const me = state.me;
  if (!me) return { ok: false, error: "Pick your name first." };
  if (!sb && !demo) return { ok: false, error: "Not connected yet." };
  const done_at = done ? new Date().toISOString() : null;
  const ids = state.tasks.filter((x) => x.owner === me && x.made_by === me && markerJobId(x) === job.id).map((x) => x.id);
  const mark = (id: number[]) => set((s) => ({ tasks: s.tasks.map((x) => (id.includes(x.id) ? { ...x, done_at } : x)) }));
  if (ids.length) {
    if (!demo) {
      const { error } = await sb!.from("team_tasks").update({ done_at }).in("id", ids);
      if (error) return fail(error, done ? "Could not tick it." : "Could not untick it.");
    }
    mark(ids);
    return { ok: true };
  }
  if (!done) return { ok: true };
  const row = { owner: me, made_by: me, title: markerTitle(job) };
  if (demo) {
    set((s) => ({ tasks: upsertById(s.tasks, { id: ++demoId, ...row, done_at, created_at: new Date().toISOString() }) }));
    return { ok: true };
  }
  const made = await sb!.from("team_tasks").insert(row).select().single();
  if (made.error) return fail(made.error, "Could not tick it.");
  const id = (made.data as TeamTask).id;
  set((s) => ({ tasks: upsertById(s.tasks, made.data as TeamTask) }));
  const { error } = await sb!.from("team_tasks").update({ done_at }).eq("id", id);
  if (error) return fail(error, "Could not tick it.");
  mark([id]);
  return { ok: true };
}

/** The To-do had these pushed jobs on screen: they stop counting in the badge (this browser). */
export function markJobsSeen(ids: string[]) {
  const fresh = ids.filter((id) => !state.seenJobs.includes(id));
  if (!fresh.length) return;
  const seenJobs = [...state.seenJobs, ...fresh].slice(-500);
  writeJson(SEEN_JOBS_KEY, seenJobs);
  set({ seenJobs });
}

export async function addNote(kind: NoteKind, targetId: string | number, owner: TeamPerson | null, body: string): Promise<Result> {
  const b = body.trim().slice(0, 1000);
  if (!b) return { ok: false, error: "Type the note first." };
  if (!state.me) return { ok: false, error: "Pick your name first." };
  const row = { target_kind: kind, target_id: String(targetId), owner, person: state.me, body: b };
  // Patch-note notes need team_room_v2.sql (it adds "patch" to the allowed kinds).
  // Until it runs, the note is kept in this browser and the thread says so.
  if (kind === "patch" && state.v2 === "off") return saveLocalNote(row);
  const r = await insert("team_notes", "notes", row, "Note not saved.");
  if (!r.ok && kind === "patch" && /check constraint|violates|23514/i.test(r.error)) return saveLocalNote(row);
  return r;
}
function saveLocalNote(row: Omit<TeamNote, "id" | "created_at">): Result {
  const local = readJson<TeamNote[]>(LOCAL_NOTES_KEY, []);
  const note: TeamNote = { ...row, id: -(Date.now() % 1e9), created_at: new Date().toISOString() } as TeamNote;
  writeJson(LOCAL_NOTES_KEY, [...local, note].slice(-200));
  set((s) => ({ notes: [...s.notes, note] }));
  return { ok: true };
}

// ── Round two: seen marks, "Got it", point mode ─────────────────────────
let seenTimer: ReturnType<typeof setTimeout> | null = null;
let seenWant = 0;
/**
 * The open chat had message `id` on screen. Saved a moment later (one write
 * per burst of scrolling) and never goes backwards.
 */
export function markSeen(id: number) {
  const me = state.me;
  if (!me || !Number.isFinite(id) || id <= 0) return;
  if ((state.marks[me] ?? 0) >= id || seenWant >= id) return;
  seenWant = id;
  set((s) => ({ marks: { ...s.marks, [me]: Math.max(s.marks[me] ?? 0, id) } }));
  if (seenTimer) return;
  seenTimer = setTimeout(async () => {
    seenTimer = null;
    const want = seenWant;
    if (demo) return;
    if (state.v2 !== "on" || !sb) { writeJson(SEEN_KEY, Math.max(readJson<number>(SEEN_KEY, 0), want)); return; }
    const { error } = await sb.from("team_read_marks").upsert({ person: me, last_seen_id: want, at: new Date().toISOString() }, { onConflict: "person" });
    if (error) { writeJson(SEEN_KEY, Math.max(readJson<number>(SEEN_KEY, 0), want)); console.warn("Seen mark kept on this device:", error.message); }
  }, 900);
}

/** "Got it" on a point, or "Read and understood" on a patch note (on = true), or take it back. */
export async function setAck(kind: AckKind, target: string, on: boolean): Promise<Result> {
  const me = state.me;
  if (!me) return { ok: false, error: "Pick your name first." };
  const a: TeamAck = { kind, target: target.slice(0, 80), person: me, at: new Date().toISOString() };
  if (!demo && state.v2 === "on" && sb) {
    const { error } = on
      ? await sb.from("team_acks").upsert(a, { onConflict: "kind,target,person" })
      : await sb.from("team_acks").delete().eq("kind", a.kind).eq("target", a.target).eq("person", me);
    if (error) return fail(error, on ? "Not saved." : "Could not take it back.");
  } else if (!demo) {
    writeJson(ACKS_KEY, withAck(readJson<TeamAck[]>(ACKS_KEY, []), a, on));
  }
  set((s) => ({ acks: withAck(s.acks, a, on) }));
  return { ok: true };
}

/** The current state, without subscribing (key handlers). */
export const teamRoomState = () => state;
export const startPointing = () => set({ pointing: true });
export const stopPointing = () => set({ pointing: false });

/** For sending a point from outside a chat thread. */
export async function sendText(body: string): Promise<Result> {
  if (!state.me) return { ok: false, error: "Pick your name first." };
  const text = body.trim().slice(0, 2000);
  if (!text) return { ok: false, error: "Type something first." };
  return insert("team_messages", "messages", { person: state.me, body: text, image_url: null, page: typeof window === "undefined" ? null : (window.location.pathname + window.location.search).slice(0, 200) }, "Not sent.");
}
export async function deleteNote(id: number): Promise<Result> {
  if (id < 0) { // kept on this device only (see saveLocalNote)
    writeJson(LOCAL_NOTES_KEY, readJson<TeamNote[]>(LOCAL_NOTES_KEY, []).filter((n) => n.id !== id));
    set((s) => ({ notes: s.notes.filter((n) => n.id !== id) }));
    return { ok: true };
  }
  return remove("team_notes", "notes", id, "Could not delete it.");
}

// ── Round three: channels, reactions, private DMs ──────────────────────
const V3_NOTE = `Run ${TEAM_ROOM.sqlFileV3} once in the Supabase SQL Editor first.`;

/** A channel or DM was on screen up to message `id` (this browser). Never goes backwards. */
export function markChannelRead(key: string, id: number) {
  if (!key || !Number.isFinite(id) || id <= 0 || (state.chRead[key] ?? 0) >= id) return;
  const chRead = { ...state.chRead, [key]: id };
  writeJson(CH_READ_KEY, chRead);
  set({ chRead });
}

/** A new channel, named by you. Needs team_room_v3.sql. */
export async function addChannel(name: string, topic = ""): Promise<Result & { slug?: string }> {
  if (!state.me) return { ok: false, error: "Pick your name first." };
  if (state.v3 !== "on") return { ok: false, error: V3_NOTE };
  const made = newChannelSlug(name, listChannels(state.channelRows));
  if (!made.ok) return made;
  const row: ChannelRow = { slug: made.slug, name: made.name, topic: topic.trim().slice(0, 140) || null, made_by: state.me, created_at: new Date().toISOString() };
  if (!demo) {
    if (!sb) return { ok: false, error: "Not connected yet." };
    const { error } = await sb.from("team_channels").insert({ slug: row.slug, name: row.name, topic: row.topic, made_by: row.made_by });
    if (error) return fail(error, error.code === "23505" ? `#${row.slug} already exists.` : "Channel not made.");
  }
  set((s) => ({ channelRows: [...s.channelRows.filter((x) => x.slug !== row.slug), row] }));
  return { ok: true, slug: row.slug };
}

/** Rename a channel (the six built-in ones too). Its messages stay: they are kept by its slug. */
export async function renameChannel(slug: string, name: string, topic?: string): Promise<Result> {
  if (!state.me) return { ok: false, error: "Pick your name first." };
  if (state.v3 !== "on") return { ok: false, error: V3_NOTE };
  const nm = cleanName(name);
  if (!nm) return { ok: false, error: "Type a name first." };
  const had = state.channelRows.find((x) => x.slug === slug);
  const row: ChannelRow = { slug, name: nm, topic: topic === undefined ? had?.topic ?? null : topic.trim().slice(0, 140) || null, made_by: had?.made_by ?? state.me, created_at: had?.created_at ?? new Date().toISOString() };
  if (!demo) {
    if (!sb) return { ok: false, error: "Not connected yet." };
    const { error } = had
      ? await sb.from("team_channels").update({ name: row.name, topic: row.topic }).eq("slug", slug)
      : await sb.from("team_channels").insert({ slug, name: row.name, topic: row.topic, made_by: state.me });
    if (error) return fail(error, "Not renamed.");
  }
  set((s) => ({ channelRows: [...s.channelRows.filter((x) => x.slug !== slug), row] }));
  return { ok: true };
}

/** Tap a reaction: add yours, or take it back. Needs team_room_v3.sql. */
export async function toggleReaction(messageId: number, emoji: Reaction): Promise<Result> {
  const me = state.me;
  if (!me) return { ok: false, error: "Pick your name first." };
  if (state.v3 !== "on") return { ok: false, error: V3_NOTE };
  const has = state.reactions.some((r) => r.message_id === messageId && r.emoji === emoji && r.person === me);
  const r: TeamReaction = { message_id: messageId, emoji, person: me, at: new Date().toISOString() };
  if (!demo) {
    if (!sb) return { ok: false, error: "Not connected yet." };
    const { error } = has
      ? await sb.from("team_reactions").delete().eq("message_id", messageId).eq("emoji", emoji).eq("person", me)
      : await sb.from("team_reactions").insert({ message_id: messageId, emoji, person: me });
    if (error && error.code !== "23505") return fail(error, "Reaction not saved.");
  }
  set((s) => ({ reactions: withReaction(s.reactions, r, !has) }));
  return { ok: true };
}

/** A private message to one person. Only the two of you can read it (row rules in team_room_v3.sql). */
export async function sendDm(to: TeamPerson, body: string): Promise<Result> {
  const me = state.me;
  if (!me) return { ok: false, error: "Pick your name first." };
  if (to === me) return { ok: false, error: "Pick someone else." };
  if (state.v3 !== "on") return { ok: false, error: V3_NOTE };
  const text = body.trim().slice(0, 2000);
  if (!text) return { ok: false, error: "Type something first." };
  const row = { from_person: me, to_person: to, body: text };
  if (demo) {
    set((s) => ({ dms: upsertById(s.dms, { id: ++demoId, ...row, created_at: new Date().toISOString() }) }));
    return { ok: true };
  }
  if (!sb) return { ok: false, error: "Not connected yet." };
  const { data, error } = await sb.from("team_dms").insert(row).select().single();
  if (error) return fail(error, "Message not sent.");
  set((s) => ({ dms: upsertById(s.dms, data as TeamDm) }));
  ringAfter("team_dms", data as Record<string, unknown>);
  return { ok: true };
}

export async function deleteDm(id: number): Promise<Result> {
  if (!demo) {
    if (!sb) return { ok: false, error: "Not connected yet." };
    const { error } = await sb.from("team_dms").delete().eq("id", id);
    if (error) return fail(error, "Could not delete it.");
  }
  set((s) => ({ dms: s.dms.filter((d) => d.id !== id) }));
  return { ok: true };
}

// ── Round four: status, do not disturb, schedules, bells, the first-open note, bug marks ──
const V4_NOTE = `Run ${TEAM_ROOM.sqlFileV4} once in the Supabase SQL Editor first.`;

/** Change your own status row (emoji, words, clear after, do not disturb, schedules). Kept on this device until team_room_v4.sql runs. */
export async function saveStatus(patch: Partial<Pick<StatusRow, "emoji" | "text" | "clear_at" | "dnd_until" | "schedules">>): Promise<Result> {
  const me = state.me;
  if (!me) return { ok: false, error: "Pick your name first." };
  const tz = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || null; } catch { return null; } })();
  const had = state.statuses[me];
  const row = cleanStatus({ ...(had ?? {}), ...patch, tz, updated_at: new Date().toISOString() } as Record<string, unknown>, me);
  if (!demo && state.v4 === "on" && sb) {
    const { error } = await sb.from("team_status").upsert({
      person: me, emoji: row.emoji, text: row.text, clear_at: row.clear_at, dnd_until: row.dnd_until, schedules: row.schedules, tz: row.tz, updated_at: row.updated_at,
    }, { onConflict: "person" });
    if (error) return fail(error, "Status not saved.");
  } else if (!demo) {
    writeJson(STATUS_KEY, row);
  }
  set((s) => ({ statuses: { ...s.statuses, [me]: row } }));
  return { ok: true };
}

async function saveBells(bells: BellPrefs): Promise<Result> {
  set({ bells });
  if (demo || !sb) { writeJson(BELLS_LOCAL_KEY, bells); return { ok: true }; }
  // Supabase merges this into user_metadata: the other keys (name, picture, devices) stay.
  const { error } = await sb.auth.updateUser({ data: { [BELLS_KEY]: bells } });
  if (error) return fail(error, "Not saved.");
  return { ok: true };
}
/** Set one channel's 🔔: every message, only @mentions, off (or only red in #health). */
export const setBell = (slug: string, bell: Bell) => saveBells(withBell(state.bells, slug, bell));
/** Mute one channel for a while (null = unmute). */
export const muteChannel = (slug: string, ms: number | null) => saveBells(withMute(state.bells, slug, ms ? new Date(Date.now() + ms).toISOString() : null, Date.now()));

/** Harry saves the note (one message for everyone, a line per person). "Show again" opens it once more for everyone, marked UPDATED. */
export async function saveWelcome(body: string, lines: Partial<Record<TeamPerson, string>>, showAgain: boolean): Promise<Result> {
  if (state.me !== WELCOME_EDITOR) return { ok: false, error: `Only ${WELCOME_EDITOR} edits this.` };
  if (state.v4 !== "on") return { ok: false, error: V4_NOTE };
  const row = cleanWelcome({ body: body.trim(), lines, version: nextVersion(state.welcome, showAgain), updated_at: new Date().toISOString(), updated_by: state.me });
  if (!row) return { ok: false, error: "Not saved." };
  if (!demo) {
    if (!sb) return { ok: false, error: "Not connected yet." };
    const { error } = await sb.from("team_welcome").upsert({ id: 1, body: row.body, lines: row.lines, version: row.version, updated_at: row.updated_at, updated_by: row.updated_by }, { onConflict: "id" });
    if (error) return fail(error, "Not saved.");
  }
  // The editor has read their own words.
  set((s) => ({ welcome: row, welcomeReads: [...s.welcomeReads.filter((r) => !(r.person === WELCOME_EDITOR && r.version === row.version)), { person: WELCOME_EDITOR, version: row.version, at: row.updated_at }] }));
  if (!demo && sb) await sb.from("team_welcome_reads").upsert({ person: WELCOME_EDITOR, version: row.version }, { onConflict: "person,version" });
  return { ok: true };
}

/** "Got it" on the note. */
export async function readWelcome(version: number): Promise<Result> {
  const me = state.me;
  if (!me) return { ok: false, error: "Pick your name first." };
  const r: WelcomeRead = { person: me, version, at: new Date().toISOString() };
  set((s) => ({ welcomeReads: [...s.welcomeReads.filter((x) => !(x.person === me && x.version === version)), r] }));
  if (!demo && sb && state.v4 === "on") {
    const { error } = await sb.from("team_welcome_reads").upsert({ person: me, version }, { onConflict: "person,version" });
    if (error) return fail(error, "Not saved.");
  }
  return { ok: true };
}

/** Hand a bug report to someone (it also makes a #todo task for them), or mark it fixed / not fixed. */
export async function markBug(postId: number, change: { handTo?: TeamPerson | null; fixed?: boolean }): Promise<Result> {
  const me = state.me;
  if (!me) return { ok: false, error: "Pick your name first." };
  if (state.v4 !== "on") return { ok: false, error: V4_NOTE };
  const had = state.bugMarks.find((m) => m.post_id === postId);
  const now = new Date().toISOString();
  const mark: BugMark = {
    post_id: postId,
    handed_to: change.handTo !== undefined ? change.handTo : had?.handed_to ?? null,
    fixed_by: change.fixed === undefined ? had?.fixed_by ?? null : change.fixed ? me : null,
    fixed_at: change.fixed === undefined ? had?.fixed_at ?? null : change.fixed ? now : null,
    updated_by: me, updated_at: now,
  };
  if (!demo) {
    if (!sb) return { ok: false, error: "Not connected yet." };
    const { error } = await sb.from("team_bug_marks").upsert(mark, { onConflict: "post_id" });
    if (error) return fail(error, "Not saved.");
  }
  set((s) => ({ bugMarks: [...s.bugMarks.filter((m) => m.post_id !== postId), mark] }));
  return { ok: true };
}
