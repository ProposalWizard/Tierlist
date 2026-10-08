/**
 * SHARE A CAREER BY CODE, COMPARE WITH A FRIEND (Leo, 6 Oct 2026, the plans
 * page: "Online: share a career, compare with a friend. Friends first. A
 * public board only with cheat checks").
 *
 * A retired career in the Hall of Fame gets a short code — six letters and
 * digits, no look-alikes (no I, O, 0 or 1) — and a link,
 * knowitball.co.uk/legend/K7Q2XM. Anyone with it sees that career, read only,
 * no sign-in, and can compare it with one of their own. Nothing lists every
 * share: there is no board (see supabase/migrations/star_legend_shares.sql).
 *
 * The codes themselves are pure; the three calls go to /api/star/legend.
 */
import type { HallEntry } from "./hallOfFame";
import { sanitizeHallBook } from "./hallOfFame";
import type { CareerOverviewData } from "./careerOverview";

/** The letters a code is made of. */
export const LEGEND_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const LEGEND_CODE = /^[A-HJ-NP-Z2-9]{6}$/;

/** At most this many shared careers per account (8 Oct 2026). */
export const LEGEND_MAX_SHARES = 30;
const HALL_ID = /^hof-[a-z0-9]{1,16}$/;

/**
 * Which Hall career a share request names. The phone sends only the id
 * ({ hallId }); the server copies the career from that account's own Hall
 * (star_hall_of_fame) itself, so a link can't show anything the phone made
 * up on the spot. An older phone's { entry } is read for its id only.
 */
export function shareRequestHallId(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const b = body as { hallId?: unknown; entry?: { id?: unknown } | null };
  const id = typeof b.hallId === "string" ? b.hallId
    : b.entry && typeof b.entry === "object" && typeof b.entry.id === "string" ? b.entry.id
    : null;
  return id && HALL_ID.test(id) ? id : null;
}

/** A new code from any random source (Math.random, or seeded in tests). */
export function newLegendCode(rand: () => number = Math.random): string {
  let s = "";
  for (let i = 0; i < 6; i++) s += LEGEND_ALPHABET[Math.floor(rand() * LEGEND_ALPHABET.length) % LEGEND_ALPHABET.length];
  return s;
}

/**
 * A code from whatever a friend pasted: the code itself (any case, spaces
 * and dashes allowed), or the whole link. Null when there isn't one in it.
 */
export function parseLegendCode(text: string | null | undefined): string | null {
  if (!text) return null;
  const t = text.trim();
  const fromLink = t.match(/legend\/([A-Za-z0-9-]{6,8})/);
  const raw = (fromLink ? fromLink[1] : t).replace(/[\s-]/g, "").toUpperCase();
  return LEGEND_CODE.test(raw) ? raw : null;
}

/** The link for a code: this site's own address (knowitball.co.uk in production). */
export function legendUrl(code: string, origin?: string): string {
  const base = origin
    ?? (typeof window !== "undefined" ? window.location.origin : process.env.NEXT_PUBLIC_APP_URL ?? "https://knowitball.co.uk");
  return `${base.replace(/\/+$/, "")}/legend/${code}`;
}

/** "K7Q 2XM": easier to read out. */
export function spacedCode(code: string): string {
  return code.length === 6 ? `${code.slice(0, 3)} ${code.slice(3)}` : code;
}

// ── This device remembers which careers it has shared ──────────────────────

const LOCAL_KEY = "star-legend-codes-v1";

function readLocal(): Record<string, string> {
  try {
    const raw = typeof localStorage === "undefined" ? null : localStorage.getItem(LOCAL_KEY);
    const o = raw ? JSON.parse(raw) : {};
    return o && typeof o === "object" ? o as Record<string, string> : {};
  } catch { return {}; }
}
function writeLocal(map: Record<string, string>) {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(map)); } catch { /* fine: the server knows too */ }
}
/** The code this device last got for a Hall entry, if any. */
export function knownLegendCode(hallId: string): string | null {
  const c = readLocal()[hallId];
  return c && LEGEND_CODE.test(c) ? c : null;
}

// ── The calls ───────────────────────────────────────────────────────────────

export type ShareResult =
  | { ok: true; code: string }
  | { ok: false; why: "signed-out" | "not-set-up" | "offline" | "too-big" | "full"; message: string };

/**
 * Share a Hall entry: the same career always gets the same code. The career
 * goes to the cloud Hall first (a no-op when it's already there); the share
 * itself sends only its id, and the server copies it from the Hall.
 */
export async function shareLegend(entry: HallEntry): Promise<ShareResult> {
  try {
    const hall = await fetch("/api/star/hall-of-fame", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entry }),
    });
    if (hall.status === 401) return { ok: false, why: "signed-out", message: "Sign in to share a link." };
    if (hall.status === 413) return { ok: false, why: "too-big", message: "That career is too big to share." };
    // 409 (cloud Hall full) is fine if this career is already there: the share says.

    const res = await fetch("/api/star/legend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hallId: entry.id }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok && typeof body.code === "string" && LEGEND_CODE.test(body.code)) {
      writeLocal({ ...readLocal(), [entry.id]: body.code });
      return { ok: true, code: body.code };
    }
    if (res.status === 401) return { ok: false, why: "signed-out", message: "Sign in to share a link." };
    if (body?.migrationMissing) return { ok: false, why: "not-set-up", message: "Sharing isn't switched on yet." };
    if (res.status === 413) return { ok: false, why: "too-big", message: "That career is too big to share." };
    if (res.status === 409 || res.status === 404) {
      return { ok: false, why: "full", message: typeof body?.error === "string" ? body.error : "Couldn't make the link." };
    }
    return { ok: false, why: "offline", message: "Couldn't make the link. Try again." };
  } catch {
    return { ok: false, why: "offline", message: "No connection. Try again." };
  }
}

/** Stop sharing: the link stops working. */
export async function unshareLegend(code: string, hallId?: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/star/legend/${encodeURIComponent(code)}`, { method: "DELETE" });
    if (res.ok && hallId) {
      const m = readLocal();
      delete m[hallId];
      writeLocal(m);
    }
    return res.ok;
  } catch { return false; }
}

export type FetchedLegend =
  | { ok: true; code: string; entry: HallEntry; sharedAt?: string }
  | { ok: false; why: "not-found" | "not-set-up" | "offline" | "bad-code" };

/** Read a shared career by its code (no sign-in needed). */
export async function fetchLegend(code: string): Promise<FetchedLegend> {
  const c = parseLegendCode(code);
  if (!c) return { ok: false, why: "bad-code" };
  try {
    const res = await fetch(`/api/star/legend/${c}`, { cache: "no-store" });
    const body = await res.json().catch(() => ({}));
    if (body?.migrationMissing) return { ok: false, why: "not-set-up" };
    if (res.status === 404) return { ok: false, why: "not-found" };
    if (!res.ok || !body?.entry) return { ok: false, why: "offline" };
    // Made safe the same way the Hall makes anything it reads back safe.
    const entry = sanitizeHallBook({ entries: [body.entry], removed: [] }).entries[0];
    if (!entry) return { ok: false, why: "not-found" };
    return { ok: true, code: c, entry, ...(typeof body.sharedAt === "string" ? { sharedAt: body.sharedAt } : {}) };
  } catch {
    return { ok: false, why: "offline" };
  }
}

/** What to say when a code can't be read. */
export function legendProblem(why: Exclude<FetchedLegend, { ok: true }>["why"]): string {
  return why === "not-found" ? "No career has that code. Check it, or ask your friend to share it again."
    : why === "bad-code" ? "A code is six letters and numbers, like K7Q2XM."
    : why === "not-set-up" ? "Sharing isn't switched on yet."
    : "Couldn't reach the game. Try again.";
}

// ── Comparing two careers (components/star/LegendShare.tsx draws it) ─────────

export interface CompareRow { label: string; a: number; b: number; show?: (n: number) => string }

/** The numbers compared, one bar each. */
export function compareRows(a: CareerOverviewData, b: CareerOverviewData): CompareRow[] {
  const peak = (o: CareerOverviewData) => o.peak ? o.peak.goals : 0;
  return [
    { label: "Legacy", a: Math.round(a.verdict.score), b: Math.round(b.verdict.score) },
    { label: "Goals", a: a.totals.goals, b: b.totals.goals },
    { label: "Assists", a: a.totals.assists, b: b.totals.assists },
    { label: "Apps", a: a.totals.apps, b: b.totals.apps },
    { label: "Goals a game", a: a.totals.goalsPerGame, b: b.totals.goalsPerGame, show: n => n.toFixed(2) },
    { label: "Trophies", a: a.totals.trophies, b: b.totals.trophies },
    { label: "League titles", a: a.totals.leagueTitles, b: b.totals.leagueTitles },
    { label: "Ballon d'Or", a: a.totals.ballonDors, b: b.totals.ballonDors },
    { label: "Best season (goals)", a: peak(a), b: peak(b) },
    { label: "Caps", a: a.totals.caps, b: b.totals.caps },
    { label: "Clubs", a: a.clubs.length, b: b.clubs.length },
  ];
}

/** How many numbers each side has more of (equal counts for nobody). */
export function compareScore(rows: CompareRow[]): { a: number; b: number } {
  let a = 0, b = 0;
  for (const r of rows) {
    // "Clubs" is not better either way.
    if (r.label === "Clubs") continue;
    if (r.a > r.b) a++; else if (r.b > r.a) b++;
  }
  return { a, b };
}
