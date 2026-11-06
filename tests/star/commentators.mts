/**
 * Different commentators (Leo, 31 Oct 2026; lib/star/goalClip/commentators.ts).
 *  1. OFF (the default, and always on the server/in tests): every goal-video
 *     sound plan is byte-for-byte the one made before this change
 *     (fixtures/goalClips/plan-golden.json, scripts/commentary/make-plan-golden.mts).
 *  2. The team is chosen deterministically: the same match always gets the
 *     same team; an official TV account a TV team; any other account Fan TV.
 *  3. ON ("teams"): only that team's own lines, each with its recording and
 *     length, and the voices never talk over each other.
 */
import { readFileSync, existsSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { planAudio } from "../../lib/star/goalClip/audio";
import { allCommentaryLines, LATE_CALLS } from "../../lib/star/goalClip/commentary";
import {
  TEAMS, TEAM_IDS, COMMENTATORS, teamFor, teamBank, matchKeyOf, allTeamLines, commentatorLines, type TeamId,
} from "../../lib/star/goalClip/commentators";
import { commentarySet, commentaryTable, commentaryUrl } from "../../lib/star/goalClip/commentaryVoice";
import { lateGoalLine } from "../../lib/star/lateCommentary";
import { LEO_FEATURES } from "../../lib/star/leoUpdate";
import { planCases } from "../../scripts/commentary/plan-cases.mts";

const problems: string[] = [];
const check = (ok: boolean, msg: string) => { if (!ok) problems.push(msg); };
const fp = (x: unknown) => createHash("sha256").update(JSON.stringify(x)).digest("hex").slice(0, 16);

// ── 1. Off = exactly as before ─────────────────────────────────────────────
check(commentarySet() === "v1", "switch off outside a browser: the old voice");
check(LEO_FEATURES.some(f => f.id === "commentators"), "the switch part exists");
const golden = JSON.parse(readFileSync(new URL("./fixtures/goalClips/plan-golden.json", import.meta.url), "utf8")) as Record<string, string>;
const cases = planCases();
let compared = 0;
for (const c of cases) {
  for (const v of ["v1", "default"] as const) {
    const want = golden[`${c.name} ${v}`];
    check(!!want, `golden has ${c.name} ${v}`);
    const got = fp(v === "v1" ? planAudio(c.edit, "v1") : planAudio(c.edit));
    check(got === want, `${c.name} ${v}: plan changed with the switch off`);
    compared++;
  }
}
check(compared === Object.keys(golden).length && compared > 500, `compared every golden plan (${compared})`);
check(commentaryUrl("cl-g1", "v1") === "/sfx/cl-g1.mp3", "old voice: the old file");
check(lateGoalLine("winner", 7) === lateGoalLine("winner", 7, "v1"), "late call off: unchanged");
check(Object.values(LATE_CALLS).flat().some(l => l.id === lateGoalLine("level", 3)), "late call off: one of the old lines");

// ── 2. Who commentates ─────────────────────────────────────────────────────
for (let i = 0; i < 50; i++) {
  const k = matchKeyOf({ home: `Club ${i}`, away: `Club ${i + 1}`, season: 1 + (i % 3), week: i });
  check(teamFor(k) === teamFor(k), `same match, same team (${k})`);
  check(TEAMS[teamFor(k, { archetype: "club" })].tv, `${k}: an official account gets a TV team`);
  check(teamFor(k, { archetype: "club" }) === teamFor(k, { archetype: "league", handle: "x" }), `${k}: every official account, the same TV team`);
  check(teamFor(k, { archetype: "meme", platform: "tiktok" }) === "fantv", `${k}: a meme page gets Fan TV`);
  check(teamFor(k, { archetype: "tabloid" }) === "fantv", `${k}: a non-official account gets Fan TV`);
}
const seen = new Map<TeamId, number>();
for (let i = 0; i < 400; i++) { const t = teamFor(matchKeyOf({ home: `H${i}`, away: `A${i}`, season: 1, week: i % 38 })); seen.set(t, (seen.get(t) ?? 0) + 1); }
for (const t of TEAM_IDS) check((seen.get(t) ?? 0) > 50, `team ${t} gets a fair share of matches (${seen.get(t) ?? 0}/400)`);

// ── 3. The teams' lines and recordings ────────────────────────────────────
const all = allTeamLines();
const ids = all.map(l => l.id);
check(new Set(ids).size === ids.length, "team line ids unique");
const oldIds = new Set(allCommentaryLines().map(l => l.id));
check(ids.every(id => !oldIds.has(id)), "team ids never reuse an old line's id");
check(ids.every(id => id.startsWith("cl-") || id.startsWith("cc-")), "team ids are commentary ids (cl-/cc-)");
for (const who of Object.keys(COMMENTATORS) as (keyof typeof COMMENTATORS)[]) {
  check(commentatorLines(who).length >= 30, `${who}: at least 30 lines (${commentatorLines(who).length})`);
}
const leads = new Set(TEAM_IDS.map(t => TEAMS[t].lead));
check(leads.size >= 4, "four different lead commentators");
check(new Set(TEAM_IDS.map(t => TEAMS[t].co)).size >= 2, "at least two co-commentators");
const secs = commentaryTable("teams");
for (const l of all) {
  const f = new URL(`../../public/sfx/teams/${l.id}.mp3`, import.meta.url);
  check(existsSync(f), `recording for ${l.id}`);
  if (existsSync(f)) check(statSync(f).size < 80_000, `${l.id}: small file (${statSync(f).size} bytes)`);
  const s = secs[l.id] ?? 0;
  check(s > 0.4 && s < 6, `${l.id}: length ${s}s`);
}
check(commentaryUrl("cl-poet-g1", "teams") === "/sfx/teams/cl-poet-g1.mp3", "teams: their own folder");

for (const c of cases) {
  const a = planAudio(c.edit, "teams");
  const b = planAudio(c.edit, "teams");
  check(JSON.stringify(a) === JSON.stringify(b), `${c.name}: the same video, the same commentary`);
  check(a.voice === "teams" && !!a.team, `${c.name}: on = teams plan with a team`);
  const team = a.team as TeamId;
  check(team === teamFor(matchKeyOf(c.edit.tracks[0].meta)), `${c.name}: team chosen by the match`);
  const bank = teamBank(team);
  const own = new Set([
    ...Object.values(bank.calls).flat(), ...Object.values(bank.scoreLines).flat(), ...Object.values(bank.replayLines).flat(),
    ...bank.reelLines, ...Object.values(bank.lateCalls).flat(), ...bank.lateReplayLines,
  ].map(l => l.id));
  const talk = a.cues.filter(q => q.sound.startsWith("cl-") || q.sound.startsWith("cc-"));
  check(talk.every(q => own.has(q.sound)), `${c.name}: only ${team}'s own lines`);
  for (let i = 1; i < talk.length; i++) {
    const prevEnd = talk[i - 1].at + (secs[talk[i - 1].sound] ?? 0);
    check(talk[i].at >= prevEnd - 1e-6, `${c.name}: ${talk[i].sound} starts after ${talk[i - 1].sound} ends`);
  }
  check(a.cues.every(q => q.at <= a.duration + 1e-6), `${c.name}: every sound inside the video`);
  // The pitch sounds (kicks, net, crowd) are the same as with the switch off.
  const fx = (p: typeof a) => JSON.stringify(p.cues.filter(q => !q.sound.startsWith("cl-") && !q.sound.startsWith("cc-")));
  check(fx(a) === fx(planAudio(c.edit, "v1")), `${c.name}: same kicks, net and crowd as before`);
  const tv = planAudio(c.edit, "teams", { archetype: "competition" });
  check(!tv.team || TEAMS[tv.team].tv, `${c.name}: posted by the competition, a TV team`);
  const fan = planAudio(c.edit, "teams", { archetype: "aggregator", platform: "x" });
  check(fan.team === "fantv", `${c.name}: posted by a page, Fan TV`);
}
// The live late call with the switch on: that team's own late lines.
for (const s of [1, 2, 3, 40, 99]) {
  const key = matchKeyOf({ home: "H", away: "A", season: 2, week: s });
  const id = lateGoalLine("winner", s, "teams", key);
  check(teamBank(teamFor(key)).lateCalls.winner.some(l => l.id === id), `live late call (seed ${s}) from the match's team`);
  check(lateGoalLine("winner", s, "teams", key) === id, `live late call (seed ${s}) deterministic`);
}

if (problems.length) { console.error(`commentators FAILED (${problems.length}):\n  - ` + [...problems].sort((a, b) => Number(/recording|length/.test(a)) - Number(/recording|length/.test(b))).slice(0, 40).join("\n  - ")); process.exit(1); }
console.log(`commentators: ok (${compared} off-switch plans unchanged, ${all.length} team lines)`);
