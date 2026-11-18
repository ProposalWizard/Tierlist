/**
 * WHERE GOAL RECORDINGS ARE KEPT ON THE PHONE — lib/star/goalClip/store.ts's
 * rules (the website keeps them in the browser's IndexedDB) on the phone's own
 * storage (MMKV, its own file, never in the career save):
 *   - kept as lib/star/goalClip/track.ts trackToStored writes them (~15 KB);
 *   - the newest KEEP_CLIPS (80), plus any a saved replay or a recent goal
 *     points at (app/star-dev/page.tsx handleGoalClip's prune);
 *   - everything also in memory for the session, so a goal recorded a moment
 *     ago plays straight away.
 * The same calls as the lib's store: putClip, getClip, getClips, pruneClips, listClips.
 * In the headless tools (no MMKV) it is memory only.
 */
import { trackFromStored, trackToStored, type GoalTrack } from "@/lib/star/goalClip/track";
import { KEEP_CLIPS, type ClipListing } from "@/lib/star/goalClip/store";
import type { CareerState } from "@/lib/star/types";

interface Kv { getString(k: string): string | undefined; set(k: string, v: string): void; remove(k: string): void }
let kv: Kv | null | undefined;
function store(): Kv | null {
  if (kv !== undefined) return kv;
  const g = globalThis as Record<string, unknown>;
  if (g.__KIB_HEADLESS__) return (kv = null);
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createMMKV } = require("react-native-mmkv") as typeof import("react-native-mmkv");
    kv = createMMKV({ id: "knowitball-goal-clips" }) as unknown as Kv;
  } catch { kv = null; }
  return kv;
}

const INDEX = "__index";
const memory = new Map<string, GoalTrack>();
type Row = { id: string; createdAt: string; scorer: string; minuteLabel: string; home: string; away: string; how?: string };
function readIndex(): Row[] {
  const s = store()?.getString(INDEX);
  if (!s) return [];
  try { return JSON.parse(s) as Row[]; } catch { return []; }
}
function writeIndex(rows: Row[]) { store()?.set(INDEX, JSON.stringify(rows)); }

/** Keep a recording (memory now, the phone's storage at once). */
export async function putClip(track: GoalTrack): Promise<void> {
  memory.set(track.meta.id, track);
  const s = store();
  if (!s) return;
  try {
    s.set(track.meta.id, JSON.stringify(trackToStored(track)));
    const rows = readIndex().filter((r) => r.id !== track.meta.id);
    const m = track.meta;
    rows.push({ id: m.id, createdAt: m.createdAt, scorer: m.scorer, minuteLabel: m.minuteLabel, home: m.home, away: m.away, how: m.how });
    rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    writeIndex(rows);
  } catch { /* a full store: the clip stays in memory for now */ }
}

export async function getClip(id: string): Promise<GoalTrack | null> {
  const hit = memory.get(id);
  if (hit) return hit;
  const raw = store()?.getString(id);
  if (!raw) return null;
  try {
    const t = trackFromStored(JSON.parse(raw));
    if (t) memory.set(id, t);
    return t;
  } catch { return null; }
}

/** The recordings for these ids that this phone has, in the order asked. */
export async function getClips(ids: string[]): Promise<GoalTrack[]> {
  const out: GoalTrack[] = [];
  for (const id of ids) { const t = await getClip(id); if (t) out.push(t); }
  return out;
}

/** Forget all but the newest `keep`, never one in `protect`. */
export async function pruneClips(protect: Set<string> = new Set(), keep = KEEP_CLIPS): Promise<number> {
  const s = store();
  if (!s) return 0;
  const rows = readIndex();
  const drop = rows.slice(0, Math.max(0, rows.length - keep)).filter((r) => !protect.has(r.id));
  if (!drop.length) return 0;
  const gone = new Set(drop.map((r) => r.id));
  for (const id of gone) { s.remove(id); memory.delete(id); }
  writeIndex(rows.filter((r) => !gone.has(r.id)));
  return drop.length;
}

/** Every recording on this phone, newest first. */
export async function listClips(): Promise<ClipListing[]> {
  const seen = new Map<string, ClipListing>();
  for (const r of readIndex()) seen.set(r.id, r);
  for (const t of memory.values()) {
    if (!seen.has(t.meta.id)) seen.set(t.meta.id, { id: t.meta.id, createdAt: t.meta.createdAt, scorer: t.meta.scorer, minuteLabel: t.meta.minuteLabel, home: t.meta.home, away: t.meta.away, how: t.meta.how });
  }
  return Array.from(seen.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** page.tsx handleGoalClip: keep it, then trim, never a goal a saved replay or a recent goal points at. */
export function keepGoalClip(track: GoalTrack, career: CareerState | null) {
  void putClip(track).then(() => {
    const keep = new Set([...(career?.savedReplays ?? []), ...(career?.recentGoals ?? [])].map((r) => r.clipId).filter((x): x is string => !!x));
    return pruneClips(keep);
  });
}
