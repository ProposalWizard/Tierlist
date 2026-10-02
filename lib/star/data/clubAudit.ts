/**
 * CLUB DATA AUDIT — every club in the game, every piece of information the
 * game uses about it, and whether that piece was GIVEN, is the game GUESSING,
 * or is MISSING (Mikey, 2 Oct 2026: "something which tracks every single
 * thing and also allows me to see it so that I can identify if anything's
 * missing"). Shown on /admin/clubs.
 *
 * Reads the same tables the game reads, so a gap here is a gap in the game.
 * Pure: no React, no network (the club badge images live in the database and
 * are checked by the page itself).
 */
import {
  PREMIER_LEAGUE_CLUBS, CHAMPIONSHIP_CLUBS, LEAGUE_ONE_CLUBS, LEAGUE_TWO_CLUBS,
  NATIONAL_LEAGUE_CLUBS, NATIONAL_LEAGUE_NORTH_CLUBS, NATIONAL_LEAGUE_SOUTH_CLUBS,
  STEP3_NORTH_CLUBS, STEP3_SOUTH_CLUBS, CHAMPIONS_LEAGUE_CLUBS, EUROPA_LEAGUE_CLUBS,
  OTHER_CLUBS, CLUB_SHORT_NAMES,
} from "../clubs";
import { CLUB_KITS } from "../kits";
import { GROUNDS } from "../stadiums";
import { CLUB_REPUTATION } from "../clubReputation";
import { CLUB_RIVALRIES } from "../rivalries";
import { CLUB_LATITUDE } from "../nonLeagueRegions";
import { CLUB_WIN_CHANTS } from "../media/chants";
import { CLUB_DATABASE } from "./footballClubDatabase";
import { profileOf, type ClubProfile } from "./clubProfiles";

/** given = from you; guess = the game makes it up; missing = nothing at all;
 *  researched = filled by research (sources/researched_2026-10.json), with
 *  its source in the note; na = doesn't apply to this club. */
export type AuditStatus = "given" | "researched" | "guess" | "missing" | "na";

export interface AuditCell { value: string; status: AuditStatus; note?: string }

export interface AuditRow {
  club: string;
  group: string;
  cells: Record<string, AuditCell>;
}

export const AUDIT_GROUPS: { name: string; clubs: readonly string[]; english: boolean; nonLeague: boolean }[] = [
  { name: "Premier League", clubs: PREMIER_LEAGUE_CLUBS, english: true, nonLeague: false },
  { name: "Championship", clubs: CHAMPIONSHIP_CLUBS, english: true, nonLeague: false },
  { name: "League One", clubs: LEAGUE_ONE_CLUBS, english: true, nonLeague: false },
  { name: "League Two", clubs: LEAGUE_TWO_CLUBS, english: true, nonLeague: false },
  { name: "National League", clubs: NATIONAL_LEAGUE_CLUBS, english: true, nonLeague: true },
  { name: "National League North", clubs: NATIONAL_LEAGUE_NORTH_CLUBS, english: true, nonLeague: true },
  { name: "National League South", clubs: NATIONAL_LEAGUE_SOUTH_CLUBS, english: true, nonLeague: true },
  { name: "Step 3 North (waiting)", clubs: STEP3_NORTH_CLUBS, english: true, nonLeague: true },
  { name: "Step 3 South (waiting)", clubs: STEP3_SOUTH_CLUBS, english: true, nonLeague: true },
  { name: "Champions League", clubs: CHAMPIONS_LEAGUE_CLUBS, english: false, nonLeague: false },
  { name: "Europa League", clubs: EUROPA_LEAGUE_CLUBS, english: false, nonLeague: false },
  { name: "Other", clubs: OTHER_CLUBS, english: false, nonLeague: false },
];

/** The columns, in order. `logo` is filled in by the page (it's in the database). */
export const AUDIT_COLUMNS: { key: string; label: string }[] = [
  { key: "shortName", label: "Short name" },
  { key: "nickname", label: "Nickname" },
  { key: "founded", label: "Founded" },
  { key: "country", label: "Country" },
  { key: "kits", label: "Kits (home / away)" },
  { key: "kitPattern", label: "Kit pattern" },
  { key: "badge", label: "Badge colours" },
  { key: "badgeStyle", label: "Badge style" },
  { key: "logo", label: "Badge picture" },
  { key: "stadium", label: "Stadium" },
  { key: "capacity", label: "Capacity" },
  { key: "training", label: "Training /10" },
  { key: "youth", label: "Youth /10" },
  { key: "currentRep", label: "Current rep /10" },
  { key: "historicalRep", label: "Historical rep /10" },
  { key: "transferSpending", label: "Transfer spending /10" },
  { key: "transferStrategy", label: "Transfer strategy" },
  { key: "clubSize", label: "Club size /100" },
  { key: "avgRating", label: "Avg player rating" },
  { key: "leagueTitles", label: "League titles" },
  { key: "domesticCups", label: "Domestic cups" },
  { key: "europeanTrophies", label: "European trophies" },
  { key: "ballonDor", label: "Ballon d'Or winners" },
  { key: "rivals", label: "Rivals" },
  { key: "winChant", label: "Win chant" },
  { key: "playerChant", label: "Player chant" },
  { key: "manager", label: "Manager" },
  { key: "formation", label: "Formation" },
  { key: "region", label: "North/South placing" },
];

const given = (value: string | number | undefined, note?: string): AuditCell | null =>
  value === undefined || value === "" ? null : { value: String(value), status: "given", note };
const missing = (note?: string): AuditCell => ({ value: "", status: "missing", note });
const na = (): AuditCell => ({ value: "", status: "na" });

/** The manager and formation saved on the Lineups page, if the page has them. */
export interface LineupInfo { manager?: string; formation?: string }

export function auditClub(
  club: string, group: (typeof AUDIT_GROUPS)[number], lineup?: LineupInfo,
): AuditRow {
  const p: ClubProfile | undefined = profileOf(club);
  const db = CLUB_DATABASE[club];
  const c: Record<string, AuditCell> = {};
  const field = (key: keyof ClubProfile, fallback?: AuditCell) => {
    const v = p?.[key];
    c[key] = given(typeof v === "number" || typeof v === "string" ? v : undefined) ?? fallback ?? missing();
  };

  c.shortName = group.english
    ? given(CLUB_SHORT_NAMES[club]) ?? missing("The game cuts the name down itself")
    : na();
  field("nickname");
  field("founded");
  field("country");

  const kit = CLUB_KITS[club];
  const kitWords = p?.homeKit?.shirt
    ? `${p.homeKit.shirt}/${p.homeKit.trim ?? ""} · ${p.awayKit?.shirt ?? "?"}/${p.awayKit?.trim ?? ""}`
    : kit ? `${kit.home.shirt}/${kit.home.trim} · ${kit.away.shirt}/${kit.away.trim}` : "";
  // Value is the four colours as hex (the page draws them); the words, when
  // given, go in the note.
  c.kits = kit
    ? { value: `${kit.home.shirt} ${kit.home.trim} ${kit.away.shirt} ${kit.away.trim}`, status: "given", note: kitWords }
    : missing("Plays in a plain green kit");
  c.kitPattern = given(p?.homeKit?.pattern ? (p.awayKit?.pattern ? `${p.homeKit.pattern} / ${p.awayKit.pattern}` : p.homeKit.pattern) : undefined) ?? missing();
  c.badge = given(p?.badgeColours?.join(", ")) ?? missing();
  field("badgeStyle");
  c.logo = { value: "", status: "missing", note: "Checked on the page" };

  const ground = GROUNDS[club];
  c.stadium = given(ground?.name ?? p?.stadium) ?? { value: `${club} Stadium`, status: "guess", note: "Made-up name" };
  c.capacity = given(ground?.capacity ?? p?.capacity) ?? { value: p?.stadium ? "3,000" : "28,000", status: "guess" };
  field("training", db ? given(db.trainingRating) ?? undefined : { value: "", status: "guess", note: "Rolled from the club's name" });
  field("youth", db ? given(db.youthRating) ?? undefined : { value: "", status: "guess", note: "Rolled from the club's name" });
  field("currentRep", db ? given(db.currentReputation) ?? undefined : undefined);
  field("historicalRep", db ? given(db.historicalReputation) ?? undefined : undefined);
  field("transferSpending");
  field("transferStrategy");

  if (p?.clubSize !== undefined) c.clubSize = { value: String(p.clubSize), status: "given" };
  else if (CLUB_REPUTATION[club] !== undefined) c.clubSize = { value: String(CLUB_REPUTATION[club]), status: "given", note: "From the game's own size table" };
  else if (db) c.clubSize = { value: String(Math.round(10 + ((db.currentReputation - 1) / 9) * 90)), status: "guess", note: "Worked out from current rep" };
  else c.clubSize = { value: "20", status: "guess", note: "Default size" };

  // Real squads exist above the National League, so a typed average only
  // matters from there down.
  c.avgRating = group.nonLeague ? given(p?.avgRating) ?? { value: "", status: "guess", note: "Division default" } : na();
  field("leagueTitles");
  field("domesticCups");
  field("europeanTrophies");
  field("ballonDor");

  const rivals = CLUB_RIVALRIES[club]?.map(r => r.club) ?? p?.rivals?.map(r => r.club);
  c.rivals = given(rivals?.join(", ")) ?? missing();
  c.winChant = given(CLUB_WIN_CHANTS[club]?.join(" / ") ?? p?.winChant) ?? missing();
  field("playerChant");
  c.manager = given(lineup?.manager || p?.manager, lineup?.manager ? "Lineups page" : undefined) ?? missing();
  c.formation = given(lineup?.formation || p?.formation) ?? missing();
  c.region = group.nonLeague
    ? given(CLUB_LATITUDE[club] !== undefined ? `${CLUB_LATITUDE[club]}° north` : undefined) ?? missing("Placed in the middle of England")
    : na();

  // Boxes filled by research rather than given: own colour, source as the note.
  for (const [key, source] of Object.entries(p?.researched ?? {})) {
    const cell = c[key];
    if (cell && cell.status === "given" && cell.note !== "Lineups page") {
      c[key] = { ...cell, status: "researched", note: source };
    }
  }
  return { club, group: group.name, cells: c };
}

/** Every club once, in ladder order (a club in two lists shows in the first). */
export function auditAll(lineups: Record<string, LineupInfo> = {}): AuditRow[] {
  const seen = new Set<string>();
  const out: AuditRow[] = [];
  for (const g of AUDIT_GROUPS) {
    for (const club of g.clubs) {
      if (seen.has(club)) continue;
      seen.add(club);
      out.push(auditClub(club, g, lineups[club]));
    }
  }
  return out;
}
