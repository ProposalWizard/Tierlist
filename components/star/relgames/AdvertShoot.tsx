"use client";

/**
 * SHOOT AN ADVERT — a sponsor's game, played for one brand from the Sponsors
 * screen. A marker sweeps along the director's track; tap when it's on your
 * mark. Five takes; three good ones and the brand is happy. Raises that
 * brand's happiness, which decides your renewal (sponsorDeals.ts).
 */
import { useEffect, useRef, useState } from "react";
import type { BrandDeal } from "@/lib/star/sponsorDeals";
import { GameShell, ResultPanel, type GameResult } from "./Shell";

const TAKES = 5;
const NEED = 3;
/** What a good / bad shoot does to the brand's happiness (a target hit is +15). */
export const ADVERT_WIN = 10;
export const ADVERT_LOSS = -3;

export default function AdvertShoot({ deal, onFinish, onCancel }: { deal: BrandDeal; onFinish: (r: GameResult) => void; onCancel: () => void }) {
  const current = deal.happiness;
  const [take, setTake] = useState(0);
  const [good, setGood] = useState(0);
  const [pos, setPos] = useState(0);
  const [mark, setMark] = useState(() => 0.25 + Math.random() * 0.5);
  const [flash, setFlash] = useState<"ok" | "bad" | null>(null);
  const [result, setResult] = useState<GameResult | null>(null);
  const t0 = useRef(performance.now());
  // The marker speeds up a little each take.
  const speed = 0.55 + take * 0.12;

  useEffect(() => {
    if (result) return;
    let raf = 0;
    const tick = () => {
      const t = (performance.now() - t0.current) / 1000;
      const phase = (t * speed) % 2;
      setPos(phase < 1 ? phase : 2 - phase);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [speed, result]);

  const width = 0.16 - take * 0.015;
  const action = () => {
    if (result) return;
    const ok = Math.abs(pos - mark) < width / 2;
    const g = good + (ok ? 1 : 0);
    setGood(g);
    setFlash(ok ? "ok" : "bad");
    window.setTimeout(() => setFlash(null), 300);
    const next = take + 1;
    if (next >= TAKES) {
      const won = g >= NEED;
      setResult({ won, gain: won ? ADVERT_WIN : ADVERT_LOSS, line: `${g} good takes out of ${TAKES}.` });
    } else {
      setTake(next);
      setMark(0.2 + Math.random() * 0.6);
      t0.current = performance.now();
    }
  };

  return (
    <GameShell title="Shoot an advert" who={`${deal.brand} happiness`} current={current} tone={deal.color} onBack={take === 0 && !result ? onCancel : undefined}>
      <div className="mb-2 text-[14px] font-bold">Hit your mark when the director calls. {NEED} good takes out of {TAKES}.</div>
      <div className="mb-2 flex justify-between text-[13px] font-black uppercase"><span>Take {Math.min(take + 1, TAKES)} / {TAKES}</span><span>Good {good}</span></div>
      <div className={`relative h-[70px] bg-white/10 ring-2 ${flash === "ok" ? "ring-emerald-400" : flash === "bad" ? "ring-red-500" : "ring-white/15"}`} style={{ borderRadius: 4 }}>
        <div className="absolute inset-y-0 bg-emerald-500/50" style={{ left: `${(mark - width / 2) * 100}%`, width: `${width * 100}%` }} data-mark />
        <div className="absolute inset-y-[-6px] w-[6px] bg-white" style={{ left: `calc(${pos * 100}% - 3px)`, boxShadow: "0 0 8px #fff" }} />
        <div className="absolute inset-x-0 bottom-1 text-center text-[11px] font-black uppercase tracking-wider">🎬 {deal.brand}</div>
      </div>
      {!result && <button onClick={action} data-action className="kib-press mt-3 w-full py-4 text-[18px] font-black uppercase text-gray-950" style={{ borderRadius: 4, background: deal.color }}>Action!</button>}
      {result && <ResultPanel result={result} who={`${deal.brand} happiness`} current={current} onContinue={() => onFinish(result)} />}
    </GameShell>
  );
}
