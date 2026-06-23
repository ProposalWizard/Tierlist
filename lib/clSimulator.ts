// Champions League Draft — standalone CL simulation engine.
// Reuses the same match mechanics (xG, Poisson, phase ratings) as seasonSimulator.ts
// but adds minute-by-minute event generation for the match viewer.

import type { DraftPlayer, PlayerAttributes, PhaseRatings } from "./seasonSimulator";
import { computeTeamStrength } from "./seasonSimulator";
import type { CLClub } from "./clTeams";
import { CL_CLUBS } from "./clTeams";

export type { DraftPlayer, PlayerAttributes, PhaseRatings };
export { computeTeamStrength };

// ── Event types for the match viewer ──

export interface MatchEvent {
  minute: number;
  type: "goal" | "assist" | "yellow-card" | "chance" | "save" | "half-time" | "full-time" | "extra-time-start" | "penalty-shootout";
  side: "player" | "opponent";
  playerName?: string;
  detail?: string;
}

export interface CLMatchResult {
  opponent: string;
  opponentStrength: number;
  isHome: boolean;
  goalsFor: number;
  goalsAgainst: number;
  result: "W" | "D" | "L";
  goalScorers: { player: string; minute: number }[];
  assistProviders: { player: string; minute: number }[];
  events: MatchEvent[];
  extraTime?: boolean;
  penalties?: boolean;
  penaltyScore?: { player: number; opponent: number };
}

export interface CLKnockoutTie {
  round: string;
  opponent: string;
  opponentStrength: number;
  leg1: CLMatchResult;
  leg2?: CLMatchResult;
  result: "W" | "L";
  aggFor: number;
  aggAgainst: number;
}

export interface CLLeagueStanding {
  name: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  isPlayer: boolean;
}

export interface CLPlayerStats {
  name: string;
  assignedPosition: string;
  goals: number;
  assists: number;
  cleanSheets: number;
  appearances: number;
  avgRating: number;
}

export interface CLBracketEntry {
  teamA: string;
  teamB: string;
  winner: string;
  scoreDisplay: string;
  isPlayerMatch: boolean;
}

export interface CLFullBracket {
  playoffRound: CLBracketEntry[];
  roundOf16: CLBracketEntry[];
  quarterFinals: CLBracketEntry[];
  semiFinals: CLBracketEntry[];
  final: CLBracketEntry | null;
}

export interface CLSeasonResult {
  leagueMatches: CLMatchResult[];
  leagueTable: CLLeagueStanding[];
  leaguePosition: number;
  knockoutTies: CLKnockoutTie[];
  bracket: CLFullBracket;
  winner: boolean;
  exitStage: string | null;
  tournamentWinner: string;
  playerStats: CLPlayerStats[];
  allMatches: CLMatchResult[];
}

// ── Seeded PRNG (mulberry32) ──

function createRng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Position classification ──

type PositionRole = "GK" | "DEF" | "MID" | "ATT";

function classifyPosition(pos: string): PositionRole {
  const p = pos.toUpperCase().trim();
  if (p === "GK") return "GK";
  if (["CB", "RB", "LB", "RWB", "LWB", "SW"].includes(p)) return "DEF";
  if (["CDM", "CM", "CAM", "RM", "LM", "DM"].includes(p)) return "MID";
  return "ATT";
}

function positionFitness(player: DraftPlayer): number {
  const assigned = player.assignedPosition.toUpperCase().trim();
  const natural = (player.positions || "").split(",").map(p => p.trim().toUpperCase()).filter(Boolean);
  if (natural.length === 0) return 1.0;
  if (natural.includes(assigned)) return 1.0;
  const assignedRole = classifyPosition(assigned);
  if (natural.some(p => classifyPosition(p) === assignedRole)) return 0.96;
  const mediumPairs: [string[], string[]][] = [
    [["LB", "LWB"], ["LM"]],
    [["RB", "RWB"], ["RM"]],
    [["CDM", "DM"], ["CB"]],
  ];
  for (const [groupA, groupB] of mediumPairs) {
    if (groupA.includes(assigned) && natural.some(p => groupB.includes(p))) return 0.88;
    if (groupB.includes(assigned) && natural.some(p => groupA.includes(p))) return 0.88;
  }
  const adjacent: Record<PositionRole, PositionRole[]> = { ATT: ["MID"], MID: ["ATT", "DEF"], DEF: ["MID"], GK: [] };
  if (natural.some(p => (adjacent[assignedRole] ?? []).includes(classifyPosition(p)))) return 0.82;
  return 0.6;
}

// ── Attribute helpers ──

function hasAttrs(p: DraftPlayer): p is DraftPlayer & { attrs: PlayerAttributes } {
  if (!p.attrs) return false;
  const a = p.attrs;
  return a.shooting > 0 || a.passing > 0 || a.defending > 0 || a.pace > 0;
}

function statOr(val: number, ovr: number): number { return val > 0 ? val : ovr; }

function playerContributions(p: DraftPlayer, fitness: number): { attack: number; defense: number } {
  const pos = p.assignedPosition.toUpperCase().trim();
  const o = p.overall;
  if (!hasAttrs(p)) {
    const role = classifyPosition(pos);
    if (role === "GK") return { attack: 0, defense: o * fitness };
    if (role === "DEF") return { attack: 0, defense: o * fitness };
    if (role === "ATT") return { attack: o * fitness, defense: 0 };
    return { attack: o * 0.5 * fitness, defense: o * 0.5 * fitness };
  }
  const a = p.attrs;
  const def = statOr(a.defending, o);
  const phy = statOr(a.physical, o);
  const pac = statOr(a.pace, o);
  const crs = statOr(a.crossing, o);
  const pas = statOr(a.passing, o);
  const sho = statOr(a.shooting, o);
  const dri = statOr(a.dribbling, o);
  const blend = (statAvg: number) => (statAvg * 0.3 + o * 0.7) * fitness;

  if (pos === "GK") return { attack: 0, defense: o * fitness };
  if (pos === "CB") return { attack: 0, defense: blend((def + phy + pac) / 3) };
  if (["RB", "LB", "RWB", "LWB"].includes(pos)) return { attack: blend((crs + pac) / 2), defense: blend((def + pac) / 2) };
  if (["CDM", "DM"].includes(pos)) return { attack: blend(pas), defense: blend((def + phy) / 2) };
  if (pos === "CM") return { attack: blend((pas + sho) / 2), defense: blend(def) };
  if (pos === "CAM") return { attack: blend((pas + dri + sho) / 3), defense: 0 };
  if (["RM", "LM"].includes(pos)) return { attack: blend((pac + dri) / 2), defense: blend((pac + def) / 2) };
  if (pos === "ST") return { attack: blend((sho + dri + phy) / 3), defense: 0 };
  if (pos === "RW" || pos === "LW") return { attack: blend((pac + dri + sho) / 3), defense: 0 };
  const role = classifyPosition(pos);
  if (role === "ATT") return { attack: blend((sho + dri + phy) / 3), defense: 0 };
  if (role === "DEF") return { attack: 0, defense: blend((def + phy + pac) / 3) };
  return { attack: blend((pas + sho) / 2), defense: blend(def) };
}

function computePhaseRatings(players: DraftPlayer[]): PhaseRatings {
  for (const p of players) {
    p.overall = Number(p.overall) || 0;
    if (p.attrs) {
      const a = p.attrs;
      for (const key of Object.keys(a) as (keyof PlayerAttributes)[]) {
        (a as unknown as Record<string, number>)[key] = Number(a[key]) || 0;
      }
    }
    if (p.overall === 0 && p.attrs) {
      const a = p.attrs;
      const main = [a.pace, a.shooting, a.passing, a.dribbling, a.defending, a.physical].filter(v => v > 0);
      if (main.length >= 3) p.overall = Math.round(main.reduce((s, v) => s + v, 0) / main.length);
      else p.overall = 70;
    } else if (p.overall === 0) {
      p.overall = 70;
    }
  }

  const attackValues: number[] = [];
  const defenseValues: number[] = [];
  let gkRating = 65;
  for (const p of players) {
    const fit = positionFitness(p);
    const contrib = playerContributions(p, fit);
    if (contrib.attack > 0) attackValues.push(contrib.attack);
    if (contrib.defense > 0) defenseValues.push(contrib.defense);
    if (classifyPosition(p.assignedPosition) === "GK") gkRating = contrib.defense;
  }
  const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 70;
  const attack = avg(attackValues);
  const defense = avg(defenseValues);
  const midfield = (attack + defense) / 2;
  const teamStrength = attack * 0.45 + defense * 0.40 + gkRating * 0.15;
  return { attack, midfield, defense, gk: gkRating, teamStrength };
}

// ── Goal/assist attribution ──

function goalScoringWeight(p: DraftPlayer): number {
  const role = classifyPosition(p.assignedPosition);
  const fit = positionFitness(p);
  const qualityMult = (p.overall / 80) * (p.overall / 80);
  if (hasAttrs(p)) {
    const a = p.attrs;
    const o = p.overall;
    const sho = statOr(a.shooting, o);
    const dri = statOr(a.dribbling, o);
    const pac = statOr(a.pace, o);
    const phy = statOr(a.physical, o);
    switch (role) {
      case "ATT": return (sho * 3 + dri * 1 + pac * 0.5) * fit * qualityMult / 80;
      case "MID": return (sho * 2 + dri * 0.5) * fit * qualityMult / 150;
      case "DEF": return (phy * 1.2 + sho * 0.3) * fit * qualityMult / 600;
      case "GK": return 0.02;
    }
  }
  const ratingFactor = 0.5 + (p.overall / 99) * 0.5;
  const roleWeights: Record<PositionRole, number> = { ATT: 10, MID: 3, DEF: 0.5, GK: 0.02 };
  return roleWeights[role] * ratingFactor * fit * qualityMult;
}

function assistWeight(p: DraftPlayer): number {
  const role = classifyPosition(p.assignedPosition);
  const pos = p.assignedPosition.toUpperCase().trim();
  const fit = positionFitness(p);
  if (hasAttrs(p)) {
    const a = p.attrs;
    const o = p.overall;
    const pas = statOr(a.passing, o);
    const crs = statOr(a.crossing, o);
    const dri = statOr(a.dribbling, o);
    if (["RB", "LB", "RWB", "LWB"].includes(pos)) return (crs * 3 + pas * 1) * fit / 40;
    switch (role) {
      case "MID": return (pas * 2 + crs * 1 + dri * 0.5) * fit / 30;
      case "ATT": return (pas * 1.5 + dri * 1 + crs * 0.5) * fit / 40;
      case "DEF": return (pas * 0.5) * fit / 100;
      case "GK": return 0.1;
    }
  }
  const ratingFactor = 0.5 + (p.overall / 99) * 0.5;
  const roleWeights: Record<PositionRole, number> = { ATT: 5, MID: 8, DEF: 2, GK: 0.1 };
  return roleWeights[role] * ratingFactor * fit;
}

function weightedPick(players: DraftPlayer[], weightFn: (p: DraftPlayer) => number, rng: () => number): DraftPlayer {
  const weights = players.map(weightFn);
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return players[Math.floor(rng() * players.length)];
  let r = rng() * total;
  for (let i = 0; i < players.length; i++) {
    r -= weights[i];
    if (r <= 0) return players[i];
  }
  return players[players.length - 1];
}

const HOME_ADVANTAGE = 3;

function randomMinute(rng: () => number): number {
  return Math.floor(rng() * 90) + 1;
}

function poisson(lambda: number, rng: () => number): number {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do { k++; p *= rng(); } while (p > L);
  return k - 1;
}

function computeExpectedGoals(attackPower: number, midfieldPower: number, oppDefensePower: number): number {
  const offensiveStrength = attackPower * 0.55 + midfieldPower * 0.45;
  const diff = offensiveStrength - oppDefensePower;
  const xg = 1.5 + diff * 0.065;
  return Math.max(0.4, Math.min(3.5, xg));
}

// ── Per-match player rating ──

function matchRating(
  player: DraftPlayer,
  goalsScored: number,
  assistsMade: number,
  goalsAgainst: number,
  matchResult: "W" | "D" | "L",
  rng: () => number,
): number {
  let base = 6.5 + (player.overall - 70) * 0.025;
  base += (rng() - 0.5) * 0.8;
  base += goalsScored * 2.0;
  base += assistsMade * 1.2;
  const role = classifyPosition(player.assignedPosition);
  if ((role === "DEF" || role === "GK") && goalsAgainst === 0) base += 0.8;
  if (matchResult === "W") base += 0.3;
  else if (matchResult === "L") base -= 0.3;
  return Math.max(4.0, Math.min(10.0, base));
}

// ── Match simulation with events ──

function simulateMatch(
  players: DraftPlayer[],
  ratings: PhaseRatings,
  opponent: { name: string; strength: number },
  isHome: boolean,
  rng: () => number,
): CLMatchResult {
  const homeBonus = isHome ? HOME_ADVANTAGE : 0;
  const awayPenalty = isHome ? 0 : HOME_ADVANTAGE;

  const myAttack = ratings.attack + homeBonus * 0.6;
  const myMidfield = ratings.midfield + homeBonus * 0.4;
  const myDefense = ratings.defense + homeBonus * 0.3;
  const myGk = ratings.gk;

  const effOppStrength = opponent.strength + awayPenalty;
  const myXg = computeExpectedGoals(myAttack, myMidfield, effOppStrength);
  const ourDefPower = myDefense * 0.55 + myGk * 0.30 + myMidfield * 0.15;
  const oppXg = computeExpectedGoals(effOppStrength, effOppStrength * 0.95, ourDefPower);

  const myForm = 0.85 + rng() * 0.30;
  const oppForm = 0.85 + rng() * 0.30;

  const goalsFor = poisson(myXg * myForm, rng);
  const goalsAgainst = poisson(oppXg * oppForm, rng);

  const goalScorers: { player: string; minute: number }[] = [];
  const assistProviders: { player: string; minute: number }[] = [];
  const events: MatchEvent[] = [];

  const subAdjGoal = (p: DraftPlayer) => goalScoringWeight(p) * (p.isSub ? 0.35 : 1.0);
  const subAdjAssist = (p: DraftPlayer) => assistWeight(p) * (p.isSub ? 0.5 : 1.0);
  const penaltyTaker = [...players].sort((a, b) => goalScoringWeight(b) - goalScoringWeight(a))[0];

  for (let i = 0; i < goalsFor; i++) {
    const minute = randomMinute(rng);
    const isPenalty = rng() < 0.10;
    const scorer = isPenalty ? penaltyTaker : weightedPick(players, subAdjGoal, rng);
    goalScorers.push({ player: scorer.name, minute });
    events.push({ minute, type: "goal", side: "player", playerName: scorer.name, detail: isPenalty ? "Penalty" : undefined });

    if (!isPenalty && rng() < 0.75) {
      const eligible = players.filter(p => p.name !== scorer.name);
      if (eligible.length > 0) {
        const assister = weightedPick(eligible, subAdjAssist, rng);
        assistProviders.push({ player: assister.name, minute });
        events.push({ minute, type: "assist", side: "player", playerName: assister.name });
      }
    }
  }

  for (let i = 0; i < goalsAgainst; i++) {
    const minute = randomMinute(rng);
    events.push({ minute, type: "goal", side: "opponent", detail: `${opponent.name} goal` });
  }

  // Flavor events: chances, saves, yellow cards
  const totalChances = Math.floor(rng() * 4) + 2;
  for (let i = 0; i < totalChances; i++) {
    const minute = randomMinute(rng);
    const side = rng() > 0.5 ? "player" as const : "opponent" as const;
    if (rng() > 0.5) {
      events.push({ minute, type: "chance", side, detail: side === "player" ? "Close chance" : `${opponent.name} chance` });
    } else {
      events.push({ minute, type: "save", side: side === "player" ? "opponent" : "player", detail: "Good save" });
    }
  }

  const yellowCards = Math.floor(rng() * 4);
  for (let i = 0; i < yellowCards; i++) {
    const minute = randomMinute(rng);
    const side = rng() > 0.4 ? "opponent" as const : "player" as const;
    const name = side === "player" ? players[Math.floor(rng() * players.length)].name : undefined;
    events.push({ minute, type: "yellow-card", side, playerName: name });
  }

  events.push({ minute: 45, type: "half-time", side: "player" });
  events.push({ minute: 90, type: "full-time", side: "player" });
  events.sort((a, b) => a.minute - b.minute || (a.type === "goal" ? -1 : 1));

  goalScorers.sort((a, b) => a.minute - b.minute);
  assistProviders.sort((a, b) => a.minute - b.minute);

  let result: "W" | "D" | "L";
  if (goalsFor > goalsAgainst) result = "W";
  else if (goalsFor < goalsAgainst) result = "L";
  else result = "D";

  return {
    opponent: opponent.name, opponentStrength: opponent.strength, isHome,
    goalsFor, goalsAgainst, result,
    goalScorers, assistProviders, events,
  };
}

function simulateNeutralMatch(
  home: { name: string; strength: number },
  away: { name: string; strength: number },
  rng: () => number,
): { homeGoals: number; awayGoals: number } {
  const homeEff = home.strength + HOME_ADVANTAGE;
  const awayEff = away.strength;
  const homeXg = computeExpectedGoals(homeEff, homeEff * 0.95, awayEff);
  const awayXg = computeExpectedGoals(awayEff, awayEff * 0.95, homeEff);
  return {
    homeGoals: poisson(homeXg * (0.85 + rng() * 0.30), rng),
    awayGoals: poisson(awayXg * (0.85 + rng() * 0.30), rng),
  };
}

// ── Extra time & penalties (for knockout) ──

function addExtraTime(
  match: CLMatchResult,
  players: DraftPlayer[],
  ratings: PhaseRatings,
  oppStrength: number,
  rng: () => number,
): void {
  match.extraTime = true;
  match.events.push({ minute: 91, type: "extra-time-start", side: "player" });

  const etXg = computeExpectedGoals(ratings.attack, ratings.midfield, oppStrength) * 0.33;
  const ourDef = ratings.defense * 0.55 + ratings.gk * 0.30 + ratings.midfield * 0.15;
  const etOppXg = computeExpectedGoals(oppStrength, oppStrength * 0.95, ourDef) * 0.33;

  const etFor = poisson(etXg, rng);
  const etAgainst = poisson(etOppXg, rng);
  match.goalsFor += etFor;
  match.goalsAgainst += etAgainst;

  for (let i = 0; i < etFor; i++) {
    const minute = 90 + Math.floor(rng() * 30) + 1;
    const scorer = weightedPick(players, goalScoringWeight, rng);
    match.goalScorers.push({ player: scorer.name, minute });
    match.events.push({ minute, type: "goal", side: "player", playerName: scorer.name });
    if (rng() < 0.75) {
      const eligible = players.filter(p => p.name !== scorer.name);
      if (eligible.length > 0) {
        const assister = weightedPick(eligible, assistWeight, rng);
        match.assistProviders.push({ player: assister.name, minute });
        match.events.push({ minute, type: "assist", side: "player", playerName: assister.name });
      }
    }
  }
  for (let i = 0; i < etAgainst; i++) {
    const minute = 90 + Math.floor(rng() * 30) + 1;
    match.events.push({ minute, type: "goal", side: "opponent", detail: `${match.opponent} goal` });
  }

  match.events.push({ minute: 120, type: "full-time", side: "player", detail: "After extra time" });
  match.events.sort((a, b) => a.minute - b.minute);
}

function addPenalties(match: CLMatchResult, rng: () => number): "W" | "L" {
  match.penalties = true;
  match.events.push({ minute: 121, type: "penalty-shootout", side: "player" });
  const myPens = Math.floor(rng() * 3) + 3;
  const oppPens = Math.floor(rng() * 3) + 3;
  if (myPens === oppPens) {
    match.penaltyScore = rng() > 0.5
      ? { player: myPens + 1, opponent: oppPens }
      : { player: myPens, opponent: oppPens + 1 };
  } else {
    match.penaltyScore = { player: myPens, opponent: oppPens };
  }
  return match.penaltyScore.player > match.penaltyScore.opponent ? "W" : "L";
}

// ── Knockout tie (1-leg final, 2-leg otherwise) ──

function simulateKnockoutTie(
  round: string,
  opponent: { name: string; strength: number },
  players: DraftPlayer[],
  ratings: PhaseRatings,
  rng: () => number,
  isFinal: boolean,
): CLKnockoutTie {
  const starters = players.filter(p => !p.isSub);
  const subs = players.filter(p => p.isSub);

  if (isFinal) {
    const activeSubs = subs.filter(() => rng() < 0.6);
    const matchPlayers = [...starters, ...activeSubs];
    const match = simulateMatch(matchPlayers, ratings, opponent, rng() > 0.5, rng);

    if (match.goalsFor === match.goalsAgainst) {
      addExtraTime(match, matchPlayers, ratings, opponent.strength, rng);
      if (match.goalsFor === match.goalsAgainst) {
        const penResult = addPenalties(match, rng);
        return { round, opponent: opponent.name, opponentStrength: opponent.strength, leg1: match, result: penResult, aggFor: match.goalsFor, aggAgainst: match.goalsAgainst };
      }
      match.result = match.goalsFor > match.goalsAgainst ? "W" : "L";
    }
    return { round, opponent: opponent.name, opponentStrength: opponent.strength, leg1: match, result: match.result as "W" | "L", aggFor: match.goalsFor, aggAgainst: match.goalsAgainst };
  }

  const isHomeLeg1 = rng() > 0.5;
  const leg1Players = [...starters, ...subs.filter(() => rng() < 0.6)];
  const leg1 = simulateMatch(leg1Players, ratings, opponent, isHomeLeg1, rng);

  const leg2Players = [...starters, ...subs.filter(() => rng() < 0.6)];
  const leg2 = simulateMatch(leg2Players, ratings, opponent, !isHomeLeg1, rng);

  let aggFor = leg1.goalsFor + leg2.goalsFor;
  let aggAgainst = leg1.goalsAgainst + leg2.goalsAgainst;

  if (aggFor === aggAgainst) {
    addExtraTime(leg2, leg2Players, ratings, opponent.strength, rng);
    aggFor = leg1.goalsFor + leg2.goalsFor;
    aggAgainst = leg1.goalsAgainst + leg2.goalsAgainst;
    if (aggFor === aggAgainst) {
      const penResult = addPenalties(leg2, rng);
      return { round, opponent: opponent.name, opponentStrength: opponent.strength, leg1, leg2, result: penResult, aggFor, aggAgainst };
    }
  }

  const tieResult: "W" | "L" = aggFor > aggAgainst ? "W" : "L";
  return { round, opponent: opponent.name, opponentStrength: opponent.strength, leg1, leg2, result: tieResult, aggFor, aggAgainst };
}

function tieScoreDisplay(tie: CLKnockoutTie): string {
  if (!tie.leg2) {
    let s = `${tie.leg1.goalsFor}-${tie.leg1.goalsAgainst}`;
    if (tie.leg1.penalties) s += " (pens)";
    else if (tie.leg1.extraTime) s += " (AET)";
    return s;
  }
  let s = `${tie.aggFor}-${tie.aggAgainst} agg`;
  if (tie.leg2.penalties) s += " (pens)";
  else if (tie.leg2.extraTime) s += " (AET)";
  return s;
}

function simulateAIKnockoutTie(
  teamA: { name: string; strength: number },
  teamB: { name: string; strength: number },
  rng: () => number,
  isFinal: boolean,
): { winner: string; scoreDisplay: string } {
  if (isFinal) {
    const { homeGoals, awayGoals } = simulateNeutralMatch(teamA, teamB, rng);
    if (homeGoals === awayGoals) {
      const w = rng() > 0.5 ? teamA.name : teamB.name;
      return { winner: w, scoreDisplay: `${homeGoals}-${awayGoals} (pens)` };
    }
    return { winner: homeGoals > awayGoals ? teamA.name : teamB.name, scoreDisplay: `${homeGoals}-${awayGoals}` };
  }
  const leg1 = simulateNeutralMatch(teamA, teamB, rng);
  const leg2 = simulateNeutralMatch(teamB, teamA, rng);
  let aggA = leg1.homeGoals + leg2.awayGoals;
  let aggB = leg1.awayGoals + leg2.homeGoals;
  if (aggA === aggB) {
    const et1 = poisson(computeExpectedGoals(teamB.strength, teamB.strength * 0.95, teamA.strength) * 0.33, rng);
    const et2 = poisson(computeExpectedGoals(teamA.strength, teamA.strength * 0.95, teamB.strength) * 0.33, rng);
    aggA += et2;
    aggB += et1;
    if (aggA === aggB) {
      const w = rng() > 0.5 ? teamA.name : teamB.name;
      return { winner: w, scoreDisplay: `${aggA}-${aggB} agg (pens)` };
    }
    return { winner: aggA > aggB ? teamA.name : teamB.name, scoreDisplay: `${aggA}-${aggB} agg (AET)` };
  }
  return { winner: aggA > aggB ? teamA.name : teamB.name, scoreDisplay: `${aggA}-${aggB} agg` };
}

// ── Main CL season simulation ──

export function simulateCLSeason(
  players: DraftPlayer[],
  seasonNumber: number,
  previousResult?: CLSeasonResult,
): CLSeasonResult {
  const seed = seasonNumber * 1000 + players.reduce((s, p) => s + p.overall * 7 + p.name.length * 13, 0) + 42;
  const rng = createRng(seed);

  const starters = players.filter(p => !p.isSub);
  const subs = players.filter(p => p.isSub);
  const ratings = computePhaseRatings(starters.length > 0 ? starters : players);
  const playerTeamName = "KNOWITBALL FC";

  // Pot assignment: CL winners → Pot 1, otherwise based on team strength
  let playerPot: number;
  if (previousResult?.winner) {
    playerPot = 1;
  } else if (ratings.teamStrength >= 82) {
    playerPot = 1;
  } else if (ratings.teamStrength >= 78) {
    playerPot = 2;
  } else if (ratings.teamStrength >= 74) {
    playerPot = 3;
  } else {
    playerPot = 4;
  }

  // Build 4 pots of 9 teams (36 total)
  const pots: { name: string; strength: number; isPlayer: boolean }[][] = [[], [], [], []];
  pots[playerPot - 1].push({ name: playerTeamName, strength: ratings.teamStrength, isPlayer: true });

  // Fill pots from CL_CLUBS based on strength tiers
  const sorted = [...CL_CLUBS].sort((a, b) => b.strength - a.strength);
  const potTargetSizes = [9, 9, 9, 9];
  for (const club of sorted) {
    let targetPot: number;
    if (club.strength >= 85) targetPot = 0;
    else if (club.strength >= 80) targetPot = 1;
    else if (club.strength >= 75) targetPot = 2;
    else targetPot = 3;

    while (targetPot < 4 && pots[targetPot].length >= potTargetSizes[targetPot]) targetPot++;
    if (targetPot >= 4) continue;

    pots[targetPot].push({ name: club.displayName, strength: club.strength, isPlayer: false });
  }

  // Ensure each pot has at least 9 teams (pad with generated teams if needed)
  const fillerNames = ["FC Zurich", "Malmö FF", "Maccabi Haifa", "Sheriff Tiraspol", "Ferencváros",
    "Qarabağ FK", "Ludogorets", "Apollon Limassol", "NK Maribor", "APOEL", "Astana", "Partizan"];
  let fillerIdx = 0;
  for (let p = 0; p < 4; p++) {
    while (pots[p].length < 9 && fillerIdx < fillerNames.length) {
      pots[p].push({ name: fillerNames[fillerIdx], strength: 60 + Math.floor(rng() * 10), isPlayer: false });
      fillerIdx++;
    }
  }

  const allTeams = [...pots[0], ...pots[1], ...pots[2], ...pots[3]];
  const strengthMap = new Map(allTeams.map(t => [t.name, t.strength]));
  const bracket: CLFullBracket = { playoffRound: [], roundOf16: [], quarterFinals: [], semiFinals: [], final: null };

  // Draw player's 8 opponents (2 per pot, 1H 1A)
  const playerOpponents: { name: string; strength: number; isHome: boolean }[] = [];
  for (const pot of pots) {
    const available = pot.filter(t => !t.isPlayer);
    const shuffled = [...available].sort(() => rng() - 0.5);
    const homeFirst = rng() > 0.5;
    playerOpponents.push({ ...shuffled[0], isHome: homeFirst });
    if (shuffled.length > 1) {
      playerOpponents.push({ ...shuffled[1], isHome: !homeFirst });
    }
  }
  playerOpponents.sort(() => rng() - 0.5);

  // Simulate player's 8 league phase matches
  const leagueMatches: CLMatchResult[] = [];
  const allMatches: CLMatchResult[] = [];

  for (const opp of playerOpponents) {
    const activeSubs = subs.filter(() => rng() < 0.5);
    const matchPlayers = [...starters, ...activeSubs];
    const m = simulateMatch(matchPlayers, ratings, { name: opp.name, strength: opp.strength }, opp.isHome, rng);
    leagueMatches.push(m);
    allMatches.push(m);
  }

  // Build league table
  const tableData: Record<string, CLLeagueStanding> = {};
  for (const team of allTeams) {
    tableData[team.name] = {
      name: team.name, played: 0, won: 0, drawn: 0, lost: 0,
      goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0,
      isPlayer: team.isPlayer,
    };
  }

  for (const m of leagueMatches) {
    const pt = tableData[playerTeamName];
    pt.played++;
    pt.goalsFor += m.goalsFor;
    pt.goalsAgainst += m.goalsAgainst;
    if (m.result === "W") { pt.won++; pt.points += 3; }
    else if (m.result === "D") { pt.drawn++; pt.points += 1; }
    else { pt.lost++; }
  }

  // Simulate 8 matches for each AI team
  for (const team of allTeams) {
    if (team.isPlayer) continue;
    const td = tableData[team.name];
    for (const pot of pots) {
      const available = pot.filter(t => t.name !== team.name);
      const shuffled = [...available].sort(() => rng() - 0.5);
      const picked = shuffled.slice(0, 2);
      for (let k = 0; k < picked.length; k++) {
        const isHome = k === 0;
        const home = isHome ? team : picked[k];
        const away = isHome ? picked[k] : team;
        const { homeGoals, awayGoals } = simulateNeutralMatch(
          { name: home.name, strength: home.strength },
          { name: away.name, strength: away.strength }, rng,
        );
        const gf = isHome ? homeGoals : awayGoals;
        const ga = isHome ? awayGoals : homeGoals;
        td.played++;
        td.goalsFor += gf;
        td.goalsAgainst += ga;
        if (gf > ga) { td.won++; td.points += 3; }
        else if (gf === ga) { td.drawn++; td.points += 1; }
        else { td.lost++; }
      }
    }
  }

  const leagueTable = Object.values(tableData);
  for (const t of leagueTable) t.goalDifference = t.goalsFor - t.goalsAgainst;
  leagueTable.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    return a.name.localeCompare(b.name);
  });

  const leaguePosition = leagueTable.findIndex(t => t.isPlayer) + 1;

  // Eliminated in league phase
  if (leaguePosition > 24) {
    const r32Teams: { name: string; strength: number }[] = [];
    for (let i = 8; i < 24; i++) {
      r32Teams.push({ name: leagueTable[i].name, strength: strengthMap.get(leagueTable[i].name) || 70 });
    }
    let r16Sur: { name: string; strength: number }[] = [];
    for (let i = 0; i < 8; i++) {
      const { winner: w, scoreDisplay } = simulateAIKnockoutTie(r32Teams[i], r32Teams[15 - i], rng, false);
      bracket.playoffRound.push({ teamA: r32Teams[i].name, teamB: r32Teams[15 - i].name, winner: w, scoreDisplay, isPlayerMatch: false });
      r16Sur.push(w === r32Teams[i].name ? r32Teams[i] : r32Teams[15 - i]);
    }
    for (let i = 0; i < 8; i++) {
      r16Sur.push({ name: leagueTable[i].name, strength: strengthMap.get(leagueTable[i].name) || 70 });
    }
    r16Sur.sort(() => rng() - 0.5);
    let cur = r16Sur;
    const bracketRounds = [bracket.roundOf16, bracket.quarterFinals, bracket.semiFinals];
    for (let ri = 0; ri < 4; ri++) {
      const isFinal = ri === 3;
      const next: { name: string; strength: number }[] = [];
      for (let i = 0; i < cur.length; i += 2) {
        if (!cur[i + 1]) { next.push(cur[i]); continue; }
        const { winner: w, scoreDisplay } = simulateAIKnockoutTie(cur[i], cur[i + 1], rng, isFinal);
        if (isFinal) {
          bracket.final = { teamA: cur[i].name, teamB: cur[i + 1].name, winner: w, scoreDisplay, isPlayerMatch: false };
        } else {
          bracketRounds[ri].push({ teamA: cur[i].name, teamB: cur[i + 1].name, winner: w, scoreDisplay, isPlayerMatch: false });
        }
        next.push(w === cur[i].name ? cur[i] : cur[i + 1]);
      }
      cur = next;
    }
    const stats = computePlayerStats(players, allMatches, rng);
    return {
      leagueMatches, leagueTable, leaguePosition,
      knockoutTies: [], bracket, winner: false, exitStage: "League Phase",
      tournamentWinner: cur[0].name, playerStats: stats, allMatches,
    };
  }

  // Knockout phase
  const knockoutTies: CLKnockoutTie[] = [];
  type BracketTeam = { name: string; strength: number };
  let playerEliminated = false;
  let playerExitStage: string | null = null;

  // Playoff round: positions 9-24
  const r32Pairs: [BracketTeam, BracketTeam][] = [];
  for (let i = 0; i < 8; i++) {
    const hiPos = 8 + i;
    const loPos = 23 - i;
    r32Pairs.push([
      { name: leagueTable[hiPos].name, strength: strengthMap.get(leagueTable[hiPos].name) || 70 },
      { name: leagueTable[loPos].name, strength: strengthMap.get(leagueTable[loPos].name) || 70 },
    ]);
  }

  const r32Winners: BracketTeam[] = [];
  for (const [hi, lo] of r32Pairs) {
    const playerInvolved = hi.name === playerTeamName || lo.name === playerTeamName;
    if (playerInvolved) {
      const oppName = hi.name === playerTeamName ? lo.name : hi.name;
      const oppStr = hi.name === playerTeamName ? lo.strength : hi.strength;
      const tie = simulateKnockoutTie("Playoff Round", { name: oppName, strength: oppStr }, players, ratings, rng, false);
      knockoutTies.push(tie);
      for (const m of [tie.leg1, tie.leg2].filter(Boolean) as CLMatchResult[]) allMatches.push(m);
      const winner = tie.result === "W" ? playerTeamName : oppName;
      bracket.playoffRound.push({ teamA: hi.name, teamB: lo.name, winner, scoreDisplay: tieScoreDisplay(tie), isPlayerMatch: true });
      if (tie.result === "L") {
        playerEliminated = true;
        playerExitStage = "Playoff Round";
        r32Winners.push({ name: oppName, strength: oppStr });
      } else {
        r32Winners.push({ name: playerTeamName, strength: ratings.teamStrength });
      }
    } else {
      const { winner: w, scoreDisplay } = simulateAIKnockoutTie(hi, lo, rng, false);
      bracket.playoffRound.push({ teamA: hi.name, teamB: lo.name, winner: w, scoreDisplay, isPlayerMatch: false });
      r32Winners.push(w === hi.name ? hi : lo);
    }
  }

  // R16: top 8 + playoff winners
  const r16Pairs: [BracketTeam, BracketTeam][] = [];
  for (let i = 0; i < 8; i++) {
    const autoQ: BracketTeam = { name: leagueTable[7 - i].name, strength: strengthMap.get(leagueTable[7 - i].name) || 70 };
    if (leagueTable[7 - i].isPlayer) {
      r16Pairs.push([{ name: playerTeamName, strength: ratings.teamStrength }, r32Winners[i]]);
    } else if (r32Winners[i].name === playerTeamName) {
      r16Pairs.push([r32Winners[i], autoQ]);
    } else {
      r16Pairs.push([autoQ, r32Winners[i]]);
    }
  }

  const r16Winners: BracketTeam[] = [];
  for (const [a, b] of r16Pairs) {
    const playerInvolved = (a.name === playerTeamName || b.name === playerTeamName) && !playerEliminated;
    if (playerInvolved) {
      const oppName = a.name === playerTeamName ? b.name : a.name;
      const oppStr = a.name === playerTeamName ? b.strength : a.strength;
      const tie = simulateKnockoutTie("Round of 16", { name: oppName, strength: oppStr }, players, ratings, rng, false);
      knockoutTies.push(tie);
      for (const m of [tie.leg1, tie.leg2].filter(Boolean) as CLMatchResult[]) allMatches.push(m);
      const winner = tie.result === "W" ? playerTeamName : oppName;
      bracket.roundOf16.push({ teamA: a.name, teamB: b.name, winner, scoreDisplay: tieScoreDisplay(tie), isPlayerMatch: true });
      if (tie.result === "L") {
        playerEliminated = true;
        playerExitStage = "Round of 16";
        r16Winners.push({ name: oppName, strength: oppStr });
      } else {
        r16Winners.push({ name: playerTeamName, strength: ratings.teamStrength });
      }
    } else {
      const { winner: w, scoreDisplay } = simulateAIKnockoutTie(a, b, rng, false);
      bracket.roundOf16.push({ teamA: a.name, teamB: b.name, winner: w, scoreDisplay, isPlayerMatch: false });
      r16Winners.push(w === a.name ? a : b);
    }
  }

  // QF, SF, Final
  const roundNames = ["Quarter-Final", "Semi-Final", "Final"];
  const bracketRoundArrays = [bracket.quarterFinals, bracket.semiFinals];
  let currentRound = r16Winners;
  for (let ri = 0; ri < roundNames.length; ri++) {
    const roundName = roundNames[ri];
    const isFinal = ri === 2;
    const nextRound: BracketTeam[] = [];
    for (let i = 0; i < currentRound.length; i += 2) {
      const a = currentRound[i];
      const b = currentRound[i + 1];
      if (!b) { nextRound.push(a); continue; }
      const playerInvolved = (a.name === playerTeamName || b.name === playerTeamName) && !playerEliminated;
      if (playerInvolved) {
        const oppName = a.name === playerTeamName ? b.name : a.name;
        const oppStr = a.name === playerTeamName ? b.strength : a.strength;
        const tie = simulateKnockoutTie(roundName, { name: oppName, strength: oppStr }, players, ratings, rng, isFinal);
        knockoutTies.push(tie);
        for (const m of [tie.leg1, tie.leg2].filter(Boolean) as CLMatchResult[]) allMatches.push(m);
        const winner = tie.result === "W" ? playerTeamName : oppName;
        const entry: CLBracketEntry = { teamA: a.name, teamB: b.name, winner, scoreDisplay: tieScoreDisplay(tie), isPlayerMatch: true };
        if (isFinal) bracket.final = entry;
        else bracketRoundArrays[ri].push(entry);
        if (tie.result === "L") {
          playerEliminated = true;
          playerExitStage = roundName;
          nextRound.push({ name: oppName, strength: oppStr });
        } else {
          nextRound.push({ name: playerTeamName, strength: ratings.teamStrength });
        }
      } else {
        const { winner: w, scoreDisplay } = simulateAIKnockoutTie(a, b, rng, isFinal);
        const entry: CLBracketEntry = { teamA: a.name, teamB: b.name, winner: w, scoreDisplay, isPlayerMatch: false };
        if (isFinal) bracket.final = entry;
        else bracketRoundArrays[ri].push(entry);
        nextRound.push(w === a.name ? a : b);
      }
    }
    currentRound = nextRound;
  }

  const tournamentWinner = currentRound[0]?.name ?? "";
  const playerWon = tournamentWinner === playerTeamName;
  const stats = computePlayerStats(players, allMatches, rng);

  return {
    leagueMatches, leagueTable, leaguePosition, knockoutTies,
    bracket,
    winner: playerWon,
    exitStage: playerWon ? null : playerExitStage,
    tournamentWinner,
    playerStats: stats,
    allMatches,
  };
}

// ── Player stats aggregation ──

function computePlayerStats(players: DraftPlayer[], matches: CLMatchResult[], rng: () => number): CLPlayerStats[] {
  const statsMap = new Map<string, CLPlayerStats>();
  for (const p of players) {
    statsMap.set(p.name, { name: p.name, assignedPosition: p.assignedPosition, goals: 0, assists: 0, cleanSheets: 0, appearances: 0, avgRating: 0 });
  }

  const ratings: Map<string, number[]> = new Map();
  for (const p of players) ratings.set(p.name, []);

  for (const m of matches) {
    for (const p of players) {
      const plays = !p.isSub || rng() < 0.6;
      if (!plays) continue;
      const ps = statsMap.get(p.name)!;
      ps.appearances++;

      const goalsInMatch = m.goalScorers.filter(g => g.player === p.name).length;
      const assistsInMatch = m.assistProviders.filter(a => a.player === p.name).length;
      ps.goals += goalsInMatch;
      ps.assists += assistsInMatch;

      const role = classifyPosition(p.assignedPosition);
      if ((role === "DEF" || role === "GK") && m.goalsAgainst === 0) ps.cleanSheets++;

      const rating = matchRating(p, goalsInMatch, assistsInMatch, m.goalsAgainst, m.result, rng);
      ratings.get(p.name)!.push(rating);
    }
  }

  ratings.forEach((ratingArr, name) => {
    const ps = statsMap.get(name)!;
    ps.avgRating = ratingArr.length > 0 ? Math.round(ratingArr.reduce((a, b) => a + b, 0) / ratingArr.length * 10) / 10 : 0;
  });

  return Array.from(statsMap.values());
}
