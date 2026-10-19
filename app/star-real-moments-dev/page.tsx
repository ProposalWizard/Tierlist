"use client";

/**
 * REAL MOMENTS — real match positions, played in our engine (Mikey, 9 Oct
 * 2026: "the best scenario maker in the game … take a screenshot of where
 * those players are … recreate that as a scenario").
 *
 * TESTING ONLY. The moments come from StatsBomb's free data, converted on a
 * developer's machine by tools/statsbomb/ (read its README). The file is
 * loaded here from your device: none of it is in the repo or the live game.
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
import { buildRealMoment, parseRealMoments, type RealMoment } from "@/lib/star/realMoments";
import { buildKaneMoment, KANE_MOMENTS_URL, type KaneMoment } from "@/lib/star/kaneMoments";

/** The picked moment's picture and its match: at 170px the match's figures
 *  are too small to aim at. */
const PLAY_W = 340;
const THUMB_W = 64;
const PAGE = 24;
const KIND_LABEL: Partial<Record<ScenarioKind, string>> = {
  one_on_one: "One-on-one", volley: "In the box", tight_angle: "Tight angle",
  long_range: "Long range", midfield_pass: "Midfield",
  through_ball: "Through ball", buildup: "Build-up", cutback: "Pass in the box", byline_cross: "Byline cross",
};

/** The game's striker drawings (Settings → Kane drawings), shown as cards (they carry their own target run). */
const kaneById = new Map<string, KaneMoment>();
function fromKane(k: KaneMoment): RealMoment {
  kaneById.set(k.id, k);
  return {
    id: k.id, source: "kane", kind: k.kind, seed: k.seed, override: k.override, faults: k.faults,
    meta: { player: `${k.meta.player ?? "Harry Kane"}${k.kane ? " ★" : ""}`, match: `${k.meta.comp} · ${k.meta.match}`, minute: k.meta.minute, what: `${k.meta.what}${k.grade ? ` · ${k.grade}` : ""}`, xg: k.meta.xg },
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

function realBuild(m: RealMoment) {
  return () => { const k = kaneById.get(m.id); return k ? buildKaneMoment(k) : buildRealMoment(m); };
}

function Facts({ m }: { m: RealMoment }) {
  return <>{KIND_LABEL[m.kind] ?? m.kind} · {m.meta.what === "shot"
    ? <>xG {Math.round((m.meta.xg ?? 0) * 100)}% · <span className={m.meta.outcome === "Goal" ? "rm-goal" : undefined}>{m.meta.outcome}</span></>
    : m.meta.what === "touch" ? "a touch" : m.meta.what}</>;
}

/** One row of the list: a small picture, who, when, which match. */
function Row({ m, on, onPick }: { m: RealMoment; on: boolean; onPick: () => void }) {
  const build = useMemo(() => realBuild(m), [m]);
  return (
    <button className="rm-row" aria-pressed={on} onClick={onPick}>
      <Thumb build={build} />
      <div>
        <b>{m.meta.player ?? "?"} {m.meta.minute}&apos;</b>
        <span>{m.meta.match}</span>
        <span><Facts m={m} /></span>
      </div>
    </button>
  );
}

/** The picked moment, big: the real picture (and the game's own beside it). */
function Stage({ m, index, withGame, onToggleGame }: { m: RealMoment; index: number; withGame: boolean; onToggleGame: () => void }) {
  const real = useMemo(() => realBuild(m), [m]);
  const game = useMemo(() => () => buildScenario(m.kind, mulberry32(50_000 + index)), [m.kind, index]);
  const faults = m.faults.filter((f) => f !== "attacker offside");
  const [w, setW] = useState(PLAY_W);
  useEffect(() => {
    const fit = () => setW(Math.max(200, Math.min(PLAY_W, window.innerWidth - 72)));
    fit(); window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  return (
    <Panel title={`${m.meta.minute}' · ${m.meta.player ?? "?"}`} note={m.meta.match}>
      <div className="rm-stage" key={m.id}>
        <Picture build={real} label={withGame ? "Real" : undefined} width={w} />
        {withGame && <Picture build={game} label="Game's own" width={w} />}
      </div>
      <div className="rm-bar">
        <div className="rm-facts"><Facts m={m} /></div>
        <Pill on={withGame} onClick={onToggleGame}>Next to the game&apos;s own</Pill>
      </div>
      {faults.length > 0 && <div className="rm-faults">{faults.join(" · ")}</div>}
    </Panel>
  );
}

export default function RealMomentsDev() {
  const [all, setAll] = useState<RealMoment[] | null>(null);
  const [error, setError] = useState("");
  const [source, setSource] = useState<RealMoment["source"]>("pl1516");
  const [kind, setKind] = useState<ScenarioKind | "all">("all");
  const [band, setBand] = useState(2);
  const [goalsOnly, setGoalsOnly] = useState(false);
  const [withGame, setWithGame] = useState(false);
  const [shown, setShown] = useState(PAGE);
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<string | null>(null);

  const list = useMemo(() => {
    if (!all) return [];
    const b = BANDS[band];
    const q = search.trim().toLowerCase();
    return all.filter((m) => m.source === source
      && (kind === "all" || m.kind === kind)
      && (m.meta.what !== "shot" || ((m.meta.xg ?? 0) >= b.lo && (m.meta.xg ?? 0) < b.hi))
      && (!goalsOnly || m.meta.outcome === "Goal")
      && (!q || `${m.meta.player ?? ""} ${m.meta.match}`.toLowerCase().includes(q)));
  }, [all, source, kind, band, goalsOnly, search]);
  useEffect(() => setShown(PAGE), [source, kind, band, goalsOnly, search]);

  const kinds = useMemo(() => Array.from(new Set((all ?? []).filter((m) => m.source === source).map((m) => m.kind))), [all, source]);
  const pickedIndex = Math.max(0, list.findIndex((m) => m.id === picked));
  const current = list[pickedIndex];

  async function loadKane() {
    try {
      const j = await (await fetch(KANE_MOMENTS_URL)).json() as { moments?: KaneMoment[] };
      const got = (j.moments ?? []).map(fromKane);
      if (!got.length) { setError("No striker drawings found."); return; }
      setError(""); setAll(got); setSource("kane"); setKind("all"); setBand(0);
    } catch { setError("Couldn't load the striker drawings."); }
  }

  async function load(file: File) {
    const got = parseRealMoments(await file.text());
    if (!got || !got.length) { setError("That file has no moments in it. Pick real-moments.json."); return; }
    setError(""); setAll(got);
  }

  const actions = (
    <>
      <label className="bc-btn rm-file">
        Load moments file
        <input type="file" accept=".json,application/json" aria-label="Load moments file"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void load(f); }} />
      </label>
      <Btn main onClick={() => void loadKane()}>Striker drawings (in the game)</Btn>
    </>
  );

  return (
    <BroadcastPage title="Real moments" sub="Real match positions (StatsBomb's free data) in our engine. Testing only: the file stays on your device." actions={actions}>
      {error && <div className="rm-error">{error}</div>}

      {!all && (
        <Panel title="Start here">
          <Note>Load a moments file from your device (real-moments.json), or open the striker drawings the game already has. Then pick a moment from the list and press Play.</Note>
        </Panel>
      )}

      {all && (
        <div className="rm-layout">
          <div className="rm-rail">
            <Panel title="Filters">
              <Label>Set</Label>
              <div className="rm-pills">
                <Pill on={source === "pl1516"} onClick={() => { setSource("pl1516"); setKind("all"); }}>Premier League 15/16 shots</Pill>
                <Pill on={source === "kane"} onClick={() => { setSource("kane"); setKind("all"); }}>Striker drawings</Pill>
              </div>
              <Label>Kind</Label>
              <div className="rm-pills">
                <Pill on={kind === "all"} onClick={() => setKind("all")}>Every kind</Pill>
                {kinds.map((k) => <Pill key={k} on={kind === k} onClick={() => setKind(k)}>{KIND_LABEL[k] ?? k}</Pill>)}
              </div>
              <Label>Chance it went in</Label>
              <div className="rm-pills">
                {BANDS.map((b, i) => <Pill key={b.label} on={band === i} onClick={() => setBand(i)}>{b.label}</Pill>)}
                <Pill on={goalsOnly} onClick={() => setGoalsOnly((g) => !g)}>Goals only</Pill>
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
      <PageGuide page="/star-real-moments-dev" />
    </BroadcastPage>
  );
}
