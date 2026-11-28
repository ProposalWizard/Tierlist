/**
 * WHAT A VISITOR SAYS WHEN YOU WALK UP TO HIM IN YOUR HOUSE (plan phase 2: visitors who come and go).
 * Two lines: one about what he is doing right now, one about the time of day. Seeded, so the same
 * moment says the same thing. The round menu (the real conversations) is a later phase; these are the
 * small lines on the tap card. Every line is written out here: no blanks, no names of pools.
 * Pure. Test: tests/star/houseRoutines.mts (every line filled in, none repeated within a set).
 */
import { seeded, hashId, type DayPhase } from "../world3d/routine";
import type { VisitKind } from "./houseRoutines";
import type { VisitorRole } from "./dayPlan";

/** What he is doing → what he says about it. */
export const DOING_LINES: Record<VisitorRole, Partial<Record<string, string[]>>> = {
  mate: {
    arrive: ["Alright! I was passing, so I knocked.", "Nice place. Bigger than mine.", "Hope you don't mind me turning up."],
    invited: ["Cheers for the text. What are we doing?", "Got here as quick as I could.", "I brought nothing. Sorry."],
    sofa: ["Sit down, you're blocking the telly.", "This lot can't defend a corner.", "Is this the highlights or the full game?"],
    fridge: ["I took one of your cans. Hope that's alright.", "You're nearly out of the cold ones.", "Is any of this not sugar-free?"],
    coffee: ["How does this machine work? Never mind, got it.", "Strong one. I need it after that session."],
    pool: ["Rack them up. Winner stays on.", "I'm on the stripes. Don't argue.", "Watch this. Off two cushions."],
    darts: ["Double top. Watch.", "Closest to the bull goes first."],
    arcade: ["Your high score's going.", "Who set this score? It wasn't you."],
    lounger1: ["I could get used to this.", "Wake me up when it's time to eat."],
    call: ["Two minutes, it's my mum.", "Sorry, it's my agent. He never stops.", "Just telling the missus where I am."],
    meet: ["Your chef's making something good.", "I've asked what's for dinner. Twice."],
    away: ["Back in a sec."],
    leave: ["Right, I'm off. See you at training.", "Thanks for having me. My place next time."],
  },
  chef: {
    arrive: ["Afternoon. I'll get started.", "I've got everything I need. Leave it to me."],
    cook: ["Chicken, rice and greens. The nutritionist signed it off.", "Twenty minutes. Don't fill up on crisps.", "Smells good, doesn't it? Not ready yet."],
    fridge: ["Who keeps putting cans in front of my vegetables?", "We need more eggs. I'll write it down."],
    clean: ["Leave the pans, I'll do them.", "Nearly done in here."],
    away: ["I'm just out the back."],
    leave: ["It's in the oven. Forty minutes at 180.", "See you tomorrow."],
  },
  cleaner: {
    arrive: ["Morning. Don't mind me.", "I'll start upstairs and work down."],
    clean: ["Don't mind me. I'll stay out of your way.", "Who left the cans on the side?", "Shoes off on the clean floor, please."],
    away: ["Just getting the hoover."],
    leave: ["All done. See you next time.", "That's me finished. Bye now."],
  },
};

/** What he adds about the time of day. */
export const PHASE_LINES: Record<VisitorRole, Record<DayPhase, string[]>> = {
  mate: {
    night: ["I should get home really."],
    morning: ["Early one tomorrow, isn't it?"],
    midday: ["Have you eaten? I'm starving."],
    afternoon: ["Big one this weekend.", "The gaffer wants us in early tomorrow."],
    evening: ["I won't stay late, promise.", "Are you watching the late game?"],
  },
  chef: {
    night: ["I'm going home after this."],
    morning: ["Lunch at half one."],
    midday: ["Lunch at half one."],
    afternoon: ["Dinner's at seven, as usual."],
    evening: ["Dinner's at seven, as usual."],
  },
  cleaner: {
    night: ["I'm finishing up."],
    morning: ["I'll be out by twelve."],
    midday: ["I'll be out by twelve."],
    afternoon: ["Nearly done."],
    evening: ["Nearly done."],
  },
};

export const ROLE_LABEL: Record<VisitorRole, string> = { mate: "Team-mate", chef: "Your chef", cleaner: "Your cleaner" };

/** The tap card's two lines and his role. */
export function houseTalk(o: { who: VisitorRole; step: VisitKind; target?: string; phase: DayPhase; why?: string; seed: string }): { role: string; lines: string[] } {
  const r = seeded(hashId(o.seed));
  const book = DOING_LINES[o.who];
  const key = o.step === "use" ? (o.target ?? "sofa")
    : o.step === "arrive" && o.who === "mate" && o.why === "You texted him" ? "invited"
    : o.step === "go" ? "arrive" : o.step === "cook" ? "cook" : o.step;
  const set = book[key] ?? book.arrive ?? [];
  const tail = PHASE_LINES[o.who][o.phase];
  const lines = [set[Math.floor(r() * set.length)], tail[Math.floor(r() * tail.length)]].filter((x): x is string => !!x);
  return { role: ROLE_LABEL[o.who], lines };
}
