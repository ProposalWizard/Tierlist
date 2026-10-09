"use client";

/**
 * CUT-SCENE PEOPLE — the bench for the people layer every cut scene uses
 * (lib/star/cutscene/people.ts): faces and expressions, blinks and eyes,
 * hand poses, props in the hands, reaches, the handshake. Each proof drives
 * the layer the way a scene script does.
 *
 * Stills/films: window.__people (hold(t), camera(…), set(…)); __peopleReady.
 */
import { useEffect, useRef, useState } from "react";
import PageGuide from "@/components/admin/PageGuide";
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

function Chips<V extends string>({ value, options, onPick }: { value: V; options: [V, string][]; onPick: (v: V) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(([v, label]) => (
        <button key={v} onClick={() => onPick(v)} className={`rounded-full px-3 py-1 text-xs font-bold ${v === value ? "bg-amber-400 text-black" : "bg-white/10 text-white"}`}>{label}</button>
      ))}
    </div>
  );
}

export default function PeopleDevPage() {
  const wrap = useRef<HTMLDivElement>(null);
  const handle = useRef<BenchHandle | null>(null);

  const [state, setState] = useState<BenchState>({
    proof: "faces", model: "player", skin: SKIN_TONES[2].hex, hair: "#3d2616", expression: "neutral", hand: "relaxed", turn: 0, look: "new",
  });
  const [err, setErr] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    document.body.classList.add("knowitball-immersive");
    return () => document.body.classList.remove("knowitball-immersive");
  }, []);

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

  return (
    <div className="fixed inset-0 bg-black text-white">
      <div ref={wrap} className="absolute inset-0" />
      <div className="absolute inset-x-0 top-0 h-[6%] bg-black" />
      <div className="absolute inset-x-0 bottom-0 max-h-[46%] overflow-y-auto bg-gradient-to-t from-black/90 to-black/50 p-3 space-y-2" data-controls>
        {err && <div className="rounded bg-red-600/80 p-2 text-xs">The 3D didn&apos;t start: {err}</div>}
        {!ready && !err && <div className="text-xs text-white/80">Loading the people…</div>}
        <Chips value={state.proof} options={PROOFS} onPick={(proof) => set({ proof })} />
        <Chips value={state.model} options={MODELS} onPick={(model) => set({ model })} />
        <div className="flex flex-wrap gap-1.5">
          {SKIN_TONES.map((t) => (
            <button key={t.id} aria-label={t.label} onClick={() => set({ skin: t.hex })} className={`h-6 w-6 rounded-full border-2 ${state.skin === t.hex ? "border-amber-400" : "border-white/30"}`} style={{ background: t.hex }} />
          ))}
          {HAIRS.map(([hex, label]) => (
            <button key={hex} onClick={() => set({ hair: hex })} className={`rounded-full px-2 text-[11px] font-bold ${state.hair === hex ? "bg-amber-400 text-black" : "bg-white/10"}`}>{label} hair</button>
          ))}
        </div>
        <Chips value={state.expression} options={(Object.keys(EXPRESSIONS) as ExpressionName[]).map((e) => [e, e])} onPick={(expression) => set({ expression })} />
        {state.proof === "hands" && <Chips value={state.hand} options={HAND_POSE_NAMES.map((h) => [h, h] as [HandPoseName, string])} onPick={(hand) => set({ hand })} />}
        {state.proof === "faces" && (
          <div className="flex items-center gap-2 text-xs">Turn <input type="range" min={-60} max={60} value={state.turn} onChange={(e) => set({ turn: Number(e.target.value) })} className="flex-1" /> {state.turn}°</div>
        )}
        <div className="flex items-center gap-2 text-xs">
          <span className="font-bold">Cut-scene people:</span>
          <Chips value={state.look} options={[["new", "New"], ["old", "Old"]]} onPick={(v) => set({ look: v })} />
          <button onClick={() => handle.current?.play(0)} className="ml-auto rounded-full bg-white/15 px-3 py-1 font-bold">↺ Play again</button>
        </div>
      </div>
      <PageGuide page="/star-people-dev" corner="top-right" />
    </div>
  );
}
