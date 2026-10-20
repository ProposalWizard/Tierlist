"use client";

/**
 * RETIREMENT PREVIEW — the test page (Leo, 5 Oct 2026: "give me the
 * opportunity to preview the retirement or end of career easily, because I
 * don't want to have to play 15 seasons … just to test out the retirement
 * feature").
 *
 * Pick a made-up career (lib/star/retirementPreview.ts) or one of the saves
 * on this device, then see each screen of the end of a career exactly as the
 * game draws it: the final-season warning (after season 19), the final
 * whistle (after season 20), the career overview, the Hall of Fame, and the
 * in-game All seasons page. Nothing is saved — a real save is only read, and
 * "Hang them up" here retires a copy.
 *
 * The farewell match (Leo, 6 Oct 2026): the invite, the team sheets, the
 * guard of honour (3D, and the drawn version) and full time with a made-up
 * score. The match itself is the real match: play it in the game (Dev Skip
 * to the end of season 20, then "Hang them up").
 */
import { useEffect, useMemo, useState } from "react";
import PageGuide from "@/components/admin/PageGuide";
import { BroadcastPage, Panel, Btn, Pill, Label, Note } from "@/components/admin/broadcast/BroadcastPage";
import "./retirement.css";
import { pitchFont } from "@/components/star/ui/pitchFont";
import "@/components/star/ui/flat.css";
import CareerOverview from "@/components/star/CareerOverview";
import { FinalSeasonNotice, FinalWhistle } from "@/components/star/CareerEnd";
import { HallOfFameList } from "@/components/star/HallOfFame";
import AllSeasonsNew from "@/components/star/AllSeasonsNew";
import { CareerCardPicture, ShareCardSheet } from "@/components/star/ShareCard";
import { FarewellInvite, FarewellResult, GuardOfHonour, StandingOvation } from "@/components/star/Farewell";
import VersusScreen from "@/components/star/VersusScreen";
import { CompareCareers, CompareFlow, ShareLinkSheet } from "@/components/star/LegendShare";
import { farewellSides, farewellCareer, farewellFixture, farewellRecordFrom } from "@/lib/star/farewell";
import { matchdayFor } from "@/lib/star/teamsheet";
import { formationOf } from "@/lib/star/formations";
import type { MatchStats } from "@/lib/star/types";
import { ScreenShell, BottomBar, BarButton } from "@/components/star/ui";
import { previewCareer, PREVIEW_SHAPES, type PreviewShape } from "@/lib/star/retirementPreview";
import { retire, CAREER_SEASONS } from "@/lib/star/retirement";
import { hallEntryFor } from "@/lib/star/hallOfFame";
import { peekDeviceSaves } from "@/lib/star/storage";
import type { CareerState } from "@/lib/star/types";
import BallonDor from "@/components/star/BallonDor";
import { BallonDorCeremony } from "@/components/star/BallonDorNight";
import { computeBallonDorShortlist, type BallonDorEntry, type BallonDorResult } from "@/lib/star/ballonDor";
import SeasonAwardsScreen from "@/components/star/SeasonAwardsScreen";
import { computeSeasonAwardStats } from "@/lib/star/seasonAwards";

type Source = { kind: "shape"; shape: PreviewShape } | { kind: "save"; key: string };
type View = "menu" | "notice" | "whistle" | "overview" | "hall" | "hall-entry" | "seasons" | "card"
  | "fw-invite" | "fw-sheets" | "fw-walkout" | "fw-walkout-drawn" | "fw-ovation" | "fw-ovation-drawn" | "fw-result" | "fw-overview"
  | "compare" | "compare-flow" | "share-link"
  | "bd-win" | "bd-second" | "bd-out" | "bd-second-drawn" | "bd-out-drawn" | "bd-old" | "bd-result"
  | "season-awards";

/** A made-up full time for the test page: 4–3, two goals and an assist. */
const SAMPLE_FAREWELL: MatchStats = {
  minutes: 85, hooked: "rested", chances: 9, goals: 2, assists: 1, passes: 14, rating: 8.7, starMan: true,
  bossChange: 0, teamChange: 0, fansChange: 0, wage: 0, goalBonus: 0, sponsorPay: 0, totalCash: 0,
  homeScore: 4, awayScore: 3,
  goalEvents: [
    { minute: 12, scorer: "You", isUserGoal: true },
    { minute: 38, scorer: "Ryan Watkins", isUserGoal: false },
    { minute: 57, scorer: "You", isUserGoal: true },
    { minute: 81, scorer: "Tom Garcia", isUserGoal: false },
  ],
  oppGoalEvents: [
    { minute: 23, scorerId: "rv_1", scorer: "Kylian Mbappé" },
    { minute: 64, scorerId: "rv_2", scorer: "Lamine Yamal" },
    { minute: 88, scorerId: "rv_1", scorer: "Kylian Mbappé" },
  ],
};

const LAST = CAREER_SEASONS ?? 20;

/** Made-up rivals to fill a short list (nobody real). */
const SAMPLE_RIVALS: [string, string][] = [
  ["Marco Velasco", "Real Madrid"], ["Tomás Ferreira", "FC Barcelona"], ["Jonas Albrecht", "FC Bayern München"],
  ["Luca Moretti", "Inter"], ["Kenji Arai", "Liverpool"], ["Adrien Lacroix", "Paris Saint-Germain"],
  ["Rui Saldanha", "Manchester City"], ["Emre Kaya", "Arsenal"], ["Diego Ríos", "Atlético Madrid"], ["Sam Okafor", "Chelsea"],
];

/**
 * The Ballon d'Or night on the test page: the career's real shortlist, with
 * you put at `place` (1 = you win, 0 = not on the list). Padded with made-up
 * rivals when the made-up career has fewer than ten.
 */
function madeUpNight(career: CareerState, place: number): BallonDorResult {
  const real = computeBallonDorShortlist(career).entries;
  const rivals = real.filter(e => !e.isPlayer);
  for (const [name, club] of SAMPLE_RIVALS) {
    if (rivals.length >= 10) break;
    if (!rivals.some(r => r.name === name)) rivals.push({ rank: 0, isPlayer: false, name, club, goals: 30 - rivals.length * 2, assists: 12 - rivals.length, rating: 7.6, ratingIsReal: false, trophies: [], score: 0 });
  }
  const me: BallonDorEntry = real.find(e => e.isPlayer) ?? {
    rank: 0, isPlayer: true, name: `${career.player.firstName} ${career.player.lastName}`, club: career.player.club,
    goals: 31, assists: 14, rating: 7.9, ratingIsReal: true, trophies: ["Premier League"], score: 0,
  };
  const list = place > 0 ? [...rivals.slice(0, place - 1), me, ...rivals.slice(place - 1)] : rivals;
  const entries = list.slice(0, 10).map((e, i) => ({ ...e, rank: i + 1 }));
  return { entries, playerRank: place, playerNominated: place > 0 };
}

/** The career at a point: after `upTo` seasons (not retired), or the end. */
function careerAt(source: Source, seed: number, save: CareerState | null, upTo?: number): CareerState | null {
  if (source.kind === "shape") return previewCareer(source.shape, seed, upTo ? { upTo } : {});
  return save ? { ...save, retired: upTo ? false : save.retired } : null;
}

export default function RetirementPreviewPage() {
  const [source, setSource] = useState<Source>({ kind: "shape", shape: "legend" });
  const [seed, setSeed] = useState(1);
  const [view, setView] = useState<View>("menu");
  const [hallOpen, setHallOpen] = useState<string | null>(null);
  const [saves, setSaves] = useState<{ key: string; career: CareerState }[]>([]);
  // Read once, after the page is in the browser (localStorage).
  useEffect(() => { setSaves(peekDeviceSaves()); }, []);

  const save = source.kind === "save" ? saves.find(s => s.key === source.key)?.career ?? null : null;
  const beforeLast = useMemo(() => careerAt(source, seed, save, LAST - 1), [source, seed, save]);
  const lastSeason = useMemo(() => careerAt(source, seed, save, LAST), [source, seed, save]);
  const midway = useMemo(() => careerAt(source, seed, save, 12), [source, seed, save]);
  // The finished version: a made-up career already is; a real save is
  // retired IN MEMORY only (never written back).
  const finished = useMemo<CareerState | null>(() => {
    const c = careerAt(source, seed, save);
    if (!c) return null;
    if (c.retired) return c;
    try { return retire(c); } catch { return c; }
  }, [source, seed, save]);
  // The farewell match's two sides, from the career as its last season ends.
  const farewell = useMemo(() => {
    if (!lastSeason) return null;
    try {
      const sides = farewellSides(lastSeason);
      return { sides, career: farewellCareer(lastSeason, sides), fixture: farewellFixture(lastSeason, sides) };
    } catch { return null; }
  }, [lastSeason]);
  // The Hall, made up: one of each shape (nothing stored).
  const hall = useMemo(() => PREVIEW_SHAPES.map(({ id }, k) => hallEntryFor(previewCareer(id, seed), 1_000_000 - k)), [seed]);

  // The game's own look (font, bars), and the game's full screen: the site's
  // menu and footer hide, exactly as on /star-dev (globals.css, data-star-game).
  const wrap = (el: React.ReactNode) => <div className={`star-root ${pitchFont.variable}`}><div data-star-game hidden />{el}</div>;
  const go = (v: View) => { setView(v); window.scrollTo({ top: 0 }); };
  const toMenu = () => go("menu");

  if (view === "notice" && beforeLast) {
    return wrap(<FinalSeasonNotice career={beforeLast} onContinue={toMenu} />);
  }
  if (view === "whistle" && lastSeason) {
    return wrap(<FinalWhistle career={lastSeason} onRetire={() => go(farewell ? "fw-invite" : "overview")} />);
  }
  if (view === "fw-invite" && lastSeason && farewell) {
    return wrap(<FarewellInvite career={lastSeason} sides={farewell.sides} onPlay={() => go("fw-sheets")} onSkip={() => go("overview")} />);
  }
  if (view === "fw-sheets" && farewell) {
    const md = matchdayFor(farewell.career, farewell.fixture, true, undefined, farewell.sides.ours.lineup.bench,
      { formation: formationOf(farewell.sides.ours.lineup.formation), xi: farewell.sides.ours.lineup.xi });
    return wrap(
      <VersusScreen
        matchday={md}
        date="One last game"
        competition="Farewell match"
        clubKits={farewell.career.clubKits}
        onKickOff={() => go("fw-walkout")}
        onBack={() => go("fw-invite")}
      />,
    );
  }
  if ((view === "fw-walkout" || view === "fw-walkout-drawn") && lastSeason && farewell) {
    return wrap(<GuardOfHonour key={view} career={lastSeason} sides={farewell.sides} drawn={view === "fw-walkout-drawn"} onDone={() => go("fw-result")} />);
  }
  if ((view === "fw-ovation" || view === "fw-ovation-drawn") && lastSeason && farewell) {
    return wrap(<StandingOvation key={view} career={lastSeason} sides={farewell.sides} minute={85} drawn={view === "fw-ovation-drawn"} onDone={() => go("fw-result")} />);
  }
  if (view === "fw-result" && lastSeason && farewell) {
    return wrap(<FarewellResult career={lastSeason} sides={farewell.sides} stats={SAMPLE_FAREWELL} onDone={() => go("fw-overview")} />);
  }
  if (view === "fw-overview" && finished && farewell) {
    const withFarewell = { ...finished, farewell: farewellRecordFrom(SAMPLE_FAREWELL, farewell.sides) };
    return wrap(
      <CareerOverview
        career={withFarewell}
        share={{}}
        actions={[{ icon: "‹", label: "Menu", onClick: toMenu, primary: true }]}
      />,
    );
  }
  if (view === "overview" && finished) {
    // The same three buttons as the real game's end screen.
    return wrap(
      <CareerOverview
        key={`${JSON.stringify(source)}-${seed}`}
        career={finished}
        share={{}}
        actions={[
          { icon: "🏛️", label: "Hall of Fame", onClick: () => go("hall") },
          { icon: "＋", label: "New career", onClick: toMenu, primary: true },
          { icon: "☰", label: "Menu", onClick: toMenu },
        ]}
      />,
    );
  }
  if (view === "hall") {
    return wrap(<HallOfFameList entries={hall} onOpen={(id) => { setHallOpen(id); go("hall-entry"); }} onBack={toMenu} />);
  }
  if (view === "hall-entry") {
    const e = hall.find(h => h.id === hallOpen);
    if (e) {
      return wrap(
        <CareerOverview
          key={e.id}
          career={e.career}
          share={{}}
          actions={[
            { icon: "‹", label: "Hall of Fame", onClick: () => go("hall") },
            { icon: "🗑", label: "Remove", onClick: () => go("hall") },
          ]}
        />,
      );
    }
  }
  if (view === "season-awards" && lastSeason) {
    // The end-of-season awards (trophies, Golden Boot and the rest, the Team of the Season) on the last season.
    return wrap(<SeasonAwardsScreen career={{ ...lastSeason, lastSeasonAwardStats: computeSeasonAwardStats(lastSeason) }} onContinue={toMenu} />);
  }
  if (view.startsWith("bd-") && lastSeason) {
    // The Ballon d'Or night (STAR_ROADMAP #7) on the career's last season.
    const place = view === "bd-win" ? 1 : view === "bd-out" || view === "bd-out-drawn" ? 7 : 2;
    const night = madeUpNight(lastSeason, place);
    if (view === "bd-old") return wrap(<BallonDor key={view} career={lastSeason} result={night} onContinue={toMenu} />);
    if (view === "bd-result") return wrap(<BallonDor key={view} career={lastSeason} result={night} startAt="result" onContinue={toMenu} />);
    return wrap(<BallonDorCeremony key={view} career={lastSeason} result={night} drawn={view.endsWith("-drawn")} onDone={() => go("bd-result")} />);
  }
  if (view === "compare" && finished) {
    // This career (the friend's, on the right) against the made-up legend (yours).
    const yours = hallEntryFor(previewCareer("legend", seed), 2);
    return wrap(<CompareCareers a={yours} b={hallEntryFor(finished, 1)} onBack={toMenu} />);
  }
  if (view === "compare-flow") {
    return wrap(<CompareFlow mine={hall} onClose={toMenu} />);
  }
  if (view === "share-link" && finished) {
    // The real sheet: here (signed out, no database) it says so.
    return wrap(<><CareerOverview career={finished} share={{ onLink: () => {} }} actions={[{ icon: "‹", label: "Menu", onClick: toMenu }]} /><ShareLinkSheet entry={hallEntryFor(finished, 1)} onClose={toMenu} /></>);
  }
  if (view === "card" && finished) {
    // The share card exactly as it is shared (drawn at 1080 × 1350, shown at 540).
    return wrap(<CardPreview career={finished} onBack={toMenu} />);
  }
  if (view === "seasons" && midway) {
    // The in-game Stats page's All seasons view, on a career 12 seasons in.
    return wrap(
      <ScreenShell glow="#38bdf8" title="" bare tone="calm" bottomBar={<BottomBar><BarButton icon="‹" label="Back" onClick={toMenu} /></BottomBar>}>
        <div className="mb-2 mt-2 text-center text-[13px] font-black uppercase tracking-wide text-white">📚 All seasons</div>
        <AllSeasonsNew career={midway} />
      </ScreenShell>,
    );
  }

  const isShape = source.kind === "shape";
  const card = (label: string, v: View, enabled: boolean, img?: string, main = false) => (
    <div className="rt-card" data-off={enabled ? undefined : "true"}>
      <div className="rt-ct">{label}</div>
      <div className="rt-pic" style={img ? { backgroundImage: `url(/admin/retirement/${img}.webp)` } : undefined}>{!img && <span>{label.slice(0, 1)}</span>}</div>
      <div className="rt-cf"><Btn main={main || enabled} disabled={!enabled} onClick={() => go(v)}>▶ Play</Btn></div>
    </div>
  );

  return (
    <BroadcastPage title="Retirement screens" sub="The end of a career, without playing one. Nothing is saved.">
      <div className="rt-layout">
        <aside className="rt-rail">
          <Panel title="Careers" note={`made up · ${LAST} seasons`}>
            <div className="rt-careers">
              {PREVIEW_SHAPES.map(s => (
                <button key={s.id} className="rt-career" aria-pressed={isShape && source.shape === s.id} onClick={() => setSource({ kind: "shape", shape: s.id })}>
                  <b>{s.label}</b><span>{s.line}</span>
                </button>
              ))}
            </div>
            <div className="rt-version">
              <Label>Version</Label>
              <Pill on={false} onClick={() => setSeed(s => Math.max(1, s - 1))} title="Previous version">◀</Pill>
              <b>{seed}</b>
              <Pill on={false} onClick={() => setSeed(s => s + 1)} title="Next version">▶</Pill>
              <Note>same shape, other numbers</Note>
            </div>
            <Label>Your saves on this device</Label>
            {saves.length === 0 && <Note>None on this browser.</Note>}
            <div className="rt-careers">
              {saves.map(s => {
                const c = s.career;
                return (
                  <button key={s.key} className="rt-career" aria-pressed={source.kind === "save" && source.key === s.key} onClick={() => setSource({ kind: "save", key: s.key })}>
                    <b>{c.player.firstName} {c.player.lastName}</b>
                    <span>{c.player.club || "No club yet"} · season {c.season} · age {c.player.age}{c.retired ? " · retired" : ""}</span>
                  </button>
                );
              })}
            </div>
          </Panel>
        </aside>

        <div className="rt-main">
          <Panel title="The screens, in order" note="the journey">
            <div className="rt-cards">
              {card(`1. Final season (after ${LAST - 1})`, "notice", !!beforeLast, "notice")}
              {card(`2. Final whistle (after ${LAST})`, "whistle", !!lastSeason, "whistle")}
              {card("3. Career overview", "overview", !!finished, "overview")}
              {card("4. Hall of Fame", "hall", true, "hall")}
              {card("The share card", "card", !!finished, "card")}
            </div>
          </Panel>

          <div data-farewell-tests>
            <Panel title="Farewell match" note={`the match itself: in the game, Dev Skip to the end of season ${LAST}, then Hang them up`}>
              <div className="rt-cards">
                {card("Invite (Play or Skip)", "fw-invite", !!farewell, "fw-invite")}
                {card("Team sheets", "fw-sheets", !!farewell, "fw-sheets")}
                {card("Guard of honour · 3D", "fw-walkout", !!farewell, "fw-walkout")}
                {card("Guard of honour · drawn", "fw-walkout-drawn", !!farewell, "fw-walkout-drawn")}
                {card("Standing ovation · 3D", "fw-ovation", !!farewell, "fw-ovation")}
                {card("Standing ovation · drawn", "fw-ovation-drawn", !!farewell, "fw-ovation-drawn")}
                {card("Full time (made-up 4–3)", "fw-result", !!farewell, "fw-result")}
                {card("The overview after it", "fw-overview", !!farewell && !!finished, "fw-overview")}
              </div>
            </Panel>
          </div>

          <div data-ballon-dor-tests>
            <Panel title="Ballon d'Or night" note="made-up rivals fill the list where this career has fewer than ten">
              <div className="rt-cards">
                {card("You win · 3D", "bd-win", !!lastSeason, "bd-win")}
                {card("You come 2nd · 3D", "bd-second", !!lastSeason, "bd-second")}
                {card("Not in the top three (7th) · 3D", "bd-out", !!lastSeason, "bd-out")}
                {card("You come 2nd · drawn", "bd-second-drawn", !!lastSeason, "bd-second-drawn")}
                {card("Not in the top three · drawn", "bd-out-drawn", !!lastSeason, "bd-out-drawn")}
                {card("The result page after it", "bd-result", !!lastSeason, "bd-result")}
                {card("Old (the countdown cards)", "bd-old", !!lastSeason, "bd-old")}
              </div>
            </Panel>
          </div>

          <div data-season-awards-tests>
            <Panel title="Season awards" note="the cards after every season: faces are 3D headshots">
              <div className="rt-cards">
                {card("Season awards (last season)", "season-awards", !!lastSeason)}
              </div>
            </Panel>
          </div>

          <div data-online-tests>
            <Panel title="Online" note="a shared career opens at /legend/CODE; codes need the star_legend_shares table (pending)">
              <div className="rt-cards">
                {card("Head to head (made-up legend v this one)", "compare", !!finished, "compare")}
                {card("Compare with a friend (type a code)", "compare-flow", true, "compare-flow")}
                {card("Share link sheet", "share-link", !!finished, "share-link")}
                {card("In the game: All seasons page", "seasons", !!midway, "seasons")}
              </div>
            </Panel>
          </div>
        </div>
      </div>
      <PageGuide page="/star-retirement-dev" corner="bottom-left" />
    </BroadcastPage>
  );
}

/** The share card on its own, at the size it is photographed, and the real share sheet. */
function CardPreview({ career, onBack }: { career: CareerState; onBack: () => void }) {
  const [sheet, setSheet] = useState(false);
  return (
    <div className="min-h-screen bg-[#020409] px-2 py-4 text-white">
      <div className="mx-auto flex max-w-[560px] flex-col items-center gap-3">
        <CareerCardPicture career={career} width={540} />
        <div className="grid w-full max-w-[400px] grid-cols-2 gap-2">
          <button onClick={onBack} className="kib-press py-3 text-[13px] font-black uppercase" style={{ background: "rgba(255,255,255,.1)", borderRadius: 4 }}>‹ Back</button>
          <button onClick={() => setSheet(true)} className="kib-press py-3 text-[13px] font-black uppercase text-gray-950" style={{ background: "#fbbf24", borderRadius: 4 }} data-make-picture>Make the picture</button>
        </div>
      </div>
      {sheet && <ShareCardSheet career={career} onClose={() => setSheet(false)} />}
    </div>
  );
}
