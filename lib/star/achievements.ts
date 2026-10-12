import type { CareerState } from "./types";
// calendar.ts imports nothing, so asking it this costs no bundle weight here.
import { hasClub, divisionOf } from "./calendar";

/**
 * ACHIEVEMENTS — "did you ever do this at all", checked off for good.
 *
 * Roadmap #4 (11 Oct 2026): "Achievements and records filled out." The list
 * went from 35 to the set below, spread over a whole career: first things,
 * goals, how they went in, making goals, big days, awards, trophies, your
 * country, the long career, and life off the pitch.
 *
 * Each one has a TIER — what it pays comes from the XP Book
 * (lib/star/xpConfig.ts `achievementTiers`, /admin/star-xp), where an admin
 * can move it to another tier or give it its own amount. The tier is also how
 * rare it is on the screen.
 *
 * A check reads the career as it is now. Unlocking is once: the id goes into
 * `career.achievements` and checkNewAchievements skips it after that, so a
 * replayed match can't pay twice. The per-match ones read `career.feats`
 * (lib/star/feats.ts), which creditMatchResult folds each match into once.
 * Nothing here is unlockable without its data: a save from before feats
 * existed starts counting those from its next match.
 */

export type AchievementTier = "easy" | "medium" | "hard" | "legendary";
export type AchievementGroup =
  | "Getting started" | "Goals" | "How it went in" | "Making goals" | "Big days"
  | "Awards" | "Trophies" | "Your country" | "The long career" | "Life";

export interface Achievement {
  id: string;
  label: string;
  description: string;
  tier: AchievementTier;
  group: AchievementGroup;
  check: (c: CareerState) => boolean;
}

// ── Readers ─────────────────────────────────────────────────────────────────
const fe = (c: CareerState) => c.feats ?? {};
const by = (c: CareerState, k: string) => fe(c).goalsBy?.[k] ?? 0;
const won = (c: CareerState, competition: string) => (c.trophies ?? []).some(t => t.competition === competition);
const wonCount = (c: CareerState, competition: string) => (c.trophies ?? []).filter(t => t.competition === competition).length;
const awardCount = (c: CareerState, kind: string) => (c.awards ?? []).filter(a => a.kind === kind).length;
const history = (c: CareerState) => c.seasonHistory ?? [];
const promotions = (c: CareerState) => history(c).filter(r => r.move === "promoted").length;
const seasonsPlayed = (c: CareerState) => (c.seasonArchive ?? []).filter(r => r.apps > 0).length;
const LEAGUE_TITLES = ["Premier League", "Championship", "League One", "League Two", "National League", "National League North", "National League South"];
const leagueTitles = (c: CareerState) => (c.trophies ?? []).filter(t => LEAGUE_TITLES.includes(t.competition)).length;
/** Every club you have played a game for (finished seasons, plus this one). */
function clubsPlayedFor(c: CareerState): Set<string> {
  const out = new Set((c.seasonArchive ?? []).filter(r => r.apps > 0).map(r => r.club));
  if ((c.seasonStats?.appearances ?? 0) > 0 && c.player?.club) out.add(c.thisSeasonClub ?? c.player.club);
  return out;
}
function reachedPremier(c: CareerState): boolean {
  return history(c).some(r => r.division === "premier")
    || (divisionOf(c) === "premier" && (c.seasonStats?.appearances ?? 0) > 0);
}
function sameSeason(c: CareerState, needs: (won: string[]) => boolean): boolean {
  const seasons = Array.from(new Set(c.trophies.map(t => t.season)));
  return seasons.some(season => needs(c.trophies.filter(t => t.season === season).map(t => t.competition)));
}
/** The elite: clubs on this game's Champions League list. */
// Inline rather than imported from clubs.ts, so this file stays light (the XP
// Book imports it). Kept to the clubs that are elite in any season.
const ELITE = new Set([
  "Real Madrid", "FC Barcelona", "FC Bayern München", "Paris Saint-Germain", "Manchester City",
  "Liverpool", "Arsenal", "Manchester United", "Chelsea", "Juventus", "Inter", "AC Milan",
  "Atlético Madrid", "Borussia Dortmund", "Napoli",
]);
const GOAL_KINDS = ["header", "volley", "free_kick", "penalty", "long_range", "tight_angle", "rebound"];

const A = (id: string, label: string, description: string, tier: AchievementTier, group: AchievementGroup, check: (c: CareerState) => boolean): Achievement =>
  ({ id, label, description, tier, group, check });

export const ACHIEVEMENTS: Achievement[] = [
  // ── First steps ──
  A("first-contract", "First Contract", "Sign your first contract", "easy", "Getting started", (c) => hasClub(c)),
  A("first-match", "First Appearance", "Make your debut", "easy", "Getting started", (c) => c.careerStats.appearances >= 1),
  A("first-goal", "Score a Goal", "Score your first career goal", "easy", "Getting started", (c) => c.careerStats.goals >= 1),
  A("first-assist", "Make an Assist", "Register your first assist", "easy", "Getting started", (c) => c.careerStats.assists >= 1),
  A("star-man", "Star Man", "Earn a Star Man award", "easy", "Getting started", (c) => c.careerStats.starMan >= 1),
  // Before 11 Oct 2026 these read the CAREER pass total, so both unlocked in
  // the first match. Now they mean what they say: one game.
  A("5-passes", "5 Passes in a Match", "Complete 5 passes in one game", "easy", "Getting started", (c) => (fe(c).bestPassesMatch ?? 0) >= 5),
  A("10-passes", "10 Passes in a Match", "Complete 10 passes in one game", "medium", "Making goals", (c) => (fe(c).bestPassesMatch ?? 0) >= 10),

  // ── Goals ──
  A("brace", "Brace", "Score twice in one match", "easy", "Goals", (c) => (fe(c).braces ?? 0) >= 1 || c.careerStats.hatTricks >= 1),
  A("hat-trick", "Hat-trick Hero", "Score 3+ in a match", "medium", "Goals", (c) => c.careerStats.hatTricks >= 1 || (fe(c).hatTricks ?? 0) >= 1),
  A("hat-trick-5", "Hat-trick Habit", "Score 5 hat-tricks", "hard", "Goals", (c) => Math.max(c.careerStats.hatTricks, fe(c).hatTricks ?? 0) >= 5),
  A("four-goals", "Four-Timer", "Score 4 in one match", "hard", "Goals", (c) => (c.careerBests?.mostGoalsMatch?.goals ?? 0) >= 4),
  A("five-goals", "Nap Hand", "Score 5 in one match", "legendary", "Goals", (c) => (c.careerBests?.mostGoalsMatch?.goals ?? 0) >= 5),
  A("10-goals", "10 Career Goals", "Reach 10 career goals", "medium", "Goals", (c) => c.careerStats.goals >= 10),
  A("25-goals", "25 Career Goals", "Reach 25 career goals", "medium", "Goals", (c) => c.careerStats.goals >= 25),
  A("50-goals", "50 Career Goals", "Reach 50 career goals", "hard", "Goals", (c) => c.careerStats.goals >= 50),
  A("100-goals", "Century of Goals", "Score 100 career goals", "hard", "Goals", (c) => c.careerStats.goals >= 100),
  A("200-goals", "200 Career Goals", "Score 200 career goals", "legendary", "Goals", (c) => c.careerStats.goals >= 200),
  A("300-goals", "300 Career Goals", "Score 300 career goals", "legendary", "Goals", (c) => c.careerStats.goals >= 300),
  A("season-20", "Twenty in a Season", "Score 20 goals in one season", "medium", "Goals", (c) => (c.careerBests?.mostGoalsSeason?.goals ?? 0) >= 20),
  A("season-30", "Thirty in a Season", "Score 30 goals in one season", "hard", "Goals", (c) => (c.careerBests?.mostGoalsSeason?.goals ?? 0) >= 30),
  A("season-40", "Forty in a Season", "Score 40 goals in one season", "legendary", "Goals", (c) => (c.careerBests?.mostGoalsSeason?.goals ?? 0) >= 40),
  A("run-5", "On Fire", "Score in 5 matches in a row", "medium", "Goals", (c) => (fe(c).bestScoringRun ?? 0) >= 5),
  A("run-10", "Unstoppable", "Score in 10 matches in a row", "legendary", "Goals", (c) => (fe(c).bestScoringRun ?? 0) >= 10),
  A("quick-goal", "Quick Off the Mark", "Score in the first 5 minutes", "medium", "Goals", (c) => (c.careerBests?.fastestGoal?.minute ?? 99) <= 5),
  A("super-sub", "Super Sub", "Score after coming off the bench", "medium", "Goals", (c) => (fe(c).subGoals ?? 0) >= 1),
  A("match-winner", "Match Winner", "Score the goal that wins a match", "easy", "Goals", (c) => (fe(c).winners ?? 0) >= 1),
  A("late-winner", "Last-Gasp Hero", "Score a winner in the 85th minute or later", "medium", "Goals", (c) => (fe(c).lateWinners ?? 0) >= 1),
  A("winners-10", "Clutch", "Score 10 match-winning goals", "hard", "Goals", (c) => (fe(c).winners ?? 0) >= 10),

  // ── How it went in ──
  A("goal-header", "Head On", "Score a header", "easy", "How it went in", (c) => by(c, "header") >= 1),
  A("goal-volley", "Sweet Volley", "Score a volley", "medium", "How it went in", (c) => by(c, "volley") >= 1),
  A("goal-free-kick", "Over the Wall", "Score a free kick", "medium", "How it went in", (c) => by(c, "free_kick") >= 1),
  A("goal-penalty", "From the Spot", "Score a penalty", "easy", "How it went in", (c) => by(c, "penalty") >= 1),
  A("goal-long-range", "From Distance", "Score from outside the box", "medium", "How it went in", (c) => by(c, "long_range") >= 1 || by(c, "far25") >= 1),
  A("goal-30m", "Thunderbolt", "Score from 30 metres or more", "hard", "How it went in", (c) => by(c, "far30") >= 1 || (c.careerBests?.furthestGoal?.metres ?? 0) >= 30),
  A("goal-tight-angle", "Impossible Angle", "Score from a tight angle", "medium", "How it went in", (c) => by(c, "tight_angle") >= 1),
  A("goal-rebound", "Fox in the Box", "Score a rebound", "easy", "How it went in", (c) => by(c, "rebound") >= 1),
  A("goal-chip", "Over the Keeper", "Score with a chip", "medium", "How it went in", (c) => by(c, "chip") >= 1),
  A("goal-curl", "Bend It", "Score a curler", "medium", "How it went in", (c) => by(c, "curl") >= 1),
  A("headers-10", "Aerial Threat", "Score 10 headers", "hard", "How it went in", (c) => by(c, "header") >= 10),
  A("free-kicks-5", "Dead-Ball Specialist", "Score 5 free kicks", "hard", "How it went in", (c) => by(c, "free_kick") >= 5),
  A("penalties-10", "Spot-Kick King", "Score 10 penalties", "hard", "How it went in", (c) => by(c, "penalty") >= 10),
  A("full-set", "Complete Forward", "Score a header, volley, free kick, penalty, long shot, tight angle and rebound", "hard", "How it went in",
    (c) => GOAL_KINDS.every(k => by(c, k) >= 1)),

  // ── Making goals ──
  // Before 11 Oct 2026 this said "in a season" but read the career total.
  A("3-assists", "Playmaker", "Make 3 assists in one season", "easy", "Making goals",
    (c) => (c.careerBests?.mostAssistsSeason?.assists ?? 0) >= 3 || (c.seasonStats?.assists ?? 0) >= 3),
  A("assists-match-3", "Provider", "Make 3 assists in one match", "hard", "Making goals", (c) => (c.careerBests?.mostAssistsMatch?.assists ?? fe(c).bestAssistsMatch ?? 0) >= 3),
  A("assists-season-15", "Creator in Chief", "Make 15 assists in one season", "hard", "Making goals", (c) => (c.careerBests?.mostAssistsSeason?.assists ?? 0) >= 15),
  A("25-assists", "25 Career Assists", "Reach 25 career assists", "medium", "Making goals", (c) => c.careerStats.assists >= 25),
  A("50-assists", "50 Career Assists", "Reach 50 career assists", "hard", "Making goals", (c) => c.careerStats.assists >= 50),
  A("100-assists", "100 Career Assists", "Reach 100 career assists", "legendary", "Making goals", (c) => c.careerStats.assists >= 100),
  A("passes-500", "Pass Master", "Complete 500 passes", "medium", "Making goals", (c) => c.careerStats.passes >= 500),

  // ── Big days ──
  A("masterclass", "Masterclass", "Get a match rating of 9.5 or more", "hard", "Big days", (c) => (fe(c).bestRating ?? 0) >= 9.5),
  A("star-man-25", "Star Man x25", "Earn 25 Star Man awards", "hard", "Big days", (c) => c.careerStats.starMan >= 25),
  A("derby-win", "Derby Day", "Win a derby", "easy", "Big days", (c) => (fe(c).derbyWins ?? 0) >= 1),
  A("derby-goal", "Derby Hero", "Score in a derby", "medium", "Big days", (c) => (fe(c).derbyGoals ?? 0) >= 1),
  A("derby-hat-trick", "Derby Hat-trick", "Score a hat-trick in a derby", "legendary", "Big days", (c) => (fe(c).derbyHatTricks ?? 0) >= 1),
  A("derby-wins-10", "Bragging Rights", "Win 10 derbies", "hard", "Big days", (c) => (fe(c).derbyWins ?? 0) >= 10),
  A("win-run-10", "Winning Machine", "Win 10 matches in a row", "hard", "Big days", (c) => (fe(c).bestWinRun ?? 0) >= 10),
  A("big-win", "Rout", "Win a match by 5 goals or more", "medium", "Big days", (c) => {
    const b = c.careerBests?.biggestWin;
    return !!b && b.us - b.them >= 5;
  }),
  A("shootout-win", "Nerves of Steel", "Win a penalty shootout", "medium", "Big days", (c) => (fe(c).shootoutWins ?? 0) >= 1),
  // Before 11 Oct 2026 this unlocked on qualifying, before a ball was kicked.
  A("european-nights", "European Nights", "Play in Europe", "medium", "Big days", (c) => (fe(c).europeApps ?? 0) >= 1),
  A("europe-goal", "European Goal", "Score in European football", "medium", "Big days", (c) => (fe(c).europeGoals ?? 0) >= 1),
  A("cl-goal", "Champions League Goal", "Score in the Champions League", "hard", "Big days", (c) => (fe(c).clGoals ?? 0) >= 1),

  // ── Awards ──
  A("potm", "Player of the Month", "Win Player of the Month", "medium", "Awards", (c) => awardCount(c, "Player of the Month") >= 1),
  A("potm-5", "Monthly Regular", "Win Player of the Month 5 times", "hard", "Awards", (c) => awardCount(c, "Player of the Month") >= 5),
  A("golden-boot", "Golden Boot", "Finish a season as your league's top scorer", "hard", "Awards", (c) => awardCount(c, "Golden Boot") >= 1),
  A("player-of-season", "Player of the Season", "Win Player of the Season", "hard", "Awards", (c) => awardCount(c, "Player of the Season") >= 1),
  A("ballon-podium", "Ballon d'Or Podium", "Finish in the Ballon d'Or top three", "hard", "Awards",
    (c) => c.ballonDorWins >= 1 || history(c).some(r => !!r.ballonDor && r.ballonDor.yourRank >= 1 && r.ballonDor.yourRank <= 3)),
  A("ballon-dor", "Ballon d'Or Winner", "Win the Ballon d'Or", "legendary", "Awards", (c) => c.ballonDorWins >= 1),
  A("ballon-dor-3", "Three-Time Ballon d'Or", "Win the Ballon d'Or three times", "legendary", "Awards", (c) => c.ballonDorWins >= 3),

  // ── Trophies ──
  A("promoted", "Going Up", "Win promotion", "medium", "Trophies", (c) => promotions(c) >= 1),
  A("promoted-3", "Climber", "Win promotion three times", "hard", "Trophies", (c) => promotions(c) >= 3),
  A("premier-league-player", "Top Flight", "Play in the Premier League", "medium", "Trophies", (c) => reachedPremier(c)),
  A("league-title", "Champions", "Win a league title", "medium", "Trophies", (c) => leagueTitles(c) >= 1),
  A("title-nl-regional", "Non-League Kings", "Win the National League North or South", "medium", "Trophies", (c) => won(c, "National League North") || won(c, "National League South")),
  A("title-nl", "National League Champions", "Win the National League", "medium", "Trophies", (c) => won(c, "National League")),
  A("title-l2", "League Two Champions", "Win League Two", "medium", "Trophies", (c) => won(c, "League Two")),
  A("title-l1", "League One Champions", "Win League One", "hard", "Trophies", (c) => won(c, "League One")),
  A("title-champ", "Championship Winners", "Win the Championship", "hard", "Trophies", (c) => won(c, "Championship")),
  A("title-pl", "Premier League Champion", "Win the Premier League", "legendary", "Trophies", (c) => won(c, "Premier League")),
  A("titles-3", "Dynasty", "Win three league titles", "legendary", "Trophies", (c) => leagueTitles(c) >= 3),
  A("playoff-winner", "Wembley Winner", "Win the play-off final", "medium", "Trophies", (c) => won(c, "Play-Offs")),
  A("cup-winner", "FA Cup Winner", "Win the FA Cup", "hard", "Trophies", (c) => won(c, "FA Cup")),
  A("league-cup", "League Cup Winner", "Win the League Cup", "hard", "Trophies", (c) => won(c, "League Cup")),
  A("community-shield", "Shield Bearer", "Win the Community Shield", "medium", "Trophies", (c) => won(c, "Community Shield")),
  A("conference-league", "Conference League Winner", "Win the Conference League", "hard", "Trophies", (c) => won(c, "Conference League")),
  A("europa-league", "Europa League Winner", "Win the Europa League", "hard", "Trophies", (c) => won(c, "Europa League")),
  A("champions-of-europe", "Champions of Europe", "Win the Champions League", "legendary", "Trophies", (c) => won(c, "Champions League")),
  A("super-cup", "Super Cup Winner", "Win the Super Cup", "hard", "Trophies", (c) => won(c, "Super Cup")),
  A("trophy-cabinet", "Trophy Hunter", "Win 3 trophies", "medium", "Trophies", (c) => c.trophies.length >= 3),
  A("trophies-10", "Serial Winner", "Win 10 trophies", "hard", "Trophies", (c) => c.trophies.length >= 10),
  A("trophies-25", "Silverware Legend", "Win 25 trophies", "legendary", "Trophies", (c) => c.trophies.length >= 25),
  A("the-double", "The Double", "Win your league and the FA Cup in one season", "hard", "Trophies",
    (c) => sameSeason(c, w => w.includes("FA Cup") && w.some(t => LEAGUE_TITLES.includes(t)))),
  A("the-treble", "The Treble", "Win the league, the cup and Europe in one season", "legendary", "Trophies",
    (c) => sameSeason(c, w => w.includes("Premier League") && w.includes("FA Cup") && (w.includes("Champions League") || w.includes("Europa League")))),
  A("fa-cup-3", "Cup Specialist", "Win the FA Cup three times", "legendary", "Trophies", (c) => wonCount(c, "FA Cup") >= 3),

  // ── Your country ──
  A("first-cap", "Full International", "Win your first cap", "medium", "Your country", (c) => (c.caps ?? 0) >= 1),
  A("caps-10", "Regular Call-Up", "Win 10 caps", "medium", "Your country", (c) => (c.caps ?? 0) >= 10),
  A("fifty-caps", "Half a Century of Caps", "Win 50 caps", "hard", "Your country", (c) => (c.caps ?? 0) >= 50),
  A("caps-100", "Centurion", "Win 100 caps", "legendary", "Your country", (c) => (c.caps ?? 0) >= 100),
  A("international-goal", "Goal for Your Country", "Score for your national side", "medium", "Your country", (c) => (c.internationalGoals ?? 0) >= 1),
  A("intl-goals-10", "International Marksman", "Score 10 goals for your country", "hard", "Your country", (c) => (c.internationalGoals ?? 0) >= 10),
  A("intl-goals-25", "Record Breaker", "Score 25 goals for your country", "legendary", "Your country", (c) => (c.internationalGoals ?? 0) >= 25),
  A("continental-champion", "Continental Champion", "Win the European Championship", "legendary", "Your country", (c) => won(c, "European Championship")),
  A("world-champion", "World Champion", "Win the World Cup", "legendary", "Your country", (c) => won(c, "World Cup")),

  // ── The long career ──
  A("apps-100", "Century of Games", "Play 100 matches", "medium", "The long career", (c) => c.careerStats.appearances >= 100),
  A("apps-250", "250 Games", "Play 250 matches", "hard", "The long career", (c) => c.careerStats.appearances >= 250),
  A("apps-500", "500 Games", "Play 500 matches", "legendary", "The long career", (c) => c.careerStats.appearances >= 500),
  A("seasons-5", "Five Seasons", "Play five full seasons", "medium", "The long career", (c) => seasonsPlayed(c) >= 5),
  A("seasons-10", "Ten-Year Pro", "Play ten full seasons", "hard", "The long career", (c) => seasonsPlayed(c) >= 10),
  A("seasons-20", "The Long Haul", "Reach your 20th season", "legendary", "The long career", (c) => c.season >= 20),
  A("teen-sensation", "Teen Sensation", "Score 10 goals in a season aged 19 or under", "hard", "The long career",
    (c) => (c.player?.age ?? 99) <= 19 && (c.seasonStats?.goals ?? 0) >= 10),
  A("veteran", "Still Got It", "Play a match aged 35 or over", "hard", "The long career",
    (c) => (c.player?.age ?? 0) >= 35 && (c.seasonStats?.appearances ?? 0) >= 1),
  A("captain", "Captain", "Be made club captain", "hard", "The long career", (c) => !!c.captain),
  A("first-transfer", "On the Move", "Move to a new club", "medium", "The long career", (c) => (c.transfers ?? []).length >= 1),
  A("big-move", "Dream Move", "Join one of Europe's elite clubs", "hard", "The long career", (c) => (c.transfers ?? []).some(t => ELITE.has(t.to))),
  A("journeyman", "Journeyman", "Play for four different clubs", "hard", "The long career", (c) => clubsPlayedFor(c).size >= 4),
  A("one-club", "One-Club Man", "Play ten full seasons, all at one club", "legendary", "The long career", (c) => {
    const rows = (c.seasonArchive ?? []).filter(r => r.apps > 0);
    return rows.length >= 10 && new Set(rows.map(r => r.club)).size === 1;
  }),
  A("boss-90", "Manager's Favourite", "Reach 90 Boss rating", "medium", "The long career", (c) => c.relationships.boss >= 90),
  A("team-90", "Dressing Room Leader", "Reach 90 Team rating", "medium", "The long career", (c) => c.relationships.team >= 90),
  A("fans-90", "Fan Favourite", "Reach 90 Fans rating", "medium", "The long career", (c) => c.relationships.fans >= 90),
  // Ability (career.starRating), not the 1-100 star rating; named without a
  // number since the player only sees one rating now (Harry, 1 Oct 2026).
  A("star-4", "Top Player", "Become one of the best players in the country", "medium", "The long career", (c) => c.starRating >= 4),
  A("star-5", "World Class", "Reach world-class ability", "hard", "The long career", (c) => c.starRating >= 5),
  A("max-technique", "Master Technician", "Max out Technique", "hard", "The long career", (c) => c.skills.technique >= 100),
  A("max-pace", "Lightning Bolt", "Max out Pace", "hard", "The long career", (c) => c.skills.pace >= 100),
  A("max-power", "Powerhouse", "Max out Power", "hard", "The long career", (c) => c.skills.power >= 100),
  A("max-vision", "Playmaker Vision", "Max out Vision", "hard", "The long career", (c) => c.skills.vision >= 100),
  A("max-fk", "Set Piece Specialist", "Max out Free Kick", "hard", "The long career", (c) => c.skills.freeKick >= 100),

  // ── Life ──
  // Money: ★100 and ★500 until 11 Oct 2026 — about four weeks' and twenty
  // weeks' wages in non-league, one match in the Premier League. Now real
  // savings at each level of the game.
  A("rich", "Comfortable Living", "Save ★10,000", "easy", "Life", (c) => c.money >= 10_000),
  A("loaded", "Wealthy", "Save ★100,000", "medium", "Life", (c) => c.money >= 100_000),
  A("millionaire", "Millionaire", "Save ★1,000,000", "hard", "Life", (c) => c.money >= 1_000_000),
  A("rich-list", "Rich List", "Save ★10,000,000", "legendary", "Life", (c) => c.money >= 10_000_000),
  // Fame levels (lib/star/fame.ts FAME_LEVELS), by name.
  A("fame-rising", "Rising Star", "Become a Rising Star", "easy", "Life", (c) => c.fame >= 25),
  A("fame-national", "National Name", "Become a National Name", "medium", "Life", (c) => c.fame >= 40),
  A("fame-global", "Global Star", "Become a Global Star", "hard", "Life", (c) => c.fame >= 60),
  A("fame-icon", "Icon", "Become an Icon", "legendary", "Life", (c) => c.fame >= 80),
  A("first-purchase", "Treat Yourself", "Buy something in the shop", "easy", "Life", (c) => (c.ownedItems ?? []).length >= 1),
  A("collector", "Collector", "Own 10 things from the shop", "medium", "Life", (c) => (c.ownedItems ?? []).length >= 10),
  A("top-of-range", "Top of the Range", "Own a top-level item", "hard", "Life", (c) => (c.ownedItems ?? []).some(i => i.level === 5)),
];

export const ACHIEVEMENT_GROUPS: AchievementGroup[] = [
  "Getting started", "Goals", "How it went in", "Making goals", "Big days",
  "Awards", "Trophies", "Your country", "The long career", "Life",
];

export function checkNewAchievements(career: CareerState): string[] {
  const unlocked: string[] = [];
  for (const a of ACHIEVEMENTS) {
    if (career.achievements.includes(a.id)) continue;
    let ok = false;
    try { ok = a.check(career); } catch { ok = false; }
    if (ok) unlocked.push(a.id);
  }
  return unlocked;
}
