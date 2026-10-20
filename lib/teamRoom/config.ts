/**
 * lib/teamRoom/config.ts — the Team room's one settings file (Harry, 19 Oct
 * 2026: "portable kit"). To move the Team room to another Next.js +
 * Supabase site: copy lib/teamRoom/, components/teamRoom/ and
 * supabase/migrations/team_room.sql, change this file, run the SQL.
 *
 * The names must match the CHECK lists in team_room.sql.
 */
export const TEAM_PEOPLE = ["Harry", "Mikey", "Leo"] as const;
export type TeamPerson = (typeof TEAM_PEOPLE)[number];

export const TEAM_ROOM = {
  /** Board colour per person (Ops room / Clean light). */
  colour: { Harry: "var(--ash-harry, #34e08b)", Mikey: "var(--ash-mikey, #6fb8ff)", Leo: "var(--ash-leo, #b18cff)" } as Record<TeamPerson, string>,
  /** Where chat pictures go (a public bucket) and the folder inside it. */
  imageBucket: "tierlist-images",
  imageFolder: "team-chat",
  /** How many messages the chat loads (the database keeps 5,000). */
  loadMessages: 300,
  /** A ticked to-do stays on the list this long, faded, then leaves. */
  keepDoneHours: 24,
  /** The SQL file to run when the tables are missing (shown on screen). */
  sqlFile: "supabase/migrations/team_room.sql",
  /** Round two: who has seen what, "Got it", "Read and understood", patch-note notes. */
  sqlFileV2: "supabase/migrations/team_room_v2.sql",
  /** Patch notes from this day on count as "still to read" (older ones show faces but never nag). */
  patchReceiptsFrom: "2026-10-18",
  /** A message counts as seen once this much of it is on screen in the open chat. */
  seenShare: 0.6,
  /** Where the full Team room lives. */
  home: "/admin/team",
  /** Chat bubble shows on these pages (plus every page in the admin list). */
  bubblePrefixes: ["/admin"],
  /** …but never on these (the game itself, the home page). */
  bubbleNever: ["/", "/star-dev"],
} as const;

export const isTeamPerson = (s: unknown): s is TeamPerson =>
  typeof s === "string" && (TEAM_PEOPLE as readonly string[]).includes(s);
