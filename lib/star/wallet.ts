/**
 * THE GEM WALLET, ON THE DEVICE SIDE — paid things that cannot be faked.
 *
 * Harry, 7 Oct 2026: "we are DEFINITELY going to have paid items … ideally
 * everything is safe."
 *
 * The career save is worked out on the device and synced to the server as it
 * is, so anyone with browser dev tools can edit it. Paid things therefore
 * never live in the save. Gems and what each account owns live only in the
 * database (supabase/migrations/star_wallet.sql), and only the server can
 * change them (spend_gems / grant_gems). This file only READS them:
 *
 *   - It keeps one copy in memory, filled from GET /api/star/wallet. It never
 *     reads or writes localStorage, sessionStorage or the career save, so
 *     editing any of those cannot add a gem or an item.
 *   - `ownsPaidItem(id)` is the one question the game asks about a paid item.
 *     Its answer comes from the server's list, never from the save.
 *   - Buying sends { item_id, idem_key } to POST /api/star/wallet/buy. The
 *     price charged is the database's, never this file's; the price sent is
 *     only "the price I saw", so a changed price charges nothing.
 *   - Signed out: no gems, nothing owned, and the screens say "Sign in".
 *
 * Match money (★, career.money) can never buy a paid item: nothing here takes
 * it, and the buy route does not accept it. See PAID_ITEMS.md.
 *
 * No React here (the hook is lib/star/useWallet.ts). Tested in
 * tests/star/wallet.mts.
 */

// ── Words the screens show ──────────────────────────────────────────────────

export const GEMS_OFF_MESSAGE = "Gems aren't switched on yet.";
export const GEMS_SIGN_IN_MESSAGE = "Sign in to use gems.";
export const GEMS_ERROR_MESSAGE = "Couldn't reach your gems. Try again in a moment.";

/** The database pieces for the wallet aren't there yet: Postgres
 *  `undefined_table` / `undefined_function`, or PostgREST's schema-cache miss
 *  for a table (PGRST205) or a function (PGRST202). Used by the routes. */
export function walletDbMissing(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false;
  if (err.code === "42P01" || err.code === "42883" || err.code === "PGRST205" || err.code === "PGRST202") return true;
  return /does not exist|could not find the (table|function)/i.test(err.message ?? "");
}

// ── Shapes ──────────────────────────────────────────────────────────────────

/** One thing that can be bought with gems (a row of star_paid_items). */
export interface PaidItem {
  id: string;
  name: string;
  kind: string;
  /** Gems. The database's price; shown, never trusted for charging. */
  price: number;
}

export type WalletStatus = "loading" | "ok" | "signed-out" | "off" | "error";

export interface WalletSnapshot {
  status: WalletStatus;
  gems: number;
  /** Item ids this account owns, from star_entitlements. */
  owned: string[];
  catalogue: PaidItem[];
  /** A plain line for the screen when status isn't "ok". */
  message?: string;
}

export const LOADING_WALLET: WalletSnapshot = { status: "loading", gems: 0, owned: [], catalogue: [] };

/** Item ids: lower case, digits and dashes (the database checks the same). */
export const PAID_ITEM_ID = /^[a-z0-9][a-z0-9-]{1,47}$/;
/** A buy request's one-off key (the database checks the same). */
export const IDEM_KEY = /^[A-Za-z0-9_-]{8,64}$/;

const MAX_GEMS = 1_000_000_000;

function wholeGems(v: unknown): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(MAX_GEMS, Math.floor(n));
}

function cleanItem(raw: unknown): PaidItem | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id : "";
  if (!PAID_ITEM_ID.test(id)) return null;
  const price = wholeGems(r.price);
  if (price < 1) return null;
  return {
    id,
    name: typeof r.name === "string" && r.name.trim() ? r.name.slice(0, 80) : id,
    kind: typeof r.kind === "string" ? r.kind.slice(0, 24) : "cosmetic",
    price,
  };
}

/**
 * GET /api/star/wallet's answer → a snapshot the screens can trust to be
 * well-formed. Anything odd reads as nothing owned and no gems, never as more.
 */
export function walletFromServer(raw: unknown, httpOk = true): WalletSnapshot {
  if (!raw || typeof raw !== "object") return { ...LOADING_WALLET, status: "error", message: GEMS_ERROR_MESSAGE };
  const r = raw as Record<string, unknown>;
  const catalogue = Array.isArray(r.catalogue)
    ? (r.catalogue.map(cleanItem).filter(Boolean) as PaidItem[])
    : [];
  if (r.signedOut === true) return { status: "signed-out", gems: 0, owned: [], catalogue, message: GEMS_SIGN_IN_MESSAGE };
  if (r.migrationMissing === true) return { status: "off", gems: 0, owned: [], catalogue: [], message: GEMS_OFF_MESSAGE };
  if (!httpOk || typeof r.error === "string") {
    return { status: "error", gems: 0, owned: [], catalogue, message: GEMS_ERROR_MESSAGE };
  }
  const owned = Array.isArray(r.owned)
    ? Array.from(new Set(r.owned.filter((x): x is string => typeof x === "string" && PAID_ITEM_ID.test(x))))
    : [];
  return { status: "ok", gems: wholeGems(r.gems), owned, catalogue };
}

/** Does this account own this paid item? Only ever true on the server's word. */
export function owns(w: WalletSnapshot, itemId: string): boolean {
  return w.status === "ok" && w.owned.includes(itemId);
}

export function canAfford(w: WalletSnapshot, item: PaidItem): boolean {
  return w.status === "ok" && w.gems >= item.price;
}

/** A fresh one-off key for one tap on Buy. */
export function newIdemKey(rand: () => number = Math.random): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID && rand === Math.random) return c.randomUUID().replace(/-/g, "");
  const abc = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let s = "";
  for (let i = 0; i < 32; i++) s += abc[Math.floor(rand() * abc.length) % abc.length];
  return s;
}

// ── Buying ──────────────────────────────────────────────────────────────────

export type BuyError =
  | "signed-out" | "off" | "not-for-sale" | "price-changed" | "not-enough-gems"
  | "bad-key" | "bad-item" | "network" | "error";

export type BuyResult =
  | { ok: true; itemId: string; gems: number; alreadyOwned: boolean; replay: boolean }
  | { ok: false; error: BuyError; gems?: number; price?: number };

const BUY_ERRORS: BuyError[] = ["signed-out", "off", "not-for-sale", "price-changed", "not-enough-gems", "bad-key", "bad-item", "network", "error"];

/** POST /api/star/wallet/buy's answer → a result. */
export function buyResultFromServer(raw: unknown, itemId: string): BuyResult {
  if (!raw || typeof raw !== "object") return { ok: false, error: "error" };
  const r = raw as Record<string, unknown>;
  if (r.ok === true) {
    return {
      ok: true,
      itemId,
      gems: wholeGems(r.gems),
      alreadyOwned: r.alreadyOwned === true,
      replay: r.replay === true,
    };
  }
  const code = typeof r.code === "string" && (BUY_ERRORS as string[]).includes(r.code) ? (r.code as BuyError) : "error";
  return {
    ok: false,
    error: code,
    gems: r.gems === undefined ? undefined : wholeGems(r.gems),
    price: r.price === undefined ? undefined : wholeGems(r.price),
  };
}

/** The line a screen shows when a buy didn't go through. */
export function buyProblem(error: BuyError, price?: number): string {
  switch (error) {
    case "signed-out": return GEMS_SIGN_IN_MESSAGE;
    case "off": return GEMS_OFF_MESSAGE;
    case "not-for-sale": return "That isn't for sale any more.";
    case "price-changed": return price ? `The price has changed to ${price} gems. Check it and try again.` : "The price has changed. Check it and try again.";
    case "not-enough-gems": return "Not enough gems.";
    case "network": return "No connection. Nothing was charged; try again.";
    default: return "That didn't work. Nothing was charged.";
  }
}

/** The snapshot after a buy: the server's new balance, and the item owned.
 *  A failed buy only takes the server's balance, if it sent one. */
export function applyBuy(w: WalletSnapshot, result: BuyResult): WalletSnapshot {
  if (w.status !== "ok") return w;
  if (!result.ok) return result.gems === undefined ? w : { ...w, gems: result.gems };
  const owned = w.owned.includes(result.itemId) ? w.owned : [...w.owned, result.itemId];
  return { ...w, gems: result.gems, owned };
}

// ── The live copy (memory only) ─────────────────────────────────────────────

type FetchLike = (input: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) =>
  Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

const defaultFetch: FetchLike = (input, init) => fetch(input, { ...init, cache: "no-store" });

let current: WalletSnapshot = LOADING_WALLET;
let pending: Promise<WalletSnapshot> | null = null;
const listeners = new Set<(w: WalletSnapshot) => void>();

function set(w: WalletSnapshot): WalletSnapshot {
  current = w;
  listeners.forEach(fn => fn(w));
  return w;
}

/** What the device last heard from the server (LOADING_WALLET before that). */
export function walletNow(): WalletSnapshot {
  return current;
}

/** Tell me whenever the wallet changes. Returns the "stop telling me". */
export function onWallet(fn: (w: WalletSnapshot) => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** Ask the server. One request at a time; `force` asks again even if known. */
export function loadWallet(opts: { force?: boolean; fetchImpl?: FetchLike } = {}): Promise<WalletSnapshot> {
  if (!opts.force && current.status !== "loading" && current.status !== "error") return Promise.resolve(current);
  if (pending) return pending;
  const f = opts.fetchImpl ?? defaultFetch;
  pending = f("/api/star/wallet")
    .then(async res => walletFromServer(await res.json().catch(() => null), res.ok))
    .catch(() => ({ ...LOADING_WALLET, status: "error" as const, message: GEMS_ERROR_MESSAGE }))
    .then(set)
    .finally(() => { pending = null; });
  return pending;
}

/** Signed out, or switched account: forget the last account's wallet. */
export function forgetWallet(): void {
  pending = null;
  set(LOADING_WALLET);
}

/**
 * THE question the game asks about a paid item. True only when the server's
 * list says so. A save, a localStorage key or a URL can't make it true.
 */
export function ownsPaidItem(itemId: string): boolean {
  return owns(current, itemId);
}

/**
 * Buy one paid item with gems. One key per call: if the network drops, the
 * same key is sent once more, so a tap is never charged twice.
 */
export async function buyPaidItem(item: PaidItem, opts: { fetchImpl?: FetchLike; idemKey?: string } = {}): Promise<BuyResult> {
  if (!PAID_ITEM_ID.test(item.id)) return { ok: false, error: "bad-item" };
  const f = opts.fetchImpl ?? defaultFetch;
  const key = opts.idemKey ?? newIdemKey();
  const body = JSON.stringify({ item_id: item.id, idem_key: key, expected_price: item.price });
  let result: BuyResult = { ok: false, error: "network" };
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await f("/api/star/wallet/buy", { method: "POST", headers: { "Content-Type": "application/json" }, body });
      result = buyResultFromServer(await res.json().catch(() => null), item.id);
      break;
    } catch {
      result = { ok: false, error: "network" };
    }
  }
  set(applyBuy(current, result));
  return result;
}
