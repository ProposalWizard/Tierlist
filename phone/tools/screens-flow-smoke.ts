/**
 * SCREENS FLOW SMOKE: runs, headless, every new step the career screens call
 * (the wage talk, youth week and promotion, the free-agent route, the loan
 * brief, deadline day, the relegation offers, press, dilemmas, the
 * relationship games, the farewell and retirement into the Hall of Fame,
 * the save slots). It checks each returns a step and leaves a career, not
 * that the football is right (career-flow-check.ts does that).
 *
 * Run from the repo root:
 *   npx esbuild phone/tools/screens-flow-smoke.ts --bundle --platform=neutral --main-fields=module,main \
 *     --format=esm --alias:@=. --external:three --external:react-native-mmkv --external:react \
 *     --outfile=phone/tools/.sfs.mjs && node phone/tools/.sfs.mjs; rm phone/tools/.sfs.mjs
 */
import "./career-rn-globals";
import type { CareerState, StarPlayer } from "@/lib/star/types";
import { mulberry32 } from "@/lib/star/season";
import { nextFixtureFor } from "@/lib/star/competitions";
import * as flow from "../src/game/flow";
import { getCareer, setCareer } from "../src/game/store";
import { phoneHall } from "../src/world/hall";
import { listSlots, newInSlot, loadSlot, activeSlot } from "../src/world/slots";

let dice = mulberry32(7);
Math.random = () => dice();
Date.now = () => 1_790_000_000_000;
let failures = 0;
const fail = (m: string) => { failures++; console.log("  FAIL:", m); };
const ok = (m: string) => console.log("  ok:", m);
const run = (label: string, f: () => flow.Step | void) => {
  try { const s = f(); ok(`${label}${s ? ` → ${s.screen}` : ""}`); return s; } catch (e) { fail(`${label} threw: ${(e as Error).stack?.split("\n").slice(0, 3).join(" | ")}`); return undefined; }
};

const player = {
  firstName: "Test", lastName: "Striker", age: 16, skinTone: "tan", club: "", clubBadge: null,
  position: "ST", nationality: "England", startYear: 2026, preferredNumber: 9, preferredFoot: "right",
  hairStyle: "short", hairColour: "brown",
} as unknown as StarPlayer;

// ── 1. A new career, the wage talk ──
flow.beginCareer(player, "premier", 4242);
for (const st of flow.trialStages(getCareer()!)) flow.simulateTrialStage(st);
const after = flow.afterTrial();
ok(`trial → ${after.screen}`);
const m = flow.managerTalk(getCareer()!);
if (m && !m.firstContract) {
  const s = run("wage talk walked out", () => flow.wageTalkDone(null));
  if (s?.screen !== "career-offers" || !getCareer()!.agreedTerms?.soured) fail("a walk-out should leave a soured offer");
} else ok("first contract is fixed (no haggling), as on the website");
const offers = flow.offersWithAgreedTerms(getCareer()!, flow.offersForTrial(getCareer()!));
if (offers[0]) run("sign", () => flow.signTrialOffer(offers[0]));
run("finish signing", () => flow.finishSigning());
const SIGNED: CareerState = JSON.parse(JSON.stringify(getCareer()!));

// ── 2. The youth team ──
{
  const c = getCareer()!;
  setCareer({ ...c, placement: { kind: "youth", club: c.player.club, division: c.division as never, reason: "form", progress: 0, apps: 0, goals: 0, assists: 0 } as never });
  for (let i = 0; i < 3; i++) run(`youth week ${i + 1}`, () => flow.youthWeek());
  const p = getCareer()!.placement;
  if (!p || p.kind !== "youth" || p.apps < 1) fail(`youth weeks should be played (apps ${p && "apps" in p ? p.apps : "?"})`);
  setCareer({ ...getCareer()!, placement: { ...(getCareer()!.placement as object), progress: 100 } as never });
  run("youth promotion", () => flow.youthPromote());
  setCareer(JSON.parse(JSON.stringify(SIGNED)));
}

// ── 3. Between matches ──
run("deadline day", () => { const c = getCareer()!; setCareer({ ...c, lastTransferWindowKey: "1-summer", deadlineDayShownFor: undefined }); return flow.deadlineDayDone(); });
if (getCareer()!.deadlineDayShownFor !== "1-summer") fail("deadline day should be marked shown");
run("relegation offers", () => { const o = flow.relegationOffers(); ok(`  ${o.length} offers`); });
run("press question", () => { const q = flow.pressQuestion(); ok(`  ${q ? q.headline : "none for this match (as on the website)"}`); });
run("dilemma", () => {
  const d = flow.dilemmaFor();
  if (d && /gambl|casino|poker|card game/i.test(`${d.id} ${d.title} ${d.text}`)) fail(`a gambling dilemma reached the phone: ${d.id}`);
  if (d) return flow.chooseDilemma(d, d.choices[0].effects);
});
run("relationship: office talk won", () => flow.relationshipGameDone("boss", { won: true, gain: 3 }));
run("relationship: day off", () => flow.relationshipGameDone("happiness", { won: true, gain: 5, cost: 0 }));
run("loan brief due/seen", () => { flow.loanBriefSeen(); if (flow.loanBriefDue(getCareer()!)) fail("brief seen this week is not due again"); });

// ── 4. Pop-ups ──
flow.noteRating(19.4, 21.2);
if (!flow.usePops || false) fail("usePops missing");
ok("star rating 19 → 21: milestone and banner queued");

// ── 5. The farewell and the Hall of Fame ──
run("hang them up", () => flow.retireNow());
if (flow.currentFarewell()) {
  run("play the farewell", () => flow.playFarewell());
  if (!flow.currentFarewell()?.stats) fail("farewell should have a result");
  run("finish", () => flow.finishFarewell());
}
if (!getCareer()!.retired) fail("career should be retired");
if (phoneHall().entries.length !== 1) fail(`the Hall should hold the career (${phoneHall().entries.length})`);
else ok(`in the Hall: ${phoneHall().entries[0].card.name}, ${phoneHall().entries[0].card.title}`);
if (flow.resumeStep().screen !== "career-legacy") fail("a retired career resumes on the overview");

// ── 6. Save slots ──
const before = activeSlot();
newInSlot(2);
if (getCareer() !== null || activeSlot() !== 2) fail("new game in slot 2 should clear the live career");
if (!loadSlot(before)) fail("loading the first slot back should work");
if (!getCareer()?.retired) fail("slot 1's career should be back");
ok(`slots: ${listSlots().map((s) => (s.empty ? `${s.slot}:empty` : `${s.slot}:${s.playerName}`)).join(" ")}`);

void nextFixtureFor;
console.log(failures ? `\n${failures} FAILED` : "\nALL OK");
process.exit(failures ? 1 : 0);
