import { FORMATIONS } from "../../lib/star/formations";
import { place, across } from "../../lib/star/pitchLayout";

/**
 * THE PLAYER CHIPS MUST NOT TOUCH.
 *
 * Reported directly, with a screenshot: on the team-sheet screen
 * (VersusScreen.tsx), a formation's centre-backs and its holding
 * midfielders — or its goalkeeper and its central centre-back — could sit
 * close enough that one player's name ran into the next player's face. That
 * screen squeezes eleven rows into a fraction of the pitch box's height (see
 * pitchLayout.ts), and a chip is a fixed-size face plus a name — so whether
 * two rows actually clear each other is a real pixel budget, not something
 * you can trust by eye against one screenshot. This computes it for real,
 * for every formation, at a narrow phone's width — the worst case, since the
 * chip stays a fixed pixel size while the gaps around it shrink with the
 * viewport.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

// A narrow phone: the pitch box sits inside `max-w-md` (448px), capped by
// the viewport minus the page's own 12px padding on each side.
const VIEWPORT_WIDTH = 320;
const PITCH_W = Math.min(VIEWPORT_WIDTH - 24, 448);
const PITCH_H = PITCH_W * (5 / 3); // VersusScreen.tsx's aspect-[3/5]

// <Man>: a 25px face circle directly above a name row, no margin between
// them, both centred on the anchor point. Two chips read as overlapping when
// they are this close on a straight line between their centres — a circular
// exclusion zone rather than an axis-aligned box, because a real formation
// stacks plenty of pairs that are close on ONE axis and wide open on the
// other (a back three's two centre-backs, level but nowhere near touching;
// a staggered striker and attacking mid, diagonal rather than either). An
// axis-aligned box flags both of those as collisions they visually are not.
// The 36px diameter is the face circle's own footprint plus the name row's
// height — calibrated against a real back three's own centre-back spacing
// (~59px apart, and never reported as a problem) staying comfortably clear.
const CHIP_DIAMETER = 36;

for (const formation of FORMATIONS) {
  const men = formation.slots.map(s => ({
    label: s.label ?? s.role,
    x: across(s.x, false) * PITCH_W,
    y: place(s.y, false) * PITCH_H,
  }));
  for (let i = 0; i < men.length; i++) {
    for (let j = i + 1; j < men.length; j++) {
      const a = men[i], b = men[j];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      check(
        dist >= CHIP_DIAMETER,
        `${formation.name}: ${a.label} and ${b.label} sit close enough to collide `
        + `(${dist.toFixed(1)}px apart, need ${CHIP_DIAMETER}px)`,
      );
    }
  }
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems.slice(0, 40)) console.log(`  ✗ ${p}`);
  if (problems.length > 40) console.log(`  ...and ${problems.length - 40} more`);
  process.exit(1);
}
console.log(`PASS — all ${FORMATIONS.length} formations clear their player chips at a ${VIEWPORT_WIDTH}px-wide phone`);
