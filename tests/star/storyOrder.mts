/**
 * THE FIRST HOUR AS A STORY (Mikey, 23 Oct 2026, lib/star/story.ts): a new
 * career is walked through its first games and each person's beat must come
 * at the right moment, open the right thing, and never come twice.
 */
import { makeInitialCareer, creditMatchResult } from "../../lib/star/careerFlow";
import { finaliseMatch } from "../../lib/star/matchStats";
import { NATIONAL_LEAGUE_NORTH_CLUBS } from "../../lib/star/clubs";
import { nextFixtureFor } from "../../lib/star/competitions";
import { starsNow } from "../../lib/star/starPoints";
import { isOpen, recordFirstMatch, recordBossMeeting, recordDrill, appInstalled, lockHint, recordPhoneBought } from "../../lib/star/unlocks";
import { storyBeat, ackBeat, trainingDayOn, trainingDayLeft, recordTrainingDayDrill, TRAINING_DAY, type Beat } from "../../lib/star/story";
import { buildMessages } from "../../lib/star/phoneUnread";
import type { CareerState, StarPlayer } from "../../lib/star/types";

let fails = 0;
const check = (ok: boolean, what: string) => { if (!ok) { fails++; console.log("FAIL", what); } else console.log("ok  ", what); };

const player = { firstName: "Story", lastName: "Test", age: 17, skinTone: "light", club: NATIONAL_LEAGUE_NORTH_CLUBS[8], clubBadge: null, position: "ST", nationality: "England", startYear: 2027 } as StarPlayer;
let c: CareerState = makeInitialCareer(player, [...NATIONAL_LEAGUE_NORTH_CLUBS], "national_league_north");

const play = (goals: number) => {
  const f = nextFixtureFor(c)!;
  const s = finaliseMatch(6 + goals, goals, 0, 25, 90, goals + 1, 0, c, [], null, [], f);
  c = recordFirstMatch(creditMatchResult(c, f, s).career);
};
const beat = () => storyBeat(c, starsNow(c));
/** Show every beat that is due now, in order, and press its button. */
const drain = (): Beat[] => {
  const shown: Beat[] = [];
  for (let b = beat(); b && shown.length < 10; b = beat()) {
    shown.push(b);
    c = ackBeat(c, b);
    if (b === "boss") c = recordBossMeeting(c);
  }
  return shown;
};

// 0 · Signing day
check(isOpen(c, "league") && isOpen(c, "play"), "signing day: League and Play open");
check(!isOpen(c, "training") && !isOpen(c, "stats") && !isOpen(c, "shop") && !isOpen(c, "phone"), "signing day: Training, Stats, Shop, Phone locked");
check(beat() === null, "signing day: no beat before the first game");
check(lockHint(c, "shop") === "After your third game", "Shop lock line says game 3");

// 1 · After game 1 (no goal): the gaffer, then training
play(0);
check(beat() === "boss", "game 1: the gaffer calls you in first");
check(!isOpen(c, "training"), "game 1: Training still shut before the talk");
c = ackBeat(c, "boss"); c = recordBossMeeting(c);
check(beat() === "training", "after the talk: 'Training tomorrow'");
c = ackBeat(c, "training");
check(isOpen(c, "training") && trainingDayOn(c), "training opens, the training day is on");
check(!isOpen(c, "relations"), "Relations waits for the phone");
for (const s of TRAINING_DAY) { c = recordTrainingDayDrill(recordDrill(c), s); }
check(trainingDayLeft(c).length === 0 && !trainingDayOn(c), "all 6 drills done once: training day over");
check(!isOpen(c, "shop"), "drills do not open the Shop on the story order");
const r = drain();
check(r[0] === "ready", `then 'You're ready for Saturday' (got ${r.join(",")})`);

// 2 · After game 2: the can, then the phone
play(0);
const energyBefore = c.kibCans.basic;
const r2 = drain();
check(r2.indexOf("can") >= 0 && r2.indexOf("phone") > r2.indexOf("can"), `game 2: can then phone (got ${r2.join(",")})`);
check(c.kibCans.basic >= 1 && energyBefore >= 0, "a Basic can to use");
check(isOpen(c, "phone") && isOpen(c, "relations"), "the cracked phone opens Phone and Relations");
check(appInstalled(c, "messages") && appInstalled(c, "squad") && appInstalled(c, "fixtures") && !appInstalled(c, "social"), "cracked phone: Messages, Squad, Fixtures; no Social");
check(buildMessages(c)[0]?.key === "agent-hello", "first message is from the agent");
check(!isOpen(c, "shop"), "Shop still shut after game 2");

// 3 · After game 3: the chairman opens the Shop
play(0);
const r3 = drain();
check(r3.includes("shop") && isOpen(c, "shop"), `game 3: wages in, Shop opens (got ${r3.join(",")})`);
check(!isOpen(c, "stats"), "no goal yet: Stats still shut");

// First goal
play(1);
const r4 = drain();
check(r4.includes("stats") && isOpen(c, "stats") && isOpen(c, "achievements"), `first goal: Stats and Achievements open (got ${r4.join(",")})`);

// Your own phone, bought later
c = recordPhoneBought(c);
check(appInstalled(c, "social") && appInstalled(c, "kickabout"), "your own phone adds Social and Kickabout");

// Nothing twice
play(2); play(1);
check(drain().length === 0, "no beat comes twice");
check(starsNow(c) >= 2 && c.unlocks!.seen.includes("beat-starpass"), "the Star Pass beat came by star level 2");

// An old save keeps its order
const old: CareerState = { ...c, unlocks: { ...c.unlocks!, story: undefined } };
check(storyBeat(old, 50) === null, "a career without the story flag never sees a beat");

if (fails) { console.log(`\n${fails} failed`); process.exit(1); }
console.log("\nall passed");
