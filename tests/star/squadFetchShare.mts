/**
 * fetchLeagueSquads shares one download between callers asking for the same
 * clubs at once (measured 28 Sep 2026: the first screen downloaded the same
 * division twice and a near-copy a third time). A failed download is not
 * remembered, so the next ask tries again.
 */
let calls: string[] = [];
let fail = false;
(globalThis as any).fetch = async (url: string) => {
  calls.push(url);
  if (fail) return { ok: false, json: async () => ({}) };
  const clubs = decodeURIComponent(new URL(url, "http://x").searchParams.get("clubs") ?? "").split("|");
  const squads: Record<string, unknown[]> = {};
  for (const c of clubs) squads[c] = [];
  return { ok: true, json: async () => ({ squads }) };
};
const { fetchLeagueSquads } = await import("../../lib/star/leagueSquads");

let bad = 0;
const check = (ok: boolean, msg: string) => { if (!ok) { bad++; console.log("  ✗ " + msg); } };

const A = ["Chelsea", "Arsenal", "Fulham"];
await Promise.all([fetchLeagueSquads(A), fetchLeagueSquads(A), fetchLeagueSquads(A.slice(0, 2))]);
check(calls.length === 1, `three callers at once → one request (got ${calls.length})`);

calls = [];
const r = await fetchLeagueSquads([...A, "Everton"]);
check(calls.length === 1 && calls[0].includes("Everton") && !calls[0].includes("Chelsea"), "only the missing club is asked for");
check(r.length === 4 && r.map((s) => s.club).join() === [...A, "Everton"].join(), "results come back in the order asked, one per club");

calls = []; fail = true;
const f = await fetchLeagueSquads(["Wolves"]);
check(f.length === 1 && f[0].players.length > 0, "a failed download falls back to a generated squad");
fail = false;
await fetchLeagueSquads(["Wolves"]);
check(calls.length === 2, "a failed download is not remembered; the next ask tries again");

if (bad) { console.log(`FAIL — ${bad} check(s)`); process.exit(1); }
console.log("PASS — callers share one squad download; failures are retried");
