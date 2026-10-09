import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isTester } from "@/lib/admin";
import {
  checkSave, guardModeFrom, looksLikeCareer, readServerGuard, refillLuck,
  type LuckState,
} from "@/lib/star/saveGuard";
import { NextResponse } from "next/server";
import { casinoNetBetween } from "@/lib/star/casinoDb";
import { CASINO_ON_SERVER } from "@/lib/star/casinoRules";

const MIN_SLOT = 1;
const MAX_SLOT = 3; // MAX_SAVE_SLOTS, lib/star/storage.ts

/**
 * `?slot=` is new — see supabase/migrations/star_career_slots.sql (PENDING).
 * Anything absent, non-numeric, or out of range quietly becomes slot 1
 * rather than erroring, so an old cached page or a stray request never
 * fails loudly over this.
 */
function parseSlot(req: Request): number {
  const raw = new URL(req.url).searchParams.get("slot");
  const n = raw === null ? NaN : parseInt(raw, 10);
  return Number.isInteger(n) && n >= MIN_SLOT && n <= MAX_SLOT ? n : MIN_SLOT;
}

type Db = Awaited<ReturnType<typeof createClient>>;

/**
 * Who writes saves. The service key, so star_save_guard.sql can take write
 * access away from the browser (a player could otherwise skip this route
 * and write their row directly with their own login). Without the key (a
 * local sandbox) it falls back to the player's own login, exactly as before.
 */
function writerFor(userClient: Db): Db {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) return userClient;
  try { return createServiceClient() as unknown as Db; } catch { return userClient; }
}

/** The server's own bookkeeping never goes back to the game: the game would
 *  read it as progress (saveClash.ts) and post it back, where it is ignored. */
function forClient(career: unknown): unknown {
  if (!career || typeof career !== "object") return career;
  const { serverGuard: _g, ...rest } = career as Record<string, unknown>;
  void _g;
  return rest;
}

/** A deleted slot is kept as a tombstone (see DELETE): no save to load. */
function isTombstone(career: unknown): boolean {
  return !!career && typeof career === "object" && (career as { tombstone?: unknown }).tombstone === true;
}

/** This slot's stored row (career + when), with the pre-slots fallback. */
async function readRow(db: Db, userId: string, slot: number): Promise<{ career: unknown; updated_at: string } | null> {
  let { data, error } = await db
    .from("star_careers")
    .select("career, updated_at")
    .eq("user_id", userId)
    .eq("slot", slot)
    .maybeSingle();
  // star_career_slots.sql may not have run against the live database yet —
  // selecting/filtering on a column that doesn't exist fails the WHOLE
  // query, not just the missing part (the same Supabase behaviour
  // league-squads/route.ts already has to work around). Slot 1 is the exact
  // save every account already had before slots existed, so it falls back
  // to the pre-slots query shape here rather than ever losing it. A slot
  // other than 1 simply cannot exist yet, which reads as "no cloud save".
  if (error && slot === MIN_SLOT) {
    ({ data, error } = await db
      .from("star_careers")
      .select("career, updated_at")
      .eq("user_id", userId)
      .maybeSingle());
  }
  if (error || !data) return null;
  return data as { career: unknown; updated_at: string };
}

/** One luck allowance per account, not per slot: the lowest left across
 *  every slot (lib/star/saveGuard.ts, "The casino"). */
async function accountLuck(db: Db, userId: string, now: number, fallback: unknown): Promise<LuckState | null> {
  const own = readServerGuard(fallback)?.luck ?? null;
  try {
    const { data, error } = await db
      .from("star_careers")
      .select("guard:career->serverGuard")
      .eq("user_id", userId);
    if (error || !Array.isArray(data)) return own;
    let lowest: LuckState | null = own ? refillLuck(own, now) : null;
    for (const row of data as { guard: unknown }[]) {
      const g = readServerGuard({ serverGuard: row.guard });
      if (!g) continue;
      const l = refillLuck(g.luck, now);
      if (!lowest || l.left < lowest.left) lowest = l;
    }
    return lowest;
  } catch {
    return own;
  }
}

async function upsertCareer(db: Db, userId: string, slot: number, career: unknown, updated_at: string) {
  let { error } = await db
    .from("star_careers")
    .upsert({ user_id: userId, slot, career, updated_at }, { onConflict: "user_id,slot" });
  // Same fallback as reading, for the same reason: slot 1 degrades to the
  // exact upsert this route always used before slots existed. A slot other
  // than 1 has no pre-slots shape to fall back to — it stays local-only
  // until star_career_slots.sql runs.
  if (error && slot === MIN_SLOT) {
    ({ error } = await db
      .from("star_careers")
      .upsert({ user_id: userId, career, updated_at }, { onConflict: "user_id" }));
  }
  return error;
}

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json(null);
  const row = await readRow(supabase, user.id, parseSlot(req));
  if (!row || isTombstone(row.career)) return NextResponse.json(null);
  // The timestamp travels WITH the career — see loadCareerFromCloud.
  // Without it the client has no way to tell a cloud save that is ahead of
  // localStorage apart from one that is stale and behind it.
  return NextResponse.json({ career: forClient(row.career), updatedAt: row.updated_at });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json(null);
  const slot = parseSlot(req);
  const db = writerFor(supabase);
  const mode = guardModeFrom(process.env.STAR_SAVE_GUARD);

  let career: unknown;
  try { career = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!career || typeof career !== "object" || Array.isArray(career)) {
    return NextResponse.json({ error: "Not a save" }, { status: 400 });
  }
  if (mode === "enforce" && !looksLikeCareer(career)) {
    return NextResponse.json({ error: "Not a save" }, { status: 400 });
  }

  // ── The save guard (lib/star/saveGuard.ts) ──
  // Compared with the last trusted save in this slot (or, after a delete,
  // the tombstone that kept it). Admins and testers are never checked: they
  // have Add Money and god mode on purpose. Any failure here falls back to
  // storing the save as sent — the guard must never stop an honest save.
  const now = Date.now();
  let toStore: unknown = career;
  let corrected: string[] = [];
  if (mode !== "off") {
    try {
      const prev = await readRow(db, user.id, slot);
      const exempt = await isTester(user.id);
      const prevSavedAt = prev ? new Date(prev.updated_at).getTime() : null;
      // The server casino's own record since the last trusted save
      // (star_casino_plays). null when star_casino.sql has not run, or this
      // is a sandbox without the service key: the guard then falls back to
      // its luck allowance.
      const casinoNet = CASINO_ON_SERVER && db !== supabase ? await casinoNetBetween(db as never, user.id, slot, prevSavedAt, now) : null;
      const result = checkSave(prev?.career ?? null, career, {
        mode, exempt, now, prevSavedAt,
        luck: await accountLuck(db, user.id, now, prev?.career),
        casinoNet,
      });
      toStore = result.clamped;
      corrected = result.corrected;
      if (result.findings.length > 0) {
        const verdict = result.ok ? "watch" : "cheat";
        console.warn(`[star/career] save guard: ${verdict} (${mode}) user=${user.id} slot=${slot}`,
          JSON.stringify(result.findings));
        try {
          const { error } = await createServiceClient().from("star_save_flags").insert({
            user_id: user.id, slot, mode, verdict, findings: result.findings,
            prev_keys: result.prevKeys, next_keys: result.nextKeys, corrected,
          });
          // star_save_guard.sql not run yet: the log line above is the record.
          if (error) console.warn("[star/career] save flag not stored:", error.message);
        } catch (e) {
          console.warn("[star/career] save flag not stored:", e instanceof Error ? e.message : e);
        }
      }
    } catch (e) {
      console.error("[star/career] save guard skipped:", e instanceof Error ? e.message : e);
      toStore = career;
      corrected = [];
    }
  }

  const error = await upsertCareer(db, user.id, slot, toStore, new Date(now).toISOString());
  if (error) {
    // Never surfaced to the player — saveCareerToCloud is fire-and-forget by
    // design — but worth a server-side trace: a real problem, or simply a
    // pending migration for a non-primary slot.
    console.error("[star/career] cloud save failed:", error.message);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  // Enforce mode put fields back: the game reloads from this copy.
  if (corrected.length > 0) {
    return NextResponse.json({ ok: true, corrected, career: forClient(toStore) });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json(null);
  const slot = parseSlot(req);
  const db = writerFor(supabase);

  // With the service key, a deleted slot becomes a TOMBSTONE that keeps the
  // last trusted career out of sight: GET reads it as empty, and the next
  // save in this slot is still compared with it. Otherwise "delete, then
  // upload an edited copy as if it were new" would skip every check. A
  // genuinely new career is recognised as one (lib/star/saveGuard.ts).
  if (db !== supabase) {
    const prev = await readRow(db, user.id, slot);
    if (!prev) return NextResponse.json({ ok: true });
    const last = isTombstone(prev.career) ? (prev.career as { last?: unknown }).last : prev.career;
    const guard = readServerGuard(prev.career);
    const tombstone = { tombstone: true, deletedAt: new Date().toISOString(), last: last ?? null, ...(guard ? { serverGuard: guard } : {}) };
    const error = await upsertCareer(db, user.id, slot, tombstone, new Date().toISOString());
    return NextResponse.json({ ok: !error });
  }

  let { error } = await supabase.from("star_careers").delete()
    .eq("user_id", user.id).eq("slot", slot);
  if (error && slot === MIN_SLOT) {
    ({ error } = await supabase.from("star_careers").delete().eq("user_id", user.id));
  }
  return NextResponse.json({ ok: !error });
}
