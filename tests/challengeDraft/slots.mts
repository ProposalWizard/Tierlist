import { FORMATIONS } from "../../components/draft/formations";
import type { DraftPlayer } from "../../lib/seasonSimulator";

/**
 * Formation slot identity.
 *
 * A formation can hold two slots with the SAME label — two CBs, two CMs, two
 * STs. Matching starters to slots by label alone left left-versus-right decided
 * by array order, so dropping a substitute into the LEFT centre-back slot could
 * land him on the right and shunt the incumbent across.
 *
 * These tests exercise the placement rules SquadManagerDev now uses, in
 * isolation from React: seat starters by explicit slot index, swap by slot, and
 * re-seat everyone when the formation changes.
 */

type P = DraftPlayer & { slotIndex?: number };

const player = (name: string, pos: string, over: Partial<P> = {}): P => ({
  name, overall: 80, positions: pos, club: "C", clubYear: "C 2024",
  assignedPosition: pos, age: 26, isSub: false, ...over,
} as P);

/** The normalisation SquadManagerDev runs whenever the formation changes. */
function seat(squad: P[], formationName: string): P[] {
  const formation = FORMATIONS.find(f => f.name === formationName)!;
  const labels = formation.slots.map(s => s.label);
  const used = new Set<number>();
  const unplaced: number[] = [];
  const next = [...squad];

  next.forEach((p, i) => {
    if (p.isSub) return;
    const si = p.slotIndex;
    if (si !== undefined && si >= 0 && si < labels.length && !used.has(si)) {
      used.add(si);
      if (p.assignedPosition !== labels[si]) next[i] = { ...p, assignedPosition: labels[si] };
    } else unplaced.push(i);
  });
  for (const i of [...unplaced]) {
    const m = labels.findIndex((l, li) => !used.has(li) && l === next[i].assignedPosition);
    if (m >= 0) {
      used.add(m);
      next[i] = { ...next[i], slotIndex: m, assignedPosition: labels[m] };
      unplaced.splice(unplaced.indexOf(i), 1);
    }
  }
  for (const i of unplaced) {
    const free = labels.findIndex((_, li) => !used.has(li));
    if (free >= 0) {
      used.add(free);
      next[i] = { ...next[i], slotIndex: free, assignedPosition: labels[free] };
    } else {
      const natural = (next[i].positions || "").split(",")[0]?.trim();
      next[i] = { ...next[i], isSub: true, slotIndex: undefined, assignedPosition: natural || next[i].assignedPosition };
    }
  }
  return next;
}

/** Promoting a substitute into a specific empty slot. */
function moveToSlot(squad: P[], playerIdx: number, slotIdx: number, formationName: string): P[] {
  const formation = FORMATIONS.find(f => f.name === formationName)!;
  const next = [...squad];
  next[playerIdx] = {
    ...next[playerIdx],
    assignedPosition: formation.slots[slotIdx].label,
    slotIndex: slotIdx,
    isSub: false,
  };
  return next;
}

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const f433 = FORMATIONS.find(f => f.name === "4-3-3")!;
const cbSlots = f433.slots.map((s, i) => ({ s, i })).filter(x => x.s.label === "CB").map(x => x.i);
check(cbSlots.length === 2, "4-3-3 really does have two identically labelled CB slots");
// Left and right are distinguished only by x, which is exactly why an index is needed.
const [slotA, slotB] = cbSlots;
const leftCb = f433.slots[slotA].x < f433.slots[slotB].x ? slotA : slotB;
const rightCb = leftCb === slotA ? slotB : slotA;

// ── THE REPORTED BUG ────────────────────────────────────────────────────────
// One centre back already on the pitch, a second on the bench. Promote the
// substitute into the LEFT slot; he must appear there, and the incumbent must
// not move.
{
  let squad: P[] = [
    player("Incumbent", "CB", { slotIndex: rightCb }),
    ...f433.slots
      .map((s, i) => ({ s, i }))
      .filter(x => x.s.label !== "CB")
      .map(x => player(`Filler ${x.i}`, x.s.label, { slotIndex: x.i })),
    player("Newcomer", "CB", { isSub: true, slotIndex: undefined }),
  ];
  const subIdx = squad.findIndex(p => p.name === "Newcomer");
  squad = moveToSlot(squad, subIdx, leftCb, "4-3-3");
  squad = seat(squad, "4-3-3");

  const atLeft = squad.find(p => p.slotIndex === leftCb);
  const atRight = squad.find(p => p.slotIndex === rightCb);
  check(atLeft?.name === "Newcomer", `the promoted sub takes the LEFT slot (got ${atLeft?.name})`);
  check(atRight?.name === "Incumbent", `the incumbent stays at RIGHT (got ${atRight?.name})`);
  check(squad.filter(p => !p.isSub).length === 11, "still eleven starters");
  const slots = squad.filter(p => !p.isSub).map(p => p.slotIndex);
  check(new Set(slots).size === slots.length, "no two starters share a slot");
}

// ── Formation change carries the squad over ─────────────────────────────────
{
  let squad: P[] = f433.slots.map((s, i) => player(`P${i}`, s.label, { slotIndex: i }));
  squad.push(player("Bench", "ST", { isSub: true }));
  const before = squad.filter(p => !p.isSub).length;

  for (const target of FORMATIONS.map(f => f.name)) {
    const moved = seat(squad.map(p => ({ ...p, slotIndex: undefined })), target);
    const starters = moved.filter(p => !p.isSub);
    check(starters.length === 11, `${target}: still eleven starters after the switch (got ${starters.length})`);
    const s = starters.map(p => p.slotIndex);
    check(new Set(s).size === s.length, `${target}: every starter holds a distinct slot`);
    const shape = FORMATIONS.find(f => f.name === target)!;
    check(
      starters.every(p => p.assignedPosition === shape.slots[p.slotIndex!].label),
      `${target}: every starter's position matches the slot he sits in`,
    );
    check(moved.length === squad.length, `${target}: nobody is lost in the switch`);
  }
  check(before === 11, "fixture set up eleven starters");
}

// ── A formation with fewer places benches the extras rather than hiding them ─
{
  const twelve: P[] = [
    ...f433.slots.map((s, i) => player(`P${i}`, s.label, { slotIndex: i })),
    player("Extra", "ST", { isSub: false, slotIndex: undefined }),
  ];
  const seated = seat(twelve, "4-3-3");
  check(seated.filter(p => !p.isSub).length === 11, "a twelfth starter is pushed to the bench");
  check(seated.find(p => p.name === "Extra")?.isSub === true, "the extra is the one benched");
  check(seated.length === 12, "the extra is still in the squad, just on the bench");
}

if (problems.length) {
  console.error("FAIL");
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log("PASS — slots keep their identity through promotions and formation changes");
