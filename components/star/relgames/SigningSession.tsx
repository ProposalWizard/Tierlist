"use client";

/**
 * SIGNING SESSION — the fans' game. Fans queue at the barrier holding a
 * shirt, a ball, a photo or a boot. Tap the matching button to sign it before
 * they give up. The more famous you are, the longer the queue.
 *
 * Harder (Mikey, 5 Oct 2026: "far too easy… it doesn't even really get quicker
 * as you go on… you're basically getting this opportunity for free"):
 *  - much less time: 1.7 s for the first fan, down to 0.8 s;
 *  - four items, and the buttons SHUFFLE for every fan, so you read, not
 *    remember where to tap;
 *  - some fans want two things signed, in order;
 *  - a journalist sometimes steps up with a microphone: sign nothing and let
 *    him pass — tapping anything is a mistake;
 *  - two mistakes and the session is over (was three).
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
  { id: "boot", icon: "👟", label: "Boot" },
] as const;
type ItemId = (typeof ITEMS)[number]["id"];
export const SIGNING_MISSES = 2;
/** How long fan number n waits (ms): 1.7 s down to 0.8 s. */
export const signingPatience = (n: number) => Math.max(800, 1700 - n * 75);
/** From the 4th fan, the chance a fan wants two things; and of a journalist. */
const TWO_CHANCE = 0.3;
const PRESS_CHANCE = 0.15;
const PRESS_MS = 1300;

type Fan = { n: number; press: boolean; want: ItemId[]; got: number; until: number; total: number };

const shuffled = <T,>(xs: readonly T[]): T[] => {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

export default function SigningSession({ career, onFinish, onCancel }: { career: CareerState; onFinish: (r: GameResult) => void; onCancel: () => void }) {
  const current = career.relationships.fans;
  const queue = 10 + Math.floor(Math.min(100, fameOf(career)) / 20); // 10-15
  const [started, setStarted] = useState(false);
  const [fan, setFan] = useState<Fan | null>(null);
  const [order, setOrder] = useState<ItemId[]>(ITEMS.map((i) => i.id));
  const [signed, setSigned] = useState(0);
  const [missed, setMissed] = useState(0);
  const [flash, setFlash] = useState<"ok" | "bad" | null>(null);
  const [result, setResult] = useState<GameResult | null>(null);
  const [now, setNow] = useState(0);
  const served = useRef(0);

  const nextFan = useCallback(() => {
    const n = served.current++;
    const press = n >= 2 && Math.random() < PRESS_CHANCE;
    const two = !press && n >= 3 && Math.random() < TWO_CHANCE;
    const pick = () => ITEMS[Math.floor(Math.random() * ITEMS.length)].id;
    const want = press ? [] : two ? [pick(), pick()] : [pick()];
    const total = press ? PRESS_MS : Math.round(signingPatience(n) * (two ? 1.6 : 1));
    setOrder(shuffled(ITEMS.map((i) => i.id)));
    setFan({ n, press, want, got: 0, until: performance.now() + total, total });
  }, []);

  const finish = useCallback((s: number, m: number) => {
    const won = m < SIGNING_MISSES && s + m >= queue;
    setFan(null);
    setResult({ won, gain: gameReward(won, current, Math.random(), "fans"), line: `${s} done, ${m} mistake${m === 1 ? "" : "s"}.` });
  }, [current, queue]);

  const blink = (k: "ok" | "bad") => { setFlash(k); window.setTimeout(() => setFlash(null), 250); };

  useEffect(() => {
    if (!started || result) return;
    let raf = 0;
    const tick = () => {
      const t = performance.now();
      setNow(t);
      setFan((f) => {
        if (f && t > f.until) {
          // A journalist let past is a success; a fan who gave up is a miss.
          if (f.press) { setSigned((s) => s + 1); blink("ok"); }
          else { setMissed((m) => m + 1); blink("bad"); }
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
    if (missed >= SIGNING_MISSES || signed + missed >= queue) { finish(signed, missed); return; }
    const t = window.setTimeout(nextFan, 260);
    return () => window.clearTimeout(t);
  }, [started, result, fan, signed, missed, queue, nextFan, finish]);

  const tap = (id: ItemId) => {
    if (!fan) return;
    if (fan.press || id !== fan.want[fan.got]) {
      setMissed((m) => m + 1); blink("bad"); setFan(null);
      return;
    }
    if (fan.got + 1 < fan.want.length) { setFan({ ...fan, got: fan.got + 1 }); blink("ok"); return; }
    setSigned((s) => s + 1); blink("ok"); setFan(null);
  };

  const left = fan ? Math.max(0, (fan.until - now) / fan.total) : 0;
  const wants = fan ? fan.want.map((w) => ITEMS.find((i) => i.id === w)!) : [];
  const byId = (id: ItemId) => ITEMS.find((i) => i.id === id)!;

  return (
    <GameShell title="Signing session" who="Fans" current={current} tone="#f472b6" onBack={started ? undefined : onCancel}>
      <div className="mb-2 flex justify-between text-[13px] font-black uppercase">
        <span>Done {signed} / {queue}</span>
        <span>{Array.from({ length: SIGNING_MISSES }).map((_, i) => <span key={i} className={i < missed ? "" : "opacity-30"}>✕</span>)}</span>
      </div>
      <div className={`relative grid h-[240px] place-items-center ring-2 ${flash === "ok" ? "ring-emerald-400" : flash === "bad" ? "ring-red-500" : "ring-white/15"}`} style={{ borderRadius: 4, background: "linear-gradient(180deg,#1e293b,#0f172a)" }}>
        {!started && !result && (
          <div className="px-4 text-center">
            <div className="text-[16px] font-black">Fans are queuing at the barrier.</div>
            <div className="mt-1 text-[14px] font-bold">Tap what each fan holds, in order, before they give up. Never sign for a journalist 🎤. The buttons move.</div>
            <button onClick={() => setStarted(true)} data-start className="kib-press mt-3 rounded bg-pink-500 px-5 py-3 text-[15px] font-black uppercase text-gray-950">Start</button>
          </div>
        )}
        {fan && (
          <div className="text-center" data-fan={fan.press ? "press" : fan.want.join("+")}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={fakeFaceFor(`fan:${career.season}:${fan.n}`)} alt="" className="mx-auto h-[90px] w-[90px] rounded-full object-cover object-top ring-2 ring-white/40" />
            {fan.press ? (
              <>
                <div className="mt-2 text-[44px] leading-none">🎤</div>
                <div className="mt-1 text-[13px] font-black uppercase text-amber-300">Journalist — don&rsquo;t sign!</div>
              </>
            ) : (
              <>
                <div className="mt-2 flex items-center justify-center gap-2 text-[44px] leading-none">
                  {wants.map((w, i) => <span key={i} className={i < fan.got ? "opacity-25" : ""}>{w.icon}</span>)}
                </div>
                <div className="mt-1 text-[13px] font-black uppercase">Sign my {wants.map((w) => w.label.toLowerCase()).join(" then ")}!</div>
              </>
            )}
            <div className="mx-auto mt-2 h-[8px] w-[160px] bg-white/15"><div className={`h-full ${fan.press ? "bg-amber-400" : "bg-pink-400"}`} style={{ width: `${left * 100}%` }} /></div>
          </div>
        )}
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2">
        {order.map(byId).map((i) => (
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
