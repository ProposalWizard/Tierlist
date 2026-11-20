/**
 * THE PEOPLE POOL — a story names a ROLE ("kitman", "groundsman", "physio", "reporter",
 * "legend"…) and the career picks one person for that role and keeps him or her for good.
 *
 * Harry, 20 Nov 2026: "is this a one off at any club? surely varying his name/voice across
 * different careers makes sense", then "there should be hundreds of things like this, big and
 * small". Den is one kit man of four.
 *
 *  - The pick is the career's seed and the role (the same career always gets the same man),
 *    unless the save has pinned one (`life.pool[role]`, set by migrate.ts for a save whose kit
 *    man story had already started with Den).
 *  - One person per role per career, so a club move does not swap him: a story that started at
 *    the old club still has him on the phone (the arcs' landline variants).
 *  - A role with no pool here keeps people.ts's own naming (names from the career's seed).
 *  - Lines read him through the slot: {kitman.short}, {kitman.name}, {kitman.age},
 *    {kitman.from}, {kitman.initial}, {kitman.signoff} (text.ts). Never write a pool name
 *    ("Den") into a story: tests/star/lifeArcs.mts fails on it.
 *  - Voice: a person's recorded clips live in their own folder (`voice`, a manifest.json in
 *    public/star/life/voice/<folder>/). A clip spoken by a pool person plays only when that
 *    person is the one in the story; a person with no clips is silent text (voice.ts).
 *  - Stills: only a person with drawn stills has them (`stills`); the others get the empty
 *    backdrop and the drawn head (StoryPlayer, StoryCards).
 */
import type { CareerState } from "../types";

export interface PoolPerson {
  /** Stable id (never shown); also the `speaker` of his voice clips. */
  id: string;
  first: string;
  last: string;
  /** What lines call him (default: first name). */
  short?: string;
  age: number;
  /** Where he is from: the accent a voice should have. */
  from: string;
  /** One line on how he is with people. */
  manner: string;
  /** His look: a people preset id (lib/star/people/presets.ts). */
  look: string;
  /** How he signs a text or a note ({role.signoff}). */
  signoff: string;
  /** His recorded clips' folder under public/star/life/voice/ (none: silent text). */
  voice?: string;
  /** Drawn stills, if any (public/star/life/…). */
  stills?: { face?: string; cut?: string; pitch?: string; van?: string; stadium?: string };
}

const K = "/star/life/kitman/";

/** Every role that has a pool. Add a role: a list here, and the role in people.ts. */
export const POOL: Record<string, PoolPerson[]> = {
  kitman: [
    { id: "den", first: "Den", last: "Hartley", age: 63, from: "Barnsley, South Yorkshire", manner: "Dry, plain-spoken; says the hard thing once and then folds the towels.", look: "trk-old-physio", signoff: "D", voice: "hundred-balls",
      stills: { face: `${K}face-den.webp`, cut: `${K}cut-den.webp`, pitch: `${K}pitch2-den.webp`, van: `${K}van-den.webp`, stadium: `${K}stadium-den.webp` } },
    { id: "ray", first: "Ray", last: "Gilmour", age: 58, from: "Glasgow", manner: "Gruff and quick to tease; soft underneath, and he never forgets a birthday.", look: "trk-kit-man", signoff: "Ray" },
    { id: "sol", first: "Solomon", last: "Mensah", short: "Sol", age: 60, from: "Lewisham, south London", manner: "Calm; never raises his voice; hums hymns while he folds.", look: "trk-academy", signoff: "God bless. S" },
    { id: "mick", first: "Mick", last: "Varley", age: 66, from: "Bristol", manner: "A talker; a story for every boot in the room, half of them true.", look: "mgr-bald-stubble", signoff: "Mick x" },
  ],
  groundsman: [
    { id: "ron", first: "Ron", last: "Thwaite", age: 64, from: "Wigan", manner: "Talks to the grass more than to people.", look: "trk-touchline", signoff: "R. Thwaite" },
    { id: "alan", first: "Alan", last: "Pickering", age: 59, from: "Norwich", manner: "Slow, exact, and right about the weather.", look: "trk-kit-man", signoff: "Alan" },
    { id: "frank", first: "Frank", last: "Doherty", age: 67, from: "Derry", manner: "Shouts at anyone on his grass, then makes them tea.", look: "mgr-old-pro", signoff: "F" },
  ],
  physio: [
    { id: "helen", first: "Helen", last: "Rowntree", age: 44, from: "York", manner: "Brisk; believes every word you say about the pain, none about the timing.", look: "trk-physio", signoff: "Helen" },
    { id: "priya", first: "Priya", last: "Kowalski", age: 36, from: "Leicester", manner: "Kind, funny, and immovable about rest days.", look: "trk-physio", signoff: "P" },
    { id: "nadia", first: "Nadia", last: "Haworth", age: 51, from: "Sheffield", manner: "Has seen every injury twice and says so.", look: "trk-physio", signoff: "N. Haworth" },
  ],
  reporter: [
    { id: "jo", first: "Jo", last: "Callaghan", age: 38, from: "Liverpool", manner: "Fair, persistent, and remembers what you said last season.", look: "smt-analyst", signoff: "Jo, Evening Lantern" },
    { id: "claire", first: "Claire", last: "Bairstow", age: 47, from: "Leeds", manner: "Twenty years on the beat; asks the second question.", look: "smt-analyst", signoff: "Claire B" },
    { id: "amy", first: "Amy", last: "Quigley", age: 29, from: "Belfast", manner: "New on the beat, keen, a little too honest.", look: "smt-analyst", signoff: "Amy" },
  ],
  legend: [
    { id: "terry", first: "Terry", last: "Marsh", short: "Marsh", age: 71, from: "Stoke", manner: "Played 400 games here and tells you about 300 of them.", look: "mgr-old-pro", signoff: "Terry Marsh" },
    { id: "keith", first: "Keith", last: "Sowerby", short: "Sowerby", age: 68, from: "Middlesbrough", manner: "Quiet; one sentence from him is a speech.", look: "mgr-silver-fox", signoff: "K.S." },
    { id: "derek", first: "Derek", last: "Ibbotson", short: "Ibbotson", age: 74, from: "Hull", manner: "Still wears the club tie to the shops.", look: "mgr-grey-fade", signoff: "Derek" },
  ],
};

function hash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (((h << 5) + h) ^ s.charCodeAt(i)) | 0;
  return h >>> 0;
}

/** The person this career has for a role (null: the role has no pool). */
export function poolPerson(c: Pick<CareerState, "player"> & { life?: { pool?: Record<string, string> } }, role: string): PoolPerson | null {
  const list = POOL[role];
  if (!list?.length) return null;
  const pinned = c.life?.pool?.[role];
  if (pinned) { const p = list.find((x) => x.id === pinned); if (p) return p; }
  const seed = hash(`${c.player.firstName}|${c.player.lastName}|${c.player.startYear}|${role}`);
  return list[seed % list.length];
}

/** Every pool person's names, for the checker (no story may hard-code one). */
export function poolNames(role: string): string[] {
  return (POOL[role] ?? []).flatMap((p) => [p.first, p.short ?? p.first]).filter((n, i, a) => a.indexOf(n) === i);
}
