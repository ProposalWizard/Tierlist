"use client";
/**
 * EVENTS V2 — the story screens and cards around a talk (the kit man arc,
 * docs/plans/living-world-events-v2-2026-11-20.md; storyboard frames 09, 11,
 * 12, 14, 15, 16).
 *
 *  - AfterCards: under a talk's result: the promise you made, promises kept
 *    or broken, a match objective, what you got, how the story ended, and
 *    "What happens next" (the beats as dots and the next step in words).
 *  - StoryCardScreen: a beat on a card (the note in your boot, the letter).
 *  - InviteScreen: a text with three answers (Den's night), with the promise
 *    it keeps or breaks shown on it.
 *  - NoticeScreen: a promise kept or broken by its date, a reminder, an offer
 *    you walked past.
 *  - PhoneLog: the phone's Promises (what, who, when) and Stories (the quest
 *    log: what is open, what is promised, what comes next; the Zelda lesson).
 */
import type { ReactNode } from "react";
import type { CareerState } from "@/lib/star/types";
import type { ArcNotice } from "@/lib/star/life/types";
import type { LiveEvent } from "@/lib/star/life/director";
import type { ChoiceResult } from "@/lib/star/life/resolve";
import { arcById, beatOf } from "@/lib/star/life/arcBook";
import { arcCtx, questLog, storyStrip, type ArcExtras, type BeatLive, type QuestDot } from "@/lib/star/life/arcs";
import { promiseList } from "@/lib/star/life/promises";
import { inviteChips } from "@/lib/star/life/talk";
import { holds } from "@/lib/star/life/cond";
import { fillLine } from "@/lib/star/life/text";
import { lifeWeek, personInfo, roleOf } from "@/lib/star/life/people";
import { TONE_LOOK } from "@/lib/star/life/decision";
import LifeFace from "./LifeFace";
import { ChangeList } from "./EventCard";
import { StoryBar } from "./Telltale";
import "./life.css";
import "./decision.css";

/** A face for the phone: the kit man and the gaffer have stills; everyone else the drawn head. */
export function StoryFace({ career, id, size = 38, kid }: { career: CareerState; id: string; size?: number; kid?: boolean }) {
  const role = id ? roleOf(id) : "teammate";
  const src = role === "kitman" ? (personInfo(career, id)?.pool?.stills?.face ?? null) : role === "manager" ? "/star/life/kitman/face-gaffer.webp" : kid ? "/star/life/kitman/face-kid.webp" : null;
  // eslint-disable-next-line @next/next/no-img-element
  if (src) return <img src={src} alt="" width={size} height={size} style={{ width: size, height: size, borderRadius: 999, objectFit: "cover", flex: "none" }} />;
  return <LifeFace career={career} id={id || "oneoff:stranger"} size={size} />;
}

export function NextDots({ dots, next, when }: { dots: QuestDot[]; next?: string; when?: string }) {
  if (!dots.length) return null;
  return (
    <div className="dd-card2" data-next>
      <div className="k" style={{ color: "rgba(255,255,255,.7)" }}><span>What happens next</span>{when && <span style={{ color: "#f5c542" }}>{when}</span>}</div>
      <div className="dd-dotrow">
        {dots.map((d) => <div key={d.id} className={d.state}><i /><small>{d.state === "done" ? d.title : d.state === "now" ? "Next" : "?"}</small></div>)}
      </div>
      {next && <div className="s" style={{ marginTop: 7 }}>{next}</div>}
    </div>
  );
}

export function AfterCards({ extras }: { extras: ArcExtras }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }} data-after-cards>
      {extras.promisesKept.length > 0 && (
        <div className="dd-card2 gold" data-promise-kept>
          <div className="k" style={{ color: "#f5c542" }}><span>🤝 {extras.promisesKept.length > 1 ? `${extras.promisesKept.length} promises kept` : "Promise kept"}</span></div>
          {extras.promisesKept.map((p) => <div key={p.text} className="h" style={{ fontSize: 14, marginTop: 4 }}>{p.text}</div>)}
          <div className="s">{extras.promisesKept[0].who} will remember that, for good.</div>
        </div>
      )}
      {extras.promisesBroken.map((p) => (
        <div key={`b${p.text}`} className="dd-card2 red" data-promise-broken><div className="k" style={{ color: "#ff8a80" }}><span>✕ Promise broken</span></div><div className="h">{p.text}</div><div className="s">{p.who} will remember that, and so will the squad.</div></div>
      ))}
      {extras.promiseMade && (
        <div className="dd-card2 gold" data-promise-made>
          <div className="k" style={{ color: "#f5c542" }}><span>🤝 Promise made</span><span style={{ color: "rgba(255,255,255,.6)" }}>Phone → Promises</span></div>
          <div className="h">{extras.promiseMade.text}</div>
          <div className="s">Due: {extras.promiseMade.due.charAt(0).toLowerCase() + extras.promiseMade.due.slice(1)}. It stays in your phone until then, and {extras.promiseMade.who} will remind you.</div>
        </div>
      )}
      {extras.objective && (
        <div className="dd-card2 teal" data-objective>
          <div className="k" style={{ color: "#5eead4" }}><span>◎ Match objective</span><span>Next {extras.objective.window} matches</span></div>
          <div className="h">{extras.objective.text}</div>
          <div className="s">{extras.objective.why}</div>
        </div>
      )}
      {extras.got && (
        <div className="dd-card2 gold" style={{ display: "flex", gap: 12, alignItems: "center" }} data-got>
          <div style={{ fontSize: 32 }}>🎒</div>
          <div><div className="k" style={{ color: "#f5c542" }}><span>You got · {extras.got.what}</span></div><div className="s" style={{ color: "#fff", fontSize: 13 }}>{extras.got.text}</div></div>
        </div>
      )}
      {extras.ended && (
        <div className="dd-card2" data-ended><div className="k" style={{ color: "rgba(255,255,255,.7)" }}><span>The story ends</span></div><div className="h">{extras.ended.title}</div><div className="s">{extras.ended.text}</div></div>
      )}
      {!extras.ended && (extras.got ? <div className="dd-card2" data-next><div className="k" style={{ color: "rgba(255,255,255,.7)" }}><span>Next</span></div><div className="s">{extras.next}</div></div> : <NextDots dots={extras.dots} next={extras.next} />)}
    </div>
  );
}

/** A beat on a card: the note in your boot, his letter, a picture message. */
/** The club's post the morning after his night: the empty chair (storyboard 16). */
function EmptyChairPost({ career }: { career: CareerState }) {
  return (
    <div className="dd-card2" data-club-post style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ display: "flex", gap: 9, alignItems: "center", padding: "10px 12px" }}>
        <div style={{ width: 30, height: 30, borderRadius: 99, background: "#b91c1c", display: "grid", placeItems: "center", fontSize: 15 }}>🏟️</div>
        <div><div style={{ fontWeight: 900, fontSize: 13.5 }}>{career.player.club}</div><div style={{ fontSize: 10.5, color: "#9fb3c8", fontWeight: 700 }}>Saturday · 34 years, one kit man</div></div>
      </div>
      <svg viewBox="0 0 340 150" style={{ display: "block", width: "100%", background: "linear-gradient(180deg,#1b2436,#0d1220)" }} aria-label="A round table with an empty chair and a name card">
        <ellipse cx="170" cy="112" rx="132" ry="26" fill="#e9e4d8" />
        {[60, 115, 225, 280].map((x) => <rect key={x} x={x - 16} y="62" width="32" height="44" rx="10" fill="#2b3446" />)}
        <rect x="153" y="40" width="34" height="62" rx="6" fill="none" stroke="#f5c542" strokeWidth="2.5" />
        <rect x="150" y="98" width="40" height="16" rx="2" fill="#fff" />
        <text x="170" y="109.5" textAnchor="middle" fontSize="8" fontWeight="900" fill="#111">YOUR NAME</text>
      </svg>
      <div style={{ padding: "9px 12px 11px", fontSize: 13, fontWeight: 700 }}>A great night for {personInfo(career, "staff:kitman")?.short ?? "him"}. Thank you to everyone who came. 💛</div>
    </div>
  );
}

export function StoryCardScreen({ career, b, live, picked, extras, onChoose, onContinue, post }: {
  career: CareerState; b: BeatLive; live: LiveEvent; picked?: { choiceId: string; result: ChoiceResult } | null; extras?: ArcExtras | null;
  onChoose: (id: string) => void; onContinue: () => void;
  /** Den's night ended without you: the club's post with the empty chair, in place of the scene. */
  post?: "empty-chair";
}) {
  const beat = beatOf(arcById(b.arc)!, b.beat)!;
  const look = beat.look ?? {};
  const strip = storyStrip(b);
  const noteLine = look.note ? live.lines[look.note.line] : undefined;
  const narr0 = live.lines.filter((_, i) => !look.note || i !== look.note.line);
  const ctx = arcCtx(career, b.arc, b);
  const sign = look.note?.sign ? fillLine(look.note.sign, career, b.cast, ctx) : "";
  const bg = b.event.place.startsWith("stadium") ? (personInfo(career, b.cast.kitman ?? "")?.pool?.stills?.stadium ?? "/star/life/kitman/bg-stadium-night.webp") : null;
  // The paper holds only what is written on it; the words around the quote stay in the scene.
  const qa = noteLine ? noteLine.indexOf('"') : -1, qb = noteLine ? noteLine.lastIndexOf('"') : -1;
  const quoted = noteLine && qa >= 0 && qb > qa ? noteLine.slice(qa + 1, qb) : noteLine ?? "";
  const around = noteLine && qa >= 0 && qb > qa ? `${noteLine.slice(0, qa)} ${noteLine.slice(qb + 1)}`.replace(/\s+/g, " ").trim() : "";
  const words = quoted.replace(/\s*\bD\s*$/, "");
  const letter = words.length > 60;
  return (
    <div className="dd" data-story-card={b.beat} style={{ background: bg ? `linear-gradient(180deg, rgba(5,9,18,.35), rgba(5,9,18,.92) 70%), url(${bg}) center top / cover` : "linear-gradient(180deg,#101a2c,#05070d)", minHeight: "100%", position: "relative" }}>
      <StoryBar story={{ title: strip.title, beat: strip.beat, when: look.chip ?? b.when }} />
      <div style={{ padding: "84px 16px 22px", display: "flex", flexDirection: "column", gap: 12 }}>
        {look.art && (
          <div style={{ textAlign: "center", position: "relative", height: look.big ? 120 : 80 }}>
            <div style={{ fontSize: look.big ? 46 : 54 }}>{look.art}</div>
            {look.big && <div style={{ position: "absolute", right: 30, top: 14, textAlign: "center", color: "#f5c542" }}><div className="dd-anton" style={{ fontSize: 58, lineHeight: 0.9 }}>{look.big}</div><div className="dd-kick" style={{ fontSize: 9 }}>{look.bigSub}</div></div>}
          </div>
        )}
        {post === "empty-chair" && <EmptyChairPost career={career} />}
        {!post && (narr0.length > 0 || around) && <div className="dd-glass" style={{ padding: "12px 14px", fontSize: 14.5, fontWeight: 700, lineHeight: 1.4 }}>{[...narr0, around].filter(Boolean).join(" ")}</div>}
        {noteLine && (
          <div className={`dd-paper ${letter ? "letter" : ""}`} style={{ margin: "4px 18px" }} data-note>
            <div className="w">{words}</div>
            {sign && <div className="sg">{sign}</div>}
            {look.note?.foot && <div className="ft">{look.note.foot}</div>}
          </div>
        )}
        {!picked && live.choices.map((c) => {
          const tl = TONE_LOOK[c.choice.tone ?? "calm"];
          return (
            <button key={c.id} type="button" className="dd-line" style={{ "--tone": tl.color } as React.CSSProperties} disabled={!!c.locked} onClick={() => onChoose(c.id)} data-choice={c.id}>
              <span>{c.label}{c.costText.length > 0 && <span className="c">{c.costText.join(" · ")}</span>}</span><span className="t">{tl.word}</span>
            </button>
          );
        })}
        {picked && (
          <>
            {picked.result.remembered.length > 0 && (() => { const r = picked.result.remembered.find((x) => x.slot !== "squad" && x.slot !== "you") ?? picked.result.remembered[0]; return (
              <div className="dd-card2" data-remember style={{ borderLeft: "4px solid #f5c542" }}><div className="h" style={{ marginTop: 0 }}>↻ <span style={{ color: "#f5c542" }}>{r.who || "People"}</span> will remember that.</div><div className="s">{r.tag.replace(/-/g, " ").replace(/^./, (m) => m.toUpperCase())}.</div></div>
            ); })()}
            <div className="dd-glass" style={{ padding: "12px 14px", fontSize: 15, fontWeight: 700, lineHeight: 1.4 }} data-result>{picked.result.text}</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}><ChangeList changes={picked.result.changes.filter((x) => x.kind !== "memory")} /></div>
            {extras && <AfterCards extras={extras} />}
            <button type="button" className="dd-main" onClick={onContinue} data-continue>Continue</button>
          </>
        )}
      </div>
    </div>
  );
}

/** Den's text about his night: go, send a shirt, or don't answer. */
export function InviteScreen({ career, b, onAnswer }: { career: CareerState; b: BeatLive; onAnswer: (a: string) => void }) {
  const e = b.event.entry!;
  const ctx = arcCtx(career, b.arc, b);
  const fill = (s: string) => fillLine(s, career, b.cast, ctx);
  const from = b.cast[e.from ?? ""] ?? "";
  const info = personInfo(career, from);
  const strip = storyStrip(b);
  const chips = inviteChips(career, b);
  const clash = e.clash && holds(e.clash.if, ctx) ? e.clash.line : null;
  const now = lifeWeek(career);
  const mine = promiseList(career).filter((p) => p.arc === b.arc && p.st === "open" && p.due < 0);
  const ago = (w: number) => { const s = Math.round((now - w) / 50); return s >= 1 ? `${s} season${s === 1 ? "" : "s"} ago` : `${now - w} weeks ago`; };
  return (
    <div className="dd" data-invite style={{ background: "linear-gradient(180deg,#0d1424,#05070d)", minHeight: "100%", position: "relative" }}>
      <StoryBar story={{ title: strip.title, beat: strip.beat, when: b.when }} />
      <div style={{ padding: "80px 16px 22px", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", paddingBottom: 10, borderBottom: "1px solid rgba(255,255,255,.08)" }}>
          <StoryFace career={career} id={from} />
          <div><div style={{ fontWeight: 900, fontSize: 15 }}>{info?.short ?? "Unknown"}</div><div style={{ fontSize: 11, color: "#9fb3c8", fontWeight: 700 }}>Kit man · finishing in May</div></div>
        </div>
        <div className="dd-kick" style={{ color: "rgba(255,255,255,.45)", textAlign: "center" }}>Text message</div>
        <div style={{ alignSelf: "flex-start", maxWidth: "82%", background: "#1d2a40", borderRadius: "14px 14px 14px 4px", padding: "10px 13px", fontSize: 15, fontWeight: 600 }} data-text>{fill(e.text ?? "").replace(/^"|"$/g, "")}</div>
        {mine.map((p) => (
          <div key={p.id} className="dd-card2 gold" data-promise-due>
            <div className="k" style={{ color: "#f5c542" }}><span>🤝 You promised</span><span style={{ color: "#ff8a80" }}>Due Friday</span></div>
            <div className="h">{p.text}</div>
            <div className="s">Made {ago(p.made)}.</div>
          </div>
        ))}
        {clash && <div className="dd-card2 red" data-clash><div className="s" style={{ color: "#ffb4ab", marginTop: 0 }}>⚠ {clash}</div></div>}
        {(e.choices ?? []).map((ch) => (
          <button key={ch} type="button" className="dd-line" style={{ "--tone": ch === "attend" ? "#4aa8ff" : ch === "ignore" ? "#9fb3c8" : "#35d0ba" } as React.CSSProperties} onClick={() => onAnswer(ch)} data-choice={ch}>
            <span>{fill(e.labels?.[ch] ?? ch)}</span><span className="t">{chips[ch]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

const NOTE_LOOK: Record<ArcNotice["kind"], [string, string, string]> = {
  kept: ["🤝", "gold", "#f5c542"], broken: ["✕", "red", "#ff8a80"], remind: ["💬", "", "#9fb3c8"], ignored: ["↻", "", "#9fb3c8"], objective: ["◎", "teal", "#5eead4"],
};

export function NoticeScreen({ career, notices, onContinue }: { career: CareerState; notices: ArcNotice[]; onContinue: () => void }) {
  return (
    <div className="dd" data-notices style={{ background: "linear-gradient(180deg,#0d1424,#05070d)", minHeight: "100%", padding: "22px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
      {notices.map((n, i) => {
        const [icon, cls, col] = NOTE_LOOK[n.kind];
        const arc = arcById(n.arc);
        return (
          <div key={i} className={`dd-card2 ${cls}`} data-notice={n.kind}>
            <div className="k" style={{ color: col }}><span>{icon} {n.kind === "remind" ? `A text from ${n.who ?? "him"}` : n.title}</span><span style={{ color: "rgba(255,255,255,.5)" }}>{arc?.title}</span></div>
            {n.kind === "remind" && <div className="s" style={{ marginTop: 6 }}>About: {n.title}</div>}
            <div className="h" style={{ fontWeight: 700 }}>{n.text}</div>
            {n.changes && n.changes.length > 0 && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}><ChangeList changes={n.changes} /></div>}
          </div>
        );
      })}
      <button type="button" className="dd-main" onClick={onContinue} data-continue style={{ marginTop: 6 }}>Continue</button>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,.45)", textAlign: "center" }}>{career.player.firstName}&apos;s phone keeps every promise: Phone → Promises</div>
    </div>
  );
}

function Ring({ filled, segments }: { filled: number; segments: number }) {
  const r = 15, c = 2 * Math.PI * r;
  return (
    <svg width="38" height="38" viewBox="0 0 38 38" aria-hidden>
      <circle cx="19" cy="19" r={r} fill="none" stroke="rgba(255,255,255,.15)" strokeWidth="5" />
      {Array.from({ length: segments }, (_, i) => (
        <circle key={i} cx="19" cy="19" r={r} fill="none" stroke={i < filled ? "#f5c542" : "transparent"} strokeWidth="5" strokeDasharray={`${c / segments - 2} ${c}`} strokeDashoffset={-(c / segments) * i} transform="rotate(-90 19 19)" />
      ))}
      <text x="19" y="23" textAnchor="middle" fontSize="11" fontWeight="900" fill="#fff">{filled}/{segments}</text>
    </svg>
  );
}

/** The phone: Promises and Stories. */
export function PhoneLog({ career, tab, onTab, onClose, extra }: { career: CareerState; tab: "promises" | "stories"; onTab: (t: "promises" | "stories") => void; onClose: () => void; extra?: ReactNode }) {
  const list = promiseList(career);
  const log = questLog(career);
  const open = list.filter((p) => p.st === "open");
  const shut = list.filter((p) => p.st !== "open");
  return (
    <div className="dd" data-phone={tab} style={{ background: "linear-gradient(180deg,#0d1424,#05070d)", minHeight: "100%", padding: "16px 14px 22px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div className="dd-anton" style={{ fontSize: 24 }}>Phone</div>
        <button type="button" className="dd-ghost" style={{ height: 34, padding: "0 12px", fontSize: 12, borderRadius: 999 }} onClick={onClose} data-close>Close</button>
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {(["promises", "stories"] as const).map((t) => (
          <button key={t} type="button" onClick={() => onTab(t)} data-tab={t} style={{ flex: 1, height: 38, borderRadius: 10, fontWeight: 900, fontSize: 13, textTransform: "uppercase", letterSpacing: ".08em", background: tab === t ? "#f5c542" : "rgba(255,255,255,.07)", color: tab === t ? "#2a1d00" : "#fff" }}>
            {t === "promises" ? `Promises${open.length ? ` · ${open.length}` : ""}` : `Stories${log.length ? ` · ${log.length}` : ""}`}
          </button>
        ))}
      </div>
      {tab === "promises" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {!list.length && <div className="dd-card2"><div className="s" style={{ marginTop: 0 }}>No promises yet. You only make one by saying it.</div></div>}
          {open.map((p) => (
            <div key={p.id + p.made} className="dd-card2 gold" style={{ display: "flex", gap: 11 }} data-promise={p.id}>
              <StoryFace career={career} id={p.to} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="k" style={{ color: "#f5c542" }}><span>To {personInfo(career, p.to)?.short ?? "him"}</span><span style={{ color: p.weeksLeft !== null && p.weeksLeft <= 1 ? "#ff8a80" : "rgba(255,255,255,.6)" }}>{p.weeksLeft === null ? "When it comes" : p.weeksLeft <= 0 ? "Due now" : `${p.weeksLeft} week${p.weeksLeft === 1 ? "" : "s"} left`}</span></div>
                <div className="h">{p.text}</div>
                <div className="s">Due: {p.dueText}{p.r ? " · he has reminded you" : ""}</div>
              </div>
            </div>
          ))}
          {shut.length > 0 && <div className="dd-kick" style={{ color: "rgba(255,255,255,.5)", margin: "8px 2px 0" }}>Kept and broken</div>}
          {shut.map((p) => (
            <div key={p.id + p.made} className="dd-card2" style={{ display: "flex", gap: 11, opacity: 0.85 }} data-promise={p.id} data-state={p.st}>
              <StoryFace career={career} id={p.to} size={30} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="k" style={{ color: p.st === "kept" ? "#3ddc84" : "#ff8a80" }}><span>{p.st === "kept" ? "✓ Kept" : "✕ Broken"}</span><span style={{ color: "rgba(255,255,255,.5)" }}>{personInfo(career, p.to)?.short}</span></div>
                <div className="s" style={{ color: "#fff", fontSize: 13 }}>{p.text}</div>
              </div>
            </div>
          ))}
        </div>
      )}
      {tab === "stories" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {!log.length && <div className="dd-card2"><div className="s" style={{ marginTop: 0 }}>No stories yet. Somebody at the club will start one.</div></div>}
          {log.map((q) => (
            <div key={q.arc} className={`dd-card2 ${q.ended ? "" : "gold"}`} data-quest={q.arc}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <StoryFace career={career} id={q.ownerId} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="h" style={{ marginTop: 0 }}>{q.title}</div>
                  <div className="s" style={{ marginTop: 1 }}>{q.owner}{q.stats.length ? ` · ${q.stats.slice(0, 2).join(" · ")}` : ""}</div>
                </div>
                {q.clock && <div style={{ textAlign: "center" }}><Ring filled={q.clock.filled} segments={q.clock.segments} /><div style={{ fontSize: 8, fontWeight: 800, color: "rgba(255,255,255,.55)", maxWidth: 60 }}>{q.clock.label}</div></div>}
              </div>
              <div className="dd-dotrow">{q.dots.map((d) => <div key={d.id} className={d.state}><i /><small>{d.state === "future" ? "?" : d.state === "now" ? "Next" : d.title}</small></div>)}</div>
              {q.next && (
                <div style={{ marginTop: 10, padding: "8px 10px", borderRadius: 10, background: "rgba(245,197,66,.1)" }} data-quest-next>
                  <div className="k" style={{ color: "#f5c542" }}><span>Next</span><span>{q.when}</span></div>
                  <div className="s" style={{ color: "#fff", fontSize: 13, marginTop: 3 }}>{q.next}</div>
                </div>
              )}
              {q.stats[2] && !q.ended && <div className="s" style={{ marginTop: 6 }}>Open: {q.stats[2]}</div>}
              {q.ended && <div style={{ marginTop: 10 }} data-quest-ended><div className="k" style={{ color: "rgba(255,255,255,.6)" }}><span>Ended · {q.ended.title}</span></div><div className="s">{q.ended.text}</div></div>}
            </div>
          ))}
          {extra}
        </div>
      )}
    </div>
  );
}
