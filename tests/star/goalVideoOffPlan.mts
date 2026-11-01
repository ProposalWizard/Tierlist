/**
 * BETTER GOAL VIDEOS, SWITCHED OFF = EXACTLY AS BEFORE (Leo's switch part
 * "betterVideos", lib/star/leoUpdate.ts; Leo, 31 Oct 2026).
 *
 * The cut of every goal video (which camera, from when to when, how fast)
 * with the part off must be the very same plan the game made before the
 * better videos were built. The plans of 31 Oct 2026 (before the change) are
 * kept in fixtures/goalEditPlans.json: two real recordings, five made-up
 * goals of every kind, a two-goal reel, every style, six cuts each. Also the
 * style each kind of account gets, and the video's name in memory.
 *
 * Run: npx tsx tests/star/goalVideoOffPlan.mts            (check)
 *      npx tsx tests/star/goalVideoOffPlan.mts --write     (only before a change)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { trackFromStored, type GoalTrack } from "../../lib/star/goalClip/track";
import { synthTrack, type SynthKind } from "../../lib/star/goalClip/synth";
import { makeEdit, type ClipStyle } from "../../lib/star/goalClip/edit";
import { clipStyleFor } from "../../lib/star/media/clipStyle";
import { goalVideoKey } from "../../lib/star/goalClip/premake";

const load = (n: string) => trackFromStored(JSON.parse(readFileSync(new URL(`./fixtures/goalClips/${n}.json`, import.meta.url), "utf8"))) as GoalTrack;
const KINDS: SynthKind[] = ["run_in", "header", "long_range", "tap_in", "penalty"];
const synth = KINDS.map((kind, i) => synthTrack({ home: "Arsenal", away: "Chelsea", scorer: "Bukayo Saka", scorerShort: "Saka", scorerHome: i % 2 === 0, minute: 12 + i * 9, scoreAfter: [1, 0], seed: `plan-${kind}`, kind })!);
const sets: [string, GoalTrack[]][] = [
  ["lay-off", [load("lay-off")]], ["scramble", [load("scramble")]],
  ...synth.map((t, i) => [`synth-${KINDS[i]}`, [t]] as [string, GoalTrack[]]),
  ["reel", [load("lay-off"), synth[0]]],
];
const STYLES: ClipStyle[] = ["broadcast", "reverse", "fan", "tiktok"];

const plans: Record<string, unknown> = {};
for (const [name, tracks] of sets) for (const style of STYLES) for (let v = 0; v < 6; v++) {
  const e = makeEdit(tracks, style, "new", v);
  plans[`${name}|${style}|${v}`] = { w: e.w, h: e.h, fps: e.fps, style: e.style, variant: e.variant, keys: Object.keys(e).sort(), shots: e.shots };
}
const ARCH = ["club", "league", "competition", "broadsheet", "tabloid", "insider", "stats", "aggregator", "pundit", "fan", "rivalFan", "teammate", "meme"] as const;
const PLAT = ["x", "instagram", "youtube", "tiktok", "news"] as const;
const styles: Record<string, string> = {};
for (const a of ARCH) for (const p of PLAT) styles[`${a}/${p}`] = clipStyleFor({ handle: "@h", name: "n", archetype: a, platform: p });
const keys = [goalVideoKey("broadcast", 3, "new", ["a", "b"], undefined, "@club"), goalVideoKey("tiktok", 1, "old", [], [{ seed: "s1" } as never], "@x", true)];
const now = JSON.parse(JSON.stringify({ plans, styles, keys }));

const file = new URL("./fixtures/goalEditPlans.json", import.meta.url);
if (process.argv.includes("--write")) {
  writeFileSync(file, JSON.stringify(now));
  console.log(`wrote ${Object.keys(plans).length} plans`);
  process.exit(0);
}
const was = JSON.parse(readFileSync(file, "utf8"));
const problems: string[] = [];
for (const k of Object.keys(was.plans)) {
  if (JSON.stringify(was.plans[k]) !== JSON.stringify(now.plans[k])) problems.push(`plan ${k} changed`);
}
for (const k of Object.keys(was.styles)) if (was.styles[k] !== now.styles[k]) problems.push(`style for ${k}: ${was.styles[k]} → ${now.styles[k]}`);
if (JSON.stringify(was.keys) !== JSON.stringify(now.keys)) problems.push(`video key changed: ${JSON.stringify(now.keys)}`);

console.log(`Switch off: ${Object.keys(was.plans).length} edit plans, ${Object.keys(was.styles).length} account styles, 2 video keys compared with 31 Oct 2026.`);
if (problems.length) {
  console.log(`✗ ${problems.length} differ:\n  ${problems.slice(0, 20).join("\n  ")}`);
  process.exit(1);
}
console.log("✓ all the same");
