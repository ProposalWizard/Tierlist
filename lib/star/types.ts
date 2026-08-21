export interface StarPlayer {
  firstName: string;
  lastName: string;
  age: number;
  skinTone: "light" | "dark";
  club: string;
  clubBadge: string | null;
  position: string;
  nationality: string;
  startYear: number;
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

export interface Relationships {
  boss: number;
  team: number;
  fans: number;
  girlfriend: number | null;
  sponsors: number;
}

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
  | "European Championship";

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
  kind?: "league" | "cup" | "europe" | "international";
  /** The one against the club down the road. Same football, louder consequences. */
  derby?: boolean;
  round?: string;
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
   * His portrait, when the database has one.
   *
   * The only field here that is not needed to answer "who scored?", and it is
   * here because the Player of the Month shortlist is eight faces and a grid of
   * monograms is not that card. About 45 characters a player, so a division's
   * worth is roughly 22 KB on top of the 15.6 KB this was sized at — still
   * nothing against the save budget. Absent for a generated squad, which has no
   * real footballers in it to photograph.
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
  /** Who scored them: minute, scorer, assister. Home side then away side. */
  hg?: { m: number; s: string; a?: string }[];
  ag?: { m: number; s: string; a?: string }[];
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
  // add the face and the number next to it.
  sofifaId?: string;
  overall?: number;
  imageUrl?: string;
  nationality?: string;
  age?: number;
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
}

export interface MatchStats {
  /** Minutes actually played. Under 90 when you came off the bench. */
  minutes?: number;
  /** Why you were taken off, when you were. */
  hooked?: "form" | "legs" | "rested" | null;
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
}

export interface Boot {
  id: string;
  name: string;
  pace: number;
  power: number;
  technique: number;
  matches: number;
  price: number;
}

export interface OwnedItem {
  id: string;
  name: string;
  category: "item" | "vehicle" | "property";
  price: number;
  lifestyleValue: number;
}

export interface Girlfriend {
  name: string;
  happiness: number;
  gifts: number;
}

export interface SponsorDeal {
  category: string;
  perMatch: number;
  active: boolean;
  /** What they want for the money. Absent on a deal signed before this existed. */
  objective?: {
    kind: "goals" | "assists" | "appearances" | "starMan" | "rating";
    target: number;
    progress: number;
    seasonsLeft: number;
    bonus: number;
    done: boolean;
  };
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

export interface CareerState {
  version: 2;
  player: StarPlayer;
  skills: Skills;
  relationships: Relationships;
  contract: Contract;
  season: number;
  week: number;
  energy: number;
  matchFitness: number;
  happiness: number;
  money: number;
  starRating: number;
  fame: number;
  seasonStats: SeasonStats;
  careerStats: SeasonStats;
  fixtures: Fixture[];
  league: LeagueTeam[];
  achievements: string[];
  status: "1st Team" | "Substitute" | "Squad";
  currentBoot: Boot;
  nrgDrinks: { basic: number; premium: number; elite: number };
  ownedItems: OwnedItem[];
  girlfriend: Girlfriend | null;
  sponsors: SponsorDeal[];
  trophies: Trophy[];
  form: number[];
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
   * The other clubs' players, and what they have done this season.
   *
   * Absent on a career saved before the division had squads — the Golden Boot
   * falls back to the old invented race until the next rollover fills it in.
   */
  leagueSquads?: LeagueSquad[];
  /** Things you can still do before the next match. Refills every week. */
  weekActions?: number;
  /** Every move you made, for the legacy screen. */
  transfers?: { season: number; from: string; to: string; fee: number }[];
  /** Hung up. The career is over and only the legacy screen remains. */
  retired?: boolean;
  /** How the board saw last season. Shown on the dashboard. */
  lastSeasonJudgement?: { score: number; bossChange: number; headline: string; detail: string };
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
  /** Individual honours. The Ballon d'Or was the only one that existed. */
  awards?: { season: number; kind: string; week?: number; detail: string }[];
  /** Wearing the armband at your current club. */
  captain?: boolean;
  /** The number on your back. Reassigned when you sign for someone. */
  squadNumber?: number;
  /** Appearances at the CURRENT club, reset on a transfer. */
  clubAppearances?: number;
  /** The man in the job. He can be sacked, and the next one has never picked you. */
  manager?: { name: string; style: "trusting" | "demanding" | "rotational"; since: number; arrival: string };
  /** What happened in the dugout at the end of last season. */
  managerNews?: string | null;
  /** Sponsor objectives settled at the last rollover, for the dashboard. */
  sponsorNews?: string[];
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
  /** A farewell match, earned by a long spell at one club. */
  testimonial?: { club: string; season: number; payout: number } | null;
  /**
   * The football world's reaction to your career. See lib/star/media.
   *
   * Optional so every existing save loads with an empty feed that fills itself
   * from the next match onwards.
   */
  media?: import("./media/types").MediaState;
}

export type StarPhase =
  | "profile-setup"
  | "dashboard"
  | "league"
  | "life"
  | "skills"
  | "training"
  | "pre-match"
  | "match"
  | "post-match"
  | "media"
  | "ballon-dor"
  | "shop-nrg"
  | "shop-boots"
  | "shop-lifestyle"
  | "casino-menu"
  | "casino-blackjack"
  | "casino-roulette"
  | "casino-slots"
  | "sponsors"
  | "achievements"
  | "trophies"
  | "contract-renewal"
  | "dilemma"
  | "relationship-game"
  | "season-transfer"
  | "retirement"
  | "legacy"
  | "press"
  | "draw"
  /** The opening: one penalty, taken until it goes in. See TrialPenalty. */
  | "trial"
  /** …and what it earns you — the card, then the contract. See TrialReward. */
  | "trial-reward";
