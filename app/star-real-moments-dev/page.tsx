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
 */
import { useEffect, useMemo, useRef, useState } from "react";
import PageGuide from "@/components/admin/PageGuide";
import ScenarioPlay from "@/components/star/ScenarioPlay";
import { buildScenario, type Scenario, type ScenarioKind } from "@/lib/star/canvasEngine";
import { frameFromScenario, paint } from "@/lib/star/scenarioFrame";
import { mulberry32 } from "@/lib/star/season";
import { buildRealMoment, parseRealMoments, type RealMoment } from "@/lib/star/realMoments";
import { buildKaneMoment, KANE_MOMENTS_URL, type KaneMoment } from "@/lib/star/kaneMoments";

const CARD_W = 170;
/** Played bigger than the card's picture: at 170px the match's figures are
 *  too small to aim at. */
const PLAY_W = 340;
const PAGE = 24;
const KIND_LABEL: Partial<Record<ScenarioKind, string>> = {
  one_on_one: "One-on-one", volley: "In the box", tight_angle: "Tight angle",
  long_range: "Long range", midfield_pass: "Midfield",
  through_ball: "Through ball", buildup: "Build-up", cutback: "Pass in the box",
};

/** The game's Kane drawings, shown as cards (they carry their own target run). */
const kaneById = new Map<string, KaneMoment>();
function fromKane(k: KaneMoment): RealMoment {
  kaneById.set(k.id, k);
  return {
    id: k.id, source: "kane", kind: k.kind, seed: k.seed, override: k.override, faults: k.faults,
    meta: { player: "Harry Kane", match: `${k.meta.comp} · ${k.meta.match}`, minute: k.meta.minute, what: k.meta.what, xg: k.meta.xg },
  };
}
const BANDS: { label: string; lo: number; hi: number }[] = [
  { label: "All", lo: 0, hi: 1.01 },
  { label: "xG under 8%", lo: 0, hi: 0.08 },
  { label: "8–50%", lo: 0.08, hi: 0.5 },
  { label: "Over 50%", lo: 0.5, hi: 1.01 },
];

function Picture({ build, label }: { build: () => Scenario; label?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing && ref.current) paint(ref.current, frameFromScenario(build()), { baseW: CARD_W, maxW: CARD_W, maxH: 300 });
  }, [build, playing]);
  return (
    <div className="flex flex-col items-center gap-1">
      {label && <div className="text-[10px] font-black uppercase tracking-wider text-white">{label}</div>}
      {playing
        ? <div style={{ width: PLAY_W, maxWidth: "calc(100vw - 48px)" }}><ScenarioPlay build={build} width={PLAY_W} /></div>
        : <canvas ref={ref} className="rounded" />}
      <button onClick={() => setPlaying((p) => !p)}
        className="rounded bg-emerald-600 px-3 py-1 text-xs font-black text-white">
        {playing ? "■ Stop" : "▶ Play"}
      </button>
    </div>
  );
}

function Card({ m, index, withGame }: { m: RealMoment; index: number; withGame: boolean }) {
  const real = useMemo(() => () => { const k = kaneById.get(m.id); return k ? buildKaneMoment(k) : buildRealMoment(m); }, [m]);
  const game = useMemo(() => () => buildScenario(m.kind, mulberry32(50_000 + index)), [m.kind, index]);
  const faults = m.faults.filter((f) => f !== "attacker offside");
  return (
    <div className="rounded-lg border border-white/15 bg-white/5 p-2">
      <div className="mb-1 text-xs font-bold text-white">
        {m.meta.player ?? "?"} · {m.meta.minute}&apos;
      </div>
      <div className="mb-2 text-[11px] font-bold text-white/80">
        {m.meta.match}
        <br />
        {KIND_LABEL[m.kind] ?? m.kind} · {m.meta.what === "shot"
          ? <>xG {Math.round((m.meta.xg ?? 0) * 100)}% · <span className={m.meta.outcome === "Goal" ? "text-emerald-300" : ""}>{m.meta.outcome}</span></>
          : m.meta.what === "touch" ? "a touch" : m.meta.what}
      </div>
      <div className="flex flex-wrap gap-2">
        <Picture build={real} label={withGame ? "Real" : undefined} />
        {withGame && <Picture build={game} label="Game's own" />}
      </div>
      {faults.length > 0 && <div className="mt-1 text-[10px] font-bold text-amber-300">{faults.join(" · ")}</div>}
    </div>
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

  const list = useMemo(() => {
    if (!all) return [];
    const b = BANDS[band];
    return all.filter((m) => m.source === source
      && (kind === "all" || m.kind === kind)
      && (m.meta.what !== "shot" || ((m.meta.xg ?? 0) >= b.lo && (m.meta.xg ?? 0) < b.hi))
      && (!goalsOnly || m.meta.outcome === "Goal"));
  }, [all, source, kind, band, goalsOnly]);
  useEffect(() => setShown(PAGE), [source, kind, band, goalsOnly]);

  const kinds = useMemo(() => Array.from(new Set((all ?? []).filter((m) => m.source === source).map((m) => m.kind))), [all, source]);
  const chip = (on: boolean) => `rounded-full px-3 py-1 text-xs font-black ${on ? "bg-white text-black" : "bg-white/10 text-white"}`;

  async function loadKane() {
    try {
      const j = await (await fetch(KANE_MOMENTS_URL)).json() as { moments?: KaneMoment[] };
      const got = (j.moments ?? []).map(fromKane);
      if (!got.length) { setError("No Kane drawings found."); return; }
      setError(""); setAll(got); setSource("kane"); setKind("all"); setBand(0);
    } catch { setError("Couldn't load the Kane drawings."); }
  }

  async function load(file: File) {
    const got = parseRealMoments(await file.text());
    if (!got || !got.length) { setError("That file has no moments in it. Pick real-moments.json."); return; }
    setError(""); setAll(got);
  }

  return (
    <main className="min-h-screen bg-[#0b2414] px-4 py-6 text-white">
      <h1 className="text-xl font-black">Real moments</h1>
      <p className="mt-1 max-w-xl text-sm font-bold text-white">
        Real match positions (StatsBomb&apos;s free data) in our engine. Testing only: the file is loaded from your device and is not part of the game.
      </p>

      <label className="mt-4 inline-block cursor-pointer rounded bg-emerald-600 px-4 py-2 text-sm font-black">
        Load moments file
        <input type="file" accept=".json,application/json" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void load(f); }} />
      </label>
      <button className="ml-2 mt-4 inline-block rounded bg-amber-500 px-4 py-2 text-sm font-black text-black" onClick={() => void loadKane()}>
        Kane drawings (in the game)
      </button>
      {error && <div className="mt-2 text-sm font-bold text-red-300">{error}</div>}

      {all && (
        <>
          <div className="mt-4 flex flex-wrap gap-2">
            <button className={chip(source === "pl1516")} onClick={() => { setSource("pl1516"); setKind("all"); }}>Premier League 15/16 shots</button>
            <button className={chip(source === "kane")} onClick={() => { setSource("kane"); setKind("all"); }}>Kane, every touch</button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <button className={chip(kind === "all")} onClick={() => setKind("all")}>Every kind</button>
            {kinds.map((k) => <button key={k} className={chip(kind === k)} onClick={() => setKind(k)}>{KIND_LABEL[k] ?? k}</button>)}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {BANDS.map((b, i) => <button key={b.label} className={chip(band === i)} onClick={() => setBand(i)}>{b.label}</button>)}
            <button className={chip(goalsOnly)} onClick={() => setGoalsOnly((g) => !g)}>Goals only</button>
            <button className={chip(withGame)} onClick={() => setWithGame((g) => !g)}>Next to the game&apos;s own</button>
          </div>
          <div className="mt-3 text-sm font-bold text-white">{list.length.toLocaleString()} moments</div>
          <div className="mt-3 grid gap-3" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${withGame ? CARD_W * 2 + 30 : CARD_W + 20}px, 1fr))` }}>
            {list.slice(0, shown).map((m, i) => <Card key={m.id} m={m} index={i} withGame={withGame} />)}
          </div>
          {shown < list.length && (
            <button className="mt-4 rounded bg-white/10 px-4 py-2 text-sm font-black" onClick={() => setShown((s) => s + PAGE)}>More</button>
          )}
        </>
      )}
      <PageGuide page="/star-real-moments-dev" />
    </main>
  );
}
