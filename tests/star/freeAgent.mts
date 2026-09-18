import { spendOn, GARDEN_GYM_CAP, FREE_AGENT_WEEKLY_PAY } from "../../lib/star/freeAgent";
import { makeIdentity } from "../../lib/star/careerFlow";
import { hasClub } from "../../lib/star/calendar";
import { actionsLeft } from "../../lib/star/week";
import { MONEY_SCALE } from "../../lib/star/money";
import type { CareerState, StarPlayer } from "../../lib/star/types";

/**
 * LIFE WITH NO CLUB.
 *
 * Two things matter here and neither is obvious from looking at the screen.
 *
 * The first is that the garden gym has a CEILING. A free agent who could train
 * his way to a Premier League contract from his own back garden would make the
 * whole phase pointless — the way back has to be another trial, not a grind.
 *
 * The second is that a week is finite. Every action spends a day, and when the
 * days are gone they are gone; a loop that let you press a button forever
 * would hand out unlimited happiness and unlimited training.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const unsigned = (o: Partial<CareerState> = {}): CareerState => ({
  ...makeIdentity({
    firstName: "Free", lastName: "Agent", age: 19, skinTone: "light",
    club: "", clubBadge: null, position: "ST", nationality: "England", startYear: 2027,
  } as StarPlayer),
  ...o,
});

// ── A free agent really is clubless ─────────────────────────────────────
{
  const c = unsigned();
  check(!hasClub(c), "a free agent has no club");
  check(c.fixtures.length === 0, "…and nothing to play");
}

// ── The pay is real money on the real scale ─────────────────────────────
{
  check(FREE_AGENT_WEEKLY_PAY === 10, "a week out of work pays ★10");
  // A scrape, not a living. A STARTING PROFESSIONAL earns ★2,000 a week, so a
  // man nobody will sign must be on a small fraction of that — the first
  // version of this multiplied by MONEY_SCALE and paid him ★20,000, ten times
  // a first-team wage, which this check is what caught.
  check(
    FREE_AGENT_WEEKLY_PAY * 50 < 2000,
    `a free agent must earn a small fraction of a professional's ★2,000 a week, not a multiple of it`,
  );
  check(FREE_AGENT_WEEKLY_PAY < 6000, "…and cannot simply buy the cheapest thing in the shop");
  check(MONEY_SCALE === 2000, "a starting wage is ★2,000 a week — the number the above is judged against");
}

// ── A week is finite ────────────────────────────────────────────────────
{
  let c = unsigned();
  const week = actionsLeft(c);
  check(week > 0, "a week has days in it");

  for (let i = 0; i < week; i++) {
    const before = actionsLeft(c);
    c = spendOn(c, "games").career;
    check(actionsLeft(c) === before - 1, "every action spends a day");
  }
  check(actionsLeft(c) === 0, "the week runs out");

  // …and then nothing happens, however many times you press.
  const spent = c;
  for (const what of ["games", "social", "gym"] as const) {
    const res = spendOn(spent, what);
    check(res.career === spent, `${what} does nothing once the week is gone`);
    check(res.note.length > 0, "…and says so rather than failing silently");
  }
}

// ── The garden gym improves you, slowly, and then stops ─────────────────
{
  let c = unsigned();
  const start = c.skills.technique;
  check(start < GARDEN_GYM_CAP, "a fresh player starts below the ceiling, or this proves nothing");

  // Train forever — a week at a time, refilling the week, the way months of
  // being out of work would actually go.
  let sessions = 0;
  for (let i = 0; i < 500; i++) {
    c = { ...c, weekActions: 3 };
    const res = spendOn(c, "gym");
    c = res.career;
    sessions++;
  }
  check(sessions > 100, "the fixture really did train a great many times");
  check(c.skills.technique > start, "training alone does improve you");
  check(
    c.skills.technique <= GARDEN_GYM_CAP,
    `…but never past the ceiling (${c.skills.technique} vs ${GARDEN_GYM_CAP}) — `
    + "a free agent must not be able to train his way to a top contract from his garden",
  );
  check(c.skills.power <= GARDEN_GYM_CAP, "…on either stat");
  check(
    c.skills.technique === GARDEN_GYM_CAP,
    "…and a determined player genuinely reaches it rather than crawling toward it forever",
  );
  // Nothing goes out of range on the way.
  check(c.energy >= 0 && c.energy <= 100, `energy stayed real (${c.energy})`);
  check(c.happiness >= 0 && c.happiness <= 100, `happiness stayed real (${c.happiness})`);
  check(c.money >= 0, "money never went negative");
}

// ── The three things you can do all do something different ──────────────
{
  const c = unsigned({ happiness: 50, money: 100 });
  const games = spendOn(c, "games").career;
  const social = spendOn(c, "social").career;
  const gym = spendOn(c, "gym").career;

  check(games.happiness > c.happiness, "the console cheers you up");
  check(social.happiness > games.happiness, "seeing people cheers you up more");
  check(social.money < c.money, "…and costs you something");
  check(games.money === c.money, "the console does not");
  check(gym.skills.technique > c.skills.technique, "the gym makes you better");
  check(gym.happiness < c.happiness, "…and is not much fun");
  check(gym.energy < c.energy, "…and takes it out of you");
}

// ── Nothing can be driven out of range, from anywhere ───────────────────
{
  const broke = unsigned({ money: 0, happiness: 100, energy: 0 });
  for (const what of ["games", "social", "gym"] as const) {
    const r = spendOn(broke, what).career;
    check(r.money >= 0, `${what} cannot put you in debt when you have nothing`);
    check(r.happiness >= 0 && r.happiness <= 100, `${what} kept happiness in range`);
    check(r.energy >= 0 && r.energy <= 100, `${what} kept energy in range`);
  }
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log("  ✗ " + p);
  process.exit(1);
}
console.log("PASS  a free agent's week is finite, and the garden gym has a ceiling he cannot train past");
