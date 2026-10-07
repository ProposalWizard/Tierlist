import { AUDIT_GROUPS } from "../../lib/star/data/clubAudit";
import { badgeDesign, badgeSvg, symbolColours } from "../../lib/star/clubBadge";
import { symbolFor, SYMBOL_ART, SYMBOL_IDS, SYMBOL_OVERRIDES, symbolSvg } from "../../lib/star/badgeSymbols";

/**
 * BADGE SYMBOLS (BADGES_PLAN.md step 2): symbols come from the club data, not
 * a hand list. Checks that every club still draws a valid badge, the same
 * badge every time, and that well-known nicknames land on the right symbol.
 */
const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const clubs = [...new Set(AUDIT_GROUPS.flatMap((g) => [...g.clubs]))];
check(clubs.length === 248, `248 clubs (got ${clubs.length})`);

// ── Every club: a valid, deterministic SVG ──────────────────────────────
const NUM = /^-?\d+(\.\d+)?$/;
for (const club of clubs) {
  const a = badgeSvg(club, "t");
  const b = badgeSvg(club, "t");
  check(a === b, `${club}: same badge twice`);
  check(a.startsWith("<svg") && a.endsWith("</svg>"), `${club}: an svg`);
  check(!/undefined|NaN|null/.test(a), `${club}: no undefined/NaN in the svg`);
  const opens = (a.match(/<(g|svg|defs|clipPath)\b/g) ?? []).length;
  const closes = (a.match(/<\/(g|svg|defs|clipPath)>/g) ?? []).length;
  check(opens === closes, `${club}: tags balance (${opens} open, ${closes} close)`);
  const d = badgeDesign(club);
  if (d.emblem === "symbol") check(!!d.symbol && a.includes(`translate(50 `), `${club}: symbol drawn`);
  const { ink, halo } = symbolColours(d);
  check(/^#[0-9A-F]{6}$/i.test(ink) && /^#[0-9A-F]{6}$/i.test(halo), `${club}: symbol colours are hex (${ink}, ${halo})`);
  check(ink.toLowerCase() !== halo.toLowerCase(), `${club}: symbol colour differs from its outline`);
}

// ── Every drawing parses as plain path numbers ──────────────────────────
for (const id of SYMBOL_IDS) {
  const pieces = SYMBOL_ART[id];
  check(pieces.length > 0 && pieces.length <= 10, `${id}: 1-10 pieces (got ${pieces.length})`);
  for (const p of pieces) {
    const tokens = p.d.replace(/[MLHVCSQTAZ]/gi, " ").split(/[\s,]+/).filter(Boolean);
    check(tokens.every((t) => NUM.test(t)), `${id}: path is numbers and commands only`);
  }
  const svg = symbolSvg(id, 50, 50, 60, "#FFFFFF", "#000000");
  check(svg.startsWith("<g") && !/NaN|undefined/.test(svg), `${id}: renders`);
}

// ── How many clubs get one, and every symbol is used ────────────────────
const picks = clubs.map((c) => [c, symbolFor(c)] as const).filter(([, p]) => p);
console.log(`${picks.length} of ${clubs.length} clubs get a symbol`);
check(picks.length >= 100 && picks.length <= 160, `between 100 and 160 clubs get a symbol (got ${picks.length})`);
check(picks.length < clubs.length, "not every club gets a symbol");
const used = new Set(picks.map(([, p]) => p!.symbol));
for (const id of SYMBOL_IDS) check(used.has(id), `${id} is used by at least one club`);
for (const [c, p] of picks) check(/^(nickname|club name|set by hand): /.test(p!.why), `${c}: has a reason (${p!.why})`);

// ── Known examples ──────────────────────────────────────────────────────
const expect: Record<string, string | null> = {
  "Arsenal": "cannon", "Newcastle United": "magpie", "Leicester City": "fox", "West Ham United": "hammers",
  "Norwich City": "canary", "Brentford": "bee", "Brighton & Hove Albion": "seagull", "Wolverhampton Wanderers": "wolf",
  "Sheffield Wednesday": "owl", "Derby County": "ram", "Sheffield United": "swords", "Southampton": "halo",
  "Aston Villa": "lion", "Sunderland": "cat", "Manchester United": "trident", "Nottingham Forest": "tree",
  "Swansea City": "swan", "Watford": "bee", "Luton Town": "hat", "Hull City": "tiger", "AFC Bournemouth": "cherry",
  "Reading FC": "crown", "Galatasaray SK": "lion", "Inter": "snake",
  // No clear word in the data: keeps the ball/star.
  "Everton": null, "Liverpool": null, "Chelsea": null, "Sparta Praha": null,
};
for (const [club, want] of Object.entries(expect)) {
  const got = symbolFor(club)?.symbol ?? null;
  check(got === want, `${club}: expected ${want}, got ${got}`);
}
// Clubs without a symbol keep the ball or star (or nothing on a star-shaped badge).
for (const club of clubs) {
  const d = badgeDesign(club);
  if (!symbolFor(club)) check(["ball", "star", "none"].includes(d.emblem), `${club}: plain emblem when no symbol`);
}
check(Object.keys(SYMBOL_OVERRIDES).length <= 10, "hand fixes stay a short list");

// ── Redos ───────────────────────────────────────────────────────────────
const redo = badgeDesign("Arsenal", { pattern: "hoops", symbol: "fox" });
check(redo.pattern === "hoops" && redo.emblem === "symbol" && redo.symbol === "fox", "a redo changes pattern and symbol");
check(badgeDesign("Arsenal", { emblem: "none" }).emblem === "none", "a redo can take the symbol away");
check(badgeDesign("Everton", { emblem: "symbol" }).emblem === "ball", "asking for the data's symbol on a club with none falls back to the ball");
check(badgeSvg("Arsenal") === badgeSvg("Arsenal", "b", undefined), "no redo = the plain badge");

if (problems.length) {
  console.error(`FAIL clubBadgeSymbols: ${problems.length} problem(s)`);
  for (const p of problems.slice(0, 40)) console.error("  - " + p);
  process.exit(1);
}
console.log("clubBadgeSymbols: all checks passed");
