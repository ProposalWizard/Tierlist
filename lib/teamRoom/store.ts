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
 */
import { useSyncExternalStore } from "react";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/imageUtils";
import { offlineDevPlayEnabled } from "@/lib/star/devMode";
import { demoRoom } from "./demo";
import { TEAM_ROOM, isTeamPerson, type TeamPerson } from "./config";
import {
  upsertById, type IdeaStage, type NoteKind, type TeamIdea, type TeamMessage, type TeamNote, type TeamTask, type TeamVote,
} from "./logic";

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
  read: { chat: number; tasks: number; notes: number; pushNotes: number };
  /** The full chat page is on screen (the bubble hides). */
  pageOpen: boolean;
}

const READ_KEY = "kib-team-read";
function loadRead(): TeamRoomState["read"] {
  try {
    const j = JSON.parse(localStorage.getItem(READ_KEY) ?? "{}");
    return { chat: +j.chat || 0, tasks: +j.tasks || 0, notes: +j.notes || 0, pushNotes: +j.pushNotes || 0 };
  } catch { return { chat: 0, tasks: 0, notes: 0, pushNotes: 0 }; }
}

let state: TeamRoomState = {
  status: "idle", error: null, me: null, taken: [], messages: [], ideas: [], votes: [], tasks: [], notes: [],
  online: [], live: false, read: { chat: 0, tasks: 0, notes: 0, pushNotes: 0 }, pageOpen: false,
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
    notes: (not.data ?? []) as TeamNote[],
  });
  return true;
}

type Change = { eventType: "INSERT" | "UPDATE" | "DELETE"; new: Record<string, unknown>; old: Record<string, unknown> };
function apply(table: string, c: Change) {
  const row = (c.eventType === "DELETE" ? c.old : c.new) as Record<string, unknown>;
  const del = c.eventType === "DELETE";
  if (table === "team_idea_votes") {
    const v = row as unknown as TeamVote;
    set((s) => {
      const rest = s.votes.filter((x) => !(x.idea_id === v.idea_id && x.person === v.person));
      return { votes: del ? rest : [...rest, { idea_id: v.idea_id, person: v.person }] };
    });
    return;
  }
  const key = ({ team_messages: "messages", team_ideas: "ideas", team_tasks: "tasks", team_notes: "notes" } as const)[table as "team_messages"];
  if (!key) return;
  set((s) => {
    const list = s[key] as { id: number }[];
    const id = Number(row.id);
    return { [key]: del ? list.filter((x) => x.id !== id) : upsertById(list, row as unknown as { id: number }) } as Partial<TeamRoomState>;
  });
}

function connect() {
  if (!sb || channel) return;
  const ch = sb.channel("team-room", { config: { presence: { key: userId ?? "anon" } } });
  for (const table of ["team_messages", "team_ideas", "team_idea_votes", "team_tasks", "team_notes"]) {
    ch.on("postgres_changes" as never, { event: "*", schema: "public", table } as never, (p: Change) => apply(table, p));
  }
  ch.on("presence", { event: "sync" }, () => {
    const ps = ch.presenceState() as Record<string, { person?: string }[]>;
    const on = new Set<TeamPerson>();
    Object.values(ps).forEach((arr) => arr.forEach((x) => { if (isTeamPerson(x.person)) on.add(x.person); }));
    set({ online: Array.from(on) });
  });
  ch.subscribe((s: string) => {
    set({ live: s === "SUBSCRIBED" });
    if (s === "SUBSCRIBED" && state.me) ch.track({ person: state.me });
  });
  channel = ch;
  // If the live link drops, catch up once a minute (like the team board).
  poll = setInterval(() => { if (!state.live) loadAll(); }, 60_000);
}

/** A dev build with no database or no sign-in plays with sample rows, kept in this tab only. */
let demo = false;
let demoId = 1000;
function startDemo() {
  demo = true;
  sb = null;
  set({ ...demoRoom(Date.now()), status: "ready", live: true, read: loadRead() });
}

export function startTeamRoom() {
  if (started || typeof window === "undefined") return;
  started = true;
  set({ status: "loading", read: loadRead() });
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
  channel = null; poll = null; started = false;
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
  return { ok: true };
}

export async function claimName(person: TeamPerson): Promise<Result> {
  if (demo) { set({ me: person }); return { ok: true }; }
  if (!sb || !userId) return { ok: false, error: "Sign in first." };
  const { error } = await sb.from("team_members").insert({ user_id: userId, person });
  if (error) return fail(error, error.code === "23505" ? `${person} is already taken by another account.` : "Could not save your name.");
  set({ me: person });
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
  const r = await insert("team_messages", "messages", { person: state.me, body: text, image_url, page: page?.slice(0, 200) ?? null }, "Message not sent.");
  if (r.ok) markRead("chat");
  return r;
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

export function addNote(kind: NoteKind, targetId: string | number, owner: TeamPerson | null, body: string): Promise<Result> {
  const b = body.trim().slice(0, 1000);
  if (!b) return Promise.resolve({ ok: false, error: "Type the note first." });
  if (!state.me) return Promise.resolve({ ok: false, error: "Pick your name first." });
  return insert("team_notes", "notes", { target_kind: kind, target_id: String(targetId), owner, person: state.me, body: b }, "Note not saved.");
}
export const deleteNote = (id: number) => remove("team_notes", "notes", id, "Could not delete it.");
