/**
 * The casino's table (star_casino_plays, supabase/migrations/star_casino.sql),
 * read and written with the SERVICE key. Server only: imported by
 * app/api/star/casino/play and app/api/star/career. The rules are in
 * casinoEngine.ts; this is only the database.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CasinoGame, CasinoStore, PlayRow, Trusted } from "./casinoEngine";
import { walletDbMissing } from "./wallet";

export const CASINO_TABLE = "star_casino_plays";
/** Settled rows older than this are pruned (the database is near its free
 *  limit; the save guard only needs rows since the last trusted save). */
export const CASINO_KEEP_DAYS = 60;

type Db = SupabaseClient;

const COLS = "id, user_id, slot, game, stake, payout, net, status, step, outcome, secret, idem_key, at";

interface DbRow extends Omit<PlayRow, "at"> { at: string }
const fromDb = (r: DbRow): PlayRow => ({
  ...r, stake: Number(r.stake), payout: Number(r.payout), net: Number(r.net),
  outcome: (r.outcome ?? {}) as PlayRow["outcome"], at: new Date(r.at).getTime(),
});

/** Is the table there? (false = star_casino.sql has not run). */
export async function casinoTableReady(db: Db): Promise<boolean> {
  const { error } = await db.from(CASINO_TABLE).select("id", { head: true }).limit(1);
  return !error || !walletDbMissing(error);
}

export function supabaseCasinoStore(db: Db): CasinoStore {
  return {
    async findByIdem(userId, idem) {
      const { data } = await db.from(CASINO_TABLE).select(COLS).eq("user_id", userId).eq("idem_key", idem).maybeSingle();
      return data ? fromDb(data as DbRow) : null;
    },
    async get(userId, id) {
      if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
      const { data } = await db.from(CASINO_TABLE).select(COLS).eq("user_id", userId).eq("id", id).maybeSingle();
      return data ? fromDb(data as DbRow) : null;
    },
    async insert(row) {
      const { data, error } = await db.from(CASINO_TABLE).insert(row).select(COLS).single();
      if (error) {
        if (error.code === "23505") return "conflict";
        throw new Error(error.message);
      }
      return fromDb(data as DbRow);
    },
    async update(userId, id, fromStep, patch) {
      const { data, error } = await db.from(CASINO_TABLE)
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("user_id", userId).eq("id", id).eq("step", fromStep)
        .select("id");
      if (error) throw new Error(error.message);
      return Array.isArray(data) && data.length > 0;
    },
    async countSince(userId, slot, game: CasinoGame, sinceMs) {
      const { count } = await db.from(CASINO_TABLE).select("id", { count: "exact", head: true })
        .eq("user_id", userId).eq("slot", slot).eq("game", game).gt("at", new Date(sinceMs).toISOString());
      return count ?? 0;
    },
  };
}

/**
 * Net casino result this account+slot had on the server between two times
 * (open hands count as their stake lost — the phone took it already).
 * null when the table is not there or cannot be read: the save guard then
 * uses its luck allowance, as before.
 */
export async function casinoNetBetween(db: Db, userId: string, slot: number, sinceMs: number | null, untilMs: number): Promise<number | null> {
  let q = db.from(CASINO_TABLE).select("net").eq("user_id", userId).eq("slot", slot)
    .lte("at", new Date(untilMs).toISOString());
  if (sinceMs != null && Number.isFinite(sinceMs)) q = q.gt("at", new Date(sinceMs).toISOString());
  const { data, error } = await q.limit(20000);
  if (error || !Array.isArray(data)) return null;
  return (data as { net: number | string }[]).reduce((s, r) => s + (Number(r.net) || 0), 0);
}

/** The last trusted save's money, wage and horse for this slot (or what a
 *  deleted slot's tombstone kept), plus the casino net since. */
export async function readTrusted(db: Db, userId: string, slot: number, now: number): Promise<Trusted | null> {
  const cols = "money:career->money, wage:career->contract->wage, horse:career->horse, "
    + "lmoney:career->last->money, lwage:career->last->contract->wage, lhorse:career->last->horse, updated_at";
  let { data, error } = await db.from("star_careers").select(cols).eq("user_id", userId).eq("slot", slot).maybeSingle();
  if (error && slot === 1) {
    ({ data, error } = await db.from("star_careers").select(cols).eq("user_id", userId).maybeSingle());
  }
  if (error || !data) return null;
  const r = data as unknown as Record<string, unknown>;
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);
  const money = r.money != null ? n(r.money) : n(r.lmoney);
  const wage = r.wage != null ? n(r.wage) : n(r.lwage);
  const h = (r.horse ?? r.lhorse) as { speed?: unknown; stamina?: unknown; energy?: unknown } | null;
  const horse = h && typeof h === "object"
    ? { speed: n(h.speed), stamina: n(h.stamina), energy: n(h.energy) } : null;
  const savedAt = new Date(String(r.updated_at)).getTime();
  const netSince = (await casinoNetBetween(db, userId, slot, savedAt, now)) ?? 0;
  return { money, wage, savedAt, horse, netSince };
}

/** Now and then, drop this account's own old settled rows. */
export async function pruneOldPlays(db: Db, userId: string, now: number): Promise<void> {
  const cutoff = new Date(now - CASINO_KEEP_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await db.from(CASINO_TABLE).delete().eq("user_id", userId).eq("status", "settled").lt("at", cutoff);
}
