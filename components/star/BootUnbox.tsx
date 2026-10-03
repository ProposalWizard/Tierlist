"use client";

/**
 * A BOOT COMING OUT OF ITS BOX — played when you buy one (v0.24, Harry,
 * 2 Oct 2026, P2-24: "an animation of them coming out of the box when you buy
 * them").
 *
 * v0.25 (Mikey and Harry, review of v0.24, point 42): "they don't come out of
 * the box at the right angle", maybe "facing the camera"; and at level 5
 * "a cool animation".
 *  - The box is seen from a little above and to the side (front, side and
 *    the open top), so you look INTO it. The boot lies in it, then rises and
 *    turns upright to face you, level, before its name comes up.
 *  - Level 5 has its own reveal: a gold box, spotlights from above, a slower
 *    rise, a light sweep across the boot, two bursts and a "LEVEL 5 · MAX"
 *    plate.
 *
 * Tap anywhere to skip. CSS only — no animation loop. The purchase has
 * already happened when this starts; this is only the show. When it ends it
 * hands back the boot's element, so the shop can fly a copy into
 * "Wearing now" from where the boot stood.
 */
import { useEffect, useRef } from "react";
import BootPicture, { BOOT_LOOK } from "./BootPicture";
import { Burst, useTrigger, rgba } from "./ui";

/** How long the show runs (ms): an ordinary boot, and level 5. */
export const UNBOX_MS = 1750;
export const UNBOX_MS_TOP = 3600;

const GOLD = { upper: "#f5c542", sole: "#8a5a12", accent: "#fff3c4" };

export default function BootUnbox({ base, level, name, pairs = 1, onDone }: {
  base: string;
  level: number;
  name: string;
  /** More than one pair bought at once ("×2 pairs"). */
  pairs?: number;
  onDone: (bootEl: Element | null) => void;
}) {
  const look = BOOT_LOOK[base] ?? BOOT_LOOK.starter;
  const top = level >= 5;
  const ms = top ? UNBOX_MS_TOP : UNBOX_MS;
  const boxLook = top ? GOLD : look;
  const bootRef = useRef<HTMLDivElement>(null);
  const done = useRef(false);
  const [burst, fire] = useTrigger();
  const [burst2, fire2] = useTrigger();
  const finish = () => {
    if (done.current) return;
    done.current = true;
    onDone(bootRef.current);
  };
  useEffect(() => {
    const a = setTimeout(fire, ms * 0.42);
    const c = top ? setTimeout(fire2, ms * 0.62) : undefined;
    const b = setTimeout(finish, ms);
    return () => { clearTimeout(a); clearTimeout(b); if (c) clearTimeout(c); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The box's faces, the boot's colour (gold at level 5): front lit, side in shade.
  const front = `linear-gradient(180deg, ${rgba(boxLook.upper, 0.98)} 0%, ${rgba(boxLook.sole, 1)} 100%)`;
  const side = `linear-gradient(180deg, ${rgba(boxLook.sole, 0.95)} 0%, ${rgba("#000000", 0.85)} 100%)`;
  const dur = `${ms}ms`;
  return (
    <div className="fixed inset-0 z-[85] grid place-items-center" onClick={finish} role="presentation" data-boot-unbox data-level={level}>
      <style>{`
        @keyframes kbuFade{0%{opacity:0}10%{opacity:1}88%{opacity:1}100%{opacity:0}}
        @keyframes kbuDrop{0%{transform:translateY(-70px) scale(.6);opacity:0}20%{transform:translateY(6px) scale(1.04);opacity:1}28%{transform:none}100%{transform:none}}
        @keyframes kbuLid{0%,26%{transform:none;opacity:1}50%{transform:translate(80px,-130px) rotate(32deg);opacity:1}66%,100%{transform:translate(130px,-190px) rotate(46deg);opacity:0}}
        @keyframes kbuBoot{0%,30%{transform:translateY(34px) rotateX(68deg) scale(.7);opacity:0}38%{opacity:1;transform:translateY(10px) rotateX(55deg) scale(.8)}62%{transform:translateY(-86px) rotateX(-6deg) scale(1.22)}74%,100%{transform:translateY(-78px) rotateX(0deg) scale(1.18);opacity:1}}
        @keyframes kbuBootTop{0%,30%{transform:translateY(34px) rotateX(68deg) scale(.7);opacity:0}40%{opacity:1;transform:translateY(10px) rotateX(55deg) scale(.8)}56%{transform:translateY(-60px) rotateX(10deg) scale(1.05)}70%{transform:translateY(-96px) rotateX(-4deg) scale(1.3)}80%,100%{transform:translateY(-88px) rotateX(0deg) scale(1.26);opacity:1}}
        @keyframes kbuRays{0%,34%{transform:scale(.3) rotate(0);opacity:0}52%{opacity:.9}100%{transform:scale(1.3) rotate(50deg);opacity:.55}}
        @keyframes kbuSpot{0%,30%{opacity:0}48%,90%{opacity:.85}100%{opacity:.4}}
        @keyframes kbuSweep{0%,68%{transform:translateX(-140%) skewX(-18deg)}86%,100%{transform:translateX(160%) skewX(-18deg)}}
        @keyframes kbuName{0%,62%{transform:translateY(10px);opacity:0}74%,100%{transform:none;opacity:1}}
        @keyframes kbuPlate{0%,58%{transform:scale(.4) rotate(-10deg);opacity:0}66%{transform:scale(1.15) rotate(-6deg);opacity:1}72%,100%{transform:scale(1) rotate(-6deg);opacity:1}}
        @media (prefers-reduced-motion: reduce){[data-boot-unbox] *{animation-duration:1ms!important;animation-delay:0ms!important}}
      `}</style>
      <div className="absolute inset-0" style={{ background: top ? "radial-gradient(60% 50% at 50% 40%, rgba(60,40,5,.82), rgba(0,0,0,.92))" : "rgba(0,0,0,.82)", animation: `kbuFade ${dur} ease-out both` }} />
      <div className="relative h-[300px] w-[300px]" style={{ animation: `kbuFade ${dur} ease-out both` }}>
        {/* Level 5: two spotlights from above, crossing on the boot. */}
        {top && (
          <div aria-hidden className="pointer-events-none absolute inset-x-[-60px] top-[-140px] h-[360px]" style={{ animation: `kbuSpot ${dur} ease-out both` }}>
            <div className="absolute left-[8%] top-0 h-full w-[46%] origin-top -rotate-[16deg]" style={{ background: "linear-gradient(180deg, rgba(255,240,190,.55), rgba(255,240,190,0) 85%)", clipPath: "polygon(44% 0, 56% 0, 100% 100%, 0 100%)" }} />
            <div className="absolute right-[8%] top-0 h-full w-[46%] origin-top rotate-[16deg]" style={{ background: "linear-gradient(180deg, rgba(255,240,190,.55), rgba(255,240,190,0) 85%)", clipPath: "polygon(44% 0, 56% 0, 100% 100%, 0 100%)" }} />
          </div>
        )}
        {/* Light behind the boot as it comes out. */}
        <div aria-hidden className="absolute left-1/2 top-[30%] h-[280px] w-[280px] -translate-x-1/2 -translate-y-1/2">
          <div className="h-full w-full rounded-full" style={{ animation: `kbuRays ${dur} ease-out both`, background: `conic-gradient(from 0deg, transparent 0 8%, ${rgba(boxLook.upper, 0.55)} 10% 14%, transparent 16% 33%, ${rgba("#fde68a", 0.5)} 35% 39%, transparent 41% 58%, ${rgba(boxLook.upper, 0.55)} 60% 64%, transparent 66% 83%, ${rgba("#fde68a", 0.5)} 85% 89%, transparent 91%)`, maskImage: "radial-gradient(closest-side, #000 30%, transparent 100%)", WebkitMaskImage: "radial-gradient(closest-side, #000 30%, transparent 100%)" }} />
        </div>
        <div className="absolute inset-x-0 bottom-[20%] flex justify-center" style={{ animation: `kbuDrop ${dur} cubic-bezier(.2,.9,.3,1.2) both` }}>
          {/* The box, seen from a little above and to the right: its open top,
              its front and its right side. */}
          <div className="relative h-[92px] w-[200px]">
            {/* The inside, through the open top. */}
            <div aria-hidden className="absolute left-0 right-[-22px] top-[-26px] h-[30px]" style={{ background: "linear-gradient(180deg, #05070c, #1b1f2a)", clipPath: "polygon(11% 0, 100% 0, 89% 100%, 0 100%)" }} />
            {/* Tissue paper folded back over the rim. */}
            <div aria-hidden className="absolute left-[4px] right-[-14px] top-[-24px] h-[16px]" style={{ background: "repeating-linear-gradient(115deg, #f8fafc 0 14px, #e2e8f0 14px 26px)", clipPath: "polygon(10% 100%, 14% 25%, 22% 80%, 32% 0, 44% 70%, 56% 10%, 68% 75%, 80% 5%, 92% 70%, 98% 20%, 99% 100%)", opacity: 0.9 }} />
            {/* The boot: lying in the box, then up and facing you. */}
            <div className="absolute bottom-[34px] left-1/2 w-[176px] -translate-x-1/2" style={{ perspective: "520px" }}>
              <div ref={bootRef} style={{ transformOrigin: "50% 90%", animation: `${top ? "kbuBootTop" : "kbuBoot"} ${dur} cubic-bezier(.2,.9,.3,1.1) both`, filter: `drop-shadow(0 12px 14px rgba(0,0,0,.6)) drop-shadow(0 0 ${top ? 26 : 16}px ${rgba(top ? "#fde047" : look.upper, 0.75)})` }}>
                <div className="relative overflow-hidden">
                  <BootPicture base={base} level={level} className="block aspect-[100/64] w-full" />
                  {/* Level 5: a light sweep across the boot once it is up. */}
                  {top && <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-1/3" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,.7), transparent)", mixBlendMode: "overlay", animation: `kbuSweep ${dur} ease-in-out both` }} />}
                </div>
              </div>
            </div>
            {/* The right side of the box, in shade. */}
            <div aria-hidden className="absolute bottom-[4px] right-[-22px] top-[4px] w-[22px]" style={{ background: side, clipPath: "polygon(0 0, 100% -30%, 100% 85%, 0 100%)", transform: "translateY(-12px)" }} />
            {/* The box's front wall. */}
            <div aria-hidden className="absolute inset-0 rounded-[5px]" style={{ background: front, boxShadow: "inset 0 2px 0 rgba(255,255,255,.4), inset 0 -12px 18px rgba(0,0,0,.35), 0 18px 28px -10px rgba(0,0,0,.85)" }}>
              <div className="absolute inset-x-0 top-[40%] h-[14px]" style={{ background: rgba(boxLook.accent, 0.85) }} />
              <div className="absolute bottom-2 left-3 text-[10px] font-black italic tracking-[0.2em] text-white/90">KNOWITBALL</div>
              {top && <div className="absolute bottom-2 right-3 text-[10px] font-black tracking-[0.2em] text-amber-900/90">★ L5</div>}
            </div>
            {/* The lid, which lifts and flies off (seen from above too). */}
            <div aria-hidden className="absolute left-[-8px] right-[-30px] top-[-34px] h-[30px]" style={{ animation: `kbuLid ${dur} cubic-bezier(.3,.7,.3,1) both`, transformOrigin: "80% 100%" }}>
              <div className="absolute inset-x-0 top-0 h-[12px]" style={{ background: `linear-gradient(180deg, ${rgba("#ffffff", 0.35)}, ${rgba(boxLook.upper, 1)})`, clipPath: "polygon(9% 0, 100% 0, 91% 100%, 0 100%)" }} />
              <div className="absolute inset-x-0 bottom-0 right-[22px] h-[20px] rounded-[4px]" style={{ background: front, boxShadow: "inset 0 2px 0 rgba(255,255,255,.4), 0 6px 10px -4px rgba(0,0,0,.7)" }}>
                <div className="absolute inset-y-0 left-[44%] w-[14px]" style={{ background: rgba(boxLook.accent, 0.85) }} />
              </div>
            </div>
          </div>
        </div>
        <Burst trigger={burst} colors={[boxLook.upper, "#fde047", "#ffffff"]} count={top ? 30 : 22} spread={1} round className="left-1/2 top-[30%]" />
        {top && <Burst trigger={burst2} colors={["#fde047", "#fff7d6", "#f59e0b"]} count={34} spread={1.3} round className="left-1/2 top-[26%]" />}
        {top && (
          <div className="absolute right-3 top-2 rounded-lg px-2.5 py-1 text-center" style={{ animation: `kbuPlate ${dur} cubic-bezier(.2,.9,.3,1.3) both`, background: "linear-gradient(180deg, #fde68a, #d97706)", boxShadow: "0 6px 18px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.7)" }}>
            <div className="text-[15px] font-black italic leading-none text-amber-950">LEVEL 5</div>
            <div className="text-[9px] font-black uppercase tracking-[0.25em] text-amber-900">Max</div>
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 text-center" style={{ animation: `kbuName ${dur} ease-out both` }}>
          <div className="text-[20px] font-black text-white" style={{ textShadow: `0 2px 12px ${rgba(top ? "#f59e0b" : look.upper, 0.85)}` }}>{name}</div>
          <div className={`text-[12px] font-black uppercase tracking-[0.2em] ${top ? "text-amber-300" : "text-emerald-300"}`}>{pairs > 1 ? `${pairs} pairs · yours` : top ? "The best there is · yours" : "Yours"}</div>
        </div>
      </div>
    </div>
  );
}
