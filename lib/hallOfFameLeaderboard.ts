/**
 * HALL OF FAME LEADERBOARD
 *
 * Every record board keeps a top five. This turns those placings into a single
 * ranking: 5 points for first, 4 for second, 3 for third, 2 for fourth, 1 for
 * fifth, summed across every board on screen.
 */

/** Points awarded for finishing 1st through 5th on a single record board. */
export const POINTS_BY_RANK = [5, 4, 3, 2, 1] as const;

/**
 * Seeded real-world records ("Official") are landmarks to beat, not a rival —
 * they are not anybody's achievement, so they never score.
 */
export const NON_SCORING_USERNAMES = new Set(["Official"]);

export interface LeaderboardBoard {
  /** Record key, e.g. "pl_goals". Only used for reporting. */
  key: string;
  /** The board's top five, best first. Anything past five is ignored. */
  entries: { username: string | null | undefined }[];
}

export interface LeaderboardEntry {
  username: string;
  points: number;
  /** How many 1sts, 2nds, 3rds, 4ths and 5ths they hold, in that order. */
  placings: number[];
  /** Distinct record boards they appear on. */
  boards: number;
}

/**
 * Rank every record holder by total points.
 *
 * A holder scores for EVERY placing they hold, including more than one on the
 * same board — someone who owns both first and second place on a record has
 * genuinely dominated it and takes 9 points for it. `placings` carries the
 * breakdown so the UI can show why a total is what it is.
 *
 * Ties break on quality before quantity: most firsts, then most seconds, and so
 * on down, so 5+5 outranks 4+3+3 despite both being 10. Names settle anything
 * still level, which keeps the order stable between renders rather than
 * depending on which board happened to be counted first.
 */
export function computeHallOfFameLeaderboard(
  boards: LeaderboardBoard[],
  topN = 5,
): LeaderboardEntry[] {
  const byUser = new Map<string, LeaderboardEntry>();
  const seenBoards = new Map<string, Set<string>>();

  for (const board of boards ?? []) {
    const entries = (board?.entries ?? []).slice(0, POINTS_BY_RANK.length);
    entries.forEach((entry, rank) => {
      const username = (entry?.username ?? "").trim();
      if (!username || NON_SCORING_USERNAMES.has(username)) return;

      let row = byUser.get(username);
      if (!row) {
        row = { username, points: 0, placings: POINTS_BY_RANK.map(() => 0), boards: 0 };
        byUser.set(username, row);
        seenBoards.set(username, new Set());
      }
      row.points += POINTS_BY_RANK[rank];
      row.placings[rank] += 1;
      seenBoards.get(username)!.add(board.key);
    });
  }

  seenBoards.forEach((keys, username) => {
    const row = byUser.get(username);
    if (row) row.boards = keys.size;
  });

  return Array.from(byUser.values())
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      for (let i = 0; i < POINTS_BY_RANK.length; i++) {
        if (b.placings[i] !== a.placings[i]) return b.placings[i] - a.placings[i];
      }
      return a.username.localeCompare(b.username);
    })
    .slice(0, topN);
}
