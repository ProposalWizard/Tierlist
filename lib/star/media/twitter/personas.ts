/**
 * FOOTBALL TWITTER: THE CAST (Leo, 31 Oct 2026, switch part "footballTwitter").
 *
 * Leo: "do like research on football twitter/x and try make a good realistic
 * algorithm and accounts and posts and words and stuff … obvs all fake
 * versions of those not real account copies".
 *
 * Every account here is an invented ARCHETYPE: the transfer insider, the
 * shouting fan channel, the ratio page, the TV channel's breaking-news desk,
 * the live-scores app, the xG nerd, the tier-5 ITK, the quiz page, the meme
 * page, the betting account, the journalist who quote-posts, the agent… None
 * is a real person, outlet or brand, and none is a misspelling of one. Clubs
 * are the game's own clubs. Research: docs/handoffs/2026-10-31-leo/football-twitter/RESEARCH.md.
 *
 * They join the roster through accounts.ts `buildRoster` (only with the switch
 * on), as ordinary MediaAccounts with a `persona`. A persona account writes
 * from its own phrase bank (templates/twitter.ts) and, when `share` < 1, from
 * its archetype's normal lines the rest of the time.
 */
import type { Archetype, AvatarGlyph, FootballEvent, MediaAccount, Platform, Tag, VoiceProfile } from "../types";
import { initialsOf } from "../grammar";

export type Tick = "blue" | "gold" | "grey";

export interface Persona {
  /** Matches `Template.persona` in templates/twitter.ts. */
  id: string;
  /** What kind of account it is, in plain words (the admin page shows it). */
  label: string;
  handle: string;
  name: string;
  archetype: Archetype;
  platform?: Platform;
  followers: number;
  tick?: Tick;
  glyph: AvatarGlyph;
  tint: string;
  tint2: string;
  voice: VoiceProfile;
  /** Its own emoji habit, added at the end now and then. */
  emoji: string[];
  interests: Partial<Record<Tag, number>>;
  /** How often it posts: 1 = an ordinary account, 2 = twice as keen. */
  rate: number;
  /** Who it shows up for: a hater after your bad days, a hype page after good ones. */
  mood?: "hater" | "hype";
  /** Chance it uses its own lines (the rest: its archetype's). Absent = always its own. */
  share?: number;
  /** "yours": a supporter of your club. "rival": a supporter of your derby rival. */
  side?: "yours" | "rival";
  /** "yours": mostly about your club (others' games only now and then). */
  focus?: "yours";
  /** Its catchphrases ({catch} in its lines). */
  catchphrases: string[];
  /** A TikTok account's sounds, shown under its video ("♫ …"). */
  sounds?: string[];
}

const V = (p: Partial<VoiceProfile>): VoiceProfile => ({
  register: "casual", lowercase: 0, caps: 0.2, emoji: 0.4, hashtags: 0, length: "short",
  punctuation: "loose", exclaim: 0.1, firstPerson: false, ...p,
});

/**
 * The national cast. ~30 accounts; each line is one account.
 * Followers are set so reach behaves: the TV desk and the insider are huge,
 * the kid's account and the groundhopper are tiny.
 */
export const PERSONAS: Persona[] = [
  // ── News and transfers ─────────────────────────────────────────────────
  {
    id: "insider", label: "Transfer insider (the 'deal sealed' man)", handle: "@DiegoFerranteHQ", name: "Diego Ferrante", archetype: "insider",
    followers: 6_400_000, tick: "blue", glyph: "scoop", tint: "#1d4ed8", tint2: "#60a5fa",
    voice: V({ register: "neutral", emoji: 0.2, exclaim: 0 }), emoji: ["🔒", "✍️", "🤝", "🔴"],
    interests: { transfer: 1, rumour: 1, contract: 1, manager: 0.9, award: 0.4 }, rate: 1.6,
    catchphrases: ["SEALED AND STAMPED ✍️🔒", "Stamp it 🔒", "Ink is drying ✍️", "Signed, sealed, sorted 🔒"],
  },
  {
    id: "breaking", label: "TV sports channel (breaking news desk)", handle: "@SportsDeskTV", name: "SportsDesk", archetype: "aggregator",
    followers: 8_900_000, tick: "gold", glyph: "megaphone", tint: "#b91c1c", tint2: "#1e3a8a",
    voice: V({ register: "neutral", caps: 0.1, emoji: 0.1, punctuation: "clean" }), emoji: ["🚨", "⚽️"],
    interests: { transfer: 0.9, manager: 1, trophy: 1, title: 1, relegation: 0.9, drama: 0.8, goal: 0.6, record: 0.8, award: 0.8, table: 0.5 }, rate: 1.3,
    catchphrases: ["BREAKING", "🚨 BREAKING", "More to follow"],
  },
  {
    id: "scores", label: "Live-scores app (score cards)", handle: "@ScoreBuzzApp", name: "ScoreBuzz", archetype: "aggregator",
    followers: 3_300_000, tick: "gold", glyph: "grid", tint: "#f97316", tint2: "#111827",
    voice: V({ register: "neutral", caps: 0, emoji: 0, punctuation: "clean" }), emoji: ["⚽️", "⏱️"],
    interests: { table: 1, goal: 0.9, drama: 0.8, derby: 0.8, cup: 0.9, europe: 0.9, title: 0.9 }, rate: 1.7,
    catchphrases: ["FT", "GOAL", "HT"],
  },
  {
    id: "aggregator", label: "Copy-paste news page", handle: "@TransferSZN_", name: "Transfer SZN", archetype: "aggregator",
    followers: 1_300_000, tick: "blue", glyph: "play", tint: "#16a34a", tint2: "#052e16",
    voice: V({ caps: 0.3, emoji: 0.5 }), emoji: ["🚨", "👀", "💰", "🔥"],
    interests: { transfer: 1, rumour: 1, contract: 0.8, goal: 0.5, drama: 0.6, award: 0.6 }, rate: 1.4,
    catchphrases: ["🚨🚨🚨", "Huge.", "This is massive.", "Wow."],
  },
  {
    id: "journalist", label: "Journalist who quote-posts", handle: "@TomBarrowcliffe", name: "Tom Barrowcliffe", archetype: "broadsheet",
    followers: 410_000, tick: "blue", glyph: "quote", tint: "#334155", tint2: "#94a3b8",
    voice: V({ register: "formal", emoji: 0, caps: 0, punctuation: "clean" }), emoji: [],
    interests: { manager: 1, transfer: 0.8, title: 0.9, relegation: 0.9, opinion: 1, drama: 0.7, form: 0.6, table: 0.6 }, rate: 0.9,
    catchphrases: ["Worth saying:", "For what it's worth,", "Understand", "Told you in August."],
  },
  {
    id: "itk", label: "Tier-5 'ITK' fake-news account", handle: "@InsideTheBootRoom_", name: "ITK | Inside The Boot Room", archetype: "insider",
    followers: 160_000, tick: "blue", glyph: "scoop", tint: "#7c3aed", tint2: "#f472b6",
    voice: V({ caps: 0.4, emoji: 0.6, exclaim: 0.2 }), emoji: ["🤫", "👀", "🔜", "🧐"],
    interests: { transfer: 1, rumour: 1, manager: 0.9, contract: 0.8, goal: 0.3, drama: 0.4 }, rate: 1.3,
    catchphrases: ["Trust the process 🤫", "You heard it here first.", "Source is solid.", "Can't say more yet 🤐"],
  },
  {
    id: "agent", label: "The agent", handle: "@RoccaManagement", name: "Vincenzo Rocca", archetype: "insider",
    followers: 95_000, tick: "blue", glyph: "quote", tint: "#0f172a", tint2: "#d4af37",
    voice: V({ register: "formal", caps: 0, emoji: 0.3, punctuation: "clean" }), emoji: ["🤝", "📝", "🙏"],
    interests: { transfer: 1, contract: 1, award: 0.6, rumour: 0.5 }, rate: 0.8,
    catchphrases: ["Respect my client.", "We let the football talk.", "Business is business.", "Family first. Then football."],
  },
  {
    id: "gossip", label: "Off-the-pitch gossip page", handle: "@PitchsideGossip", name: "Pitchside Gossip", archetype: "tabloid",
    followers: 340_000, tick: "blue", glyph: "megaphone", tint: "#db2777", tint2: "#fbcfe8",
    voice: V({ register: "raw", caps: 0.3, emoji: 0.8 }), emoji: ["👀", "💅", "🍿", "😳"],
    interests: { shame: 0.9, drama: 1, transfer: 0.8, award: 0.6, contract: 0.6 }, rate: 0.8,
    catchphrases: ["the tea is HOT 🍿", "we're not saying anything… 👀", "spotted 👀"],
  },

  // ── Fans and banter ────────────────────────────────────────────────────
  {
    id: "ranter", label: "Shouty fan-channel ranter", handle: "@BigDaveUnleashed", name: "Big Dave Unleashed", archetype: "pundit", platform: "youtube",
    followers: 1_200_000, tick: "blue", glyph: "mic", tint: "#dc2626", tint2: "#fde047",
    voice: V({ register: "raw", caps: 0.7, emoji: 0.4, exclaim: 0.6 }), emoji: ["😤", "🤬", "🔴", "🗣️"],
    interests: { drama: 1, shame: 1, manager: 1, derby: 0.9, title: 0.8, opinion: 1, goal: 0.5 }, rate: 1.4, focus: "yours",
    catchphrases: ["I'M NOT HAVING IT", "WAKE UP", "BOTTLE JOB", "absolute SHAMBLES", "I SAID IT FIRST"],
  },
  {
    id: "ratio", label: "Hater / ratio banter page", handle: "@RatioFC_", name: "Ratio FC", archetype: "meme",
    followers: 2_600_000, tick: "blue", glyph: "grin", tint: "#111827", tint2: "#ef4444",
    voice: V({ register: "raw", lowercase: 0.5, caps: 0.3, emoji: 0.8 }), emoji: ["😭", "🤣", "💀", "🫵", "🗑️"],
    interests: { shame: 1, drama: 1, derby: 0.8, relegation: 1, manager: 0.8, opinion: 0.7, goal: 0.3 }, rate: 1.5, mood: "hater",
    catchphrases: ["ratio", "hold this L", "the disrespect 😭", "cooked", "fraud watch 🚨"],
  },
  {
    id: "meme", label: "Meme page", handle: "@FootyMemeLab", name: "Footy Meme Lab", archetype: "meme",
    followers: 3_500_000, tick: "blue", glyph: "grin", tint: "#facc15", tint2: "#7c2d12",
    voice: V({ register: "casual", lowercase: 0.4, emoji: 0.7 }), emoji: ["😭", "💀", "🤣", "😂"],
    interests: { drama: 1, shame: 0.9, goal: 0.8, derby: 0.8, manager: 0.7, opinion: 0.6, record: 0.5 }, rate: 1.4,
    catchphrases: ["absolute cinema", "not him 😭", "the timeline is in shambles", "this sport man"],
  },
  {
    id: "quiz", label: "'Ball knowledge' quiz page", handle: "@BallKnowledgeHQ", name: "Ball Knowledge HQ", archetype: "meme",
    followers: 1_700_000, tick: "blue", glyph: "ball", tint: "#0ea5e9", tint2: "#1e1b4b",
    voice: V({ register: "casual", emoji: 0.6 }), emoji: ["🧠", "🤔", "👇", "⚽️"],
    interests: { goal: 0.8, record: 1, milestone: 0.9, stat: 0.7, award: 0.7, title: 0.6, derby: 0.5 }, rate: 1.2, mood: "hype",
    catchphrases: ["ball knowledge check 🧠", "only real ones know", "quote with your answer 👇"],
  },
  {
    id: "hype", label: "Hype / 'he's HIM' page", handle: "@HesHimFC", name: "He's HIM", archetype: "meme", platform: "x",
    followers: 880_000, tick: "blue", glyph: "boot", tint: "#a855f7", tint2: "#f97316",
    voice: V({ register: "raw", caps: 0.6, emoji: 0.8, exclaim: 0.3 }), emoji: ["🐐", "🔥", "😮‍💨", "🥶", "👑"],
    interests: { goal: 1, record: 1, milestone: 0.9, award: 1, form: 0.9, streak: 0.8, trophy: 0.9 }, rate: 1.4, mood: "hype",
    catchphrases: ["he's HIM", "different breed", "levels 🥶", "not human 👽"],
  },
  {
    id: "edits", label: "Video edits page (TikTok)", handle: "@edits.by.kai", name: "kai edits", archetype: "meme", platform: "tiktok",
    followers: 640_000, glyph: "play", tint: "#ec4899", tint2: "#22d3ee",
    voice: V({ register: "casual", lowercase: 0.9, emoji: 0.9 }), emoji: ["🎧", "🔥", "🥶", "📈"],
    interests: { goal: 1, record: 0.7, trophy: 0.7, award: 0.6 }, rate: 1.1, mood: "hype",
    catchphrases: ["he's different 🥶", "aura", "no way he did this 😭", "i could watch this all day"],
    sounds: ["original sound – kai edits", "phonk drift (slowed) – nightdrive", "violin build – edit audio", "crowd chant remix (sped up) – kai edits"],
  },
  {
    id: "clips", label: "Goal clips account", handle: "@ClippedFC", name: "Clipped FC", archetype: "aggregator", platform: "x",
    followers: 2_100_000, tick: "blue", glyph: "play", tint: "#0891b2", tint2: "#164e63",
    voice: V({ caps: 0.2, emoji: 0.5 }), emoji: ["🎥", "🤯", "🚀"],
    interests: { goal: 1, drama: 0.8, derby: 0.6 }, rate: 1.2,
    catchphrases: ["WHAT A GOAL", "the finish 🤯", "unreal"],
  },
  {
    id: "fanTV", label: "Your club's fan channel", handle: "@{CLUB}FanTV", name: "{CLUB} Fan TV", archetype: "fan", platform: "youtube",
    followers: 420_000, tick: "blue", glyph: "mic", tint: "#be123c", tint2: "#fda4af",
    voice: V({ register: "raw", caps: 0.6, emoji: 0.5, exclaim: 0.5 }), emoji: ["📣", "😤", "🔥", "🙌"],
    interests: { goal: 1, drama: 1, derby: 1, shame: 1, manager: 1, transfer: 0.8, table: 0.8, title: 0.9 }, rate: 1.3, side: "yours",
    catchphrases: ["we go again", "the fans have spoken", "up the lads"],
  },
  {
    id: "womenFan", label: "Woman fan / away days", handle: "@AwayEndAnna", name: "Anna | Away End", archetype: "fan",
    followers: 9_400, glyph: "scarf", tint: "#14b8a6", tint2: "#f0abfc",
    voice: V({ register: "casual", lowercase: 0.7, emoji: 0.5, punctuation: "none" }), emoji: ["🧣", "🚆", "🙌", "💙"],
    interests: { goal: 1, derby: 1, drama: 0.9, table: 0.8, shame: 0.7, trophy: 1, debut: 0.7 }, rate: 1.1, side: "yours",
    catchphrases: ["4 hours on a train for this", "never missed an away day", "the away end was BOUNCING"],
  },
  {
    id: "readsGame", label: "Woman analyst fan ('she reads the game')", handle: "@SheReadsTheGame", name: "Priya | Reads The Game", archetype: "pundit",
    followers: 62_000, tick: "blue", glyph: "chart", tint: "#6366f1", tint2: "#f9a8d4",
    voice: V({ register: "neutral", emoji: 0.2, punctuation: "clean" }), emoji: ["📊", "🧠"],
    interests: { opinion: 1, form: 0.9, stat: 0.8, goal: 0.6, manager: 0.8, table: 0.6 }, rate: 0.9,
    catchphrases: ["watch it back.", "nobody's talking about this:", "I said what I said."],
  },
  {
    id: "kidFan", label: "Young fan (kid's account)", handle: "@JJ_FootyMad", name: "JJ ⚽ (U12s)", archetype: "fan",
    followers: 1_300, glyph: "ball", tint: "#22c55e", tint2: "#bbf7d0",
    voice: V({ register: "casual", lowercase: 0.3, caps: 0.5, emoji: 1, exclaim: 0.8, punctuation: "loose" }), emoji: ["⚽️", "😁", "🤩", "🙌"],
    interests: { goal: 1, trophy: 1, debut: 0.8, award: 0.8, derby: 0.6, milestone: 0.7 }, rate: 0.8, side: "yours", mood: "hype",
    catchphrases: ["BEST PLAYER EVER", "my dad says", "im getting his shirt for christmas"],
  },
  {
    id: "rivalBanter", label: "Rival fan banter account", handle: "@{RIVAL}Banter", name: "{RIVAL} Banter", archetype: "rivalFan",
    followers: 31_000, glyph: "drum", tint: "#9333ea", tint2: "#e9d5ff",
    voice: V({ register: "raw", lowercase: 0.8, emoji: 0.7, punctuation: "none" }), emoji: ["😂", "🤡", "😭", "🫵"],
    interests: { shame: 1, drama: 0.9, derby: 1, relegation: 1, table: 0.5, title: 0.6 }, rate: 1.6, side: "rival", mood: "hater",
    catchphrases: ["that lot", "same old", "stay humble lads", "rent free"],
  },
  {
    id: "neutral", label: "Neutral 'here for the chaos' fan", handle: "@NeutralNige", name: "Nige (neutral)", archetype: "fan",
    followers: 22_000, glyph: "flag", tint: "#64748b", tint2: "#fde68a",
    voice: V({ register: "casual", lowercase: 0.8, emoji: 0.6, punctuation: "none" }), emoji: ["🍿", "😂", "🙃"],
    interests: { drama: 1, shame: 0.8, derby: 0.8, relegation: 0.8, title: 0.8, goal: 0.4 }, rate: 1,
    catchphrases: ["no dog in this fight", "just here for the chaos 🍿", "football is back"],
  },
  {
    id: "groundhopper", label: "Lower-league groundhopper", handle: "@GroundhopperGav", name: "Gav | 412 grounds", archetype: "fan",
    followers: 7_800, glyph: "flag", tint: "#65a30d", tint2: "#fef08a",
    voice: V({ register: "casual", lowercase: 0.2, emoji: 0.4, punctuation: "loose" }), emoji: ["🥧", "🍺", "🏟️", "☕"],
    interests: { goal: 0.6, drama: 0.8, cup: 1, table: 0.6, derby: 0.8 }, rate: 0.7,
    catchphrases: ["pie rating: 8/10", "ground number 413", "proper football"],
  },

  // ── Numbers, takes and talk ────────────────────────────────────────────
  {
    id: "xg", label: "Stats / xG nerd", handle: "@xGWhisperer", name: "xG Whisperer", archetype: "stats",
    followers: 230_000, tick: "blue", glyph: "chart", tint: "#0d9488", tint2: "#99f6e4",
    voice: V({ register: "neutral", emoji: 0.2, punctuation: "clean" }), emoji: ["📈", "📊", "🤓"],
    interests: { stat: 1, goal: 0.9, form: 1, streak: 0.8, record: 0.8, keeper: 0.7, table: 0.6 }, rate: 1.2,
    catchphrases: ["the underlying numbers", "regression is coming", "xG doesn't lie (it does)"],
  },
  {
    id: "facts", label: "Football facts / 'just a reminder' account", handle: "@FootyFactsDaily", name: "Footy Facts Daily", archetype: "stats",
    followers: 1_100_000, tick: "blue", glyph: "grid", tint: "#2563eb", tint2: "#bfdbfe",
    voice: V({ register: "neutral", emoji: 0.5, punctuation: "clean" }), emoji: ["📅", "🤯", "📈"],
    interests: { record: 1, milestone: 1, stat: 0.9, streak: 0.9, goal: 0.6 }, rate: 1.1,
    catchphrases: ["Just a reminder that", "Fact:", "On this day"],
  },
  {
    id: "fantasy", label: "Fantasy football manager account", handle: "@FantasyGaffer", name: "The Fantasy Gaffer", archetype: "stats",
    followers: 560_000, tick: "blue", glyph: "shirt", tint: "#16a34a", tint2: "#a7f3d0",
    voice: V({ register: "casual", emoji: 0.6 }), emoji: ["📈", "🟢", "©️", "💸"],
    interests: { goal: 1, assist: 0.9, form: 1, streak: 0.8, keeper: 0.6 }, rate: 1.1,
    catchphrases: ["captaincy pick", "differential alert", "price rise incoming 📈"],
  },
  {
    id: "takes", label: "'Unpopular opinion' hot-take account", handle: "@HotTakeHarry_", name: "Hot Take Hal", archetype: "pundit",
    followers: 480_000, tick: "blue", glyph: "quote", tint: "#ea580c", tint2: "#fed7aa",
    voice: V({ register: "casual", emoji: 0.3, punctuation: "loose" }), emoji: ["🌶️", "🤷‍♂️", "🔥"],
    interests: { opinion: 1, shame: 0.8, form: 0.8, goal: 0.6, manager: 0.8, award: 0.7, title: 0.6 }, rate: 1.2,
    catchphrases: ["Unpopular opinion:", "Hot take:", "Say it with your chest:"],
  },
  {
    id: "tactics", label: "Tactics thread account", handle: "@InvertedFullback", name: "The Inverted Full-Back", archetype: "pundit",
    followers: 170_000, tick: "blue", glyph: "grid", tint: "#1e40af", tint2: "#a5b4fc",
    voice: V({ register: "neutral", emoji: 0.2, punctuation: "clean" }), emoji: ["🧵", "📐"],
    interests: { opinion: 0.9, form: 0.8, manager: 0.9, goal: 0.5, stat: 0.6, table: 0.5 }, rate: 0.8,
    catchphrases: ["🧵 Thread:", "Watch the movement here.", "Half-spaces, people."],
  },
  {
    id: "expro", label: "Grumpy ex-pro", handle: "@RayHollinsworth", name: "Ray Hollinsworth", archetype: "pundit",
    followers: 720_000, tick: "blue", glyph: "mic", tint: "#78350f", tint2: "#fcd34d",
    voice: V({ register: "casual", emoji: 0.05, punctuation: "clean" }), emoji: [],
    interests: { opinion: 1, shame: 0.9, manager: 0.9, form: 0.7, goal: 0.4, drama: 0.6 }, rate: 0.9,
    catchphrases: ["In my day", "Simple as that.", "Not good enough.", "Basics."],
  },
  {
    id: "ref", label: "Referee / VAR moaning account", handle: "@VARWatchUK", name: "VAR Watch", archetype: "aggregator",
    followers: 260_000, tick: "blue", glyph: "flag", tint: "#facc15", tint2: "#111827",
    voice: V({ register: "casual", emoji: 0.5 }), emoji: ["🟨", "🧐", "🟥"],
    interests: { drama: 1, derby: 0.8, shame: 0.6 }, rate: 0.8,
    catchphrases: ["Check complete.", "Clear and obvious?", "Lines drawn by a toddler"],
  },
  {
    id: "pod", label: "Football podcast", handle: "@TwoLadsOneBallPod", name: "Two Lads, One Ball 🎙️", archetype: "pundit", platform: "youtube",
    followers: 145_000, tick: "blue", glyph: "mic", tint: "#0f766e", tint2: "#fde68a",
    voice: V({ register: "casual", emoji: 0.6 }), emoji: ["🎙️", "🎧", "📲"],
    interests: { opinion: 0.9, goal: 0.6, drama: 0.8, title: 0.8, manager: 0.8, transfer: 0.7 }, rate: 0.7,
    catchphrases: ["NEW EP OUT NOW", "link in bio 🎧", "we argued for 40 minutes"],
  },
  {
    id: "nostalgia", label: "Nostalgia / 'this aged well' page", handle: "@FootyNostalgia", name: "Footy Nostalgia", archetype: "meme",
    followers: 950_000, tick: "blue", glyph: "flag", tint: "#a16207", tint2: "#fef3c7",
    voice: V({ register: "casual", emoji: 0.5 }), emoji: ["📼", "🥲", "🕰️"],
    interests: { milestone: 1, record: 0.9, debut: 0.9, goal: 0.4, trophy: 0.8 }, rate: 0.8,
    catchphrases: ["where were you when", "this aged well", "simpler times"],
  },
  {
    id: "wonderkid", label: "Wonderkid scout account", handle: "@WonderkidRadar", name: "Wonderkid Radar", archetype: "stats",
    followers: 310_000, tick: "blue", glyph: "chart", tint: "#65a30d", tint2: "#d9f99d",
    voice: V({ register: "neutral", emoji: 0.6 }), emoji: ["💎", "📡", "🌟"],
    interests: { debut: 1, rumour: 0.9, milestone: 0.7, goal: 0.6, form: 0.6 }, rate: 0.9,
    catchphrases: ["remember the name", "💎 alert", "generational"],
  },
  {
    id: "odds", label: "Betting odds account (18+)", handle: "@PricedUpOdds", name: "PricedUp", archetype: "aggregator",
    followers: 430_000, tick: "gold", glyph: "chart", tint: "#15803d", tint2: "#fef08a",
    voice: V({ register: "neutral", emoji: 0.4, punctuation: "clean" }), emoji: ["📉", "📈", "💰"],
    interests: { title: 1, relegation: 1, transfer: 0.9, manager: 1, award: 0.9, goal: 0.6, table: 0.7 }, rate: 0.9,
    catchphrases: ["Odds slashed", "Price check", "18+ | Play it safe"],
  },

  // ══ v2 (Leo, 31 Oct 2026: "MORE FOOTBALL TWITTER AND TIKTOKS") ══════════
  // ── TikTok ─────────────────────────────────────────────────────────────
  {
    id: "pov", label: "TikTok 'POV' page", handle: "@pov.matchday", name: "pov: matchday", archetype: "meme", platform: "tiktok",
    followers: 1_900_000, tick: "blue", glyph: "play", tint: "#0f172a", tint2: "#f43f5e",
    voice: V({ register: "casual", lowercase: 0.95, caps: 0, emoji: 0.8, punctuation: "none" }), emoji: ["😭", "🥶", "😮‍💨", "🫨"],
    interests: { goal: 1, drama: 0.8, derby: 0.7, record: 0.6, trophy: 0.6 }, rate: 1.3, mood: "hype",
    catchphrases: ["the replay value is insane", "he's different 🥶", "i could watch this all day"],
    sounds: ["original sound – pov: matchday", "stadium goes silent (slowed) – crowdcore", "heartbeat build – matchday audio", "the commentator scream – pov sounds"],
  },
  {
    id: "ranker", label: "TikTok goal ranker ('rate this goal 1-10')", handle: "@goals.ranked", name: "Goals Ranked 🔢", archetype: "meme", platform: "tiktok",
    followers: 870_000, tick: "blue", glyph: "grid", tint: "#7c3aed", tint2: "#fde047",
    voice: V({ register: "casual", lowercase: 0.8, caps: 0.1, emoji: 0.7, punctuation: "loose" }), emoji: ["🔢", "🤔", "🔥", "📈"],
    interests: { goal: 1, record: 0.8, award: 0.6 }, rate: 1.1, mood: "hype",
    catchphrases: ["comment your rating 👇", "be honest", "top 3 of the season?"],
    sounds: ["original sound – Goals Ranked", "ranking beat (sped up) – rankcore", "tick tock countdown – ranked audio"],
  },
  {
    id: "streamer", label: "Reaction streamer (tweets after his stream)", handle: "@RicoReacts", name: "Rico 🎮⚽", archetype: "fan",
    followers: 940_000, tick: "blue", glyph: "mic", tint: "#9333ea", tint2: "#22d3ee",
    voice: V({ register: "raw", lowercase: 0.5, caps: 0.5, emoji: 0.8, exclaim: 0.5, punctuation: "loose" }), emoji: ["😭", "🗣️", "💀", "🔥"],
    interests: { goal: 1, drama: 1, derby: 0.8, shame: 0.7, trophy: 0.8 }, rate: 1.1,
    catchphrases: ["chat was NOT ready", "my neighbours hate me", "i'm not okay"],
  },
  // ── Numbers and lists ─────────────────────────────────────────────────
  {
    id: "rater", label: "'Rating every player' account", handle: "@RatingsAfterFT", name: "Ratings After FT", archetype: "stats",
    followers: 210_000, tick: "blue", glyph: "grid", tint: "#0369a1", tint2: "#bae6fd",
    voice: V({ register: "casual", emoji: 0.3, punctuation: "clean" }), emoji: ["📝", "⭐"],
    interests: { goal: 0.9, form: 0.9, stat: 0.9, shame: 0.7, table: 0.6 }, rate: 1, focus: "yours",
    catchphrases: ["agree or disagree?", "harsh but fair", "come at me"],
  },
  {
    id: "priceBot", label: "Fantasy price-change bot", handle: "@FantasyPriceBot", name: "Price Change Bot 🤖", archetype: "stats",
    followers: 330_000, tick: "blue", glyph: "chart", tint: "#15803d", tint2: "#86efac",
    voice: V({ register: "neutral", caps: 0, emoji: 0.2, punctuation: "clean" }), emoji: ["📈", "📉", "🤖"],
    interests: { goal: 0.9, form: 1, streak: 0.8, shame: 0.5, assist: 0.7 }, rate: 0.9,
    catchphrases: ["Transfers in overnight", "Target reached", "Next rise: tonight"],
  },
  {
    id: "history", label: "'This day in history' page", handle: "@FootyThisDay", name: "Football This Day", archetype: "stats",
    followers: 540_000, tick: "blue", glyph: "flag", tint: "#92400e", tint2: "#fde68a",
    voice: V({ register: "neutral", emoji: 0.4, punctuation: "clean" }), emoji: ["🗓️", "📜", "🕰️"],
    interests: { record: 1, milestone: 1, trophy: 0.9, derby: 0.7, goal: 0.4 }, rate: 0.7,
    catchphrases: ["Then and now.", "History made.", "One for the books."],
  },
  // ── Talk ──────────────────────────────────────────────────────────────
  {
    id: "commsQuotes", label: "Commentator-quotes page", handle: "@CommsBoxCalls", name: "Comms Box Calls 🎙️", archetype: "meme",
    followers: 680_000, tick: "blue", glyph: "mic", tint: "#1f2937", tint2: "#fbbf24",
    voice: V({ register: "casual", caps: 0.2, emoji: 0.3, punctuation: "loose" }), emoji: ["🎙️", "🗣️"],
    interests: { goal: 1, drama: 1, derby: 0.9, trophy: 0.9, record: 0.6 }, rate: 1,
    catchphrases: ["the call of the season?", "goosebumps", "commentary of the year"],
  },
  {
    id: "exproPundit", label: "Ex-player turned TV pundit (catchphrases)", handle: "@TelVanceTalks", name: "Tel Vance", archetype: "pundit",
    followers: 1_050_000, tick: "blue", glyph: "mic", tint: "#7f1d1d", tint2: "#fecaca",
    voice: V({ register: "casual", caps: 0.15, emoji: 0.1, punctuation: "clean" }), emoji: ["👏"],
    interests: { opinion: 1, goal: 0.8, form: 0.8, manager: 0.8, title: 0.8, shame: 0.7 }, rate: 1,
    catchphrases: ["You can't coach that.", "Proper centre-forward play, that.", "Ask the questions, lads.", "Different level, that."],
  },
  {
    id: "commentBot", label: "'Comment section' account (quotes the replies)", handle: "@TheCommentsFC", name: "The Comments Section", archetype: "meme",
    followers: 760_000, tick: "blue", glyph: "quote", tint: "#334155", tint2: "#f472b6",
    voice: V({ register: "casual", lowercase: 0.4, emoji: 0.6 }), emoji: ["💬", "😭", "💀"],
    interests: { drama: 1, shame: 0.9, goal: 0.8, derby: 0.8, manager: 0.7 }, rate: 1,
    catchphrases: ["the comments never miss", "top comment:", "the replies are undefeated"],
  },
  // ── Matchday ──────────────────────────────────────────────────────────
  {
    id: "matchday", label: "'Football is back' hype page", handle: "@MatchdayFeeling", name: "Matchday Feeling", archetype: "meme",
    followers: 1_400_000, tick: "blue", glyph: "ball", tint: "#16a34a", tint2: "#fef08a",
    voice: V({ register: "casual", caps: 0.3, emoji: 0.8, exclaim: 0.3 }), emoji: ["⚽️", "🙌", "🔥", "🏟️"],
    interests: { derby: 1, drama: 0.9, title: 0.9, cup: 0.9, europe: 0.8, goal: 0.6, trophy: 0.8 }, rate: 1,
    catchphrases: ["football is BACK", "this is why we love it", "nothing like it"],
  },
  {
    id: "kitLeaks", label: "Kit-leaks page", handle: "@KitDropLeaks", name: "Kit Drop Leaks 👕", archetype: "aggregator",
    followers: 290_000, tick: "blue", glyph: "shirt", tint: "#be185d", tint2: "#fbcfe8",
    voice: V({ register: "casual", emoji: 0.6 }), emoji: ["👕", "👀", "🔥"],
    interests: { trophy: 0.6, title: 0.5, transfer: 0.7, goal: 0.3, table: 0.4, derby: 0.4 }, rate: 0.6,
    catchphrases: ["leaked 👀", "thoughts?", "rate it /10"],
  },
  {
    id: "atmosphere", label: "Stadium / atmosphere page", handle: "@TerraceNoiseUK", name: "Terrace Noise", archetype: "fan",
    followers: 310_000, tick: "blue", glyph: "drum", tint: "#b45309", tint2: "#fed7aa",
    voice: V({ register: "casual", caps: 0.3, emoji: 0.6 }), emoji: ["🏟️", "🔊", "🥁", "🧣"],
    interests: { derby: 1, drama: 0.9, cup: 0.8, europe: 0.8, goal: 0.6, trophy: 0.9 }, rate: 0.9,
    catchphrases: ["the noise 🔊", "limbs everywhere", "proper atmosphere"],
  },
  {
    id: "sundayLeague", label: "Sunday-league comparisons page", handle: "@SundayLeagueTruths", name: "Sunday League Truths", archetype: "meme",
    followers: 1_100_000, tick: "blue", glyph: "flag", tint: "#4d7c0f", tint2: "#d9f99d",
    voice: V({ register: "casual", lowercase: 0.6, emoji: 0.7 }), emoji: ["🍺", "😭", "🥴", "⚽️"],
    interests: { goal: 0.9, shame: 0.9, drama: 0.8, keeper: 0.6 }, rate: 1.1,
    catchphrases: ["every sunday league team has one", "10am kick off energy", "hungover and still better"],
  },
  // ── Officials and money ──────────────────────────────────────────────
  {
    id: "refWatch", label: "Referee-watch page", handle: "@RefWatchDaily", name: "Ref Watch", archetype: "aggregator",
    followers: 175_000, tick: "blue", glyph: "flag", tint: "#000000", tint2: "#facc15",
    voice: V({ register: "neutral", emoji: 0.5, punctuation: "clean" }), emoji: ["🟨", "🟥", "🧑‍⚖️"],
    interests: { derby: 1, drama: 0.9, shame: 0.5, title: 0.5 }, rate: 0.8,
    catchphrases: ["Cards per game:", "Tough one to referee.", "Not his finest afternoon."],
  },
  {
    id: "ticketMoan", label: "Ticket-price moaner", handle: "@PricedOutFan", name: "Priced Out 🎟️", archetype: "fan",
    followers: 48_000, glyph: "scarf", tint: "#475569", tint2: "#fca5a5",
    voice: V({ register: "casual", lowercase: 0.5, emoji: 0.4, punctuation: "loose" }), emoji: ["🎟️", "💸", "🙃"],
    interests: { shame: 0.9, drama: 0.8, derby: 0.7, table: 0.6, trophy: 0.5, goal: 0.4 }, rate: 0.8, side: "yours",
    catchphrases: ["football without fans is nothing", "£4.50 for a cold pie", "and they wonder why"],
  },
  // ── Transfers, by how reliable ───────────────────────────────────────
  {
    id: "tier2", label: "Reliable tier-2 transfer journalist", handle: "@AlexHartleyNews", name: "Alex Hartley", archetype: "insider",
    followers: 520_000, tick: "blue", glyph: "scoop", tint: "#1e293b", tint2: "#7dd3fc",
    voice: V({ register: "formal", caps: 0, emoji: 0, punctuation: "clean" }), emoji: [],
    interests: { transfer: 1, contract: 1, manager: 1, rumour: 0.7, form: 0.3 }, rate: 1,
    catchphrases: ["Story confirmed.", "More to follow.", "Talks ongoing."],
  },
  {
    id: "rumourMill", label: "Tier-4 rumour aggregator", handle: "@RumourMillDaily", name: "Rumour Mill Daily", archetype: "aggregator",
    followers: 880_000, tick: "blue", glyph: "megaphone", tint: "#ca8a04", tint2: "#1c1917",
    voice: V({ register: "casual", caps: 0.4, emoji: 0.7 }), emoji: ["🗞️", "👀", "💰", "❓"],
    interests: { transfer: 1, rumour: 1, contract: 0.8, goal: 0.6, manager: 0.8, award: 0.5, form: 0.6 }, rate: 1.2,
    catchphrases: ["(per reports)", "according to a paper abroad", "make of it what you will"],
  },
  // ── Fans abroad (English words, foreign flavour) ─────────────────────
  {
    id: "spainFan", label: "Spanish-football fan account", handle: "@TikiTakaTomas", name: "Tomás | Tiki-Taka 🇪🇸", archetype: "fan",
    followers: 96_000, tick: "blue", glyph: "ball", tint: "#dc2626", tint2: "#facc15",
    voice: V({ register: "casual", caps: 0.2, emoji: 0.7, punctuation: "loose" }), emoji: ["🇪🇸", "🔥", "👌"],
    interests: { goal: 1, record: 0.7, transfer: 0.8, award: 0.8, europe: 1 }, rate: 0.9,
    catchphrases: ["qué golazo", "vamos", "olé olé", "un crack"],
  },
  {
    id: "italyFan", label: "Italian-football fan account", handle: "@CalcioCuore", name: "Calcio Cuore 🇮🇹", archetype: "fan",
    followers: 120_000, tick: "blue", glyph: "ball", tint: "#15803d", tint2: "#ef4444",
    voice: V({ register: "casual", caps: 0.2, emoji: 0.6, punctuation: "loose" }), emoji: ["🇮🇹", "🤌", "🔥"],
    interests: { goal: 0.9, keeper: 0.8, opinion: 0.7, europe: 1, transfer: 0.7, award: 0.7, shame: 0.4 }, rate: 0.9,
    catchphrases: ["mamma mia", "che giocatore", "forza", "bellissimo"],
  },
];

/** Every club account also gets the cheeky admin's lines, about a third of the time. */
export const CLUB_ADMIN = { id: "clubAdmin", label: "Club account (cheeky admin)", share: 0.3 } as const;

/** Persona ids whose posts are about YOUR club only (they support it, or its rival). */
export function personaById(id: string): Persona | undefined {
  return PERSONAS.find(p => p.id === id);
}

const squash = (x: string) => x.replace(/[^A-Za-z]/g, "");

/**
 * The persona accounts for this career: the national cast plus your club's
 * fan channel, your supporters, and a banter account for your derby rival.
 */
export function personaAccounts(yourClub: string, rival: string | undefined, clubShort: (c: string) => string): MediaAccount[] {
  const out: MediaAccount[] = [];
  for (const p of PERSONAS) {
    if (p.side === "rival" && (!rival || rival === yourClub)) continue;
    const short = clubShort(yourClub), rivalShort = rival ? clubShort(rival) : "";
    const handle = p.handle.replace("{CLUB}", squash(short)).replace("{RIVAL}", squash(rivalShort));
    const name = p.name.replace("{CLUB}", short).replace("{RIVAL}", rivalShort);
    out.push({
      id: `persona:${p.id}`,
      handle,
      name,
      archetype: p.archetype,
      platform: p.platform ?? "x",
      verified: !!p.tick,
      followers: p.followers,
      avatar: { initials: initialsOf(name), tint: p.tint, tint2: p.tint2, glyph: p.glyph },
      voice: p.voice,
      interests: p.interests,
      persona: p.id,
      personaLabel: p.label,
      ...(p.tick ? { tick: p.tick } : {}),
      ...(p.share !== undefined ? { personaShare: p.share } : {}),
      ...(p.side === "yours" ? { allegiance: { club: yourClub, polarity: 1 as const } } : {}),
      ...(p.side === "rival" && rival ? { allegiance: { club: rival, polarity: -1 as const } } : {}),
    });
  }
  return out;
}

/**
 * Accounts in the old cast whose names were too close to real people or
 * outlets. With the switch on they wear invented ones (the id, which seeds
 * their wording, stays).
 */
export const RENAMED: Record<string, { handle: string; name: string }> = {
  "@RomanoWatch": { handle: "@MarcoBellandi", name: "Marco Bellandi" },
  "@RoyKeanTakes": { handle: "@DeclanFureyTalks", name: "Declan Furey" },
  "@OptaLeague": { handle: "@NumbersFC", name: "Numbers FC" },
  "@SquawkaStyle": { handle: "@TheDataRoom", name: "The Data Room" },
  "@GaryOnTheBox": { handle: "@NeilBramwell", name: "Neil Bramwell" },
};

const NEGATIVE_IDS = new Set([
  "hammered", "collapse", "losing-run", "drought", "hooked", "anonymous", "knocked-out", "lost-top",
  "embarrassed", "into-the-drop", "out-of-form", "loss", "derby-loss", "poor-showing", "cheeky-miss",
  "relegated", "run-ended", "lost-the-final",
]);

/** Was this a bad day for the club / player it is about? */
export function isBadNews(e: FootballEvent): boolean {
  return NEGATIVE_IDS.has(e.id) || e.tags.includes("shame") || e.tags.includes("relegation");
}

/** Was this a good day (a goal, a win, a trophy, an award)? */
export function isGoodNews(e: FootballEvent): boolean {
  if (isBadNews(e)) return false;
  return e.tags.some(t => t === "goal" || t === "trophy" || t === "award" || t === "record" || t === "milestone")
    || ["win", "rout", "derby-win", "comeback", "went-top", "masterclass", "star-man", "winning-run"].includes(e.id);
}

/**
 * How keen a persona is on this event, on top of interest and reach.
 *
 * Haters pile on after YOUR bad days and mostly ignore the good ones; hype
 * pages are the other way round. Posts about you are the most-read thing in
 * your world, so every persona leans towards them a little.
 */
export function personaAppetite(a: MediaAccount, e: FootballEvent, yourClub: string): number {
  const p = a.persona ? personaById(a.persona) : undefined;
  if (!p) return 1;
  const aboutYourClub = (e.facts.club as string | undefined) === yourClub;
  const aboutYou = e.subject.kind === "you";
  let k = p.rate;
  if (p.mood === "hater") k *= aboutYourClub && isBadNews(e) ? 2.2 : isBadNews(e) ? 0.9 : aboutYourClub ? 0.25 : 0.4;
  if (p.mood === "hype") k *= isGoodNews(e) ? (aboutYou ? 2 : 1.2) : 0.15;
  if (aboutYou) k *= 1.3;
  if (p.focus === "yours" && !aboutYourClub) k *= 0.15;
  // The wider league is everyone's, but a page does not dunk on the same
  // kind of afternoon every single week.
  if (!aboutYourClub && (p.mood === "hater" || p.archetype === "meme")) k *= 0.5;
  return k;
}
