"use client";

/**
 * INTERNATIONAL WORLD — the test page (Mikey, 12 Oct 2026). Every national
 * team's competitions played out from August 2026 (lib/star/intl), without
 * playing a career to get there: pick a date and a nation, see every final
 * so far, the FIFA ranking, that nation's tables and matches, and the
 * squad-announcement screen exactly as the game draws it.
 * Nothing is saved.
 */
import { memo, useEffect, useMemo, useRef, useState } from "react";
import "@/components/star/ui/flat.css";
import { pitchFont } from "@/components/star/ui/pitchFont";
import IntlWorldPanel from "@/components/star/IntlWorldPanel";
import { makeInitialCareer } from "@/lib/star/careerFlow";
import { PREMIER_LEAGUE_CLUBS } from "@/lib/star/clubs";
import { syncIntl, intlOf, periodDue, decide, applyDecision, dutyNow } from "@/lib/star/intl/career";
import { NationalLeague, WatchedScreen } from "@/components/star/IntlKit";
import { creditMatchResult, simulateMissedFixture, advanceSeason } from "@/lib/star/careerFlow";
import { generateSquad, clubNameSeed } from "@/lib/star/squadData";
import { nextFixtureFor } from "@/lib/star/competitions";
import type { CareerState, Fixture, LeaguePlayer, LeagueSquad } from "@/lib/star/types";
import type { StarPlayer } from "@/lib/star/types";

const ZERO = { chances: 0, goals: 0, assists: 0, passes: 0, rating: 6.8, starMan: false, bossChange: 0, teamChange: 0, fansChange: 0, wage: 0, goalBonus: 0, sponsorPay: 0, totalCash: 0, homeScore: 1, awayScore: 0, minutes: 90 };

/**
 * A new Arsenal career for `nation`, played on to its first break with the
 * squad decision forced (called = on duty, else not picked), for the two
 * break screens. Returns the career at the break.
 */
function careerAtBreak(nation: string, called: boolean): { career: CareerState; watched?: Fixture } {
  const p = { firstName: "Test", lastName: "Player", age: 24, position: "ST", club: "Arsenal", nationality: nation, startYear: 2027 } as StarPlayer;
  let c = syncIntl(makeInitialCareer(p, [...PREMIER_LEAGUE_CLUBS], "premier"));
  c = { ...c, intl: { ...intlOf(c), manager: called ? 70 : 10 } };
  for (let g = 0; g < 80; g++) {
    const due = periodDue(c);
    if (due) { c = applyDecision(c, { ...decide(c, due), called }); continue; }
    const f = nextFixtureFor(c);
    if (!f) break;
    if (called && dutyNow(c) && f.kind === "international") {
      // Play the first international of the break so Results has one.
      if (c.fixtures.some((x) => x.kind === "international" && x.played)) break;
      c = creditMatchResult(c, f, { ...ZERO }).career;
      continue;
    }
    if (f.watch) {
      const r = simulateMissedFixture(c, f).career;
      return { career: r, watched: r.fixtures.find((x) => x.intlId === f.intlId) };
    }
    c = creditMatchResult(c, f, { ...ZERO }).career;
  }
  return { career: c };
}
/**
 * A whole first season (2027/28) for `nation`, always called up, playing
 * every international you're picked for (a goal in about one in three) and
 * every club game, to the last fixture: the Country page full of tables,
 * scorers and finals, a tournament on duty (`stopAtTournament`), and a
 * Ballon d'Or night. The division's players are given the big nations'
 * nationalities so rivals have international goals too.
 */
const RIVAL_NATIONS = ["England", "France", "Brazil", "Spain", "Germany", "Portugal", "Netherlands", "Argentina", "Belgium", "Norway"];
/** Made-up rivals for the other 19 clubs (the test page has no player
 *  database), each with a nationality and a season's club goals. */
function madeUpDivision(): LeagueSquad[] {
  return PREMIER_LEAGUE_CLUBS.filter((club) => club !== "Arsenal").map((club, i) => ({
    club,
    players: generateSquad(clubNameSeed(club)).map((pl, j) => {
      const atk = pl.position === "ST" ? 1 : ["LW", "RW", "CAM"].includes(pl.position) ? 0.6 : pl.position === "CM" ? 0.25 : 0.05;
      const q = Math.max(0, (pl.overall ?? 70) - 66) / 20;
      return {
        id: `${club}-${pl.id}`, name: pl.name, position: pl.position, overall: (pl.overall ?? 70) + 8,
        goals: Math.round(atk * q * (14 + ((i * 7 + j * 3) % 12))), assists: Math.round((atk * 0.6 + 0.1) * q * (6 + ((i + j) % 8))),
        nation: RIVAL_NATIONS[(i + j) % RIVAL_NATIONS.length], image: pl.imageUrl,
      } as LeaguePlayer;
    }),
  }));
}

/**
 * `seasons` whole seasons (from 2026/27) for `nation`, always called up as
 * a regular (the bar held at 80), playing every international (a goal in
 * about one in three) and every club game. `stopAtTournament`: stop in the
 * last season two group games into a tournament, so the League tab is on
 * duty there. For the Country page full of tables, scorers and finals, a
 * tournament on duty and a Ballon d'Or night.
 */
function careerSeason(nation: string, seasons = 1, stopAtTournament = false): CareerState {
  const p = { firstName: "Test", lastName: "Player", age: 24, position: "ST", club: "Arsenal", nationality: nation, startYear: 2027 } as StarPlayer;
  let c = makeInitialCareer(p, [...PREMIER_LEAGUE_CLUBS], "premier");
  c = syncIntl({ ...c, leagueSquads: madeUpDivision() });
  let n = 0;
  for (let season = 1; season <= seasons; season++) {
    if (season > 1) c = syncIntl({ ...advanceSeason(c, false).career, leagueSquads: madeUpDivision() });
    for (let g = 0; g < 400; g++) {
      c = { ...c, intl: { ...intlOf(c), manager: 80 } };
      const due = periodDue(c);
      if (due) { c = applyDecision(c, { ...decide(c, due), called: true }); continue; }
      const f = nextFixtureFor(c);
      if (!f) break;
      const d = stopAtTournament && season === seasons && f.kind === "international" ? dutyNow(c) : null;
      if (d && d.period.kind === "tournament") {
        // Two group games played: stop, so the group has a table and results.
        const ids = new Set(d.period.matches.map((m) => m.id));
        if (c.fixtures.filter((x) => x.played && x.intlId && ids.has(x.intlId)).length >= 2) return c;
      }
      if (f.watch) { c = simulateMissedFixture(c, f).career; continue; }
      const intl = f.kind === "international";
      n++;
      const goals = intl ? (n % 3 === 0 ? 1 : 0) : (n % 2 === 0 ? 1 : 0);
      c = creditMatchResult(c, f, { ...ZERO, goals, assists: n % 4 === 0 ? 1 : 0, homeScore: 2, awayScore: 1, rating: 7.4 }).career;
    }
  }
  return c;
}
import PageGuide from "@/components/admin/PageGuide";
import { BroadcastPage, Panel, PanelGrid, Btn, Note } from "@/components/admin/broadcast/BroadcastPage";
import { KitPicture } from "@/components/admin/NationKitsTable";
import { nationKits } from "@/lib/star/international";
import { nationKitProfile } from "@/lib/star/data/nationKits";
import "./intl.css";
import BallonDor from "@/components/star/BallonDor";
import CallUpScreen from "@/components/star/CallUpScreen";
import NationFlag from "@/components/star/NationFlag";
import { newWorld } from "@/lib/star/intl/replay";
import { NATIONS } from "@/lib/star/intl/nations";
import { table, played } from "@/lib/star/intl/engine";
import type { WorldMatch as IntlMatch } from "@/lib/star/intl/world";
import type { IntlDecision, Period } from "@/lib/star/intl/career";

type Shot = "called" | "out" | "country" | "duty" | "watched" | "season" | "tournament" | "ballon";
const YEARS = Array.from({ length: 20 }, (_, i) => 2027 + i);

/** One game screen for `nation`, exactly as Play opens it. Used full size
 *  by Play and shrunk on each card. */
const Screen = memo(function Screen({ shot, nation, done, onBack }: { shot: Shot; nation: string; done: IntlMatch[]; onBack: () => void }) {
  if (shot === "duty" || shot === "watched") {
    const { career: c, watched } = careerAtBreak(nation, shot === "duty");
    const duty = dutyNow(c);
    return (
      <div className={`star-root ${pitchFont.variable} min-h-screen bg-[#05080f] text-white`}>
        {shot === "watched" && watched
          ? <WatchedScreen career={c} fixture={watched} onContinue={() => onBack()} />
          : (
            <div className="px-3 py-4">
              <button onClick={() => onBack()} className="mb-2 text-[13px] font-bold text-sky-300">← Back</button>
              {duty ? <NationalLeague career={c} duty={duty} /> : <div className="text-[13px] font-bold">{nation} has no break match to show yet.</div>}
            </div>
          )}
      </div>
    );
  }

  if (shot === "season" || shot === "tournament" || shot === "ballon") {
    // Country page: one season. Tournament and Ballon d'Or: two (Euro 2028
    // and the 2028 Copa América, Asian Cup and AFCON are in 2027/28).
    const c = careerSeason(nation, shot === "season" ? 1 : 2, shot === "tournament");
    const duty = dutyNow(c);
    return (
      <div className={`star-root ${pitchFont.variable} min-h-screen bg-[#05080f] text-white`}>
        {shot === "ballon" ? <BallonDor career={c} startAt="result" onContinue={() => onBack()} /> : (
          <div className="px-3 py-4">
            <button onClick={() => onBack()} className="mb-2 text-[13px] font-bold text-sky-300">← Back</button>
            {shot === "tournament"
              ? (duty ? <NationalLeague career={c} duty={duty} /> : <div className="text-[13px] font-bold">{nation} didn&apos;t reach a tournament in 2027/28 (try another nation).</div>)
              : <IntlWorldPanel career={c} />}
          </div>
        )}
      </div>
    );
  }

  if (shot === "country") {
    // A new career for this nation (Arsenal, manager's bar 62): the Country
    // page exactly as Stats → Country draws it.
    const p = { firstName: "Test", lastName: "Player", age: 24, position: "ST", club: "Arsenal", nationality: nation, startYear: 2027 } as StarPlayer;
    let c = syncIntl(makeInitialCareer(p, [...PREMIER_LEAGUE_CLUBS], "premier"));
    c = { ...c, intl: { ...intlOf(c), manager: 62 } };
    return (
      <div className={`star-root ${pitchFont.variable} min-h-screen bg-[#05080f] px-3 py-4 text-white`}>
        <button onClick={() => onBack()} className="mb-2 text-[13px] font-bold text-sky-300">← Back</button>
        <IntlWorldPanel career={c} />
      </div>
    );
  }

  {
    const lastWindow = done.filter((m) => m.comp !== "World Cup").slice(-2);
    const period: Period = {
      key: "sample", kind: "window", label: "September–October 2026", matches: lastWindow,
      start: lastWindow[0]?.date ?? 0, end: lastWindow[1]?.date ?? 0,
    };
    const d: IntlDecision = shot === "called"
      ? { period, nation, called: true, chance: 0.9, starter: true, reason: "You're one of his first names on the team sheet.", manager: 62, line: `${nation}'s manager sees you as a starter.` }
      : { period, nation, called: false, chance: 0.1, starter: false, reason: `${nation}'s manager isn't looking at you yet.`, manager: 12, line: `${nation}'s manager doesn't know your name yet. Their squad is picked at about 81.` };
    return <div className={`star-root ${pitchFont.variable}`}><CallUpScreen decision={d} onContinue={() => onBack()} /></div>;
  }

});
const NOOP = () => {};

/** A card picture: the live screen for the picked nation, drawn at phone
 *  size and shrunk to fit. Light screens draw once the card is on view;
 *  the slow ones (a whole season played first) only while the card is
 *  hovered or focused, else the nation's flag. */
const SLOW: Shot[] = ["season", "tournament", "ballon"];
const PHONE_W = 390;
function CardPicture({ shot, nation, label, done, hot }: { shot: Shot; nation: string; label: string; done: IntlMatch[]; hot: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  const [scale, setScale] = useState(0.5);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) setSeen(true); }, { rootMargin: "200px" });
    io.observe(el);
    const ro = new ResizeObserver(() => setScale(el.clientWidth / PHONE_W));
    ro.observe(el);
    return () => { io.disconnect(); ro.disconnect(); };
  }, []);
  const slow = SLOW.includes(shot);
  const live = seen && (!slow || hot);
  return (
    <div ref={ref} className="iw-pic" aria-hidden>
      {live ? (
        <div className="iw-live" style={{ width: PHONE_W, transform: `scale(${scale})` }}>
          <Screen shot={shot} nation={nation} done={done} onBack={NOOP} />
        </div>
      ) : (
        <div className="iw-ph">
          <NationFlag nation={nation} width={96} rounded={3} />
          <span>{label}</span>
          {slow && <em>Point at it to see it</em>}
        </div>
      )}
    </div>
  );
}
const day = (t: number) => new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export default function IntlDevPage() {
  const [year, setYear] = useState(2028);
  const [nation, setNation] = useState("England");
  const [search, setSearch] = useState("");
  const [shot, setShot] = useState<null | Shot>(null);
  const [hot, setHot] = useState<null | Shot>(null);
  const nations = useMemo(() => NATIONS.map((n) => n.name).sort(), []);
  const w = useMemo(() => {
    const world = newWorld({ xi: {}, played: {}, firstYear: 2026 });
    world.run(Date.UTC(year, 7, 1));
    return world;
  }, [year]);
  const mine = useMemo(() => w.matches.filter((m) => (m.home === nation || m.away === nation)).sort((a, b) => a.date - b.date), [w, nation]);
  const done = useMemo(() => mine.filter(played), [mine]);
  const groups = useMemo(() => {
    const seen = new Set<string>();
    const out: { title: string; rows: ReturnType<typeof table> }[] = [];
    for (const m of [...done].reverse()) {
      if (!m.group || seen.has(`${m.edition}|${m.group}`)) continue;
      seen.add(`${m.edition}|${m.group}`);
      const ms = w.edition(m.edition).filter((x) => x.group === m.group);
      const teams = Array.from(new Set(ms.flatMap((x) => [x.home, x.away])));
      out.push({ title: `${m.comp} · ${m.stage.split(" · ")[0]}`, rows: table(teams, ms, "h2h", w.rankOf) });
      if (out.length >= 3) break;
    }
    return out;
  }, [done, w]);

  if (shot) return <Screen shot={shot} nation={nation} done={done} onBack={() => setShot(null)} />;

  const info = NATIONS.find((n) => n.name === nation);
  const codeOf = (n: string) => NATIONS.find((x) => x.name === n)?.code ?? n.slice(0, 3).toUpperCase();
  const kits = nationKits(nation);
  const profile = nationKitProfile(nation);
  const shown = nations.filter((n) => n.toLowerCase().includes(search.trim().toLowerCase()));
  const card = (label: string, v: Shot, line: string, main = false) => (
    <div className="iw-card" tabIndex={0} onMouseEnter={() => setHot(v)} onFocus={() => setHot(v)}>
      <div className="iw-ct">{label}</div>
      <CardPicture key={`${v}-${nation}-${year}`} shot={v} nation={nation} label={label} done={done} hot={hot === v} />
      <div className="iw-cl">{line}</div>
      <div className="iw-cf"><Btn main={main} onClick={() => setShot(v)}>▶ Play</Btn></div>
    </div>
  );

  return (
    <BroadcastPage
      title="International world"
      sub="Every competition from August 2026 to 1 August of the year picked. Nothing is saved."
    >
      <div className="iw-layout">
        <aside className="iw-rail">
          <Panel title="Nations" note={`${nations.length}`}>
            <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="iw-select" aria-label="Year">
              {YEARS.map((y) => <option key={y} value={y}>Played up to Aug {y}</option>)}
            </select>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search nations" className="iw-search" aria-label="Search nations" />
            <div className="iw-list">
              {shown.map((n) => (
                <button key={n} className="iw-nation" aria-pressed={n === nation} onClick={() => setNation(n)}>
                  <NationFlag nation={n} width={22} /><span>{n}</span><i>#{w.rankOf(n)}</i>
                </button>
              ))}
              {shown.length === 0 && <Note>No nation by that name.</Note>}
            </div>
          </Panel>
        </aside>

        <div className="iw-main">
          <div className="iw-hero" style={{ ["--iw-a" as string]: kits.home.shirt, ["--iw-b" as string]: kits.home.trim }}>
            <div className="iw-flag"><NationFlag nation={nation} width={150} rounded={4} /></div>
            <div className="iw-name">
              <h2>{nation}</h2>
              <div className="iw-tags">
                <span className="iw-rank">FIFA ranking #{w.rankOf(nation)}</span>
                <span className="iw-sub">{Math.round(w.points.get(nation) ?? 0)} pts{info ? ` · ${info.confederation}` : ""}</span>
              </div>
            </div>
          </div>

          <div className="iw-row">
            <Panel title="Home & away" note={profile ? "real kits" : "no kit data: grey"}>
              <div className="iw-kits">
                <div className="iw-kit"><KitPicture kit={profile?.homeKit} worn={kits.home} /><span>Home</span></div>
                <div className="iw-kit"><KitPicture kit={profile?.awayKit} worn={kits.away} /><span>Away</span></div>
              </div>
            </Panel>
            <Panel title="Last results" note={`${done.length} played`}>
              <div className="iw-results">
                {done.slice(-4).reverse().map((m) => (
                  <div key={m.id} className="iw-res" title={`${m.comp} · ${m.stage} · ${day(m.date)}`}>
                    <NationFlag nation={m.home} width={20} /><b>{codeOf(m.home)}</b>
                    <span className="iw-score">{m.hs}–{m.as}{m.pens ? "*" : ""}</span>
                    <b>{codeOf(m.away)}</b><NationFlag nation={m.away} width={20} />
                    <em>{m.comp}</em>
                  </div>
                ))}
                {done.length === 0 && <Note>No matches played yet.</Note>}
              </div>
            </Panel>
          </div>

          <Panel title="The screens">
            <div className="iw-cards">
              {card("Called up", "called", "The squad announcement: you're in.", true)}
              {card("Left out", "out", "The squad announcement: not picked.")}
              {card("Country page", "country", "Stats → Country, new career.")}
              {card("On duty (League)", "duty", "The League tab on a break.")}
              {card("Watched on TV", "watched", "Not picked: after the match.")}
              {card("Country page after a season", "season", "Full tables. Takes a few seconds.")}
              {card("On duty at a tournament", "tournament", "Two group games into summer 2028.")}
              {card("Ballon d'Or after a season", "ballon", "With your international goals.")}
            </div>
          </Panel>

          <PanelGrid min={340}>
            <Panel title={`Who won (${w.finals.length})`}>
              <div className="iw-rows">
                {[...w.finals].reverse().map((f) => (
                  <div key={f.edition} className="iw-final">
                    <span className="iw-dim">{f.year}</span><span className="iw-grow">{f.comp}</span>
                    <NationFlag nation={f.winner} width={18} /><b>{f.winner}</b>
                    <span className="iw-dim">{f.hs}–{f.as}{f.pens ? ` (${f.pens.hs}–${f.pens.as} p)` : ""} {f.runnerUp}</span>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel title="FIFA ranking" note={`${nation}: #${w.rankOf(nation)}`}>
              <div className="iw-rows">
                {w.ranking().slice(0, 20).map((n, i) => (
                  <button key={n} className="iw-rk" data-me={n === nation ? "true" : undefined} onClick={() => setNation(n)}>
                    <span className="iw-dim">{i + 1}</span><NationFlag nation={n} width={18} /><span className="iw-grow">{n}</span>
                    <span className="iw-dim">{Math.round(w.points.get(n) ?? 0)}</span>
                  </button>
                ))}
              </div>
            </Panel>
            {groups.map((g) => (
              <Panel key={g.title} title={g.title}>
                <div className="iw-table">
                  <div className="iw-tr iw-th"><span>Team</span><span>P</span><span>W</span><span>D</span><span>GD</span><span>Pts</span></div>
                  {g.rows.map((r, i) => (
                    <div key={r.name} className="iw-tr" data-me={r.name === nation ? "true" : undefined}>
                      <span className="iw-team">{i + 1}. <NationFlag nation={r.name} width={16} /> {r.name}</span><span>{r.p}</span><span>{r.w}</span><span>{r.d}</span><span>{r.gf - r.ga}</span><b>{r.pts}</b>
                    </div>
                  ))}
                </div>
              </Panel>
            ))}
          </PanelGrid>

          <Panel title={`${nation}: last 20 matches`}>
            <div className="iw-rows">
              {done.slice(-20).reverse().map((m) => (
                <div key={m.id} className="iw-match">
                  <span className="iw-dim iw-date">{day(m.date)}</span>
                  <span className="iw-grow">{m.home} <b>{m.hs}–{m.as}</b> {m.away}{m.pens ? ` (${m.pens.hs}–${m.pens.as} p)` : ""}</span>
                  <span className="iw-comp">{m.comp} · {m.stage}</span>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
      <PageGuide page="/star-intl-dev" corner="bottom-left" />
    </BroadcastPage>
  );
}
