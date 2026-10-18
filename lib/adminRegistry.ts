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

export type AdminSection = "rbd" | "site" | "draft" | "tierlists" | "old";
export type AdminGroup =
  | "career" | "chances" | "match" | "data" | "places3d" | "players" | "money" | "sound"
  | "site" | "draft" | "tierlists" | "old";
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

export const SECTIONS: { key: AdminSection; name: string }[] = [
  { key: "rbd", name: "Road to Ballon d'Or" },
  { key: "site", name: "Site" },
  { key: "draft", name: "PL Draft" },
  { key: "tierlists", name: "Tierlists" },
  { key: "old", name: "Old tests" },
];

/** Group order (Harry's answer ADM-Q115), and the section each sits in. */
export const GROUPS: { key: AdminGroup; name: string; section: AdminSection }[] = [
  { key: "career", name: "Career screens", section: "rbd" },
  { key: "chances", name: "Chances", section: "rbd" },
  { key: "match", name: "Match tests", section: "rbd" },
  { key: "data", name: "Real data", section: "rbd" },
  { key: "places3d", name: "3D places", section: "rbd" },
  { key: "players", name: "Players + animation", section: "rbd" },
  { key: "money", name: "Money + rewards", section: "rbd" },
  { key: "sound", name: "Sound", section: "rbd" },
  { key: "site", name: "Site", section: "site" },
  { key: "draft", name: "PL Draft", section: "draft" },
  { key: "tierlists", name: "Tierlists", section: "tierlists" },
  { key: "old", name: "Old tests", section: "old" },
];

const P = (url: string, name: string, purpose: string, section: AdminSection, group: AdminGroup,
  owner: AdminOwner, status: "live" | "old", writes: AdminWrites, access: AdminAccess): AdminPage =>
  ({ url, name, purpose, section, group, owner, status, writes, access });

export const ADMIN_PAGES: AdminPage[] = [
  P("/admin/star", "Admin home", "Every admin and test page, grouped and searchable", "site", "site", "Harry", "live", "none", "team"),
  P("/admin/videos", "Videos", "How to hand Claude a screen recording to break down", "site", "site", "Harry", "live", "none", "team"),
  P("/admin/team", "Team board", "What Harry, Mikey and Leo are doing: pushes, pull requests, live deploy, patch notes", "site", "site", "Harry", "live", "none", "admin"),
  P("/admin/patch-notes", "Patch notes", "Every patch note, newest first", "site", "site", "Shared", "live", "none", "admin"),
  P("/admin/app-plan", "App plan", "The app plan and its open questions", "site", "site", "Harry", "live", "none", "admin"),
  P("/admin/testers", "Tester access", "Tester links, remove testers", "site", "site", "Harry", "live", "shared", "admin"),
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
  P("/star-play-dev", "Play Area", "Play chances or a full match with every dial to hand", "rbd", "chances", "Harry", "live", "repo", "team"),
  P("/star-update-dev", "Leo's Oct 13 update", "Leo's Oct 13 gameplay update, Old or New", "rbd", "match", "Leo", "live", "browser", "team"),
  P("/star-sim90-dev", "Full match", "Full simulated 90 minutes", "rbd", "match", "Harry", "live", "none", "team"),
  P("/star-radar-dev", "Match radar", "Unseen match, minute by minute", "rbd", "match", "Harry", "live", "none", "team"),
  P("/star-dribble-dev", "First-person dribble", "First-person dribble duel", "rbd", "match", "Harry", "live", "none", "team"),
  P("/star-dribble-stick-dev", "Dribble on a stick", "Dribble steered by a stick", "rbd", "match", "Harry", "live", "none", "team"),
  P("/star-vfx-lab-dev", "Visual effects lab", "Pick and edit the effect for each match moment", "rbd", "players", "Leo", "live", "browser", "team"),
  P("/star-sound-lab-dev", "Sound lab", "Hear, edit, rate match sounds", "rbd", "sound", "Leo", "live", "browser", "team"),
  P("/star-real-moments-dev", "Real moments", "StatsBomb positions, playable", "rbd", "data", "Mikey", "live", "none", "admin"),
  P("/star-statsbomb-dev", "Real shots", "WC/Euro shots, playable", "rbd", "data", "Harry", "live", "none", "admin"),
  P("/star-intl-dev", "International world", "Call-ups, national managers and every international competition", "rbd", "data", "Mikey", "live", "none", "team"),
  P("/star-tournament-dev", "Tournaments", "Draw and play a whole Euros or World Cup in seconds", "rbd", "data", "Leo", "live", "none", "team"),
  P("/lineups", "Team sheets", "Every club's XI, bench, manager", "rbd", "data", "Harry", "live", "shared", "admin"),
  P("/admin/clubs", "Club data", "Every club's data, with the gaps marked", "rbd", "data", "Mikey", "live", "none", "admin"),
  P("/admin/badges", "Club badges", "Club badges, redo on device", "rbd", "data", "Harry", "live", "browser", "admin"),
  P("/admin/custom-clubs", "Custom clubs", "Invent a club", "rbd", "data", "Mikey", "live", "shared", "admin"),
  P("/star-3d-area-dev", "3D test area", "Every 3D scene in one list, plus the 3D file store", "rbd", "places3d", "Harry", "live", "none", "team"),
  P("/star-3d-area-dev/signing", "3D signing", "Live 3D signing", "rbd", "places3d", "Harry", "live", "none", "team"),
  P("/star-3d-area-dev/office", "Manager's office", "Manager's office stage", "rbd", "places3d", "Harry", "live", "none", "team"),
  P("/star-shop3d-dev", "3D shop", "Walk-around 3D shop", "rbd", "places3d", "Harry", "live", "none", "team"),
  P("/star-garden3d-dev", "3D garden", "Walk round the 3D garden", "rbd", "places3d", "Mikey", "live", "none", "team"),
  P("/star-home3d-dev", "3D house", "Walk round the 3D house", "rbd", "places3d", "Harry", "live", "none", "team"),
  P("/star-training3d-dev", "3D training", "3D training pitch", "rbd", "places3d", "Harry", "live", "none", "team"),
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

/** The registry page a path is on (longest match), if any. */
export function currentPage(path: string): AdminPage | undefined {
  let best: AdminPage | undefined;
  for (const p of ADMIN_PAGES) {
    if (path === p.url || path.startsWith(p.url + "/")) if (!best || p.url.length > best.url.length) best = p;
  }
  return best;
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

/** Pages a person may open: testers see "team" and "open" pages only. */
export function visibleTo(role: "admin" | "tester"): AdminPage[] {
  return role === "admin" ? ADMIN_PAGES : ADMIN_PAGES.filter((p) => p.access !== "admin");
}
