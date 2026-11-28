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
 *  - Club people (28 Nov 2026): the kit man, groundsman, physio and legend belong to a club. The
 *    career's first club keeps the plain pick above; another club's person is picked by the career
 *    and the club (`poolPerson(c, role, club)`), pinned in `life.cpool` when a story first meets him,
 *    and never one the career already has at another club while the pool has someone left. A story
 *    that started at the old club still has its man on the phone (the arcs' landline variants).
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
import { clubLegendAt, clubLegendById } from "./clubLegends";

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
    // Club people (28 Nov 2026): each club has its own kit man, so a long career needs more of them.
    { id: "bernie", first: "Bernie", last: "Coates", age: 61, from: "Gateshead", manner: "Whistles through his teeth; has a nickname for everyone and uses it.", look: "trk-kit-man", signoff: "B" },
    { id: "clive", first: "Clive", last: "Royle", age: 57, from: "Swindon", manner: "Neat to a fault; labels everything, including you.", look: "trk-academy", signoff: "C. Royle" },
    { id: "tommo", first: "Tommo", last: "Fenwick", age: 69, from: "Hartlepool", manner: "Worked here since the old stand; deaf in one ear when it suits him.", look: "mgr-old-pro", signoff: "Tommo" },
    { id: "gus", first: "Gus", last: "Abara", age: 55, from: "Croydon", manner: "Big laugh, bigger kettle; feeds the youth team out of his own pocket.", look: "trk-old-physio", signoff: "Gus" },
  ],
  groundsman: [
    { id: "ron", first: "Ron", last: "Thwaite", age: 64, from: "Wigan", manner: "Talks to the grass more than to people.", look: "trk-touchline", signoff: "R. Thwaite" },
    { id: "alan", first: "Alan", last: "Pickering", age: 59, from: "Norwich", manner: "Slow, exact, and right about the weather.", look: "trk-kit-man", signoff: "Alan" },
    { id: "frank", first: "Frank", last: "Doherty", age: 67, from: "Derry", manner: "Shouts at anyone on his grass, then makes them tea.", look: "mgr-old-pro", signoff: "F" },
    { id: "eddie", first: "Eddie", last: "Lund", age: 62, from: "Grimsby", manner: "Measures the grass with a ruler and tells you the number.", look: "trk-touchline", signoff: "E. Lund" },
    { id: "vic", first: "Vic", last: "Hargreaves", age: 70, from: "Oldham", manner: "Forty years on the roller; says little and notices everything.", look: "mgr-grey-fade", signoff: "Vic" },
    { id: "gordon", first: "Gordon", last: "Swale", age: 58, from: "Carlisle", manner: "Cheerful in any weather, worried about the drains.", look: "trk-kit-man", signoff: "Gordon" },
  ],
  physio: [
    { id: "helen", first: "Helen", last: "Rowntree", age: 44, from: "York", manner: "Brisk; believes every word you say about the pain, none about the timing.", look: "trk-physio", signoff: "Helen" },
    { id: "priya", first: "Priya", last: "Kowalski", age: 36, from: "Leicester", manner: "Kind, funny, and immovable about rest days.", look: "trk-physio", signoff: "P" },
    { id: "nadia", first: "Nadia", last: "Haworth", age: 51, from: "Sheffield", manner: "Has seen every injury twice and says so.", look: "trk-physio", signoff: "N. Haworth" },
    { id: "fiona", first: "Fiona", last: "Leckie", age: 41, from: "Dundee", manner: "Calm, exact, and keeps a chart of your hamstrings on the wall.", look: "trk-physio", signoff: "Fiona" },
    { id: "sunita", first: "Sunita", last: "Rao", age: 34, from: "Coventry", manner: "Quick, warm, and will not be lied to twice.", look: "trk-physio", signoff: "S" },
    { id: "beth", first: "Beth", last: "Ormerod", age: 55, from: "Blackburn", manner: "Thirty years of ankles; laughs at your pain, then fixes it.", look: "trk-physio", signoff: "B. Ormerod" },
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
    { id: "barry", first: "Barry", last: "Lyle", short: "Lyle", age: 69, from: "Sunderland", manner: "Scored the goal in the cup run and has the photo in his wallet.", look: "mgr-old-pro", signoff: "Barry Lyle" },
    { id: "colin", first: "Colin", last: "Steadman", short: "Steadman", age: 72, from: "Ipswich", manner: "Gentle, proud, and still the best-dressed man in the ground.", look: "mgr-silver-fox", signoff: "C. Steadman" },
    { id: "wes", first: "Wes", last: "Okoro", short: "Okoro", age: 63, from: "Peckham, south London", manner: "Talks fast, laughs loud, never misses a home game.", look: "mgr-bald-stubble", signoff: "Wes" },
    { id: "phil", first: "Phil", last: "Gaskell", short: "Gaskell", age: 76, from: "Preston", manner: "Played in the mud and says the pitches now are carpets.", look: "mgr-grey-fade", signoff: "P. Gaskell" },
    { id: "jimmy", first: "Jimmy", last: "Rourke", short: "Rourke", age: 67, from: "Dublin", manner: "A captain still; stands up when the anthem plays on the telly.", look: "mgr-old-pro", signoff: "Jimmy R" },
  ],
};

function hash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (((h << 5) + h) ^ s.charCodeAt(i)) | 0;
  return h >>> 0;
}

/** The person this career has for a role (null: the role has no pool). */
export function poolPerson(c: Pick<CareerState, "player"> & { life?: { pool?: Record<string, string>; cpool?: Record<string, string> } }, role: string, club = ""): PoolPerson | null {
  const list = POOL[role];
  if (!list?.length) return null;
  if (club) {
    // Another club's person (club people, 28 Nov 2026): pinned the first time a story met him; else
    // the career and the club pick him, skipping anyone this career already has at another club
    // (while the pool has someone left), so two clubs never share a kit man.
    const pin = c.life?.cpool?.[`${role}@${club}`];
    if (pin) { const p = list.find((x) => x.id === pin) ?? (role === "legend" ? clubLegendById(pin) : undefined); if (p) return p; }
    // The 26 hook clubs (clubLegends.ts, story world job B): a fixed legend at a club you moved to.
    // Only after the pin above, so a legend a story already met at that club stays.
    if (role === "legend") { const fixed = clubLegendAt(club); if (fixed) return fixed; }
    const used = new Set<string>([poolPerson(c, role)!.id]);
    for (const [k, v] of Object.entries(c.life?.cpool ?? {})) if (k.startsWith(`${role}@`) && k !== `${role}@${club}`) used.add(v);
    const start = hash(`${c.player.firstName}|${c.player.lastName}|${c.player.startYear}|${role}|${club}`) % list.length;
    for (let i = 0; i < list.length; i++) { const p = list[(start + i) % list.length]; if (!used.has(p.id)) return p; }
    return list[start];
  }
  const pinned = c.life?.pool?.[role];
  if (pinned) { const p = list.find((x) => x.id === pinned); if (p) return p; }
  const seed = hash(`${c.player.firstName}|${c.player.lastName}|${c.player.startYear}|${role}`);
  // The career's first club picks from the people the pool had before club people (so every save
  // keeps the person it would always have met); the newer ones are for the clubs you move to.
  return list[seed % (FIRST_CLUB_POOL[role] ?? list.length)];
}

/** How many of each pool the career's first club picks from (the pool as it was on 27 Nov 2026). */
const FIRST_CLUB_POOL: Record<string, number> = { kitman: 4, groundsman: 3, physio: 3, reporter: 3, legend: 3 };

/** Every pool person's names, for the checker (no story may hard-code one). */
export function poolNames(role: string): string[] {
  return (POOL[role] ?? []).flatMap((p) => [p.first, p.short ?? p.first]).filter((n, i, a) => a.indexOf(n) === i);
}
