"use client";

/**
 * Keepie-uppies over a real still of the place you are going into (Harry,
 * 27 Nov 2026: "keepie-uppies look good"). Watch-only: the ball is kept up by
 * itself (a CSS loop, see curtain.css), the count ticks with every touch.
 * "Optional tap if the wait is long": after 4 s it offers "Tap as it lands";
 * a tap is judged against the touch nearest to it (Perfect / Good / Early /
 * Late) and a run of good ones is counted. Nothing is needed to enjoy it.
 */
import { useEffect, useRef, useState } from "react";
import type { LoadSection, LoadVariant } from "@/lib/star/loading/pick";

/** One touch every 0.9 s (curtain.css: .lc-kp-y is four touches in 3.6 s). */
const PERIOD = 0.9;
const COUNT = 60;

const PLACE: Partial<Record<LoadSection, string>> = {
  garden: "The garden", house: "Your house", shop: "The shop", casino: "The casino", gym: "The gym", street: "High Street", drive: "Your car",
};

export default function Keepie({ variant, section, box, t0 }: { variant: LoadVariant; section: LoadSection; box?: boolean; t0: number }) {
  const [offer, setOffer] = useState(false);
  const [judge, setJudge] = useState<{ word: string; key: number; good: boolean } | null>(null);
  const [run, setRun] = useState(0);
  const key = useRef(0);
  useEffect(() => {
    if (box) return;
    const wait = Math.max(0, 4000 - (performance.now() - t0));
    const t = window.setTimeout(() => setOffer(true), wait);
    return () => clearTimeout(t);
  }, [box, t0]);

  const tap = (e: React.PointerEvent) => {
    if (!offer) return;
    // where in the touch rhythm this tap fell: the loop started at t0 (the screen's own clock)
    const t = ((e.timeStamp || performance.now()) - t0) / 1000;
    const ph = ((t % PERIOD) + PERIOD) % PERIOD;
    const off = ph < PERIOD / 2 ? ph : ph - PERIOD; // + late, - early
    const a = Math.abs(off);
    const good = a <= 0.16;
    const word = a <= 0.08 ? "Perfect!" : good ? "Good" : off < 0 ? "Early" : "Late";
    setRun((r) => (good ? r + 1 : 0));
    setJudge({ word, key: ++key.current, good });
  };

  return (
    <div className="absolute inset-0" onPointerDown={tap}>
      <div className="lc-kp-bg" style={{ backgroundImage: `url(/star/loading/${variant.still}.webp)` }} />
      <div className="lc-kp-shade" />
      {variant.weather === "rain" && <div className="lc-wx lc-wx-rain"><div className="lc-drops" /><div className="lc-drops b" /><div className="lc-splash" /></div>}
      {variant.weather === "night" && <div className="lc-wx lc-wx-night" />}
      {variant.weather === "lamp" && <div className="lc-wx lc-wx-lamp" />}
      {variant.weather === "neon" && <div className="lc-wx lc-wx-neon" />}
      <div className="lc-kp-head">
        <div className="lc-caps">Keepie-uppies</div>
        <div className="lc-kp-count lc-display" aria-hidden>
          <div className="lc-kp-strip">
            {Array.from({ length: COUNT }, (_, i) => <span key={i}>{i + 1}</span>)}
          </div>
        </div>
        {!box && <div className="lc-kp-place">{run >= 2 ? `Your run: ${run}` : PLACE[section] ?? ""}</div>}
      </div>
      <div className={`lc-kp-tap ${offer && !judge ? "on" : ""}`}>Tap as it lands</div>
      {judge && <div key={judge.key} className="lc-kp-judge lc-display" style={{ color: judge.good ? "#fde047" : "#fff" }}>{judge.word}</div>}
      <div className="lc-kp-x">
        <div className="lc-kp-sh" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="lc-kp-boot" src="/star/loading/boot.webp" alt="" />
        <div className="lc-kp-ring" />
        <div className="lc-kp-plus lc-display">+1</div>
        <div className="lc-kp-y">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <div className="lc-kp-ball"><img src="/star/loading/ball.webp" alt="" /></div>
        </div>
      </div>
    </div>
  );
}
