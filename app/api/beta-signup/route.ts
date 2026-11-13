import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * POST /api/beta-signup   { email }
 *
 * The public home's "Join the beta" box (components/home/BetaSignup.tsx).
 * Keeps one row per email in `beta_signups`
 * (supabase/migrations/beta_signups.sql: anyone may add, nobody may read).
 *
 * Answers:  { ok: true }                    kept (or already on the list)
 *           { ok: false, reason: "bad" }    not an email
 *           { ok: false, reason: "slow" }   too many tries from one place
 *           { ok: false, reason: "soon" }   the table is not there yet, or the
 *                                           site has no database keys: the
 *                                           form says "Sign-ups open soon"
 *           { ok: false, reason: "error" }  anything else
 */
export const dynamic = "force-dynamic";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;

// A simple limit: 5 tries per address per 10 minutes. Kept in memory, so it
// is per server copy; it stops a script hammering the form, not a determined
// attacker (the table's one-row-per-email rule is the real backstop).
const WINDOW_MS = 10 * 60 * 1000;
const MAX_TRIES = 5;
const tries = new Map<string, number[]>();

function tooMany(ip: string): boolean {
  const now = Date.now();
  const recent = (tries.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  tries.set(ip, recent);
  if (tries.size > 5000) {
    tries.forEach((v, k) => { if (!v.some((t) => now - t < WINDOW_MS)) tries.delete(k); });
  }
  return recent.length > MAX_TRIES;
}

export async function POST(request: Request) {
  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || request.headers.get("x-real-ip") || "unknown";
  if (tooMany(ip)) return NextResponse.json({ ok: false, reason: "slow" }, { status: 429 });

  let body: unknown = null;
  try { body = await request.json(); } catch {}
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;

  // The hidden box people never see: a robot filled it. Say thanks, keep nothing.
  if (typeof b.website === "string" && b.website.trim() !== "") return NextResponse.json({ ok: true });

  const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
  if (email.length < 5 || email.length > 254 || !EMAIL.test(email)) {
    return NextResponse.json({ ok: false, reason: "bad" }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Adding a row is open to everyone by the table's own rule, so the public
  // key is enough; the full-access key is used when it is there.
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.json({ ok: false, reason: "soon" });

  try {
    const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error } = await supabase.from("beta_signups").insert({ email, source: "home" });
    if (!error) return NextResponse.json({ ok: true });
    // Already on the list: the same happy answer (never tells a stranger who is on it).
    if (error.code === "23505") return NextResponse.json({ ok: true });
    if (error.code === "23514") return NextResponse.json({ ok: false, reason: "bad" }, { status: 400 });
    // The table has not been made yet (the SQL file has not been run).
    const missing = error.code === "42P01" || error.code === "PGRST205" || error.code === "PGRST204" || /beta_signups|schema cache|does not exist/i.test(error.message ?? "");
    if (missing) return NextResponse.json({ ok: false, reason: "soon" });
    console.error("[beta-signup]", error.code, error.message);
    return NextResponse.json({ ok: false, reason: "error" }, { status: 500 });
  } catch (e) {
    console.error("[beta-signup]", e);
    return NextResponse.json({ ok: false, reason: "soon" });
  }
}
