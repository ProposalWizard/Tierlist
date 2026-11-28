/**
 * TURNED DOWN (Harry, 28 Nov 2026: "'I'll see you Thursday' and then not coming and seeing him
 * when offered should do something").
 *
 * An ending that turns someone down (an invitation said no to, an offer walked past, a visit never
 * made) carries `"snub": "<slot>"`. The first time, that person keeps a memory of it
 * ("turned-me-down", strength 2). The second time, across ANY story, it costs more: bond and
 * respect down, a grudge, a strength-3 memory ("turned-me-down-twice") and one line from them
 * (the story's `snubTwice`, else the plain one below). Other stories read both memories with
 * mem('turned-me-down') and mem('turned-me-down-twice').
 *
 * It only changes the picked outcome before it plays (arcs.ts playEnding), so the card shows
 * every change like any other.
 */
import type { ArcOutcome, LifeState } from "./types";

export const SNUB_TAG = "turned-me-down";
export const SNUB_TWICE_TAG = "turned-me-down-twice";
const TWICE_LINE = "That's twice you've said no to {slot.short}. There won't be a third ask.";

/** The outcome with the snub's cost added (unchanged when it has no `snub`). */
export function withSnub(o: ArcOutcome, life: LifeState, cast: Record<string, string>): ArcOutcome {
  const slot = o.snub;
  if (!slot) return o;
  const pid = cast[slot];
  if (!pid) return o;
  const mem = life.people[pid]?.m ?? [];
  const before = mem.some(([t]) => t === SNUB_TAG || t === SNUB_TWICE_TAG);
  if (!before) return { ...o, remember: [...(o.remember ?? []), { slot, tag: SNUB_TAG, strength: 2 }] };
  const line = (o.snubTwice ?? TWICE_LINE).replace(/\{slot\./g, `{${slot}.`);
  return {
    ...o,
    text: [o.text, line].filter(Boolean).join(" "),
    npc: [...(o.npc ?? []), { slot, bond: -8, respect: -4, grudge: 8 }],
    remember: [...(o.remember ?? []), { slot, tag: SNUB_TWICE_TAG, strength: 3 }],
  };
}
