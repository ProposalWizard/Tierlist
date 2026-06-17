import type { DraftPlayer } from "@/app/draft/page";

export interface MatchEvent {
  minute: number;
  type: "goal" | "penalty_goal" | "penalty_miss" | "save" | "chance" | "yellow" | "red" | "var" | "injury";
  team: "us" | "them";
  playerName: string;
  description: string;
  goalsFor: number;
  goalsAgainst: number;
}

export interface MatchResult {
  events: MatchEvent[];
  goalsFor: number;
  goalsAgainst: number;
  playerRatings: Record<string, number>;
  scorers: { name: string; goals: number; assists: number }[];
}

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 4294967296;
  };
}

function weightedPick<T>(items: T[], weight: (t: T) => number, rand: () => number): T {
  const total = items.reduce((s, t) => s + weight(t), 0);
  let r = rand() * total;
  for (const item of items) {
    r -= weight(item);
    if (r <= 0) return item;
  }
  return items[items.length - 1];
}

function goalWeight(p: DraftPlayer): number {
  if (!p.attrs) {
    const pos = p.assignedPosition.toUpperCase();
    if (pos === "GK") return 0.5;
    if (["CB", "CDM"].includes(pos)) return 2;
    if (["RB", "LB", "RWB", "LWB"].includes(pos)) return 3;
    if (["CM", "RM", "LM"].includes(pos)) return 5;
    if (["CAM"].includes(pos)) return 7;
    return 10; // attackers
  }
  return (p.attrs.finishing * 0.5 + p.attrs.positioning * 0.3 + p.attrs.shooting * 0.2) / 10;
}

function assistWeight(p: DraftPlayer): number {
  if (!p.attrs) return 5;
  return (p.attrs.vision * 0.5 + p.attrs.shortPassing * 0.3 + p.attrs.crossing * 0.2) / 10;
}

const GOAL_TEMPLATES = [
  (p: string) => `⚽ ${p} slots it coolly into the bottom corner!`,
  (p: string) => `⚽ ${p} hammers it into the top right! Unstoppable!`,
  (p: string) => `⚽ What a header from ${p}! Rises above everyone!`,
  (p: string) => `⚽ ${p} cuts inside and curls it into the far post!`,
  (p: string) => `⚽ Clinical finish from ${p}! One touch, perfect placement.`,
  (p: string) => `⚽ ${p} pounces on the rebound and tucks it in!`,
  (p: string) => `⚽ Low cross, and ${p} is there to tap it home!`,
];

const ASSIST_SUFFIXES = [
  (a: string) => ` Lovely ball from ${a}.`,
  (a: string) => ` ${a} with the inch-perfect assist.`,
  (a: string) => ` Great work by ${a} to set that up.`,
  (a: string) => ``,
];

const THEIR_GOAL_TEMPLATES = [
  (p: string) => `😤 ${p} finishes well. They're level.`,
  (p: string) => `😤 ${p} rises highest from the corner. Goal conceded.`,
  (p: string) => `😤 ${p} cuts inside and finds the corner. 1-1.`,
  (p: string) => `😤 ${p} latches onto a through ball and slots it past the keeper!`,
  (p: string) => `😤 ${p} drills it low into the net. The crowd goes quiet.`,
  (p: string) => `😤 Defensive error and ${p} pounces. Goal conceded.`,
];

const CHANCE_TEMPLATES_US = [
  (p: string) => `🎯 ${p} drives at goal... just wide of the post!`,
  (p: string) => `🎯 ${p} unleashes a shot — the keeper tips it over!`,
  (p: string) => `🎯 Great run from ${p}, but the finish is off target.`,
  (p: string) => `🎯 ${p} heads just over the bar from close range!`,
];

const CHANCE_TEMPLATES_THEM = [
  () => `🧤 Brilliant save! The keeper dives to his right to deny them!`,
  () => `🧤 Shot blocked! Last-ditch defending keeps it out!`,
  () => `🧤 Hits the post! Lucky escape for us!`,
  () => `🧤 They had a great chance there — header over the bar.`,
];

const YELLOW_TEMPLATES_US = [
  (p: string) => `🟨 ${p} goes into the book for a cynical challenge.`,
  (p: string) => `🟨 Unnecessary foul from ${p}. Yellow card.`,
];

const YELLOW_TEMPLATES_THEM = [
  () => `🟨 Dangerous challenge — their player picks up a yellow.`,
  () => `🟨 Shirt pull in the box — yellow card, no penalty though.`,
];

const OPP_PLAYER_NAMES: Record<string, string[]> = {
  "Man City": ["Haaland", "De Bruyne", "Foden", "Rodri", "Bernardo Silva", "Gvardiol", "Walker"],
  "Arsenal": ["Saka", "Ødegaard", "Havertz", "Martinelli", "Rice", "Saliba", "White"],
  "Liverpool": ["Salah", "Díaz", "Núñez", "Mac Allister", "Szoboszlai", "Van Dijk", "Alexander-Arnold"],
  "Man United": ["Rashford", "Hojlund", "Fernandes", "Mount", "Lindelöf", "Maguire", "Shaw"],
  "Chelsea": ["Palmer", "Jackson", "Sterling", "Gallagher", "Mudryk", "Silva", "Reece James"],
  "Aston Villa": ["Watkins", "McGinn", "Diaby", "Ramsey", "Cash", "Konsa", "Mings"],
  "Tottenham": ["Son", "Kane", "Richarlison", "Kulusevski", "Bentancur", "Romero", "Pedro Porro"],
  "Newcastle": ["Isak", "Wilson", "Almiron", "Guimarães", "Joelinton", "Schar", "Trippier"],
  "Brighton": ["Enciso", "Welbeck", "Mitoma", "Gross", "Baleba", "Van Hecke", "Veltman"],
  "Brentford": ["Toney", "Mbeumo", "Wissa", "Jensen", "Janelt", "Collins", "Ajer"],
  "Everton": ["Calvert-Lewin", "Doucouré", "Iwobi", "McNeil", "Mykolenko", "Branthwaite", "Tarkowski"],
};

function getOppNames(teamName: string, rngFn: () => number): string[] {
  const known = OPP_PLAYER_NAMES[teamName];
  if (known) return known;
  // Generic names for unknown teams
  const generics = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Davis", "Miller", "Wilson", "Moore", "Taylor", "Anderson", "Thomas"];
  return generics.sort(() => rngFn() - 0.5).slice(0, 7);
}

function pickTemplate<T>(arr: T[], rngFn: () => number): T {
  return arr[Math.floor(rngFn() * arr.length)];
}

export function generateMatch(
  ourSquad: DraftPlayer[],
  opponent: { name: string; strength: number },
  isHome: boolean,
  seed: number,
): MatchResult {
  const rand = rng(seed);

  const starters = ourSquad.filter(p => !p.isSub);
  const subs = ourSquad.filter(p => p.isSub);

  // Compute team strengths
  const ourAvgOvr = starters.reduce((s, p) => s + p.overall, 0) / Math.max(1, starters.length);
  const homeBonus = isHome ? 3 : 0;
  const ourStrength = ourAvgOvr + homeBonus;
  const oppStrength = opponent.strength + (isHome ? 0 : 3);

  // xG using same formula as main sim
  const diff = ourStrength - oppStrength;
  const ourXg = Math.max(0.25, Math.min(3.5, 1.3 + diff * 0.065)) * (0.85 + rand() * 0.30);
  const oppXg = Math.max(0.25, Math.min(3.5, 1.3 - diff * 0.065)) * (0.85 + rand() * 0.30);

  // Poisson goal counts
  const poissonSample = (lambda: number) => {
    const L = Math.exp(-lambda);
    let k = 0; let p = 1;
    do { k++; p *= rand(); } while (p > L);
    return k - 1;
  };

  const goalsFor = poissonSample(ourXg);
  const goalsAgainst = poissonSample(oppXg);

  const oppNames = getOppNames(opponent.name, rand);

  // Generate event minutes
  const events: MatchEvent[] = [];
  let gf = 0;
  let ga = 0;

  // Assign goal minutes
  const ourGoalMinutes: number[] = [];
  const theirGoalMinutes: number[] = [];

  for (let i = 0; i < goalsFor; i++) {
    let min = Math.floor(rand() * 89) + 1;
    if (min === 45) min = 44;
    ourGoalMinutes.push(min);
  }
  for (let i = 0; i < goalsAgainst; i++) {
    let min = Math.floor(rand() * 89) + 1;
    if (min === 45) min = 46;
    theirGoalMinutes.push(min);
  }

  // Process our goals
  for (const minute of ourGoalMinutes) {
    const scorer = weightedPick(starters, goalWeight, rand);
    const assisterPool = starters.filter(p => p !== scorer);
    const hasAssist = rand() < 0.75 && assisterPool.length > 0;
    const assister = hasAssist ? weightedPick(assisterPool, assistWeight, rand) : null;

    const template = pickTemplate(GOAL_TEMPLATES, rand);
    const suffix = assister ? pickTemplate(ASSIST_SUFFIXES, rand)(assister.name) : "";
    gf++;

    events.push({
      minute,
      type: "goal",
      team: "us",
      playerName: scorer.name,
      description: template(scorer.name) + suffix,
      goalsFor: gf,
      goalsAgainst: ga,
    });
  }

  // Process their goals
  for (const minute of theirGoalMinutes) {
    const scorer = oppNames[Math.floor(rand() * Math.min(4, oppNames.length))];
    const template = pickTemplate(THEIR_GOAL_TEMPLATES, rand);
    ga++;

    events.push({
      minute,
      type: "goal",
      team: "them",
      playerName: scorer,
      description: template(scorer),
      goalsFor: gf,
      goalsAgainst: ga,
    });
  }

  // Chance events (non-goal moments of excitement)
  const numChances = Math.floor(rand() * 4) + 3;
  for (let i = 0; i < numChances; i++) {
    const minute = Math.floor(rand() * 89) + 1;
    const isOurs = rand() < 0.55;

    if (isOurs) {
      const player = starters[Math.floor(rand() * starters.length)];
      events.push({
        minute,
        type: "chance",
        team: "us",
        playerName: player.name,
        description: pickTemplate(CHANCE_TEMPLATES_US, rand)(player.name),
        goalsFor: gf,
        goalsAgainst: ga,
      });
    } else {
      events.push({
        minute,
        type: "chance",
        team: "them",
        playerName: "",
        description: pickTemplate(CHANCE_TEMPLATES_THEM, rand)(),
        goalsFor: gf,
        goalsAgainst: ga,
      });
    }
  }

  // Yellow cards
  const numYellows = Math.floor(rand() * 3);
  for (let i = 0; i < numYellows; i++) {
    const minute = Math.floor(rand() * 85) + 3;
    const isOurs = rand() < 0.5;
    if (isOurs) {
      const player = starters[Math.floor(rand() * starters.length)];
      events.push({
        minute,
        type: "yellow",
        team: "us",
        playerName: player.name,
        description: pickTemplate(YELLOW_TEMPLATES_US, rand)(player.name),
        goalsFor: gf,
        goalsAgainst: ga,
      });
    } else {
      events.push({
        minute,
        type: "yellow",
        team: "them",
        playerName: "",
        description: pickTemplate(YELLOW_TEMPLATES_THEM, rand)(),
        goalsFor: gf,
        goalsAgainst: ga,
      });
    }
  }

  // Sort all events by minute
  events.sort((a, b) => a.minute - b.minute);

  // Patch goalsFor/goalsAgainst to be running totals
  let runGf = 0, runGa = 0;
  for (const e of events) {
    if (e.type === "goal" || e.type === "penalty_goal") {
      if (e.team === "us") runGf++;
      else runGa++;
    }
    e.goalsFor = runGf;
    e.goalsAgainst = runGa;
  }

  // Player ratings (simple — based on overall + goal bonus)
  const playerRatings: Record<string, number> = {};
  for (const p of starters) {
    let rating = 6.0 + (p.overall - 75) * 0.04 + (rand() - 0.5) * 1.2;
    if (goalsFor > goalsAgainst) rating += 0.5;
    if (goalsFor < goalsAgainst) rating -= 0.5;
    playerRatings[p.name] = Math.max(4.0, Math.min(10.0, parseFloat(rating.toFixed(1))));
  }

  // Boost scorer ratings
  for (const e of events) {
    if (e.type === "goal" && e.team === "us" && playerRatings[e.playerName] !== undefined) {
      playerRatings[e.playerName] = Math.min(10.0, playerRatings[e.playerName] + 0.8);
    }
  }

  const scorers: { name: string; goals: number; assists: number }[] = [];
  const goalMap: Record<string, { goals: number; assists: number }> = {};
  for (const e of events) {
    if (e.type === "goal" && e.team === "us") {
      if (!goalMap[e.playerName]) goalMap[e.playerName] = { goals: 0, assists: 0 };
      goalMap[e.playerName].goals++;
    }
  }
  for (const [name, stats] of Object.entries(goalMap)) {
    scorers.push({ name, ...stats });
  }

  return { events, goalsFor, goalsAgainst, playerRatings, scorers };
}

export function playerPrice(ovr: number): number {
  if (ovr >= 95) return Math.round(200 + (ovr - 95) * 30);
  if (ovr >= 90) return Math.round(80 + (ovr - 90) * 24);
  if (ovr >= 85) return Math.round(25 + (ovr - 85) * 11);
  if (ovr >= 80) return Math.round(8 + (ovr - 80) * 3.4);
  if (ovr >= 75) return Math.round(2 + (ovr - 75) * 1.2);
  return Math.max(1, Math.round((ovr - 60) * 0.2));
}
