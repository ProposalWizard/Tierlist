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
];
