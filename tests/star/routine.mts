/**
 * THE WORLD KIT'S PURE PARTS (phase 1, docs/research/world-3d-2026-11-20.md):
 * the day clock, seeded routines and their runner (lib/star/world3d/routine.ts),
 * slot booking on smart objects (smartObject.ts), the people budget per
 * quality tier (budget.ts) and the talk card (interact.ts). The same seed must
 * give the same day; two people never hold one seat; a phone never animates
 * more than 4 moving people or holds more than 8.
 */
import { DayClock, DAY_MIN, phaseOf, planRoutine, stepAt, RoutineRunner, seeded, GARDEN_VISITOR, BENCH_MATE, dayStart, type RoutineTemplate } from "../../lib/star/world3d/routine";
import { SlotBook, SmartSet, seatObject, standObject, tvObject, SIT_STEP, fwdOf } from "../../lib/star/world3d/smartObject";
import { NPC_BUDGET, npcBudget, planBudget, animatesOn } from "../../lib/star/world3d/budget";
import { personCard, objectCard, smallTalk, talkSpot } from "../../lib/star/world3d/interact";

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

// ── the clock ──
{
  const c = new DayClock(23 * 60 + 50, 120);
  check(c.hhmm === "23:50", `clock reads 23:50 (${c.hhmm})`);
  c.advance(10); // 120x: 20 game minutes
  check(c.day === 1 && Math.abs(c.minute - 10) < 1e-9, `clock wraps past midnight to day 1, 00:10 (${c.day} ${c.minute})`);
  check(c.total === DAY_MIN + 10, "total minutes never wrap");
  c.advance(-5);
  check(Math.abs(c.minute - 10) < 1e-9, "a negative step does nothing");
  check(phaseOf(9 * 60) === "morning" && phaseOf(12 * 60) === "midday" && phaseOf(15 * 60) === "afternoon" && phaseOf(20 * 60) === "evening" && phaseOf(2 * 60) === "night", "phases of the day");
  check(dayStart("training") < dayStart("matchday"), "a training day starts before a match day");
}

// ── seeded routines ──
{
  const r = seeded(42), r2 = seeded(42);
  check(r() === r2() && r() === r2(), "seeded: the same seed, the same numbers");
  for (const tpl of [GARDEN_VISITOR, BENCH_MATE]) {
    const a = planRoutine("mate-1", tpl, 15 * 60, 15 * 60 + 240, 7);
    const b = planRoutine("mate-1", tpl, 15 * 60, 15 * 60 + 240, 7);
    const c = planRoutine("mate-1", tpl, 15 * 60, 15 * 60 + 240, 8);
    check(JSON.stringify(a) === JSON.stringify(b), `${tpl.id}: same seed, same day`);
    check(JSON.stringify(a.steps) !== JSON.stringify(c.steps), `${tpl.id}: another seed, another day`);
    check(a.steps.length >= 3, `${tpl.id}: repeats through the afternoon (${a.steps.length} steps)`);
    let t = 15 * 60;
    for (const s of a.steps) {
      check(s.at >= t - 1e-9, `${tpl.id}: steps in order, never overlapping (${s.at.toFixed(1)} < ${t.toFixed(1)})`);
      check(s.until > s.at, `${tpl.id}: every step takes time`);
      check(s.until <= 15 * 60 + 240 + 1e-9, `${tpl.id}: no step past the day's end`);
      t = s.until;
    }
    const k = stepAt(a, a.steps[1].at + 0.01);
    check(k === 1, `${tpl.id}: stepAt finds the step under way (${k})`);
    check(stepAt(a, 0) === -1, `${tpl.id}: nothing before the first step`);
  }
  // the visitor: arrive at the gate, use a seat, leave by the gate, in that order every visit
  const v = planRoutine("v", GARDEN_VISITOR, 600, 900, 3);
  for (let i = 0; i + 2 < v.steps.length; i += 3) {
    check(v.steps[i].do.kind === "arrive" && v.steps[i + 1].do.kind === "use" && v.steps[i + 2].do.kind === "leave", `visitor: arrive → use → leave (visit ${i / 3})`);
  }
  // a step that never happens (chance 0)
  const never: RoutineTemplate = { id: "never", steps: [{ do: { kind: "wait" }, mins: [1, 1], chance: 0 }, { do: { kind: "stretch" }, mins: [1, 2] }] };
  const n = planRoutine("x", never, 0, 100, 1);
  check(n.steps.length === 1 && n.steps[0].do.kind === "stretch", "a chance-0 step is left out");
}

// ── the runner: a step starts on time and once the last is done ──
{
  const rt = planRoutine("v", GARDEN_VISITOR, 600, 700, 5);
  const runner = new RoutineRunner(rt);
  const started: string[] = [], stopped: string[] = [];
  let walkDone = false;
  for (let m = 600; m < 700; m += 0.05) {
    runner.tick(m, (s) => { started.push(s.do.kind); walkDone = false; }, (s) => stopped.push(s.do.kind));
    // a walk (arrive/leave) takes 0.5 game minutes
    const cur = runner.current;
    if (cur && (cur.do.kind === "arrive" || cur.do.kind === "leave") && !walkDone && m - cur.at > 0.5) { walkDone = true; runner.done(); }
  }
  check(started[0] === "arrive" && started[1] === "use" && started[2] === "leave", `runner: plays the visit in order (${started.slice(0, 3).join(",")})`);
  check(stopped.includes("use"), "runner: the use step is ended at its time");
  check(stopped.every((k) => k === "use" || k === "stretch" || k === "wait"), "runner: walks end by done(), not by the clock");
}

// ── smart objects and booking ──
{
  const bench = seatObject({ id: "bench", label: "Bench", at: [0, 0], facing: Math.PI / 2, seats: 4, y: 0.46, spacing: 0.66 });
  check(bench.slots.length === 4, "a 4-seat bench has 4 slots");
  const f = fwdOf(Math.PI / 2);
  const s0 = bench.slots[0];
  check(Math.abs(s0.stand[0] - (s0.seat!.at[0] + f[0] * SIT_STEP)) < 1e-9, "a seat's stand spot is its sit step in front of the seat");
  check(Math.abs(Math.hypot(bench.slots[1].seat!.at[0] - s0.seat!.at[0], bench.slots[1].seat!.at[1] - s0.seat!.at[1]) - 0.66) < 1e-9, "seats are spaced along the bench");
  const book = new SlotBook();
  const a = book.book(bench, "a", { slot: "s0" });
  const b = book.book(bench, "b", { slot: "s0" });
  check(!!a && a.id === "s0", "a takes s0");
  check(b === null, "b cannot take s0 while a holds it");
  const b2 = book.book(bench, "b", { near: s0.stand });
  check(!!b2 && b2.id === "s1", `b gets the free seat nearest s0 (${b2?.id})`);
  book.book(bench, "c"); book.book(bench, "d");
  check(book.book(bench, "e") === null, "a full bench takes nobody else");
  check(new Set(book.all().map((x) => x.slot)).size === 4, "four people, four different seats");
  book.release("a");
  check(book.holderOf("bench", "s0") === null && book.book(bench, "e")?.id === "s0", "a seat let go is free again");
  const fridge = standObject({ id: "fridge", kind: "fridge", label: "Fridge", front: [0, 1], face: [0, 0], verb: "Take a can" });
  check(Math.abs(fridge.slots[0].facing - Math.PI) < 1e-9, "a fridge's user faces it");
  // a person moving to another object lets go of his seat
  book.book(fridge, "b");
  check(book.holderOf("bench", "s1") === null && book.slotOf("b")?.obj === "fridge", "booking somewhere else lets go of the old slot");
  const tv = tvObject({ id: "tv", at: [-2, 0], via: "bench" });
  const set = new SmartSet([bench, fridge, tv]);
  check(set.host(tv) === bench, "the TV is used from its seat");
  check(set.pickAt([0, 0.05])?.id === "fridge" || set.pickAt([0, 0.05])?.id === "bench", "a tap on a thing finds it");
  check(set.pickAt([30, 30]) === null, "a tap on nothing finds nothing");
}

// ── the budget ──
{
  const phone = npcBudget("high", true);
  check(phone.moving <= 4 && phone.present <= 8, `a phone is capped at 4 moving / 8 present (${phone.moving}/${phone.present})`);
  check(npcBudget("high", false).moving === NPC_BUDGET.high.moving, "a computer on High keeps its own caps");
  const people = Array.from({ length: 8 }, (_, i) => ({ id: `p${i}`, dist: 2 + i, onScreen: i !== 7, moving: true }));
  const out = planBudget(people, npcBudget("medium", true));
  const full = out.filter((o) => o.every === 1 || o.every === 2).length;
  check(full <= 4, `no more than 4 moving people animate at full or half rate (${full})`);
  check(out[7].every === 0, "an off-screen person is frozen");
  check(out[0].every === 1, "the nearest mover animates every frame");
  check(animatesOn(2, 4, 0) && !animatesOn(2, 5, 0) && !animatesOn(0, 0, 0), "every-2nd-frame and frozen");
}

// ── the card ──
{
  const a = smallTalk("mate-1", "sat", "afternoon", 1), b = smallTalk("mate-1", "sat", "afternoon", 1);
  check(a.join() === b.join() && a.length === 2, "small talk: two lines, the same for the same moment");
  const c = personCard({ id: "m", name: "Saka", lines: a, chat: true });
  check(c.actions[0].id === "chat" && c.actions[0].primary === true, "a team-mate's card leads with Chat when the living world is on");
  const bench = seatObject({ id: "bench", label: "Bench", at: [0, 0], facing: 0, seats: 2, y: 0.46 });
  check(objectCard(bench).actions[0].label === "Sit down", "a seat's card says Sit down");
  check(objectCard(bench, { using: true }).actions[0].label === "Stand up", "sitting, it says Stand up");
  const spot = talkSpot([0, 0], 0, [0, 3]);
  check(Math.hypot(spot[0], spot[1]) > 0.9 && Math.hypot(spot[0], spot[1]) < 1.2 && spot[1] > 0, `you stand about a metre in front of him to talk (${spot.map((v) => v.toFixed(2))})`);
}

if (problems.length) { console.error(`✗ world kit: ${problems.length} problem(s)\n  ${problems.join("\n  ")}`); process.exit(1); }
console.log("✓ world kit: clock, seeded routines and runner, slot booking, people budget, the card");
