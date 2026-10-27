// Twin test: a new career's first hour as a story (lib/star/story.ts) through the
// Roblox screens: the beats on Home, what each opens, the locked tabs and Life
// sections before that. A robot sims its matches, answers every beat and tries
// the locked things on the way. Every screen is printed; both sides must match.
import * as S from "../game/screens";
import { mulberry32 } from "../../lib/star/season";
import { show } from "./_out";

const rng = mulberry32(5);
let g = S.startWithoutTrial({ firstName: "Story", lastName: "Robot", nationality: "England", division: "League Two", club: "Barnet" });
const press = (action: string, arg?: string, label = "") => {
  g = S.act(g, action, arg, rng);
  const s = S.screen(g);
  console.log(`${label || action}${arg ? ` ${arg}` : ""}: ${show(s)}`);
  return s;
};
const opens = () => `open ${show(g.career.unlocks?.open)} seen ${show(g.career.unlocks?.seen)}`;

// before game 1: the locks
press("tab", "train", "training locked");
press("tab", "stats", "stats locked");
press("tab", "life", "life locked");
press("buy-can", "basic", "buying refused");
press("life", "cans", "the shop's page refused");
press("tab", "home");
for (let step = 0; step < 400 && g.career.season === 1; step++) {
  const sc = S.screen(g);
  const beat = sc.buttons.find((b) => b.action === "beat");
  if (beat) {
    press("beat", beat.arg);
    console.log(`  after ${beat.arg}: ${opens()}, money ${g.career.money}, cans ${show(g.career.kibCans)}, boot ${g.career.currentBoot.id} ${g.career.currentBoot.matches}`);
    if (beat.arg === "training") {
      // the training day: Power and Technique, free
      press("train-skill", "power");
      press("play-training", "power:1");
      press("train-skill", "technique");
      press("play-training", "technique:1");
    }
    if (beat.arg === "can") press("use-can", "basic");
    g = S.act(g, "tab", "home", rng);
    continue;
  }
  if ((g.career.unlocks?.open.length ?? 0) >= 8 && step > 30) break;
  const b = sc.buttons.find((x) => x.action === "sim") ?? sc.buttons.find((x) => x.style === "primary") ?? sc.buttons[0];
  if (!b) break;
  g = S.act(g, b.action, b.arg, rng);
}
console.log(`week ${g.career.week} season ${g.career.season} ${g.phase}: ${opens()}, goals ${g.career.careerStats.goals}, apps ${g.career.careerStats.appearances}`);
press("tab", "life", "life now");
press("tab", "train", "training now");
