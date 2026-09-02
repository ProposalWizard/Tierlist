// Squad generation and helper utilities for the star career mode.
// Generates a realistic named squad for each club and provides pickers
// used during match resolution to assign goal/assist credit to named players.

import { mulberry32 } from "./season";
import type { SquadPlayer } from "./types";

const FIRST_NAMES = [
  "Jack", "Harry", "Ryan", "Tom", "James", "Charlie", "Oliver", "Luke", "George",
  "Mason", "Marcus", "Jordan", "Theo", "Emre", "Kai", "Luca", "Bruno", "Fabio",
  "Carlos", "Diego", "Pablo", "Sergio", "Alexis", "Pierre", "Antoine", "Oumar",
  "Ibrahim", "Moussa", "Mamadou", "Mohamed", "Riyad", "Roberto", "Andres",
  "Kylian", "Vinicius", "Rodrygo", "Ivan", "Victor", "Christian", "Wilfried",
  "Ruben", "Diogo", "Bernardo", "Raphael", "Gabriel", "Eddie", "Callum", "Ben",
];

const LAST_NAMES = [
  "Smith", "Jones", "Williams", "Brown", "Taylor", "Anderson", "Wright", "Walker",
  "Clarke", "Mitchell", "Barrett", "Nkrumah", "Traore", "Diallo", "Ba", "Coulibaly",
  "Silva", "Santos", "Costa", "Ferreira", "Rodrigues", "Garcia", "Martinez", "Lopez",
  "Hernandez", "Moreno", "Suarez", "Gomez", "Mbappe", "Diop", "Konate", "Toure",
  "Savic", "Kovacic", "Perisic", "Modric", "Muller", "Werner", "Sterling", "Salah",
  "Firmino", "Mane", "Dias", "Cancelo", "Zaha", "Watkins", "Wilson", "Toney",
];

// Squad layout: first 12 are the regular starting rotation, rest are depth/bench.
const SQUAD_POSITIONS: Array<SquadPlayer["position"]> = [
  "GK", "CB", "CB", "RB", "LB",
  "CDM", "CM", "CM",
  "RW", "LW", "CAM",
  "ST",
  // Bench / depth (indices 12-19)
  "GK", "CB", "CDM", "CM",
  "RW", "LW", "CAM", "ST",
];

export function generateSquad(seed: number): SquadPlayer[] {
  const rng = mulberry32(seed);
  const usedNames = new Set<string>();
  return SQUAD_POSITIONS.map((pos, i) => {
    let full = "";
    let tries = 0;
    while (!full || usedNames.has(full)) {
      const first = FIRST_NAMES[Math.floor(rng() * FIRST_NAMES.length)];
      const last = LAST_NAMES[Math.floor(rng() * LAST_NAMES.length)];
      full = `${first} ${last}`;
      if (++tries > 60) { full = `${first}${i}`; break; }
    }
    usedNames.add(full);
    return {
      id: `sp_${i}`,
      name: full,
      shortName: full.split(" ")[1],
      position: pos,
      seasonGoals: 0,
      seasonAssists: 0,
      careerGoals: 0,
      careerAssists: 0,
    };
  });
}

// Hash a club name to a stable numeric seed so each club always gets the same squad.
export function clubNameSeed(name: string): number {
  let h = 5381;
  for (let i = 0; i < name.length; i++) {
    h = (((h << 5) + h) ^ name.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

// Pick a squad member to credit as the scorer of a team goal (non-user).
// Weighted toward attacking positions.
//
// Generic over anything shaped like a squad player — not just SquadPlayer —
// so the exact same weighting can name an OPPONENT's scorer too, off their
// own starting XI (see CanvasMatch.tsx's opponent-goal branch), rather than
// duplicating this logic for a second, parallel "who scored" picker.
export function pickSquadScorer<T extends { id: string; position: SquadPlayer["position"] }>(
  squad: T[], rng: () => number,
): T | null {
  const attackers = squad.filter(p => ["ST", "CAM", "LW", "RW"].includes(p.position));
  const mids = squad.filter(p => ["CM", "CDM"].includes(p.position));
  const r = rng();
  const pool = r < 0.65 ? attackers : r < 0.90 ? mids : squad.filter(p => p.position !== "GK");
  const from = pool.length > 0 ? pool : squad.filter(p => p.position !== "GK");
  if (from.length === 0) return null;
  return from[Math.floor(rng() * from.length)];
}

// Optionally pick an assister (different from scorer).
// Returns null 35% of the time to model unassisted goals.
export function pickSquadAssist<T extends { id: string; position: SquadPlayer["position"] }>(
  squad: T[], excludeId: string, rng: () => number,
): T | null {
  if (rng() < 0.35) return null;
  const creators = squad.filter(p =>
    p.id !== excludeId && ["CM", "CAM", "LW", "RW", "CDM", "RB", "LB"].includes(p.position),
  );
  if (creators.length === 0) return null;
  return creators[Math.floor(rng() * creators.length)];
}
