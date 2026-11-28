/**
 * THE MATCHDAY PROGRAMME the match's loading screen shows (Harry, 27 Nov
 * 2026: "the match day programme" for matches). Every word on it comes from
 * the real fixture and the career: both clubs, their kits, the competition,
 * the date, the ground, your form, the table, your season and a fact about
 * the home club from the club sheets. Nothing invented: a page with nothing
 * real to say is left out. Pure (tests/star/loadingScreens.mts).
 */
import type { CareerState, Fixture } from "../types";
import { kitsOf, labelInk } from "../kits";
import { profileOf } from "../data/clubProfiles";
import { divisionOf, fixtureDateLabel, leagueNameFor } from "../calendar";
import { sortLeague } from "../season";
import { shortClub } from "../media/grammar";

export interface ProgrammeSide {
  name: string;
  short: string;
  shirt: string;
  trim: string;
  /** Words on the shirt colour. */
  ink: string;
  /** League place, when both clubs are in your league table. */
  pos?: number;
}

export interface ProgrammeStat { v: string; l: string }

export interface ProgrammeData {
  home: ProgrammeSide;
  away: ProgrammeSide;
  /** "Premier League", "FA Cup · Third Round". */
  comp: string;
  /** "Sat 8 Aug". */
  date: string;
  /** The home club's ground, when the sheets have it. */
  venue?: string;
  /** Matchweek (the issue number) and season. */
  issue: number;
  season: number;
  /** Your club's last five results, oldest first. */
  form: ("W" | "D" | "L")[];
  /** Player in focus: you. */
  you: { name: string; club: string; stats: ProgrammeStat[]; line?: string };
  /** Club fact: the home club. */
  fact?: { title: string; stats: ProgrammeStat[]; line?: string };
  /** The last time these two met in this career, from your side. */
  lastMeeting?: string;
  derby?: boolean;
}

function result(f: Fixture): "W" | "D" | "L" | null {
  if (!f.played || f.homeScore === undefined || f.awayScore === undefined) return null;
  const us = f.home ? f.homeScore : f.awayScore, them = f.home ? f.awayScore : f.homeScore;
  return us > them ? "W" : us < them ? "L" : "D";
}

const fmt = (n: number) => n.toLocaleString("en-GB");

export function programmeFor(career: CareerState, fixture: Fixture): ProgrammeData {
  const mine = career.player.club;
  const homeName = fixture.home ? mine : fixture.opponent;
  const awayName = fixture.home ? fixture.opponent : mine;
  const side = (name: string): ProgrammeSide => {
    const k = kitsOf(name, career.clubKits?.[name]).home;
    return { name, short: shortClub(name), shirt: k.shirt, trim: k.trim, ink: labelInk(k.shirt) };
  };
  const home = side(homeName), away = side(awayName);
  const table = sortLeague(career.league ?? []);
  const posOf = (n: string) => { const i = table.findIndex((t) => t.name === n); return i >= 0 ? i + 1 : undefined; };
  if (!fixture.kind || fixture.kind === "league") {
    home.pos = posOf(homeName);
    away.pos = posOf(awayName);
  }
  const division = divisionOf(career);
  const comp = !fixture.kind || fixture.kind === "league"
    ? leagueNameFor(division)
    : fixture.round ? `${fixture.competition ?? "Cup"} · ${fixture.round}` : fixture.competition ?? "Cup";
  let date = "";
  try { date = fixtureDateLabel(career.player.startYear, career.season, fixture.week, fixture.kind, division); } catch { date = ""; }
  const prof = profileOf(homeName);
  const played = (career.fixtures ?? []).filter((f) => f.played && result(f));
  const form = played.slice(-5).map((f) => result(f)!) as ("W" | "D" | "L")[];

  const s = career.seasonStats;
  const apps = s?.appearances ?? 0;
  const stats: ProgrammeStat[] = [
    { v: String(s?.goals ?? 0), l: "Goals" },
    { v: String(s?.assists ?? 0), l: "Assists" },
    { v: apps ? (s.ratingCount ? (s.totalRating / s.ratingCount).toFixed(1) : "–") : "–", l: "Avg rating" },
    { v: String(apps), l: "Games" },
  ];
  const you = {
    name: `${career.player.firstName} ${career.player.lastName}`.trim(),
    club: shortClub(mine),
    stats,
    line: apps === 0 ? "No games yet this season. Today could be the first." : undefined,
  };

  let fact: ProgrammeData["fact"];
  if (prof && (prof.stadium || prof.capacity || prof.founded)) {
    const fs: ProgrammeStat[] = [];
    if (prof.capacity) fs.push({ v: fmt(prof.capacity), l: "Capacity" });
    if (prof.founded) fs.push({ v: String(prof.founded), l: "Founded" });
    fact = { title: prof.stadium ?? shortClub(homeName), stats: fs, line: prof.nickname ? `${shortClub(homeName)}: "${prof.nickname}"` : undefined };
  }

  const met = played.filter((f) => f.opponent === fixture.opponent).pop();
  let lastMeeting: string | undefined;
  if (met && met.homeScore !== undefined && met.awayScore !== undefined) {
    const r = result(met);
    const us = met.home ? met.homeScore : met.awayScore, them = met.home ? met.awayScore : met.homeScore;
    lastMeeting = `${r === "W" ? "Won" : r === "L" ? "Lost" : "Drew"} ${us}–${them} last time`;
  }

  return {
    home, away, comp, date, venue: prof?.stadium, issue: Math.max(1, fixture.week), season: career.season,
    form, you, fact, lastMeeting, derby: !!fixture.derby,
  };
}
