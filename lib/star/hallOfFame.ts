/**
 * THE HALL OF FAME — every retired career, kept.
 *
 * Leo, 5 Oct 2026: "forcing you to retire, or whenever you retire, should not
 * immediately delete your career. You should be able to come back to it
 * somewhere … just to view your achievements" — and "the Hall of Fame is a
 * must-have. Definitely should be added in right now."
 *
 * A retired career used to live only in its save slot, and "Start a new
 * career" deleted it. Now, the moment a career is saved retired, a copy goes
 * in the Hall (see saveCareer, storage.ts — both the New and the Old UI save
 * through it, so both feed the Hall). Starting a new career in that slot no
 * longer loses anything.
 *
 * WHAT IS KEPT. The finished career, slimmed: everything the career overview
 * reads, without the world it was played in (the other clubs' squads, the
 * league tables, the cups in progress, the phone's feed). A 20-season career
 * is about 30-60 KB slimmed (tests/star/hallOfFame.mts measures it), so a
 * Hall of many careers fits beside the saves on a phone.
 *
 * WHERE. On this device (localStorage, one Hall per account — not per save
 * slot), and in the cloud once supabase/migrations/star_hall_of_fame.sql has
 * been run (app/api/star/hall-of-fame/route.ts). Until then the Hall stays on
 * the device it was made on, and the Hall screen says so.
 *
 * REMOVING one leaves a tombstone (its id in `removed`), so another device's
 * copy cannot bring it back. A career cannot be retired twice, so a removed
 * id never needs to come back.
 */
import type { CareerState } from "./types";
import { careerVerdict } from "./retirement";
import { careerOverview } from "./careerOverview";

export const HALL_KEY = "star-hall-of-fame-v1";

/**
 * The cloud keeps at most this many careers per account (8 Oct 2026; a
 * career is 20 seasons, so 30 is a long time). The device keeps every one.
 * Enforced by /api/star/hall-of-fame and by a trigger in
 * star_hall_of_fame.sql (so a direct write can't go round it).
 */
export const HALL_MAX_ENTRIES = 30;
/** Every row, careers and tombstones together, per account. */
export const HALL_MAX_ROWS = 200;

/**
 * May one more career go into an account's cloud Hall? `live` = careers it
 * holds now, `rows` = all its rows, `alreadyThere` = this id already has a row
 * (then nothing new is written, so it never counts as over).
 */
export function hallHasRoom(live: number, rows: number, alreadyThere: boolean): boolean {
  if (alreadyThere) return true;
  return live < HALL_MAX_ENTRIES && rows < HALL_MAX_ROWS;
}

/** What the Hall's list shows, worked out once when the career goes in. */
export interface HallCard {
  name: string;
  nation: string;
  position: string;
  /** The club he played the most seasons for. */
  mainClub: string;
  /** The club he retired at. */
  lastClub: string;
  seasons: number;
  /** The year the first season started (season 1 = startYear/startYear+1). */
  firstYear: number;
  apps: number;
  goals: number;
  assists: number;
  trophies: number;
  ballonDors: number;
  /** "Ballon d'Or winner", "A legend of the game", … (careerVerdict). */
  title: string;
}

export interface HallEntry {
  /** The same on every device: worked out from the finished career itself. */
  id: string;
  /** When it went in (ms since 1970). The list shows the newest first. */
  addedAt: number;
  card: HallCard;
  /** The finished career, slimmed (slimCareer). */
  career: CareerState;
}

export interface HallBook {
  entries: HallEntry[];
  /** Ids taken out of the Hall. They stay out, on every device. */
  removed: string[];
}

export const EMPTY_HALL: HallBook = { entries: [], removed: [] };

/**
 * Parts of a career that describe the world while it is being played, not
 * the career itself. None of them is read by the career overview
 * (tests/star/hallOfFame.mts proves the overview is identical without them).
 * Small fields stay even when unused, so a later screen can still read them.
 */
const WORLD_FIELDS = [
  "squad", "leagueSquads", "externalSquads", "freeAgents",
  "league", "divisions", "results", "ladderNews", "playOffState", "limboClubs",
  "cupState", "euroState", "newCompetitions",
  "media", "recentGoals", "savedReplays",
  "leagueTransferNews", "leagueLoanNews", "activeLoans", "clubTransferHistory",
  "ownedClubs", "ownedLineups", "availableManagers", "managerNegotiationCooldowns",
  "competitionBets", "betNews", "sponsorNews", "fameNews", "storeLog",
  "potm", "lastSeasonAwardStats", "incumbents", "recommendations",
  "outgoingMates",
] as const;

/** The finished career without the world it was played in. */
export function slimCareer(career: CareerState): CareerState {
  const out = { ...career } as Record<string, unknown>;
  for (const k of WORLD_FIELDS) delete out[k];
  // Each season's best team-mates are kept for the farewell match, which is
  // played before a career goes in: about 15 KB over 20 seasons, not kept.
  if (Array.isArray(career.seasonHistory) && career.seasonHistory.some(r => r.mates)) {
    out.seasonHistory = career.seasonHistory.map(r => {
      if (!r.mates) return r;
      const { mates: _mates, ...row } = r;
      return row;
    });
  }
  return out as unknown as CareerState;
}

/** A 53-bit string hash (cyrb53): short, stable, no crypto needed. */
function hash(text: string): string {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/**
 * The career's id in the Hall. Built from facts that never change once a
 * career is over (who, when he started, how long, what he scored, where he
 * moved), so every save of the same retired career, on any device, gets the
 * same id. Two different careers matching on all of it is not a real risk.
 */
export function hallIdFor(career: CareerState): string {
  const p = career.player;
  const s = career.careerStats;
  return "hof-" + hash(JSON.stringify([
    p.firstName, p.lastName, p.nationality, p.position, p.startYear ?? 0,
    career.season, s.appearances, s.goals, s.assists,
    career.trophies.length, career.ballonDorWins ?? 0,
    (career.transfers ?? []).map(t => `${t.season}:${t.to}`).join(">"),
  ]));
}

export function hallCardFor(career: CareerState): HallCard {
  const p = career.player;
  const s = career.careerStats;
  // The longest stay, counted the way the overview's Clubs page counts it:
  // every season, including one with no appearances (the season archive
  // only has rows for seasons he played in, so it could name another club).
  let mainClub = p.club;
  try {
    let most = 0;
    for (const cl of careerOverview(career).clubs) if (cl.seasons > most) { most = cl.seasons; mainClub = cl.club; }
  } catch { /* a very odd save: the club he retired at */ }
  let title = "";
  try { title = careerVerdict(career).title; } catch { /* a very odd save: no title */ }
  return {
    name: `${p.firstName} ${p.lastName}`.trim(),
    nation: p.nationality ?? "",
    position: p.position ?? "",
    mainClub,
    lastClub: p.club,
    seasons: career.season,
    firstYear: p.startYear ?? 2026,
    apps: s.appearances,
    goals: s.goals,
    assists: s.assists,
    trophies: career.trophies.length,
    ballonDors: career.ballonDorWins ?? 0,
    title,
  };
}

export function hallEntryFor(career: CareerState, now: number = Date.now()): HallEntry {
  return { id: hallIdFor(career), addedAt: now, card: hallCardFor(career), career: slimCareer(career) };
}

// ── Reading and writing on this device ─────────────────────────────────────

/** One Hall per account, whichever save slot the career was played in. */
export function accountOfScope(scope: string): string {
  const i = scope.indexOf("#slot");
  return i < 0 ? scope : scope.slice(0, i);
}

const key = (account: string) => `${HALL_KEY}::${account}`;

function isEntry(x: unknown): x is HallEntry {
  if (!x || typeof x !== "object") return false;
  const e = x as Partial<HallEntry>;
  return typeof e.id === "string" && typeof e.addedAt === "number"
    && !!e.card && typeof e.card === "object"
    && !!e.career && typeof e.career === "object" && !!(e.career as CareerState).player;
}

/** Anything read back from storage or the network, made safe to use. */
export function sanitizeHallBook(x: unknown): HallBook {
  if (!x || typeof x !== "object") return { entries: [], removed: [] };
  const b = x as Partial<HallBook>;
  const removed = Array.isArray(b.removed) ? b.removed.filter((r): r is string => typeof r === "string") : [];
  const gone = new Set(removed);
  const seen = new Set<string>();
  const entries = (Array.isArray(b.entries) ? b.entries : []).filter(isEntry).filter(e => {
    if (gone.has(e.id) || seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  });
  return { entries: sortHall(entries), removed: Array.from(gone) };
}

function sortHall(entries: HallEntry[]): HallEntry[] {
  return [...entries].sort((a, b) => b.addedAt - a.addedAt);
}

/** Ids known to be in each account's Hall, so a retired career saved again
 *  and again (every save, while its end screen is open) is checked without
 *  reading the whole Hall each time. */
const knownIds = new Map<string, Set<string>>();

export function loadHall(account: string): HallBook {
  try {
    const raw = localStorage.getItem(key(account));
    const book = raw ? sanitizeHallBook(JSON.parse(raw)) : { entries: [], removed: [] };
    knownIds.set(account, new Set([...book.entries.map(e => e.id), ...book.removed]));
    return book;
  } catch {
    return { entries: [], removed: [] };
  }
}

/** False when this device would not take it (full, or storage blocked). */
export function saveHall(account: string, book: HallBook): boolean {
  try {
    localStorage.setItem(key(account), JSON.stringify(book));
    knownIds.set(account, new Set([...book.entries.map(e => e.id), ...book.removed]));
    return true;
  } catch {
    return false;
  }
}

/**
 * Put a retired career in the Hall, once. `ok` is false only when it should
 * have gone in and this device would not store it — the one case where the
 * career must not be deleted from its slot (see handleFullReset, page.tsx).
 */
export function addToHall(account: string, career: CareerState, now: number = Date.now()): { added: boolean; ok: boolean; entry?: HallEntry } {
  if (!career.retired) return { added: false, ok: true };
  const id = hallIdFor(career);
  if (knownIds.get(account)?.has(id)) return { added: false, ok: true };
  const book = loadHall(account);
  if (book.removed.includes(id)) return { added: false, ok: true };
  if (book.entries.some(e => e.id === id)) return { added: false, ok: true };
  const entry = hallEntryFor(career, now);
  const ok = saveHall(account, { ...book, entries: sortHall([entry, ...book.entries]) });
  return { added: ok, ok, entry: ok ? entry : undefined };
}

/** Is this retired career safely in the Hall on this device? */
export function isInHall(account: string, career: CareerState): boolean {
  const id = hallIdFor(career);
  return loadHall(account).entries.some(e => e.id === id);
}

export function removeFromHall(account: string, id: string): HallBook {
  const book = loadHall(account);
  const next: HallBook = {
    entries: book.entries.filter(e => e.id !== id),
    removed: book.removed.includes(id) ? book.removed : [...book.removed, id],
  };
  saveHall(account, next);
  return next;
}

/** Two copies of a Hall (this device and the cloud) made into one: every
 *  entry either has, minus anything either has removed. */
export function mergeHall(a: HallBook, b: HallBook): HallBook {
  const removed = new Set([...a.removed, ...b.removed]);
  const byId = new Map<string, HallEntry>();
  for (const e of [...a.entries, ...b.entries]) {
    if (removed.has(e.id)) continue;
    const had = byId.get(e.id);
    // The same career twice: keep the earlier date, so its place in the
    // list never jumps about.
    if (!had || e.addedAt < had.addedAt) byId.set(e.id, e);
  }
  return { entries: sortHall(Array.from(byId.values())), removed: Array.from(removed) };
}

// ── The cloud ───────────────────────────────────────────────────────────────

export type HallCloud =
  /** Matches the cloud. */
  | "synced"
  /** Not signed in: the Hall lives on this device only. */
  | "signed-out"
  /** The cloud table is not there yet (star_hall_of_fame.sql not run). */
  | "not-set-up"
  /** The cloud could not be reached this time. */
  | "offline";

const isSignedOut = (account: string) => account === "anon" || account.startsWith("anon#");

/**
 * Make this device's Hall and the cloud's the same, both ways. Never throws:
 * every failure leaves this device's Hall as it was and says why.
 */
export async function syncHall(account: string): Promise<{ book: HallBook; cloud: HallCloud }> {
  const local = loadHall(account);
  if (isSignedOut(account)) return { book: local, cloud: "signed-out" };
  try {
    const res = await fetch("/api/star/hall-of-fame", { cache: "no-store" });
    if (!res.ok) return { book: local, cloud: "offline" };
    const body = await res.json() as { entries?: unknown; removed?: unknown; migrationMissing?: boolean; signedOut?: boolean } | null;
    if (!body || body.signedOut) return { book: local, cloud: "signed-out" };
    if (body.migrationMissing) return { book: local, cloud: "not-set-up" };
    const remote = sanitizeHallBook(body);
    const merged = mergeHall(local, remote);
    saveHall(account, merged);
    const remoteIds = new Set(remote.entries.map(e => e.id));
    const remoteGone = new Set(remote.removed);
    let allOk = true;
    for (const e of merged.entries) {
      if (remoteIds.has(e.id)) continue;
      const r = await fetch("/api/star/hall-of-fame", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entry: e }),
      }).catch(() => null);
      if (!r?.ok) allOk = false;
    }
    for (const id of merged.removed) {
      if (remoteGone.has(id)) continue;
      const r = await fetch(`/api/star/hall-of-fame?id=${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => null);
      if (!r?.ok) allOk = false;
    }
    return { book: merged, cloud: allOk ? "synced" : "offline" };
  } catch {
    return { book: local, cloud: "offline" };
  }
}
