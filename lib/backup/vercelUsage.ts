/**
 * lib/backup/vercelUsage.ts — Vercel's processor time for the morning limits post
 * (Mikey, 20 Nov 2026: back to Vercel's free plan, so warn before its 4-hour limit).
 *
 * Vercel's free (Hobby) plan includes 4 hours of function processor time
 * ("Fluid Active CPU") a month; going over stops the feature for up to 30 days,
 * which is what blocked the site in October. This reads the last 30 days from
 * Vercel's usage data. Needs VERCEL_TOKEN (a Vercel access token with read access)
 * in Vercel's environment variables; VERCEL_TEAM_ID is optional (this team's id
 * by default). Without the token the post says "not connected". Reads only.
 */

const DEFAULT_TEAM = "team_VGPp3RSeAq3FNaZRmyZr59zi";
const KEY = "vercel_function_invocation_function_cpu_time_ms_sum";

export type VercelCpu = { cpuMs: number } | { note: string };

export async function vercelCpuLast30Days(now: Date = new Date()): Promise<VercelCpu> {
  const token = process.env.VERCEL_TOKEN?.trim();
  if (!token) return { note: "Vercel usage is not connected (VERCEL_TOKEN not set)" };
  const team = process.env.VERCEL_TEAM_ID?.trim() || DEFAULT_TEAM;
  const end = new Date(Math.floor(now.getTime() / 3600_000) * 3600_000);
  const start = new Date(end.getTime() - 30 * 24 * 3600_000);
  try {
    const res = await fetch(`https://api.vercel.com/v2/observability/query?teamId=${encodeURIComponent(team)}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        metric: "vercel.function_invocation.function_cpu_time_ms",
        aggregation: "sum",
        scope: { type: "owner", ownerId: team },
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        granularity: { days: 1 },
      }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) return { note: `could not read Vercel usage (${res.status})` };
    const j = (await res.json()) as { summary?: Record<string, number>[]; result?: { summary?: Record<string, number>[] } };
    const v = (j.summary ?? j.result?.summary)?.[0]?.[KEY];
    return typeof v === "number" && Number.isFinite(v) ? { cpuMs: v } : { note: "could not read Vercel usage (no total)" };
  } catch {
    return { note: "could not read Vercel usage (no answer)" };
  }
}
