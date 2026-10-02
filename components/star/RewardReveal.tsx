"use client";

/**
 * THE REWARD REVEAL — what you see when you tap Claim on a Star Pass level
 * (Mikey, 2 Oct 2026): the screen goes dark, light rays turn behind it, the
 * reward rises in big (spin it if it's 3D), its name, then USE NOW or LATER.
 * Either way it's yours and in the Locker; USE NOW also puts it on.
 */
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { CATEGORIES, type CatalogueItem } from "@/lib/star/rewardCatalogue";
import RewardArt from "./RewardArt";

export default function RewardReveal({ card, level, onUse, onLater }: {
  card: CatalogueItem;
  level: number;
  onUse: () => void;
  onLater: () => void;
}) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const a = setTimeout(() => setStep(1), 350);
    const b = setTimeout(() => setStep(2), 1300);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, []);
  const cat = CATEGORIES.find((c) => c.id === card.category)?.label ?? "";
  const artW = Math.min(340, typeof window !== "undefined" ? window.innerWidth - 32 : 340);
  const artH = Math.round(artW * 1.05);
  return createPortal(
    <div data-reward-reveal className="fixed inset-0 z-[90] flex flex-col items-center justify-center overflow-hidden text-white" style={{ background: "radial-gradient(circle at 50% 45%, #2a1d05 0%, #05060c 70%)" }}>
      <style>{`
        @keyframes rr-spin { to { transform: translate(-50%,-50%) rotate(360deg); } }
        @keyframes rr-rise { from { transform: translateY(40px) scale(.6); opacity: 0; } to { transform: none; opacity: 1; } }
        @keyframes rr-in { from { transform: translateY(12px); opacity: 0; } to { transform: none; opacity: 1; } }
        @keyframes rr-flash { 0% { opacity: .9; } 100% { opacity: 0; } }
      `}</style>
      {/* Light rays turning behind it. */}
      <div className="pointer-events-none absolute left-1/2 top-[44%] h-[160vmax] w-[160vmax]" style={{
        transform: "translate(-50%,-50%)", animation: "rr-spin 18s linear infinite",
        background: "repeating-conic-gradient(from 0deg, rgba(253,224,71,.16) 0deg 7deg, transparent 7deg 22deg)",
        maskImage: "radial-gradient(circle, #000 0%, transparent 55%)", WebkitMaskImage: "radial-gradient(circle, #000 0%, transparent 55%)",
      }} />
      <div className="pointer-events-none absolute inset-0 bg-white" style={{ animation: "rr-flash .6s ease-out forwards" }} />

      <div className="relative text-center" style={{ animation: "rr-in .5s ease-out both" }}>
        <div className="text-[12px] font-black uppercase tracking-[0.3em] text-amber-300">Level {level} reward</div>
      </div>
      <div className="relative my-3 grid place-items-center" style={{ width: artW, height: artH, opacity: step >= 1 ? 1 : 0, animation: step >= 1 ? "rr-rise .7s cubic-bezier(.2,1.4,.4,1) both" : undefined }}>
        <div className="absolute inset-[12%] rounded-full" style={{ background: "radial-gradient(closest-side, rgba(253,224,71,.35), transparent)", filter: "blur(18px)" }} />
        {step >= 1 && <div className="relative"><RewardArt card={card} w={artW} h={artH} /></div>}
      </div>
      <div className="relative px-6 text-center" style={{ opacity: step >= 2 ? 1 : 0, animation: step >= 2 ? "rr-in .45s ease-out both" : undefined }}>
        <div className="text-[11px] font-black uppercase tracking-[0.25em] text-white">{cat}</div>
        <div className="mt-1 font-display text-[30px] font-black uppercase leading-none tracking-[0.06em]" style={{
          background: "linear-gradient(180deg, #fff6c8 0%, #fde047 45%, #f59e0b 100%)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
        }}>{card.name}</div>
        <div className="mt-6 flex justify-center gap-3">
          <button onClick={onLater} className="kib-press h-[48px] w-[132px] text-[15px] font-black uppercase tracking-wider text-white" style={{ borderRadius: 3, background: "rgba(255,255,255,.1)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.35)" }}>Later</button>
          <button onClick={onUse} className="kib-press h-[48px] w-[160px] text-[15px] font-black uppercase tracking-wider text-gray-950" style={{ borderRadius: 3, background: "linear-gradient(180deg, #fde047, #f59e0b)", boxShadow: "0 0 22px rgba(251,191,36,.55)" }}>Use now</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
