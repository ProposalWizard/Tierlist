"use client";
/**
 * LUNCH — the food hall's phone card on the Training page (phase 1, no 3D yet; lib/star/life/lunch.ts).
 * One plate a day from 12:30 on the career clock, each saying exactly what it does; then sit with a real
 * team-mate: a short chat (free) or a long lunch (one of the week's 3 things). Club size changes the words:
 * a tea urn down the leagues, a chef in the Premier League.
 */
import { useState } from "react";
import type { CareerState } from "@/lib/star/types";
import { clockOf, hhmm } from "@/lib/star/life/clock";
import {
  eatLunch, hallOf, longLunch, lunchChat, lunchMates, lunchStatus, lunchToday, tableBlocked, waitForLunch,
  LUNCH_FROM, LUNCH_UNTIL, PLATES, PLATE_DOES, PLATE_ICON, PLATE_NAME, type LunchMate, type Plate,
} from "@/lib/star/life/lunch";
import { Glow, rgba, tint } from "./ui";

const C1 = "#f59e0b";

export default function LunchCard({ career, onCareer }: { career: CareerState; onCareer: (c: CareerState) => void }) {
  const hall = hallOf(career);
  const status = lunchStatus(career);
  const had = lunchToday(career);
  const now = hhmm(clockOf(career).m);
  const [msg, setMsg] = useState<string | null>(null);
  const [talk, setTalk] = useState<{ id: string; line: string; extra?: string } | null>(null);

  const sub = had ? (had.plate === "skip" ? "You skipped lunch today" : `You had: ${PLATE_NAME[had.plate].toLowerCase()}`)
    : status === "early" ? `From ${hhmm(LUNCH_FROM)} · it's ${now}`
    : status === "open" ? `Open till ${hhmm(LUNCH_UNTIL)} · it's ${now}`
    : status === "over" ? `Over for today · back tomorrow at ${hhmm(LUNCH_FROM)}`
    : "Match day: no time for lunch";
  const canEat = !had && status === "open";

  const eat = (p: Plate) => { const r = eatLunch(career, p); setMsg(r.text); onCareer(r.career); };
  const chat = (m: LunchMate) => { const r = lunchChat(career, m); if (!r) return; setTalk({ id: m.id, line: r.line }); onCareer(r.career); };
  const long = (m: LunchMate) => {
    const r = longLunch(career, m);
    if (!r) return;
    const bits = [r.bond > 0 ? `${m.short} bond +${r.bond}` : "", r.team ? `Team +${r.team}` : "", "1 of this week's 3 things used"].filter(Boolean).join(" · ");
    setTalk({ id: m.id, line: r.line, extra: bits });
    onCareer(r.career);
  };
  const mates = had && had.plate !== "skip" ? lunchMates(career) : [];

  return (
    <div
      data-lunch-card
      data-tour="lunch"
      className="relative overflow-hidden rounded-2xl p-3 text-left"
      style={{
        background: `radial-gradient(120% 140% at 0% 0%, ${rgba(C1, 0.28)} 0%, transparent 55%), var(--sk-card, linear-gradient(180deg, rgba(31,41,55,.92), rgba(12,17,28,.96)))`,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,.10), inset 0 0 0 1px ${rgba(C1, 0.32)}, 0 10px 24px -12px rgba(0,0,0,.8)`,
      }}
    >
      <div className="flex items-center gap-3">
        <div className="relative grid h-11 w-11 shrink-0 place-items-center">
          <Glow color={C1} alpha={0.45} className="inset-0.5 blur-md" />
          <span className="relative grid h-11 w-11 place-items-center rounded-xl text-[22px]" style={{ background: `linear-gradient(180deg, ${rgba(C1, 0.35)}, ${rgba(tint(C1, -0.4), 0.35)})`, boxShadow: `inset 0 1px 0 rgba(255,255,255,.25), inset 0 0 0 1px ${rgba(C1, 0.5)}` }}>
            {hall.icon}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-black leading-tight text-white">Lunch <span className="text-[12px] font-bold text-white/55">· {hall.title}</span></div>
          <div className="mt-0.5 text-[11.5px] font-bold text-white/70" data-lunch-status={status}>{sub}</div>
        </div>
        {status === "early" && !had && (
          <button onClick={() => { setMsg(null); onCareer(waitForLunch(career)); }} className="kib-press shrink-0 rounded-full bg-gradient-to-b from-amber-400 to-amber-600 px-3 py-1.5 text-[12px] font-black uppercase tracking-wide text-white">
            Wait till {hhmm(LUNCH_FROM)}
          </button>
        )}
      </div>

      {!had && (status === "open" || status === "early") && (
        <>
          <div className="mt-2 text-[11px] font-bold text-white/55">{hall.line} One plate a day; a gym boost lasts your next session only.</div>
          <div className="mt-2 space-y-1.5">
            {PLATES.map((p) => (
              <button
                key={p}
                disabled={!canEat}
                onClick={() => eat(p)}
                data-plate={p}
                className="kib-press flex min-h-[48px] w-full items-center gap-2.5 rounded-xl bg-black/30 px-2.5 py-1.5 text-left disabled:opacity-45"
                style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,.08)" }}
              >
                <span className="text-[20px] leading-none">{PLATE_ICON[p]}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-black leading-tight text-white">{PLATE_NAME[p]} <span className="font-bold text-white/50">· {hall.food[p]}</span></span>
                  <span className="block text-[12px] font-bold leading-snug text-amber-200">{PLATE_DOES[p]}</span>
                </span>
              </button>
            ))}
          </div>
          <div className="mt-1.5 text-[10.5px] font-bold text-white/45">Energy and mood share the house&apos;s limit: +3 of each a day. Protein and a gym shake together: never more than ×1.2.</div>
        </>
      )}

      {msg && <div className="mt-2 rounded-lg bg-amber-400/15 px-2.5 py-2 text-[12.5px] font-bold leading-snug text-amber-100" data-lunch-result>{msg}</div>}

      {mates.length > 0 && (
        <div className="mt-2.5" data-lunch-table>
          <div className="text-[12px] font-black uppercase tracking-wide text-white/70">Sit with a team-mate</div>
          <div className="mt-1.5 space-y-1.5">
            {mates.map((m) => {
              const chatNo = tableBlocked(career, "chat");
              const longNo = tableBlocked(career, "long");
              return (
                <div key={m.id} className="rounded-xl bg-black/30 px-2.5 py-2" style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,.08)" }}>
                  <div className="text-[13.5px] font-black text-white">{m.name}</div>
                  <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                    <button disabled={!!chatNo} onClick={() => chat(m)} className="kib-press min-h-[44px] rounded-lg bg-white/10 px-2 text-[12px] font-black leading-tight text-white disabled:opacity-40">
                      Chat<span className="block text-[10.5px] font-bold text-white/60">Free</span>
                    </button>
                    <button disabled={!!longNo} onClick={() => long(m)} className="kib-press min-h-[44px] rounded-lg bg-gradient-to-b from-amber-400 to-amber-600 px-2 text-[12px] font-black leading-tight text-white disabled:opacity-40">
                      Long lunch<span className="block text-[10.5px] font-bold text-white/85">1 of the week&apos;s 3 things · bond up</span>
                    </button>
                  </div>
                  {talk?.id === m.id && (
                    <div className="mt-1.5 text-[12.5px] font-bold leading-snug text-white/85" data-lunch-talk>
                      {talk.line}
                      {talk.extra && <span className="mt-1 block text-[11.5px] text-emerald-300">{talk.extra}</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {(() => {
            const why = tableBlocked(career, "long");
            return why && why !== "You've had a long lunch today" ? <div className="mt-1.5 text-[11px] font-bold text-white/50">Long lunch: {why.toLowerCase()}.</div> : null;
          })()}
        </div>
      )}
    </div>
  );
}
