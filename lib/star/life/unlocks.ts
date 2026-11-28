/**
 * THE UNLOCKS REGISTRY (story world plan part 1, job B, 28 Nov 2026).
 *
 * Every place, cut scene, skill, item and game mode a story can open, in one list. A story grants
 * one with `"unlock": "<id>"` (or `"give": "<item id>"` for an item); the checker fails an id that is
 * not here. `has(<id>)` reads it back in any condition.
 *
 * In the save: `life.ul`, each unlock's 3-letter code joined by spaces ("hbc dvs krd"), NEVER
 * trimmed (43 x 4 bytes, under 0.2 KB). The four old words the book used before this list
 * (`item:dens-ball-bag`, `item:legends-boots`, `garden:hundred-balls-corner(+den-visits)`,
 * `trophy:the-kit-room-door`) sit in `life.got` on older saves; `unlocksOf` maps them to their new
 * ids when it reads, so an old save keeps them without the save being rewritten.
 *
 * `status` says how far the thing itself is built (exists / small / medium / big): a story can
 * grant any id now; the place or screen that shows it comes later (plan part 5d). Never rename an
 * id or change a code once a story uses it: saves name them.
 */
import type { LifeState } from "./types";
import * as CLUBS from "../clubs";

export type UnlockKind = "place" | "cutscene" | "skill" | "item" | "mode";
export type UnlockStatus = "exists" | "small" | "medium" | "big";

export interface Unlock {
  id: string;
  kind: UnlockKind;
  /** Its 3-letter code in the save (life.ul). Never change it. */
  code: string;
  /** What the ending card calls it: "Unlocked · <name>". */
  name: string;
  /** One plain line under the name. */
  line: string;
  /** What opens it (a story and ending, or a condition), in words. */
  by: string;
  /** Where it would live in the game. */
  where: string;
  status: UnlockStatus;
}

export const UNLOCKS: Unlock[] = [
  // ── Places ──
  { id: "heritage-room", kind: "place", code: "her", name: "The heritage room", line: "A quiet room of old photographs. You can walk in and stand.", by: "club:manchester-united, your first week", where: "lib/star/world3d/clubPlaces.ts", status: "big" },
  { id: "legends-lounge", kind: "place", code: "lgl", name: "The legends lounge", line: "The matchday lounge where the club legend sits. Go and say hello.", by: "a big-club legend story's last beat", where: "lib/star/world3d/clubPlaces.ts", status: "big" },
  { id: "old-boot-room", kind: "place", code: "obr", name: "The old boot room", line: "A backdrop for talks, with boots on the pegs.", by: "first club-legend story beat at any club", where: "components/star/life/StoryCards.tsx", status: "small" },
  { id: "cage-pitch", kind: "place", code: "cag", name: "The cage pitch", line: "A town cage pitch for a kickabout.", by: "legends-boots promise p-cage kept", where: "lib/star/world3d/ + EnginePlay profile", status: "big" },
  { id: "hundred-balls-corner", kind: "place", code: "hbc", name: "The hundred-balls corner", line: "A ball bag and a cone in your garden. Tap it to play the hundred again.", by: "hundred-balls ending", where: "lib/star/garden3d/scene.ts", status: "small" },
  { id: "den-visits", kind: "place", code: "dvs", name: "Visits from the kit man", line: "The kit man sometimes drops round to your garden.", by: "hundred-balls ending", where: "dayPlan (people plan)", status: "small" },
  { id: "kit-room-door", kind: "place", code: "krd", name: "Your name on the kit room door", line: "A hundred out of a hundred, written on the door.", by: "hundred-balls b4-the-door", where: "components/star/life/PeoplePage.tsx", status: "small" },
  { id: "the-rec", kind: "place", code: "rec", name: "The rec", line: "The council pitch in town. Sunday kickabouts with your pal.", by: "the-rec ending the-rec-saved", where: "lib/star/world3d/", status: "big" },
  { id: "museum-case", kind: "place", code: "mus", name: "A case in the club museum", line: "Your thing behind glass in the club museum.", by: "the-pram-in-the-museum museum ending", where: "components/star/ Club tab", status: "small" },
  { id: "town-mural", kind: "place", code: "mur", name: "Your mural", line: "Your face on a wall on the drive to training.", by: "the-wall ending the-mural", where: "drive screen", status: "small" },
  { id: "statue-plinth", kind: "place", code: "sta", name: "The statue", line: "Your statue outside the ground.", by: "the-statue ending the-sheet", where: "lib/star/world3d/clubPlaces.ts", status: "big" },
  { id: "europe-night-hotel", kind: "place", code: "eht", name: "The team hotel abroad", line: "The hotel the night before a European tie.", by: "europe + an away tie at one of the six European clubs", where: "components/star/life/StoryCards.tsx", status: "small" },
  // ── Cut scenes ──
  { id: "cs-anthem", kind: "cutscene", code: "can", name: "The anthem", line: "You line up for the anthem at your first cap.", by: "just(first-call-up)", where: "lib/star/cutscene/story.ts", status: "small" },
  { id: "cs-legend-handshake", kind: "cutscene", code: "clh", name: "The legend's handshake", line: "He waits by the tunnel and shakes your hand.", by: "first meeting with a top-26 club's legend", where: "lib/star/cutscene/story.ts", status: "small" },
  { id: "cs-number-retired", kind: "cutscene", code: "cnr", name: "Your number, retired", line: "Your shirt framed and held up at your last home game.", by: "the-last-number retired ending", where: "lib/star/cutscene/story.ts", status: "small" },
  { id: "cs-testimonial-walkout", kind: "cutscene", code: "ctw", name: "The testimonial walk-out", line: "You walk out with your family and your old team-mates.", by: "testimonial match played", where: "lib/star/cutscene/story.ts", status: "small" },
  { id: "cs-guard-of-honour", kind: "cutscene", code: "cgh", name: "The guard of honour", line: "Both teams clap you out.", by: "just(trophy:league)", where: "lib/star/cutscene/story.ts", status: "medium" },
  { id: "cs-trophy-parade", kind: "cutscene", code: "ctp", name: "The open-top bus", line: "The trophy parade through town.", by: "first league title at a club", where: "lib/star/cutscene/ + a new set", status: "big" },
  { id: "cs-statue-unveiling", kind: "cutscene", code: "csu", name: "The unveiling", line: "The sheet comes off your statue.", by: "statue-plinth", where: "lib/star/cutscene/", status: "big" },
  // ── Skills ──
  { id: "drill-dens-hundred", kind: "skill", code: "ddh", name: "The kit man's hundred", line: "His hundred, as a drill in your own garden, once a week.", by: "item-dens-ball-bag", where: "garden entry (HundredDrill.tsx)", status: "small" },
  { id: "drill-legends-six", kind: "skill", code: "dls", name: "The legend's six rounds", line: "His six rounds at training, once a week.", by: "a top-26 legend story's teach-me ending", where: "lib/star/life/drill.ts round sets", status: "small" },
  { id: "celebration-legend", kind: "skill", code: "cel", name: "The legend's celebration", line: "His old celebration, now one of yours.", by: "Chelsea, Spurs, Palace legend stories", where: "lib/star/celebration.ts", status: "medium" },
  { id: "runup-for-stan", kind: "skill", code: "rfs", name: "The run-up for Stan", line: "A penalty run-up named for your grandad's team-mate.", by: "grandads-teammate ending the-penalty-for-stan", where: "shop run-ups list", status: "medium" },
  { id: "talk-captains-word", kind: "skill", code: "tcw", name: "Captain's word", line: "A new answer in pre-match team talks.", by: "the-armband or the-national-armband", where: "lib/star/life/decision.ts", status: "small" },
  { id: "crossbar-with-a-mate", kind: "skill", code: "cbm", name: "Crossbar with a mate", line: "A crossbar challenge in the garden against a visitor.", by: "any team-mate bond 60+", where: "garden entry", status: "small" },
  // ── Items ──
  { id: "item-dens-ball-bag", kind: "item", code: "idb", name: "The kit man's ball bag", line: "His old ball bag. His hundred is now a drill in your garden.", by: "hundred-balls", where: "lib/star/life/unlocks.ts ITEM_WORDS", status: "exists" },
  { id: "item-legends-boots", kind: "item", code: "ilb", name: "The legend's boots", line: "His old boots, in a case in your house.", by: "legends-boots ending his-boots", where: "lib/star/life/unlocks.ts ITEM_WORDS", status: "small" },
  { id: "item-grandads-medal", kind: "item", code: "igm", name: "Your grandad's medal", line: "The old county medal, on your mantel.", by: "grandads-teammate ending the-medal-home", where: "lib/star/home3d/", status: "medium" },
  { id: "item-old-scarf", kind: "item", code: "ios", name: "The old scarf", line: "The 1971 scarf, framed.", by: "the-lucky-scarf ending the-boy-has-it", where: "Locker", status: "small" },
  { id: "item-match-ball", kind: "item", code: "imb", name: "The match ball", line: "The signed ball from the day.", by: "the-match-ball ending the-ball", where: "Locker", status: "small" },
  { id: "item-stopped-watch", kind: "item", code: "isw", name: "The stopped watch", line: "The legend's pocket watch, stopped at the minute of his first goal.", by: "The stopped watch (job C)", where: "lib/star/wearables.ts", status: "medium" },
  { id: "item-framed-shirt", kind: "item", code: "ifs", name: "A framed shirt", line: "A shirt in a frame on your wall.", by: "first cap, or testimonial", where: "lib/star/home3d/", status: "medium" },
  { id: "item-clay-print", kind: "item", code: "icp", name: "The clay print", line: "A cast of your boot print from the old boot room.", by: "The clay tray (job C)", where: "Locker", status: "small" },
  // ── Game modes ──
  { id: "mode-penalties", kind: "mode", code: "mpe", name: "Penalties", line: "A penalty in a real match moment, or a shoot-out.", by: "ten-minutes", where: "components/star/life/ActivityHost.tsx", status: "small" },
  { id: "mode-two-touch", kind: "mode", code: "mtt", name: "Two-touch", line: "Keep-ups to a count.", by: "keep-ups", where: "components/star/life/ActivityHost.tsx", status: "small" },
  { id: "mode-head-tennis", kind: "mode", code: "mht", name: "Head tennis", line: "Heading over the physio bed, first to eleven.", by: "head-tennis", where: "EnginePlay profile", status: "medium" },
  { id: "mode-duel-1v1", kind: "mode", code: "mdu", name: "One against one", line: "First to three, one against one.", by: "legends-boots", where: "EnginePlay profile", status: "medium" },
  { id: "mode-five-a-side", kind: "mode", code: "mfa", name: "Five-a-side", line: "Five against five, small goals.", by: "wednesday-fives, the-rec", where: "EnginePlay profile", status: "big" },
  { id: "mode-testimonial", kind: "mode", code: "mts", name: "The testimonial", line: "A short friendly with old team-mates.", by: "the-charity-match, last-seasons stories", where: "EnginePlay profile", status: "medium" },
  { id: "mode-gym-board", kind: "mode", code: "mgb", name: "The gym board", line: "Beat a record on the bench or the treadmill.", by: "the-gym-board", where: "lib/star/gym/games.ts", status: "small" },
  { id: "mode-karting", kind: "mode", code: "mka", name: "Karting", line: "Three laps against the squad's fastest.", by: "the-karting", where: "components/star/life/minigames/", status: "medium" },
  { id: "mode-sprint", kind: "mode", code: "msp", name: "The sprint", line: "Forty metres against a team-mate.", by: "the-race", where: "components/star/life/minigames/", status: "small" },
  { id: "mode-drive", kind: "mode", code: "mdr", name: "The drive", line: "Drive the young lad in, and talk on the way.", by: "the-lift", where: "components/star/life/minigames/", status: "medium" },
];

export const UNLOCK_BY_ID = new Map(UNLOCKS.map((u) => [u.id, u]));
const BY_CODE = new Map(UNLOCKS.map((u) => [u.code, u]));

/** The words the book used before the registry (in `life.got` on older saves) → the new ids. */
export const OLD_UNLOCK_WORDS: Record<string, string> = {
  "item:dens-ball-bag": "item-dens-ball-bag",
  "item:legends-boots": "item-legends-boots",
  "garden:hundred-balls-corner": "hundred-balls-corner",
  "garden:den-visits": "den-visits",
  "trophy:the-kit-room-door": "kit-room-door",
};

/** Every unlock this career has: `life.ul`, plus the old words in `life.got` mapped. */
export function unlocksOf(life: Pick<LifeState, "ul" | "got"> | undefined): Set<string> {
  const out = new Set<string>();
  if (!life) return out;
  for (const code of (life.ul ?? "").split(" ")) { const u = BY_CODE.get(code); if (u) out.add(u.id); }
  for (const w of life.got ?? []) { const id = OLD_UNLOCK_WORDS[w]; if (id) out.add(id); }
  return out;
}

/** Add unlocks to `life.ul` (never trimmed; an id it already has is not added twice). Mutates `life`.
 *  Returns the ones that are new. */
export function grantUnlocks(life: LifeState, ids: string[]): Unlock[] {
  const have = unlocksOf(life);
  const added: Unlock[] = [];
  for (const id of ids) {
    const u = UNLOCK_BY_ID.get(id);
    if (!u || have.has(id)) continue;
    have.add(id);
    added.push(u);
  }
  if (added.length) life.ul = [...(life.ul ? life.ul.split(" ") : []), ...added.map((u) => u.code)].join(" ");
  return added;
}

/** What each item is called on the ending card ([name, line]). Every item in unlocks.ts has one; only
 *  the ball bag names a slot ({kitman}), so only a story that casts the kit man may give it. */
export const ITEM_WORDS: Record<string, [string, string]> = {
  "item:dens-ball-bag": ["{kitman.short}'s ball bag", "\"{kitman.short}'s hundred\" is now a drill in your own garden."],
  "item-dens-ball-bag": ["{kitman.short}'s ball bag", "\"{kitman.short}'s hundred\" is now a drill in your own garden."],
  "item-legends-boots": ["His old boots", "They go in a case in your house, laces done up the way he left them."],
  "item-grandads-medal": ["Your grandad's medal", "The old county medal, on your mantel at last."],
  "item-old-scarf": ["The old scarf", "The 1971 scarf, framed and on your wall."],
  "item-match-ball": ["The match ball", "Signed by the lads, and it is yours."],
  "item-stopped-watch": ["The stopped watch", "His pocket watch, stopped at the minute of his first goal. You can wear it."],
  "item-framed-shirt": ["A framed shirt", "A shirt in a frame, for the wall at home."],
  "item-clay-print": ["The clay print", "A cast of your boot print from the old boot room."],
};

/** The ids an outcome's `unlock` / `give` names ("a+b" is two). */
export const unlockParts = (s: string | undefined): string[] => (s ?? "").split("+").map((x) => x.trim()).filter(Boolean);

// ── The 26 clubs with their own hooks (plan part 3) ──

/** A club's slug: its name from lib/star/clubs.ts, lower case, accents and "&" dropped, spaces as
 *  dashes ("Brighton & Hove Albion" → "brighton-hove-albion", "FC Bayern München" → "fc-bayern-munchen"). */
export function clubSlug(name: string): string {
  return name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/&/g, " ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/** The 20 English and 6 European clubs with an invented legend, a place, a tradition and a rivalry
 *  moment (plan part 3). `clubTop26` is true at one of them. The European six cannot be joined
 *  (moves abroad are not built): their stories fire on European nights (`europe && opponent:<slug>`). */
export const TOP26_ENGLISH = [
  "manchester-united", "liverpool", "arsenal", "chelsea", "manchester-city", "tottenham-hotspur", "newcastle-united",
  "everton", "aston-villa", "west-ham-united", "leeds-united", "nottingham-forest", "sunderland", "wolverhampton-wanderers",
  "leicester-city", "crystal-palace", "southampton", "derby-county", "middlesbrough", "brighton-hove-albion",
] as const;
export const TOP26_EUROPEAN = ["real-madrid", "fc-barcelona", "fc-bayern-munchen", "juventus", "ac-milan", "paris-saint-germain"] as const;
export const TOP26: readonly string[] = [...TOP26_ENGLISH, ...TOP26_EUROPEAN];

/** Every club slug in lib/star/clubs.ts (the checker fails club:/everClub:/opponent:/wonAt with any other). */
export const ALL_CLUB_SLUGS: ReadonlySet<string> = new Set(
  Object.values(CLUBS).flatMap((v) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").map(clubSlug) : [])),
);
