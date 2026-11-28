/**
 * The story checker on its own, quick (no dice): every problem validateArcBook finds in the book.
 *   npx tsx scripts/life/story-check-quick.mts [arc-id-substring ...]
 * The full check (the dice, the people pool) is tests/star/lifeArcs.mts.
 */
import { ALL_ARCS } from "../../lib/star/life/arcBook";
import { validateArcBook } from "../../lib/star/life/validateArcs";
import { EVENTS } from "../../lib/star/life/book";

const only = process.argv.slice(2);
const probs = validateArcBook(ALL_ARCS, EVENTS).filter((p) => !only.length || only.some((o) => p.id.includes(o)));
for (const p of probs) console.log(`${p.id}: ${p.problem}`);
console.log(probs.length ? `${probs.length} problems` : "story check: clean");
process.exit(probs.length ? 1 : 0);
