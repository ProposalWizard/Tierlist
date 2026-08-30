/**
 * CHANTS.
 *
 * A handful of real terrace chants and goal celebrations, given rather than
 * generated — everywhere else in this folder writes in a plausible made-up
 * fan voice; these are the actual, specific things supporters sing, so they
 * only belong on the exact club or player they are really about. See
 * templates/chants.ts, which turns each entry below into its own gated
 * Template, and detect/creation.ts's TEAMMATE_GOAL, which is what gives a
 * single team-mate's goal a `scorer` fact to match a player chant against.
 *
 * Keyed the same way `career.player.club`/`CLUB_KITS` (lib/star/kits.ts) key
 * a club — its full given name, not the terrace short name the chant itself
 * may use.
 */

/** Sung after a win. */
export const CLUB_WIN_CHANTS: Record<string, string[]> = {
  "Hull City": ["Mauled by the Tigers"],
  "Arsenal": ["North London Forever"],
  "Chelsea": ["Chelsea! Chelsea! Chelsea!"],
  "Liverpool": ["Allez, Allez, Allez"],
  "Manchester United": ["Glory Glory Man United"],
  "Tottenham Hotspur": ["Come on you Spurs!", "Oh when the Spurs go marching in"],
  "West Ham United": ["I'm Forever Blowing Bubbles"],
  "Fulham FC": ["Come on you Whites!"],
};

/**
 * Sung after a win at one exact scoreline — "us-them", yours first, the same
 * format `base()` already writes to `facts.score`. Checked in ADDITION to
 * `CLUB_WIN_CHANTS`, not instead of it: a 1-0 Arsenal win is still also a win.
 */
export const CLUB_SCORELINE_CHANTS: Record<string, Record<string, string[]>> = {
  "Arsenal": { "1-0": ["One-Nil to the Arsenal"] },
};

/** Sung after a draw or a loss, in place of the win chant above. */
export const CLUB_DRAW_LOSS_CHANTS: Record<string, string[]> = {
  "Liverpool": ["You'll Never Walk Alone"],
};

/**
 * What the ground sings the moment a specific real player scores. Matched
 * against the scorer's full name exactly as `sofifa_players`/the squad carry
 * it — see `TEAMMATE_GOAL` in detect/creation.ts, which is the only place a
 * single goal's scorer name reaches the media engine as a fact at all.
 */
export const PLAYER_GOAL_CHANTS: Record<string, string[]> = {
  "Jude Bellingham": ["Hey Jude!"],
  "Mohamed Salah": ["Mo Salah! Mo Salah! Running Down the Wing!"],
  "Cole Palmer": ["Cold Palmer 🥶"],
  "Bukayo Saka": ["Starboy"],
  "Jean-Philippe Mateta": ["BOOM BOOM BOOM BOOM"],
  "Cristiano Ronaldo": ["Siuuu"],
  "Bruno Fernandes": ["He Comes From Sporting Like Cristiano"],
  "Kai Havertz": ["60 MILLION DOWN THE DRAIN"],
  "Bryan Mbeumo": ["Shake your bum bum for me and my crew"],
  "Declan Rice": ["Rice Rice Baby!"],
  "Leon Goretzka": ["GORETZKAAAAAAA!"],
  // Given exactly as "Kevin" — matched against the scorer's name as-is, same
  // as every other entry here; if no squad player is named exactly that,
  // this one simply never fires, same as Ronaldo outside the PL.
  "Kevin": ["Moffi's eating good tonight"],
  "Marcus Rashford": ["And he's smashed it in!"],
  "Amadou Onana": ["Andre at it again"],
  "Anthony Elanga": ["Ryhthm is a dancer ANTHONY ELANGA scoring goals from everywhere"],
};
