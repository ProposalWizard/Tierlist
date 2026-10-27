/**
 * WHAT EACH ROBLOX SCREEN SHOWS, AND WHAT ITS BUTTONS DO.
 *
 * The Roblox client is a plain drawer: it is sent a Screen (title, blocks of
 * text, tables and lists, buttons) and sends back the button's action. All
 * the deciding stays here, on the website's own functions, and converts to
 * Roblox with everything else (so it is twin-tested too).
 *
 *   screen(game)          -> the Screen to draw now
 *   act(game, action, a)  -> the game after a button press
 *   setupScreen()         -> the new-career screen (no game yet)
 *   startGame(choice)     -> a new game from the new-career screen
 */
import * as F from "./flow";
import type { Game } from "./flow";
import type { CareerState, Fixture, StarPlayer } from "../../lib/star/types";
import { leagueNameFor, seasonStartYear, fixtureDateLabel, divisionOf, type CareerDivision } from "../../lib/star/calendar";
import { fixtureLabel, leaguePosition, nextFixtureFor } from "../../lib/star/competitions";
import { sortLeague } from "../../lib/star/season";
import { starStatus } from "../../lib/star/starPoints";
import { clubsForDivision } from "../../lib/star/scoutOffers";
import { ALL_NATIONALITIES } from "../../lib/nationalities";
import { STAR_FIFA_YEAR } from "../../lib/star/edition";
import { willingToRenegotiate } from "../../lib/star/careerFlow";
import { startNegotiation, makeOffer, type NegotiationState } from "../../lib/star/negotiation";
import { shortClub } from "../../lib/star/media/grammar";
import type { TransferOffer } from "../../lib/star/transfers";
import * as TF from "./trialFlow";
import * as TR from "./trainingFlow";
import * as LF from "./lifeFlow";
import { trainingLeft } from "../../lib/star/week";
import { STAGE_LABEL, TRIAL_STAGES, trialScore } from "../../lib/star/trial";

// ───────────────────────────────────────────────────────────── the screen ──

export type Tone = "normal" | "good" | "bad" | "gold" | "dim";
export type Block =
  | { kind: "heading"; text: string }
  | { kind: "text"; text: string; tone?: Tone }
  | { kind: "stats"; items: { label: string; value: string; tone?: Tone }[] }
  | { kind: "table"; columns: string[]; rows: string[][]; highlight?: number }
  | { kind: "list"; items: { text: string; sub?: string; tone?: Tone; action?: string; arg?: string }[] }
  | { kind: "input"; id: string; label: string; value: string }
  | { kind: "choice"; id: string; label: string; options: string[]; value: string };
export interface Button { label: string; action: string; arg?: string; style?: "primary" | "secondary" | "danger" }
export interface Screen {
  id: string;
  /** The bar on top: who you are and how you stand. */
  hud: { name: string; club: string; league: string; season: string; money: string; stars: number; energy: number } | null;
  title: string;
  tabs?: { id: string; label: string; active: boolean }[];
  blocks: Block[];
  buttons: Button[];
}

/** Screen-only state the website keeps in components (tabs, the two mini-games). */
export interface UiState {
  tab?: string;
  renewal?: { current: number; next: number | null; wins: number; locked: boolean; rounds: number; message: string; started: boolean };
  talk?: NegotiationState | null;
  ask?: number;
  /** Training: the skill whose levels are open, and the last session's result line. */
  trainSkill?: string;
  trainResult?: string;
  /** Life: which page is open (a shop, sponsors, the day off, the office talk), its last line, the talk under way. */
  life?: string;
  lifeNote?: string;
  bossTalk?: LF.TalkState;
}
export type RobloxGame = Game & { ui?: UiState };

// ─────────────────────────────────────────────────────────────── helpers ──

export function money(n: number): string {
  const sign = n < 0 ? "-" : "";
  const a = Math.abs(Math.round(n));
  if (a >= 1_000_000) return `${sign}£${(a / 1_000_000).toFixed(a >= 10_000_000 ? 0 : 1)}m`;
  if (a >= 10_000) return `${sign}£${Math.round(a / 1000)}k`;
  return `${sign}£${a.toLocaleString("en-GB")}`;
}

function hud(c: CareerState): Screen["hud"] {
  const start = seasonStartYear(c.player.startYear, c.season);
  return {
    name: `${c.player.firstName} ${c.player.lastName}`,
    club: c.player.club,
    league: c.player.club ? leagueNameFor(divisionOf(c)) : "",
    season: `${start}/${String((start + 1) % 100).padStart(2, "0")} · age ${c.player.age}`,
    money: money(c.money),
    stars: starStatus(c).stars,
    energy: Math.round(c.energy),
  };
}

function fixtureLine(c: CareerState, f: Fixture): string {
  const where = f.home ? "v" : "at";
  const comp = f.kind && f.kind !== "league" ? fixtureLabel(f) : leagueNameFor(divisionOf(c));
  return `${comp}: ${where} ${f.opponent}`;
}

function dateOf(c: CareerState, f: Fixture): string {
  try { return fixtureDateLabel(c.player.startYear, c.season, f.week, f.kind, divisionOf(c)); } catch { return `Week ${f.week}`; }
}

/** A played fixture's score from your side. */
function score(f: Fixture): { us: number; them: number } | null {
  if (!f.played || f.homeScore === undefined || f.awayScore === undefined) return null;
  return f.home ? { us: f.homeScore, them: f.awayScore } : { us: f.awayScore, them: f.homeScore };
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

const TABS = [["home", "Home"], ["train", "Train"], ["life", "Life"], ["league", "League"], ["fixtures", "Fixtures"], ["stats", "Stats"]] as const;

// ─────────────────────────────────────────────────────── the new career ──

export const DIVISIONS: CareerDivision[] = ["premier", "championship", "league_one", "league_two", "national_league", "national_league_north", "national_league_south"];

export function setupScreen(): Screen {
  return {
    id: "setup", hud: null, title: "Road to Ballon d'Or",
    blocks: [
      { kind: "text", text: "A new career. You are a striker, 17, at the start of the season." },
      { kind: "input", id: "firstName", label: "First name", value: "" },
      { kind: "input", id: "lastName", label: "Last name", value: "" },
      { kind: "choice", id: "nationality", label: "Nationality", options: ALL_NATIONALITIES, value: "England" },
      { kind: "choice", id: "division", label: "League", options: DIVISIONS.map(leagueNameFor), value: leagueNameFor("league_two") },
      { kind: "text", text: "Next, pick your club in that league.", tone: "dim" },
    ],
    buttons: [{ label: "Choose a club", action: "setup-clubs", style: "primary" }],
  };
}

export function divisionByName(name: string): CareerDivision {
  return DIVISIONS.find((d) => leagueNameFor(d) === name) ?? "league_two";
}

export function clubScreen(divisionName: string): Screen {
  const div = divisionByName(divisionName);
  return {
    id: "setup-clubs", hud: null, title: leagueNameFor(div),
    blocks: [{ kind: "list", items: clubsForDivision(div).slice().sort((a, b) => a.localeCompare(b)).map((c) => ({ text: c, action: "start", arg: c })) }],
    buttons: [{ label: "Back", action: "setup", style: "secondary" }],
  };
}

export interface SetupChoice { firstName: string; lastName: string; nationality: string; division: string; club: string }

export function startGame(choice: SetupChoice): RobloxGame {
  const div = divisionByName(choice.division);
  const clubs = clubsForDivision(div);
  if (!clubs.includes(choice.club)) throw new Error(`${choice.club} is not in ${leagueNameFor(div)}`);
  const player = {
    firstName: (choice.firstName || "Kai").trim(), lastName: (choice.lastName || "Ball").trim(), age: 17, skinTone: "tan",
    club: choice.club, clubBadge: null, position: "ST", nationality: choice.nationality || "England", startYear: STAR_FIFA_YEAR,
  } as StarPlayer;
  // handleProfileComplete: no club yet; the trial at the club picked decides where you start
  return { career: TF.newTrialCareer(player, div), phase: "trial", koShown: [], ui: { tab: "home" } };
}

/** The career-soak start (tests only): signed straight to the club picked, no trial. */
export function startWithoutTrial(choice: SetupChoice): RobloxGame {
  const div = divisionByName(choice.division);
  const clubs = clubsForDivision(div);
  const player = {
    firstName: (choice.firstName || "Kai").trim(), lastName: (choice.lastName || "Ball").trim(), age: 17, skinTone: "tan",
    club: choice.club, clubBadge: null, position: "ST", nationality: choice.nationality || "England", startYear: STAR_FIFA_YEAR,
  } as StarPlayer;
  return { ...F.newGame(player, [...clubs], div), ui: { tab: "home" } };
}

/** With no device to play it on (tests), the trial is played by nobody: every stage at half marks. */
function simTrial(g: RobloxGame): RobloxGame {
  const t = g.career.trial;
  if (!t) return g;
  const results = TRIAL_STAGES.filter((stage) => !t.results[stage]).map((stage) => ({ stage: stage as string, quality: 0.5 }));
  return trialDone(g, { results, finalPenScored: false }) ?? g;
}

/** The device's trial results into the career, then the manager's talk (or, with nobody in for you, a youth team). */
export function trialDone(g: RobloxGame, back: TF.TrialReturn): RobloxGame | null {
  const recorded = TF.recordTrialReturn(g.career, back);
  if (!recorded) return null;
  if (TF.managerTalk(recorded)) return { ...g, career: recorded, phase: "manager-talk" };
  const youth = TF.youthAfterTrial(recorded);
  return youth ? { ...F.afterSigning({ ...g, career: youth }), ui: g.ui } : { ...g, career: recorded, phase: "manager-talk" };
}

function trialScreen(g: RobloxGame): Screen {
  const c = g.career;
  const t = c.trial;
  const done = t ? TF.trialSummary(t).filter((r) => r.score !== null) : [];
  return {
    id: "trial", hud: hud(c), title: `Your trial at ${c.player.club}`,
    blocks: [
      { kind: "text", text: "Five tests. A scout is watching every one." },
      { kind: "list", items: (t ? TF.trialSummary(t) : []).map((r, i) => ({
        text: `${i + 1}. ${STAGE_LABEL[r.stage]}`, sub: r.score === null ? undefined : `${r.score} / 100`, tone: (r.score === null ? "normal" : "good") as Tone })) },
      { kind: "text", text: "Free kicks, the gate and the shootout are played on the pitch: drag back from the ball, then tap the ball where you want to strike it. Take him on: W A S D or the stick. Find the pass: tap the free man.", tone: "dim" },
    ],
    buttons: [{ label: done.length ? "Carry on with the trial ⚽" : "Start the trial ⚽", action: "play-trial", style: "primary" }],
  };
}

function managerTalkScreen(g: RobloxGame): Screen {
  const c = g.career;
  const mt = TF.managerTalk(c);
  if (!mt) return { id: "manager-talk", hud: hud(c), title: "Nobody came in", blocks: [{ kind: "text", text: "No club made an offer." }], buttons: [{ label: "Continue", action: "trial-sign", style: "primary" }] };
  return {
    id: "manager-talk", hud: hud(c), title: `${mt.offer.club} want you`,
    blocks: [
      { kind: "stats", items: [
        { label: "Trial score", value: `${c.trial ? trialScore(c.trial) : 0}` },
        { label: "Club", value: shortClub(mt.offer.club) },
        { label: "League", value: leagueNameFor(mt.offer.division) },
        { label: "Wage", value: `${money(mt.talk.openingWeekly)} a week`, tone: "gold" },
      ] },
      { kind: "heading", text: "The manager" },
      ...mt.talk.lines.map((l) => ({ kind: "text", text: `“${l}”` }) as Block),
      { kind: "text", text: `${mt.offer.seasons} seasons. Your first contract is fixed: sign it, no haggling.`, tone: "dim" },
    ],
    buttons: [{ label: "Accept & sign ✍️", action: "trial-sign", style: "primary" }],
  };
}

function trialRewardScreen(g: RobloxGame): Screen {
  const c = g.career;
  return {
    id: "trial-reward", hud: hud(c), title: `Welcome to ${c.contract.club}`,
    blocks: [
      { kind: "text", text: `${c.player.firstName} ${c.player.lastName} signs for ${c.contract.club}.`, tone: "gold" },
      { kind: "stats", items: [
        { label: "Wage", value: `${money(c.contract.wage)} a week` },
        { label: "Seasons", value: String(c.contract.seasonsRemaining) },
        { label: "Goal bonus", value: money(c.contract.goalBonus) },
        { label: "League", value: leagueNameFor(divisionOf(c)) },
      ] },
      ...(c.placement?.kind === "loan" ? [{ kind: "text", text: `On loan to ${c.player.club}.`, tone: "gold" } as Block] : []),
    ],
    buttons: [{ label: "Let's go", action: "trial-reward-done", style: "primary" }],
  };
}

// ──────────────────────────────────────────────────────────── the screens ──

export function screen(g: RobloxGame): Screen {
  const c = g.career;
  const base = { hud: hud(c), tabs: undefined } as Pick<Screen, "hud" | "tabs">;
  switch (g.phase) {
    case "dashboard": return dashboard(g);
    case "youth": return g.ui?.tab === "train"
      ? trainTab(g, { id: "youth-train", hud: hud(c), title: "", blocks: [], buttons: [{ label: "Back to the youth team", action: "tab", arg: "home", style: "secondary" }] })
      : youthScreen(g);
    case "post-match": return postMatch(g);
    case "draw": {
      const d = g.pendingDraw!;
      return { ...base, id: "draw", title: `${d.competition}: ${d.round.name}`,
        blocks: [{ kind: "heading", text: "The draw" }, { kind: "list", items: d.round.ties.map((t) => ({
          text: `${t.home} v ${t.away}`, tone: (t.home === c.player.club || t.away === c.player.club ? "gold" : "normal") as Tone })) }],
        buttons: [{ label: "Continue", action: "draw-continue", style: "primary" }] };
    }
    case "knockout-roundup": {
      const k = g.pendingKo!;
      const items: { text: string; tone?: Tone }[] = [];
      for (const st of (k.stages ?? []) as { title?: string; label?: string; ties?: { home: string; away: string; score?: string }[] }[]) {
        if (st.title || st.label) items.push({ text: String(st.title ?? st.label), tone: "gold" });
        for (const t of st.ties ?? []) items.push({ text: `${t.home} ${t.score ?? "v"} ${t.away}` });
      }
      return { ...base, id: "knockout-roundup", title: String(k.competition), blocks: [
        ...(items.length ? [{ kind: "list", items } as Block] : []),
        ...(k.nextLine ? [{ kind: "text", text: String(k.nextLine), tone: "gold" } as Block] : []),
      ], buttons: [{ label: "Continue", action: "ko-continue", style: "primary" }] };
    }
    case "playoff-roundup": {
      const up = nextFixtureFor(c);
      const po = c.playOffState!;
      const line = up?.kind === "playoff" ? `${up.round}: ${up.home ? "home to" : "away at"} ${shortClub(up.opponent)}`
        : po.promoted === c.player.club ? "Promoted!" : po.promoted ? `${shortClub(po.promoted)} go up` : "Out of the play-offs";
      return { ...base, id: "playoff-roundup", title: `${leagueNameFor(divisionOf(c))} play-offs`,
        blocks: [{ kind: "text", text: line, tone: "gold" }], buttons: [{ label: "Continue", action: "playoff-continue", style: "primary" }] };
    }
    case "deadline-day":
      return { ...base, id: "deadline-day", title: "Deadline day",
        blocks: [{ kind: "text", text: "The transfer window has shut. Every club's business is done." }],
        buttons: [{ label: "Continue", action: "deadline-continue", style: "primary" }] };
    case "intl-callup": {
      const d = F.callUp(g);
      return { ...base, id: "intl-callup", title: d ? `${d.nation}: ${d.period.label}` : "International break",
        blocks: d ? [{ kind: "text", text: d.called ? "You're in the squad!" : "Not this time. The manager has left you out.", tone: d.called ? "good" : "dim" },
          ...((d as { reason?: string }).reason ? [{ kind: "text", text: String((d as { reason?: string }).reason), tone: "dim" } as Block] : [])] : [],
        buttons: [{ label: "Continue", action: "callup-continue", style: "primary" }] };
    }
    case "intl-watched": {
      const f = g.watchedFixture;
      return { ...base, id: "intl-watched", title: "On the TV",
        blocks: f ? [{ kind: "text", text: `${f.competition ?? "International"}: ${f.home ? "v" : "at"} ${f.opponent}` },
          { kind: "text", text: score(f) ? `${score(f)!.us}-${score(f)!.them}` : "Played", tone: "gold" }] : [],
        buttons: [{ label: "Continue", action: "home", style: "primary" }] };
    }
    case "intl-tournament-table":
      return { ...base, id: "intl-tournament-table", title: String(c.tournament?.competition ?? "The tournament"),
        blocks: c.knockoutMessage ? [{ kind: "text", text: c.knockoutMessage }] : [], buttons: [{ label: "Continue", action: "home", style: "primary" }] };
    case "contract-renewal": return renewalScreen(g);
    case "ballon-dor": {
      const r = F.ballonDor(g);
      const rows = r.entries.slice(0, 10).map((e, i) => [String(i + 1), e.name, shortClub(e.club ?? ""), String(e.goals), String(e.assists)]);
      const youAt = r.entries.findIndex((e) => e.isPlayer);
      return { ...base, id: "ballon-dor", title: "The Ballon d'Or",
        blocks: [
          { kind: "text", text: r.playerRank === 1 ? "You have won the Ballon d'Or!" : r.playerNominated ? `You finished ${ordinal(r.playerRank)}.` : "You were not on the shortlist this year.",
            tone: r.playerRank === 1 ? "gold" : "normal" },
          { kind: "table", columns: ["", "Player", "Club", "G", "A"], rows, highlight: youAt >= 0 && youAt < 10 ? youAt : undefined },
        ],
        buttons: [{ label: "Continue", action: "ballon-continue", style: "primary" }] };
    }
    case "final-season":
      return { ...base, id: "final-season", title: "Your final season",
        blocks: [{ kind: "text", text: "This is your final season before retirement. End your career in the right way." }],
        buttons: [{ label: "Play on", action: "play-on", style: "primary" }] };
    case "retirement":
      return { ...base, id: "retirement", title: "The final whistle",
        blocks: [{ kind: "text", text: "Your body has had enough. It's time to hang up the boots." }],
        buttons: [{ label: "Hang them up", action: "retire", style: "primary" }] };
    case "season-transfer": return windowScreen(g);
    case "transfer-request-talk": return talkScreen(g);
    case "transfer-signing": {
      const o = g.pendingSignOffer!.offer;
      return { ...base, id: "transfer-signing", title: `Sign for ${o.club}`,
        blocks: [{ kind: "stats", items: [
          { label: "Weekly wage", value: money(o.wage) }, { label: "Seasons", value: String(o.seasons) },
          { label: "Goal bonus", value: money(o.goalBonus) }, { label: "Assist bonus", value: money(o.assistBonus) },
          { label: "Signing fee", value: money(o.signingFee) },
        ] }],
        buttons: [{ label: "Sign it", action: "sign", style: "primary" }] };
    }
    case "relegation-move":
      return { ...base, id: "relegation-move", title: "Your club is going down",
        blocks: [{ kind: "text", text: "Step 3 has no fixtures for you. Choose your next club." },
          { kind: "list", items: (g.transferOffers ?? []).map((o, i) => ({ text: o.club, sub: `${money(o.wage)} a week · ${o.seasons} seasons`, action: "relegation-pick", arg: String(i) })) }],
        buttons: [] };
    case "season-awards": {
      const a = c.lastSeasonAwardStats as unknown as Record<string, unknown> | undefined;
      const items: { label: string; value: string }[] = [];
      if (a) for (const [k, v] of Object.entries(a)) if (typeof v === "number" || typeof v === "string") items.push({ label: k, value: String(v) });
      const won = (c.trophies ?? []).filter((t) => t.season === c.season - 1);
      return { ...base, id: "season-awards", title: "End of season awards",
        blocks: [
          ...(won.length ? [{ kind: "list", items: won.map((t) => ({ text: `🏆 ${t.competition}`, tone: "gold" as Tone })) } as Block] : []),
          ...((c.awards ?? []).filter((x) => x.season === c.season - 1).map((x) => ({ kind: "text", text: `🏅 ${x.kind}: ${x.detail}`, tone: "gold" }) as Block)),
          { kind: "stats", items: items.slice(0, 12) },
        ],
        buttons: [{ label: "Continue", action: "awards-continue", style: "primary" }] };
    }
    case "ladder": {
      const n = c.ladderNews as unknown as { headline?: string; lines?: string[]; yourMove?: string | null } | undefined;
      return { ...base, id: "ladder", title: "Promotion and relegation",
        blocks: [
          ...(n?.yourMove ? [{ kind: "text", text: String(n.yourMove), tone: "gold" } as Block] : []),
          ...((n?.lines ?? []).map((l) => ({ kind: "text", text: String(l) }) as Block)),
        ],
        buttons: [{ label: "Continue", action: "ladder-continue", style: "primary" }] };
    }
    case "trial": return trialScreen(g);
    case "manager-talk": return managerTalkScreen(g);
    case "trial-reward": return trialRewardScreen(g);
    case "legacy": {
      const s = c.careerStats;
      return { ...base, id: "legacy", title: "Career over",
        blocks: [
          { kind: "stats", items: [
            { label: "Appearances", value: String(s.appearances) }, { label: "Goals", value: String(s.goals) },
            { label: "Assists", value: String(s.assists) }, { label: "Trophies", value: String(c.trophies.length) },
            { label: "Ballon d'Ors", value: String(c.ballonDorWins ?? 0), tone: "gold" },
          ] },
          { kind: "list", items: c.trophies.map((t) => ({ text: `🏆 ${t.competition}`, sub: `${t.club}, season ${t.season}` })) },
        ],
        buttons: [{ label: "New career", action: "new-career", style: "primary" }] };
    }
  }
  return dashboard(g);
}

/** The skills screen (SkillsScreen) and a skill's levels (TrainingLevelSelect). */
function trainTab(g: RobloxGame, s: Screen): Screen {
  const c = g.career;
  const ui = g.ui ?? {};
  const left = trainingLeft(c);
  s.title = "Training";
  if (ui.trainResult) s.blocks.push({ kind: "text", text: ui.trainResult, tone: "gold" });
  const skill = ui.trainSkill as TR.TrainingSkill | undefined;
  const label = skill ? TR.SKILL_LABELS.find((l) => l[0] === skill) : undefined;
  if (skill && label) {
    const card = TR.skillCard(c, skill);
    s.title = `${label[2]} ${label[1]}`;
    s.blocks.push({ kind: "stats", items: [
      { label: label[1], value: String(Math.round(card.value)) },
      { label: "Stars", value: `${card.stars} / 90` },
      { label: "Sessions left", value: `${left} / ${TR.TRAINING_SESSIONS_PER_WEEK}`, tone: left > 0 ? "normal" : "bad" },
      { label: "Energy", value: `${Math.round(c.energy)}%`, tone: c.energy < TR.trainingEnergyCost() ? "bad" : "normal" },
    ] });
    if (card.why) s.blocks.push({ kind: "text", text: card.why, tone: "bad" });
    s.blocks.push({ kind: "text", text: "Three tries a level: in first time is ★★★, second ★★, third ★. Every new star adds to the skill.", tone: "dim" });
    const levels = TR.levelList(c, skill).filter((l) => l.open);
    s.blocks.push({ kind: "list", items: levels.map((l) => ({
      text: `Level ${l.level}`, sub: l.stars ? "★".repeat(l.stars) + "☆".repeat(3 - l.stars) : "Not played yet",
      tone: (l.stars === 3 ? "good" : "normal") as Tone,
      ...(card.canTrain ? { action: "play-training", arg: `${skill}:${l.level}` } : {}),
    })).reverse() });
    s.buttons.push({ label: "Back to skills", action: "train-back", style: "secondary" });
    return s;
  }
  s.blocks.push({ kind: "stats", items: [
    { label: "Sessions left", value: `${left} / ${TR.TRAINING_SESSIONS_PER_WEEK}`, tone: left > 0 ? "normal" : "bad" },
    { label: "A session costs", value: `${TR.trainingEnergyCost()} energy` },
  ] });
  if (left <= 0) s.blocks.push({ kind: "text", text: "No more sessions this week. They come back after a Saturday match.", tone: "dim" });
  s.blocks.push({ kind: "list", items: TR.SKILL_LABELS.map(([key, name, icon, desc]) => {
    const card = TR.skillCard(c, key);
    return {
      text: `${icon} ${name}: ${Math.round(card.value)}`,
      sub: card.shutWhy ?? `${card.stars}/90 stars · ${desc}`,
      tone: (card.shut ? "dim" : "normal") as Tone,
      ...(card.shut ? {} : { action: "train-skill", arg: key }),
    };
  }) });
  return s;
}

/** Life between matches: rest, the relationships' games, the shop, sponsors (the website's Life tab and its screens). */
function lifeTab(g: RobloxGame, s: Screen): Screen {
  const c = g.career;
  const ui = g.ui ?? {};
  const page = ui.life;
  if (ui.lifeNote) s.blocks.push({ kind: "text", text: ui.lifeNote, tone: "gold" });
  const back: Button = { label: "Back", action: "life", style: "secondary" };
  if (page === "cans") {
    s.title = "🥤 KIB energy cans";
    s.blocks.push({ kind: "list", items: LF.cans(c).map((k) => ({
      text: `${k.can.name}: ${k.label}`, sub: `${money(k.price)} · you have ${k.owned}`,
      tone: (c.money < k.price ? "dim" : "normal") as Tone, action: "buy-can", arg: k.can.id })) });
    s.buttons.push(back);
    return s;
  }
  if (page === "boots") {
    s.title = "👟 Boots";
    const cb = c.currentBoot;
    s.blocks.push({ kind: "text", text: cb.matches > 0 ? `Wearing: ${cb.name} (+${cb.power} power, +${cb.technique} technique), ${cb.matches} matches left.` : "No boots on. A pair adds power and technique for its matches." });
    s.blocks.push({ kind: "list", items: LF.boots(c).map((b) => ({
      text: `${b.name}: +${b.power} power, +${b.technique} technique${b.curve ? ", curve" : ""}${b.extraTouch ? ", Touch Mode" : ""}`,
      sub: `${money(b.price)} · ${b.matches} matches${cb.id === b.id ? " · adds to yours" : ""}`,
      tone: (c.money < b.price ? "dim" : "normal") as Tone, action: "buy-boot", arg: b.id })) });
    s.buttons.push(back);
    return s;
  }
  if (page === "style") {
    s.title = "🏠 Lifestyle";
    s.blocks.push({ kind: "text", text: "Things you own raise your fame. Some wear out after a few seasons.", tone: "dim" });
    s.blocks.push({ kind: "list", items: LF.lifestyle(c).map(({ item, status, needStars }) => ({
      text: `${item.name}${item.level ? ` (level ${item.level})` : ""}`,
      sub: status === "locked" ? `Opens at ★${needStars}` : status === "owned" ? "Yours" : status === "lower" ? "You own a better one" : `${money(item.price)} · +${item.lifestyleValue} fame${status === "worn" ? " · yours is worn out" : ""}`,
      tone: (status === "owned" ? "good" : status === "locked" || status === "lower" || c.money < item.price ? "dim" : "normal") as Tone,
      ...(status === "buy" || status === "worn" ? { action: "buy-item", arg: item.id } : {}) })) });
    s.buttons.push(back);
    return s;
  }
  if (page === "dayoff") {
    s.title = "🌴 Day off";
    s.blocks.push({ kind: "text", text: "How do you want to spend it? Happier players get more energy back when they rest." });
    s.blocks.push({ kind: "list", items: LF.dayOffOptions(c).map((o) => ({
      text: `${o.icon} ${o.name}`, sub: `+${o.gain} happiness${o.cost ? ` · ${money(o.cost)}` : " · free"}`,
      tone: (c.money < o.cost ? "dim" : "normal") as Tone, action: "dayoff", arg: o.id })) });
    s.buttons.push(back);
    return s;
  }
  if (page === "talk" && ui.bossTalk) {
    const t = ui.bossTalk;
    const r = t.talk.rounds[Math.min(t.round, LF.TALK_ROUNDS - 1)];
    s.title = "💬 Office talk";
    s.blocks.push({ kind: "text", text: `Question ${t.round + 1} of ${LF.TALK_ROUNDS}. Say what he wants to hear: his lines are the only clue.`, tone: "dim" });
    if (t.last) s.blocks.push({ kind: "text", text: `You: “${t.last.you}”` }, { kind: "text", text: `${c.manager?.name ?? "The manager"}: “${t.last.him}”`, tone: "gold" });
    s.blocks.push({ kind: "heading", text: `${c.manager?.name ?? "The manager"}: “${r.line}”` });
    s.blocks.push({ kind: "list", items: r.replies.map((rep, i) => ({ text: rep.text, action: "talk-pick", arg: String(i) })) });
    return s;
  }
  if (page === "sponsors" || (page ?? "").startsWith("offer:") || (page ?? "").startsWith("deal:")) {
    const b = LF.brandsOf(c);
    s.title = "🤝 Sponsors";
    if ((page ?? "").startsWith("offer:")) {
      const o = b.offers.find((x) => x.id === page!.slice(6));
      if (o) {
        s.title = `${o.brand} (${o.category})`;
        s.blocks.push({ kind: "stats", items: [
          { label: "A week", value: money(o.weekly), tone: "gold" }, { label: "Seasons", value: String(o.seasons) },
          { label: "On signing", value: money(o.signingOn) }] });
        s.blocks.push({ kind: "list", items: o.targets.map((t) => ({ text: LF.targetLabel(t), sub: `Bonus ${money(t.bonus)}` })) });
        s.buttons.push({ label: "Sign ✍️", action: "sponsor", arg: `sign:${o.id}`, style: "primary" },
          { label: "Ask for a longer deal", action: "sponsor", arg: `longer:${o.id}` },
          { label: "Ask for easier targets", action: "sponsor", arg: `easier:${o.id}` },
          ...(o.replaces ? [{ label: "Ask your sponsor to match it", action: "sponsor", arg: `counter:${o.id}` }] : []),
          { label: "Decline", action: "sponsor", arg: `decline:${o.id}`, style: "danger" as const });
      }
      s.buttons.push({ label: "Back", action: "life", arg: "sponsors", style: "secondary" });
      return s;
    }
    if ((page ?? "").startsWith("deal:")) {
      const d = b.deals.find((x) => x.id === page!.slice(5));
      if (d) {
        s.title = `${d.brand} (${d.category})`;
        s.blocks.push({ kind: "stats", items: [{ label: "A week", value: money(d.weekly), tone: "gold" }, { label: "Seasons left", value: String(d.seasonsLeft) },
          { label: "Their mood", value: `${Math.round(d.happiness)}%` }] });
        s.blocks.push({ kind: "list", items: d.targets.map((t) => ({ text: LF.targetLabel(t), sub: `${t.progress} of ${t.target} · bonus ${money(t.bonus)}`, tone: (t.done ? "good" : "normal") as Tone })) });
        s.buttons.push({ label: `Walk away (costs ${money(d.guaranteed)})`, action: "sponsor", arg: `walk:${d.id}`, style: "danger" });
      }
      s.buttons.push({ label: "Back", action: "life", arg: "sponsors", style: "secondary" });
      return s;
    }
    s.blocks.push({ kind: "stats", items: [{ label: "Deals", value: `${b.deals.length} / ${LF.slotsFor(c)}` }, { label: "Offers", value: String(b.offers.length) }] });
    s.blocks.push({ kind: "heading", text: "Your deals" });
    s.blocks.push(b.deals.length ? { kind: "list", items: b.deals.map((d) => ({ text: `${d.brand} (${d.category})`, sub: `${money(d.weekly)} a week · ${d.seasonsLeft} seasons left`, action: "life", arg: `deal:${d.id}` })) }
      : { kind: "text", text: "No deals yet. Play well and get famous: the brands come to you.", tone: "dim" });
    if (b.offers.length) {
      s.blocks.push({ kind: "heading", text: "Offers" });
      s.blocks.push({ kind: "list", items: b.offers.map((o) => ({ text: `${o.brand} (${o.category})`, sub: `${money(o.weekly)} a week · ${o.seasons} seasons`, tone: "gold" as Tone, action: "life", arg: `offer:${o.id}` })) });
    }
    if (b.news.length) s.blocks.push({ kind: "list", items: b.news.slice(0, 4).map((n) => ({ text: n, tone: "dim" as Tone })) });
    s.buttons.push(back);
    return s;
  }
  // the Life page itself
  s.title = "Life";
  const left = LF.actionsLeft(c);
  s.blocks.push({ kind: "stats", items: [
    { label: "Energy", value: `${Math.round(c.energy)}%`, tone: c.energy < 40 ? "bad" : "normal" },
    { label: "Happiness", value: `${Math.round(c.happiness)}%` },
    { label: "Days left this week", value: String(left), tone: left > 0 ? "normal" : "bad" },
    { label: "Money", value: money(c.money), tone: "gold" },
  ] });
  const rel = (k: LF.RelKind, icon: string, name: string, value: number, action: string | null): { text: string; sub?: string; tone?: Tone; action?: string } => {
    const st = LF.relGame(c, k);
    return {
      text: `${icon} ${name}: ${Math.round(value)}`,
      sub: action ? `${LF.REL_GAME_LABEL[k]} · ${st.why ?? `1 day, ${TR.trainingEnergyCost()} energy`}` : `${LF.REL_GAME_LABEL[k]} · not in Roblox yet`,
      tone: (st.canPlay && action ? "normal" : "dim") as Tone,
      ...(st.canPlay && action ? { action } : {}),
    };
  };
  s.blocks.push({ kind: "heading", text: "Relationships" });
  s.blocks.push({ kind: "list", items: [
    rel("boss", "👔", "Manager", c.relationships.boss, "rel-boss"),
    rel("team", "🤝", "Team-mates", c.relationships.team, null),
    rel("fans", "📣", "Fans", c.relationships.fans, null),
    rel("happiness", "🌴", "Happiness", c.happiness, "life-dayoff"),
  ] });
  const owned = LF.cans(c).filter((k) => k.owned > 0);
  if (owned.length) {
    s.blocks.push({ kind: "heading", text: "Your cans" });
    s.blocks.push({ kind: "list", items: owned.map((k) => ({ text: `Drink ${k.can.name} (${k.owned})`, sub: k.label, action: "use-can", arg: k.can.id })) });
  }
  const offers = LF.brandsOf(c).offers.length;
  s.blocks.push({ kind: "heading", text: "Shop" });
  s.blocks.push({ kind: "list", items: [
    { text: "🥤 KIB energy cans", action: "life", arg: "cans" },
    { text: "👟 Boots", sub: c.currentBoot.matches > 0 ? `${c.currentBoot.name}: ${c.currentBoot.matches} matches left` : "No boots on", action: "life", arg: "boots" },
    { text: "🏠 Lifestyle", sub: "Cars, homes, watches: fame", action: "life", arg: "style" },
    { text: `🤝 Sponsors${offers ? ` (${offers} new offer${offers === 1 ? "" : "s"})` : ""}`, tone: (offers ? "gold" : "normal") as Tone, action: "life", arg: "sponsors" },
  ] });
  if (LF.canAct(c)) s.buttons.push({ label: `😴 Rest (+${LF.restGain(c)} energy, 1 day)`, action: "rest", style: "secondary" });
  return s;
}

/** The stars from a level played on the device (or, in tests, played by nobody). */
export function trainingDone(g: RobloxGame, skill: string, level: number, stars: number): RobloxGame | null {
  const label = TR.SKILL_LABELS.find((l) => l[0] === skill);
  if (!label || !TR.mayPlayLevel(g.career, label[0], level)) return null;
  if (typeof stars !== "number" || !Number.isFinite(stars) || stars < 0 || stars > 3) return null;
  const res = TR.trainingComplete(g.career, label[0], level, stars);
  const line = stars > 0
    ? `Level ${level}: ${"★".repeat(stars)}. ${label[1]} ${res.gained > 0 ? `+${res.gained}` : "unchanged"}${res.newStars > 0 ? ` (${res.newStars} new star${res.newStars === 1 ? "" : "s"})` : ""}.`
    : `Level ${level}: no stars this time.`;
  return { ...g, career: res.career, ui: { ...(g.ui ?? {}), tab: "train", trainSkill: label[0], trainResult: line } };
}

function dashboard(g: RobloxGame): Screen {
  const c = g.career;
  const tab = g.ui?.tab ?? "home";
  const tabs = TABS.map(([id, label]) => ({ id, label, active: id === tab }));
  const s: Screen = { id: "dashboard", hud: hud(c), title: c.player.club, tabs, blocks: [], buttons: [] };
  if (tab === "train") return trainTab(g, s);
  if (tab === "life") return lifeTab(g, s);
  if (tab === "league") {
    const table = sortLeague(c.league);
    s.title = leagueNameFor(divisionOf(c));
    s.blocks.push({ kind: "table", columns: ["", "Club", "P", "W", "D", "L", "GD", "Pts"],
      rows: table.map((t, i) => [String(i + 1), shortClub(t.name), String(t.played), String(t.won), String(t.drawn), String(t.lost),
        String(t.goalsFor - t.goalsAgainst), String(t.points)]),
      highlight: table.findIndex((t) => t.name === c.player.club) });
    return s;
  }
  if (tab === "fixtures") {
    s.title = "Fixtures and results";
    s.blocks.push({ kind: "list", items: c.fixtures.map((f) => {
      const sc = score(f);
      const g = f.userGoals ?? 0;
      return {
        text: fixtureLine(c, f),
        sub: sc ? `${sc.us}-${sc.them}${g ? ` · you scored ${g}` : ""}` : f.played ? "Played" : dateOf(c, f),
        tone: (sc ? (sc.us > sc.them ? "good" : sc.us < sc.them ? "bad" : "normal") : "dim") as Tone,
      };
    }) });
    return s;
  }
  if (tab === "stats") {
    const ss = c.seasonStats, cs = c.careerStats;
    s.title = "Your numbers";
    s.blocks.push({ kind: "heading", text: "This season" },
      { kind: "stats", items: [{ label: "Apps", value: String(ss.appearances) }, { label: "Goals", value: String(ss.goals) },
        { label: "Assists", value: String(ss.assists) }] },
      { kind: "heading", text: "Career" },
      { kind: "stats", items: [{ label: "Apps", value: String(cs.appearances) }, { label: "Goals", value: String(cs.goals) },
        { label: "Assists", value: String(cs.assists) }, { label: "Trophies", value: String(c.trophies.length) },
        { label: "Ballon d'Ors", value: String(c.ballonDorWins ?? 0) }] },
      { kind: "heading", text: "Skills" },
      { kind: "stats", items: Object.entries(c.skills).map(([k, v]) => ({ label: k[0].toUpperCase() + k.slice(1), value: String(Math.round(v as number)) })) },
      { kind: "heading", text: "Contract" },
      { kind: "stats", items: [{ label: "Wage a week", value: money(c.contract.wage) }, { label: "Seasons left", value: String(c.contract.seasonsRemaining) },
        { label: "Goal bonus", value: money(c.contract.goalBonus) }] },
      { kind: "heading", text: "Relationships" },
      { kind: "stats", items: [{ label: "Manager", value: String(Math.round(c.relationships.boss)) }, { label: "Team-mates", value: String(Math.round(c.relationships.team)) },
        { label: "Fans", value: String(Math.round(c.relationships.fans)) }] });
    s.buttons.push({ label: "Ask for a new contract", action: "ask-contract", style: "secondary" });
    return s;
  }
  const m = F.matchday(g);
  const pos = c.league.length ? leaguePosition(c) : 0;
  s.blocks.push({ kind: "stats", items: [
    { label: "League", value: pos ? `${ordinal(pos)} of ${c.league.length}` : "-" },
    { label: "Goals", value: String(c.seasonStats.goals) }, { label: "Assists", value: String(c.seasonStats.assists) },
    { label: "Energy", value: `${Math.round(c.energy)}%`, tone: c.energy < 40 ? "bad" : "normal" },
  ] });
  if (c.managerNews) s.blocks.push({ kind: "text", text: c.managerNews, tone: "gold" });
  if (m.seasonOver) {
    s.blocks.push({ kind: "heading", text: "The season is over" }, { kind: "text", text: "Every match is played. Time for the awards." });
    s.buttons.push({ label: "End of season 🏆", action: "end-season", style: "primary" });
    return s;
  }
  if (m.fixture) {
    s.blocks.push({ kind: "heading", text: "Next match" },
      { kind: "text", text: fixtureLine(c, m.fixture) }, { kind: "text", text: dateOf(c, m.fixture), tone: "dim" });
    if (m.canPlay) {
      // "play-match" is played on the player's device (roblox/src/Client/Match.luau)
      s.buttons.push({ label: "Play match ⚽", action: "play-match", style: "primary" });
      s.buttons.push({ label: "Sim it", action: "sim" });
    } else {
      const why = m.status === "Injured" ? "You're injured." : m.fixture.watch ? "Your country plays. Watch it on TV." : m.reason ?? "You're not in the squad this week.";
      s.blocks.push({ kind: "text", text: why, tone: "bad" });
      s.buttons.push({ label: "🏟️ Watch from the stands", action: "watch", style: "primary" });
    }
  }
  return s;
}

function youthScreen(g: RobloxGame): Screen {
  const c = g.career;
  const m = F.matchday(g);
  const buttons: Button[] = [];
  if (m.seasonOver) buttons.push({ label: "End of season 🏆", action: "end-season", style: "primary" });
  else buttons.push({ label: "Play the youth week", action: "youth-week", style: "primary" });
  buttons.push({ label: "Ask for promotion", action: "youth-promote", style: "secondary" });
  buttons.push({ label: "🏋️ Train", action: "tab", arg: "train", style: "secondary" });
  return { id: "youth", hud: hud(c), title: `${c.player.club} youth team`,
    blocks: [{ kind: "text", text: "Your form dropped you to the youth team. Play well and the first team will call." }], buttons };
}

function postMatch(g: RobloxGame): Screen {
  const c = g.career;
  const st = g.lastMatchStats!;
  const f = g.playedFixture!;
  const home = f.home !== false;
  const me = c.player.club;
  return {
    id: "post-match", hud: hud(c), title: "Full time",
    blocks: [
      { kind: "heading", text: `${home ? me : f.opponent} ${st.homeScore} - ${st.awayScore} ${home ? f.opponent : me}` },
      ...(f.kind && f.kind !== "league" ? [{ kind: "text", text: fixtureLabel(f), tone: "dim" } as Block] : []),
      { kind: "stats", items: [
        { label: "Goals", value: String(st.goals), tone: st.goals ? "good" : "normal" }, { label: "Assists", value: String(st.assists) },
        { label: "Rating", value: st.rating.toFixed(1), tone: st.rating >= 7.5 ? "good" : st.rating < 6 ? "bad" : "normal" },
        { label: "Earned", value: money(st.totalCash ?? 0) },
      ] },
      ...(c.knockoutMessage ? [{ kind: "text", text: c.knockoutMessage, tone: "gold" } as Block] : []),
    ],
    buttons: [{ label: "Continue", action: "post-continue", style: "primary" }],
  };
}

function renewalScreen(g: RobloxGame): Screen {
  const c = g.career;
  const r = g.ui?.renewal;
  const willing = !!g.contractOfferReason || willingToRenegotiate(c);
  const base = { id: "contract-renewal", hud: hud(c), title: `Contract talks: ${c.contract.club}` };
  if (!willing) {
    return { ...base, blocks: [{ kind: "text", text: "Not interested in renegotiating right now." },
      { kind: "text", text: "You haven't done enough lately to earn a better deal. A hot streak of form, or a real jump in your game, and they'll talk.", tone: "dim" }],
      buttons: [{ label: "Back", action: "renewal-cancel", style: "primary" }] };
  }
  const offer = F.renewalOffer(g, r?.wins ?? 0, r?.locked ?? false, r?.rounds ?? 0);
  const blocks: Block[] = [];
  if (g.contractOfferReason === "form") blocks.push({ kind: "text", text: `Outstanding form! ${c.contract.club} want to lock you in early.`, tone: "good" });
  if (g.contractOfferReason === "star") blocks.push({ kind: "text", text: `Your rise has been noticed. ${c.contract.club} want to reward it.`, tone: "good" });
  blocks.push({ kind: "stats", items: [{ label: "Now", value: `${money(c.contract.wage)} a week` }, { label: "Their offer", value: `${money(offer.wage)} a week`, tone: "gold" },
    { label: "Seasons", value: String(offer.seasonsRemaining) }] });
  if (!r?.started) {
    blocks.push({ kind: "text", text: "Higher or lower: each right guess raises the offer by 8%. One wrong guess and talks sour: the offer drops 15% and that's final." });
    return { ...base, blocks, buttons: [{ label: "Play higher or lower", action: "renewal-start", style: "primary" }, { label: "Sign now", action: "renewal-sign", style: "secondary" }] };
  }
  blocks.push({ kind: "heading", text: `Card: ${r.current}` });
  if (r.message) blocks.push({ kind: "text", text: r.message, tone: r.locked ? "bad" : "good" });
  const buttons: Button[] = r.locked ? [] : [{ label: "Higher ⬆", action: "renewal-guess", arg: "higher", style: "primary" }, { label: "Lower ⬇", action: "renewal-guess", arg: "lower", style: "primary" }];
  buttons.push({ label: "Sign it", action: "renewal-sign", style: "secondary" });
  return { ...base, blocks, buttons };
}

function windowScreen(g: RobloxGame): Screen {
  const c = g.career;
  const interest = F.transferInterest(g);
  const blocks: Block[] = [
    { kind: "text", text: `Your season: ${interest.report.apps} apps, ${interest.report.goals} goals, ${interest.report.assists} assists.` },
  ];
  interest.leagues.forEach((l, li) => {
    blocks.push({ kind: "heading", text: leagueNameFor(l.division) });
    blocks.push({ kind: "list", items: l.clubs.slice().sort((a, b) => a.club.localeCompare(b.club)).map((k) => ({
      text: k.club, sub: `${k.interest} · finished ${ordinal(k.position)} · ${k.why}`, action: "window-talk", arg: `${li}:${l.clubs.indexOf(k)}`,
    })) });
  });
  return { id: "season-transfer", hud: hud(c), title: "The summer window", blocks,
    buttons: [{ label: `Stay at ${shortClub(c.player.club)}`, action: "stay", style: "secondary" }] };
}

function talkScreen(g: RobloxGame): Screen {
  const c = g.career;
  const o = g.talkOffer!;
  const t = g.ui?.talk;
  const blocks: Block[] = [{ kind: "text", text: `Contract talks with ${o.club}. Every number is a weekly wage.` }];
  if (t) {
    blocks.push({ kind: "stats", items: [{ label: "Their offer", value: money(t.theirPosition), tone: "gold" }, { label: "You're asking", value: money(g.ui?.ask ?? t.yourPosition) },
      { label: "Mood", value: `${Math.round(t.moodScore)}/100`, tone: t.moodScore < 35 ? "bad" : "normal" }] });
    for (const line of t.log.slice(-4)) blocks.push({ kind: "text", text: line, tone: "dim" });
  }
  const buttons: Button[] = [];
  if (t && t.status === "negotiating") {
    buttons.push({ label: "Ask less", action: "talk-nudge", arg: "-1", style: "secondary" }, { label: "Ask more", action: "talk-nudge", arg: "1", style: "secondary" },
      { label: "Make the offer", action: "talk-offer", style: "primary" }, { label: "Walk away", action: "talk-walk", style: "danger" });
  } else if (t && t.status === "accepted") {
    blocks.push({ kind: "text", text: `Agreed at ${money(t.finalPrice ?? t.theirPosition)} a week.`, tone: "good" });
    buttons.push({ label: "Continue", action: "talk-done", style: "primary" });
  } else {
    blocks.push({ kind: "text", text: "Talks have broken down.", tone: "bad" });
    buttons.push({ label: "Back", action: "talk-walk", style: "primary" });
  }
  return { id: "transfer-request-talk", hud: hud(c), title: o.club, blocks, buttons };
}

// ──────────────────────────────────────────────────────────── the buttons ──

function niceStep(n: number): number {
  if (n < 100) return 1;
  if (n < 1000) return 10;
  if (n < 10000) return 100;
  return 1000;
}

/** One button press. `rng` is the website's Math.random for its two mini-games. */
export function act(g: RobloxGame, action: string, arg: string | undefined, rng: () => number = Math.random): RobloxGame {
  const ui: UiState = g.ui ?? {};
  switch (action) {
    case "tab": return { ...g, ui: { ...ui, tab: arg ?? "home", trainResult: undefined, life: undefined, lifeNote: undefined, bossTalk: undefined } };
    case "home": return { ...F.backToDashboard(g), ui: { ...ui, tab: "home" } };
    case "life": return { ...g, ui: { ...ui, tab: "life", life: arg, lifeNote: undefined } };
    case "rest": return { ...g, career: LF.rest(g.career), ui: { ...ui, lifeNote: "You put your feet up." } };
    case "use-can": case "buy-can": case "buy-boot": case "buy-item": {
      const f = action === "use-can" ? LF.useCan : action === "buy-can" ? LF.buyKib : action === "buy-boot" ? LF.buyBoot : LF.buyItem;
      const next = f(g.career, arg ?? "");
      return next
        ? { ...g, career: next, ui: { ...ui, lifeNote: action === "use-can" ? "Drunk." : "Bought." } }
        : { ...g, ui: { ...ui, lifeNote: action === "use-can" ? "That can would do nothing now." : "Not enough money for that." } };
    }
    case "life-dayoff": return LF.relGame(g.career, "happiness").canPlay ? { ...g, ui: { ...ui, tab: "life", life: "dayoff", lifeNote: undefined } } : g;
    case "dayoff": {
      if (!LF.relGame(g.career, "happiness").canPlay) return g;
      const r = LF.dayOff(g.career, arg ?? "");
      if (!r) return { ...g, ui: { ...ui, lifeNote: "Not enough money for that." } };
      return { ...g, career: LF.relGameComplete(g.career, "happiness", r), ui: { ...ui, life: undefined, lifeNote: `${r.line} Happiness +${r.gain}.` } };
    }
    case "rel-boss": {
      if (!LF.relGame(g.career, "boss").canPlay) return g;
      return { ...g, ui: { ...ui, tab: "life", life: "talk", lifeNote: undefined, bossTalk: LF.startTalk(g.career, Math.floor(rng() * 100000)) } };
    }
    case "talk-pick": {
      const t = ui.bossTalk;
      if (!t || !LF.relGame(g.career, "boss").canPlay) return g;
      const next = LF.talkPick(t, Number(arg));
      if (!LF.talkOver(next)) return { ...g, ui: { ...ui, bossTalk: next } };
      const r = LF.talkResult(next);
      return { ...g, career: LF.relGameComplete(g.career, "boss", r), ui: { ...ui, life: undefined, bossTalk: undefined, lifeNote: `${r.line} Manager ${r.gain >= 0 ? "+" : ""}${r.gain}.` } };
    }
    case "sponsor": {
      const [what, id] = (arg ?? "").split(":");
      const r = LF.sponsorAction(g.career, what, id ?? "", rng());
      return { ...g, career: r.career, ui: { ...ui, life: what === "sign" || what === "decline" || what === "walk" ? "sponsors" : ui.life, lifeNote: r.note } };
    }
    case "train-skill": return { ...g, ui: { ...ui, tab: "train", trainSkill: arg, trainResult: undefined } };
    case "train-back": return { ...g, ui: { ...ui, tab: "train", trainSkill: undefined, trainResult: undefined } };
    // played on the device (the server's Training remote); with no device (tests) two stars
    case "play-training": {
      const [sk, lv] = (arg ?? "").split(":");
      return trainingDone(g, sk, Number(lv), 2) ?? g;
    }
    case "sim": return F.simMatch(g);
    // Played on the player's device (the server's Match remote); with no device (tests) it is simmed.
    case "play-match": return F.simMatch(g);
    case "watch": return F.watchFromStands(g);
    case "youth-week": return F.youthWeek(g);
    case "youth-promote": return F.youthPromotion(g);
    case "post-continue": return F.postMatchContinue(g);
    case "draw-continue": return F.drawContinue(g);
    case "ko-continue": return F.knockoutContinue(g);
    case "playoff-continue": return F.playoffContinue(g);
    case "deadline-continue": return F.deadlineDayContinue(g);
    case "callup-continue": return F.callUpContinue(g);
    case "end-season": return F.endSeason(g);
    case "ballon-continue": return F.ballonDorContinue(g);
    case "play-on": return F.playOn(g);
    case "retire": return F.retireNow(g);
    // the trial: played on the device (the server's Trial remote); with no device (tests) played by nobody
    case "play-trial": return g.phase === "trial" ? simTrial(g) : g;
    case "trial-sign": {
      if (g.phase !== "manager-talk") return g;
      const signed = TF.acceptManagerOffer(g.career);
      if (signed) return { ...g, career: signed, phase: "trial-reward" };
      const youth = TF.youthAfterTrial(g.career);
      return youth ? { ...F.afterSigning({ ...g, career: youth }), ui: ui } : g;
    }
    case "trial-reward-done": return g.phase === "trial-reward" ? { ...F.afterSigning(g), ui: { ...ui, tab: "home" } } : g;
    case "awards-continue": return F.seasonAwardsContinue(g);
    case "ladder-continue": return F.ladderContinue(g);
    case "stay": return F.stayPut(g);
    case "sign": return F.signingDone(g);
    case "relegation-pick": return F.chooseTransfer(g, (g.transferOffers ?? [])[Number(arg)]);
    case "ask-contract": return { ...g, phase: "contract-renewal", contractOfferReason: null, ui: { ...ui, renewal: undefined } };
    // ── contract renewal: higher or lower (ContractRenewal, SecondaryScreens.tsx) ──
    case "renewal-start":
      return { ...g, ui: { ...ui, renewal: { current: 3 + Math.floor(rng() * 8), next: null, wins: 0, locked: false, rounds: 0, message: "", started: true } } };
    case "renewal-guess": {
      const r = ui.renewal;
      if (!r || r.locked) return g;
      let n = 1 + Math.floor(rng() * 13);
      while (n === r.current) n = 1 + Math.floor(rng() * 13);
      const correct = arg === "higher" ? n > r.current : n < r.current;
      const next = correct
        ? { ...r, current: n, rounds: r.rounds + 1, wins: r.wins + 1, message: `✓ ${n}. Correct! Your offer just improved. Take it, or push again.` }
        : { ...r, current: n, rounds: r.rounds + 1, locked: true, message: `✗ ${n}. Wrong. Talks sour and the offer drops. This is their final position.` };
      return { ...g, ui: { ...ui, renewal: next } };
    }
    case "renewal-sign": {
      const r = ui.renewal;
      const offer = F.renewalOffer(g, r?.wins ?? 0, r?.locked ?? false, r?.rounds ?? 0);
      return { ...F.contractComplete(g, offer), ui: { ...ui, renewal: undefined } };
    }
    case "renewal-cancel": return { ...F.contractComplete(g, null), ui: { ...ui, renewal: undefined } };
    // ── the summer window and its talks (TransferHub, NegotiationScreen) ──
    case "window-talk": {
      const [li, ci] = (arg ?? "0:0").split(":").map(Number);
      const offer: TransferOffer = F.transferInterest(g).leagues[li].clubs[ci].offer;
      const talk = startNegotiation(offer.wage, "selling", rng);
      return { ...F.transferNegotiate(g, offer), ui: { ...ui, talk, ask: talk.yourPosition } };
    }
    case "talk-nudge": {
      const a = ui.ask ?? ui.talk?.yourPosition ?? 0;
      const dir = Number(arg) < 0 ? -1 : 1;
      return { ...g, ui: { ...ui, ask: Math.max(1, a + dir * niceStep(dir < 0 ? a - 1 : a)) } };
    }
    case "talk-offer": {
      if (!ui.talk) return g;
      const t = makeOffer(ui.talk, Math.max(1, Math.round(ui.ask ?? ui.talk.yourPosition)), rng);
      return { ...g, ui: { ...ui, talk: t } };
    }
    case "talk-done": {
      const t = ui.talk;
      const r = F.transferTalkDone(g, t && t.status === "accepted" ? (t.finalPrice ?? null) : null);
      return { ...r, ui: { ...ui, talk: null } };
    }
    case "talk-walk": return { ...F.transferTalkDone(g, null), ui: { ...ui, talk: null } };
  }
  return g;
}
