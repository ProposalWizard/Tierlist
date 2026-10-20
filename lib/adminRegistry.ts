/**
 * lib/adminRegistry.ts — THE ONE LIST OF ADMIN AND TEST PAGES.
 *
 * Harry, 15–18 Oct 2026 (docs/plans/2026-10-15/admin.md, his page list in
 * §12). The admin home (/admin/star), the side menu (AdminNavPanel) and
 * admin mode's "for this page" list all read from here. A new admin or test
 * page adds one line. Pages Harry chose to delete are not listed.
 *
 * `access`: "admin" = admins only; "team" = admins and testers; "open" = everyone.
 * `writes`: what the page saves — none, this browser, your own account,
 * real shared data, or the code itself (repo).
 */

export type AdminSection = "rbd" | "site" | "draft" | "tierlists" | "old" | "studio";
export type AdminGroup =
  | "career" | "chances" | "match" | "data" | "places3d" | "players" | "money" | "sound"
  | "site" | "draft" | "tierlists" | "old" | "studio" | "research";
export type AdminOwner = "Harry" | "Mikey" | "Leo" | "Shared";
export type AdminWrites = "none" | "browser" | "own" | "shared" | "repo";
export type AdminAccess = "admin" | "team" | "open";

export interface AdminPage {
  url: string;
  name: string;
  purpose: string;
  section: AdminSection;
  group: AdminGroup;
  owner: AdminOwner;
  status: "live" | "old";
  writes: AdminWrites;
  access: AdminAccess;
}

/**
 * THE GAMES — one top-level tab each across the admin (Harry, 19 Oct 2026:
 * "stuff on the wider website should be on a completely different tab than
 * road to ballon dor stuff — remember we may be a production company that
 * makes a lot of games"). Inside a game's tab you only ever see its own
 * groups and pages. A NEW GAME = one line here (its tab, home page and side
 * list appear by themselves); then its groups below say `game: "<key>"`.
 * `home` is where the game's tab opens; `play` is the game as players see it.
 */
export const GAMES = [
  { key: "rbd", name: "Road to Ballon d'Or", short: "Ballon d'Or", home: "/admin/star", play: "/star-dev" },
  { key: "web", name: "Website games", short: "Website", home: "/admin/star/game/web", play: "/" },
  { key: "studio", name: "Studio", short: "Studio", home: "/admin/star/game/studio", play: null },
] as const satisfies readonly { key: string; name: string; short: string; home: string; play: string | null }[];
export type AdminGameKey = (typeof GAMES)[number]["key"];
export type AdminGame = (typeof GAMES)[number];
export const DEFAULT_GAME: AdminGameKey = GAMES[0].key;

export const SECTIONS: { key: AdminSection; name: string }[] = [
  { key: "rbd", name: "Road to Ballon d'Or" },
  { key: "site", name: "Site" },
  { key: "draft", name: "PL Draft" },
  { key: "tierlists", name: "Tierlists" },
  { key: "old", name: "Old tests" },
  { key: "studio", name: "Studio" },
];

/** Group order (Harry's answer ADM-Q115), the section each sits in, and its game.
 *  `icon` names the picture in public/admin/icons (defaults to the group key). */
export const GROUPS: { key: AdminGroup; name: string; section: AdminSection; game: AdminGameKey; icon?: string }[] = [
  { key: "career", name: "Career screens", section: "rbd", game: "rbd" },
  { key: "chances", name: "Chances", section: "rbd", game: "rbd" },
  { key: "match", name: "Match tests", section: "rbd", game: "rbd" },
  { key: "data", name: "Real data", section: "rbd", game: "rbd" },
  { key: "places3d", name: "3D places", section: "rbd", game: "rbd" },
  { key: "players", name: "Players + animation", section: "rbd", game: "rbd" },
  { key: "money", name: "Money + rewards", section: "rbd", game: "rbd" },
  { key: "sound", name: "Sound", section: "rbd", game: "rbd" },
  { key: "draft", name: "PL Draft", section: "draft", game: "web" },
  { key: "tierlists", name: "Tierlists", section: "tierlists", game: "web" },
  { key: "site", name: "Site XP + Tic Tac Toe", section: "site", game: "web" },
  { key: "old", name: "Old tests", section: "old", game: "web", icon: "site" },
  { key: "studio", name: "Team + notes", section: "studio", game: "studio", icon: "site" },
  // Research write-ups (Harry, 20 Oct 2026). The list itself is lib/research.ts.
  { key: "research", name: "Research", section: "studio", game: "studio", icon: "research" },
];

const P = (url: string, name: string, purpose: string, section: AdminSection, group: AdminGroup,
  owner: AdminOwner, status: "live" | "old", writes: AdminWrites, access: AdminAccess): AdminPage =>
  ({ url, name, purpose, section, group, owner, status, writes, access });

export const ADMIN_PAGES: AdminPage[] = [
  P("/admin/star", "Admin home", "Every admin and test page, grouped and searchable", "studio", "studio", "Harry", "live", "none", "team"),
  P("/admin/videos", "Videos", "How to hand Claude a screen recording to break down", "studio", "studio", "Harry", "live", "none", "team"),
  P("/admin/team", "Team board", "What Harry, Mikey and Leo are doing: pushes, pull requests, live deploy, patch notes", "studio", "studio", "Harry", "live", "none", "admin"),
  P("/admin/patch-notes", "Patch notes", "Every patch note, newest first", "studio", "studio", "Shared", "live", "none", "admin"),
  P("/admin/app-plan", "App plan", "The app plan and its open questions", "studio", "studio", "Harry", "live", "none", "admin"),
  P("/admin/research", "Research", "Every research write-up we have made, one card each", "studio", "research", "Harry", "live", "none", "team"),
  P("/admin/scene-generator", "Scene generator", "A game moment in, a cut scene out: its recipe, Good/Bad, keep it, and when it would play", "studio", "studio", "Harry", "live", "shared", "team"),
  P("/admin/testers", "Tester access", "Tester links, remove testers", "studio", "studio", "Harry", "live", "shared", "admin"),
  P("/admin/xp", "Site XP rewards", "Level-up rewards across the whole site (frames, titles)", "site", "site", "Harry", "live", "shared", "admin"),
  P("/admin/football", "Tic Tac Toe data", "Wikidata data behind Tic Tac Toe", "site", "site", "Harry", "live", "shared", "admin"),
  P("/squad-builder", "Dream XI builder", "Pick a formation and drag players into a dream XI", "old", "old", "Harry", "old", "none", "team"),
  P("/admin", "Site content", "Tierlists, votes, blind rankings, daily games, objectives, cards, feedback", "tierlists", "tierlists", "Harry", "live", "shared", "admin"),
  P("/admin/football/players", "SoFIFA players", "Edit SoFIFA players", "draft", "draft", "Harry", "live", "shared", "admin"),
  P("/admin/football/pl-clubs", "PL clubs per season", "Which clubs the Draft has for each season", "draft", "draft", "Harry", "live", "none", "admin"),
  P("/admin/football/scrape", "Scrape / import", "SoFIFA + logo import", "draft", "draft", "Harry", "live", "shared", "admin"),
  P("/draft-dev", "Draft test", "The PL Draft with the test setup screen", "draft", "draft", "Harry", "live", "shared", "admin"),
  P("/draft-challenge-dev", "Challenge draft", "Draft with random briefs", "draft", "draft", "Harry", "live", "shared", "admin"),
  P("/draft/preview", "Draft design preview", "Draft screen redesigns, sample data", "old", "old", "Harry", "old", "none", "team"),
  P("/star-dev", "Play the game", "Road to Ballon d'Or, as players see it", "rbd", "career", "Shared", "live", "own", "open"),
  P("/star-retirement-dev", "Retirement screens", "Every end-of-career screen, with made-up or real saves", "rbd", "career", "Leo", "live", "own", "team"),
  P("/star-relgames-dev", "Relationship games", "Play the boss, team-mate and fan mini-games", "rbd", "career", "Mikey", "live", "none", "team"),
  P("/star-goal-clips-dev", "Goal videos", "Record a goal and turn it into a video with sound", "rbd", "career", "Leo", "live", "browser", "team"),
  P("/star-dev/media-lab", "Media lab", "Media-feed graphics bench", "rbd", "career", "Harry", "live", "none", "team"),
  P("/star-training-dev", "Training levels", "Play any training game at any level", "rbd", "career", "Mikey", "live", "none", "team"),
  P("/star-gallery-dev", "Scenario gallery", "Every chance as a picture; save, commit", "rbd", "chances", "Harry", "live", "repo", "admin"),
  P("/star-highlights-dev", "Infinite Highlights", "Flick through chances and fix a bad one on the spot", "rbd", "chances", "Harry", "live", "repo", "admin"),
  // "/star-fhr-dev" (Full highlights rebuild): taken off the list (Harry, 20 Oct 2026: "It doesn't
  // need its whole own page"). The switch is in Settings; the page stays as a test area (Ruler /
  // Build-ups tabs), reached from the Play Area.
  P("/star-play-dev", "Play Area", "Play chances or a full match with every dial to hand", "rbd", "chances", "Harry", "live", "repo", "team"),
  P("/star-update-dev", "Leo's Oct 13 update", "Leo's Oct 13 gameplay update, Old or New", "rbd", "match", "Leo", "live", "browser", "team"),
  P("/star-sim90-dev", "Full match", "Full simulated 90 minutes", "rbd", "match", "Harry", "live", "none", "team"),
  P("/star-radar-dev", "Match radar", "Unseen match, minute by minute", "rbd", "match", "Harry", "live", "none", "team"),
  P("/star-fiveaside-dev", "Five-a-side", "Five-a-side chances, a full match with a radar, and 500 matches' numbers", "rbd", "match", "Harry", "live", "none", "team"),
  P("/star-pc-match-dev", "PC match + radar", "The real match with the whole pitch from above beside it, in 2D or 3D", "rbd", "match", "Harry", "live", "none", "team"),
  // "/star-dribble-dev" (First-person dribble): taken off the list (Harry, 19 Oct 2026: "remove as an admin page").
  P("/star-dribble-stick-dev", "Dribble on a stick", "Dribble steered by a stick", "rbd", "match", "Harry", "live", "none", "team"),
  P("/star-vfx-lab-dev", "Visual effects lab", "Pick and edit the effect for each match moment", "rbd", "players", "Leo", "live", "browser", "team"),
  P("/star-sound-lab-dev", "Sound lab", "Hear, edit, rate match sounds", "rbd", "sound", "Leo", "live", "browser", "team"),
  P("/star-real-moments-dev", "Real moments", "Real positions (DFL, SkillCorner, Wyscout), playable", "rbd", "data", "Mikey", "live", "none", "admin"),
  P("/star-real-shots-dev", "Real shots", "WC 2018 / Euro 2016 + tracked shots, playable", "rbd", "data", "Harry", "live", "none", "admin"),
  P("/star-real-goals-dev", "Real Goals", "Recreate real WC/Euro goals: levels, stars, accuracy, ghost", "rbd", "data", "Leo", "live", "browser", "admin"),
  P("/star-intl-dev", "International world", "Call-ups, national managers and every international competition", "rbd", "data", "Mikey", "live", "none", "team"),
  P("/star-tournament-dev", "Tournaments", "Draw and play a whole Euros or World Cup in seconds", "rbd", "data", "Leo", "live", "none", "team"),
  P("/lineups", "Team sheets", "Every club's XI, bench, manager", "rbd", "data", "Harry", "live", "shared", "admin"),
  P("/admin/clubs", "Club data", "Every club's data, with the gaps marked", "rbd", "data", "Mikey", "live", "none", "admin"),
  P("/admin/badges", "Club badges", "Club badges, redo on device", "rbd", "data", "Harry", "live", "browser", "admin"),
  P("/admin/custom-clubs", "Custom clubs", "Invent a club", "rbd", "data", "Mikey", "live", "shared", "admin"),
  P("/star-3d-bench-dev", "3D bench", "The same ten 3D shots at phone size with their frame numbers: every 3D change shows its before and after here", "rbd", "places3d", "Harry", "live", "none", "team"),
  P("/star-3d-area-dev", "3D test area", "Every 3D scene in one list, plus the 3D file store", "rbd", "places3d", "Harry", "live", "none", "team"),
  P("/star-3d-area-dev/signing", "3D signing", "Live 3D signing", "rbd", "places3d", "Harry", "live", "none", "team"),
  P("/star-3d-area-dev/office", "Manager's office", "Manager's office stage", "rbd", "places3d", "Harry", "live", "none", "team"),
  P("/star-shop3d-dev", "3D shop", "Walk-around 3D shop", "rbd", "places3d", "Harry", "live", "none", "team"),
  P("/star-garden3d-dev", "3D garden", "Walk round the 3D garden", "rbd", "places3d", "Mikey", "live", "none", "team"),
  P("/star-home3d-dev", "3D house", "Walk round the 3D house", "rbd", "places3d", "Harry", "live", "none", "team"),
  P("/star-training3d-dev", "3D training", "3D training pitch", "rbd", "places3d", "Harry", "live", "none", "team"),
  P("/star-scene-editor-dev", "3D scene editor", "Camera and light for every 3D scene (director, signing, office, shop, garden, house); Approve; Commit to game", "rbd", "places3d", "Harry", "live", "repo", "team"),
  P("/star-style-dev", "Art styles + cut-scene director", "Art styles + Cut-scene Director", "rbd", "places3d", "Harry", "live", "none", "team"),
  P("/star-animations-dev", "2D animations", "2D New vs Old animations", "rbd", "players", "Leo", "live", "browser", "team"),
  P("/star-anim3d-dev", "3D animations", "Every 3D match move", "rbd", "players", "Harry", "live", "none", "team"),
  P("/star-people-dev", "Cut-scene people", "Cut-scene faces, hands", "rbd", "players", "Harry", "live", "none", "team"),
  P("/star-sprites-dev", "3D match figures", "Every baked 3D match figure", "rbd", "players", "Leo", "live", "none", "team"),
  P("/admin/star-pass", "Star Pass", "Which reward sits at each Star Pass level", "rbd", "money", "Mikey", "live", "shared", "admin"),
  P("/admin/star-xp", "Career XP book", "How much career XP everything gives", "rbd", "money", "Mikey", "live", "shared", "admin"),
  P("/star-store-dev", "Store test", "Try the store and paid items", "rbd", "money", "Harry", "live", "browser", "team"),
  P("/star-wallet-dev", "Gems test", "Gems on the server", "rbd", "money", "Harry", "live", "own", "team"),
  P("/star-tuning-dev", "Balance numbers", "Change the game's balance numbers on this device", "rbd", "money", "Harry", "live", "browser", "team"),
  P("/admin/sound-board", "Sound board", "Swap any game sound", "rbd", "sound", "Harry", "live", "shared", "admin"),
];

/* ── "For this page": what admin mode offers on each page ─────────────── */

/**
 * Player-facing pages → the admin pages that change what you see there.
 * Longest prefix wins. Admin pages fall back to the other pages in their group.
 */
export const RELATED: { prefix: string; label: string; urls: string[] }[] = [
  { prefix: "/star-dev", label: "Road to Ballon d'Or", urls: ["/star-gallery-dev", "/star-highlights-dev", "/star-play-dev", "/lineups", "/admin/star-pass", "/admin/star-xp", "/star-tuning-dev", "/admin/sound-board", "/admin/clubs", "/admin/testers"] },
  { prefix: "/draft", label: "PL Draft", urls: ["/admin/football/players", "/admin/football/pl-clubs", "/admin/football/scrape", "/draft-dev", "/draft-challenge-dev", "/admin/xp"] },
  { prefix: "/tic-tac-toe", label: "Tic Tac Toe", urls: ["/admin/football", "/admin"] },
  { prefix: "/tenable", label: "Ten-A-Ball", urls: ["/admin"] },
  { prefix: "/blind-rankings", label: "Blind rankings", urls: ["/admin"] },
  { prefix: "/objectives", label: "Objectives", urls: ["/admin", "/admin/xp"] },
  { prefix: "/profile", label: "Profile", urls: ["/admin/xp", "/admin/testers"] },
  { prefix: "/tierlist", label: "Tierlists", urls: ["/admin"] },
  { prefix: "/play", label: "Tierlists", urls: ["/admin"] },
  { prefix: "/vote", label: "Vote tierlists", urls: ["/admin"] },
  { prefix: "/create", label: "Tierlists", urls: ["/admin"] },
  { prefix: "/find", label: "Tierlists", urls: ["/admin"] },
  { prefix: "/legend", label: "Hall of Fame shares", urls: ["/star-retirement-dev"] },
];

export const pageFor = (url: string) => ADMIN_PAGES.find((p) => p.url === url);

/* ── Games: which game a group, page or path belongs to ───────────────── */
export const gameOf = (key: string): AdminGame | undefined => GAMES.find((g) => g.key === key);
export const groupGame = (group: AdminGroup): AdminGameKey => GROUPS.find((g) => g.key === group)?.game ?? DEFAULT_GAME;
export const groupIcon = (group: AdminGroup) => `/admin/icons/${GROUPS.find((g) => g.key === group)?.icon ?? group}.webp`;
/** The game's groups, in order. */
export const groupsOf = (game: AdminGameKey) => GROUPS.filter((g) => g.game === game);
/** The game a path sits in: a game or group page says so; else its registry
 *  page's group; else the RELATED list; else the first game. */
export function gameForPath(path: string): AdminGameKey {
  const m = path.match(/^\/admin\/star\/(?:game|g)\/([^/?#]+)/);
  if (m) {
    if (gameOf(m[1])) return m[1] as AdminGameKey;
    const g = GROUPS.find((x) => x.key === m[1]);
    if (g) return g.game;
  }
  if (path === "/admin/star") return DEFAULT_GAME;
  const own = currentPage(path);
  if (own) return groupGame(own.group);
  const first = relatedFor(path)?.pages[0];
  return first ? groupGame(first.group) : DEFAULT_GAME;
}

/** The registry page a path is on (longest match), if any. */
export function currentPage(path: string): AdminPage | undefined {
  let best: AdminPage | undefined;
  for (const p of ADMIN_PAGES) {
    if (path === p.url || path.startsWith(p.url + "/")) if (!best || p.url.length > best.url.length) best = p;
  }
  return best;
}

/**
 * Where the one back arrow goes (Harry, 20 Oct 2026: "Always top left … always
 * the same"). A page in the list → its group's page; a group page → its
 * game's home; another game's home → the first game's home; the admin home →
 * the site. Anything else → the admin home.
 */
export function backFor(path: string): { href: string; label: string } {
  const p = path.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  const g = p.match(/^\/admin\/star\/g\/([^/]+)$/);
  if (g) {
    const game = gameOf(GROUPS.find((x) => x.key === g[1])?.game ?? DEFAULT_GAME) ?? GAMES[0];
    return { href: game.home, label: game.name };
  }
  if (GAMES.some((x) => x.home === p && x.key !== DEFAULT_GAME)) return { href: GAMES[0].home, label: GAMES[0].name };
  if (p === GAMES[0].home) return { href: "/", label: "Knowitball" };
  const own = currentPage(p);
  if (own && own.url !== "/admin/star") {
    const grp = GROUPS.find((x) => x.key === own.group);
    if (grp) return { href: `/admin/star/g/${grp.key}`, label: grp.name };
  }
  return { href: GAMES[0].home, label: "Admin home" };
}

/** What admin mode lists first on this path: a label and the pages. */
export function relatedFor(path: string): { label: string; pages: AdminPage[] } | null {
  const own = currentPage(path);
  if (own && own.url !== "/star-dev") {
    const g = GROUPS.find((x) => x.key === own.group);
    const pages = ADMIN_PAGES.filter((p) => p.group === own.group && p.url !== own.url);
    return pages.length ? { label: `More in ${g?.name ?? "this group"}`, pages } : null;
  }
  let best: (typeof RELATED)[number] | undefined;
  for (const r of RELATED) {
    if (path === r.prefix || path.startsWith(r.prefix + "/") || path.startsWith(r.prefix + "?"))
      if (!best || r.prefix.length > best.prefix.length) best = r;
  }
  if (!best && path === "/") best = { prefix: "/", label: "Home page", urls: ["/admin", "/admin/xp"] };
  if (!best) return null;
  return { label: `Admin for ${best.label}`, pages: best.urls.map(pageFor).filter((p): p is AdminPage => !!p) };
}

/**
 * Test pages vs admin tools (Harry, 19 Oct 2026: "we need to differentiate what
 * are test pages for us to test new features and what are admin pages for
 * features we have and like and are tuning"). A page here is a TEST; every
 * other page is a TOOL. First sort by Claude, for Harry to correct.
 */
export const TEST_PAGES = new Set<string>([
  "/star-goal-clips-dev", "/star-update-dev", "/star-dribble-stick-dev", "/star-vfx-lab-dev", "/star-sound-lab-dev",
  "/star-real-moments-dev", "/star-real-shots-dev", "/star-real-goals-dev", "/star-intl-dev", "/star-tournament-dev",
  "/star-3d-area-dev", "/star-3d-area-dev/signing", "/star-3d-area-dev/office", "/star-shop3d-dev", "/star-garden3d-dev",
  "/star-home3d-dev", "/star-training3d-dev", "/star-style-dev", "/star-anim3d-dev", "/star-people-dev", "/star-sprites-dev",
  "/star-store-dev", "/star-wallet-dev", "/star-sim90-dev", "/star-radar-dev", "/star-relgames-dev", "/star-retirement-dev",
  "/star-animations-dev", "/star-fiveaside-dev", "/star-pc-match-dev",
]);
export const isTestPage = (url: string) => TEST_PAGES.has(url);

/** Pages a person may open: testers see "team" and "open" pages only. */
export function visibleTo(role: "admin" | "tester"): AdminPage[] {
  return role === "admin" ? ADMIN_PAGES : ADMIN_PAGES.filter((p) => p.access !== "admin");
}
