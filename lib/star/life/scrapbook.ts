/**
 * THE SCRAPBOOK (story world plan part 4b, job B, 28 Nov 2026): things that happened to YOU that
 * the whole world remembers, so one story can leave a fact for another story seasons later.
 *
 *  - A story outcome writes `"book": "watch-minute"` (strength 3, kept for good) or
 *    `"book": { "tag": "watch-minute", "strength": 2, "echo": { … } }`.
 *  - Any condition reads it: `book('watch-minute')`, `since('watch-minute')>=3` (whole seasons since
 *    it was last written), `{if book('watch-minute')}…{/if}` inside a line.
 *  - In the save: `life.sb`, "code.week.strength" joined by spaces, e.g. "wtch.412.3". The tag's
 *    4-letter code and its one plain line (for the People page) are in book/scrapbook.json: add a
 *    new tag there before a story writes it (the checker fails a tag that is not in the list, and a
 *    tag a story reads but nothing writes).
 *  - 48 lines at most (≤ 0.6 KB). Strength 3 never fades, 2 fades after about three seasons, 1 after
 *    one (people.ts MEMORY_LIFE). When full, the weakest and oldest line goes first, as with a
 *    person's memories (people.ts remember).
 *  - Echoes (`life.ech`, 6 at most): a write with `echo` books a text from that person, due a few
 *    seasons later; arcs.ts delivers it as a notice, or drops it if he has been forgotten by then.
 */
import type { LifeState } from "./types";
import { MEMORY_LIFE } from "./people";
import RAW from "./book/scrapbook.json";

export interface ScrapTag { code: string; line: string }
export const SCRAPBOOK: Record<string, ScrapTag> = RAW as Record<string, ScrapTag>;
const TAG_BY_CODE = new Map(Object.entries(SCRAPBOOK).map(([tag, t]) => [t.code, tag]));

export const MAX_SCRAPBOOK = 48;
export const MAX_ECHOES = 6;
/** The tag a scrapbook code stands for (an echo keeps the code). */
export const tagOfCode = (code: string): string | undefined => TAG_BY_CODE.get(code);

type Line = [string, number, 1 | 2 | 3];

function linesOf(sb: string | undefined): Line[] {
  const out: Line[] = [];
  for (const w of (sb ?? "").split(" ")) {
    const m = /^([0-9a-z]{4})\.(-?\d+)\.([123])$/.exec(w);
    if (m) out.push([m[1], Number(m[2]), Number(m[3]) as 1 | 2 | 3]);
  }
  return out;
}
const join = (ls: Line[]) => ls.map(([c, w, s]) => `${c}.${w}.${s}`).join(" ");
const live = (l: Line, now: number) => now - l[1] < MEMORY_LIFE[l[2]];

/** Write a line (a tag already there is moved to now, at the stronger strength). Mutates `life`. */
export function bookWrite(life: LifeState, tag: string, now: number, strength: 1 | 2 | 3 = 3): boolean {
  const t = SCRAPBOOK[tag];
  if (!t) return false;
  const old = linesOf(life.sb);
  const had = old.find((l) => l[0] === t.code);
  const next: Line[] = [...old.filter((l) => l[0] !== t.code && live(l, now)), [t.code, now, Math.max(strength, had?.[2] ?? 1) as 1 | 2 | 3]];
  while (next.length > MAX_SCRAPBOOK) {
    let worst = 0;
    for (let i = 1; i < next.length; i++) if (next[i][2] < next[worst][2] || (next[i][2] === next[worst][2] && next[i][1] < next[worst][1])) worst = i;
    next.splice(worst, 1);
  }
  life.sb = join(next);
  return true;
}

/** The newest live line for any of these tags, or undefined. */
function newest(life: Pick<LifeState, "sb"> | undefined, tags: string[], now: number): Line | undefined {
  const codes = new Set(tags.map((t) => SCRAPBOOK[t]?.code).filter(Boolean));
  let best: Line | undefined;
  for (const l of linesOf(life?.sb)) if (codes.has(l[0]) && live(l, now) && (!best || l[1] > best[1])) best = l;
  return best;
}

/** book('tag'): is it in the scrapbook (and not faded)? */
export const bookHas = (life: Pick<LifeState, "sb"> | undefined, tags: string[], now: number): boolean => !!newest(life, tags, now);

/** since('tag'): whole seasons since it was last written (50 life weeks a season), or undefined. */
export function bookSince(life: Pick<LifeState, "sb"> | undefined, tag: string, now: number): number | undefined {
  const l = newest(life, [tag], now);
  return l ? Math.floor((now - l[1]) / 50) : undefined;
}

/** The scrapbook as the People page would show it: newest first. */
export function scrapbookOf(life: Pick<LifeState, "sb"> | undefined, now: number): { tag: string; line: string; week: number; strength: 1 | 2 | 3 }[] {
  return linesOf(life?.sb).filter((l) => live(l, now)).sort((a, b) => b[1] - a[1]).map(([c, w, s]) => {
    const tag = TAG_BY_CODE.get(c) ?? c;
    return { tag, line: SCRAPBOOK[tag]?.line ?? tag, week: w, strength: s };
  });
}

/** Book an echo (6 at most; a seventh is not booked). Mutates `life`. */
export function addEcho(life: LifeState, due: number, who: string, tag: string, arcCode: string): boolean {
  const list = life.ech ?? [];
  const code = SCRAPBOOK[tag]?.code;
  if (!code || list.length >= MAX_ECHOES || list.some((e) => e[1] === who && e[2] === code)) return false;
  // The tag is kept as its 4-letter code, so six echoes stay under 0.3 KB.
  life.ech = [...list, [due, who, code, arcCode]];
  return true;
}
