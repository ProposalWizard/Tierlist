"use client";

/**
 * SPIN — drag your player round, 360° (Mikey, 28 Sep 2026: "I'd love to see
 * the spinning your player 360 degrees work. Maybe create it in a different
 * area of the website, some development area, so I can see it work before I
 * apply it to the game"). If it goes in, it sits on the Home screen and in the
 * store while trying on accessories.
 *
 * What is real and what is a stand-in:
 *   - The drag, the easing back to the front, and the flick-to-keep-turning
 *     are the real interaction.
 *   - The FRONT is the real home-screen avatar (PlayerAvatar, look A2).
 *   - The BACK is the same A2 player from behind (PlayerAvatar view="back",
 *     lib/star/heroBack.ts): surname and number on the shirt, the back of his
 *     head with his photo's hair colour. Harry, 30 Sep 2026: the old flat
 *     stand-in "does not work".
 *   - What is still missing: a true side view. Side-on the body narrows to
 *     42% (the head to 80%) and front cross-fades into back — he never
 *     collapses to a line. A real side-on turn needs the Blender player
 *     rendered at ~24 angles (tools/blender-footballer).
 */
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import PageGuide from "@/components/admin/PageGuide";
import PlayerAvatar from "@/components/star/PlayerAvatar";
import { CLUB_KITS, kitsOf } from "@/lib/star/kits";
import type { CareerState } from "@/lib/star/types";

const W = 200, H = 240;
/** Where the neck is, as % of the avatar's height: above it is the head,
 *  which narrows far less than the body as he turns side-on. */
const HEAD_CUT = 25;

function demoCareer(club: string, number: number, surname: string): CareerState {
  return {
    player: { club, firstName: "Test", lastName: surname, skinTone: "tan", position: "ST" },
    squadNumber: number,
    clubKits: { [club]: kitsOf(club) },
  } as unknown as CareerState;
}

export default function SpinDevPage() {
  const clubs = useMemo(() => Object.keys(CLUB_KITS).sort(), []);
  const [club, setClub] = useState("Leyton Orient");
  const [number, setNumber] = useState(9);
  const surname = "Striker";
  const career = useMemo(() => demoCareer(club, number, surname), [club, number]);

  // angle in degrees; 0 = facing you. Velocity keeps a flick turning.
  const [angle, setAngle] = useState(0);
  const angleRef = useRef(0), velRef = useRef(0), dragRef = useRef<{ x: number; a: number; t: number } | null>(null);
  const setA = (a: number) => { angleRef.current = a; setAngle(a); };

  // Let go: keep the flick's spin, slow down, then settle back to the front.
  useEffect(() => {
    let raf = 0, last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (!dragRef.current) {
        let a = angleRef.current, v = velRef.current;
        if (Math.abs(v) > 20) { a += v * dt; v *= Math.pow(0.12, dt); }
        else {
          v = 0;
          const target = Math.round(a / 360) * 360; // the nearest "facing you"
          a += (target - a) * Math.min(1, dt * 5);
          if (Math.abs(target - a) < 0.3) a = target;
        }
        velRef.current = v;
        if (a !== angleRef.current) setA(a);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const onDown = (e: React.PointerEvent) => {
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, a: angleRef.current, t: performance.now() };
    velRef.current = 0;
  };
  const onMove = (e: React.PointerEvent) => {
    const d = dragRef.current; if (!d) return;
    const a = d.a + (e.clientX - d.x) * 1.2; // 300px of drag ≈ one full turn
    const now = performance.now();
    velRef.current = ((a - angleRef.current) / Math.max(1, now - d.t)) * 1000;
    d.t = now;
    setA(a);
  };
  const onUp = () => { dragRef.current = null; };

  const rad = (angle * Math.PI) / 180;
  const c = Math.cos(rad);
  const showBack = c < 0;
  const shown = ((Math.round(angle) % 360) + 360) % 360;
  // Side-on he must still read as a person (Harry, 1 Oct 2026: at 70–110°
  // he "collapses to a thin vertical line"). A real man side-on is about
  // 40% as wide as face-on and his head barely narrows, so the body never
  // goes below 42% and the head never below 80%; front and back cross-fade
  // through the side (about 84–96°) instead of swapping on a hairline.
  const ac = Math.abs(c);
  const bodyW = 0.42 + 0.58 * ac;
  const headW = 0.8 + 0.2 * ac;
  const back = Math.min(1, Math.max(0, (0.1 - c) / 0.2)); // 0 = front, 1 = back

  return (
    <div className="min-h-screen px-4 py-5 text-white" style={{ background: "#05070d" }}>
      <div className="mx-auto max-w-md">
        <Link href="/star-play-dev" className="text-sm font-black text-white">‹ Play Area</Link>
        <h1 className="mt-2 text-2xl font-black">Spin your player</h1>
        <p className="mt-1 text-[13px] font-bold text-white">Drag left or right on the player. Flick to keep him turning; let go and he turns back to face you.</p>

        <div
          className="relative mt-4 grid touch-none select-none place-items-center overflow-hidden rounded-2xl"
          style={{ height: H + 40, background: "radial-gradient(70% 60% at 50% 40%, #1f3b2a, #07100b)", cursor: dragRef.current ? "grabbing" : "grab" }}
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        >
          <div className="relative" style={{ width: W * 0.9, height: H }}>
            {(["front", "back"] as const).map((v) => {
              // The front stays solid underneath and the back fades in over
              // it, so mid-turn he is never see-through.
              const o = v === "back" ? back : back < 1 ? 1 : 0;
              if (o <= 0) return null;
              return (["head", "body"] as const).map((part) => (
                <div key={v + part} className="absolute inset-0" style={{
                  opacity: o,
                  transform: `scaleX(${part === "head" ? headW : bodyW})`,
                  clipPath: part === "head" ? `inset(0 0 ${100 - HEAD_CUT}% 0)` : `inset(${HEAD_CUT}% 0 0 0)`,
                }}>
                  <PlayerAvatar career={career} width={W * 0.9} height={H} look="A2" view={v} />
                </div>
              ));
            })}
          </div>
          <div className="absolute bottom-2 left-3 rounded-lg bg-black/60 px-2 py-0.5 text-[11px] font-black">{shown}° · {ac < 0.2 ? "side" : showBack ? "back" : "front"}</div>
          <div className="absolute bottom-2 right-3 text-[18px] font-black">⟲ ⟳</div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <label className="text-[12px] font-black">Club
            <select value={club} onChange={(e) => setClub(e.target.value)} className="mt-1 w-full rounded-lg bg-white/10 px-2 py-2 text-[13px] font-bold text-white">
              {clubs.map((k) => <option key={k} value={k} className="text-black">{k}</option>)}
            </select>
          </label>
          <label className="text-[12px] font-black">Number
            <input type="number" min={1} max={99} value={number} onChange={(e) => setNumber(Math.max(1, Math.min(99, Number(e.target.value) || 1)))}
              className="mt-1 w-full rounded-lg bg-white/10 px-2 py-2 text-[13px] font-bold text-white" />
          </label>
        </div>

        <div className="mt-4 rounded-xl border border-amber-300/60 bg-amber-400/15 p-3 text-[12.5px] font-bold text-white">
          Front and back are the real home-screen player. Side-on he narrows and fades from front to back; a true side view needs the 3D renders.
        </div>
      </div>
      <PageGuide page="/star-spin-dev" />
    </div>
  );
}
