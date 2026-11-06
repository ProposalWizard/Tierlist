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
  /** The picture on its medal. */
  icon: string;
  check: (c: CareerState) => boolean;
  /** How far along you are, for the ones with a number to chase: [have, need]. */
  progress?: (c: CareerState) => [number, number];
  /** The number is money (★), shown short: ★420k / ★1m. */
  money?: boolean;
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

type Progress = (c: CareerState) => [number, number];
const A = (
  id: string, label: string, description: string, tier: AchievementTier, group: AchievementGroup,
  icon: string, check: (c: CareerState) => boolean, progress?: Progress, money?: boolean,
): Achievement => ({ id, label, description, tier, group, icon, check, ...(progress ? { progress } : {}), ...(money ? { money } : {}) });
const n = (have: number, need: number): [number, number] => [Math.max(0, Math.min(have, need)), need];
const maxSkill = (c: CareerState) => Math.max(0, ...Object.values(c.skills ?? {}).map(v => Number(v) || 0));

/**
 * THE 67 (Mikey, 3 Nov 2026: "I don't want there to be a ridiculous amount …
 * still have more simple ones and then still have difficult ones and still
 * have extremely difficult ones"). Cut from 136: ladders with too many rungs
 * (10/25/50/200 goals), one title per division, second versions of the same
 * thing, five "max one skill" (now one, Maxed Out), and the Conference League
 * (never played). The cut ones still pay what they paid to anyone who earned
 * them: RETIRED_ACHIEVEMENTS, read by the XP Book.
 * Difficulty checked with three 20-season robot careers (scripts/robot).
 */
export const ACHIEVEMENTS: Achievement[] = [
  // ── Getting started ──
  A("first-contract", "First Contract", "Sign your first contract", "easy", "Getting started", "✍️", (c) => hasClub(c)),
  A("first-match", "First Appearance", "Make your debut", "easy", "Getting started", "👟", (c) => c.careerStats.appearances >= 1),
  A("first-goal", "Score a Goal", "Score your first career goal", "easy", "Getting started", "⚽", (c) => c.careerStats.goals >= 1),
  A("first-assist", "Make an Assist", "Register your first assist", "easy", "Getting started", "🤝", (c) => c.careerStats.assists >= 1),
  A("star-man", "Star Man", "Earn a Star Man award", "easy", "Getting started", "⭐", (c) => c.careerStats.starMan >= 1),

  // ── Goals ──
  A("brace", "Brace", "Score twice in one match", "easy", "Goals", "⚽", (c) => (fe(c).braces ?? 0) >= 1 || c.careerStats.hatTricks >= 1),
  A("hat-trick", "Hat-trick Hero", "Score 3 in a match", "medium", "Goals", "🎩", (c) => c.careerStats.hatTricks >= 1 || (fe(c).hatTricks ?? 0) >= 1),
  A("hat-trick-5", "Hat-trick Habit", "Score 5 hat-tricks", "hard", "Goals", "🎩",
    (c) => Math.max(c.careerStats.hatTricks, fe(c).hatTricks ?? 0) >= 5, (c) => n(Math.max(c.careerStats.hatTricks, fe(c).hatTricks ?? 0), 5)),
  A("five-goals", "Nap Hand", "Score 5 in one match", "legendary", "Goals", "🖐️", (c) => (c.careerBests?.mostGoalsMatch?.goals ?? 0) >= 5),
  A("100-goals", "Century of Goals", "Score 100 career goals", "medium", "Goals", "💯", (c) => c.careerStats.goals >= 100, (c) => n(c.careerStats.goals, 100)),
  A("300-goals", "300 Club", "Score 300 career goals", "legendary", "Goals", "🏟️", (c) => c.careerStats.goals >= 300, (c) => n(c.careerStats.goals, 300)),
  A("season-40", "Forty in a Season", "Score 40 goals in one season", "hard", "Goals", "🔥",
    (c) => (c.careerBests?.mostGoalsSeason?.goals ?? 0) >= 40,
    (c) => n(Math.max(c.careerBests?.mostGoalsSeason?.goals ?? 0, c.seasonStats?.goals ?? 0), 40)),
  A("run-5", "On Fire", "Score in 5 matches in a row", "medium", "Goals", "🔥", (c) => (fe(c).bestScoringRun ?? 0) >= 5, (c) => n(fe(c).bestScoringRun ?? 0, 5)),
  A("run-10", "Unstoppable", "Score in 10 matches in a row", "hard", "Goals", "☄️", (c) => (fe(c).bestScoringRun ?? 0) >= 10, (c) => n(fe(c).bestScoringRun ?? 0, 10)),
  A("late-winner", "Last-Gasp Hero", "Score a winner in the 85th minute or later", "medium", "Goals", "⏱️", (c) => (fe(c).lateWinners ?? 0) >= 1),

  // ── How it went in ──
  A("goal-header", "Head On", "Score a header", "easy", "How it went in", "🙆", (c) => by(c, "header") >= 1),
  A("goal-penalty", "From the Spot", "Score a penalty", "easy", "How it went in", "🎯", (c) => by(c, "penalty") >= 1),
  A("goal-volley", "Sweet Volley", "Score a volley", "medium", "How it went in", "🦵", (c) => by(c, "volley") >= 1),
  A("goal-free-kick", "Over the Wall", "Score a free kick", "medium", "How it went in", "🧱", (c) => by(c, "free_kick") >= 1),
  A("goal-30m", "Thunderbolt", "Score from 30 metres or more", "hard", "How it went in", "⚡", (c) => by(c, "far30") >= 1 || (c.careerBests?.furthestGoal?.metres ?? 0) >= 30),
  A("free-kicks-5", "Dead-Ball Specialist", "Score 5 free kicks", "hard", "How it went in", "🧱", (c) => by(c, "free_kick") >= 5, (c) => n(by(c, "free_kick"), 5)),
  A("full-set", "Complete Forward", "Score a header, volley, free kick, penalty, long shot, tight angle and rebound", "hard", "How it went in", "🧩",
    (c) => GOAL_KINDS.every(k => by(c, k) >= 1), (c) => n(GOAL_KINDS.filter(k => by(c, k) >= 1).length, GOAL_KINDS.length)),

  // ── Making goals ──
  A("25-assists", "25 Career Assists", "Reach 25 career assists", "medium", "Making goals", "🤝", (c) => c.careerStats.assists >= 25, (c) => n(c.careerStats.assists, 25)),
  A("100-assists", "100 Career Assists", "Reach 100 career assists", "hard", "Making goals", "🎁", (c) => c.careerStats.assists >= 100, (c) => n(c.careerStats.assists, 100)),
  A("assists-match-3", "Provider", "Make 3 assists in one match", "hard", "Making goals", "🎁", (c) => (c.careerBests?.mostAssistsMatch?.assists ?? fe(c).bestAssistsMatch ?? 0) >= 3),

  // ── Big days ──
  A("masterclass", "Masterclass", "Get a match rating of 9.5 or more", "hard", "Big days", "🌟", (c) => (fe(c).bestRating ?? 0) >= 9.5),
  A("derby-win", "Derby Day", "Win a derby", "easy", "Big days", "🆚", (c) => (fe(c).derbyWins ?? 0) >= 1),
  A("derby-hat-trick", "Derby Hat-trick", "Score a hat-trick in a derby", "legendary", "Big days", "👑", (c) => (fe(c).derbyHatTricks ?? 0) >= 1),
  A("win-run-10", "Winning Machine", "Win 10 matches in a row", "hard", "Big days", "📈", (c) => (fe(c).bestWinRun ?? 0) >= 10, (c) => n(fe(c).bestWinRun ?? 0, 10)),
  A("shootout-win", "Nerves of Steel", "Win a penalty shootout", "medium", "Big days", "🧊", (c) => (fe(c).shootoutWins ?? 0) >= 1),

  // ── Awards ──
  A("potm", "Player of the Month", "Win Player of the Month", "medium", "Awards", "📅", (c) => awardCount(c, "Player of the Month") >= 1),
  A("golden-boot", "Golden Boot", "Finish a season as your league's top scorer", "medium", "Awards", "👢", (c) => awardCount(c, "Golden Boot") >= 1),
  A("player-of-season", "Player of the Season", "Win Player of the Season", "hard", "Awards", "🏅", (c) => awardCount(c, "Player of the Season") >= 1),
  A("ballon-podium", "Ballon d'Or Podium", "Finish in the Ballon d'Or top three", "hard", "Awards", "🥉",
    (c) => c.ballonDorWins >= 1 || history(c).some(r => !!r.ballonDor && r.ballonDor.yourRank >= 1 && r.ballonDor.yourRank <= 3)),
  A("ballon-dor", "Ballon d'Or Winner", "Win the Ballon d'Or", "legendary", "Awards", "🏆", (c) => c.ballonDorWins >= 1),
  A("ballon-dor-3", "Three-Time Ballon d'Or", "Win the Ballon d'Or three times", "legendary", "Awards", "🏆", (c) => c.ballonDorWins >= 3, (c) => n(c.ballonDorWins, 3)),

  // ── Trophies ──
  A("promoted", "Going Up", "Win promotion", "medium", "Trophies", "⬆️", (c) => promotions(c) >= 1),
  A("premier-league-player", "Top Flight", "Play in the Premier League", "medium", "Trophies", "🦁", (c) => reachedPremier(c)),
  A("playoff-winner", "Wembley Winner", "Win a play-off final", "medium", "Trophies", "🏟️", (c) => won(c, "Play-Offs")),
  A("league-title", "Champions", "Win a league title", "medium", "Trophies", "🏆", (c) => leagueTitles(c) >= 1),
  A("title-pl", "Premier League Champion", "Win the Premier League", "legendary", "Trophies", "👑", (c) => won(c, "Premier League")),
  A("cup-winner", "FA Cup Winner", "Win the FA Cup", "medium", "Trophies", "🏆", (c) => won(c, "FA Cup")),
  A("league-cup", "League Cup Winner", "Win the League Cup", "medium", "Trophies", "🏆", (c) => won(c, "League Cup")),
  A("europa-league", "Europa League Winner", "Win the Europa League", "hard", "Trophies", "🌍", (c) => won(c, "Europa League")),
  A("champions-of-europe", "Champions of Europe", "Win the Champions League", "legendary", "Trophies", "⭐", (c) => won(c, "Champions League")),
  A("the-double", "The Double", "Win your league and the FA Cup in one season", "hard", "Trophies", "✌️",
    (c) => sameSeason(c, w => w.includes("FA Cup") && w.some(t => LEAGUE_TITLES.includes(t)))),
  A("the-treble", "The Treble", "Win the league, the cup and Europe in one season", "legendary", "Trophies", "🔱",
    (c) => sameSeason(c, w => w.includes("Premier League") && w.includes("FA Cup") && (w.includes("Champions League") || w.includes("Europa League")))),
  A("trophies-10", "Serial Winner", "Win 10 trophies", "hard", "Trophies", "🗄️", (c) => c.trophies.length >= 10, (c) => n(c.trophies.length, 10)),

  // ── Your country ──
  A("first-cap", "Full International", "Win your first cap", "medium", "Your country", "🧢", (c) => (c.caps ?? 0) >= 1),
  A("international-goal", "Goal for Your Country", "Score for your national side", "medium", "Your country", "🏴", (c) => (c.internationalGoals ?? 0) >= 1),
  A("caps-100", "Centurion", "Win 100 caps", "legendary", "Your country", "🧢", (c) => (c.caps ?? 0) >= 100, (c) => n(c.caps ?? 0, 100)),
  A("continental-champion", "Continental Champion", "Win the European Championship", "legendary", "Your country", "🏆", (c) => won(c, "European Championship")),
  A("world-champion", "World Champion", "Win the World Cup", "legendary", "Your country", "🌎", (c) => won(c, "World Cup")),

  // ── The long career ──
  A("first-transfer", "On the Move", "Move to a new club", "easy", "The long career", "✈️", (c) => (c.transfers ?? []).length >= 1),
  A("big-move", "Dream Move", "Join one of Europe's elite clubs", "hard", "The long career", "💫", (c) => (c.transfers ?? []).some(t => ELITE.has(t.to))),
  A("teen-sensation", "Teen Sensation", "Score 10 goals in a season aged 19 or under", "medium", "The long career", "🧒",
    (c) => (c.player?.age ?? 99) <= 19 && (c.seasonStats?.goals ?? 0) >= 10),
  A("captain", "Captain", "Be made club captain", "hard", "The long career", "©️", (c) => !!c.captain),
  A("star-5", "World Class", "Reach world-class ability", "hard", "The long career", "🌟", (c) => c.starRating >= 5),
  A("maxed-out", "Maxed Out", "Max out any skill", "hard", "The long career", "📊", (c) => maxSkill(c) >= 100, (c) => n(Math.round(maxSkill(c)), 100)),
  A("apps-500", "500 Games", "Play 500 matches", "hard", "The long career", "👕", (c) => c.careerStats.appearances >= 500, (c) => n(c.careerStats.appearances, 500)),
  A("veteran", "Still Got It", "Play a match aged 35 or over", "hard", "The long career", "🧓",
    (c) => (c.player?.age ?? 0) >= 35 && (c.seasonStats?.appearances ?? 0) >= 1),
  A("one-club", "One-Club Man", "Play ten full seasons, all at one club", "legendary", "The long career", "❤️", (c) => {
    const rows = (c.seasonArchive ?? []).filter(r => r.apps > 0);
    return rows.length >= 10 && new Set(rows.map(r => r.club)).size === 1;
  }),

  // ── Life ──
  // Money: real savings at each level of the game (★100/★500 until 11 Oct 2026).
  A("rich", "Comfortable Living", "Save ★10,000", "easy", "Life", "💷", (c) => c.money >= 10_000, (c) => n(Math.floor(c.money), 10_000), true),
  A("first-purchase", "Treat Yourself", "Buy something in the shop", "easy", "Life", "🛍️", (c) => (c.ownedItems ?? []).length >= 1),
  A("millionaire", "Millionaire", "Save ★1,000,000", "hard", "Life", "💰", (c) => c.money >= 1_000_000, (c) => n(Math.floor(c.money), 1_000_000), true),
  A("top-of-range", "Top of the Range", "Own a top-level item", "hard", "Life", "🏎️", (c) => (c.ownedItems ?? []).some(i => i.level === 5)),
  // Fame levels (lib/star/fame.ts FAME_LEVELS), by name.
  A("fame-icon", "Icon", "Become an Icon", "legendary", "Life", "🌠", (c) => c.fame >= 80, (c) => n(Math.floor(c.fame), 80)),
];

/**
 * Achievements cut on 3 Nov 2026, with the tier they had. No longer shown or
 * unlocked; anyone who earned one keeps exactly the XP it paid then (the XP
 * Book pays these at the OLD tier amounts, xpConfig.ts).
 */
export const RETIRED_ACHIEVEMENTS: Record<string, AchievementTier> = {
  "5-passes": "easy", "10-passes": "medium", "four-goals": "hard", "10-goals": "medium", "25-goals": "medium",
  "50-goals": "hard", "200-goals": "legendary", "season-20": "medium", "season-30": "hard", "quick-goal": "medium",
  "super-sub": "medium", "match-winner": "easy", "winners-10": "hard", "goal-long-range": "medium",
  "goal-tight-angle": "medium", "goal-rebound": "easy", "goal-chip": "medium", "goal-curl": "medium",
  "headers-10": "hard", "penalties-10": "hard", "3-assists": "easy", "assists-season-15": "hard",
  "50-assists": "hard", "passes-500": "medium", "star-man-25": "hard", "derby-goal": "medium",
  "derby-wins-10": "hard", "big-win": "medium", "european-nights": "medium", "europe-goal": "medium",
  "cl-goal": "hard", "potm-5": "hard", "promoted-3": "hard", "title-nl-regional": "medium", "title-nl": "medium",
  "title-l2": "medium", "title-l1": "hard", "title-champ": "hard", "titles-3": "legendary",
  "community-shield": "medium", "conference-league": "hard", "super-cup": "hard", "trophy-cabinet": "medium",
  "trophies-25": "legendary", "fa-cup-3": "legendary", "caps-10": "medium", "fifty-caps": "hard",
  "intl-goals-10": "hard", "intl-goals-25": "legendary", "apps-100": "medium", "apps-250": "hard",
  "seasons-5": "medium", "seasons-10": "hard", "seasons-20": "legendary", "journeyman": "hard",
  "boss-90": "medium", "team-90": "medium", "fans-90": "medium", "star-4": "medium",
  "max-technique": "hard", "max-pace": "hard", "max-power": "hard", "max-vision": "hard", "max-fk": "hard",
  "loaded": "medium", "rich-list": "legendary", "fame-rising": "easy", "fame-national": "medium",
  "fame-global": "hard", "collector": "medium",
  // Tiers that moved on 3 Nov 2026 keep nothing extra here: they pay their new tier.
};

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
