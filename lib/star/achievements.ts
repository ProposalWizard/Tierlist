import type { CareerState } from "./types";

export interface Achievement {
  id: string;
  label: string;
  description: string;
  check: (c: CareerState) => boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: "first-match", label: "First Appearance", description: "Make your debut", check: (c) => c.careerStats.appearances >= 1 },
  { id: "first-goal", label: "Score a Goal", description: "Score your first career goal", check: (c) => c.careerStats.goals >= 1 },
  { id: "first-assist", label: "Make an Assist", description: "Register your first assist", check: (c) => c.careerStats.assists >= 1 },
  { id: "hat-trick", label: "Hat-trick Hero", description: "Score 3+ in a match", check: (c) => c.careerStats.hatTricks >= 1 },
  { id: "5-passes", label: "5 Passes in a Match", description: "Complete 5 passes in one game", check: (c) => c.careerStats.passes >= 5 && c.careerStats.appearances >= 1 },
  { id: "10-passes", label: "10 Passes in a Match", description: "Complete 10 passes in one game", check: (c) => c.careerStats.passes >= 10 },
  { id: "3-assists", label: "Playmaker", description: "3 assists in a season", check: (c) => c.careerStats.assists >= 3 },
  { id: "star-man", label: "Star Man", description: "Earn a Star Man award", check: (c) => c.careerStats.starMan >= 1 },
  { id: "10-goals", label: "10 Career Goals", description: "Reach 10 career goals", check: (c) => c.careerStats.goals >= 10 },
  { id: "50-goals", label: "50 Career Goals", description: "Reach 50 career goals", check: (c) => c.careerStats.goals >= 50 },
  { id: "100-goals", label: "Century of Goals", description: "Score 100 career goals", check: (c) => c.careerStats.goals >= 100 },
  { id: "first-contract", label: "First Contract", description: "Sign your first contract", check: () => true },
  { id: "boss-90", label: "Manager's Favourite", description: "Reach 90 Boss rating", check: (c) => c.relationships.boss >= 90 },
  { id: "team-90", label: "Dressing Room Leader", description: "Reach 90 Team rating", check: (c) => c.relationships.team >= 90 },
  { id: "fans-90", label: "Fan Favourite", description: "Reach 90 Fans rating", check: (c) => c.relationships.fans >= 90 },
  { id: "star-4", label: "★4 Rating", description: "Reach 4 stars", check: (c) => c.starRating >= 4 },
  { id: "star-5", label: "★5 Legend", description: "Reach 5 stars", check: (c) => c.starRating >= 5 },
  { id: "rich", label: "Comfortable Living", description: "Save ★100", check: (c) => c.money >= 100 },
  { id: "loaded", label: "Wealthy", description: "Save ★500", check: (c) => c.money >= 500 },
  { id: "ballon-dor", label: "Ballon d'Or Winner", description: "Win the Ballon d'Or", check: (c) => c.ballonDorWins >= 1 },
  { id: "trophy-cabinet", label: "Trophy Hunter", description: "Win 3 trophies", check: (c) => c.trophies.length >= 3 },
  { id: "max-technique", label: "Master Technician", description: "Max out Technique", check: (c) => c.skills.technique >= 100 },
  { id: "max-pace", label: "Lightning Bolt", description: "Max out Pace", check: (c) => c.skills.pace >= 100 },
  { id: "max-power", label: "Powerhouse", description: "Max out Power", check: (c) => c.skills.power >= 100 },
  { id: "max-vision", label: "Playmaker Vision", description: "Max out Vision", check: (c) => c.skills.vision >= 100 },
  { id: "max-fk", label: "Set Piece Specialist", description: "Max out Free Kick", check: (c) => c.skills.freeKick >= 100 },
  // Cups, Europe and the national team.
  { id: "cup-winner", label: "Cup Winner", description: "Win the FA Cup", check: (c) => c.trophies.some(t => t.competition === "FA Cup") },
  { id: "european-nights", label: "European Nights", description: "Play in Europe", check: (c) => !!c.europeanQualification || c.trophies.some(t => t.competition.includes("League") && t.competition !== "Premier League") },
  { id: "champions-of-europe", label: "Champions of Europe", description: "Win the Champions League", check: (c) => c.trophies.some(t => t.competition === "Champions League") },
  { id: "first-cap", label: "Full International", description: "Win your first cap", check: (c) => (c.caps ?? 0) >= 1 },
  { id: "fifty-caps", label: "Half a Century of Caps", description: "Win 50 caps", check: (c) => (c.caps ?? 0) >= 50 },
  { id: "international-goal", label: "Goal for Your Country", description: "Score for your national side", check: (c) => (c.internationalGoals ?? 0) >= 1 },
  { id: "world-champion", label: "World Champion", description: "Win the World Cup", check: (c) => c.trophies.some(t => t.competition === "World Cup") },
  { id: "continental-champion", label: "Continental Champion", description: "Win the European Championship", check: (c) => c.trophies.some(t => t.competition === "European Championship") },
  { id: "the-treble", label: "The Treble", description: "Win the league, the cup and Europe in one season", check: (c) => {
    const seasons = Array.from(new Set(c.trophies.map(t => t.season)));
    return seasons.some(season => {
      const won = c.trophies.filter(t => t.season === season).map(t => t.competition);
      return won.includes("Premier League") && won.includes("FA Cup")
        && (won.includes("Champions League") || won.includes("Europa League"));
    });
  } },
];

export function checkNewAchievements(career: CareerState): string[] {
  const unlocked: string[] = [];
  for (const a of ACHIEVEMENTS) {
    if (!career.achievements.includes(a.id) && a.check(career)) {
      unlocked.push(a.id);
    }
  }
  return unlocked;
}
