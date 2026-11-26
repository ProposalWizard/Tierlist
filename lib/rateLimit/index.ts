/**
 * lib/rateLimit — "slow down" for the site's write routes (Mikey, 26 Nov 2026).
 *
 * One person or a bot hammering a route could use up the free plan's server
 * time and pause the site for everyone. Each protected route asks here first;
 * the count lives in Supabase (supabase/migrations/rate_limits.sql), keyed by
 * the signed-in account when there is one, else the internet address.
 *
 * Limits sit far above real play, and a school or office sharing one address
 * still fits (accounts are counted on their own). If the count can't be read
 * (the table missing, Supabase down), the request is allowed: this never
 * blocks real players because of its own fault.
 */
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export type Limit = { name: string; max: number; windowSeconds: number };

/** The limits, per person, in one place so they are easy to read and change. */
export const LIMITS = {
  betaSignup: { name: "beta-signup", max: 5, windowSeconds: 600 },
  tierlistView: { name: "tierlist-view", max: 60, windowSeconds: 60 },
  challengeDraft: { name: "challenge-draft", max: 40, windowSeconds: 60 },
  roomCreate: { name: "room-create", max: 15, windowSeconds: 60 },
  bugRing: { name: "bug-ring", max: 6, windowSeconds: 60 },
  roomWarm: { name: "room-warm", max: 20, windowSeconds: 60 },
  testerClaim: { name: "tester-claim", max: 10, windowSeconds: 600 },
  vote: { name: "vote", max: 120, windowSeconds: 60 },
} satisfies Record<string, Limit>;

/** The visitor's internet address, as Vercel passes it on. */
export function clientAddress(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0] || req.headers.get("x-real-ip") || "unknown").trim();
}

/** True when this person is over the limit for this route. */
export async function overLimit(req: Request, limit: Limit, userId?: string | null): Promise<boolean> {
  const who = userId ? `u:${userId}` : `ip:${clientAddress(req)}`;
  try {
    const { data, error } = await createServiceClient().rpc("rate_hit", {
      p_key: `${limit.name}:${who}`,
      p_window_seconds: limit.windowSeconds,
      p_max: limit.max,
    });
    if (error) return false;
    return data === false;
  } catch {
    return false;
  }
}

/** The answer a player sees: plain words, and when to try again. */
export function slowDown(limit: Limit): NextResponse {
  const secs = limit.windowSeconds;
  return NextResponse.json(
    { error: `Slow down a little: please try again in ${secs >= 120 ? `${Math.round(secs / 60)} minutes` : "a minute"}.` },
    { status: 429, headers: { "Retry-After": String(secs) } },
  );
}
