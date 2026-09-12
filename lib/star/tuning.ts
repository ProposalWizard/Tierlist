/**
 * THE TUNING REGISTRY.
 *
 * Requested directly: "an area where I can customize every single thing
 * that is done using numbers... without having to just keep asking you" —
 * prices, contract increments, sponsorship values, star/overall rating
 * increments, training gains, energy costs. This file is the list itself:
 * every number here has a real effect somewhere in the star career game,
 * named and described so the editor (components/star/TuningEditor.tsx, at
 * /star-tuning-dev) can show a real label instead of a bare key.
 *
 * Each entry's `default` is the exact value the game already shipped with
 * — nothing here changes any existing balance by itself. `lib/star/
 * tuningStore.ts` layers a localStorage override on top of a `default`;
 * `getTuning(key)` is override-or-default, and every file that used to
 * hardcode one of these numbers now reads it from there instead. Most
 * reads happen once, at module load, the same way the original hardcoded
 * `const` did — so an edit here takes effect the next time the app loads,
 * not instantly mid-session; the editor says as much.
 *
 * Deliberately NOT exhaustive. Left out: the per-drill timing/scoring
 * curves inside the training minigames themselves (components/star/
 * TrainingMinigame.tsx) and the deepest internal coefficients of the
 * transfer-matching algorithm (lib/star/leagueTransfers.ts's positionNeed/
 * squadSizeFactor/rivalrySellChance curves, and the small randomness
 * terms in its scoring formulas) — those are simulation feel-tuning, not
 * the kind of "price of an item" or "how much X costs" lever this was
 * actually asked for, and exposing every last one would make the editor
 * itself unusable. Everything that IS a genuine price, fee, increment, or
 * gain is here. More can be added the same way if something specific is
 * still missing.
 */

export interface TunableDef {
  key: string;
  category: string;
  label: string;
  description: string;
  default: number;
  min: number;
  max: number;
  step: number;
}

export const TUNABLES: TunableDef[] = [
  // ── Starting skills ──────────────────────────────────────────────────
  // What a brand-new career's five attributes start at (makeInitialCareer,
  // careerFlow.ts) — every one 0-100, the same range training caps them at
  // and every skill-reading formula in canvasEngine.ts/liveAttack.ts
  // (strength, curve, pull distance, etc.) assumes.
  {
    key: "startingSkills.pace", category: "Starting Skills", label: "Starting Pace",
    description: "How fast a brand-new career starts, 0-100.",
    default: 40, min: 0, max: 100, step: 1,
  },
  {
    key: "startingSkills.power", category: "Starting Skills", label: "Starting Power",
    description: "Shot/tackle strength a brand-new career starts with, 0-100.",
    default: 40, min: 0, max: 100, step: 1,
  },
  {
    key: "startingSkills.technique", category: "Starting Skills", label: "Starting Technique",
    description: "Ball control/finishing a brand-new career starts with, 0-100.",
    default: 40, min: 0, max: 100, step: 1,
  },
  {
    key: "startingSkills.vision", category: "Starting Skills", label: "Starting Vision",
    description: "Passing/reading-the-game a brand-new career starts with, 0-100.",
    default: 40, min: 0, max: 100, step: 1,
  },
  {
    key: "startingSkills.freeKick", category: "Starting Skills", label: "Starting Free Kick",
    description: "Set-piece ability a brand-new career starts with, 0-100. Starts a notch below the other four on purpose — nobody arrives already good at dead balls.",
    default: 30, min: 0, max: 100, step: 1,
  },

  // ── Attribute decay ──────────────────────────────────────────────────
  {
    key: "attributes.decayCheckWeeks", category: "Attribute Decay", label: "Weeks before a skill is overdue",
    description: "A skill that hasn't been trained (the minigame, not passing match performance) in this many weeks becomes eligible to decay — \"every few months\".",
    default: 18, min: 4, max: 52, step: 1,
  },
  {
    key: "attributes.decayChance", category: "Attribute Decay", label: "Chance to decay, once overdue",
    description: "Odds an overdue skill actually drops, checked once per match played while it stays overdue.",
    default: 0.12, min: 0, max: 1, step: 0.01,
  },
  {
    key: "attributes.decayMin", category: "Attribute Decay", label: "Points lost — minimum",
    description: "Smallest drop a successful decay roll costs a skill.",
    default: 1, min: 0, max: 10, step: 1,
  },
  {
    key: "attributes.decayMax", category: "Attribute Decay", label: "Points lost — maximum",
    description: "Largest drop a successful decay roll costs a skill.",
    default: 2, min: 0, max: 10, step: 1,
  },
  {
    key: "attributes.decayFloor", category: "Attribute Decay", label: "Never decays below this",
    description: "A skill stops decaying once it reaches this floor, however long it's neglected.",
    default: 20, min: 0, max: 99, step: 1,
  },

  // ── Energy ────────────────────────────────────────────────────────────
  {
    key: "energy.weekActions", category: "Energy", label: "Actions per week",
    description: "How many of train/relationship/rest you get between matches.",
    default: 3, min: 1, max: 7, step: 1,
  },
  {
    key: "energy.restHappiness", category: "Energy", label: "Rest — happiness gained",
    description: "Happiness restored by choosing Rest.",
    default: 6, min: 0, max: 30, step: 1,
  },
  {
    key: "energy.restEnergy", category: "Energy", label: "Rest — energy gained",
    description: "Energy restored by choosing Rest, and the amount auto-credited for every weekly action left unspent when a match kicks off.",
    default: 20, min: 0, max: 100, step: 1,
  },
  {
    key: "energy.matchCost", category: "Energy", label: "Energy cost of a full match",
    description: "Energy spent playing 90 minutes; a substitute appearance costs proportionally less.",
    default: 32, min: 0, max: 100, step: 1,
  },
  {
    key: "energy.minToStart", category: "Energy", label: "Minimum energy to start",
    description: "Below this, a player who'd otherwise start is demoted to substitute.",
    default: 35, min: 0, max: 100, step: 1,
  },
  {
    key: "energy.minToSub", category: "Energy", label: "Minimum energy to be a substitute",
    description: "Below this, a substitute is left out of the squad entirely.",
    default: 15, min: 0, max: 100, step: 1,
  },
  {
    key: "energy.hookLegsFloor", category: "Energy", label: "Tired-legs risk threshold",
    description: "Live in-match energy below which a tired-legs substitution risk starts rolling.",
    default: 28, min: 0, max: 100, step: 1,
  },
  {
    key: "energy.missedWeekEnergy", category: "Energy", label: "Energy gained sitting a week out",
    description: "Passive energy recovered from a week you don't play at all.",
    default: 15, min: 0, max: 100, step: 1,
  },
  {
    key: "energy.trainingCost", category: "Energy", label: "Training minigame — energy cost",
    description: "Energy spent per training session (also gates whether the Train button is enabled).",
    default: 15, min: 0, max: 100, step: 1,
  },

  // ── Wonderkids (High Potential) ──────────────────────────────────────
  {
    key: "wonderkids.ageCeiling", category: "Wonderkids", label: "Growth stops at this age",
    description: "A High Potential player younger than this can still grow each season rollover; at or past it, he's presumed to have peaked.",
    default: 24, min: 16, max: 40, step: 1,
  },
  {
    key: "wonderkids.growthChance", category: "Wonderkids", label: "Chance to grow, per season",
    description: "Odds a High Potential player under the age ceiling gains overall at any given season rollover.",
    default: 0.6, min: 0, max: 1, step: 0.05,
  },
  {
    key: "wonderkids.growthMin", category: "Wonderkids", label: "Overall gained — minimum",
    description: "Smallest overall bump a successful growth roll gives a High Potential player.",
    default: 1, min: 0, max: 10, step: 1,
  },
  {
    key: "wonderkids.growthMax", category: "Wonderkids", label: "Overall gained — maximum",
    description: "Largest overall bump a successful growth roll gives a High Potential player.",
    default: 3, min: 0, max: 15, step: 1,
  },
  {
    key: "wonderkids.growthCap", category: "Wonderkids", label: "High Potential ceiling",
    description: "The typical ceiling growth stops at for a High Potential player — but see Breakout chance below: a real minority of them are secretly capable of reaching the higher World Class ceiling instead.",
    default: 92, min: 1, max: 99, step: 1,
  },
  {
    key: "wonderkids.worldClassGrowthCap", category: "Wonderkids", label: "World Class ceiling",
    description: "The typical ceiling growth stops at for a World Class Potential player — genuinely higher than the ordinary High Potential ceiling. See Underachieve chance below: a real minority of them only ever reach the lower High Potential ceiling instead.",
    default: 97, min: 1, max: 99, step: 1,
  },
  {
    key: "wonderkids.breakoutChance", category: "Wonderkids", label: "Breakout chance (High Potential)",
    description: "Requested directly: a High Potential player can occasionally go above and beyond and reach the higher World Class ceiling instead of his own — a real, if uncommon, breakout. Fixed per player (his own hidden destiny), not re-rolled every season.",
    default: 0.12, min: 0, max: 1, step: 0.01,
  },
  {
    key: "wonderkids.underachieveChance", category: "Wonderkids", label: "Underachieve chance (World Class)",
    description: "Requested directly: a World Class player doesn't always hit the very highest tier — sometimes he only reaches the lower High Potential ceiling. Fixed per player (his own hidden destiny), not re-rolled every season.",
    default: 0.25, min: 0, max: 1, step: 0.01,
  },
  {
    key: "wonderkids.feeMultiplier", category: "Wonderkids", label: "Transfer fee premium",
    description: "A High Potential player's transfer fee is multiplied by this on top of the ordinary overall-based fee — clubs pay for the upside, not just the current rating.",
    default: 1.6, min: 1, max: 5, step: 0.1,
  },
  {
    key: "wonderkids.feeAgeCeiling", category: "Wonderkids", label: "Fee premium stops at this age",
    description: "The transfer-fee premium only applies below this age — an older High Potential player is judged on what he's already become, not what he might.",
    default: 26, min: 16, max: 40, step: 1,
  },
  {
    key: "wonderkids.bigClubReachBonus", category: "Wonderkids", label: "Big-club reach bonus",
    description: "Added to how far above its own strength a buying club can reach when the player being chased is High Potential — the upside is the whole reason a bigger side takes a punt on him.",
    default: 6, min: 0, max: 30, step: 1,
  },
  {
    key: "wonderkids.mediaChance", category: "Wonderkids", label: "Media hype chance, per week",
    description: "Odds the England tab features one High Potential player from the rest of the division in any given week — \"these players get talked about in the media quite a bit.\"",
    default: 0.22, min: 0, max: 1, step: 0.01,
  },
  {
    key: "wonderkids.worldClassMultiplier", category: "Wonderkids", label: "World Class multiplier",
    description: "World Class Potential is the stronger tier above High Potential — this multiplies growth chance, growth gain, the transfer-fee premium, and the big-club reach bonus for a World Class player on top of what High Potential alone already gives him.",
    default: 1.5, min: 1, max: 5, step: 0.1,
  },

  // ── Training gains ───────────────────────────────────────────────────
  {
    key: "training.matchPoolRating8", category: "Training", label: "Match skill pool — rating 8+",
    description: "Skill-gain pool for a man-of-the-match-calibre performance (rating 8 or above).",
    default: 3, min: 0, max: 20, step: 0.1,
  },
  {
    key: "training.matchPoolRating7", category: "Training", label: "Match skill pool — rating 7+",
    description: "Skill-gain pool for a good performance (rating 7 to 7.9).",
    default: 1.2, min: 0, max: 20, step: 0.1,
  },
  {
    key: "training.matchPoolRating6", category: "Training", label: "Match skill pool — rating 6+",
    description: "Skill-gain pool for an average performance (rating 6 to 6.9).",
    default: 0.4, min: 0, max: 20, step: 0.1,
  },
  {
    key: "training.matchGainDivisor", category: "Training", label: "Match skill pool ÷ this many skills",
    description: "The match-performance skill pool is spread evenly across this many attributes.",
    default: 5, min: 1, max: 10, step: 1,
  },
  {
    key: "training.minigameBaseXp", category: "Training", label: "Training minigame — base XP",
    description: "The minimum XP a training session always awards, however it goes.",
    default: 3, min: 0, max: 50, step: 1,
  },
  {
    key: "training.minigameMaxXp", category: "Training", label: "Training minigame — max XP (hard cap)",
    description: "XP can never exceed this, however well a session goes — the actual perfect-session score is base + scale, a point or two under this on purpose.",
    default: 40, min: 1, max: 200, step: 1,
  },
  {
    key: "training.minigameScale", category: "Training", label: "Training minigame — XP from quality",
    description: "How much XP a perfect average per-rep quality (1.0) adds on top of the base.",
    default: 36, min: 0, max: 200, step: 1,
  },
  {
    key: "training.minigameXpDivisor", category: "Training", label: "Training minigame — XP ÷ this = skill gain",
    description: "Earned XP is divided by this (then age-scaled) to get the actual skill-point gain.",
    default: 5, min: 1, max: 20, step: 1,
  },

  // ── Star rating / overall rating ─────────────────────────────────────
  {
    key: "rating.weightPace", category: "Rating", label: "Overall weight — Pace",
    description: "How much Pace counts toward your attribute overall (the five weights should add to 1).",
    default: 0.20, min: 0, max: 1, step: 0.01,
  },
  {
    key: "rating.weightPower", category: "Rating", label: "Overall weight — Power",
    description: "How much Power counts toward your attribute overall.",
    default: 0.20, min: 0, max: 1, step: 0.01,
  },
  {
    key: "rating.weightTechnique", category: "Rating", label: "Overall weight — Technique",
    description: "How much Technique counts toward your attribute overall.",
    default: 0.26, min: 0, max: 1, step: 0.01,
  },
  {
    key: "rating.weightVision", category: "Rating", label: "Overall weight — Vision",
    description: "How much Vision counts toward your attribute overall.",
    default: 0.22, min: 0, max: 1, step: 0.01,
  },
  {
    key: "rating.weightFreeKick", category: "Rating", label: "Overall weight — Free Kick",
    description: "How much Free Kick counts toward your attribute overall.",
    default: 0.12, min: 0, max: 1, step: 0.01,
  },
  {
    key: "rating.honourCap", category: "Rating", label: "Honours — max reputation points",
    description: "The most trophies/achievements/records/career stats can add to your star rating (out of the ÷20 total).",
    default: 18, min: 0, max: 100, step: 1,
  },
  {
    key: "rating.trophyFameScale", category: "Rating", label: "Honours — trophy fame scale",
    description: "Each trophy's fame value (Premier League, FA Cup, etc.) is multiplied by this before counting toward honours.",
    default: 0.1, min: 0, max: 2, step: 0.01,
  },
  {
    key: "rating.unlistedTrophyFame", category: "Rating", label: "Honours — unlisted trophy fame",
    description: "Fame value used for a trophy not in the named list.",
    default: 6, min: 0, max: 50, step: 1,
  },
  {
    key: "rating.ballonDorPoints", category: "Rating", label: "Honours — points per Ballon d'Or",
    description: "Reputation points added per Ballon d'Or win.",
    default: 3, min: 0, max: 20, step: 0.5,
  },
  {
    key: "rating.achievementPoints", category: "Rating", label: "Honours — points per achievement",
    description: "Reputation points added per unlocked achievement.",
    default: 0.15, min: 0, max: 5, step: 0.01,
  },
  {
    key: "rating.recordPoints", category: "Rating", label: "Honours — points per real record beaten",
    description: "Reputation points added per Premier League record you've beaten.",
    default: 3, min: 0, max: 20, step: 0.5,
  },
  {
    key: "rating.goalsWeight", category: "Rating", label: "Honours — career goals weight",
    description: "Weight on √(career goals) in the honours body-of-work term.",
    default: 0.3, min: 0, max: 2, step: 0.01,
  },
  {
    key: "rating.assistsWeight", category: "Rating", label: "Honours — career assists weight",
    description: "Weight on √(career assists) in the honours body-of-work term.",
    default: 0.2, min: 0, max: 2, step: 0.01,
  },
  {
    key: "rating.appearancesWeight", category: "Rating", label: "Honours — career appearances weight",
    description: "Weight on √(career appearances) in the honours body-of-work term.",
    default: 0.1, min: 0, max: 2, step: 0.01,
  },
  {
    key: "rating.divisor", category: "Rating", label: "Star rating — total ÷ this",
    description: "Attribute overall plus honour points, divided by this, gives your star rating out of 5.",
    default: 20, min: 1, max: 100, step: 1,
  },
  {
    key: "rating.floor", category: "Rating", label: "Star rating — floor",
    description: "The lowest a star rating can ever read.",
    default: 0.5, min: 0, max: 5, step: 0.1,
  },
  {
    key: "rating.displayBase", category: "Rating", label: "Display overall — base",
    description: "The overall (out of 100) shown for a 0-star rating.",
    default: 30, min: 0, max: 100, step: 1,
  },
  {
    key: "rating.displayScale", category: "Rating", label: "Display overall — per star",
    description: "How many overall points each star of rating is worth on screen.",
    default: 14, min: 0, max: 30, step: 0.5,
  },
  {
    key: "rating.growthUnder20", category: "Rating", label: "Growth multiplier — age 19 and under",
    description: "Skill-gain multiplier for a teenage player.",
    default: 1.4, min: 0, max: 5, step: 0.05,
  },
  {
    key: "rating.growthUnder24", category: "Rating", label: "Growth multiplier — age 20 to 23",
    description: "Skill-gain multiplier for a young player.",
    default: 1.15, min: 0, max: 5, step: 0.05,
  },
  {
    key: "rating.growthUnder29", category: "Rating", label: "Growth multiplier — age 24 to 28",
    description: "Skill-gain multiplier for a player in their prime.",
    default: 1.0, min: 0, max: 5, step: 0.05,
  },
  {
    key: "rating.growthUnder32", category: "Rating", label: "Growth multiplier — age 29 to 31",
    description: "Skill-gain multiplier for a veteran player.",
    default: 0.7, min: 0, max: 5, step: 0.05,
  },
  {
    key: "rating.growthOver31", category: "Rating", label: "Growth multiplier — age 32+",
    description: "Skill-gain multiplier for a player in the twilight of their career.",
    default: 0.4, min: 0, max: 5, step: 0.05,
  },

  // ── Sponsorships ─────────────────────────────────────────────────────
  {
    key: "sponsors.fameDivisor", category: "Sponsorships", label: "Fee — fame ÷ this, added to base",
    description: "Your fame divided by this is added to a sponsor's base fee before the ambition multiplier.",
    default: 6, min: 1, max: 50, step: 1,
  },
  {
    key: "sponsors.ambitionTitle", category: "Sponsorships", label: "Ambition multiplier — Title push",
    description: "Fee multiplier when your club's ambition is a title challenge.",
    default: 1.4, min: 0, max: 3, step: 0.05,
  },
  {
    key: "sponsors.ambitionEurope", category: "Sponsorships", label: "Ambition multiplier — Europe push",
    description: "Fee multiplier when your club's ambition is a European push.",
    default: 1.2, min: 0, max: 3, step: 0.05,
  },
  {
    key: "sponsors.ambitionMidTable", category: "Sponsorships", label: "Ambition multiplier — Mid-table",
    description: "Fee multiplier for a mid-table club.",
    default: 1.0, min: 0, max: 3, step: 0.05,
  },
  {
    key: "sponsors.ambitionSurvival", category: "Sponsorships", label: "Ambition multiplier — Survival",
    description: "Fee multiplier for a relegation-threatened club.",
    default: 0.85, min: 0, max: 3, step: 0.05,
  },
  {
    key: "sponsors.lapsedStandingHit", category: "Sponsorships", label: "Standing lost per lapsed deal",
    description: "Sponsor standing penalty for each deal left unfulfilled at season end.",
    default: 6, min: 0, max: 50, step: 1,
  },

  // ── Sponsorship objectives ───────────────────────────────────────────
  {
    key: "sponsors.objectiveDifficultyPerFee", category: "Sponsorships", label: "Objective difficulty — × base fee",
    description: "How much harder an objective gets per ★ of the category's own base fee — a cheap deal asks something easy, an expensive one asks something hard.",
    default: 0.06, min: 0, max: 1, step: 0.01,
  },
  {
    key: "sponsors.objectiveGoalsBase", category: "Sponsorships", label: "Objective — goals (base)",
    description: "Base target for a 'score N goals' objective, before star rating/seasons/difficulty scaling.",
    default: 8, min: 1, max: 100, step: 1,
  },
  {
    key: "sponsors.objectiveAssistsBase", category: "Sponsorships", label: "Objective — assists (base)",
    description: "Base target for a 'register N assists' objective.",
    default: 5, min: 1, max: 100, step: 1,
  },
  {
    key: "sponsors.objectiveAppearancesBase", category: "Sponsorships", label: "Objective — appearances (base)",
    description: "Base target for a 'play N matches' objective.",
    default: 14, min: 1, max: 100, step: 1,
  },
  {
    key: "sponsors.objectiveStarManBase", category: "Sponsorships", label: "Objective — Star Man awards (base)",
    description: "Base target for a 'win N Star Man awards' objective.",
    default: 3, min: 1, max: 50, step: 1,
  },
  {
    key: "sponsors.objectiveRatingBase", category: "Sponsorships", label: "Objective — average rating (base ×10)",
    description: "Base target for an 'average rating' objective, stored ×10 (70 = a 7.0 average).",
    default: 70, min: 40, max: 95, step: 1,
  },
  {
    key: "sponsors.objectiveRatingSpread", category: "Sponsorships", label: "Objective — average rating (random spread ×10)",
    description: "Random amount added on top of the base rating target, stored ×10.",
    default: 8, min: 0, max: 30, step: 1,
  },
  {
    key: "sponsors.objectiveGoalStreakBase", category: "Sponsorships", label: "Objective — goal streak (base games)",
    description: "Base target for a 'score in N consecutive appearances' objective.",
    default: 4, min: 2, max: 30, step: 1,
  },
  {
    key: "sponsors.objectiveStartStreakBase", category: "Sponsorships", label: "Objective — start streak (base games)",
    description: "Base target for a 'start N matches in a row' objective.",
    default: 10, min: 2, max: 40, step: 1,
  },
  {
    key: "sponsors.objectiveCleanSheetsBase", category: "Sponsorships", label: "Objective — clean sheets (base)",
    description: "Base target for a 'keep N clean sheets while you play' objective.",
    default: 6, min: 1, max: 40, step: 1,
  },
  {
    key: "sponsors.objectiveBonusBase", category: "Sponsorships", label: "Objective bonus — base",
    description: "Base ★ bonus for completing an objective, before the per-deal index, star rating, seasons and difficulty scaling.",
    default: 6, min: 0, max: 100, step: 1,
  },
  {
    key: "sponsors.objectiveBonusPerIndex", category: "Sponsorships", label: "Objective bonus — × deal index",
    description: "Extra ★ bonus added per position in your sponsor list — a later, bigger deal pays a bigger bonus for the same difficulty.",
    default: 2, min: 0, max: 20, step: 0.5,
  },
  {
    key: "sponsors.objectiveSeasonsMin", category: "Sponsorships", label: "Objective term — minimum seasons",
    description: "The shortest an objective's deadline can be.",
    default: 1, min: 1, max: 5, step: 1,
  },
  {
    key: "sponsors.objectiveSeasonsMax", category: "Sponsorships", label: "Objective term — maximum seasons",
    description: "The longest an objective's deadline can be.",
    default: 2, min: 1, max: 5, step: 1,
  },
  {
    key: "sponsors.upgradeFeeMultiplier", category: "Sponsorships", label: "Upgrade — fee gain per completed objective",
    description: "Completing an objective doesn't just pay its bonus — it permanently raises this deal's season fee by this fraction, compounding with every objective completed since (capped at Upgrade — max level).",
    default: 0.15, min: 0, max: 2, step: 0.01,
  },
  {
    key: "sponsors.upgradeMaxLevel", category: "Sponsorships", label: "Upgrade — max level",
    description: "The most times a single deal's fee can be upgraded by completing its objectives.",
    default: 5, min: 1, max: 20, step: 1,
  },
  {
    key: "sponsors.startThresholdMinutes", category: "Sponsorships", label: "Minutes counted as 'started'",
    description: "A start-streak or clean-sheet objective needs at least this many minutes played to count the match as a start, not a substitute cameo.",
    default: 60, min: 1, max: 90, step: 1,
  },

  // ── Contracts ────────────────────────────────────────────────────────
  {
    key: "contracts.appearanceFeePct", category: "Contracts", label: "Appearance fee — % of wage",
    description: "An offered appearance fee is roughly this fraction of your wage, per match played.",
    default: 0.18, min: 0, max: 2, step: 0.01,
  },
  {
    key: "contracts.appearanceFeeChance", category: "Contracts", label: "Appearance fee — offer chance",
    description: "Chance an appearance fee is offered at all, for a player not yet a big enough star to guarantee one.",
    default: 0.3, min: 0, max: 1, step: 0.01,
  },
  {
    key: "contracts.loyaltyBonusPct", category: "Contracts", label: "Loyalty bonus — × wage",
    description: "A loyalty bonus, if offered, is roughly your wage times this.",
    default: 2.2, min: 0, max: 10, step: 0.1,
  },
  {
    key: "contracts.loyaltyBonusChance", category: "Contracts", label: "Loyalty bonus — offer chance",
    description: "Chance a loyalty bonus is offered to a good enough player.",
    default: 0.7, min: 0, max: 1, step: 0.01,
  },
  {
    key: "contracts.releaseClauseChance", category: "Contracts", label: "Release clause — offer chance",
    description: "Chance a release clause is offered at all.",
    default: 0.65, min: 0, max: 1, step: 0.01,
  },
  {
    key: "contracts.releaseClauseBase", category: "Contracts", label: "Release clause — base multiple",
    description: "Base multiple of wage a release clause starts from, before star rating and randomness.",
    default: 14, min: 0, max: 100, step: 1,
  },
  {
    key: "contracts.releaseClauseStarMult", category: "Contracts", label: "Release clause — × star rating",
    description: "How much each star of rating adds to the release-clause multiple.",
    default: 6, min: 0, max: 30, step: 0.5,
  },
  {
    key: "contracts.buyerMeansBase", category: "Contracts", label: "Buyer's means — base multiple",
    description: "Base multiple of wage a buying club can raise to trigger a release clause.",
    default: 8, min: 0, max: 50, step: 1,
  },
  {
    key: "contracts.buyerMeansStrengthMult", category: "Contracts", label: "Buyer's means — strength scale",
    description: "How much a buying club's strength (out of 100) adds to their means to trigger a clause.",
    default: 55, min: 0, max: 200, step: 1,
  },

  // ── Transfers ────────────────────────────────────────────────────────
  {
    key: "transfers.squadTarget", category: "Transfers", label: "Full squad size",
    description: "The squad size (11 starters + 9 subs) every club's transfer activity targets.",
    default: 20, min: 11, max: 40, step: 1,
  },
  {
    key: "transfers.minSquadSize", category: "Transfers", label: "Minimum squad size",
    description: "Absolute floor — a club is never sellable from at or below this many players.",
    default: 15, min: 11, max: 30, step: 1,
  },
  {
    key: "transfers.feeBase", category: "Transfers", label: "Transfer fee — base (£m)",
    description: "The transfer fee for a 60-overall player (the formula's floor).",
    default: 0.3, min: 0, max: 20, step: 0.1,
  },
  {
    key: "transfers.feeQuadratic", category: "Transfers", label: "Transfer fee — quadratic scale",
    description: "How steeply the fee rises per overall point above 60 (squared, so this matters a lot).",
    default: 0.045, min: 0, max: 1, step: 0.001,
  },
  {
    key: "transfers.summerUnhappyOdds", category: "Transfers", label: "Summer — unhappy departure odds",
    description: "Chance, per eligible player per summer window, of an unhappy departure from an otherwise-settled squad.",
    default: 0.05, min: 0, max: 1, step: 0.01,
  },
  {
    key: "transfers.januaryUnhappyOdds", category: "Transfers", label: "January — unhappy departure odds",
    description: "Chance, per eligible player per January window, of an unhappy departure.",
    default: 0.015, min: 0, max: 1, step: 0.005,
  },
  {
    key: "transfers.starterListingOdds", category: "Transfers", label: "Summer — starter listing odds",
    description: "Base chance a first-team starter at a non-elite, overstocked club is listed, in summer.",
    default: 0.10, min: 0, max: 1, step: 0.01,
  },
  {
    key: "transfers.benchListingOdds", category: "Transfers", label: "Summer — squad player listing odds",
    description: "Base chance a squad/bench player is listed, in summer.",
    default: 0.16, min: 0, max: 1, step: 0.01,
  },

  // ── Betting ───────────────────────────────────────────────────────────
  {
    key: "betting.strengthExponent", category: "Betting", label: "Competition odds — strength exponent",
    description: "Reported directly as too flat: a huge real gap between the best and worst squad in the division barely showed up in the odds (a ~10 shot favourite next to a ~35 shot no-hoper). Raising this widens that gap a lot — the same shape competitionBetting.ts's winWeight always used, just steeper.",
    default: 3.5, min: 1, max: 6, step: 0.1,
  },
  {
    key: "betting.strengthBaseline", category: "Betting", label: "Competition odds — strength baseline",
    description: "Strength at or below this is treated as having no real chance of winning at all — the zero point the exponent above measures every club's real gap from.",
    default: 50, min: 0, max: 70, step: 1,
  },
  {
    key: "betting.overround", category: "Betting", label: "Competition odds — bookmaker's overround",
    description: "The house edge folded into every competition-betting price — a real book never sums to even money.",
    default: 1.25, min: 1, max: 2, step: 0.01,
  },
  {
    key: "betting.maxOdds", category: "Betting", label: "Competition odds — longest price offered",
    description: "Reported directly: real long-shot title odds go into the thousands (Leicester City's real 5000/1), and this game's old 250 cap made even the weakest team in the division look like a live outright contender. Real bookmakers often cap around 500 for a big domestic league; this goes further since a bookmaker's practical cap is a business choice this game doesn't need to copy exactly.",
    default: 1000, min: 100, max: 10000, step: 50,
  },
  {
    key: "horseRacing.raceNoise", category: "Betting", label: "Horse race — random variance",
    description: "Reported directly: the best horse/rating was winning far too often, with barely any risk. This is how much real randomness gets added on top of a horse's own rating for one race — raising it makes the field far less predictable without erasing the favourite's real edge.",
    default: 50, min: 10, max: 100, step: 1,
  },
];
