"use client";
/**
 * AN EVENT ON SCREEN — the 4 phase-1 templates (design 1.4): phone-call,
 * text-thread, feed-post and talk-scene (a still with the cast in the place).
 * Every event in the book picks one; no event needs its own art.
 * Then the OUTCOME: what happened and every change, so it is plain that it
 * landed (bars, money, that person's numbers, what he will remember).
 */
import type { CareerState } from "@/lib/star/types";
import type { LiveEvent } from "@/lib/star/life/director";
import type { ChoiceResult, LifeChange } from "@/lib/star/life/resolve";
import type { ChatResult } from "@/lib/star/life/social";
import { personInfo } from "@/lib/star/life/people";
import { TopHud } from "@/components/star/ui";
import LifeFace from "./LifeFace";
import "./life.css";

export const PLACE: Record<string, [string, string, string]> = {
  // Events v2's places (the training compound, the stadium at night)
  "compound:pitch-2": ["Pitch two", "#14532d", "#4ade80"],
  "compound:corridor": ["Outside the boot room", "#1e293b", "#94a3b8"],
  "compound:kit-room": ["The kit room", "#3f2d1c", "#f5c542"],
  "stadium:pitch": ["The ground", "#0f2a4a", "#60a5fa"],
  "stadium:dressing-room": ["Dressing room", "#1e3a8a", "#60a5fa"],
  "food-hall": ["Food hall", "#7c2d12", "#f59e0b"],
  "dressing-room": ["Dressing room", "#1e3a8a", "#60a5fa"],
  "training-pitch": ["Training ground", "#14532d", "#4ade80"],
  "training-car-park": ["Training ground car park", "#1f2937", "#94a3b8"],
  "physio-room": ["Physio room", "#134e4a", "#5eead4"],
  "stadium-mixed-zone": ["Mixed zone", "#312e81", "#a5b4fc"],
  "stadium-tunnel": ["The tunnel", "#111827", "#fbbf24"],
  "stadium-car-park": ["Stadium car park", "#0f172a", "#64748b"],
  racecourse: ["The races", "#365314", "#bef264"],
  driving: ["On the road", "#1e293b", "#38bdf8"],
  home: ["Home", "#3b0764", "#c084fc"],
  casino: ["Casino", "#450a0a", "#fbbf24"],
};
const TEMPLATE_LABEL: Record<string, string> = { "phone-call": "📞 Phone call", "text-thread": "💬 Messages", "feed-post": "📰 On your feed", "talk-scene": "🎬 Scene" };

function castIds(live: LiveEvent): string[] {
  return Object.values(live.cast).filter((id) => id && !id.startsWith("oneoff:"));
}

function Choices({ live, onChoose }: { live: LiveEvent; onChoose: (id: string) => void }) {
  return (
    <div className="space-y-2" data-choices>
      {live.choices.map((c) => (
        <button key={c.id} type="button" className="lw-choice" disabled={!!c.locked} onClick={() => onChoose(c.id)} data-choice={c.id}>
          {c.label}
          {(c.costText.length > 0 || c.locked || c.choice.minigame) && (
            <span className="lw-cost">
              {c.costText.map((t) => <span key={t} className="lw-chip">{t}</span>)}
              {c.choice.minigame && <span className="lw-chip" style={{ color: "#93c5fd" }}>{c.choice.minigame.kind === "horse-race" ? "Your horse runs" : `A test of your ${c.choice.minigame.stat === "freeKick" ? "free kicks" : c.choice.minigame.stat}`}</span>}
              {c.locked && <span className="lw-chip" style={{ color: "#fca5a5" }}>{c.locked}</span>}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

function Callbacks({ live }: { live: LiveEvent }) {
  if (!live.callbacks.length) return null;
  return (
    <div className="space-y-1.5" data-callbacks>
      {live.callbacks.map((cb, i) => (
        <div key={i} className="lw-callback"><b>↻ {cb.who ? `${cb.who} remembers` : "Remembered"}</b>{cb.line}</div>
      ))}
    </div>
  );
}

function Head({ live }: { live: LiveEvent }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11px] font-black uppercase tracking-[0.14em] text-white/70">{TEMPLATE_LABEL[live.event.template]}</span>
      <span className="flex gap-1">
        {live.followUp && <span className="lw-badge" data-follow-up>↻ Follow-up</span>}
        {live.social && <span className="lw-badge" style={{ background: "rgba(56,189,248,.18)", color: "#7dd3fc" }}>Your plan</span>}
        {live.event.size === "big" && <span className="lw-badge" style={{ background: "rgba(239,68,68,.2)", color: "#fca5a5" }}>Big</span>}
      </span>
    </div>
  );
}

export default function EventCard({ career, live, onChoose }: { career: CareerState; live: LiveEvent; onChoose: (id: string) => void }) {
  const ids = castIds(live);
  const lead = ids[0];
  const info = lead ? personInfo(career, lead) : null;
  const t = live.event.template;
  return (
    <div className="lw flex min-h-full flex-col" data-event={live.id} data-template={t}>
      <TopHud career={career} screen="relations" />
      <div className="flex flex-1 flex-col gap-3 px-3 pb-6 pt-2">
        <Head live={live} />
        <div className="lw-title" style={{ fontSize: 19 }}>{live.event.title.replace(/^"|"$/g, "")}</div>

        {t === "phone-call" && (
          <div className="lw-card flex flex-col items-center gap-2 p-4 text-center">
            <div className="lw-ring rounded-full"><LifeFace career={career} id={lead ?? "oneoff:caller"} size={88} /></div>
            <div className="text-[17px] font-black leading-tight">{live.cast.stranger && !lead ? "Withheld number" : info?.name ?? "Unknown"}</div>
            <div className="lw-sub">{info?.outlet ?? (info ? roleWord(info.role) : "Calling…")}</div>
            <div className="mt-1 w-full space-y-2 text-left">
              {live.lines.map((l, i) => <p key={i} className="lw-caption">{l}</p>)}
            </div>
          </div>
        )}

        {t === "text-thread" && (
          <div className="lw-card flex flex-col gap-2 p-3">
            <div className="flex items-center gap-2 border-b border-white/10 pb-2">
              <LifeFace career={career} id={live.cast.stranger ? "oneoff:stranger" : lead ?? "oneoff:stranger"} size={34} />
              <div className="text-[14px] font-black">{live.cast.stranger ? "Unknown number" : info?.name ?? "Messages"}</div>
            </div>
            {live.lines.map((l, i) => <div key={i} className="lw-bubble">{l}</div>)}
          </div>
        )}

        {t === "feed-post" && (
          <div className="lw-card space-y-2 p-3">
            <div className="lw-post-head">
              <span className="lw-outlet">{(info?.outlet ?? "N")[0]}</span>
              <div><div className="text-[14px] font-black">{info?.outlet ?? "The papers"}</div><div className="lw-sub">Trending in sport</div></div>
            </div>
            <div className="lw-headline">{live.lines[0]}</div>
            {live.lines.slice(1).map((l, i) => <p key={i} className="lw-caption text-white/85">{l}</p>)}
          </div>
        )}

        {t === "talk-scene" && <TalkStill career={career} live={live} ids={ids} />}

        <Callbacks live={live} />
        <div className="mt-auto pt-1"><Choices live={live} onChoose={onChoose} /></div>
      </div>
    </div>
  );
}

function roleWord(role: string): string {
  return ({ manager: "Your manager", agent: "Your agent", dad: "Dad", mum: "Mum", brother: "Your brother", physio: "Club physio", kitman: "Kit man", teammate: "Team-mate" } as Record<string, string>)[role] ?? "";
}

function TalkStill({ career, live, ids }: { career: CareerState; live: LiveEvent; ids: string[] }) {
  const [name, dark, light] = PLACE[live.event.place] ?? [live.event.place.replace(/-/g, " "), "#1e293b", "#94a3b8"];
  return (
    <>
      <div className="lw-still" style={{ background: `radial-gradient(120% 80% at 50% 0%, ${light}55, transparent 60%), linear-gradient(180deg, ${dark}, #0b1220)` }} data-still>
        <span className="lw-place lw-badge" style={{ background: "rgba(0,0,0,.45)", color: "#fff" }}>{name}</span>
        <div className="lw-floor" />
        <div className="lw-cast">
          {ids.slice(0, 3).map((id, i) => (
            <div key={id} className="flex flex-col items-center gap-1" style={{ transform: i === 0 ? "scale(1.08)" : undefined }}>
              <LifeFace career={career} id={id} size={i === 0 ? 76 : 60} />
              <span className="rounded bg-black/55 px-1.5 py-0.5 text-[11px] font-black">{personInfo(career, id)?.short ?? ""}</span>
            </div>
          ))}
          {live.cast.stranger && <div className="flex flex-col items-center gap-1"><LifeFace career={career} id="oneoff:stranger" size={60} /><span className="rounded bg-black/55 px-1.5 py-0.5 text-[11px] font-black">Stranger</span></div>}
        </div>
      </div>
      <div className="lw-card space-y-2 p-3">
        {live.lines.map((l, i) => <p key={i} className="lw-caption">{l}</p>)}
      </div>
    </>
  );
}

export function changeTone(c: LifeChange): string {
  if (c.kind === "memory") return "mem";
  if (c.kind === "team-rule") return "rule";
  if (c.kind === "item" && /gone/.test(c.label)) return "down";
  if (typeof c.delta === "number") {
    const bad = /grudge/i.test(c.label) ? c.delta > 0 : c.delta < 0;
    return bad ? "down" : "up";
  }
  return "";
}

export function ChangeList({ changes }: { changes: LifeChange[] }) {
  return (
    <div className="lw-changes" data-changes>
      {changes.map((c, i) => (
        <span key={i} className="lw-change" data-tone={changeTone(c)}>
          {c.kind === "money" ? c.label : typeof c.delta === "number" ? `${c.label} ${c.delta > 0 ? "+" : ""}${c.delta}` : c.label}
        </span>
      ))}
    </div>
  );
}

export function OutcomeCard({ career, live, choiceId, result, onContinue }: { career: CareerState; live: LiveEvent; choiceId: string; result: ChoiceResult; onContinue: () => void }) {
  const picked = live.choices.find((c) => c.id === choiceId);
  return (
    <div className="lw flex min-h-full flex-col" data-outcome={live.id}>
      <TopHud career={career} screen="relations" />
      <div className="flex flex-1 flex-col gap-3 px-3 pb-6 pt-2">
        <Head live={live} />
        <div className="lw-title" style={{ fontSize: 19 }}>{live.event.title.replace(/^"|"$/g, "")}</div>
        {picked && <div className="lw-bubble lw-reply self-end">{picked.label}</div>}
        {result.minigame && <div className="lw-badge self-start" style={{ background: result.minigame === "won" ? "rgba(34,197,94,.2)" : "rgba(239,68,68,.2)", color: result.minigame === "won" ? "#86efac" : "#fca5a5" }}>{result.minigame === "won" ? "You won it" : "You lost it"}</div>}
        <div className="lw-card p-4 text-[16px] font-semibold leading-snug" data-result>{result.text}</div>
        <div className="lw-group"><span>What changed</span></div>
        <ChangeList changes={result.changes} />
        <div className="mt-auto pt-3"><button type="button" className="lw-main" onClick={onContinue}>Continue</button></div>
      </div>
    </div>
  );
}

export function ChatCard({ career, id, result, onContinue }: { career: CareerState; id: string; result: ChatResult; onContinue: () => void }) {
  const info = personInfo(career, id);
  return (
    <div className="lw flex min-h-full flex-col" data-chat={id}>
      <TopHud career={career} screen="relations" />
      <div className="flex flex-1 flex-col gap-3 px-3 pb-6 pt-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-black uppercase tracking-[0.14em] text-white/70">💬 Chat</span>
          {result.callback && <span className="lw-badge">↻ He remembers</span>}
        </div>
        <div className="lw-card flex flex-col gap-2 p-3">
          <div className="flex items-center gap-2 border-b border-white/10 pb-2">
            <LifeFace career={career} id={id} size={40} />
            <div><div className="text-[15px] font-black">{info?.name}</div><div className="lw-sub">{info?.player?.position} · in the canteen</div></div>
          </div>
          <div className="lw-bubble lw-reply self-end">&quot;Got a minute?&quot;</div>
          <div className="lw-bubble">{result.line}</div>
        </div>
        <div className="lw-group"><span>What changed</span></div>
        {result.changes.length ? <ChangeList changes={result.changes} /> : <div className="text-[13px] text-white/60">Nothing much. Some days are like that.</div>}
        <div className="mt-auto pt-3"><button type="button" className="lw-main" onClick={onContinue}>Continue</button></div>
      </div>
    </div>
  );
}
