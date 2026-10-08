/**
 * THE CASINO ON THE PHONE — ask the server to roll, or roll here.
 *
 * Harry, 8 Oct 2026: "move the casino to the server". When the player is
 * signed in and the server's casino is switched on (star_casino.sql has run),
 * every bet goes to /api/star/casino/play and the phone shows what the server
 * rolled. Otherwise (signed out, the dev sandbox's local career, or before
 * the migration) the phone rolls exactly as it always did — there is no cloud
 * save to protect then.
 *
 * A network failure never falls back to local play (that would let a player
 * pull the cable to roll on the phone): it says so, and nothing is charged.
 *
 * No React here. The games in components/star/Casino.tsx and GoalieMode.tsx
 * call `casinoMode()` and `casinoCall()`.
 */

import { CASINO_ON_SERVER } from "./casinoRules";
export const CASINO_OFFLINE_MESSAGE = "Couldn't reach the casino. Nothing was charged — try again.";

export type CasinoMode = { kind: "server"; slot: number } | { kind: "local" };

let modePromise: Promise<CasinoMode | null> | null = null;
let forcedLocal = false;

/** The save the player is in (storage.ts's active slot for this account). */
async function activeSlot(): Promise<number> {
  try {
    const [{ createClient }, { loadActiveSlot }] = await Promise.all([
      import("@/lib/supabase/client"), import("./storage"),
    ]);
    const { data } = await createClient().auth.getSession();
    const id = data.session?.user?.id;
    return id ? loadActiveSlot(id) : 1;
  } catch {
    return 1;
  }
}

async function probe(): Promise<CasinoMode | null> {
  if (forcedLocal) return { kind: "local" };
  let res: Response;
  try { res = await fetch("/api/star/casino/play", { cache: "no-store" }); } catch { return null; }
  if (!res.ok) return null;
  const body = await res.json().catch(() => null) as { ready?: boolean } | null;
  if (body?.ready === true) return { kind: "server", slot: await activeSlot() };
  if (body) return { kind: "local" };
  return null;
}

/** Server or local for this visit. null = the server could not be reached
 *  (asked again next time). Cached once known. */
export async function casinoMode(): Promise<CasinoMode | null> {
  if (!CASINO_ON_SERVER || forcedLocal) return { kind: "local" };
  if (!modePromise) modePromise = probe();
  const m = await modePromise;
  if (!m) modePromise = null;
  return m;
}

/** Forget the cached answer (a new casino visit asks again). */
export function resetCasinoMode(): void {
  modePromise = null;
  forcedLocal = false;
}

export function newPlayKey(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c?.randomUUID) return c.randomUUID();
  return `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

export type CasinoAnswer<T> =
  | { kind: "ok"; result: T }
  | { kind: "local" }
  | { kind: "error"; message: string };

/**
 * One request to the server's casino. `local` means the server said this
 * account plays locally (signed out, or the table isn't there): the caller
 * rolls on the phone as before. Network trouble is retried twice, then
 * reported as an error (nothing charged; a retry with the same key is safe).
 */
export async function casinoCall<T>(slot: number, body: Record<string, unknown>): Promise<CasinoAnswer<T>> {
  const payload = JSON.stringify({ ...body, slot });
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch("/api/star/casino/play", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: payload,
      });
      const data = await res.json().catch(() => null) as
        { result?: T; error?: string; signedOut?: boolean; migrationMissing?: boolean } | null;
      if (data?.signedOut || data?.migrationMissing) {
        forcedLocal = true;
        return { kind: "local" };
      }
      if (res.ok && data && "result" in data) return { kind: "ok", result: data.result as T };
      if (data?.error && res.status < 500) return { kind: "error", message: data.error };
    } catch {
      // network: try again
    }
    await new Promise(r => setTimeout(r, 400 * (attempt + 1)));
  }
  return { kind: "error", message: CASINO_OFFLINE_MESSAGE };
}

export type Played<T> =
  | { kind: "ok"; result: T; /** The server rolled it (null: the phone did). */ slot: number | null }
  | { kind: "error"; message: string };

/**
 * Play one bet: on the server when this account plays there, otherwise by
 * calling `local()` (today's phone roll). Every bet gets its own request key
 * unless the caller passes one (a horse card, a retried step).
 */
export async function playOrLocal<T>(body: Record<string, unknown>, local: () => T): Promise<Played<T>> {
  const m = await casinoMode();
  if (!m) return { kind: "error", message: CASINO_OFFLINE_MESSAGE };
  if (m.kind === "local") return { kind: "ok", result: local(), slot: null };
  const a = await casinoCall<T>(m.slot, { idemKey: newPlayKey(), ...body });
  if (a.kind === "local") return { kind: "ok", result: local(), slot: null };
  if (a.kind === "error") return a;
  return { kind: "ok", result: a.result, slot: m.slot };
}
