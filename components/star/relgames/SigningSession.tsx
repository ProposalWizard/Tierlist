"use client";

/**
 * SIGNING SESSION — the fans' game. Fans queue at the barrier holding a
 * shirt, a ball or a photo. Tap the matching button to sign it before they
 * give up. Sign the whole queue with fewer than 3 walking off to win.
 * The more famous you are, the longer the queue.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { CareerState } from "@/lib/star/types";
import { fameOf } from "@/lib/star/fame";
import { fakeFaceFor } from "@/lib/star/fakeFaces";
import { gameReward } from "@/lib/star/relationships";
import { GameShell, ResultPanel, type GameResult } from "./Shell";

const ITEMS = [
  { id: "shirt", icon: "👕", label: "Shirt" },
  { id: "ball", icon: "⚽", label: "Ball" },
  { id: "photo", icon: "📸", label: "Photo" },
] as const;
type ItemId = (typeof ITEMS)[number]["id"];
const MISSES = 3;

export default function SigningSession({ career, onFinish, onCancel }: { career: CareerState; onFinish: (r: GameResult) => void; onCancel: () => void }) {
  const current = career.relationships.fans;
  const queue = 8 + Math.floor(Math.min(100, fameOf(career)) / 20); // 8-13 fans
  const [started, setStarted] = useState(false);
  const [fan, setFan] = useState<{ n: number; want: ItemId; until: number } | null>(null);
  const [signed, setSigned] = useState(0);
  const [missed, setMissed] = useState(0);
  const [flash, setFlash] = useState<"ok" | "bad" | null>(null);
  const [result, setResult] = useState<GameResult | null>(null);
  const [now, setNow] = useState(0);
  const served = useRef(0);

  // Each fan waits a little less than the one before (2.6 s down to 1.5 s).
  const patience = (n: number) => Math.max(1500, 2600 - n * 100);
  const nextFan = useCallback(() => {
    const n = served.current++;
    setFan({ n, want: ITEMS[Math.floor(Math.random() * 3)].id, until: performance.now() + patience(n) });
  }, []);

  const finish = useCallback((s: number, m: number) => {
    const won = m < MISSES && s + m >= queue;
    setFan(null);
    setResult({ won, gain: gameReward(won, current, Math.random(), "fans"), line: `${s} signed, ${m} walked off.` });
  }, [current, queue]);

  useEffect(() => {
    if (!started || result) return;
    let raf = 0;
    const tick = () => {
      const t = performance.now();
      setNow(t);
      setFan((f) => {
        if (f && t > f.until) {
          setMissed((m) => m + 1);
          setFlash("bad");
          window.setTimeout(() => setFlash(null), 250);
          return null;
        }
        return f;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [started, result]);

  // When nobody is at the barrier, the next fan steps up — or it's over.
  useEffect(() => {
    if (!started || result || fan) return;
    if (missed >= MISSES || signed + missed >= queue) { finish(signed, missed); return; }
    const t = window.setTimeout(nextFan, 280);
    return () => window.clearTimeout(t);
  }, [started, result, fan, signed, missed, queue, nextFan, finish]);

  const tap = (id: ItemId) => {
    if (!fan) return;
    if (id === fan.want) { setSigned((s) => s + 1); setFlash("ok"); }
    else { setMissed((m) => m + 1); setFlash("bad"); }
    setFan(null);
    window.setTimeout(() => setFlash(null), 250);
  };

  const left = fan ? Math.max(0, (fan.until - now) / patience(fan.n)) : 0;
  const want = fan ? ITEMS.find((i) => i.id === fan.want)! : null;

  return (
    <GameShell title="Signing session" who="Fans" current={current} tone="#f472b6" onBack={started ? undefined : onCancel}>
      <div className="mb-2 flex justify-between text-[13px] font-black uppercase">
        <span>Signed {signed} / {queue}</span>
        <span>{Array.from({ length: MISSES }).map((_, i) => <span key={i} className={i < missed ? "" : "opacity-30"}>✕</span>)}</span>
      </div>
      <div className={`relative grid h-[240px] place-items-center ring-2 ${flash === "ok" ? "ring-emerald-400" : flash === "bad" ? "ring-red-500" : "ring-white/15"}`} style={{ borderRadius: 4, background: "linear-gradient(180deg,#1e293b,#0f172a)" }}>
        {!started && !result && (
          <div className="px-4 text-center">
            <div className="text-[16px] font-black">Fans are queuing at the barrier.</div>
            <div className="mt-1 text-[14px] font-bold">Tap what each one is holding to sign it, before they give up.</div>
            <button onClick={() => setStarted(true)} data-start className="kib-press mt-3 rounded bg-pink-500 px-5 py-3 text-[15px] font-black uppercase text-gray-950">Start</button>
          </div>
        )}
        {fan && want && (
          <div className="text-center" data-fan={fan.want}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={fakeFaceFor(`fan:${career.season}:${fan.n}`)} alt="" className="mx-auto h-[90px] w-[90px] rounded-full object-cover object-top ring-2 ring-white/40" />
            <div className="mt-2 text-[44px] leading-none">{want.icon}</div>
            <div className="mt-1 text-[13px] font-black uppercase">Sign my {want.label.toLowerCase()}!</div>
            <div className="mx-auto mt-2 h-[8px] w-[160px] bg-white/15"><div className="h-full bg-pink-400" style={{ width: `${left * 100}%` }} /></div>
          </div>
        )}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {ITEMS.map((i) => (
          <button key={i.id} onClick={() => tap(i.id)} disabled={!fan} data-item={i.id} className="kib-press grid h-[72px] place-items-center bg-white/10 ring-1 ring-white/25 disabled:opacity-40" style={{ borderRadius: 4 }}>
            <span className="text-[30px] leading-none">{i.icon}</span>
            <span className="text-[11px] font-black uppercase">{i.label}</span>
          </button>
        ))}
      </div>
      {result && <ResultPanel result={result} who="Fans" current={current} onContinue={() => onFinish(result)} />}
    </GameShell>
  );
}
