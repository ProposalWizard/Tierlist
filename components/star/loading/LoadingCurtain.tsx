"use client";

/**
 * THE ONE LOADING SCREEN (Harry, 27 Nov 2026): "loading screens must MATCH
 * THE SECTION YOU'RE GOING INTO, with several options per section so it
 * doesn't get old." "That's dead" — of a plain moving bar.
 *
 *   <LoadingCurtain section="garden" loading={status === "loading"} />
 *
 * Put it in the place that is loading. It covers the screen (or, with
 * `box`, just its parent) while `loading` is true, and goes the moment it is
 * false, in the same frame (no fade: a fading screen let the place's tips show
 * through). While it is up, tutorial tips wait and the match is held
 * (lib/star/loading/state.ts). Which screen shows is picked
 * per section (lib/star/loading/pick.ts), never the same one twice in a row.
 *
 * Handing on: the place's own file arriving (lazyScreen's waiting cover)
 * and then the place building are two mounts of this. A second mount of the
 * same section within 1.5 s carries on the SAME screen from where it was
 * (every animation starts at a negative delay), so it reads as one wait.
 *
 * Light: all motion is CSS transforms and opacity (curtain.css) on the
 * compositor, so it keeps moving while the place blocks the page building
 * itself, and costs the place nothing. The only timer is the quiet
 * progress ring, read four times a second.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { pitchFont } from "@/components/star/ui/pitchFont";
import { LOAD_MEMORY_KEY, LOAD_VARIANTS, pickVariant, readLast, writeLast, type LoadSection, type LoadVariant } from "@/lib/star/loading/pick";
import { loadContext, type LoadContext } from "@/lib/star/loading/context";
import { startLoadWatch, type LoadWatch } from "@/lib/star/loading/progress";
import { curtainUp } from "@/lib/star/loading/state";
import Keepie from "./Keepie";
import Programme from "./Programme";
import Tunnel from "./Tunnel";
import DrillBoard from "./DrillBoard";
import Gala from "./Gala";
import "./curtain.css";

/** Sections whose place loads three.js itself: the ring may count its files. */
const THREE_PLACES: LoadSection[] = ["garden", "house", "shop", "casino", "gym", "training", "ballon-dor", "awards"];

export const WHERE: Record<LoadSection, string> = {
  "first-load": "Getting the game ready",
  match: "Getting the team sheets",
  garden: "Out to the garden",
  house: "Opening your house",
  shop: "Into the shop",
  casino: "Into the casino",
  gym: "Into the gym",
  training: "Setting up the drill",
  "ballon-dor": "Taking your seats",
  awards: "Taking your seats",
};

interface Session {
  section: LoadSection;
  variant: LoadVariant;
  /** performance.now() when it first showed. */
  t0: number;
  open: number;
  closedAt: number | null;
  watch: LoadWatch;
}
const sessions = new Map<LoadSection, Session>();
const curtainOff = () => { try { return localStorage.getItem("kib-loading-off") === "1"; } catch { return false; } };
const CARRY_MS = 1500;

function openSession(section: LoadSection, three: boolean, only?: (v: LoadVariant) => boolean, force?: string): { s: Session; fresh: boolean } {
  const now = performance.now();
  const old = sessions.get(section);
  if (old && (!force || old.variant.id === force) && (old.open > 0 || (old.closedAt !== null && now - old.closedAt < CARRY_MS))) {
    old.open++;
    old.closedAt = null;
    return { s: old, fresh: false };
  }
  let raw: string | null = null;
  try { raw = localStorage.getItem(LOAD_MEMORY_KEY); } catch { /* no memory: still never twice in this visit */ }
  const last = readLast(raw, section) ?? old?.variant.id ?? null;
  const forced = force ? LOAD_VARIANTS[section].find((v) => v.id === force) : undefined;
  const variant = forced ?? pickVariant(section, last, Math.random(), only);
  if (!forced) { try { localStorage.setItem(LOAD_MEMORY_KEY, writeLast(raw, section, variant.id)); } catch { /* fine */ } }
  const s: Session = { section, variant, t0: now, open: 1, closedAt: null, watch: startLoadWatch(section, three) };
  sessions.set(section, s);
  return { s, fresh: true };
}
function closeSession(s: Session) {
  s.open = Math.max(0, s.open - 1);
  if (s.open === 0) s.closedAt = performance.now();
}
/** The place said it is ready: remember its file count, and the next wait starts afresh. */
function finishSession(section: LoadSection) {
  const s = sessions.get(section);
  if (!s || s.open > 0) return;
  s.watch.done();
  sessions.delete(section);
}

export interface LoadingCurtainProps {
  section: LoadSection;
  loading: boolean;
  /** Cover only the parent (it must be position: relative), not the whole screen. */
  box?: boolean;
  /** What to say (else what the screen leading here set: lib/star/loading/context.ts). */
  ctx?: LoadContext;
  /** Leave some screens out (e.g. the tunnel when there is no fixture). */
  only?: (v: LoadVariant) => boolean;
  /** The test page (/star-loading-dev): show this one (a LOAD_VARIANTS id), not a random pick. */
  variant?: string;
}

export default function LoadingCurtain({ section, loading, box, ctx, only, variant: force }: LoadingCurtainProps) {
  const [mounted, setMounted] = useState(false);
  const [shown, setShown] = useState(loading);
  const sess = useRef<{ s: Session; fresh: boolean } | null>(null);
  const [, rerender] = useState(0);
  const three = THREE_PLACES.includes(section);

  // open while loading; on ready, fade then drop
  useEffect(() => {
    setMounted(true);
    if (!loading) {
      finishSession(section);
      // gone at once, no fade: a fading screen let the place's first tip and HUD show through it
      setShown(false);
      return;
    }
    sess.current = openSession(section, three, only, force);
    setShown(true);
    rerender((n) => n + 1);
    const mine = sess.current;
    return () => { closeSession(mine.s); };
    // only/three are fixed per mount on purpose
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, section, force]);

  // while it is up, tips and pop-ups wait and the match is held (lib/star/loading/state.ts)
  useEffect(() => {
    if (!loading || !shown) return;
    return curtainUp();
  }, [loading, shown]);

  // the quiet ring: real files done, four reads a second, only once the wait is long enough to need it
  const [prog, setProg] = useState<number | null>(null);
  useEffect(() => {
    if (!loading || !three) return;
    const id = window.setInterval(() => {
      const s = sess.current?.s;
      if (!s || performance.now() - s.t0 < 900) return;
      setProg(s.watch.now());
    }, 250);
    return () => clearInterval(id);
  }, [loading, three]);

  const c = ctx ?? loadContext(section) ?? {};
  const s = sess.current?.s ?? sessions.get(section) ?? null;
  const elapsed = s ? (performance.now() - s.t0) / 1000 : 0;
  // fixed at the render that opened it, so a re-render never restarts an animation
  const style = useMemo(() => ({ "--lc-t": `${-elapsed.toFixed(3)}s` }) as CSSProperties, [s]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!mounted || !shown || !loading || !s) return null;
  // Off on this device (localStorage kib-loading-off = 1): for measuring a place's load with and
  // without its screen. A hidden marker stays while it loads, so a timer can still see "ready".
  if (curtainOff()) return loading ? <i hidden data-kib-curtain-off={section} /> : null;
  const v = s.variant;
  const body = (
    <div
      className={`lc-root ${pitchFont.variable} ${box ? "lc-box" : ""}`}
      style={style}
      data-kib-curtain={v.id}
      data-loading-section={section}
      aria-busy={loading}
      role="status"
    >
      {v.kind === "keepie" && <Keepie variant={v} section={section} box={box} t0={s.t0} />}
      {v.kind === "programme" && <Programme variant={v} data={c.programme} />}
      {v.kind === "tunnel" && <Tunnel data={c.programme} />}
      {v.kind === "board" && <DrillBoard variant={v} ctx={c} />}
      {v.kind === "gala" && <Gala variant={v} ctx={c} section={section} />}
      <div className={`lc-where ${v.kind === "tunnel" ? "lc-tn-where" : ""}`}>
        <span>{v.kind === "board" && c.drill?.name ? c.drill.name : WHERE[section]}</span>
        <span className="lc-dots" aria-hidden><i style={{ "--d": "0s" } as CSSProperties} /><i style={{ "--d": ".2s" } as CSSProperties} /><i style={{ "--d": ".4s" } as CSSProperties} /></span>
        {three && <Ring p={prog} />}
      </div>
    </div>
  );
  return box ? body : createPortal(body, document.body);
}

function Ring({ p }: { p: number | null }) {
  const r = 5.6, len = 2 * Math.PI * r;
  return (
    <svg className={`lc-ring ${p !== null ? "on" : ""}`} viewBox="0 0 14 14" aria-hidden data-loading-progress={p === null ? "" : p.toFixed(2)}>
      <circle className="bg" cx="7" cy="7" r={r} />
      <circle className="fg" cx="7" cy="7" r={r} strokeDasharray={len} strokeDashoffset={len * (1 - (p ?? 0))} />
    </svg>
  );
}
