// The sound plans for the commentator A/B page (ab_teams.py): every team on
// the same three goals (a normal goal, a screamer from distance, a late
// winner), plus today's v2 voice on them for comparison. Real planAudio
// output: the same cues and crowd line the game mixes.
import { readFileSync } from "node:fs";
import { trackFromStored, type GoalTrack, type ClipMeta } from "../../lib/star/goalClip/track";
import { makeEdit } from "../../lib/star/goalClip/edit";
import { planAudio, finishOf } from "../../lib/star/goalClip/audio";
import { TEAM_IDS, teamFor, matchKeyOf, type TeamId } from "../../lib/star/goalClip/commentators";

const load = (f: string) => trackFromStored(JSON.parse(readFileSync(new URL(`../../tests/star/fixtures/goalClips/${f}`, import.meta.url), "utf8"))) as GoalTrack;
const GOALS: { name: string; file: string; meta: Partial<ClipMeta> }[] = [
  { name: "normal", file: "lay-off.json", meta: { scoreAfter: [1, 0], youAreHome: true, minute: 23 } },
  { name: "screamer", file: "scramble.json", meta: { how: "long_range", scoreAfter: [2, 1], youAreHome: true, minute: 61 } },
  { name: "late", file: "lay-off.json", meta: { scoreAfter: [2, 1], youAreHome: true, minute: 90, isYou: true, late: "winner" } },
];

/** A made-up fixture whose match key lands on this team. */
function matchFor(team: TeamId): Partial<ClipMeta> {
  for (let i = 0; i < 10000; i++) {
    const m = { home: "Northfield", away: `Southgate ${i}`, season: 1, week: 7 };
    if (teamFor(matchKeyOf(m)) === team) return m;
  }
  throw new Error("no match for " + team);
}

const out: Record<string, unknown> = {};
for (const g of GOALS) {
  const tr = load(g.file);
  for (const team of [...TEAM_IDS, "v2" as const]) {
    const meta = { ...tr.meta, ...g.meta, ...(team === "v2" ? {} : matchFor(team)), id: `ab-${g.name}` };
    const e = makeEdit([{ ...tr, meta }], "broadcast", "new", 0);
    const p = planAudio(e, team === "v2" ? "v2" : "teams");
    if (team !== "v2" && p.team !== team) throw new Error(`wanted ${team}, got ${p.team}`);
    out[`${team}/${g.name}`] = { ...p, finish: finishOf({ ...tr, meta }) };
  }
}
console.log(JSON.stringify(out));
