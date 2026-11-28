"use client";

/**
 * Training: the coach's drill board (Harry, 27 Nov 2026: "training → a
 * drill-board/whiteboard"). The drill you picked, drawn as the coach would:
 * magnets go on, the runs and passes are drawn in marker one after another
 * (a cover sliding off each stroke, so it is compositor-only), one line of
 * the coach's note. Three boards: whiteboard, chalkboard, magnetic pitch.
 */
import type { CSSProperties, ReactNode } from "react";
import type { LoadVariant } from "@/lib/star/loading/pick";
import type { LoadContext } from "@/lib/star/loading/context";

type Pt = [number, number];
interface Plan {
  mags: { at: Pt; label: string; who: "you" | "mate" | "gk" }[];
  strokes: { d: string; dir: "x" | "y"; dash?: boolean; hot?: boolean }[];
  cones?: Pt[];
  note: string;
}

/** The board's drawing for a drill, by its name (the 3D drills: lib/star/play3d/drills.ts, and the Crossbar Challenge). */
export function boardPlan(name = ""): Plan {
  const n = name.toLowerCase();
  if (n.includes("crossbar")) return {
    mags: [{ at: [50, 82], label: "", who: "you" }, { at: [24, 78], label: "", who: "mate" }],
    strokes: [{ d: "M50 78 C 48 50, 52 30, 50 12", dir: "y", hot: true }, { d: "M24 74 C 30 52, 40 28, 47 13", dir: "y", dash: true }],
    note: "Five each. The bar, not the post.",
  };
  if (n.includes("two touch")) return {
    mags: [{ at: [28, 76], label: "", who: "you" }, { at: [72, 54], label: "", who: "mate" }, { at: [50, 12], label: "GK", who: "gk" }],
    strokes: [{ d: "M30 72 L 68 56", dir: "x" }, { d: "M70 50 L 34 36", dir: "x", dash: true }, { d: "M36 32 C 42 24, 46 18, 49 15", dir: "y", hot: true }],
    note: "Two touches, then it has to go.",
  };
  if (n.includes("header") || n.includes("volley")) return {
    mags: [{ at: [50, 40], label: "", who: "you" }, { at: [90, 46], label: "", who: "mate" }, { at: [50, 10], label: "GK", who: "gk" }],
    strokes: [{ d: "M88 42 C 76 18, 60 20, 52 34", dir: "x", dash: true }, { d: "M50 36 L 47 14", dir: "y", hot: true }],
    note: "Attack the ball. Eyes open.",
  };
  if (n.includes("sprint") || n.includes("pace")) return {
    mags: [{ at: [18, 84], label: "", who: "you" }],
    strokes: [{ d: "M22 82 L 84 20", dir: "x", hot: true }],
    cones: [[18, 88], [40, 64], [62, 42], [84, 20]],
    note: "Flat out to the last cone.",
  };
  if (n.includes("wembley")) return {
    mags: [{ at: [30, 70], label: "", who: "you" }, { at: [66, 66], label: "", who: "mate" }, { at: [50, 30], label: "", who: "gk" }, { at: [50, 10], label: "GK", who: "gk" }],
    strokes: [{ d: "M32 66 C 40 50, 46 44, 50 36", dir: "y" }, { d: "M52 34 L 49 14", dir: "y", hot: true }],
    note: "Last goal wins. Don't be the one out.",
  };
  return {
    mags: [{ at: [50, 86], label: "", who: "you" }, { at: [50, 10], label: "GK", who: "gk" }],
    strokes: [{ d: "M50 82 C 30 70, 70 56, 46 42 S 60 24, 50 14", dir: "y", hot: true }],
    cones: [[36, 70], [62, 56], [40, 40], [58, 28]],
    note: "Head up. Beat the cones, then finish.",
  };
}

export default function DrillBoard({ variant, ctx }: { variant: LoadVariant; ctx: LoadContext }) {
  const look = variant.look ?? "white";
  const plan = boardPlan(ctx.drill?.name);
  const shirt = ctx.drill?.shirt ?? ctx.shirt ?? "#dc2626";
  const magStyle = (who: string): CSSProperties => who === "you"
    ? { background: shirt, color: "#fff" }
    : who === "gk" ? { background: "#facc15", color: "#111" } : { background: "#f8fafc", color: "#111" };
  let at = 0.35;
  const next = (gap: number) => { const a = at; at += gap; return `${a}s`; };
  const strokes: ReactNode[] = plan.strokes.map((s, i) => (
    <div key={i} className={`lc-bd-reveal ${s.dir === "y" ? "y" : ""}`} style={{ "--at": next(0.75) } as CSSProperties}>
      <div>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
          <defs><marker id={`lc-ah-${i}`} viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill={s.hot ? "var(--ink2)" : "var(--ink)"} /></marker></defs>
          <path d={s.d} fill="none" stroke={s.hot ? "var(--ink2)" : "var(--ink)"} strokeWidth={s.hot ? 2.6 : 2} strokeLinecap="round" strokeDasharray={s.dash ? "4 3" : undefined} markerEnd={`url(#lc-ah-${i})`} vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
    </div>
  ));
  return (
    <>
      <div className="lc-bd-wall" />
      <div className={`lc-bd-board lc-bd-${look}`}>
        <div className="lc-bd-title lc-display"><small>Today&apos;s drill</small>{ctx.drill?.name ?? "Training"}</div>
        <div className="lc-bd-svg">
          {/* the pitch: the box and the goal at the top */}
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: "absolute", inset: 0 }}>
            <rect x="2" y="2" width="96" height="96" className="lc-bd-line" vectorEffect="non-scaling-stroke" />
            <rect x="22" y="2" width="56" height="24" className="lc-bd-line" vectorEffect="non-scaling-stroke" />
            <rect x="38" y="2" width="24" height="9" className="lc-bd-line" vectorEffect="non-scaling-stroke" />
            <path d="M 36 26 A 14 10 0 0 0 64 26" className="lc-bd-line" vectorEffect="non-scaling-stroke" />
            <line x1="42" y1="2" x2="58" y2="2" stroke="var(--ink2)" strokeWidth="5" vectorEffect="non-scaling-stroke" />
          </svg>
          {(plan.cones ?? []).map(([x, y], i) => <div key={`c${i}`} className="lc-bd-cone" style={{ left: `${x}%`, top: `${y}%` }} />)}
          {plan.mags.map((m, i) => (
            <div key={`m${i}`} className={`lc-bd-mag ${m.who === "you" ? "you" : ""}`} style={{ left: `${m.at[0]}%`, top: `${m.at[1]}%`, ...magStyle(m.who), "--at": `${0.05 + i * 0.12}s` } as CSSProperties}>
              {m.who === "you" ? "YOU" : m.label}
            </div>
          ))}
          {strokes}
        </div>
        <div className="lc-bd-note">“{ctx.drill?.line ?? plan.note}”</div>
        <div className="lc-bd-marker" />
      </div>
    </>
  );
}
