/**
 * TWO DIFFERENT SAVES — telling "the cloud is newer" apart from "both copies
 * moved on".
 *
 * Harry, 30 Sep 2026. A career lives in two places: this browser's
 * localStorage (lib/star/storage.ts) and the cloud row (star_careers). Until
 * now a load simply kept whichever was written LATER. That loses a career in
 * one ordinary way: play on the phone with no signal (only the phone's copy
 * moves), then play on the PC (the cloud gets the PC's copy). The next time
 * the phone opens, the cloud is later, so the phone's offline session is
 * silently thrown away.
 *
 * Pure functions only — no localStorage, no fetch. storage.ts does the
 * reading and writing and asks this file what to do.
 *
 * ── THE RULE ─────────────────────────────────────────────────────────────────
 *
 * Every upload to the cloud is stamped (inside the career JSON, so no
 * database migration) with:
 *   - `id`      a new random id for that exact upload ("r12-k3j9x0qa"; the
 *               number in front is its `rev`)
 *   - `rev`     one more than the newest version the uploader knew about
 *   - `lineage` the ids of the cloud versions it was built on, newest last
 *               (capped at LINEAGE_CAP)
 *   - `deviceId`/`device`/`at` who sent it, and when
 *
 * Each device separately remembers its BASE: the cloud version it last
 * synced with (downloaded, or uploaded and heard "ok" back), with a
 * fingerprint of the career's PROGRESS at that moment (progressFingerprint —
 * everything the player did; not squads or photos, which are refetched on
 * every load and change on their own).
 *
 * On load, with local copy L, cloud copy C and base B:
 *   1. C is B                   → the cloud has not moved. Keep L (it is
 *                                 either the same, or ahead and will upload).
 *   2. C is an older copy       → C is one of L's own ancestors. Keep L.
 *   3. C descends from B, and L has made no progress since B
 *                               → the cloud is simply newer. Take C.
 *   4. L and C are at exactly the same progress → take C (nothing to lose).
 *   5. Anything else            → DIVERGED. Both copies hold progress the
 *                                 other does not: either both moved on from
 *                                 B, or C was written by a device that never
 *                                 saw B (so B's progress is only here). Ask.
 *
 * Old saves keep working exactly as before: if the cloud copy has no stamp,
 * or this device has never synced under this scheme (no base), the old rule
 * applies — the later write wins — and nothing is ever called diverged.
 * A device joins the new scheme the first time an upload of its own is
 * confirmed, or it takes a stamped cloud copy.
 *
 * An upload that went out but whose "ok" never came back (the page closed
 * mid-flight — the keepalive send when the phone is locked) is remembered
 * as PENDING. If the cloud copy turns out to be that exact upload, it is
 * promoted to the base, so a device never reads its own last upload as
 * "somebody else's".
 */

export type DeviceKind = "phone" | "tablet" | "computer";

/** Carried inside the career JSON on every cloud upload. */
export interface SaveStamp {
  id: string;
  rev: number;
  deviceId: string;
  device: DeviceKind;
  at: number;
  /** Ids of the cloud versions this one was built on, oldest first. */
  lineage: string[];
}

/** A cloud version as one device remembers it. */
export interface SyncedVersion {
  id: string;
  rev: number;
  /** progressFingerprint of the career at the moment it was synced, worked
   *  out on THIS device, so two versions of the game never compare hashes. */
  progress: string;
  lineage: string[];
}

/** One device's memory of where it stands with the cloud, per save slot. */
export interface SyncRecord {
  base: SyncedVersion | null;
  pending: SyncedVersion[];
}

export const LINEAGE_CAP = 100;
export const PENDING_CAP = 20;
/** "Open on your phone right now" means the other device saved within this. */
export const RECENT_OTHER_DEVICE_MS = 10 * 60 * 1000;

export function emptySyncRecord(): SyncRecord {
  return { base: null, pending: [] };
}

/** Accepts anything read off disk and returns a well-formed record. */
export function sanitizeSyncRecord(raw: unknown): SyncRecord {
  const ok = (v: unknown): v is SyncedVersion => {
    const x = v as SyncedVersion;
    return !!x && typeof x === "object" && typeof x.id === "string" && typeof x.rev === "number"
      && typeof x.progress === "string" && Array.isArray(x.lineage);
  };
  const r = raw as SyncRecord | null;
  if (!r || typeof r !== "object") return emptySyncRecord();
  return {
    base: ok(r.base) ? r.base : null,
    pending: Array.isArray(r.pending) ? r.pending.filter(ok).slice(-PENDING_CAP) : [],
  };
}

/** Accepts the `sync` field of a downloaded career, or null if it isn't one. */
export function readStamp(raw: unknown): SaveStamp | null {
  const s = raw as SaveStamp | null;
  if (!s || typeof s !== "object") return null;
  if (typeof s.id !== "string" || typeof s.rev !== "number" || typeof s.deviceId !== "string") return null;
  return {
    id: s.id,
    rev: s.rev,
    deviceId: s.deviceId,
    device: s.device === "phone" || s.device === "tablet" ? s.device : "computer",
    at: typeof s.at === "number" ? s.at : 0,
    lineage: Array.isArray(s.lineage) ? s.lineage.filter((x): x is string => typeof x === "string") : [],
  };
}

// ── Progress fingerprint ─────────────────────────────────────────────────────

/**
 * Top-level parts of a career that change WITHOUT the player doing anything:
 * every load refetches the squads (photos, flags, attributes), and the
 * division's strengths are re-derived from them. Two copies differing only
 * here are the same career.
 */
const NOT_PROGRESS = new Set([
  "squad", "leagueSquads", "externalSquads", "freeAgents", "league", "savedSquads", "sync",
]);

/** JSON.stringify with object keys sorted, so key order never matters. */
function stableStringify(v: unknown): string {
  if (v === null || typeof v !== "object") {
    if (typeof v === "number" && !Number.isFinite(v)) return "null";
    const s = JSON.stringify(v);
    return s === undefined ? "null" : s;
  }
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  const obj = v as Record<string, unknown>;
  const keys = Object.keys(obj).filter((k) => obj[k] !== undefined && typeof obj[k] !== "function").sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}

/** Two independent 32-bit string hashes, so a collision needs both to agree. */
function hash(s: string): string {
  let a = 0x811c9dc5; // FNV-1a
  let b = 5381;       // djb2
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193);
    b = (Math.imul(b, 33) + c) | 0;
  }
  return `${(a >>> 0).toString(16).padStart(8, "0")}${(b >>> 0).toString(16).padStart(8, "0")}.${s.length}`;
}

/**
 * Everything the player has done, reduced to a short string. Two careers
 * with the same fingerprint are at the same point. The trial's own
 * reload/resume counters are left out too: opening the game mid-trial bumps
 * them on its own.
 */
export function progressFingerprint(career: object): string {
  const src = career as Record<string, unknown>;
  const kept: Record<string, unknown> = {};
  for (const k of Object.keys(src)) {
    if (NOT_PROGRESS.has(k)) continue;
    kept[k] = src[k];
  }
  const trial = kept.trial as Record<string, unknown> | undefined;
  if (trial && typeof trial === "object") {
    const { resumes: _r, reloads: _l, ...rest } = trial;
    void _r; void _l;
    kept.trial = rest;
  }
  return hash(stableStringify(kept));
}

// ── Stamps ───────────────────────────────────────────────────────────────────

export function revOfId(id: string): number {
  const m = /^r(\d+)-/.exec(id);
  return m ? Number(m[1]) : NaN;
}

/** The stamp for a new upload, and how this device will remember it. */
export function nextStamp(
  record: SyncRecord,
  opts: { deviceId: string; device: DeviceKind; at: number; random: string; progress: string },
): { stamp: SaveStamp; sent: SyncedVersion } {
  const known = [record.base, ...record.pending].filter((v): v is SyncedVersion => !!v);
  const rev = known.reduce((m, v) => Math.max(m, v.rev), 0) + 1;
  // Built on the base, plus anything sent since that may or may not have
  // landed — the cloud copy is one of those, whichever it is.
  const lineage = [
    ...(record.base ? [...record.base.lineage, record.base.id] : []),
    ...record.pending.map((p) => p.id),
  ];
  const dedup = lineage.filter((id, i) => lineage.indexOf(id) === i).slice(-LINEAGE_CAP);
  const id = `r${rev}-${opts.random}`;
  return {
    stamp: { id, rev, deviceId: opts.deviceId, device: opts.device, at: opts.at, lineage: dedup },
    sent: { id, rev, progress: opts.progress, lineage: dedup },
  };
}

/** Remember an upload as sent-but-not-confirmed. */
export function recordAfterSend(record: SyncRecord, sent: SyncedVersion): SyncRecord {
  return { base: record.base, pending: [...record.pending.filter((p) => p.id !== sent.id), sent].slice(-PENDING_CAP) };
}

/** The server said ok: that upload IS the cloud copy now. */
export function recordAfterConfirm(record: SyncRecord, sent: SyncedVersion): SyncRecord {
  // An older upload confirming late never moves the base backwards.
  const base = record.base && record.base.rev > sent.rev ? record.base : sent;
  return { base, pending: record.pending.filter((p) => p.rev > base.rev) };
}

/** This device now holds exactly this cloud version. */
export function recordAfterTake(version: SyncedVersion | null): SyncRecord {
  return { base: version, pending: [] };
}

// ── The load decision ────────────────────────────────────────────────────────

export interface LoadInput {
  local: { at: number; progress: string } | null;
  cloud: { at: number; progress: string; stamp: SaveStamp | null } | null;
  record: SyncRecord;
  deviceId: string;
  now: number;
}

export type LoadWhy =
  | "nothing" | "no-cloud" | "no-local"
  | "legacy-local-newer" | "legacy-cloud-newer"
  | "in-sync" | "local-ahead" | "cloud-is-older-copy"
  | "cloud-ahead" | "same-progress"
  | "both-moved-on" | "cloud-overwrote";

export interface OtherDeviceWarning {
  device: DeviceKind;
  /** When the other device saved (the server's own clock). */
  savedAt: number;
  minutesAgo: number;
}

export interface LoadDecision {
  use: "none" | "local" | "cloud" | "clash";
  why: LoadWhy;
  /** What this device should remember afterwards. For a clash it is the
   *  record with any pending upload promoted; the choice then replaces it. */
  record: SyncRecord;
  /** The cloud copy as a version to remember, if it is stamped. */
  cloudVersion: SyncedVersion | null;
  /** The cloud copy was saved very recently by a different device. */
  warn: OtherDeviceWarning | null;
}

/** Is `base` one of the versions `stamp` was built on? */
export function descendsFrom(stamp: SaveStamp, base: SyncedVersion): boolean {
  if (stamp.lineage.includes(base.id)) return true;
  // Truncated: the list only keeps the newest LINEAGE_CAP. If the base is
  // older than anything still listed there is no way to tell — trust the
  // cloud, as every load did before this existed.
  if (stamp.lineage.length >= LINEAGE_CAP) {
    const oldest = revOfId(stamp.lineage[0]);
    if (Number.isFinite(oldest) && base.rev < oldest) return true;
  }
  return false;
}

export function decideLoad(input: LoadInput): LoadDecision {
  const { local, cloud, record, deviceId, now } = input;
  const stamp = cloud?.stamp ?? null;
  const cloudVersion: SyncedVersion | null = stamp && cloud
    ? { id: stamp.id, rev: stamp.rev, progress: cloud.progress, lineage: stamp.lineage }
    : null;
  const warn: OtherDeviceWarning | null = stamp && cloud && stamp.deviceId !== deviceId
    && now - cloud.at >= 0 && now - cloud.at < RECENT_OTHER_DEVICE_MS
    ? { device: stamp.device, savedAt: cloud.at, minutesAgo: Math.max(0, Math.round((now - cloud.at) / 60000)) }
    : null;
  const out = (use: LoadDecision["use"], why: LoadWhy, rec: SyncRecord): LoadDecision =>
    ({ use, why, record: rec, cloudVersion, warn: use === "clash" ? null : warn });

  if (!local && !cloud) return out("none", "nothing", record);
  if (!cloud) return out("local", "no-cloud", record);
  if (!local) return out("cloud", "no-local", recordAfterTake(cloudVersion));

  // The cloud copy is an upload of ours whose "ok" never arrived: it is our base.
  let rec = record;
  const landed = stamp ? record.pending.find((p) => p.id === stamp.id) : undefined;
  if (landed) rec = recordAfterConfirm(record, landed);
  const base = rec.base;

  // The old rule, unchanged, for anything from before stamps existed.
  if (!stamp || !base) {
    return cloud.at > local.at
      ? out("cloud", "legacy-cloud-newer", recordAfterTake(cloudVersion))
      : out("local", "legacy-local-newer", rec);
  }

  if (stamp.id === base.id) {
    return out("local", local.progress === base.progress ? "in-sync" : "local-ahead", rec);
  }
  if (base.lineage.includes(stamp.id) || rec.pending.some((p) => p.lineage.includes(stamp.id))) {
    return out("local", "cloud-is-older-copy", rec);
  }

  const descends = descendsFrom(stamp, base);
  const localMoved = local.progress !== base.progress;
  if (descends && !localMoved) return out("cloud", "cloud-ahead", recordAfterTake(cloudVersion));
  if (local.progress === cloud.progress) return out("cloud", "same-progress", recordAfterTake(cloudVersion));
  return out("clash", descends ? "both-moved-on" : "cloud-overwrote", rec);
}

// ── The prompt's bits ────────────────────────────────────────────────────────

/** Display only. iPads that report a Mac user agent show up as a computer. */
export function deviceKindFromUA(ua: string): DeviceKind {
  if (/iPad|Tablet|PlayBook|Silk/i.test(ua)) return "tablet";
  if (/Android/i.test(ua) && !/Mobile/i.test(ua)) return "tablet";
  if (/Mobi|iPhone|iPod|Android|Windows Phone/i.test(ua)) return "phone";
  return "computer";
}

export function deviceName(kind: DeviceKind): string {
  return kind === "computer" ? "computer" : kind;
}

/**
 * The first slot other than `current` with nothing in it on this device AND
 * nothing in the cloud (a slot this device has never opened can still have a
 * cloud save from another one). Null when every other slot is taken.
 */
export function pickSpareSlot(
  current: number,
  slots: { slot: number; localEmpty: boolean; cloudEmpty: boolean }[],
): number | null {
  const free = slots
    .filter((s) => s.slot !== current && s.localEmpty && s.cloudEmpty)
    .sort((a, b) => a.slot - b.slot);
  return free.length ? free[0].slot : null;
}

/** "just now", "3 min ago", "2 hours ago", "yesterday", "4 days ago". */
export function timeAgo(at: number, now: number): string {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return h === 1 ? "1 hour ago" : `${h} hours ago`;
  const d = Math.round(h / 24);
  if (d === 1) return "yesterday";
  if (d < 30) return `${d} days ago`;
  return new Date(at).toLocaleDateString();
}

/** What a card on the prompt shows about one copy. */
export interface SaveSideSummary {
  playerName: string;
  club: string | null;
  season: number;
  week: number;
  starRating: number;
  matchesPlayed: number;
  money: number;
}

export function summariseSave(c: {
  player: { firstName: string; lastName: string; club: string };
  season: number; week: number; starRating: number; money: number;
  fixtures?: { played?: boolean }[];
}): SaveSideSummary {
  return {
    playerName: `${c.player.firstName} ${c.player.lastName}`.trim(),
    club: c.player.club ? c.player.club : null,
    season: c.season,
    week: c.week,
    starRating: c.starRating,
    matchesPlayed: (c.fixtures ?? []).filter((f) => f.played).length,
    money: c.money,
  };
}
