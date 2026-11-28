/**
 * ENDINGS NEED EFFECTS (Harry, 28 Nov 2026: "remember endings need to have effects").
 *
 * Every story ending must change something in the game. For each story in the book, every
 * outcome that ends the story (arc.end) must carry at least one real effect: a bar or money
 * (effects), a flag (effects.flag), a person's feelings (npc), a memory (remember / noteSquad),
 * an item or unlock (give / unlock), or a skill (train).
 *
 * Prints how many endings have no effect (must be 0) and every ending no outcome reaches.
 * Exits 1 if any ending has no effect.
 *
 *   npx tsx scripts/life/ending-effects-check.mts
 */
import { ALL_ARCS } from "../../lib/star/life/arcBook";
import type { ArcOutcome, LifeArc } from "../../lib/star/life/types";

/** Every outcome in a story, wherever it sits (talk endings, card choices, promises kept/broken). */
export function outcomesOf(arc: LifeArc): ArcOutcome[] {
  const out: ArcOutcome[] = [];
  for (const b of arc.beats) {
    for (const list of Object.values(b.event.talk?.ends ?? {})) out.push(...list);
    for (const ch of b.event.choices ?? []) out.push(...ch.outcomes);
  }
  for (const p of Object.values(arc.promises ?? {})) {
    if (p.kept) out.push(p.kept);
    if (p.broken) out.push(p.broken);
  }
  return out;
}

const nonEmpty = (x: unknown): boolean => {
  if (x == null) return false;
  if (Array.isArray(x)) return x.length > 0;
  if (typeof x === "object") return Object.values(x as Record<string, unknown>).some((v) => v !== undefined && v !== 0 && v !== false && v !== "");
  return x !== "" && x !== 0 && x !== false;
};

/** Does this outcome change anything outside the story itself? */
export function hasEffect(o: ArcOutcome): boolean {
  return nonEmpty(o.effects) || nonEmpty(o.npc) || nonEmpty(o.remember) || nonEmpty(o.give)
    || nonEmpty(o.unlock) || nonEmpty(o.noteSquad) || nonEmpty(o.train)
    // Fields job B adds (scrapbook line); counted if present so this check keeps working after the merge.
    || nonEmpty((o as { book?: unknown }).book);
}

export interface EndingReport { arc: string; end: string; outcomes: number; bare: number }

export function endingReport(arcs: LifeArc[]): { rows: EndingReport[]; total: number } {
  const rows: EndingReport[] = [];
  let total = 0;
  for (const arc of arcs) {
    const outs = outcomesOf(arc);
    for (const e of arc.ends) {
      total++;
      const landing = outs.filter((o) => o.arc?.end === e.id);
      rows.push({ arc: arc.id, end: e.id, outcomes: landing.length, bare: landing.filter((o) => !hasEffect(o)).length });
    }
  }
  return { rows, total };
}

const isMain = process.argv[1]?.endsWith("ending-effects-check.mts");
if (isMain) {
  const verbose = process.argv.includes("--list");
  const { rows, total } = endingReport(ALL_ARCS);
  const noEffect = rows.filter((r) => r.outcomes > 0 && r.bare > 0);
  const unreachable = rows.filter((r) => r.outcomes === 0);
  console.log(`Stories: ${ALL_ARCS.length} · endings: ${total}`);
  console.log(`Endings with an outcome that changes nothing: ${noEffect.length}`);
  if (verbose || noEffect.length) for (const r of noEffect) console.log(`  ${r.arc} : ${r.end}  (${r.bare} of ${r.outcomes} outcomes bare)`);
  console.log(`Endings no outcome reaches: ${unreachable.length}`);
  for (const r of unreachable) console.log(`  ${r.arc} : ${r.end}`);
  if (noEffect.length) { console.log("FAIL: every ending must change something."); process.exit(1); }
  console.log("OK: every ending changes something.");
}
