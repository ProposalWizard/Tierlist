/**
 * EVERY CLUB'S PROFILE — one place for everything given about a club
 * (Mikey, 2 Oct 2026: "I want to make sure that you never lose this
 * information again or are unsure about it for every single club").
 *
 * Built from the spreadsheets exactly as given (clubProfileData.ts, generated
 * from lib/star/data/football-club-database.csv and
 * lib/star/data/sources/*.xlsx by scripts/club-data/build_club_profile_data.py).
 * A new sheet = a new source file + a new block in that script + a merge line
 * below; never hand-edit the generated data.
 *
 * What reads it:
 *   - /admin/clubs shows every club with every field, gaps highlighted.
 *   - The game falls back to it wherever its own table has nothing for a club:
 *     club size (clubReputation.ts), stadium (stadiums.ts, facilities.ts),
 *     training/youth (facilities.ts), prestige (investments.ts), rivalries
 *     (rivalries.ts), kits (kits.ts), the manager's name (lineupStore.ts).
 *
 * "Verify", "Your call" and blanks mean nothing was given: they read as
 * missing (undefined), so the admin page flags them and the game falls back.
 *
 * Pure: no React.
 */
import { CLUB_SHEET_2026_09, REGIONAL_SHEET_2026_10 } from "./clubProfileData";

export interface KitInfo {
  shirt?: string;
  trim?: string;
  pattern?: string;
  /** The colour words as hex, for the game's kit drawing. */
  shirtHex?: string;
  trimHex?: string;
}

export interface ProfileRival { club: string; tier?: "R1" | "R2" | "R3"; derby: boolean }

export interface ClubProfile {
  club: string;
  /** Which sheet(s) this came from. */
  sources: string[];
  nickname?: string;
  founded?: string;
  country?: string;
  homeKit?: KitInfo;
  awayKit?: KitInfo;
  badgeColours?: string[];
  badgeStyle?: string;
  stadium?: string;
  capacity?: number;
  /** 1-10 ratings, as given. */
  training?: number;
  youth?: number;
  currentRep?: number;
  historicalRep?: number;
  transferSpending?: number;
  leagueTitles?: string;
  domesticCups?: string;
  europeanTrophies?: string;
  ballonDor?: string;
  transferStrategy?: string;
  /** 0-100, as given (the game's club size). */
  clubSize?: number;
  /** Average player rating for the division, as given. */
  avgRating?: number;
  rivals?: ProfileRival[];
  winChant?: string;
  playerChant?: string;
  manager?: string;
  formation?: string;
  notes?: string;
}

/** Colour words as given, to hex. */
export const COLOUR_WORDS: Record<string, string> = {
  white: "#F2F4F7", black: "#17181A", red: "#D71920", blue: "#0057B8", "royal blue": "#1F4FB5",
  navy: "#001F5B", "sky blue": "#6CABDD", yellow: "#FBE300", amber: "#F2A900", gold: "#D4A72C",
  orange: "#F78F1E", "dark orange": "#C85A12", claret: "#6C1D45", maroon: "#7A263A",
  purple: "#5B2A86", grey: "#8A8F98", green: "#159C56", turquoise: "#1CC7C1",
  "dark turquoise": "#0F8C8A", teal: "#0B7A75",
};

const MISSING = /^(verify|your call|tbc|unknown|-|n\/a)?$/i;
const str = (v: string | undefined): string | undefined => {
  const t = (v ?? "").trim();
  return MISSING.test(t) ? undefined : t;
};
const num = (v: string | undefined): number | undefined => {
  const t = str(v);
  if (t === undefined) return undefined;
  const n = Number(t.replace(/,/g, ""));
  return Number.isFinite(n) ? n : undefined;
};
const hex = (word: string | undefined): string | undefined => (word ? COLOUR_WORDS[word.toLowerCase()] : undefined);
const kit = (shirt?: string, trim?: string, pattern?: string): KitInfo | undefined => {
  const s = str(shirt), t = str(trim), p = str(pattern);
  if (!s && !t && !p) return undefined;
  // "None" as a trim (Salisbury's plain white): no second colour, so the
  // drawing gets a contrasting edge instead.
  const trimWord = t && t.toLowerCase() !== "none" ? t : undefined;
  const shirtHex = hex(s);
  return {
    shirt: s, trim: t, pattern: p, shirtHex,
    trimHex: hex(trimWord) ?? (shirtHex === COLOUR_WORDS.white ? COLOUR_WORDS.black : COLOUR_WORDS.white),
  };
};
const tier = (v?: string) => (v === "R1" || v === "R2" || v === "R3" ? v : undefined);

function fromClubSheet(r: Record<string, string>): ClubProfile {
  return {
    club: r["Club"],
    sources: ["Club sheet, 14 Sep 2026"],
    founded: str(r["Founded"]),
    country: str(r["Country"]),
    stadium: str(r["Stadium"]),
    capacity: num(r["Capacity"]),
    training: num(r["Training Facilities /10"]),
    youth: num(r["Youth Facilities /10"]),
    currentRep: num(r["Current World Reputation /10"]),
    historicalRep: num(r["Historical World Reputation /10"]),
    transferSpending: num(r["Transfer Spending /10"]),
    leagueTitles: str(r["League Titles"])?.replace(/^Not yet entered$/i, "") || undefined,
    domesticCups: str(r["Domestic Cup Wins"])?.replace(/^Not yet entered$/i, "") || undefined,
    europeanTrophies: str(r["European Trophies"])?.replace(/^Not yet entered$/i, "") || undefined,
    ballonDor: str(r["Ballon d'Or Winners Played For Club"]),
    transferStrategy: str(r["Transfer Strategy"]),
  };
}

function fromRegionalSheet(r: Record<string, string>): ClubProfile {
  const rivals: ProfileRival[] = [];
  for (const i of [1, 2, 3]) {
    const club = str(r[`rival${i}`]);
    if (club) rivals.push({ club, tier: tier(r[`rival${i}Tier`]), derby: /^yes$/i.test(r[`rival${i}Derby`] ?? "") });
  }
  const badge = [r.badge1, r.badge2, r.badge3].map(str).filter((b): b is string => !!b);
  const chant = (v?: string) => (str(v) && !/none confidently verified/i.test(v!) ? str(v) : undefined);
  return {
    club: r.club,
    sources: ["North/South sheet, 2 Oct 2026"],
    nickname: str(r.nickname),
    founded: str(r.founded),
    country: str(r.country),
    homeKit: kit(r.homeShirt, r.homeTrim, r.homePattern),
    awayKit: kit(r.awayShirt, r.awayTrim, r.awayPattern),
    badgeColours: badge.length ? badge : undefined,
    badgeStyle: str(r.badgeStyle),
    stadium: str(r.stadium),
    capacity: num(r.capacity),
    training: num(r.training),
    youth: num(r.youth),
    leagueTitles: str(r.leagueTitles),
    domesticCups: str(r.domesticCups),
    europeanTrophies: str(r.europeanTrophies),
    currentRep: num(r.currentRep),
    historicalRep: num(r.historicalRep),
    ballonDor: str(r.ballonDor),
    transferSpending: num(r.transferSpending),
    transferStrategy: str(r.transferStrategy),
    clubSize: num(r.clubSize),
    avgRating: num(r.avgRating),
    rivals: rivals.length ? rivals : undefined,
    winChant: chant(r.winChant),
    playerChant: chant(r.playerChant),
    manager: str(r.manager),
    formation: str(r.formation),
    notes: str(r.notes),
  };
}

/** Later sheets fill in and override earlier ones, field by field. */
function merge(a: ClubProfile | undefined, b: ClubProfile): ClubProfile {
  if (!a) return b;
  const out: ClubProfile = { ...a, sources: [...a.sources, ...b.sources] };
  for (const [k, v] of Object.entries(b)) {
    if (k === "sources" || k === "club" || v === undefined) continue;
    (out as unknown as Record<string, unknown>)[k] = v;
  }
  return out;
}

export const CLUB_PROFILES: Record<string, ClubProfile> = (() => {
  const all: Record<string, ClubProfile> = {};
  for (const r of CLUB_SHEET_2026_09) if (r["Club"]) all[r["Club"]] = merge(all[r["Club"]], fromClubSheet(r));
  for (const r of REGIONAL_SHEET_2026_10) if (r.club) all[r.club] = merge(all[r.club], fromRegionalSheet(r));
  return all;
})();

export function profileOf(club: string): ClubProfile | undefined {
  return CLUB_PROFILES[club];
}

/** The fields shown on /admin/clubs, in order, with how to read each one. */
export const PROFILE_FIELDS: { key: keyof ClubProfile; label: string }[] = [
  { key: "nickname", label: "Nickname" },
  { key: "founded", label: "Founded" },
  { key: "country", label: "Country" },
  { key: "homeKit", label: "Home kit" },
  { key: "awayKit", label: "Away kit" },
  { key: "badgeColours", label: "Badge colours" },
  { key: "badgeStyle", label: "Badge style" },
  { key: "stadium", label: "Stadium" },
  { key: "capacity", label: "Capacity" },
  { key: "training", label: "Training /10" },
  { key: "youth", label: "Youth /10" },
  { key: "currentRep", label: "Current rep /10" },
  { key: "historicalRep", label: "Historical rep /10" },
  { key: "transferSpending", label: "Transfer spending /10" },
  { key: "transferStrategy", label: "Transfer strategy" },
  { key: "leagueTitles", label: "League titles" },
  { key: "domesticCups", label: "Domestic cups" },
  { key: "europeanTrophies", label: "European trophies" },
  { key: "ballonDor", label: "Ballon d'Or winners" },
  { key: "avgRating", label: "Avg player rating" },
  { key: "rivals", label: "Rivals" },
  { key: "winChant", label: "Win chant" },
  { key: "playerChant", label: "Player chant" },
  { key: "manager", label: "Manager" },
  { key: "formation", label: "Formation" },
];
