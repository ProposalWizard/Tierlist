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
 *
 * Two checks, not one — WITHIN a side's own formation, and ACROSS the
 * halfway line between whichever two formations actually meet. The second
 * one exists because the first one alone missed a real collision: a lone,
 * centred striker from each side sits mirrored across the halfway line
 * with nothing but HALFWAY_INSET keeping the two apart, and that only
 * showed up once the chip was restored to its full original size — small
 * enough at 25/26px to clear, too close at the real 34px. Checked over
 * every formation against every OTHER formation, not just itself, since a
 * real match pairs any two of the thirty against each other.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

// A narrow phone: the pitch box sits inside `max-w-md` (448px), capped by
// the viewport minus the page's own 12px padding on each side.
const VIEWPORT_WIDTH = 320;
const PITCH_W = Math.min(VIEWPORT_WIDTH - 24, 448);
const PITCH_H = PITCH_W * (4.9 / 3); // VersusScreen.tsx's aspect-[3/4.9]

// <Man>: a 34px face circle directly above a name row, no margin between
// them, both centred on the anchor point — the size this screen originally
// shipped with. Two chips read as overlapping when they are this close on a
// straight line between their centres — a circular exclusion zone rather
// than an axis-aligned box, because a real formation stacks plenty of pairs
// that are close on ONE axis and wide open on the other (a back three's two
// outer centre-backs, level but nowhere near touching; a staggered striker
// and attacking mid, diagonal rather than either). An axis-aligned box
// flags both of those as collisions they visually are not. The 45px
// diameter is the face circle's own footprint plus the name row's height.
//
// This box and this chip are the ORIGINAL numbers — restored twice over.
// The first overlap fix (this same file) shrank the chip to 25px and grew
// the box to aspect-[3/5] to buy clearance; reported directly as an
// unwanted scroll to reach Kick Off and visibly smaller faces. A first
// attempt at undoing that only split the difference (26px, aspect-[3/4.7]);
// reported again as still not the original size and still not fitting.
// The actual fix was never the box or the chip — it was formations.ts's
// own bands: several formations had a back three's centre CB, a lone CDM,
// or a lone CAM sitting on the EXACT SAME x as the goalkeeper or an
// adjacent row, so their only separation was a pure vertical squeeze with
// nothing diagonal to give. Spreading those specific slots off that shared
// centre-line (see back3() and the individual formations' own comments in
// formations.ts) bought most of the clearance those formations needed, at
// the full original chip size, with HALFWAY_INSET (pitchLayout.ts) making
// up the rest once the cross-team squeeze below was found.
const CHIP_DIAMETER = 45;

// ── Within one side's own formation ─────────────────────────────────────
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

// ── Across the halfway line, every formation against every other ───────
let crossChecked = 0;
for (const home of FORMATIONS) {
  const homeMen = home.slots.map(s => ({
    label: s.label ?? s.role,
    x: across(s.x, false) * PITCH_W,
    y: place(s.y, false) * PITCH_H,
  }));
  for (const away of FORMATIONS) {
    const awayMen = away.slots.map(s => ({
      label: s.label ?? s.role,
      x: across(s.x, true) * PITCH_W,
      y: place(s.y, true) * PITCH_H,
    }));
    for (const h of homeMen) {
      for (const a of awayMen) {
        crossChecked++;
        const dist = Math.hypot(h.x - a.x, h.y - a.y);
        check(
          dist >= CHIP_DIAMETER,
          `${home.name} (home ${h.label}) vs ${away.name} (away ${a.label}) sit close enough to collide `
          + `across the halfway line (${dist.toFixed(1)}px apart, need ${CHIP_DIAMETER}px)`,
        );
      }
    }
  }
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems.slice(0, 40)) console.log(`  ✗ ${p}`);
  if (problems.length > 40) console.log(`  ...and ${problems.length - 40} more`);
  process.exit(1);
}
console.log(
  `PASS — all ${FORMATIONS.length} formations clear their own player chips, and all `
  + `${crossChecked} cross-halfway pairings clear each other, at a ${VIEWPORT_WIDTH}px-wide phone`,
);
