"use client";

/**
 * MIKEY'S NEW POP-UPS (Mikey, 20 Oct 2026) — Settings → "Mikey's new pop-ups".
 *
 * "when you score or assist … it pops up with a scoreboard of the game and it
 * does an animation where it changes the score … from 1-0 to 2-0 … showed the
 * goal scorer and the player who got the assist … near the top … It should be
 * quick … also do it for everything else."
 *
 * Two TV-style graphics, both drawn in code (no new pictures to load):
 *   • GOAL: a scoreboard slides down from the top. The two clubs sit either
 *     side in their kit colours; the scoring side's number rolls from the old
 *     score to the new one with a gold flash; a strip under it names the
 *     scorer and the assist. Up for 1.5 s (today's GOAL is 1.3 s).
 *   • Everything else (PASS, OFFSIDE, INTERCEPTED, SAVED…): a short caption
 *     strip — a coloured tab with an icon, then the word — that wipes in,
 *     holds and wipes out in 0.8–1 s. It sits in the half of the pitch the
 *     ball is not in, like today's banner.
 *
 * Picture only: taps go straight through (pointer-events: none). Runs its own
 * clock, so a cut to the commentary never cuts it short.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { popupMs, popupTone, type PopupTone } from "@/lib/star/mikeyPopups";

export interface PopupTeam { name: string; shirt: string; trim: string; ink: string }

export interface PopupGoal {
  home: PopupTeam;
  away: PopupTeam;
  /** The score before the goal, and after it. */
  from: [number, number];
  to: [number, number];
  scorer?: string;
  assist?: string;
  /** Their goal (a penalty they scored past your keeper): the strip says so. */
  theirs?: boolean;
}

export interface PopupItem {
  id: number;
  text: string;
  ms: number;
  side: "top" | "bottom";
  goal?: PopupGoal;
  cut?: boolean;
}

const MIN_SHOW_MS = 350;
const CUT_FADE_MS = 160;

export function useMikeyPopup() {
  const [item, setItem] = useState<PopupItem | null>(null);
  const cur = useRef<PopupItem | null>(null);
  const idRef = useRef(0);
  const endTimer = useRef<number | null>(null);
  const waitTimer = useRef<number | null>(null);
  const pending = useRef<Omit<PopupItem, "id" | "ms"> | null>(null);
  const shownAt = useRef(0);

  const put = useCallback((p: Omit<PopupItem, "id" | "ms">) => {
    const it: PopupItem = { ...p, id: ++idRef.current, ms: popupMs(p.text) };
    cur.current = it;
    setItem(it);
    if (endTimer.current) window.clearTimeout(endTimer.current);
    endTimer.current = window.setTimeout(() => {
      if (cur.current?.id === it.id) { cur.current = null; setItem(null); }
    }, it.ms);
  }, []);

  /** Show a pop-up. A goal always shows at once; anything else waits until the last one has been read. */
  const show = useCallback((p: Omit<PopupItem, "id" | "ms">) => {
    const c = cur.current;
    const age = c ? performance.now() - shownAt.current : Infinity;
    // Never knock a goal's scoreboard off with a lesser word.
    if (c?.goal && !p.goal && age < c.ms - 150) return;
    if (c && !p.goal && age < MIN_SHOW_MS) {
      pending.current = p;
      if (!waitTimer.current) {
        waitTimer.current = window.setTimeout(() => {
          waitTimer.current = null;
          const q = pending.current;
          pending.current = null;
          if (q) { shownAt.current = performance.now(); put(q); }
        }, MIN_SHOW_MS - age);
      }
      return;
    }
    shownAt.current = performance.now();
    put(p);
  }, [put]);

  /** A new screen came up (half time, full time, the scores): fade out fast. */
  const cut = useCallback(() => {
    pending.current = null;
    if (waitTimer.current) { window.clearTimeout(waitTimer.current); waitTimer.current = null; }
    const c = cur.current;
    if (!c || c.cut) return;
    const it = { ...c, cut: true };
    cur.current = it;
    setItem(it);
    if (endTimer.current) window.clearTimeout(endTimer.current);
    endTimer.current = window.setTimeout(() => {
      if (cur.current?.id === it.id) { cur.current = null; setItem(null); }
    }, CUT_FADE_MS);
  }, []);

  useEffect(() => () => {
    if (endTimer.current) window.clearTimeout(endTimer.current);
    if (waitTimer.current) window.clearTimeout(waitTimer.current);
  }, []);

  return { item, show, cut };
}

const FONT = "KibBroadcast";
const CSS = `
@font-face {
  font-family: "${FONT}";
  src: url("/star/banners/Oswald-Bold.woff2") format("woff2");
  font-weight: 700;
  font-display: block;
}
@keyframes kmp-board {
  0%   { transform: translateY(-140%); opacity: 0; }
  12%  { transform: translateY(6%); opacity: 1; }
  18%  { transform: translateY(0); }
  86%  { transform: translateY(0); opacity: 1; }
  100% { transform: translateY(-140%); opacity: 0; }
}
@keyframes kmp-sub {
  0%, 16% { transform: scaleY(0); opacity: 0; }
  26%     { transform: scaleY(1); opacity: 1; }
  82%     { transform: scaleY(1); opacity: 1; }
  92%, 100% { transform: scaleY(0); opacity: 0; }
}
@keyframes kmp-old { 0%, 22% { transform: translateY(0); opacity: 1; } 34%, 100% { transform: translateY(-110%); opacity: 0; } }
@keyframes kmp-new { 0%, 22% { transform: translateY(110%); opacity: 0; } 34%, 100% { transform: translateY(0); opacity: 1; } }
@keyframes kmp-flash { 0%, 24% { opacity: 0; } 30% { opacity: 1; } 60%, 100% { opacity: 0; } }
@keyframes kmp-tag { 0%, 8% { transform: scaleX(0); } 18%, 84% { transform: scaleX(1); } 96%, 100% { transform: scaleX(0); } }
@keyframes kmp-strip {
  0%   { clip-path: inset(0 100% 0 0); transform: translateX(-12px); }
  16%  { clip-path: inset(0 0 0 0); transform: translateX(0); }
  82%  { clip-path: inset(0 0 0 0); transform: translateX(0); }
  100% { clip-path: inset(0 0 0 100%); transform: translateX(12px); }
}
@keyframes kmp-shine { 0%, 14% { transform: translateX(-120%) skewX(-20deg); } 48%, 100% { transform: translateX(260%) skewX(-20deg); } }
@media (prefers-reduced-motion: reduce) {
  .kmp-anim, .kmp-anim * { animation-duration: 1ms !important; animation-delay: 0ms !important; }
}
`;

/** Colours of each kind of caption: the tab, its glow, and the accent line. */
const TONE: Record<PopupTone, { tab: string; edge: string; word: string }> = {
  good:  { tab: "linear-gradient(180deg,#34f5c5,#0ea5a3)", edge: "#22d3c5", word: "#ffffff" },
  bad:   { tab: "linear-gradient(180deg,#ff6b6b,#d1142f)", edge: "#ff4d5e", word: "#ffffff" },
  save:  { tab: "linear-gradient(180deg,#ffcf4a,#f08a00)", edge: "#ffb020", word: "#ffffff" },
  ref:   { tab: "linear-gradient(180deg,#fff06a,#e6c200)", edge: "#ffe14a", word: "#ffffff" },
  plain: { tab: "linear-gradient(180deg,#cbd5e1,#64748b)", edge: "#94a3b8", word: "#ffffff" },
  goal:  { tab: "linear-gradient(180deg,#ffe066,#ff9d00)", edge: "#ffc21a", word: "#ffffff" },
};

/** A small icon for each word, drawn in a 24-unit box. */
function Icon({ text, tone }: { text: string; tone: PopupTone }) {
  const s = { fill: "none", stroke: "#0b1020", strokeWidth: 2.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (text === "OFFSIDE") return (<svg viewBox="0 0 24 24" width="100%" height="100%"><path d="M6 21V3" {...s} /><path d="M6 4h11l-3 4 3 4H6" fill="#0b1020" stroke="#0b1020" strokeWidth={2} strokeLinejoin="round" /></svg>);
  if (text === "FOUL" || text === "PENALTY") return (<svg viewBox="0 0 24 24" width="100%" height="100%"><rect x="7" y="3.5" width="10" height="15" rx="1.6" transform="rotate(12 12 11)" fill="#0b1020" /></svg>);
  if (tone === "good") return (<svg viewBox="0 0 24 24" width="100%" height="100%"><path d="M4 12h14M13 6l6 6-6 6" {...s} /></svg>);
  if (tone === "bad") return (<svg viewBox="0 0 24 24" width="100%" height="100%"><path d="M6 6l12 12M18 6L6 18" {...s} /></svg>);
  if (tone === "save") return (<svg viewBox="0 0 24 24" width="100%" height="100%"><path d="M8 12V6.5a1.5 1.5 0 013 0V11m0-5a1.5 1.5 0 013 0v5m0-3.5a1.5 1.5 0 013 0V14a6 6 0 01-6 6h-1a6 6 0 01-5-2.7L5 14.5a1.5 1.5 0 012.5-1.6L8 13.5" {...s} strokeWidth={2.1} /></svg>);
  if (tone === "goal") return (<svg viewBox="0 0 24 24" width="100%" height="100%"><circle cx="12" cy="12" r="8.5" {...s} /><path d="M12 7.5l3.4 2.5-1.3 4h-4.2l-1.3-4z" fill="#0b1020" /></svg>);
  return (<svg viewBox="0 0 24 24" width="100%" height="100%"><circle cx="12" cy="12" r="8.5" {...s} /><path d="M12 7.5v5.5M12 16.4v.1" {...s} /></svg>);
}

const font: React.CSSProperties = { fontFamily: `"${FONT}", "Oswald", "Arial Narrow", Impact, sans-serif`, fontWeight: 700 };

/** One side of the scoreboard: a kit-coloured block with the club's name. */
function TeamBlock({ t, right }: { t: PopupTeam; right?: boolean }) {
  return (
    <div className="relative flex min-w-0 flex-1 items-center overflow-hidden" style={{ height: 34, background: "#0d1526", flexDirection: right ? "row-reverse" : "row" }}>
      <div style={{ width: 7, alignSelf: "stretch", background: t.shirt, boxShadow: `inset ${right ? 2 : -2}px 0 0 ${t.trim}` }} />
      <div className="min-w-0 flex-1 truncate px-2 uppercase" style={{ ...font, fontSize: 15, letterSpacing: "0.04em", color: "#f8fafc", textAlign: right ? "right" : "left" }}>{t.name}</div>
    </div>
  );
}

/** One number in the scoreboard; the one that changed rolls from old to new. */
function Digit({ from, to, dur }: { from: number; to: number; dur: string }) {
  const box: React.CSSProperties = { ...font, fontSize: 22, lineHeight: "34px", height: 34, width: 26, textAlign: "center", color: "#0b1020" };
  if (from === to) return <div style={box}>{to}</div>;
  return (
    <div className="relative overflow-hidden" style={{ height: 34, width: 26 }}>
      <div className="absolute inset-0" style={{ ...box, animation: `kmp-old ${dur} ease-in-out both` }}>{from}</div>
      <div className="absolute inset-0" style={{ ...box, animation: `kmp-new ${dur} cubic-bezier(.2,1.4,.4,1) both` }}>{to}</div>
      <div className="absolute inset-0" style={{ background: "radial-gradient(circle, #fff6b0 0%, rgba(255,214,0,0) 70%)", animation: `kmp-flash ${dur} ease-out both` }} />
    </div>
  );
}

function GoalBoard({ g, dur }: { g: PopupGoal; dur: string }) {
  const lines = [
    g.scorer ? { k: "GOAL", v: g.scorer } : null,
    g.assist ? { k: "ASSIST", v: g.assist } : null,
  ].filter((x): x is { k: string; v: string } => !!x);
  return (
    <div className="kmp-anim mx-auto w-[92%] max-w-[420px]" style={{ animation: `kmp-board ${dur} cubic-bezier(.2,.9,.25,1) both`, filter: "drop-shadow(0 6px 14px rgba(0,0,0,0.6))" }}>
      {/* the GOAL tag above the board */}
      <div className="flex justify-center">
        <div className="px-3 uppercase" style={{ ...font, fontSize: 12, letterSpacing: "0.3em", color: "#0b1020", background: "linear-gradient(90deg,#ffd23a,#ffb000)", transformOrigin: "center", animation: `kmp-tag ${dur} ease-out both`, clipPath: "polygon(8% 0,92% 0,100% 100%,0 100%)", paddingTop: 1, paddingBottom: 1 }}>
          {g.theirs ? "Their goal" : "Goal"}
        </div>
      </div>
      <div className="relative flex items-stretch overflow-hidden" style={{ borderTop: "2px solid #ffc21a" }}>
        <TeamBlock t={g.home} />
        <div className="flex items-center" style={{ background: "linear-gradient(180deg,#ffffff,#dfe5ee)", paddingLeft: 3, paddingRight: 3 }}>
          <Digit from={g.from[0]} to={g.to[0]} dur={dur} />
          <div style={{ ...font, fontSize: 18, color: "#0b1020", width: 10, textAlign: "center" }}>–</div>
          <Digit from={g.from[1]} to={g.to[1]} dur={dur} />
        </div>
        <TeamBlock t={g.away} right />
        {/* a light sweep across the board as the score changes */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-1/4" style={{ background: "linear-gradient(90deg,rgba(255,255,255,0),rgba(255,255,255,0.28),rgba(255,255,255,0))", animation: `kmp-shine ${dur} ease-out both` }} />
      </div>
      {lines.length > 0 && (
        <div className="mx-[6%] flex items-center justify-center gap-3 px-3 py-1" style={{ background: "rgba(8,13,26,0.92)", borderBottom: "2px solid #ffc21a", transformOrigin: "top", animation: `kmp-sub ${dur} ease-out both` }}>
          {lines.map((l) => (
            <div key={l.k} className="flex min-w-0 items-center gap-1.5">
              <span style={{ ...font, fontSize: 10, letterSpacing: "0.14em", color: "#ffc21a" }}>{l.k}</span>
              <span className="truncate uppercase" style={{ ...font, fontSize: 14, letterSpacing: "0.03em", color: "#ffffff" }}>{l.v}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Caption({ text, dur }: { text: string; dur: string }) {
  const tone = popupTone(text);
  const c = TONE[tone];
  return (
    <div className="kmp-anim flex justify-center">
      <div style={{ filter: "drop-shadow(0 5px 12px rgba(0,0,0,0.6))" }}>
      <div className="flex items-stretch" style={{ animation: `kmp-strip ${dur} cubic-bezier(.25,.9,.3,1) both` }}>
        <div className="flex items-center justify-center" style={{ width: 46, height: 40, background: c.tab, clipPath: "polygon(16% 0,100% 0,100% 100%,0 100%)", paddingLeft: 6 }}>
          <div style={{ width: 22, height: 22 }}><Icon text={text} tone={tone} /></div>
        </div>
        <div className="relative flex items-center overflow-hidden" style={{ height: 40, background: "linear-gradient(180deg,rgba(14,22,40,0.96),rgba(6,10,20,0.96))", boxShadow: `inset 0 -3px 0 ${c.edge}`, clipPath: "polygon(0 0,100% 0,calc(100% - 7px) 100%,0 100%)" }}>
          <span className="whitespace-nowrap pl-3 pr-5 uppercase" style={{ ...font, fontSize: 24, letterSpacing: "0.08em", color: c.word }}>{text}</span>
          <div className="pointer-events-none absolute inset-y-0 left-0 w-1/3" style={{ background: "linear-gradient(90deg,rgba(255,255,255,0),rgba(255,255,255,0.18),rgba(255,255,255,0))", animation: `kmp-shine ${dur} ease-out both` }} />
        </div>
      </div>
      </div>
    </div>
  );
}

export default function MikeyPopup({ item, follow }: {
  item: PopupItem | null;
  /** Where a caption should be right now (the half the ball is not in). The scoreboard is always at the top. */
  follow?: () => "top" | "bottom";
}) {
  const [side, setSide] = useState<"top" | "bottom">("top");
  const followRef = useRef(follow);
  followRef.current = follow;
  useEffect(() => { document.fonts?.load(`700 20px "${FONT}"`).catch(() => {}); }, []);
  useEffect(() => {
    if (!item) return;
    setSide(item.side);
    if (item.goal) return;
    const id = window.setInterval(() => {
      try { const s = followRef.current?.(); if (s) setSide((p) => (p === s ? p : s)); } catch { /* stay */ }
    }, 120);
    return () => window.clearInterval(id);
  }, [item]);

  if (!item) return <style>{CSS}</style>;
  const dur = `${item.ms}ms`;
  const top = item.goal ? "3%" : side === "top" ? "14%" : "74%";
  return (
    <>
      <style>{CSS}</style>
      <div
        key={item.id}
        data-mikey-popup={item.text}
        className="pointer-events-none absolute inset-x-0 z-40"
        style={{ top, opacity: item.cut ? 0 : 1, transition: `top 200ms ease-out, opacity ${CUT_FADE_MS}ms ease-out` }}
      >
        {item.goal ? <GoalBoard g={item.goal} dur={dur} /> : <Caption text={item.text} dur={dur} />}
      </div>
    </>
  );
}
