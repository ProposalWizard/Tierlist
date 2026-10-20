"use client";

/**
 * CUT-SCENE PEOPLE — the bench for the people layer every cut scene uses
 * (lib/star/cutscene/people.ts): faces and expressions, blinks and eyes,
 * hand poses, props in the hands, reaches, the handshake. Each proof drives
 * the layer the way a scene script does.
 *
 * Two layouts of the same controls (Harry, 19 Oct 2026: "cut scene people opt 1
 * and 2"): Studio (picture left, controls right) and Contact sheet (pick bar,
 * picture, a sheet of cards). The 3D view is ONE element in both, so switching
 * layouts never restarts it.
 *
 * Stills/films: window.__people (hold(t), camera(…), set(…)); __peopleReady.
 */
import { useEffect, useRef, useState } from "react";
import PageGuide from "@/components/admin/PageGuide";
import { BroadcastPage, Panel, Btn, Pill, Label, Note } from "@/components/admin/broadcast/BroadcastPage";
import "./people.css";
import { SKIN_TONES } from "@/lib/star/playerIdentity";
import { previewHumanBodyLook } from "@/lib/star/human3d/look";
import type { BenchHandle, BenchProof, BenchState } from "@/lib/star/cutscene/peopleBench";
import { EXPRESSIONS } from "@/lib/star/cutscene/face";
import { HAND_POSE_NAMES, type HandPoseName } from "@/lib/star/cutscene/hands";
import type { ExpressionName } from "@/lib/star/cutscene/face";
import type { PersonModel } from "@/lib/star/people3d";

const PROOFS: [BenchProof, string][] = [
  ["faces", "Face"], ["hands", "Hands"], ["sign", "Pen signing"], ["shake", "Handshake"], ["shirt", "Shirt"], ["trophy", "Trophy"], ["goal", "Knee slide"],
];
const MODELS: [PersonModel, string][] = [["player", "Short"], ["player-buzz", "Buzz"], ["player-long", "Long"], ["manager", "Manager"]];
const HAIRS = [["#17110d", "Black"], ["#3d2616", "Brown"], ["#b88a4a", "Fair"]] as const;
const EXPR = Object.keys(EXPRESSIONS) as ExpressionName[];
const DEFAULTS: BenchState = {
  proof: "faces", model: "player", skin: SKIN_TONES[2].hex, hair: "#3d2616", expression: "neutral", hand: "relaxed", turn: 0, look: "new",
};

const LAYOUT_KEY = "star-people-layout";
type Layout = "studio" | "sheet";

function Pills<V extends string>({ value, options, onPick }: { value: V; options: [V, string][]; onPick: (v: V) => void }) {
  return (
    <div className="pp-row">
      {options.map(([v, label]) => <Pill key={v} on={v === value} onClick={() => onPick(v)}>{label}</Pill>)}
    </div>
  );
}

function Pick<V extends string>({ label, value, options, onPick }: { label: string; value: V; options: [V, string][]; onPick: (v: V) => void }) {
  return (
    <label className="pp-pick">
      <span>{label}</span>
      <select value={value} onChange={(e) => onPick(e.target.value as V)}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

export default function PeopleDevPage() {
  const wrap = useRef<HTMLDivElement>(null);
  const handle = useRef<BenchHandle | null>(null);

  const [state, setState] = useState<BenchState>(DEFAULTS);
  const [err, setErr] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [layout, setLayoutRaw] = useState<Layout>("studio");

  useEffect(() => {
    try { if (localStorage.getItem(LAYOUT_KEY) === "sheet") setLayoutRaw("sheet"); } catch { /* no storage */ }
  }, []);
  const setLayout = (l: Layout) => {
    setLayoutRaw(l);
    try { localStorage.setItem(LAYOUT_KEY, l); } catch { /* no storage */ }
  };
  // The 3D view sizes itself on window resize; a layout change moves its box.
  useEffect(() => {
    const id = window.setTimeout(() => window.dispatchEvent(new Event("resize")), 30);
    return () => window.clearTimeout(id);
  }, [layout, ready]);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    let dead = false;
    const q = new URLSearchParams(window.location.search);
    // The test page shows the new people (this page only; Settings is not changed): ?body=before, ?look=old to compare.
    previewHumanBodyLook(q.get("body") === "before" ? "before" : "human");
    const first: BenchState = {
      ...state,
      proof: (q.get("proof") as BenchProof) ?? state.proof,
      model: (q.get("model") as PersonModel) ?? state.model,
      skin: q.get("skin") ? `#${q.get("skin")}` : state.skin,
      expression: (q.get("expr") as ExpressionName) ?? state.expression,
      look: q.get("look") === "old" ? "old" : "new",
    };
    setState(first);
    import("@/lib/star/cutscene/peopleBench").then(({ createPeopleBench }) => createPeopleBench(el, first)).then((h) => {
      if (dead) { h.dispose(); return; }
      handle.current = h;
      (window as unknown as { __people?: BenchHandle; __peopleReady?: boolean }).__people = h;
      (window as unknown as { __peopleReady?: boolean }).__peopleReady = true;
      setReady(true);
    }).catch((e) => setErr(String(e?.message ?? e)));
    return () => { dead = true; handle.current?.dispose(); handle.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (s: Partial<BenchState>) => {
    setState((o) => ({ ...o, ...s }));
    handle.current?.set(s);
  };
  const reset = () => set({ ...DEFAULTS });
  const playAgain = () => handle.current?.play(0);

  const skins = (
    <div className="pp-row">
      {SKIN_TONES.map((t) => (
        <button key={t.id} aria-label={t.label} title={t.label} onClick={() => set({ skin: t.hex })} className="pp-skin" aria-pressed={state.skin === t.hex} style={{ background: t.hex }} />
      ))}
    </div>
  );
  const hairs = <Pills value={state.hair} options={HAIRS.map(([h, l]) => [h, `${l} hair`] as [string, string])} onPick={(hair) => set({ hair })} />;
  const turn = state.proof === "faces" && (
    <div className="pp-turn">
      <Label>Turn</Label>
      <input type="range" min={-60} max={60} value={state.turn} onChange={(e) => set({ turn: Number(e.target.value) })} aria-label="Turn" />
      <span>{state.turn}°</span>
    </div>
  );
  const look = (
    <div className="pp-row pp-look">
      <Label>Cut-scene people</Label>
      <Pill on={state.look === "new"} onClick={() => set({ look: "new" })}>New</Pill>
      <Pill on={state.look === "old"} onClick={() => set({ look: "old" })}>Old</Pill>
    </div>
  );
  const status = (
    <>
      {err && <div className="pp-err">The 3D didn&apos;t start: {err}</div>}
      {!ready && !err && <Note>Loading the people…</Note>}
    </>
  );

  return (
    <BroadcastPage
      title="Cut-scene people"
      sub="Faces, hands and the moves every cut scene uses."
      actions={
        <div className="pp-row">
          <Pill on={layout === "studio"} onClick={() => setLayout("studio")}>Studio</Pill>
          <Pill on={layout === "sheet"} onClick={() => setLayout("sheet")}>Contact sheet</Pill>
        </div>
      }
    >
      <div className="pp-wrap" data-layout={layout}>
        <div className="pp-view">
          <div ref={wrap} className="pp-canvas" />
          <div className="pp-viewbar">
            <span>{PROOFS.find(([p]) => p === state.proof)?.[1]} · {state.expression}</span>
            <Btn onClick={playAgain}>↺ Play again</Btn>
          </div>
        </div>

        {layout === "studio" ? (
          <Panel title="Controls" note="Pick a proof, then change him">
            <div className="pp-ctrl" data-controls>
              {status}
              <div><Label>Proof</Label><Pills value={state.proof} options={PROOFS} onPick={(proof) => set({ proof })} /></div>
              <div><Label>Head</Label><Pills value={state.model} options={MODELS} onPick={(model) => set({ model })} /></div>
              <div><Label>Skin</Label>{skins}</div>
              <div><Label>Hair</Label>{hairs}</div>
              <div><Label>Expression</Label><Pills value={state.expression} options={EXPR.map((e) => [e, e])} onPick={(expression) => set({ expression })} /></div>
              {state.proof === "hands" && <div><Label>Hand pose</Label><Pills value={state.hand} options={HAND_POSE_NAMES.map((h) => [h, h] as [HandPoseName, string])} onPick={(hand) => set({ hand })} /></div>}
              {turn}
              {look}
            </div>
          </Panel>
        ) : (
          <div className="pp-sheet" data-controls>
            <div className="pp-bar">
              <Pick label="Proof" value={state.proof} options={PROOFS} onPick={(proof) => set({ proof })} />
              <Pick label="Head" value={state.model} options={MODELS} onPick={(model) => set({ model })} />
              <Pick label="Hair" value={state.hair} options={HAIRS.map(([h, l]) => [h, l] as [string, string])} onPick={(hair) => set({ hair })} />
              <Btn onClick={reset}>Reset</Btn>
            </div>
            {status}
            <div className="pp-side">
              <Label>Skin</Label>
              {skins}
              {turn}
              {look}
            </div>
            <Label>Expression</Label>
            <div className="pp-cards">
              {EXPR.map((e) => (
                <button key={e} className="pp-card" aria-pressed={state.expression === e} onClick={() => set({ expression: e })}>{e}</button>
              ))}
            </div>
            {state.proof === "hands" && (
              <>
                <Label>Hand pose</Label>
                <div className="pp-cards">
                  {HAND_POSE_NAMES.map((h) => (
                    <button key={h} className="pp-card" aria-pressed={state.hand === h} onClick={() => set({ hand: h })}>{h}</button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
      <PageGuide page="/star-people-dev" corner="top-right" />
    </BroadcastPage>
  );
}
