/**
 * lib/testerLinks.ts — tester links (/tester/K7Q2XM) and what opening one does.
 *
 * Codes are six characters from an alphabet with no look-alikes (no I, L, O,
 * 0 or 1), so a code read out loud or copied by hand still works. 31^6 is
 * about 887 million codes; an admin makes a handful, and a guessed code still
 * needs a signed-in account and only gives tester tools, never admin ones.
 *
 * No imports except the role reader: the server routes hand in the
 * service-role Supabase client, and the tests hand in a fake one.
 */

import { readRole, type RoleClient } from "./roles";

export const TESTER_CODE_LENGTH = 6;
export const TESTER_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** A fair random whole number in [0, n), from the platform's secure source. */
function secureInt(n: number): number {
  const buf = new Uint32Array(1);
  // Throw away the top slice of the range so every value is equally likely.
  const limit = Math.floor(0x1_0000_0000 / n) * n;
  for (;;) {
    globalThis.crypto.getRandomValues(buf);
    if (buf[0] < limit) return buf[0] % n;
  }
}

/** A new random code. `randomInt` is only passed in by tests. */
export function newTesterCode(randomInt: (n: number) => number = secureInt): string {
  let code = "";
  for (let i = 0; i < TESTER_CODE_LENGTH; i++) {
    code += TESTER_CODE_ALPHABET[randomInt(TESTER_CODE_ALPHABET.length)];
  }
  return code;
}

/**
 * A code as typed or pasted → the stored form, or null if it can't be one.
 * Forgiving about case and spaces; strict about everything else.
 */
export function normaliseTesterCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const code = raw.trim().toUpperCase();
  if (code.length !== TESTER_CODE_LENGTH) return null;
  for (const ch of code) if (!TESTER_CODE_ALPHABET.includes(ch)) return null;
  return code;
}

/** The path a tester link opens. */
export function testerLinkPath(code: string): string {
  return `/tester/${code}`;
}

// ── Opening a link ──────────────────────────────────────────────────────────

/**
 * What happened when someone opened a link.
 *  - joined    — they are a tester now.
 *  - already   — they were already a tester (or an admin). Nothing changed.
 *  - off       — the link exists but an admin switched it off.
 *  - unknown   — no such link.
 *  - not-ready — tester links aren't set up in the database yet
 *                (tester_access.sql not run), or the database said no.
 */
export type ClaimOutcome = "joined" | "already" | "off" | "unknown" | "not-ready";

export interface LinkRow {
  code: string;
  active: boolean | null;
  uses: number | null;
}

interface Res<T> { data: T; error: unknown }

/** The bits of a Supabase client the link helpers use. */
export interface TesterClient extends RoleClient {
  from(table: string): ReturnType<RoleClient["from"]> & {
    upsert(values: Record<string, unknown>, options: { onConflict: string }): PromiseLike<Res<unknown>>;
    update(values: Record<string, unknown>): {
      eq(column: string, value: string): PromiseLike<Res<unknown>>;
    };
  };
}

/** Look a link up. `undefined` = the table can't be read (not set up). */
export async function findLink(client: TesterClient, code: string): Promise<LinkRow | null | undefined> {
  try {
    const res = (await client.from("tester_links").select("code, active, uses").eq("code", code).maybeSingle()) as unknown as Res<LinkRow | null>;
    if (res.error) return undefined;
    return res.data ?? null;
  } catch {
    return undefined;
  }
}

/** The outcome of opening a link, without changing anything. */
export function outcomeForLink(link: LinkRow | null | undefined): ClaimOutcome | null {
  if (link === undefined) return "not-ready";
  if (link === null) return "unknown";
  if (link.active !== true) return "off";
  return null; // a live link
}

/**
 * Opening a link while signed in: make this user a tester. Server only — the
 * client must be the service-role one (no player may write user_roles).
 * Never throws.
 */
export async function claimTesterLink(client: TesterClient, rawCode: unknown, userId: string): Promise<ClaimOutcome> {
  const code = normaliseTesterCode(rawCode);
  if (!code) return "unknown";
  const link = await findLink(client, code);
  const blocked = outcomeForLink(link);
  if (blocked) return blocked;

  const role = await readRole(client, userId);
  if (role !== "player") return "already";

  try {
    // Only is_tester is sent, so an existing row keeps its is_admin as it is.
    const up = await client.from("user_roles").upsert({ user_id: userId, is_tester: true }, { onConflict: "user_id" });
    if (up.error) return "not-ready";
    // The count is only for the admin page; a failed count doesn't undo the join.
    await client.from("tester_links").update({ uses: (link?.uses ?? 0) + 1 }).eq("code", code);
  } catch {
    return "not-ready";
  }
  return "joined";
}
