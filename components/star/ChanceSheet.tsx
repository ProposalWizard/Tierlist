"use client";

/**
 * SHEET OF 24 — twenty-four chances of one kind, served one after another,
 * all on one screen.
 *
 * Asked for with the chance maker (27 Sep 2026): the standing rule is that
 * anything generated is checked BY EYE ("some of the generations are rlly
 * bad"), and a sheet is how that stays checked as drawings are added. Each
 * picture is painted by the gallery's own renderer (scenarioFrame.ts `paint`),
 * served in order exactly as pressing Next would serve them, from a fresh
 * memory, with whichever way the Play Area's Chances dial is set to.
 *
 * Under each picture: its number, where it came from (the drawing, "gen" for
 * the generator), the nearest drawing and how far away, and — in colour —
 * anything wrong: red for a fault the serving added, amber for a fault the
 * drawing itself already has, amber "like #n" for a picture within 3 m of one
 * of the five before it.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import type { ScenarioKind, Scenario } from "@/lib/star/canvasEngine";
import { mulberry32 } from "@/lib/star/season";
import { frameFromScenario, paint, type FrameKits } from "@/lib/star/scenarioFrame";
import { nextSim, newSimMemory, buildSimScenario, authoredShapeFor } from "@/lib/star/gallerySim";
import {
  devChanceMaker, simIsMadeHere, nextDrawnSeed, PictureMemory, pictureOf, pictureGap, servedFaults,
  drawingOwnFaults, nearestDrawing, SAME_PICTURE_M, type Picture,
} from "@/lib/star/chanceMaker";

interface Cell {
  n: number;
  sc: Scenario;
  source: string;
  near: string;
  added: string[];
  own: string[];
  like: number | null;
}

const short = (id: string | null | undefined) =>
  (id ?? "—").replace("gallery-", "").replace("gen:", "gen ").replace(/^(sim|v|main)-/, "").replace(/_/g, " ");

function makeSheet(kind: ScenarioKind, seed: number): Cell[] {
  const rng = mulberry32(seed);
  const mode = devChanceMaker();
  const fresh = new PictureMemory("sheet", false);
  const sel = newSimMemory();
  let last: string | undefined;
  const pics: Picture[] = [];
  const out: Cell[] = [];
  for (let n = 1; n <= 24; n++) {
    let sc: Scenario, sourceId: string | null, mirrored = false;
    if (simIsMadeHere(kind)) {
      const r = nextDrawnSeed(kind, rng, fresh, mode);
      sc = r.made.sc;
      sourceId = r.made.sourceId;
      mirrored = !!(r.made.shape as { mirrored?: boolean } | null)?.mirrored;
    } else {
      const spec = nextSim(kind, rng, sel, last);
      sc = buildSimScenario(spec);
      sourceId = authoredShapeFor(spec)?.sourceId ?? (spec.planId ? `plan ${spec.planId}` : null);
      last = JSON.stringify([sc.ball, sc.player, sc.keeper.x, sc.defenders.map((d) => [d.x, d.y])]);
    }
    const pic = pictureOf(sc);
    const all = servedFaults(sc);
    const drawn = !!sourceId && !sourceId.startsWith("gen:") && !sourceId.startsWith("plan ");
    const own = drawn ? drawingOwnFaults(kind, sourceId!, mirrored) : [];
    let like: number | null = null;
    for (let k = Math.max(0, pics.length - 5); k < pics.length; k++) if (pictureGap(pic, pics[k]) < SAME_PICTURE_M) like = k + 1;
    const nd = nearestDrawing(pic);
    out.push({
      n, sc, source: short(sourceId), near: nd ? `${short(nd.id)} ${nd.gap.toFixed(1)}m` : "—",
      added: all.filter((f) => !own.includes(f)), own: all.filter((f) => own.includes(f)), like,
    });
    pics.push(pic);
  }
  return out;
}

function SheetCell({ cell, w, kits }: { cell: Cell; w: number; kits: FrameKits | null }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) paint(ref.current, frameFromScenario(cell.sc), { baseW: w, maxW: w, maxH: 4000 }, kits ?? undefined);
  }, [cell, w, kits]);
  const bad = cell.added[0];
  const own = cell.own[0];
  return (
    <div style={{ width: w, background: "#0b1220", borderRadius: 10, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)" }}>
      <div style={{ padding: "4px 6px", fontSize: 11, fontWeight: 800, color: "#e5edf7", display: "flex", gap: 6, justifyContent: "space-between" }}>
        <span>#{cell.n}</span>
        <span style={{ color: "#93a4ba", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cell.source}</span>
      </div>
      <canvas ref={ref} style={{ display: "block" }} />
      <div style={{ padding: "3px 6px 5px", fontSize: 10.5, fontWeight: 700, lineHeight: 1.35, color: "#93a4ba" }}>
        <div>near {cell.near}</div>
        {bad && <div style={{ color: "#f87171" }}>{bad}</div>}
        {!bad && own && <div style={{ color: "#fbbf24" }}>in the drawing: {own}</div>}
        {cell.like !== null && <div style={{ color: "#fbbf24" }}>like #{cell.like}</div>}
      </div>
    </div>
  );
}

export default function ChanceSheet({ kinds, kits, onBack }: {
  kinds: ScenarioKind[]; kits: FrameKits | null; onBack: () => void;
}) {
  const [kind, setKind] = useState<ScenarioKind>(kinds[0] ?? "one_on_one");
  const [seed, setSeed] = useState(1);
  const [cells, setCells] = useState<Cell[] | null>(null);
  const [vw, setVw] = useState(390);
  useEffect(() => {
    const on = () => setVw(window.innerWidth);
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  // Built after first paint, so the screen shows at once and fills in.
  useEffect(() => {
    setCells(null);
    const id = window.setTimeout(() => setCells(makeSheet(kind, 0x5eed + seed * 7919)), 30);
    return () => window.clearTimeout(id);
  }, [kind, seed]);
  const cols = vw < 560 ? 2 : vw < 900 ? 3 : 6;
  const w = Math.floor((Math.min(vw, 1400) - 24 - (cols - 1) * 8) / cols);
  // Read once: the Play Area's Chances dial (drawings or generator).
  const mode = useMemo(() => devChanceMaker(), []);
  const shown = kinds;
  const summary = cells && {
    added: cells.filter((c) => c.added.length).length,
    own: cells.filter((c) => !c.added.length && c.own.length).length,
    like: cells.filter((c) => c.like !== null).length,
  };
  return (
    <div style={{ padding: "10px 12px 40px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        <button onClick={onBack} aria-label="Back" style={pill(false)}>&#8249; Back</button>
        {shown.map((k) => (
          <button key={k} onClick={() => setKind(k)} style={pill(k === kind)}>{k.replace(/_/g, " ")}</button>
        ))}
        <button onClick={() => setSeed((s) => s + 1)} style={pill(false)}>New sheet</button>
      </div>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: "#93a4ba", marginBottom: 10, lineHeight: 1.45 }}>
        24 {kind.replace(/_/g, " ")}s in a row, as served, from a fresh memory · chance maker: <b style={{ color: "#e0f2fe" }}>{mode === "drawings" ? "your drawings" : "generator"} (Play Area → Chances)</b>
        {summary && <> · <span style={{ color: summary.added ? "#f87171" : "#86efac" }}>{summary.added} with a fault the serving added</span> · {summary.own} with the drawing&apos;s own fault · {summary.like} like one of the 5 before</>}
      </div>
      {!cells ? (
        <div style={{ color: "#93a4ba", fontSize: 14, fontWeight: 700, padding: 20 }}>Serving 24…</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, ${w}px)`, gap: 8 }}>
          {cells.map((c) => <SheetCell key={c.n} cell={c} w={w} kits={kits} />)}
        </div>
      )}
    </div>
  );
}

function pill(on: boolean): React.CSSProperties {
  return {
    padding: "7px 11px", borderRadius: 999, cursor: "pointer", whiteSpace: "nowrap", textTransform: "capitalize",
    border: `1px solid ${on ? "rgba(56,189,248,0.7)" : "rgba(255,255,255,0.1)"}`,
    background: on ? "rgba(14,116,144,0.4)" : "rgba(255,255,255,0.05)",
    color: on ? "#e0f2fe" : "#c7d2e0", fontSize: 12.5, fontWeight: 800,
  };
}
