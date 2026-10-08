import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";
import { handlePlay } from "@/lib/star/casinoEngine";
import { cryptoRng } from "@/lib/star/casinoRules";
import { casinoTableReady, pruneOldPlays, readTrusted, supabaseCasinoStore } from "@/lib/star/casinoDb";
import { walletDbMissing } from "@/lib/star/wallet";

/**
 * /api/star/casino/play — the casino, rolled and paid by the server
 * (Harry, 8 Oct 2026: "move the casino to the server").
 *
 * GET   { ready: true } | { signedOut: true } | { migrationMissing: true }
 *       The phone asks once per casino visit. Anything but `ready` means it
 *       plays locally, exactly as before (no cloud save to protect).
 * POST  { game, action?, stake?, bank?, choice?, pick?, card?, sig?, horse?,
 *         dive?, playId?, slot, idemKey }
 *       → { result } | { error } | { signedOut } | { migrationMissing }
 *
 * All the rules and checks are in lib/star/casinoEngine.ts. Every play is a
 * row in star_casino_plays (supabase/migrations/star_casino.sql), written
 * with the service key only; the save guard (lib/star/saveGuard.ts) allows
 * casino money only up to what these rows add up to.
 */

export const dynamic = "force-dynamic";

const MIN_SLOT = 1;
const MAX_SLOT = 3;

function service() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) return null;
  try { return createServiceClient(); } catch { return null; }
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ signedOut: true });
  const db = service();
  if (!db || !(await casinoTableReady(db))) return NextResponse.json({ migrationMissing: true });
  return NextResponse.json({ ready: true });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ signedOut: true });
  const db = service();
  if (!db) return NextResponse.json({ migrationMissing: true });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Not a play." }, { status: 400 }); }
  const rawSlot = (body as { slot?: unknown } | null)?.slot;
  const slot = typeof rawSlot === "number" && Number.isInteger(rawSlot) && rawSlot >= MIN_SLOT && rawSlot <= MAX_SLOT ? rawSlot : MIN_SLOT;
  const now = Date.now();

  let trustedOnce: ReturnType<typeof readTrusted> | null = null;
  try {
    const answer = await handlePlay(body, {
      userId: user.id, slot, now, rng: cryptoRng(),
      secret: process.env.STAR_CASINO_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY!,
      trusted: () => (trustedOnce ??= readTrusted(db, user.id, slot, now).catch(() => null)),
    }, supabaseCasinoStore(db));
    // Keep the table small: one request in fifty clears this account's own
    // settled rows older than 60 days.
    if (Math.random() < 0.02) void pruneOldPlays(db, user.id, now).catch(() => {});
    return NextResponse.json(answer.body, { status: answer.status });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (walletDbMissing({ message: msg })) return NextResponse.json({ migrationMissing: true });
    console.error("[star/casino] play failed:", msg);
    return NextResponse.json({ error: "The casino couldn't take that bet. Nothing was charged." }, { status: 500 });
  }
}
