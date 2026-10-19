"use client";

/**
 * REAL MOMENTS — real match positions, played in our engine (Mikey, 9 Oct
 * 2026: "the best scenario maker in the game … take a screenshot of where
 * those players are … recreate that as a scenario"). Rebuilt on free-licensed
 * data (Harry, 19 Oct 2026: "We aren't getting licensing, so rebuild Real
 * moments … with free-licensed data").
 *
 * Three sets (lib/star/realMoments, data/realmoments/):
 *  - Fully real shots and Fully real corners: tracking data (IDSSE / DFL,
 *    SkillCorner) had all 22 men and the ball, so everyone stands where he
 *    really stood;
 *  - Real shots, placed defenders: Wyscout's World Cup 2018 / Euro 2016 shots
 *    have the real spot and facts only; the others are placed by the game's
 *    own scenario rules. Each card says which it is.
 *
 * Each card is the real picture in the game's own camera. ▶ Play runs the
 * real match on it (ScenarioPlay → EnginePlay, the one engine). "Next to the
 * game's own" puts a chance the game made of the same kind beside each one.
 *
 * Layout: option 2 of the 19 Oct 2026 lookover, on the Broadcast frame — the
 * moments as a list on the left, the picked one big on the right, Play under it.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import PageGuide from "@/components/admin/PageGuide";
import { BroadcastPage, Panel, Btn, Pill, Label, Note } from "@/components/admin/broadcast/BroadcastPage";
import "./real-moments.css";
import ScenarioPlay from "@/components/star/ScenarioPlay";
import { buildScenario, type Scenario, type ScenarioKind } from "@/lib/star/canvasEngine";
import { frameFromScenario, paint } from "@/lib/star/scenarioFrame";
import { mulberry32 } from "@/lib/star/season";
import {
  REAL_CREDIT, PICTURE_WORDS, KIND_LABEL as SHOT_KIND_LABEL, isFullyReal, kindForShot, scenarioForShot, scenarioForCorner, fetchRealFile,
  type RealShot, type RealCorner, type WyscoutShotFile, type TrackedFile,
} from "@/lib/star/realMoments";

/** The picked moment's picture and its match: at 170px the match's figures are too small to aim at. */
const PLAY_W = 340;
const THUMB_W = 64;
const PAGE = 24;
const KIND_LABEL: Partial<Record<ScenarioKind, string>> = { ...SHOT_KIND_LABEL, corner: "Corner" };

type SetId = "shots" | "corners" | "placed";
const SETS: { id: SetId; label: string }[] = [
  { id: "shots", label: "Fully real shots" },
  { id: "corners", label: "Fully real corners" },
  { id: "placed", label: "Real shots, placed defenders" },
];

/** One moment on the page: the real thing, the scenario it builds, and its facts. */
interface Moment {
  id: string;
  set: SetId;
  kind: ScenarioKind;
  full: boolean;
  build: () => Scenario;
  player: string;
  match: string;
  comp: string;
  minute: number;
  xg?: number;
  outcome?: string;
  what: string;
}

function fromShot(s: RealShot): Moment {
  return {
    id: s.id, set: isFullyReal(s) ? "shots" : "placed", kind: kindForShot(s), full: isFullyReal(s),
    build: () => scenarioForShot(s, { wideFrame: true }),
    player: s.player, match: s.match, comp: s.comp, minute: s.minute, xg: s.xg, outcome: s.outcome, what: "shot",
  };
}
function fromCorner(c: RealCorner): Moment {
  return {
    id: c.id, set: "corners", kind: "corner", full: true, build: () => scenarioForCorner(c),
    player: c.player, match: c.match, comp: c.comp, minute: c.minute,
    what: [c.delivery ? c.delivery.replace(/([A-Z])/g, " $1").toLowerCase() : "", c.led ? `led to: ${c.led}` : ""].filter(Boolean).join(" · ") || "corner",
  };
}

const BANDS: { label: string; lo: number; hi: number }[] = [
  { label: "All", lo: 0, hi: 1.01 },
  { label: "xG under 8%", lo: 0, hi: 0.08 },
  { label: "8–50%", lo: 0.08, hi: 0.5 },
  { label: "Over 50%", lo: 0.5, hi: 1.01 },
];

/** The small picture on each row of the list. */
function Thumb({ build }: { build: () => Scenario }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) paint(ref.current, frameFromScenario(build()), { baseW: THUMB_W, maxW: THUMB_W, maxH: 80 });
  }, [build]);
  return <div className="rm-thumb"><canvas ref={ref} /></div>;
}

function Picture({ build, label, width }: { build: () => Scenario; label?: string; width: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing && ref.current) paint(ref.current, frameFromScenario(build()), { baseW: width, maxW: width, maxH: 620 });
  }, [build, playing, width]);
  return (
    <div className="rm-pic">
      {label && <Label>{label}</Label>}
      {playing
        ? <div style={{ width }}><ScenarioPlay build={build} width={width} /></div>
        : <canvas ref={ref} />}
      <Btn main onClick={() => setPlaying((p) => !p)}>{playing ? "■ Stop" : "▶ Play"}</Btn>
    </div>
  );
}

function Tag({ full }: { full: boolean }) {
  return <span data-pic={full ? "full" : "placed"} className={full ? "rm-goal" : undefined} title={full ? PICTURE_WORDS.full : PICTURE_WORDS.placed}>
    {full ? "Fully real" : "Real shot, placed defenders"}
  </span>;
}

function Facts({ m }: { m: Moment }) {
  return <>{KIND_LABEL[m.kind] ?? m.kind} · {m.what === "shot"
    ? <>xG {Math.round((m.xg ?? 0) * 100)}% · <span className={m.outcome === "Goal" ? "rm-goal" : undefined}>{m.outcome}</span></>
    : m.what}</>;
}

/** One row of the list: a small picture, who, when, which match. */
function Row({ m, on, onPick }: { m: Moment; on: boolean; onPick: () => void }) {
  return (
    <button className="rm-row" aria-pressed={on} onClick={onPick} data-moment={m.id}>
      <Thumb build={m.build} />
      <div>
        <b>{m.player} {m.minute}&apos;</b>
        <span>{m.match}</span>
        <span><Facts m={m} /></span>
        <span><Tag full={m.full} /></span>
      </div>
    </button>
  );
}

/** The picked moment, big: the real picture (and the game's own beside it). */
function Stage({ m, index, withGame, onToggleGame }: { m: Moment; index: number; withGame: boolean; onToggleGame: () => void }) {
  const game = useMemo(() => () => buildScenario(m.kind, mulberry32(50_000 + index)), [m.kind, index]);
  const [w, setW] = useState(PLAY_W);
  useEffect(() => {
    const fit = () => setW(Math.max(200, Math.min(PLAY_W, window.innerWidth - 72)));
    fit(); window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  return (
    <Panel title={`${m.minute}' · ${m.player}`} note={`${m.comp} · ${m.match}`}>
      <div className="rm-stage" key={m.id}>
        <Picture build={m.build} label={withGame ? "Real" : undefined} width={w} />
        {withGame && <Picture build={game} label="Game's own" width={w} />}
      </div>
      <div className="rm-bar">
        <div className="rm-facts"><Facts m={m} /> · <Tag full={m.full} /></div>
        <Pill on={withGame} onClick={onToggleGame}>Next to the game&apos;s own</Pill>
      </div>
      <Note>{m.full ? PICTURE_WORDS.full : PICTURE_WORDS.placed}.</Note>
    </Panel>
  );
}

export default function RealMomentsDev() {
  const [all, setAll] = useState<Moment[] | null>(null);
  const [error, setError] = useState("");
  const [set, setSet] = useState<SetId>("shots");
  const [kind, setKind] = useState<ScenarioKind | "all">("all");
  const [band, setBand] = useState(0);
  const [goalsOnly, setGoalsOnly] = useState(false);
  const [withGame, setWithGame] = useState(false);
  const [shown, setShown] = useState(PAGE);
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchRealFile<TrackedFile>("tracked"), fetchRealFile<WyscoutShotFile>("shots")])
      .then(([t, w]) => setAll([
        ...t.moments.map((m) => (m.what === "corner" ? fromCorner(m) : fromShot(m))),
        ...w.shots.filter((s) => s.type !== "Penalty").map(fromShot),
      ]))
      .catch((e) => setError(`Couldn't load the moments: ${String(e)}`));
  }, []);

  const counts = useMemo(() => {
    const c: Record<SetId, number> = { shots: 0, corners: 0, placed: 0 };
    for (const m of all ?? []) c[m.set]++;
    return c;
  }, [all]);
  const list = useMemo(() => {
    if (!all) return [];
    const b = BANDS[band];
    const q = search.trim().toLowerCase();
    return all.filter((m) => m.set === set
      && (kind === "all" || m.kind === kind)
      && (m.what !== "shot" || ((m.xg ?? 0) >= b.lo && (m.xg ?? 0) < b.hi))
      && (!goalsOnly || m.outcome === "Goal" || /led to: goal/.test(m.what))
      && (!q || `${m.player} ${m.match} ${m.comp}`.toLowerCase().includes(q)));
  }, [all, set, kind, band, goalsOnly, search]);
  useEffect(() => setShown(PAGE), [set, kind, band, goalsOnly, search]);

  const kinds = useMemo(() => Array.from(new Set((all ?? []).filter((m) => m.set === set).map((m) => m.kind))), [all, set]);
  const pickedIndex = Math.max(0, list.findIndex((m) => m.id === picked));
  const current = list[pickedIndex];

  return (
    <BroadcastPage title="Real moments" sub="Real match positions in our engine: fully real from tracking (Bundesliga, A-League), or the real shot with placed defenders (World Cup 2018, Euro 2016).">
      {error && <div className="rm-error">{error}</div>}
      {!all && !error && <Panel title="Loading"><Note>Loading the real moments…</Note></Panel>}

      {all && (
        <div className="rm-layout">
          <div className="rm-rail">
            <Panel title="Filters">
              <Label>Set</Label>
              <div className="rm-pills">
                {SETS.map((s) => (
                  <Pill key={s.id} on={set === s.id} onClick={() => { setSet(s.id); setKind("all"); }}>{s.label} ({counts[s.id]})</Pill>
                ))}
              </div>
              <Label>Kind</Label>
              <div className="rm-pills">
                <Pill on={kind === "all"} onClick={() => setKind("all")}>Every kind</Pill>
                {kinds.map((k) => <Pill key={k} on={kind === k} onClick={() => setKind(k)}>{KIND_LABEL[k] ?? k}</Pill>)}
              </div>
              {set !== "corners" && <>
                <Label>Chance it went in</Label>
                <div className="rm-pills">
                  {BANDS.map((b, i) => <Pill key={b.label} on={band === i} onClick={() => setBand(i)}>{b.label}</Pill>)}
                </div>
              </>}
              <div className="rm-pills" style={{ marginTop: 8 }}>
                <Pill on={goalsOnly} onClick={() => setGoalsOnly((g) => !g)}>{set === "corners" ? "Led to a goal" : "Goals only"}</Pill>
              </div>
            </Panel>
            <Panel title="Moments" note={`${list.length.toLocaleString()} moments`}>
              <input className="rm-search" type="search" placeholder="Search players, matches…" aria-label="Search players, matches"
                value={search} onChange={(e) => setSearch(e.target.value)} />
              <div className="rm-list">
                {list.slice(0, shown).map((m) => <Row key={m.id} m={m} on={m.id === current?.id} onPick={() => setPicked(m.id)} />)}
                {!list.length && <Note>No moments match these filters.</Note>}
              </div>
              {shown < list.length && <Btn onClick={() => setShown((s) => s + PAGE)}>More</Btn>}
            </Panel>
          </div>
          <div className="rm-main">
            {current
              ? <Stage m={current} index={pickedIndex} withGame={withGame} onToggleGame={() => setWithGame((g) => !g)} />
              : <Panel title="No moment picked"><Note>Change the filters to see moments.</Note></Panel>}
          </div>
        </div>
      )}
      <div data-credit className="rm-count" style={{ marginTop: 16 }}>
        {REAL_CREDIT.dfl}<br />{REAL_CREDIT.skillcorner}<br />{REAL_CREDIT.wyscout}
      </div>
      <PageGuide page="/star-real-moments-dev" />
    </BroadcastPage>
  );
}
