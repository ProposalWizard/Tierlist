/**
 * lib/star/onlineSlots.ts — which save slots hold a career ONLINE, and the
 * rule that stops one device replacing another device's career.
 *
 * The problem (Harry, 28 Nov 2026, live site): his phone showed 1 of his 3
 * saves, his computer showed all 3. The Saves list only read THIS device,
 * so a slot made on another device showed "Empty", and "Start career" on
 * that card started a new career whose first upload replaced the other
 * device's career online, with no check.
 *
 * Three pieces, all pure (no browser, no database driver), so they test
 * without either:
 *   1. `listOnlineSlots(db, userId)`: a light read of the account's rows,
 *      headline only (slot, player, club, season, when, which device). Never
 *      the whole save. Used by app/api/star/career/slots/route.ts.
 *   2. `mergeSaveCards(local, online, check)`: this device's slots plus the
 *      online list → the cards the Saves panel draws. A slot the server has
 *      is never shown as "Empty".
 *   3. `slotOverwriteRefusal(prev, next, check)`: the server's own backstop
 *      in POST /api/star/career. It refuses an upload that would replace a
 *      DIFFERENT career that the uploading device never saw.
 *
 * Old clients keep working: the backstop only runs when the upload carries
 * the `x-star-slot-check` header (SLOT_CHECK_HEADER). A page from before this
 * change does not send it, and saves exactly as it always did.
 */
import { calendarIndex, looksLikeCareer } from "./saveGuard";

/** The upload's header that turns the overwrite check on. */
export const SLOT_CHECK_HEADER = "x-star-slot-check";
/** "check": refuse to replace a different career. "replace": the player
 *  chose to replace the online copy (Saves → "Replace online copy"). */
export type SlotCheck = "check" | "replace";

export function readSlotCheck(raw: string | null | undefined): SlotCheck | null {
  return raw === "check" || raw === "replace" ? raw : null;
}

// ── 1. The light online list ────────────────────────────────────────────────

/** One slot as the server holds it: the card's headline, not the save. */
export interface OnlineSlot {
  slot: number;
  /** False for a deleted slot (a tombstone): nothing to open. */
  live: boolean;
  updatedAt: number;
  playerName?: string;
  club?: string;
  signed?: boolean;
  season?: number;
  week?: number;
  retired?: boolean;
  /** Which kind of device last uploaded it, from the save's sync stamp. */
  device?: "phone" | "tablet" | "computer";
  /** That browser's id (storage.ts getDeviceId), to tell "this browser". */
  deviceId?: string;
}

const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v : undefined);
const numOf = (v: unknown): number | undefined => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : undefined;
};

/** The columns read: headline fields only, picked out of the save by the
 *  database (the same `career->…` reading accountLuck already uses). */
export const ONLINE_SLOT_FIELDS = [
  "tomb:career->>tombstone",
  "first:career->player->>firstName",
  "last:career->player->>lastName",
  "club:career->player->>club",
  "league0:career->league->0->>name",
  "season:career->>season",
  "week:career->>week",
  "retired:career->>retired",
  "version:career->>version",
  "device:career->sync->>device",
  "deviceId:career->sync->>deviceId",
].join(", ");

/** One database row → one OnlineSlot. A row that is not a career (or a
 *  tombstone) reads as not live. */
export function onlineSlotFromRow(row: Record<string, unknown>, slotFallback = 1): OnlineSlot | null {
  const slot = numOf(row.slot) ?? slotFallback;
  if (!Number.isInteger(slot) || slot < 1) return null;
  const at = typeof row.updated_at === "string" ? new Date(row.updated_at).getTime() : NaN;
  const updatedAt = Number.isFinite(at) ? at : 0;
  const tomb = row.tomb === true || row.tomb === "true";
  const isCareer = String(row.version ?? "") === "2" && !!str(row.first);
  if (tomb || !isCareer) return { slot, live: false, updatedAt };
  const club = str(row.club);
  const device = row.device === "phone" || row.device === "tablet" || row.device === "computer" ? row.device : undefined;
  return {
    slot, live: true, updatedAt,
    playerName: [str(row.first), str(row.last)].filter(Boolean).join(" "),
    club,
    // hasClub (calendar.ts): a club AND a league. A trial has neither.
    signed: !!club && !!str(row.league0),
    season: numOf(row.season),
    week: numOf(row.week),
    retired: row.retired === true || row.retired === "true",
    device,
    deviceId: str(row.deviceId),
  };
}

/** The bit of a Supabase client this needs, so a test can hand in a fake. */
export interface SlotListDb {
  from(table: string): {
    select(cols: string): {
      eq(col: string, v: string): PromiseLike<{ data: unknown; error: unknown }>;
    };
  };
}

/**
 * Every slot this account holds online. Throws on a database error, so the
 * route answers "couldn't check" rather than claiming the slots are empty.
 * Without the `slot` column (star_career_slots.sql not run) the one row is
 * slot 1, exactly as the career route reads it.
 */
export async function listOnlineSlots(db: SlotListDb, userId: string): Promise<OnlineSlot[]> {
  let { data, error } = await db.from("star_careers").select(`slot, updated_at, ${ONLINE_SLOT_FIELDS}`).eq("user_id", userId);
  let noSlotColumn = false;
  if (error) {
    ({ data, error } = await db.from("star_careers").select(`updated_at, ${ONLINE_SLOT_FIELDS}`).eq("user_id", userId));
    noSlotColumn = true;
  }
  if (error) throw new Error("star_careers could not be read");
  const rows = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
  const out: OnlineSlot[] = [];
  for (const row of noSlotColumn ? rows.slice(0, 1) : rows) {
    const s = onlineSlotFromRow(row, 1);
    if (s) out.push(s);
  }
  return out.sort((a, b) => a.slot - b.slot);
}

// ── 2. The cards the Saves panel draws ──────────────────────────────────────

/** What this device knows about one slot (storage.ts SaveSlotSummary). */
export interface LocalSlotLike {
  slot: number;
  empty: boolean;
  playerName?: string;
}

/**
 * How the online check went:
 *  - "checking": asked, no answer yet
 *  - "ok": the server answered
 *  - "failed": no answer (no signal, timeout, server error)
 *  - "device-only": signed out, a guest, or the packed app: nothing online
 */
export type OnlineCheck = "checking" | "ok" | "failed" | "device-only";

export type SaveCardKind =
  /** On this device (it may also be online: opening it reconciles). */
  | "here"
  /** Online, from another device, not on this one: "Open" downloads it. */
  | "online"
  /** Empty here AND online (or device-only mode): "Start career". */
  | "empty"
  /** Empty here; online not known yet, or the check failed. */
  | "unknown";

export interface SaveCard<L extends LocalSlotLike = LocalSlotLike> {
  slot: number;
  kind: SaveCardKind;
  local?: L;
  online?: OnlineSlot;
  /** A "here" card whose slot holds a DIFFERENT career online. */
  onlineDiffers?: boolean;
}

export function mergeSaveCards<L extends LocalSlotLike>(
  local: L[], online: OnlineSlot[] | null, check: OnlineCheck,
): SaveCard<L>[] {
  const byslot = new Map<number, OnlineSlot>();
  if (check === "ok" && online) for (const o of online) byslot.set(o.slot, o);
  return local.map((l): SaveCard<L> => {
    const o = byslot.get(l.slot);
    const liveOnline = o && o.live ? o : undefined;
    if (!l.empty) {
      const differs = !!liveOnline && !!liveOnline.playerName && !!l.playerName && liveOnline.playerName !== l.playerName;
      return { slot: l.slot, kind: "here", local: l, online: liveOnline, ...(differs ? { onlineDiffers: true } : {}) };
    }
    if (check === "device-only") return { slot: l.slot, kind: "empty", local: l };
    if (check !== "ok") return { slot: l.slot, kind: "unknown", local: l };
    if (liveOnline) return { slot: l.slot, kind: "online", local: l, online: liveOnline };
    return { slot: l.slot, kind: "empty", local: l };
  });
}

/**
 * May "Start career" start a new career in this card's slot? Only when the
 * slot is empty here AND online (or the game is device-only). "unknown"
 * (the check failed) is allowed: the server's own check below still refuses
 * to replace another device's career, so nothing can be lost.
 */
export function startCareerAllowed(card: Pick<SaveCard, "kind">): { ok: boolean; why?: string } {
  if (card.kind === "empty" || card.kind === "unknown") return { ok: true };
  if (card.kind === "online") return { ok: false, why: "This slot has a career on another device. Open it, or choose an empty slot." };
  return { ok: false, why: "This slot already has a career. Delete it first, or choose an empty slot." };
}

// ── 3. The server's backstop ────────────────────────────────────────────────

type Raw = Record<string, unknown>;
const isObj = (v: unknown): v is Raw => !!v && typeof v === "object" && !Array.isArray(v);

function samePlayer(a: Raw, b: Raw): boolean {
  const pa = isObj(a.player) ? a.player : {}, pb = isObj(b.player) ? b.player : {};
  return pa.firstName === pb.firstName && pa.lastName === pb.lastName && pa.startYear === pb.startYear;
}
function appearances(c: Raw): number {
  const v = isObj(c.careerStats) ? c.careerStats.appearances : 0;
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}
/** Did the uploading device ever see the copy online? Its upload's stamp
 *  lists every cloud version it was built on (saveClash.ts nextStamp). */
function sawIt(prev: Raw, next: Raw): boolean {
  const pid = isObj(prev.sync) && typeof prev.sync.id === "string" ? prev.sync.id : null;
  if (!pid) return false;
  const nextSync = isObj(next.sync) ? next.sync : null;
  if (!nextSync) return false;
  if (nextSync.id === pid) return true;
  return Array.isArray(nextSync.lineage) && nextSync.lineage.includes(pid);
}

/**
 * The route's step, with the database read handed in (so a test can fake
 * it). Reads the slot's row only when the upload asked to be checked. A
 * failed read never refuses: the check must never stop an honest save.
 * Returns the row it read (undefined when it did not read), so the save
 * guard after it need not read again.
 */
export async function checkSlotUpload<R extends { career: unknown }>(
  readPrev: () => Promise<R | null>, career: unknown, check: SlotCheck | null,
): Promise<{ refusal: OverwriteRefusal | null; prev: R | null | undefined }> {
  if (check !== "check") return { refusal: null, prev: undefined };
  let prev: R | null;
  try { prev = await readPrev(); } catch { return { refusal: null, prev: undefined }; }
  return { refusal: prev ? slotOverwriteRefusal(prev.career, career, check) : null, prev };
}

export interface OverwriteRefusal {
  error: "slot-taken";
  message: string;
  /** The career online, so the game can name it. */
  online: { playerName: string; season: number };
}

/**
 * Null: store the upload. Otherwise the upload would replace a different
 * career, and the device sending it never saw that career. That is:
 *   - the request asked to be checked (old clients are never refused), and
 *     did not say "replace";
 *   - the slot holds a live career (not empty, not a deleted slot);
 *   - the sender's stamp is not built on the copy online; and
 *   - it is a different player, OR the same name but further behind (a new
 *     career given the same name, never the same career played on).
 * The same career moving on, from any device, is never refused here; two
 * copies of one career that went different ways are saveClash.ts's job.
 */
export function slotOverwriteRefusal(prev: unknown, next: unknown, check: SlotCheck | null): OverwriteRefusal | null {
  if (check !== "check") return null;
  if (!isObj(prev) || prev.tombstone === true || !looksLikeCareer(prev)) return null;
  if (!isObj(next) || !looksLikeCareer(next)) return null;
  if (sawIt(prev, next)) return null;
  const behind = calendarIndex(next) < calendarIndex(prev) || appearances(next) < appearances(prev);
  if (samePlayer(prev, next) && !behind) return null;
  const p = isObj(prev.player) ? prev.player : {};
  const playerName = [p.firstName, p.lastName].filter((x) => typeof x === "string" && x).join(" ") || "another player";
  const season = typeof prev.season === "number" ? prev.season : 1;
  return {
    error: "slot-taken",
    message: samePlayer(prev, next)
      ? `Not saved online: a further-on copy of this career (Season ${season}) was saved from another device. Reopen the game to choose which to keep.`
      : `Not saved online: this slot holds a different career (${playerName}, Season ${season}) from another device. Open Settings → Saves.`,
    online: { playerName, season },
  };
}
