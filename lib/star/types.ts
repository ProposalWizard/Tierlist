import type { Scenario, Vec2, Contact, KickSkills } from "./canvasEngine";
import type { PenaltyReadDecision } from "./penaltyKeeper";
import type { PenaltyRunupId, FreeKickRunupId } from "./runupStyles";

/**
 * Everything needed to watch a goal you scored happen again, exactly as it
 * did — the physics are a real simulation seeded off `mulberry32`, so the
 * SAME scenario, rng state and strike inputs always resolve the SAME way.
 * See CanvasMatch.tsx's rngCallCountRef for why `callsBeforeStrike` matters:
 * `launch()` and everything after it draws from the rng too, so watching it
 * again has to put the rng back in the exact state it was in at the strike,
 * not just start a fresh stream from `seed`.
 *
 * `seed`/`callsBeforeStrike`/`scenario`/`dir`/`power`/`contact`/`skills` are
 * not actually the whole story, though — reported directly, twice, with
 * real before/after outcomes: a goal watched back from the replay list hit
 * the post instead, another was intercepted instead of going in, both after
 * following "the exact same movement" up to that point. The physics loop
 * substeps the flight three times a frame at `dt / 3`, and `dt` is real
 * elapsed device time — a fresh replay session runs its own
 * requestAnimationFrame loop with its own frame timing, so it very rarely
 * lands on the exact same NUMBER of substeps (and therefore the same number
 * of in-flight rng draws, and the same Euler-integration step sizes) that
 * the original live match happened to run through before the ball reached
 * its outcome. `flightDtLog` is the fix: every substep `h` actually used,
 * from the strike to the moment the flight resolves, recorded in order.
 * Replaying with this queue instead of a fresh device's own dt makes the
 * substep count, the rng draws inside it, and the integration itself
 * bit-for-bit identical to the original — not just "the same inputs," but
 * the same physics. Optional only so an already-saved replay from before
 * this existed still opens (falling back to live device timing, imperfectly,
 * exactly as it always has) rather than refusing to play at all.
 */
export interface GoalReplay {
  id: string;
  /** ISO timestamp, for sorting the recent-goals list newest first. */
  savedAt: string;
  /** e.g. "FREE KICK · 63'" — see CanvasMatch's SCENARIO_LABEL. */
  label: string;
  seed: number;
  callsBeforeStrike: number;
  /** The fully-built scenario at the instant of the strike — defenders,
   *  keeper, runner, viewport, all of it. A plain snapshot, not rebuilt from
   *  the seed, because the keeper can drift during aiming (real elapsed
   *  time, not seed-derived) before the strike ever happens. */
  scenario: Scenario;
  dir: Vec2;
  power: number;
  contact: Contact;
  skills: KickSkills;
  /** See the file note above — every physics substep size actually used
   *  between the strike and the flight resolving, in order. */
  flightDtLog?: number[];  /** A penalty: what the keeper decided at the strike (see
   *  lib/star/penaltyKeeper.ts), so the replay makes the same dive. Absent on
   *  anything else, and on a penalty saved before the keeper read your aim. */
  penaltyRead?: PenaltyReadDecision;
  /** The chance kind's strike-time rule decision (lib/star/kindRules) — e.g.
   *  who won the first contact at a corner — so the replay plays the same. */
  kindStrike?: { kind: string; data: Record<string, number | string | boolean | null> };
  /** The keeper brain as he stood at the strike, and his strike stream's seed
   *  (lib/star/keeperBrain.ts), so the replay throws the same dive. Absent on
   *  a goal saved before the brain, which replays exactly as it always did. */
  keeperBrain?: import("./keeperBrain").KeeperBrainSnapshot;
  /** The goal's frame-by-frame recording (lib/star/goalClip/), when it was
   *  made on this device. Watching it plays the recording itself — the exact
   *  goal — rather than running the physics again from the seed above. */
  clipId?: string;
}

export interface StarPlayer {
  firstName: string;
  lastName: string;
  age: number;
  /**
   * WIDENED, never restructured — see lib/star/playerIdentity.ts's SKIN_TONES.
   *
   * Was `"light" | "dark"`, a binary. It is now one of eight tones, of which
   * `"light"` and `"dark"` are still two, carrying the exact hex values the
   * old picker shipped. So every save ever written already names a tone that
   * exists and resolves to the identical colour: there is no migration, and
   * nothing that assigned `"light"`/`"dark"` needs touching. Read it through
   * `resolveSkinTone`/`skinToneHex` rather than directly, so a value from a
   * hand-edited or future save still renders something.
   */
  skinTone: import("./playerIdentity").SkinTone;
  club: string;
  clubBadge: string | null;
  position: string;
  nationality: string;
  startYear: number;
  /**
   * What he's actually called, if it isn't his name.
   *
   * Optional and absent for every career that exists — which is exactly what
   * "he hasn't got one" means, so no backfill is needed. Where it IS set it
   * should win over firstName/lastName in commentary, the media feed and the
   * team sheet; `displayName`/`shortDisplayName` (playerIdentity.ts) are the
   * one place that rule lives, rather than a nickname check at twenty call
   * sites.
   */
  nickname?: string;
  /**
   * The squad number he'd ASK for. Not the one he's been given.
   *
   * `CareerState.squadNumber` stays the number the club actually handed him
   * (recognition.ts's assignSquadNumber). This is the preference, and it is
   * changeable at any time — the intent being that once he's earned enough
   * standing at a club, the club gives him the number he wants. That stature
   * mechanic is deliberately NOT built yet; this is the field it will read.
   * Optional, so an older save simply has no preference on file.
   */
  preferredNumber?: number;
  /**
   * Left or right, chosen at creation and permanent.
   *
   * There is deliberately no UI anywhere in the game that changes this. A
   * weak-foot system is intended later; this is the field that decides which
   * foot is the weak one. Optional, so an older save reads as right-footed
   * (see playerIdentity.ts's resolveFoot) rather than undefined.
   */
  preferredFoot?: import("./playerIdentity").PreferredFoot;
  /** His 3D avatar's hair (the live 3D signing). Absent = short, brown. */
  hairStyle?: import("./playerIdentity").HairStyle;
  hairColour?: import("./playerIdentity").HairColour;
  /**
   * A picture of you, cropped square and stored as a data URI.
   *
   * Optional and expected to be absent — the cards fall back to the back of your
   * shirt, which is a real answer rather than a placeholder. Never uploaded
   * anywhere; see lib/star/portrait.ts.
   */
  portrait?: string;
}

export interface Skills {
  pace: number;
  power: number;
  technique: number;
  vision: number;
  freeKick: number;
}

/** Defensive / Balanced / Attacking — see CareerState.playstyle. */
export type Playstyle = "defensive" | "balanced" | "attacking";

export interface Relationships {
  boss: number;
  team: number;
  fans: number;
  girlfriend: number | null;
  sponsors: number;
}

/**
 * Reputation, as a real multi-part stat — Phase 1 of STAR_POWER_POLITICS.md.
 * Explicitly NOT one number: world/governing-body standing, standing within
 * your own club, government-official relationships, and shareholder
 * relationships. Fan reputation deliberately isn't duplicated here — it's
 * `Relationships.fans` above, extended rather than replaced (see the
 * brief's §5). All four fields are 0-100, same convention as
 * `Relationships`. See lib/star/reputation.ts for how these move.
 */
/** One number, 0-100 — do the people who run football trust you. See
 *  reputation.ts. Was a four-bar object before 21 Sep 2026; storage.ts
 *  migrates old saves to the average of the four. */
export type Reputation = number;

export interface Contract {
  club: string;
  wage: number;
  goalBonus: number;
  assistBonus: number;
  seasonsRemaining: number;
  // ── Clauses. All optional, so a contract signed before they existed still
  //    loads and simply has none. ──
  /** Paid every match you actually play. Worth nothing to a regular. */
  appearanceFee?: number;
  /** Paid at the end of every season you did not leave. */
  loyaltyBonus?: number;
  /** The price at which the club cannot say no. Cuts both ways. */
  releaseClause?: number;
}

export interface SeasonStats {
  appearances: number;
  goals: number;
  hatTricks: number;
  passes: number;
  assists: number;
  starMan: number;
  totalRating: number;
  ratingCount: number;
}

/** Every competition a career can play in. */
export type Competition =
  | "FA Cup"
  | "League Cup"
  | "Champions League"
  | "Europa League"
  | "Conference League"
  /** One match, before the season: last season's champions v the FA Cup holders. */
  | "Community Shield"
  /** One match, before the season: the Champions League holders v the Europa League holders. */
  | "Super Cup"
  | "World Cup"
  | "European Championship"
  /** Third to sixth in the Championship, for the last promotion place. */
  | "Play-Offs";

export interface Fixture {
  week: number;
  opponent: string;
  home: boolean;
  played: boolean;
  homeScore?: number;
  awayScore?: number;
  userGoals?: number;
  userAssists?: number;
  userRating?: number;
  // ── Knockout football. Absent on a league fixture, which is what every
  //    fixture was until cups existed — so absent means league. ──
  competition?: Competition;
  kind?: "league" | "cup" | "europe" | "international" | "playoff";
  /** The one against the club down the road. Same football, louder consequences. */
  derby?: boolean;
  round?: string;
  /** A two-legged cup tie (the League Cup semi-final): which leg this is.
   *  Absent on everything else, and on a semi drawn before legs existed. */
  leg?: 1 | 2;
  /** For opponents that are not in your division. */
  opponentStrength?: number;
}

/**
 * A player at one of the OTHER nineteen clubs.
 *
 * Deliberately thinner than `SquadPlayer`. Your team-mates appear on the pitch,
 * get named in commentary and carry career totals; these men only ever have to
 * answer "who scored?", so they cost six fields instead of twelve. Twenty
 * squads stored this way are 15.6 KB; stored as SquadPlayers they are 105 KB.
 */
export interface LeaguePlayer {
  id: string;
  name: string;
  position: SquadPlayer["position"];
  overall: number;
  goals: number;
  assists: number;
  /**
   * His REAL portrait, when the database has one — genuinely absent
   * otherwise, on purpose: `shouldUpgradeLeagueSquads` (leagueSquads.ts)
   * reads exactly this field's real coverage to detect a stale pre-image
   * snapshot, so a fake stand-in is never written in here, only resolved
   * at the render/Identity layer (CanvasMatch.tsx's `oppXIForCast`,
   * lib/star/fakeFaces.ts) — the one place that distinction stops
   * mattering and every figure just needs SOME face to draw.
   *
   * The only field here that is not needed to answer "who scored?", and it is
   * here because the Player of the Month shortlist is eight faces and a grid of
   * monograms is not that card. About 45 characters a player, so a division's
   * worth is roughly 22 KB on top of the 15.6 KB this was sized at — still
   * nothing against the save budget. Absent for a generated squad, which has
   * no real footballers in it to photograph (though see `generatedSquad`,
   * which does give one a fake face here too — nothing downstream needs to
   * know the difference between "no real photo yet" and "not a real player
   * at all", and a generated squad's own players are never in the
   * `shouldUpgradeLeagueSquads` ratio to begin with, since they never carry
   * `nation` either).
   */
  image?: string;
  /**
   * Where he is from, for the flag beside his name on a team sheet.
   *
   * Same reasoning as `image`: not needed to answer "who scored?", and needed
   * the moment the pre-match screen names an opposition eleven.
   */
  nation?: string;
  /** See SquadPlayer.positions — the same idea, for the other nineteen clubs. */
  positions?: SquadPlayer["position"][];
  /**
   * Real age, when the database has one — same reasoning as `image`/`nation`:
   * not needed to answer "who scored?", but needed by the transfer engine
   * (lib/star/leagueTransfers.ts), which weights a loan far more heavily for
   * a young player than an old one. Absent for a generated squad, same as
   * `image`/`nation`.
   */
  age?: number;
  /**
   * A real, admin-ticked scouting judgement — "this player has real
   * potential to improve" — set per FC-27 row in /admin/football/players
   * (sofifa_players.high_potential) and read straight through here. Drives
   * three things a normal squad player doesn't get: a real chance to grow
   * his `overall` at each season rollover (`growWonderkids`,
   * leagueSquads.ts), a transfer-fee premium over what his age/rating alone
   * would justify (`feeFor`, leagueTransfers.ts), and a bias toward moving
   * to a bigger club specifically because of that upside. Absent (not
   * false) for a generated squad or a save from before this existed —
   * treated as "no" wherever it's read, same convention as every other
   * optional real-player field here.
   */
  highPotential?: boolean;
  /**
   * The stronger tier above `highPotential`, added directly afterward —
   * `sofifa_players.world_class_potential` in /admin/football/players.
   * ALWAYS accompanied by `highPotential: true` for the same player (set
   * that way by the admin PATCH route), so every hook keyed off
   * `highPotential` already fires for a World Class player too; this only
   * needs to be read where the STRONGER tier itself matters (a bigger
   * growth roll, a bigger fee premium, a bigger reach-up bias). Same
   * "absent means no" convention as `highPotential`.
   */
  worldClassPotential?: boolean;
  /**
   * Real per-attribute ratings (0-100), when the database has them — same
   * "absent for a generated squad" caveat as `image`/`nation`/`age`.
   * Sourced from `sofifa_players.attributes` via `attributesFromJson`
   * (lib/playerAttributes.ts) — the same unpacking the PL Draft already
   * relies on. Deliberately not fetched by this lean endpoint until now
   * (see league-squads/route.ts's own doc on why it avoids that JSONB
   * blob) — added back, scoped to just these six, because "a player plays
   * like himself" (real curl, real defending, a real goalkeeper rating)
   * needed something finer-grained than one overall number. `shooting`
   * doubles as "finishing" — SoFIFA's own name for the same six-stat wheel
   * the Draft already uses.
   */
  pace?: number;
  shooting?: number;
  passing?: number;
  dribbling?: number;
  defending?: number;
  physical?: number;
}

export interface LeagueSquad {
  club: string;
  players: LeaguePlayer[];
}

/** One game in the division's schedule. */
export interface LeagueFixture {
  week: number;
  home: string;
  away: string;
}

/** …and how it finished. `hs`/`as` are the home and away scores. */
export interface LeagueResult extends LeagueFixture {
  hs: number;
  as: number;
  /** Who scored them: minute, scorer, assister. Home side then away side.
   *  `full`/`role` (the scorer's real full name and position) are only ever
   *  set for a match nobody played — see leagueSquads.ts's SimGoal, which
   *  this shape mirrors — so the league-wide media pass (media/detect/
   *  league.ts) can name a goal exactly, not just as its short scoreline
   *  form. Absent on a career saved before either existed. */
  hg?: { m: number; s: string; a?: string; full?: string; role?: string }[];
  ag?: { m: number; s: string; a?: string; full?: string; role?: string }[];
}

/** A knockout the player is in, or was in. */
export interface CupRun {
  competition: Competition;
  kind: "cup" | "europe" | "international";
  roundIndex: number;
  eliminated: boolean;
  won: boolean;
}

export interface LeagueTeam {
  name: string;
  strength: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

export interface SquadPlayer {
  id: string;
  name: string;
  shortName: string;
  position: "GK" | "CB" | "LB" | "RB" | "CDM" | "CM" | "CAM" | "LW" | "RW" | "ST";
  seasonGoals: number;
  seasonAssists: number;
  careerGoals: number;
  careerAssists: number;
  /**
   * …and the league-only subset, for the Golden Boot and the Assist King.
   *
   * A team-mate's cup goals belong on his club record — `seasonGoals` — and not
   * on a chart that has only ever counted league football. Optional, so a career
   * saved before the cups were real reads its existing totals as league ones,
   * which for that career they were.
   */
  leagueGoals?: number;
  leagueAssists?: number;
  // ── When the team-mate is a real footballer ──
  //
  // All optional, because a squad can also be generated — offline, at a club
  // with no rows in the database, or in a career that predates this. Everything
  // downstream reads names and positions, which both squads have; these only
  // add the face and the number next to it. `imageUrl` specifically stays
  // genuinely absent for a real player the database has no scraped photo
  // for — a fake stand-in is resolved at the render layer instead
  // (lineup.ts's `idOf`, lib/star/fakeFaces.ts), never written back here.
  sofifaId?: string;
  overall?: number;
  imageUrl?: string;
  nationality?: string;
  age?: number;
  /** See LeaguePlayer.highPotential — the same admin-ticked flag, for a man
   *  who ended up in YOUR squad (your own club's real roster, or someone
   *  you signed) rather than one of the other nineteen. */
  highPotential?: boolean;
  /** See LeaguePlayer.worldClassPotential — the same stronger tier, for a
   *  man in YOUR squad. */
  worldClassPotential?: boolean;
  /** See LeaguePlayer's own six attribute fields — the same real numbers,
   *  for a man in YOUR squad rather than one of the other nineteen. */
  pace?: number;
  shooting?: number;
  passing?: number;
  dribbling?: number;
  defending?: number;
  physical?: number;
  /**
   * Every position he is actually listed for, `position` included — a real
   * player's data holds several (SoFIFA's "CAM, CM, LW"), but building the
   * squad still has to settle him into exactly one SLOT of the twenty. This
   * is the difference between "the slot he fills in the squad" and "what he
   * can actually play", and only the second one is what a team sheet should
   * judge him against. Absent on an old save or a generated squad, both of
   * which read as just `[position]`. See formations.ts's fitness/autoPick.
   */
  positions?: SquadPlayer["position"][];
  /**
   * DEV CHEAT (Settings → Dev — Squad): pinned into the starting XI by
   * `pinDevStarters` (teamsheet.ts), whatever the saved lineup or auto-pick
   * says. Absent for everyone in a normal save.
   */
  devStart?: boolean;
}

export interface GoalEvent {
  minute: number;
  scorer: string;   // full player name
  assist?: string;  // full player name, or undefined
  isUserGoal: boolean;
  /**
   * How it was scored, and from how far.
   *
   * The match engine knows both at the moment it records a goal — the scenario
   * the chance was built from and where the ball was struck — and threw them
   * away. Without them a goal is a number, and "35-YARD SCREAMER" is a headline
   * nothing in the game can produce. Optional, so a career saved before this
   * existed still loads and simply never gets the spectacular ones.
   */
  how?: string;
  /** Metres from the centre of the goal at the strike. */
  distance?: number;
  /** Your assist only: how far YOUR pass travelled, from where you played it
   *  to where the scorer took it (metres). Absent on older saves. */
  passLength?: number;
  /** Goal videos (Leo, 7 Oct 2026): the recording of this goal, frame by
   *  frame, kept on this device (lib/star/goalClip/store.ts). Absent for a
   *  goal nobody saw — simulated, or scored while you were off the pitch. */
  clipId?: string;
}

/**
 * A goal the OPPONENT scored, named live rather than invented afterwards.
 *
 * `playLeagueWeek` (season.ts) used to name every one of the opponent's
 * goals itself, after the match, off a fresh weighted pick against their
 * squad — completely disconnected from whatever name the live commentary
 * had already shown for that exact goal. Requested directly: make the
 * opponent's goals show a name live, "the same thing as when someone from
 * my team scores" — which also means the result you see afterwards has to
 * agree with what you watched, not re-roll a second, different scorer.
 * Carries the id (to credit the right real player's season tally, the same
 * side effect `nameGoals` already has) alongside the display name.
 */
export interface OppGoalEvent {
  minute: number;
  scorerId: string;
  scorer: string;
  assistId?: string;
  assist?: string;
}

export interface MatchStats {
  /** Minutes actually played. Under 90 when you came off the bench. */
  minutes?: number;
  /** Why you were taken off, when you were. */
  hooked?: "form" | "rested" | "legs" | null;
  chances: number;
  goals: number;
  assists: number;
  passes: number;
  rating: number;
  starMan: boolean;
  bossChange: number;
  teamChange: number;
  fansChange: number;
  wage: number;
  goalBonus: number;
  sponsorPay: number;
  totalCash: number;
  homeScore: number;
  awayScore: number;
  goalEvents?: GoalEvent[];
  /** The opponent's goals, named live — see OppGoalEvent. */
  oppGoalEvents?: OppGoalEvent[];
  /** The live, in-match energy value at the final whistle (or at the
   *  moment you were hooked) — see CanvasMatch's liveEnergyRef. Feeds the
   *  injury roll in creditMatchResult; falls back to the pre-match energy
   *  value when a caller doesn't supply it. */
  endEnergy?: number;
  /** Basic KIB cans drunk at half time this match (energy.ts). Taken off
   *  `kibCans.basic` by creditMatchResult. */
  kibCansUsed?: number;
  /** The playstyle you finished the match on, saved to the career so the
   *  next match starts on it (CareerState.playstyle). */
  playstyle?: Playstyle;
  /** True when a level knockout tie needed extra time (added into
   *  `homeScore`/`awayScore` already) to try to separate the sides — see
   *  shootout.ts's `hasExtraTime`/CanvasMatch's extra-time phase. */
  wentToExtraTime?: boolean;
  /** A real penalty shootout the player watched/took live, already decided
   *  — `home`/`away` mirror the match's own home/away sides, same as
   *  `homeScore`/`awayScore`. Absent when the tie never needed one. */
  shootout?: { home: number; away: number };
  /** Your "cheeky" kicks that didn't go in — a penalty down the middle, or a
   *  chip — see lib/star/penaltyRunup.ts. Each costs a little reputation
   *  (reputation.ts, `cheekyMiss`). Absent when there were none. */
  cheekyMisses?: { kind: "penalty-middle" | "chip"; minute: number }[];
  /** Item 24 (v0.15): the rating before a cameo is pulled toward 6.5 — what
   *  the shirt is judged on. Equal to `rating` for a full ninety. */
  rawRating?: number;
  /** Item 24: you came on as a substitute this match, at this minute. */
  cameo?: boolean;
  enteredAt?: number;
  /** Item 26: every chance that came to you — the minute, what kind of
   *  chance it was (a ScenarioKind, or "dribble") and how it went (a
   *  ChanceOutcome, lib/star/chanceLog.ts). Tapping the post-match rating
   *  opens this list. Absent on a match played before it existed. */
  chanceLog?: { minute: number; kind: string; outcome: string }[];
  /** Item 36: the match was simmed, not played. */
  simmed?: boolean;
}

export interface Boot {
  id: string;
  name: string;
  /** Shop level 1-5 (BOOT_LEVELS). Absent on a boot from before levels. */
  level?: number;
  /** The boot this is a level of ("galaxy" for "galaxy-l2"). */
  baseId?: string;
  /**
   * INERT — kept for save compatibility, deliberately not shown anywhere.
   *
   * Nothing has ever read this for gameplay. `effectivePower`/
   * `effectiveTechnique` (app/star-dev/page.tsx) add the two fields below to
   * your skills before a match; there is no `effectivePace`, and the engine
   * reads `career.skills.pace` raw. So every boot's advertised pace rating
   * was a number that did nothing, and the shop was claiming otherwise.
   *
   * Removed from both places it was displayed (the boots table in Shop.tsx
   * and the current-boot line in DashboardStats.tsx) on 18 Sep 2026 rather
   * than wired up: making it real would change how every match plays for
   * every existing save and could disturb the finishing distributions that
   * were measured and tuned over many sessions.
   *
   * The field itself stays so that a boot stored in an existing save still
   * matches this type. **Don't put it back on screen without making it do
   * something first.**
   */
  pace: number;
  power: number;
  technique: number;
  matches: number;
  price: number;
  /** Grants the swipe-to-curve mid-flight correction (see applyCurveSwipe
   *  in canvasEngine.ts) for as long as this boot has matches left. */
  curve?: boolean;
  /** Grants Touch Mode — an in-match toggle that, once a kick is struck,
   *  has your own player chase the ball; if he reaches it before anything
   *  else happens, play pauses again for a fresh aim/kick from wherever it
   *  ended up. See CanvasMatch.tsx's own Touch Mode doc comment for the
   *  full mechanic. For as long as this boot has matches left, same as
   *  `curve` above. */
  extraTouch?: boolean;
}

export interface OwnedItem {
  id: string;
  name: string;
  /** Shop level 1-5 (lib/star/shopDefaults.ts, LIFESTYLE_LEVELS). Absent on
   *  an item bought before levels existed. */
  level?: number;
  /** The item this is a level of ("phone" for "phone-l4"). Absent means the
   *  id IS the base. */
  baseId?: string;
  category: "item" | "vehicle" | "property";
  price: number;
  /** Status — how much owning this adds to your fame (fame.ts). */
  lifestyleValue: number;
  /** Seasons left before it wears out. 0 = worn out (no fame until
   *  replaced). Absent = never wears (property, jewellery, or an item
   *  bought before wear existed). */
  seasonsLeft?: number;
}

export interface Girlfriend {
  name: string;
  happiness: number;
  gifts: number;
}

export interface SponsorDeal {
  category: string;
  active: boolean;
  /** What they want for the money. Absent on a deal signed before this existed. */
  objective?: {
    kind: "goals" | "assists" | "appearances" | "starMan" | "rating" | "goalStreak" | "startStreak" | "cleanSheets";
    target: number;
    progress: number;
    seasonsLeft: number;
    bonus: number;
    done: boolean;
  };
  /** How many times an objective for THIS deal has been completed — see
   *  `sponsorFee`'s own header. Starts at (and defaults to, for a deal
   *  signed before this existed) 1, the deal's original, unupgraded fee;
   *  each completed objective bumps it, permanently raising every future
   *  season's fee for this one deal. */
  level?: number;
  /** Seasons left on the deal itself. At 0 it ends and has to be re-earned
   *  (fame level + the brand's own requirement). One season, two for the
   *  top three brands. Absent on a deal signed before terms existed. */
  termLeft?: number;
}

export interface SeasonArchiveRow {
  season: number;
  club: string;
  apps: number;
  goals: number;
  assists: number;
  /** 0 when no rated appearance. */
  avgRating: number;
  /** Star Man awards — the game's man of the match. */
  motm: number;
}

/**
 * ONE FINISHED SEASON AS THE WORLD SAW IT — the retirement overview's "the
 * winners of every competition, every season you played" (Leo, 5 Oct 2026).
 *
 * `SeasonArchiveRow` above is YOUR numbers, and only for a season you played
 * in. This is everything around them, written for every season whether you
 * played or not: where your club finished, who won what, the Ballon d'Or,
 * and where you stood when it ended (the career arc). Pushed once at the
 * rollover (careerRecords.ts `historyRowFor`, called from advanceSeason).
 * A save from before it has none, and starts recording from then — nothing
 * here can be rebuilt afterwards, which is why it is written every season.
 */
/**
 * ONE OF A SEASON'S BEST TEAM-MATES — kept on that season's history row, so a
 * farewell match years later still has real names (Leo, 6 Oct 2026: the
 * farewell match's "Your XI"). Three to five a season, picked by
 * careerRecords.ts `bestMatesOf`: the top scorer, the top creator, and the
 * best keeper, defender and midfielder, so a whole side can be drawn from them.
 */
export interface SeasonMate {
  /** The squad id ("sf_…" for a real footballer). */
  id: string;
  name: string;
  position: SquadPlayer["position"];
  overall?: number;
  /** His photo, when the squad had one. */
  face?: string;
  /** That season, for your club. */
  goals: number;
  assists: number;
}

/**
 * THE FAREWELL MATCH (Leo, 6 Oct 2026) — one last match after the final
 * whistle of a career: your best team-mates against your rivals. It counts in
 * nothing (no stats, no records); this is its own line on the career overview.
 */
export interface FarewellRecord {
  /** False when it was turned down ("Skip"). */
  played: boolean;
  /** The club that put it on (the testimonial club). */
  club: string;
  /** Your side's name, e.g. "Calloway XI". */
  team?: string;
  /** The other side's name, e.g. "Rivals XI". */
  opponent: string;
  /** The score, your side first. */
  yourScore?: number;
  theirScore?: number;
  goals?: number;
  assists?: number;
  rating?: number;
  /** The minute you came off to the ovation. */
  offAt?: number;
}

export interface SeasonHistoryRow {
  season: number;
  age: number;
  club: string;
  division: import("./calendar").CareerDivision;
  /** Your club's final place, out of `teams`. */
  position: number;
  teams: number;
  /** Up or down at the end of it (null: stayed). */
  move?: "promoted" | "relegated" | null;
  /** Who won what. `league` is the division you played in. Europe only when
   *  you were in the Premier League or in that competition yourself. */
  winners: {
    league?: string; faCup?: string; leagueCup?: string;
    championsLeague?: string; europaLeague?: string;
  };
  /** The Ballon d'Or: the winner, and your place on the shortlist (0 = not on it). */
  ballonDor?: { winner: string; club: string; yourRank: number };
  /** Where you stood when it ended. */
  stars?: number;
  overall: number;
  fame: number;
  money: number;
  wage: number;
  caps: number;
  intlGoals: number;
  /** That season's best team-mates (see SeasonMate). Absent before 6 Oct 2026. */
  mates?: SeasonMate[];
}

export interface CareerBests {
  /** Metres, and when. */
  furthestGoal?: { metres: number; season: number; opponent: string };
  furthestAssist?: { metres: number; season: number; opponent: string };
  mostGoalsMatch?: { goals: number; season: number; opponent: string };
  mostGoalsSeason?: { goals: number; season: number };
  mostAssistsSeason?: { assists: number; season: number };
}

export interface Trophy {
  season: number;
  competition: string;
  club: string;
}

export interface Horse {
  name: string;
  breed: string;
  speed: number;    // 40-95 rating — top-end pace
  stamina: number;  // 40-95 rating — holds form to the line
  energy: number;   // 0-100, spent racing, regained between matches
  racesRun: number;
  racesWon: number;
  earnings: number; // lifetime prize money won
}

/** See CareerState.unlocks and lib/star/unlocks.ts. */
export interface CareerUnlocks {
  /** Features open so far: "league", "stats", "play", "shop", "achievements", "relations", "phone", "sponsors". */
  open: string[];
  /** One-off screens already shown: "tutorial", "drills-msg", "league-intro", "shop-intro", pop-ups. */
  seen: string[];
  /** Training drills finished since the career began (the chain needs 2). */
  drills: number;
  /** Star points when the chain began, for "your star rating went up by X from training". */
  pointsAtStart: number;
  /** Star rating when the chain began (same reason). */
  starsAtStart?: number;
  /** Phone apps installed from the App Store. */
  apps: string[];
  /** Features opened but not yet announced (v0.24: "the moment ANY feature
   *  unlocks … it is announced"). lib/star/unlocks.ts. */
  announce?: string[];
  /** The bottom-left button, once the first steps are done and the player
   *  has answered "switch this to League?" (v0.24, P2-89). */
  slot?: "achievements" | "league";
  /** v0.25 (Harry and Mikey, 2 Oct 2026): the game comes first. A career
   *  started from v0.25 has this set: League and Play open at once, Training
   *  after the first game, Relations after the manager's talk, the Shop by
   *  about game 3. Absent = the v0.24 order (a save part-way through it). */
  gameFirst?: boolean;
}

export interface CareerState {
  version: 2;
  player: StarPlayer;
  /**
   * The trial this career opened with, while it is being played.
   *
   * Optional, and absent for every career that already exists — a save from
   * before the multi-stage trial simply never had one, which is exactly what
   * "this career is not mid-trial" means, so no backfill is needed.
   *
   * Typed as `TrialProgress` from lib/star/trial.ts. Declared here rather than
   * imported to keep this file free of imports from the modules that read it.
   */
  trial?: import("./trial").TrialProgress;
  /**
   * Weeks spent with no club since the last trial.
   *
   * Drives when the next one comes up — see `trialDue`/`grantTrial`
   * (freeAgent.ts). Absent on every career that has never been a free agent,
   * which is all of them until one fails a trial.
   */
  weeksSinceTrial?: number;
  /**
   * How many weeks this career spent with no club at all, across every spell
   * of it — the garden weeks.
   *
   * `career.week` restarts at 1 when a club signs you (`attachClub`), because
   * the fixture list it builds starts there and transfer windows, Player of
   * the Month, deadline day and the competition-betting cutoff all read the
   * raw week. Without that reset a player who failed a trial, sat out twelve
   * weeks and then signed got the January window while his fixtures said
   * October. This is where those weeks go, so they still happened for the CV
   * rather than being silently deleted.
   *
   * Absent on every career that has never been out of work, which is all of
   * them until one fails a trial.
   */
  gardenWeeks?: number;
  /**
   * How many trials this career has been given, including the one it opened
   * with.
   *
   * Anything above 1 is a second look earned back from the free-agent life
   * (`grantTrial`, freeAgent.ts), and the scout offers it produces are judged
   * against a lower bar and a ladder shifted a rung down — see `ScoutContext`
   * in scoutOffers.ts. Absent on a career that has only ever had its first,
   * which reads as exactly that.
   */
  trialsTaken?: number;
  /**
   * Where you are when you are at a club but not in its first team — the
   * youth team, the reserves, or out on loan.
   *
   * Absent for every career that already exists and for every player who is
   * simply in the side, which is the overwhelming majority: absent means
   * "you are a first-team player of the club whose badge you are wearing",
   * and that is exactly what every save written before this field existed
   * meant. No backfill is needed.
   *
   * Typed as `Placement` from lib/star/youth.ts, declared rather than
   * imported for the same reason `trial` above is.
   */
  placement?: import("./youth").Placement;
  /**
   * The wage actually agreed face to face with a manager, and who it was
   * agreed with.
   *
   * Written the moment a wage negotiation closes (see lib/star/signingTalk.ts)
   * and read by the offers screen, so the number on that club's card is the
   * one you haggled for rather than the one they opened at. Lives on the
   * career rather than in React state so that closing the app between the
   * handshake and the signature does not quietly undo the negotiation.
   *
   * Cleared the moment a club is actually signed for. Absent on every career
   * that has not just negotiated one.
   */
  agreedTerms?: { club: string; wage: number;
    /** The talks broke down: the club came back with a worse, final offer
     *  instead of walking away (Mikey, 1 Oct 2026). */
    soured?: boolean };
  skills: Skills;
  /**
   * The last career week each skill was actually TRAINED (the deliberate
   * minigame action, not a passing match-performance nudge) — what
   * `decaySkills` (careerFlow.ts) reads to decide who's overdue. Requested
   * directly: "if you haven't trained any of your attributes... every few
   * months... you have a chance of downgrading them by a point or two...
   * so you have to go and play and earn the points back." Optional so a
   * save from before this existed backfills cleanly (storage.ts) rather
   * than reading every skill as already overdue on the very next match.
   */
  lastTrainedWeek?: Partial<Record<keyof Skills, number>>;
  /** Stars per training level (30 per skill, 0-3 each) — see
   *  lib/star/trainingLevels.ts. Missing on an old save: worked out from the
   *  skill's number the first time it's needed. */
  trainingStars?: Partial<Record<keyof Skills, number[]>>;
  /** Whether you've won your shirt at this club (lib/star/selection.ts,
   *  shirtWon). `apps` counts your appearances here. Absent on an old save:
   *  a player who has already been playing keeps his place. */
  shirt?: { club: string; won: boolean; apps: number };
  relationships: Relationships;
  reputation: Reputation;
  /** The last season you were caught up in a scandal (a scandal dilemma
   *  choice, or getting caught cheating). A season without one earns a
   *  little reputation — see seasonStanding.ts. */
  lastScandalSeason?: number;
  /** Why fame and reputation moved at the last season rollover. */
  fameNews?: string[];
  contract: Contract;
  season: number;
  /**
   * Which division this season is being played in.
   *
   * Optional, and absent means the Premier League — every career saved
   * before the Championship existed was one, and `divisionOf` below is the
   * only thing that should ever read this field directly so that stays true
   * in one place rather than twenty. Changes at a season rollover when your
   * club is promoted or relegated; never mid-season.
   */
  division?: import("./calendar").CareerDivision;
  /**
   * Who is in each division, and in the pool below them, right now.
   *
   * Kept on the career because it changes: the lists in lib/star/clubs.ts
   * are this season's, and a save three seasons deep has moved on from
   * them. Absent means a career that predates promotion and relegation —
   * one whose divisions still ARE those lists. See lib/star/promotion.
   */
  divisions?: {
    premier: string[]; championship: string[];
    /** See lib/star/promotion.ts's DivisionMembership — three tiers below
     *  the Championship, extended 17 September 2026. Optional, still: an
     *  OLD save's `divisions` object genuinely only has premier/championship
     *  (and an old `pool` field this type no longer names, harmlessly
     *  ignored) — `membershipOf` fills all four of these in fresh from
     *  clubs.ts's season-1 lists the first time such a save rolls over. */
    leagueOne?: string[]; leagueTwo?: string[];
    nationalLeague?: string[];
    /** The two regional divisions under the National League (P62, 1 Oct 2026). */
    nationalLeagueNorth?: string[]; nationalLeagueSouth?: string[];
    /** Step 3: four clubs waiting below each region (2 Oct 2026). */
    step3North?: string[]; step3South?: string[];
  };
  /**
   * The Championship play-offs, once your club has reached them.
   *
   * Only ever set in a Championship season, and only when you finished third
   * to sixth — everybody else's play-offs are simulated at the rollover and
   * never need state. See lib/star/playoffs.
   */
  playOffState?: import("./playoffs").PlayOffState;
  /** What went up and down at the last rollover, for the screen that says so. */
  ladderNews?: {
    yourMove: "promoted" | "relegated" | null;
    promotedToPremier: string[];
    relegatedFromPremier: string[];
    promotedToChampionship: string[];
    relegatedFromChampionship: string[];
    /** Added 18 September 2026 alongside League One/Two/National League
     *  becoming playable divisions — optional so an old save's ladderNews
     *  (from before this existed) still reads fine with these simply absent. */
    promotedToLeagueOne?: string[];
    relegatedFromLeagueOne?: string[];
    promotedToLeagueTwo?: string[];
    relegatedFromLeagueTwo?: string[];
    promotedToNationalLeague?: string[];
    relegatedFromNationalLeague?: string[];
    /** The National League's relegated clubs, by which region they went to. */
    relegatedToNorth?: string[];
    relegatedToSouth?: string[];
    playOffFinal?: { home: string; away: string; hs: number; as: number; winner: string };
  };
  week: number;
  matchFitness: number;
  /**
   * How much you have left in the tank — spent by playing, given back by a
   * deliberate choice (Rest, or skipping the rest of the week) OR by simply
   * leaving an action unspent, never by the week turning over on its own
   * regardless of what was done with it. That last part is the whole point:
   * energy was cut once already because an automatic weekly top-up made it
   * nothing but a number that went down and then back up on its own — the
   * fix here is narrower than that: reported directly, a week where you
   * trained or worked on a relationship instead of resting cost the SAME
   * energy as a week you never touched at all, since only an explicit Rest
   * press ever gave anything back. `creditMatchResult` (careerFlow.ts) now
   * credits `REST_ENERGY` for every one of the week's actions still unspent
   * the moment the next match kicks off, so choosing to train or build a
   * relationship still trades that specific action away — the choice is
   * real — but doing nothing with an action is never worse than resting
   * with it. See lib/star/selection.ts (the two gates it enforces on team
   * selection) and lib/star/week.ts (Rest/Skip, the two ways to spend an
   * action ON energy specifically rather than leave it to be credited this
   * way).
   */
  energy: number;
  /**
   * How you play in a match: drop deep, stay balanced, or stay up top
   * (v0.26, Harry). Chosen on the match screen next to the energy mode and
   * kept from match to match. Absent on an old save reads as "balanced".
   * See hiddenMatch.ts's MatchContext.
   */
  playstyle?: Playstyle;
  /**
   * Set the moment a match-fatigue roll goes against you (creditMatchResult),
   * cleared the moment `weeksRemaining` counts down to it. While this is
   * set, `selectionFor` returns "Injured" unconditionally — energy and form
   * stop mattering, you simply cannot be selected. See lib/star/selection.ts.
   */
  injury: { weeksRemaining: number; note: string } | null;
  happiness: number;
  /** Fractions of a relationship point not yet shown (relationships.ts). */
  relCarry?: Partial<Record<"boss" | "team" | "fans", number>>;
  /** Which relationship games have been played this week (each once a week). */
  relGamesPlayed?: { season: number; week: number; kinds: string[] };
  money: number;
  starRating: number;
  fame: number;
  seasonStats: SeasonStats;
  careerStats: SeasonStats;
  fixtures: Fixture[];
  league: LeagueTeam[];
  achievements: string[];
  status: "1st Team" | "Substitute" | "Squad" | "Injured";
  currentBoot: Boot;
  /** Owned energy drinks, bought from the shop — see lib/star/shopData.ts's
   *  KIB_CANS. A can is spent to top up `energy` on demand, from the
   *  dashboard's own KIB Cans card — a second lever on top of Rest/Skip to
   *  Match Day, not a replacement for either. */
  kibCans: { basic: number; premium: number; elite: number };
  /**
   * A boot ability bought with a Premium (curve) or Elite (Touch Mode) KIB can,
   * waiting for the next match you actually play. Cleared the moment that
   * match is credited; a week on the bench or in the stands keeps it.
   * Optional: absent on every older save, which reads as nothing active.
   */
  kibAbility?: { curve?: boolean; extraTouch?: boolean };
  /**
   * The unlock chain a NEW career walks through (Harry, 1 Oct 2026, P13-P40):
   * Home and Training open, everything else locked until it is earned.
   * Absent on every save from before it, which reads as everything open —
   * see lib/star/unlocks.ts.
   */
  unlocks?: CareerUnlocks;
  /** Set-piece duties the manager has already told you about, once each (v0.23, P78). */
  setPieceTold?: ("penalties" | "freeKicks")[];
  /** How many matches you had played when the manager last gave a set-piece chat, so the next one waits for a later match (P86). */
  setPieceTalkAt?: number;
  /**
   * The run-ups you take (lib/star/runupStyles.ts) — two separate sets, one
   * for penalties and one for direct free kicks. Looks only, never who
   * scores. Absent on older saves: each set's Standard. Read them through
   * careerPenaltyRunup / careerFreeKickRunup.
   */
  penaltyRunup?: PenaltyRunupId;
  freeKickRunup?: FreeKickRunupId;
  /** @deprecated the first build's penalty run-up field — read as
   *  `penaltyRunup` when that isn't set (storage.ts moves it across). */
  runupStyle?: PenaltyRunupId;
  /** Animation ids you own (the shop's Animations), from both sets — the ids
   *  are unique across them. Each set's Standard always counts as owned,
   *  listed or not. Absent on older saves: none bought yet. */
  ownedAnimations?: string[];
  /** Star Pass levels whose reward has been claimed (lib/star/starPassClaim.ts). */
  starPassClaimed?: number[];
  /** Collectible reward cards you own (rewardCatalogue.ts ids: a car, a ball,
   *  sunglasses …), kept in the Locker. Run-ups and accessories you win go
   *  into ownedAnimations / ownedAccessories instead. */
  ownedRewards?: string[];
  /** Collectible slot → the card used there (one sunglasses, one ball …). */
  equippedRewards?: Record<string, string>;
  // ── The Store (lib/star/store/career.ts, 28 Sep 2026). All optional:
  //    an older save reads as none of each (storage.ts backfills coins). ──
  /** Coins — the store's second currency. 50 Coins = one week of your wage.
   *  Only ever added by a test-mode pack or a dev top-up; no payment code. */
  coins?: number;
  /** Store accessory ids you own (headband, sleeves, boots colour, …). */
  ownedAccessories?: string[];
  /** Accessory slot → the accessory id worn there. On the store's figure
   *  only for now, not yet on the match figure. */
  equippedAccessories?: Record<string, string>;
  /** Date key → daily-special ids already bought at the discount that day. */
  storeSpecialsBought?: Record<string, string[]>;
  /** The store's "first Coin pack: double" offer has been used. */
  storeFirstPackBought?: boolean;
  /** The store's receipts, newest first (kept to 30). */
  storeLog?: { at: number; what: string }[];
  ownedItems: OwnedItem[];
  girlfriend: Girlfriend | null;
  sponsors: SponsorDeal[];
  trophies: Trophy[];
  form: number[];
  /** Item 24 (v0.15): your last five REAL ratings (never pulled toward 6.5
   *  for a cameo) — what winning the shirt is judged on. Absent on older
   *  saves, which fall back to `form`. */
  rawForm?: number[];
  kitPrimary: string;
  kitSecondary: string;
  homeCity: string;
  seenDilemmas: string[];
  ballonDorWins: number;
  horse: Horse | null;
  squad: SquadPlayer[];
  // Mid-season contract offer tracking (optional for backward-compat with saved careers)
  contractStarMilestones?: number[]; // star thresholds that have already triggered an early offer
  contractFormOfferSeason?: number;  // season when the last form-based early offer fired (-1 = never)
  // ── Cups, Europe and the national team. All optional so a career saved before
  //    they existed still loads; they fill in at the next season rollover. ──
  cups?: CupRun[];
  /** Earned by LAST season's finish, played THIS season. */
  europeanQualification?: Competition | null;
  caps?: number;
  internationalGoals?: number;
  /** What the last knockout tie did to the run, for the post-match screen. */
  knockoutMessage?: string | null;
  /**
   * Every league result this season, yours included — the ten games a week that
   * the table is built from. Cleared at the rollover; absent on a career saved
   * before the division had a real schedule, which simply has no results to show
   * until its next match.
   */
  results?: LeagueResult[];
  /**
   * The two domestic cups, as thirty-two-club draws.
   *
   * Kept beside `cups`, which is the old counter-style run and still carries
   * Europe and international tournaments. These two are the real thing: a hat, a
   * draw every round, and every tie in the country played.
   */
  cupState?: import("./cups").CupState[];
  /**
   * This season's European campaign: the field, your eight league-phase games,
   * the table they produce and the knockout that follows.
   *
   * Absent when you did not qualify, which is most careers most seasons. See
   * lib/star/euro.
   */
  euroState?: import("./euro").EuroState;
  /**
   * Goals and assists in the LEAGUE only.
   *
   * The Golden Boot and the Assist King are league competitions — a hat-trick in
   * the FA Cup does not count towards either, and never has. `seasonStats` is
   * everything you did, which is what your own club record should be; this is
   * the subset the charts are allowed to read.
   */
  leagueSeasonStats?: { goals: number; assists: number };
  /**
   * The same goals/assists tally, plus appearances, but never reset at a
   * season rollover — league-only, same as `leagueSeasonStats`, so it is the
   * one the CAREER-scoped entries in the Records tab (lib/star/records.ts)
   * read directly, with no rollover snapshot needed. Absent on a career saved
   * before Records existed; reads as zero.
   */
  careerLeagueStats?: { goals: number; assists: number; appearances: number };
  /**
   * Your best-ever showing against each entry in the Records tab, keyed by
   * `RecordDef.id` — see lib/star/records.ts.
   *
   * `leagueSeasonStats` (above) is wiped every rollover; a real record is
   * measured against your best SEASON EVER, not just the one in progress, so
   * `advanceSeason` folds that season's number in here (taking the higher of
   * the two) right before it resets. Absent on a career saved before Records
   * existed, or one that has never had a qualifying season yet — reads as 0.
   */
  personalBests?: Record<string, number>;
  /**
   * Your record against every club you have faced, keyed by opponent name —
   * built up match by match as a real career would remember it, never reset
   * at a season rollover. Covers every club fixture (league and cup alike),
   * not internationals — a head-to-head is a rivalry with a CLUB. Read by
   * the scout report (lib/star/scoutReport.ts); absent on a career saved
   * before it existed, or against a club never yet played, reads as no
   * history rather than a clean 0-0-0.
   */
  headToHead?: Record<string, { wins: number; draws: number; losses: number }>;
  /**
   * The other clubs' players, and what they have done this season.
   *
   * Absent on a career saved before the division had squads — the Golden Boot
   * falls back to the old invented race until the next rollover fills it in.
   */
  leagueSquads?: LeagueSquad[];
  /**
   * Whoever is currently out of contract — real players, signable by any
   * club including your own, not tied to any of the `leagueSquads` entries.
   * See lib/star/leagueSquads.ts's `fetchFreeAgents` and the "Free Agents"
   * handling in `runTransferWindow`. Depletes as they get signed over the
   * career; refreshed the same way `leagueSquads` is.
   */
  freeAgents?: LeaguePlayer[];
  /**
   * Every club this career has real squad data for but does NOT play in its
   * own division — Champions League, Europa League, and the "Other"/
   * promotion-pool tabs the Lineups screen already offers (see
   * lib/star/clubs.ts). Requested directly: transfer activity only ever
   * touched the player's own twenty clubs plus free agents, so a Real Madrid
   * or a Barcelona could never sell to — or buy from — the division at all.
   * `runInternationalWindow` (leagueTransfers.ts) is the only thing that
   * reads or writes this; absent on a career created before it existed, or
   * one whose fetch simply hasn't landed yet, in which case that pass is a
   * no-op rather than an error.
   */
  externalSquads?: LeagueSquad[];
  /** Things you can still do before the next match. Refills every week. */
  weekActions?: number;
  /**
   * Training sessions left this week (absent = the full 2). Refilled only
   * after a SATURDAY match, so a Saturday-Wednesday-Saturday week still has
   * just 2 between them (Mikey, 29 Sep 2026). See week.ts.
   */
  trainingSessions?: number;
  /**
   * Asked to play somewhere other than your real position — set on the
   * matchday screen (`PositionPicker.tsx`) and applies to every match from
   * then on, not just the next one, until you change it again or pick your
   * real position. `null`/absent means your real position.
   */
  playAs?: SquadPlayer["position"] | null;
  /** Every move you made, for the legacy screen. */
  transfers?: { season: number; from: string; to: string; fee: number; /** The wage at the club left (see TransferRecord, transfers.ts). */ fromWage?: number }[];
  /** Hung up. The career is over and only the legacy screen remains. */
  retired?: boolean;
  /** How the board saw last season. Shown on the dashboard. */
  lastSeasonJudgement?: { score: number; bossChange: number; headline: string; detail: string };
  /**
   * The Golden Boot, the Assist King, a Golden Glove, Player/Young Player
   * of the Season and a Team of the Season — computed once, in `endSeason`
   * (app/star-dev/page.tsx), from the season's stats BEFORE `advanceSeason`
   * wipes them. See lib/star/seasonAwards.ts for why the trophy winners
   * themselves are deliberately NOT part of this snapshot.
   */
  lastSeasonAwardStats?: import("./seasonAwards").SeasonAwardStats;
  /** Records broken so far this season, one per record (the latest mark).
   *  Mikey, 6 Oct 2026: records no longer pop up after every match ("in your
   *  first season every goal or assist is a new record"); they are listed
   *  once, on the season round-up. See lib/star/earnPops.ts. */
  seasonRecords?: { label: string; unlocked: string }[];
  /** Last season's `seasonRecords`, shown on the Season Awards screen. */
  lastSeasonRecords?: { label: string; unlocked: string }[];
  /**
   * Where the club finished last season, 1-based.
   *
   * Needed by the European draw, which seeds you into one of four pots off it —
   * and by the time the draw happens the table has already been reset, so it
   * cannot be read back off `league`.
   */
  lastSeasonPosition?: number;
  /**
   * Who actually won each competition last season — league, both domestic
   * cups, and both European ones — whether or not it was this club.
   *
   * Needed for the same reason as `lastSeasonPosition`: by the time the
   * Community Shield / Super Cup fixtures are seeded, `league`/`cupState`/
   * `euroState` have already been reset for the new season, so this is the
   * only place last season's real winners survive to be read back. Absent on
   * a career saved before this existed, or before season 1 has finished.
   */
  lastSeasonWinners?: {
    league?: string;
    /** Only needed for the Community Shield's Double case — see seedPreSeason. */
    leagueRunnerUp?: string;
    faCup?: string;
    leagueCup?: string;
    championsLeague?: string;
    europaLeague?: string;
  };
  /**
   * Every Player of the Month awarded, this season and the ones before it.
   *
   * Kept whole rather than as a line of text, because the awards screen shows
   * the shortlist and where you finished on it — which is most of the point when
   * you did not win.
   */
  potm?: import("./potm").MonthAward[];
  /**
   * PROTOTYPE (home-screen proto, 27 Sep 2026) — the Stats page's "All seasons"
   * and "Records" tabs. One row per finished season, pushed by advanceSeason.
   * Absent on a save from before it: history starts counting from then.
   */
  seasonArchive?: SeasonArchiveRow[];
  /** Every finished season around you: table, winners, Ballon d'Or, your
   *  standing (see SeasonHistoryRow). Absent on a save from before 5 Oct 2026. */
  seasonHistory?: SeasonHistoryRow[];
  /** Your own personal bests across every match, updated by creditMatchResult. */
  careerBests?: CareerBests;
  /** The club this season's club appearances were made for — so a summer
   *  transfer at the rollover still files the season under the right club. */
  thisSeasonClub?: string;
  /** Individual honours. The Ballon d'Or was the only one that existed. */
  awards?: { season: number; kind: string; week?: number; detail: string;
    /** The division it was won in (starPoints.ts pays more the higher it is). */
    division?: import("./calendar").CareerDivision }[];
  /**
   * THE STAR RATING players see: your career, 1-100 (a run of poor matches can take a level off — starPoints.ts 2c)
   * (lib/star/starPoints.ts). `starRating` above is your ABILITY on the old
   * 1-5 scale and is shown as "Overall"; everything that read it still does.
   */
  /** Sponsors: your deals, the offers on your phone, and their news (lib/star/sponsorDeals.ts). */
  brands?: import("./sponsorDeals").BrandsState;
  stars?: number;
  /** What the star rating needs remembering (matches by division, etc.). */
  starLedger?: import("./starPoints").StarLedger;
  /** High-water marks, so the star rating can never drop. */
  starBest?: import("./starPoints").StarBest;
  /** Wearing the armband at your current club. */
  captain?: boolean;
  /** The armband was just earned (careerFlow) and the manager hasn't told you
   *  yet: his "you're my captain" moment on Home (lib/star/managerMoments.ts).
   *  Cleared when seen. Never set by the owner path (appointSelfCaptain). */
  captainMomentPending?: boolean;
  /** What the manager picked you as for your last club match ("1st Team" =
   *  you started it), and whether you have missed matches injured since.
   *  Drives the "dropped to the bench" moment (lib/star/managerMoments.ts).
   *  Absent on old saves: no moment until a match has been recorded. */
  lastPick?: { status: "1st Team" | "Substitute" | "Squad"; injuredSince?: boolean };
  /** The fixture key (managerMoments.ts fixtureMomentKey) whose bench moment
   *  has been seen, so it shows once even if you go Back and Play again. */
  benchMomentSeen?: string;
  /** The number on your back. Reassigned when you sign for someone. */
  squadNumber?: number;
  /** Appearances at the CURRENT club, reset on a transfer. */
  clubAppearances?: number;
  /** The man in the job. He can be sacked, and the next one has never picked you. */
  manager?: {
    name: string; style: "trusting" | "demanding" | "rotational"; since: number; arrival: string;
    /** 0-100, his own standing as a free agent — see manager.ts's reputationTier. */
    reputation: number;
    /** Set only for a real name drawn from managerPool.ts — see manager.ts's Manager type. */
    poolTier?: "dream" | 1 | 2 | 3;
  };
  /**
   * What happened in the dugout at the end of last season.
   *
   * Persisted, and only ever cleared two ways: the player dismissing the
   * dashboard banner it drives (app/star-dev/page.tsx), or the NEXT sacking
   * overwriting it wholesale at the following rollover. Reported directly:
   * before the dismiss button existed, a sacking's news sat on the
   * dashboard for the rest of that entire season — every match played,
   * every tap of the Home tab — because nothing else ever nulled it out.
   */
  managerNews?: string | null;
  /**
   * Real-world managers (managerPool.ts) currently without a club, from
   * YOUR club's point of view — every named manager except whoever is
   * presently in your own dugout. Shrinks by one name when he's hired,
   * grows back by one the moment he's sacked. No other club in the league
   * is simulated well enough to hire or fire anyone, so this is the only
   * "unemployed" that needs tracking.
   */
  availableManagers?: string[];
  /**
   * Requested directly: "you either have to get the deal done right there,
   * or... you should have to wait until the next beginning of the season" —
   * a failed manager negotiation (rejected, walked away by either side)
   * shouldn't be retriable immediately for the SAME club/manager pairing.
   * Keyed by `${club}::${managerName}`, value is the season he's willing to
   * talk again — checked in managerPool.ts's `managerInterest`. Doesn't
   * block negotiating with a DIFFERENT manager for the same club, or the
   * same manager for a DIFFERENT club.
   */
  managerNegotiationCooldowns?: Record<string, number>;
  /** Real stakes owned in real clubs — see lib/star/investments.ts for the
   *  valuation model and the buy/sell math; nothing here is read anywhere
   *  else in the engine except that file itself. */
  investments?: import("./investments").ClubStake[];
  /** Set only for a club you hold a MAJORITY stake in (see
   *  investments.ts's MAJORITY_THRESHOLD) — its own transfer budget and,
   *  once appointed, a real manager name. Survives selling back below
   *  majority (a chairman selling down doesn't erase what the club already
   *  spent), just stops being reachable from the Boardroom until you buy
   *  back in. */
  ownedClubs?: Record<string, import("./investments").OwnedClubState>;
  /**
   * A lineup override for a club the player owns, scoped to THIS SAVE ONLY —
   * never the shared, global `lineupStore.ts` store every other save (and
   * every other club's own opponents) also reads.
   *
   * The Boardroom's "Edit Lineup" tool (Investments.tsx's PowersPanel, gated
   * the same way every other real club-decision power there is — majority
   * ownership, `isMajorityOwner`) writes here, not to `saveLineup`. A
   * previous pass linked straight into `/lineups` — the GLOBAL template
   * editor every save starts from — and was corrected directly: editing a
   * club's matchday XI from inside one save's Boardroom must never be able
   * to corrupt the template every other save also reads. This field is the
   * real fix — the exact same `SavedLineup` shape, just living on the
   * career instead of in localStorage/the shared table.
   *
   * `teamsheet.ts`'s `resolveLineupFor` checks this FIRST for any club with
   * an entry here, falling back to the existing global `loadLineup(club)`/
   * auto-pick chain exactly as before when there is none — so a club this
   * save has never touched behaves byte-identically to today.
   */
  ownedLineups?: Record<string, import("./lineupStore").SavedLineup>;
  /** Every real transfer an owned club has done through the Boardroom — one
   *  entry per completed sign/sell, newest first. Requested directly: with
   *  real negotiated fees now varying (negotiation.ts), there was no way to
   *  tell whether a signing had turned out to be a bargain or an overpay, or
   *  what a player had actually cost versus what he later sold for. Keyed by
   *  club so a chairman of several clubs sees each club's own real ledger.
   *  See lib/star/investments.ts's `ClubTransferRecord`/`recordClubTransfer`. */
  clubTransferHistory?: Record<string, import("./investments").ClubTransferRecord[]>;
  /** Phase 3 of STAR_POWER_POLITICS.md — a minority shareholder's real, if
   *  non-binding, suggestions to a board they don't control. See
   *  lib/star/clubPowers.ts. */
  recommendations?: import("./clubPowers").Recommendation[];
  /** Every club's real kit design, once you've either set one directly or a
   *  public kit vote has settled one — absent means "the game's default
   *  kit," same as absent formation means "whatever autoPick already
   *  chooses." See lib/star/clubPowers.ts. */
  clubKits?: Record<string, import("./clubPowers").ClubKit>;
  /** §4.5 of STAR_POWER_POLITICS.md — the one deliberately-fictional,
   *  magically-aged "son" mechanic (a potion/magic effect on a game
   *  character, not a real depiction of doping a real child — see that
   *  section's own note). Null until you have one. See clubPowers.ts. */
  son?: import("./clubPowers").SonState | null;
  /** Phase 4 of STAR_POWER_POLITICS.md — real influence bought in a real
   *  governing body, priced flat (there's no club-sized asset to value a
   *  share of). See lib/star/governingBodies.ts. */
  governingBodyInfluence?: Partial<Record<import("./governingBodies").GoverningBody, number>>;
  /** Every governing body's own active Rule Book, once changed from the
   *  classic default — absent for a body means DEFAULT_RULE_BOOK. Only the
   *  FA's entry actually reaches anything this career plays, for now — see
   *  ruleBook.ts's own header. */
  ruleBook?: Partial<Record<import("./governingBodies").GoverningBody, import("./ruleBook").RuleBook>>;
  /** Phase 6 of STAR_POWER_POLITICS.md, rule §4.4 #10 — a club forced out
   *  of the Championship by governing-body fiat (see
   *  lib/star/forcedMovement.ts), waiting to re-enter next season's
   *  promotion pool at `resolveLadder`'s own next run. Absent/empty is the
   *  ordinary case. */
  limboClubs?: string[];
  /** Phase 6 of STAR_POWER_POLITICS.md, rule §4.4 #12 — every new
   *  competition a governing body has created, resolved statistically.
   *  See lib/star/newCompetition.ts. */
  newCompetitions?: import("./newCompetition").NewCompetitionState[];
  /** Phase 7 of STAR_POWER_POLITICS.md, §6 — every club's own stadium,
   *  training ground and youth academy. Absent for a club means it's never
   *  been touched — `facilitiesFor` generates a real, deterministic
   *  default from the club's own name rather than leaving it undefined.
   *  See lib/star/facilities.ts. */
  facilities?: Record<string, import("./facilities").ClubFacilities>;
  /** Requested directly, 14 Sep 2026: a benched player who's genuinely
   *  better than the man ahead of him doesn't take the shirt instantly —
   *  the incumbent gets a real, rating-gap-sized grace period first. One
   *  record per (club, formation role) actually being contested; absent
   *  entirely for a role nobody's challenging. See lib/star/incumbency.ts. */
  incumbents?: import("./incumbency").IncumbencyRecord[];
  /** §5's end-game power fantasy, previously cut for having no concrete
   *  mechanic — see lib/star/leadership.ts. Every governing body you've
   *  actually been elected (or forced your way into) the presidency of. */
  governingBodyPresidencies?: import("./governingBodies").GoverningBody[];
  /**
   * The casino's book — real money staked on who wins a real competition,
   * priced off real club strengths (see lib/star/competitionBetting.ts).
   * Settled inside `advanceSeason`, against the exact same
   * `resolveSeasonWinners` result the trophy cabinet and the Ballon d'Or
   * race already agree on, then removed — a bet never lingers past the
   * season it was placed in settling.
   */
  competitionBets?: import("./competitionBetting").CompetitionBet[];
  /** One line per bet settled at the last rollover — win or lose — for the
   *  dashboard, same "read once, gone next season" shape as `sponsorNews`. */
  betNews?: string[];
  /** Sponsor objectives settled at the last rollover, for the dashboard. */
  sponsorNews?: string[];
  /**
   * Your last few goals, in enough detail to watch each one happen again —
   * see GoalReplay. Newest first, capped (see RECENT_GOALS_MAX in
   * careerFlow.ts) — not a full career highlight reel, just enough of a
   * pool to pick a couple of favourites from. Currently surfaced only in
   * Settings' admin-only "Goal Replays" section, for testing.
   */
  recentGoals?: GoalReplay[];
  /**
   * Up to 3 goals deliberately kept from `recentGoals` — a real choice, not
   * everything you've ever scored. Decoupled from `recentGoals`'s own churn
   * (a saved one survives falling out of the recent pool) rather than a
   * list of ids into it, which would dangle the moment it did.
   */
  savedReplays?: GoalReplay[];
  /**
   * What the rest of the division did with itself, the moment a transfer
   * window last opened. Replaced whole by the next window, never appended —
   * this is "what just happened", not a transfer history. See
   * lib/star/leagueTransfers; import("./leagueTransfers").TransferMove kept
   * as a structural type here rather than imported, so this file does not
   * have to depend on the module that reads it.
   */
  leagueTransferNews?: {
    player: string; from: string; to: string; overall: number; fee: number; unhappy: boolean;
    position: import("./formations").Role; age?: number; imageUrl?: string;
  }[];
  /** Same "what just happened, replaced whole" shape as leagueTransferNews,
   *  for loan moves specifically. See lib/star/leagueTransfers. */
  leagueLoanNews?: {
    player: string; playerId: string; parentClub: string; loanClub: string;
    overall: number; returnSeason: number;
    position: import("./formations").Role; age?: number; imageUrl?: string;
  }[];
  /**
   * Everybody currently out on loan, whoever's business it was — yours
   * included. Not "news", unlike the two above: this is live state a loan's
   * return (`returnLoansHome`, called at every season rollover) has to read
   * back, so it is kept and updated rather than replaced each window.
   */
  activeLoans?: {
    player: string; playerId: string; parentClub: string; loanClub: string;
    overall: number; returnSeason: number;
    position: import("./formations").Role; age?: number; imageUrl?: string;
  }[];
  /**
   * `"<season>-<summer|january>"` of the last window actually run, so a
   * replayed week — the exact match re-credited, `career.week` unchanged
   * either time — can tell "I already ran this one" from "the calendar
   * really has moved on since I last checked", which a week-to-week
   * comparison alone cannot: a replay compares the same two weeks the
   * original credit did and would open the window twice.
   */
  lastTransferWindowKey?: string;
  /**
   * The window key the Deadline Day round-up has already been shown for —
   * same idea as `lastTransferWindowKey`, kept as its own field rather than
   * folded into it so "the window ran" and "the player has seen the
   * round-up for it" can never be conflated. Seeded to match
   * `lastTransferWindowKey`'s own season-1-summer seed in makeInitialCareer,
   * so the round-up naturally never fires for a window that itself never
   * ran — no separate "is this the very first window" check needed.
   */
  deadlineDayShownFor?: string;
  /** A farewell match, earned by a long spell at one club. */
  testimonial?: { club: string; season: number; payout: number } | null;
  /**
   * The farewell match after the final whistle (lib/star/farewell.ts):
   * played or skipped, and the score. Once a career; absent until then.
   */
  farewell?: FarewellRecord;
  /**
   * The best team-mates of the club you have just left. A summer move swaps
   * the squad BEFORE the season's history row is written (acceptOffer, then
   * advanceSeason), so the row reads them from here. Cleared at the rollover.
   */
  outgoingMates?: SeasonMate[];
  /**
   * Hall of Fame records already celebrated in this career (lib/star/
   * hallRecords.ts): each id once, so a record broken is a moment once.
   */
  hallRecordsBroken?: string[];
  /**
   * The football world's reaction to your career. See lib/star/media.
   *
   * Optional so every existing save loads with an empty feed that fills itself
   * from the next match onwards.
   */
  media?: import("./media/types").MediaState;
  /**
   * A tester save: someone used a Settings → Developer tools cheat (money,
   * skills, skip ahead, switch club…) on this career. Set once, never
   * cleared (lib/star/godMode.ts). Optional: absent means a clean save.
   */
  usedGodMode?: boolean;
}

export type StarPhase =
  | "profile-setup"
  /** What went up and down, shown once at a rollover. See LadderScreen. */
  | "ladder"
  /** The old club just relegated out of the Championship; pick a new one. */
  | "relegation-move"
  | "dashboard"
  | "settings"
  | "face-editor"
  | "fake-face-editor"
  | "league"
  | "life"
  | "skills"
  | "training"
  | "pre-match"
  | "match"
  | "post-match"
  | "media"
  | "ballon-dor"
  | "shop-kib"
  | "shop-boots"
  | "shop-lifestyle"
  /** Walk the 3D shop (beta) — a 3D showroom of the boots, cars, cans and
   *  jewellery, opened from the Shop page. Buying is still done in the normal
   *  shop. See components/star/Shop3D.tsx. */
  | "shop-3d"
  /** The Store (daily specials, run-ups, accessories, boosts, Coins) — the
   *  test area's screen on the real career. See components/star/store/CareerStore. */
  | "store"
  | "casino-menu"
  | "casino-blackjack"
  | "casino-roulette"
  | "casino-slots"
  | "investments"
  | "sponsors"
  /** Haggling over a sponsor offer's weekly fee (sponsorDeals.ts). */
  | "sponsor-negotiation"
  | "achievements"
  | "trophies"
  /** World/club/government/shareholder standing — Phase 1 of
   *  STAR_POWER_POLITICS.md. See ReputationScreen, lib/star/reputation.ts. */
  | "reputation"
  /** The generic vote/ceremony engine — Phase 2 of STAR_POWER_POLITICS.md.
   *  See VoteCeremony, lib/star/voting.ts. */
  | "vote-ceremony"
  /** Governing-body influence + the Rule Book — Phase 4 of
   *  STAR_POWER_POLITICS.md. See RuleBookScreen, lib/star/ruleBook.ts. */
  | "rule-book"
  /** A single consolidated home for everything Star Power & Politics built —
   *  reputation, the clubs you're a shareholder in, the Rule Book, governing-
   *  body standing — reported directly: those used to be three separate,
   *  unrelated-looking home-page buttons with no sense they were one system.
   *  See OwnershipScreen. Links out to the real screens (Investments'
   *  boardroom, ReputationScreen, RuleBookScreen) rather than re-implementing
   *  them, so nothing here changes what any of those actually do. */
  | "ownership"
  | "contract-renewal"
  | "dilemma"
  | "relationship-game"
  | "advert-shoot"
  | "season-transfer"
  | "retirement"
  /** After the Ballon d'Or night of the second-last season: "this is your
   *  final season before retirement" (CareerEnd.tsx, Leo 5 Oct 2026). */
  | "final-season"
  /** THE FAREWELL MATCH (Leo, 6 Oct 2026), after the final whistle and
   *  before the career overview: the invite (Play or Skip), the team
   *  sheets, the guard of honour, the match, full time. A refresh goes
   *  back to the final whistle (see the phase save in page.tsx). */
  | "farewell-invite"
  | "farewell-sheets"
  | "farewell-walkout"
  | "farewell-match"
  | "farewell-result"
  | "legacy"
  | "press"
  | "draw"
  /** The whole division's business the moment a transfer window closed —
   *  club by club, incomings and outgoings. See DeadlineDayRoundup. */
  | "deadline-day"
  /** The play-off bracket so far, before each of your play-off matches and
   *  once your run is over. See PlayOffRoundup. */
  | "playoff-roundup"
  /** A cup or European round-up: results board, bracket, league-phase table.
   *  See KnockoutRoundup. */
  | "knockout-roundup"
  /** Golden Boot, Assist King, Golden Glove, Player/Young Player of the
   *  Season, Team of the Season and every trophy this season handed out —
   *  shown once, right after the season rolls over. See SeasonAwardsScreen. */
  | "season-awards"
  /** LEGACY, and kept only so a save written before the five-stage trial
   *  still parses. It was one penalty taken until it went in; its screen is
   *  deleted, and the resume path in page.tsx moves anyone still carrying it
   *  to "trial-stages". Nothing writes it any more. */
  | "trial"
  /** The full multi-stage trial — penalties, free kicks, taking a man on,
   *  finding the pass, and a real five-a-side. See TrialSequence. */
  | "trial-stages"
  /** What the trial earned: the afternoon's number, what each stage was
   *  worth, and the clubs that came in for you. See ScoutOffers. */
  | "scout-offers"
  /** Life with no club: home, gym, video games, out with your mates. The
   *  cut-down dashboard a trialist and a free agent live on, deliberately
   *  without fixtures, a table, a squad or a contract. See FreeAgentShell. */
  | "free-agent"
  /** The man who watched you play, saying what he thought and what he is
   *  prepared to pay — before the newspaper, not instead of it. See
   *  ManagerTalk.tsx, lib/star/signingTalk.ts. */
  | "manager-talk"
  /** …and haggling over it, on the same two-desks negotiation every transfer
   *  in the game already uses. See NegotiationScreen, lib/star/negotiation.ts. */
  | "wage-talk"
  /** At a club, not in its first team: the youth team, the reserves, or the
   *  week-by-week grind back into the side. See YouthTeam.tsx,
   *  lib/star/youth.ts. */
  | "youth"
  /** …and what it earns you — the card, then the contract. See TrialReward. */
  | "trial-reward"
  /** You signed for one club and they are sending you to another one. Shown
   *  ONCE, straight after the signing, because until it existed a loan
   *  wildcard simply deposited you at a club nobody had mentioned — reported
   *  directly: "you got loaned out, it just didn't tell you anything". The
   *  same LoanBrief.tsx the weekly reminder uses, in its `intro` form. */
  | "loan-brief"
  /** Watching a saved goal happen again — see GoalReplay, goalReplays.ts. */
  | "goal-replay"
  /** Signing for a new club at the end of a season — the same contract
   *  moment "trial-reward" ends on, reused. See TransferSigning.tsx. */
  | "transfer-signing"
  /** Your own place — Phase 1 of STAR_GARDEN.md. A real trophy cabinet, the
   *  horse's paddock if you own one, and a few real teammates hanging
   *  around. All real data reused from elsewhere (career.trophies,
   *  career.horse, career.squad); this only displays it in one place.
   *  See GardenScreen.tsx. */
  | "garden";
