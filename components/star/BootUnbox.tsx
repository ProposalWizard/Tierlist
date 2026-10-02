"use client";

/**
 * A BOOT COMING OUT OF ITS BOX — played when you buy one (v0.24, Harry,
 * 2 Oct 2026, P2-24: "an animation of them coming out of the box when you buy
 * them").
 *
 * About 1.7 seconds: the box drops in, the lid lifts off, the boot rises out
 * in a burst of light, then its name. Tap anywhere to skip. CSS only — no
 * animation loop. The purchase itself has already happened when this starts;
 * this is only the show. When it ends it hands back the boot's element, so
 * the shop can fly a copy into "Wearing now" from where the boot stood.
 */
import { useEffect, useRef } from "react";
import BootPicture, { BOOT_LOOK } from "./BootPicture";
import { Burst, useTrigger, rgba } from "./ui";

const LENGTH_MS = 1750;

export default function BootUnbox({ base, level, name, pairs = 1, onDone }: {
  base: string;
  level: number;
  name: string;
  /** More than one pair bought at once ("×2 pairs"). */
  pairs?: number;
  onDone: (bootEl: Element | null) => void;
}) {
  const look = BOOT_LOOK[base] ?? BOOT_LOOK.starter;
  const bootRef = useRef<HTMLDivElement>(null);
  const done = useRef(false);
  const [burst, fire] = useTrigger();
  const finish = () => {
    if (done.current) return;
    done.current = true;
    onDone(bootRef.current);
  };
  useEffect(() => {
    const a = setTimeout(fire, 720);
    const b = setTimeout(finish, LENGTH_MS);
    return () => { clearTimeout(a); clearTimeout(b); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The box: the boot's own colour, darker, with a band and a tissue edge.
  const box = `linear-gradient(180deg, ${rgba(look.upper, 0.95)} 0%, ${rgba(look.sole, 1)} 100%)`;
  return (
    <div className="fixed inset-0 z-[85] grid place-items-center" onClick={finish} role="presentation" data-boot-unbox>
      <style>{`
        @keyframes kbuFade{0%{opacity:0}12%{opacity:1}85%{opacity:1}100%{opacity:0}}
        @keyframes kbuDrop{0%{transform:translateY(-60px) scale(.6);opacity:0}22%{transform:translateY(6px) scale(1.04);opacity:1}30%{transform:none}100%{transform:none}}
        @keyframes kbuLid{0%,30%{transform:none;opacity:1}55%{transform:translate(70px,-120px) rotate(28deg);opacity:1}70%,100%{transform:translate(110px,-170px) rotate(40deg);opacity:0}}
        @keyframes kbuBoot{0%,34%{transform:translateY(46px) scale(.62);opacity:0}40%{opacity:1}62%{transform:translateY(-58px) scale(1.18) rotate(-6deg)}74%,100%{transform:translateY(-50px) scale(1.12) rotate(-4deg);opacity:1}}
        @keyframes kbuRays{0%,36%{transform:scale(.3) rotate(0);opacity:0}52%{opacity:.9}100%{transform:scale(1.25) rotate(40deg);opacity:.55}}
        @keyframes kbuName{0%,60%{transform:translateY(10px);opacity:0}72%,100%{transform:none;opacity:1}}
        @media (prefers-reduced-motion: reduce){[data-boot-unbox] *{animation-duration:1ms!important;animation-delay:0ms!important}}
      `}</style>
      <div className="absolute inset-0 bg-black/70" style={{ animation: `kbuFade ${LENGTH_MS}ms ease-out both` }} />
      <div className="relative h-[260px] w-[280px]" style={{ animation: `kbuFade ${LENGTH_MS}ms ease-out both` }}>
        {/* Light behind the boot as it comes out. */}
        <div aria-hidden className="absolute left-1/2 top-[34%] h-[260px] w-[260px] -translate-x-1/2 -translate-y-1/2">
          <div className="h-full w-full rounded-full" style={{ animation: `kbuRays ${LENGTH_MS}ms ease-out both`, background: `conic-gradient(from 0deg, transparent 0 8%, ${rgba(look.upper, 0.55)} 10% 14%, transparent 16% 33%, ${rgba("#fde68a", 0.5)} 35% 39%, transparent 41% 58%, ${rgba(look.upper, 0.55)} 60% 64%, transparent 66% 83%, ${rgba("#fde68a", 0.5)} 85% 89%, transparent 91%)`, maskImage: "radial-gradient(closest-side, #000 30%, transparent 100%)", WebkitMaskImage: "radial-gradient(closest-side, #000 30%, transparent 100%)" }} />
        </div>
        <div className="absolute inset-x-0 bottom-[22%] flex justify-center" style={{ animation: `kbuDrop ${LENGTH_MS}ms cubic-bezier(.2,.9,.3,1.2) both` }}>
          <div className="relative h-[86px] w-[190px]">
            {/* The boot, behind the box's front wall until it rises. */}
            <div className="absolute bottom-[30px] left-1/2 w-[170px] -translate-x-1/2">
              <div ref={bootRef} style={{ animation: `kbuBoot ${LENGTH_MS}ms cubic-bezier(.2,.9,.3,1.1) both`, filter: `drop-shadow(0 10px 14px rgba(0,0,0,.6)) drop-shadow(0 0 16px ${rgba(look.upper, 0.7)})` }}>
                <BootPicture base={base} level={level} className="block aspect-[100/64] w-full" />
              </div>
            </div>
            {/* Tissue paper peeking over the rim. */}
            <div aria-hidden className="absolute inset-x-[10px] top-[-8px] h-[16px]" style={{ background: "repeating-linear-gradient(115deg, #f8fafc 0 14px, #e2e8f0 14px 26px)", clipPath: "polygon(0 100%, 6% 20%, 14% 80%, 24% 0, 36% 70%, 48% 10%, 60% 75%, 72% 5%, 84% 70%, 94% 15%, 100% 100%)" }} />
            {/* The box's front wall. */}
            <div aria-hidden className="absolute inset-0 rounded-[6px]" style={{ background: box, boxShadow: "inset 0 2px 0 rgba(255,255,255,.35), inset 0 -10px 18px rgba(0,0,0,.35), 0 16px 26px -10px rgba(0,0,0,.8)" }}>
              <div className="absolute inset-x-0 top-[42%] h-[14px]" style={{ background: rgba(look.accent, 0.85) }} />
              <div className="absolute bottom-2 left-3 text-[10px] font-black italic tracking-[0.2em] text-white/85">KNOWITBALL</div>
            </div>
            {/* The lid, which lifts and flies off. */}
            <div aria-hidden className="absolute left-[-8px] right-[-8px] top-[-20px] h-[24px] rounded-[5px]" style={{ background: box, boxShadow: "inset 0 2px 0 rgba(255,255,255,.4), 0 6px 10px -4px rgba(0,0,0,.7)", animation: `kbuLid ${LENGTH_MS}ms cubic-bezier(.3,.7,.3,1) both`, transformOrigin: "80% 100%" }}>
              <div className="absolute inset-y-0 left-[44%] w-[14px]" style={{ background: rgba(look.accent, 0.85) }} />
            </div>
          </div>
        </div>
        <Burst trigger={burst} colors={[look.upper, "#fde047", "#ffffff"]} count={22} spread={1} round className="left-1/2 top-[34%]" />
        <div className="absolute inset-x-0 bottom-0 text-center" style={{ animation: `kbuName ${LENGTH_MS}ms ease-out both` }}>
          <div className="text-[20px] font-black text-white" style={{ textShadow: `0 2px 12px ${rgba(look.upper, 0.8)}` }}>{name}</div>
          <div className="text-[12px] font-black uppercase tracking-[0.2em] text-emerald-300">{pairs > 1 ? `${pairs} pairs · yours` : "Yours"}</div>
        </div>
      </div>
    </div>
  );
}
