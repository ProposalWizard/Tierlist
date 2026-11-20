"use client";
/**
 * THE FOOTBALL TONE DIAL — press conferences, the mixed zone, training talks
 * and dilemmas (Harry, 20 Nov 2026, 15:35: "there's a use for the football mix
 * too, maybe press conferences, training stuff, dilemmas"). No clock.
 *
 * You choose HOW to say it first: Humble, Calm, Confident or Fiery on a half
 * circle (drag, tap, or ← → on a computer). The line you will say changes with
 * it; "Who is listening" guesses how the boss, the fans, the dressing room and
 * the person in front of you take it (a guess, never a promise). "… No
 * comment" is a real answer. Then "How it landed" (bars that grow or shrink),
 * how many of your own team-mates would have said it your way, and your voice
 * this season.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { CareerState } from "@/lib/star/types";
import type { LiveEvent } from "@/lib/star/life/director";
import type { ChoiceResult } from "@/lib/star/life/resolve";
import { DIAL_TONES, isDialTone, listenersFor, silentChoice, speakerId, splitLines, spokenChoices, squadVerdict, TONE_LOOK, twistWarning, voiceOf, type DialTone, type Listener } from "@/lib/star/life/decision";
import { personInfo, roleOf } from "@/lib/star/life/people";
import LifeFace from "./LifeFace";
import { PLACE } from "./EventCard";
import { RememberToast } from "./DecisionParts";
import type { StoryStrip } from "./Telltale";
import "./life.css";
import "./decision.css";

export interface DialPicked { choiceId: string; result: ChoiceResult; before: CareerState }

const MOMENT_WORD: Record<string, string> = {
  "after-match": "After the match", "arrive:training": "At training", "home:evening": "Evening at home", driving: "On the road",
  walkout: "The walk-out", "season-end": "Season end", "leave:casino": "Leaving the casino", followUp: "It came back", "social:drive": "A drive", "social:races": "The races",
};
const ARROW: Record<number, [string, string]> = { 2: ["▲▲", "dd-up"], 1: ["▲", "dd-up"], 0: ["–", ""], [-1]: ["▼", "dd-down"], [-2]: ["▼▼", "dd-down"] };
const ICON: Record<Listener["key"], string> = { boss: "👔", fans: "📣", team: "👕", speaker: "" };

/* The dial: a half circle, four arcs. */
const CX = 195, CY = 176, R = 108, SW = 24;
const pt = (deg: number, r = R) => [CX + Math.cos((deg * Math.PI) / 180) * r, CY + Math.sin((deg * Math.PI) / 180) * r] as const;

function Dial({ sel, open, onSel }: { sel: DialTone | null; open: Set<DialTone>; onSel: (t: DialTone) => void }) {
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef(false);
  const fromPointer = (e: React.PointerEvent) => {
    const el = svg.current; if (!el) return;
    const b = el.getBoundingClientRect();
    const x = ((e.clientX - b.left) / b.width) * 390, y = 18 + ((e.clientY - b.top) / b.height) * 180;
    if (y > CY + 24) return;
    let a = (Math.atan2(y - CY, x - CX) * 180) / Math.PI; if (a < 0) a += 360;
    if (a < 90) a = 359.9; else if (a < 180) a = 180;
    const want = Math.min(3, Math.floor((a - 180) / 45));
    // Snap to the nearest tone this event has.
    let best: DialTone | null = null, bd = 9;
    DIAL_TONES.forEach((t, i) => { if (open.has(t) && Math.abs(i - want) < bd) { bd = Math.abs(i - want); best = t; } });
    if (best) onSel(best);
  };
  const si = sel ? DIAL_TONES.indexOf(sel) : -1;
  const am = si >= 0 ? 180 + si * 45 + 22.5 : 270;
  const [nx, ny] = pt(am, R - SW / 2 - 10), [kx, ky] = pt(am);
  return (
    <svg ref={svg} className="dd-svg" viewBox="0 18 390 180" role="radiogroup" aria-label="How do you say it?"
      onPointerDown={(e) => { drag.current = true; (e.target as Element).setPointerCapture?.(e.pointerId); fromPointer(e); }}
      onPointerMove={(e) => { if (drag.current) fromPointer(e); }}
      onPointerUp={() => { drag.current = false; }} onPointerCancel={() => { drag.current = false; }}>
      <defs><filter id="dd-gl" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs>
      {DIAL_TONES.map((t, i) => {
        const a0 = 180 + i * 45 + 2.5, a1 = 180 + (i + 1) * 45 - 2.5;
        const [x0, y0] = pt(a0), [x1, y1] = pt(a1);
        const on = t === sel, has = open.has(t), c = TONE_LOOK[t].color;
        const [lx, ly] = pt(180 + i * 45 + 22.5, R + SW / 2 + 24);
        return (
          <g key={t} className="seg" role="radio" aria-checked={on} aria-disabled={!has} data-tone={t}>
            <path d={`M${x0} ${y0} A${R} ${R} 0 0 1 ${x1} ${y1}`} fill="none" stroke={has ? c : "rgba(255,255,255,.35)"} strokeWidth={on ? SW + 6 : has ? SW : 6}
              strokeLinecap="round" strokeDasharray={has ? undefined : "2 9"} opacity={on ? 1 : has ? 0.42 : 0.6} filter={on ? "url(#dd-gl)" : undefined} />
            <text x={lx} y={ly + 4} textAnchor="middle" fontSize="11" fontWeight="900" letterSpacing=".06em" fill={on ? "#fff" : has ? "rgba(255,255,255,.78)" : "rgba(255,255,255,.32)"}>{TONE_LOOK[t].word.toUpperCase()}</text>
          </g>
        );
      })}
      <line x1={CX} y1={CY} x2={nx} y2={ny} stroke="#fff" strokeWidth="4" strokeLinecap="round" opacity={sel ? 1 : 0.4} />
      <circle cx={CX} cy={CY} r="9" fill="#fff" />
      {sel && <><circle cx={kx} cy={ky} r={SW / 2 + 5} fill="#fff" stroke={TONE_LOOK[sel].color} strokeWidth="4" /><circle cx={kx} cy={ky} r="4" fill={TONE_LOOK[sel].color} /></>}
    </svg>
  );
}

export default function ToneDial({ career, live, onChoose, picked, onContinue, story, afterExtra, sceneImage }: {
  career: CareerState; live: LiveEvent; onChoose: (choiceId: string) => void; picked?: DialPicked | null; onContinue: () => void;
  /** Events v2: the story strip over a talk on the dial. */
  story?: StoryStrip;
  /** Events v2: cards under the result (a match objective, what happens next). */
  afterExtra?: ReactNode;
  /** A still behind the speaker (until the 3D world is wired in). */
  sceneImage?: string;
}) {
  const spoken = spokenChoices(live).filter((c) => isDialTone(c.choice.tone));
  const byTone = useMemo(() => new Map(spoken.map((c) => [c.choice.tone as DialTone, c])), [spoken]);
  const open = useMemo(() => new Set(Array.from(byTone.entries()).filter(([, c]) => !c.locked).map(([t]) => t)), [byTone]);
  const silent = silentChoice(live);
  const [sel, setSel] = useState<DialTone | null>(null);
  const cur = sel ? byTone.get(sel) : undefined;
  const sp = speakerId(live);
  const info = sp && !sp.startsWith("oneoff:") ? personInfo(career, sp) : null;
  const { said, narration } = splitLines(live);
  const [placeName, dark, light] = PLACE[live.event.place] ?? [live.event.place.replace(/-/g, " "), "#1e293b", "#94a3b8"];
  const press = live.event.place === "stadium-mixed-zone" || roleOf(sp || "x") === "tabloid" || roleOf(sp || "x") === "broadsheet";
  const listeners = cur ? listenersFor(career, live, cur.choice) : null;
  const twist = twistWarning(career, live);

  const say = useCallback(() => { if (cur && !cur.locked) onChoose(cur.id); }, [cur, onChoose]);
  const turn = useCallback((dir: 1 | -1) => {
    const list = DIAL_TONES.filter((t) => open.has(t));
    if (!list.length) return;
    const i = sel ? list.indexOf(sel) : dir > 0 ? -1 : list.length;
    setSel(list[Math.max(0, Math.min(list.length - 1, i + dir))]);
  }, [open, sel]);

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) return;
      if (picked) { if (e.key === "Enter") { e.preventDefault(); onContinue(); } return; }
      if (e.key === "ArrowLeft") { e.preventDefault(); turn(-1); }
      if (e.key === "ArrowRight") { e.preventDefault(); turn(1); }
      if (e.key === "Enter") { e.preventDefault(); say(); }
      if (e.key === " " && silent) { e.preventDefault(); onChoose(silent.id); }
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [picked, turn, say, silent, onChoose, onContinue]);

  // A line that is not a voice on the dial (a lie, an honest answer) sits under it as its own button.
  const others = spokenChoices(live).filter((c) => !isDialTone(c.choice.tone));
  if (picked) return <Landed career={career} live={live} picked={picked} onContinue={onContinue} story={story} afterExtra={afterExtra} />;

  return (
    <div className="dd dd-cq"><div className="dd-dial" data-dial={live.id}>
      {story && <div className="dd-story" style={{ position: "relative", margin: "-4px -4px 6px", borderRadius: 10 }} data-story><span className="t">◆ {story.title}</span><span className="b">{story.beat}{story.round !== undefined ? ` · ${typeof story.round === "number" ? `Round ${story.round}` : story.round}` : ""}</span></div>}
      <div className="dd-head">
        <span className="dd-kick" style={{ color: story?.when ? "#f5c542" : "rgba(255,255,255,.82)" }}>{story?.when ? story.when : `🎬 ${MOMENT_WORD[live.moment] ?? placeName}`}</span>
        <span className="dd-chip" style={{ fontSize: 10.5, padding: "5px 9px", color: "rgba(255,255,255,.82)" }}>No clock · take your time</span>
      </div>
      <div className="dd-dial-grid">
        <div className="dd-dial-left">
          <div className="dd-scene" style={{ background: sceneImage ? `linear-gradient(180deg, rgba(6,10,20,.1), rgba(6,10,20,.85) 92%), url(${sceneImage}) center 18% / cover` : `radial-gradient(120% 90% at 30% 0%, ${light}55, transparent 60%), linear-gradient(180deg, ${dark}, #0b0d1e)` }}>
            <span className="pill dd-kick">{placeName}</span>
            {press && <span className="rec"><i />REC</span>}
            {narration.length > 0 && <div className="narr">{narration.join(" ")}</div>}
            <div className="who">
              <LifeFace career={career} id={sp || "oneoff:stranger"} size={64} />
              <div style={{ minWidth: 0 }}>
                <div className="src">{info?.name ?? "Someone"}{info?.outlet ? ` · ${info.outlet}` : ""}</div>
                <div className="q">{said || live.lines[live.lines.length - 1]}</div>
              </div>
            </div>
            {live.callbacks[0] && <div className="cb" data-callback><b>↻ {live.callbacks[0].who ? `${live.callbacks[0].who} remembers` : "Remembered"}</b>{live.callbacks[0].line}</div>}
          </div>
        </div>
        <div className="dd-dial-right">
          <div className="dd-kick dd-ask">How do you say it? Turn the dial</div>
          <Dial sel={sel} open={open} onSel={setSel} />
          <div className="dd-tone dd-anton" style={{ color: sel ? TONE_LOOK[sel].color : "rgba(255,255,255,.4)", fontSize: sel ? undefined : 18 }} data-tone-word>{sel ? TONE_LOOK[sel].word : "Pick a voice"}</div>
          <div className="dd-will">
            <div className="dd-kick lab">You will say</div>
            <div className={`dd-say ${cur ? "" : "empty"}`} data-line>{cur ? cur.label : "Turn the dial to hear yourself."}</div>
            {cur && (cur.costText.length > 0 || cur.choice.minigame) && <div className="lw-cost" style={{ justifyContent: "flex-end", display: "flex" }}>{cur.costText.map((t) => <span key={t} className="lw-chip">{t}</span>)}</div>}
          </div>
          <div>
            <div className="dd-kick" style={{ color: "rgba(255,255,255,.72)", marginBottom: 6 }}>Who is listening</div>
            <div className="dd-hear-row" data-listeners>
              {(listeners ?? defaultListeners(career, live)).map((l) => {
                const [a, cls] = listeners ? ARROW[l.arrows] : ["", ""];
                return (
                  <div key={l.key} className="dd-hear">
                    <div className="f">{l.key === "speaker" && l.id ? <LifeFace career={career} id={l.id} size={24} /> : ICON[l.key]}</div>
                    <div className="n">{l.label}</div>
                    <div className={`a ${cls}`}>{a}</div>
                  </div>
                );
              })}
            </div>
            <div className="dd-note">A guess, not a promise.{twist ? ` ${twist}` : ""}</div>
          </div>
          {others.map((c) => (
            <button key={c.id} type="button" className="dd-line" style={{ "--tone": TONE_LOOK[c.choice.tone ?? "calm"].color, minHeight: 46, fontSize: 14 } as React.CSSProperties} disabled={!!c.locked} onClick={() => onChoose(c.id)} data-choice={c.id}>
              <span>{c.label}</span><span className="t">{TONE_LOOK[c.choice.tone ?? "calm"].word}</span>
            </button>
          ))}
          <div className="dd-btns">
            {silent && <button type="button" className="dd-ghost" onClick={() => onChoose(silent.id)} data-choice={silent.id} data-silent>… No comment <span className="dd-kbd dd-pc-only">Space</span></button>}
            <button type="button" className="dd-main" disabled={!cur || !!cur.locked} onClick={say} data-say>Say it <span className="dd-kbd dd-pc-only" style={{ background: "rgba(5,46,22,.2)" }}>Enter</span></button>
          </div>
          <div className="dd-keys dd-pc-block"><span className="dd-kbd">←</span> <span className="dd-kbd">→</span> turn the dial · <span className="dd-kbd">Enter</span> say it · <span className="dd-kbd">Space</span> no comment</div>
        </div>
      </div>
    </div></div>
  );
}

function defaultListeners(c: CareerState, live: LiveEvent): Listener[] {
  const first = live.choices[0]?.choice;
  return first ? listenersFor(c, live, first).map((l) => ({ ...l, arrows: 0 as const })) : [];
}

/* ── How it landed ── */
function Landed({ career, live, picked, onContinue, story, afterExtra }: { career: CareerState; live: LiveEvent; picked: DialPicked; onContinue: () => void; story?: StoryStrip; afterExtra?: ReactNode }) {
  const ch = live.choices.find((c) => c.id === picked.choiceId);
  const tone = ch?.choice.silent ? null : ch?.choice.tone;
  const verdict = squadVerdict(picked.before, live, picked.choiceId);
  const voice = voiceOf(career);
  const sp = speakerId(live);
  const b = picked.before, a = career;
  type Row = { icon: React.ReactNode; name: string; sub?: string; from: number; to: number; badUp?: boolean };
  const rows: Row[] = [
    { icon: "📣", name: "Fans", from: b.relationships.fans, to: a.relationships.fans },
    { icon: "👕", name: "Dressing room", from: b.relationships.team, to: a.relationships.team },
    { icon: "👔", name: "Boss", from: b.relationships.boss, to: a.relationships.boss },
  ];
  if (sp && !sp.startsWith("oneoff:") && roleOf(sp) !== "manager") {
    const p0 = b.life?.people[sp], p1 = a.life?.people[sp];
    if (p1) {
      const d = { b: p1.b - (p0?.b ?? 30), r: p1.r - (p0?.r ?? 40), g: p1.g - (p0?.g ?? 0) };
      const k = (["r", "b", "g"] as const).reduce((m, x) => (Math.abs(d[x]) > Math.abs(d[m]) ? x : m), "r" as "r" | "b" | "g");
      const word = { r: "respect", b: "bond", g: "grudge" }[k];
      rows.push({ icon: <LifeFace career={career} id={sp} size={24} />, name: personInfo(career, sp)?.short ?? "Him", sub: word, from: p1[k] - d[k], to: p1[k], badUp: k === "g" });
    }
  }
  const segs: [DialTone | "silent", number][] = [["humble", voice.humble], ["calm", voice.calm], ["confident", voice.confident], ["fiery", voice.fiery], ["silent", voice.silent]];
  return (
    <div className="dd dd-cq"><div className="dd-out" data-landed={live.id}>
      {story && <div className="dd-story" style={{ position: "relative", margin: "-4px -4px 6px", borderRadius: 10 }}><span className="t">◆ {story.title}</span><span className="b">{story.beat} · Done</span></div>}
      <RememberToast remembered={picked.result.remembered} />
      <div className="dd-out-grid">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ marginLeft: 54 }}>
            <div className="dd-say" data-said>
              <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: ".14em", color: "#dbeafe", display: "block", marginBottom: 2 }}>YOU · {tone ? TONE_LOOK[tone].word.toUpperCase() : "NO COMMENT"}</span>
              {ch?.choice.silent ? "…" : ch?.label}
            </div>
          </div>
          <div className="dd-glass" style={{ padding: "14px 16px", fontSize: 16, fontWeight: 700, lineHeight: 1.35 }} data-result>{picked.result.text}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <div className="dd-kick" style={{ color: "rgba(255,255,255,.74)", marginBottom: 6 }}>How it landed</div>
            <div className="dd-glass" style={{ padding: "4px 2px" }} data-rows>
              {rows.map((r) => {
                const d = r.to - r.from, good = r.badUp ? d < 0 : d > 0, col = good ? "#3ddc84" : "#ff5a4d";
                const base = Math.min(r.from, r.to);
                return (
                  <div key={r.name} className="dd-row">
                    <div className="f">{r.icon}</div>
                    <div className="n">{r.name}{r.sub && <small>{r.sub}</small>}</div>
                    <div className="dd-bar">
                      <i style={{ left: 0, width: `${base}%`, background: "rgba(255,255,255,.85)", borderRadius: "5px 0 0 5px" }} />
                      {d !== 0 && <i className="grow" style={{ left: `${base}%`, width: `${Math.abs(d)}%`, background: col, boxShadow: `0 0 10px ${col}`, borderRadius: "0 5px 5px 0" }} />}
                    </div>
                    <div className={`d ${d === 0 ? "" : good ? "dd-up" : "dd-down"}`}>{d === 0 ? "–" : `${d > 0 ? "+" : "−"}${Math.abs(d)}`}</div>
                  </div>
                );
              })}
            </div>
          </div>
          {verdict && (
            <div className="dd-glass" style={{ padding: "13px 15px" }} data-verdict>
              <div className="dd-kick" style={{ color: "rgba(255,255,255,.74)" }}>In your dressing room</div>
              <div className="dd-dots">{Array.from({ length: verdict.of }, (_, i) => <i key={i} style={i < verdict.same ? { background: TONE_LOOK[verdict.tone].color, boxShadow: `0 0 8px ${TONE_LOOK[verdict.tone].color}` } : undefined} />)}</div>
              <div style={{ fontSize: 13.5, fontWeight: 700, marginTop: 9 }}><b style={{ color: TONE_LOOK[verdict.tone].color }}>{verdict.same} of {verdict.of}</b> team-mates would have {verdict.phrase}</div>
            </div>
          )}
          {voice.total > 0 && (
            <div data-voice>
              <div className="dd-kick" style={{ color: "rgba(255,255,255,.74)" }}>Your voice this season</div>
              <div className="dd-voice">{segs.filter(([, n]) => n > 0).map(([t, n]) => <i key={t} style={{ flex: n, background: TONE_LOOK[t].color }} />)}</div>
              <div className="dd-voice-lab">{segs.filter(([, n]) => n > 0).map(([t, n]) => <span key={t} style={{ color: TONE_LOOK[t].color }}>{t === "silent" ? "Nothing" : TONE_LOOK[t].word} {n}</span>)}</div>
            </div>
          )}
          {afterExtra}
          <button type="button" className="dd-main" style={{ marginTop: "auto" }} onClick={onContinue} data-continue>Continue <span className="dd-kbd dd-pc-only" style={{ background: "rgba(5,46,22,.2)" }}>Enter</span></button>
        </div>
      </div>
    </div></div>
  );
}
