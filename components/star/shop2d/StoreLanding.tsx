"use client";

/**
 * THE SHOP PAGE (Home's right swipe), New look — the store front. Same doors
 * as the old page (ShopPage.tsx, still the Old look): KIB Cans, Boots, Style,
 * Sponsors first, then the Store and the Casino, then "Walk the 3D shop".
 */
import type React from "react";
import type { CareerState } from "@/lib/star/types";
import { KIB_CANS, baseIdOf } from "@/lib/star/shopData";
import { ownedFame, isWornOut } from "@/lib/star/fame";
import { fameText } from "@/lib/star/lifestyleLevels";
import { brandsOf } from "@/lib/star/sponsorDeals";
import { formatMoney } from "@/lib/star/money";
import type { HubPhase } from "../HomeHub";
import BootPicture from "../BootPicture";
import StylePicture from "../StylePicture";
import { RiseIn, useCountUp } from "../ui";
import { art } from "./parts";

export default function StoreLanding({ career, onOpen, sponsorsLock }: { career: CareerState; onOpen: (ph: HubPhase) => void; sponsorsLock?: string }) {
  const cans = KIB_CANS.reduce((n, c) => n + (career.kibCans[c.id] ?? 0), 0);
  const boot = career.currentBoot;
  const deals = brandsOf(career).deals.length;
  const working = career.ownedItems.filter((o) => !isWornOut(o));
  const best = [...working].sort((a, b) => b.lifestyleValue - a.lifestyleValue)[0];
  const styleArt = best ? { base: baseIdOf(best), level: best.level ?? 1 } : { base: "car-3", level: 3 };
  const shown = useCountUp(career.money, 800);

  return (
    <div className="space-y-2.5 pb-3" data-store-landing>
      <RiseIn onPageActive index={0}>
        <div className="relative h-[104px] overflow-hidden rounded-[4px] ring-1 ring-amber-300/40">
          <div className="absolute inset-0" style={{ backgroundImage: `url(${art("hero")})`, backgroundSize: "cover", backgroundPosition: "center 40%" }} />
          <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, rgba(5,8,16,.9), rgba(5,8,16,.35) 60%, rgba(5,8,16,.8))" }} />
          <div className="relative flex h-full items-end justify-between px-3 pb-2.5">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.28em] text-amber-300">Knowitball</div>
              <div className="text-[30px] font-black uppercase leading-none text-white" style={{ textShadow: "0 3px 14px rgba(0,0,0,.8), 0 0 22px rgba(251,191,36,.35)" }}>Store</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/70">Balance</div>
              <div className="text-[22px] font-black leading-none tabular-nums text-yellow-300" style={{ textShadow: "0 2px 10px rgba(0,0,0,.8)" }}>★{formatMoney(Math.round(shown))}</div>
            </div>
          </div>
        </div>
      </RiseIn>

      <RiseIn onPageActive index={1}>
        <div className="grid grid-cols-2 gap-2.5">
          <Door onClick={() => onOpen("shop-kib")} level={2} color="#fb923c" title="KIB Cans" chip={`${cans} owned`}
            art={<div className="relative grid place-items-center"><img src={art("fx-energy")} alt="" className="absolute h-[110px] w-[110px] opacity-80" /><img src={art("icon-cans")} alt="" className="relative h-[72px] w-[72px]" /></div>} />
          <Door onClick={() => onOpen("shop-boots")} level={Math.max(1, Math.min(5, boot.level ?? 3))} color="#38bdf8" title="Boots"
            chip={boot.matches > 0 ? `${boot.name} · ${boot.matches} left` : "Yours are worn out"}
            art={<BootPicture base={baseIdOf(boot)} level={boot.level ?? 3} className="w-[120px]" />} />
          <Door onClick={() => onOpen("shop-lifestyle")} tour="shop-style" level={Math.max(1, Math.min(5, styleArt.level))} color="#e879f9" title="Style"
            chip={`${fameText(ownedFame(career.ownedItems))} fame from stuff`}
            art={<StylePicture base={styleArt.base} level={styleArt.level} className="w-[120px]" />} />
          <Door onClick={() => onOpen("sponsors")} tour="shop-sponsors" level={5} color="#34d399" title="Sponsors" locked={!!sponsorsLock}
            chip={sponsorsLock ? `🔒 ${sponsorsLock}` : deals === 0 ? "No deals yet" : `${deals} deal${deals === 1 ? "" : "s"} signed`}
            art={<span className="text-[56px] leading-none" style={{ filter: "drop-shadow(0 6px 10px rgba(0,0,0,.55))" }}>🤝</span>} />
        </div>
      </RiseIn>

      <RiseIn onPageActive index={2}>
        <div className="grid grid-cols-2 gap-2.5">
          <Wide onClick={() => onOpen("store")} icon="🛒" title="Store" sub={`${(career.coins ?? 0).toLocaleString("en-GB")} Coins · specials`} />
          <Wide onClick={() => onOpen("casino-menu")} icon="🎰" title="Casino" sub="Slots, cards, racing" />
        </div>
      </RiseIn>
      <RiseIn onPageActive index={3}>
        <button onClick={() => onOpen("shop-3d")} data-shop3d-open className="kib-press relative flex w-full items-center gap-3 overflow-hidden rounded-[4px] p-2.5 text-left ring-1 ring-amber-300/50"
          style={{ background: `linear-gradient(90deg, rgba(7,11,22,.92), rgba(7,11,22,.55)), url(${art("hero")}) center / cover` }}>
          <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-[4px] bg-black/50 text-[24px] ring-1 ring-amber-300/30">🕶️</span>
          <div className="relative min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[15px] font-black uppercase leading-none tracking-wide text-white">Walk the 3D shop</span>
              <span className="rounded-[3px] bg-amber-300 px-1.5 py-0.5 text-[9px] font-black leading-none text-black">BETA</span>
            </div>
            <div className="mt-1 truncate text-[10.5px] font-bold text-white/75">Boots and cars in 3D · tap one to buy it here</div>
          </div>
          <span className="relative text-[22px] font-black text-amber-300">›</span>
        </button>
      </RiseIn>
    </div>
  );
}

/** One of the four doors: its level's frame as the backdrop, the picture, a live line. */
function Door({ onClick, level, color, title, chip, art: pic, tour, locked = false }: {
  onClick: () => void; level: number; color: string; title: string; chip: string; art: React.ReactNode; tour?: string; locked?: boolean;
}) {
  return (
    <button onClick={onClick} data-tour={tour} className="kib-press relative flex h-[188px] flex-col overflow-hidden rounded-[4px] p-2.5 text-left"
      style={{ background: `radial-gradient(90% 70% at 50% 25%, ${color}55 0%, transparent 70%), linear-gradient(180deg, #121a2e, #070b16)`, boxShadow: `inset 0 0 0 1px ${color}66, 0 12px 24px -14px ${color}` }}>
      <div aria-hidden className="absolute inset-0 opacity-55" style={{ backgroundImage: `url(${art(`frame-${level}`)})`, backgroundSize: "100% 100%" }} />
      <div className={`relative flex h-[104px] items-center justify-center ${locked ? "opacity-30 grayscale" : ""}`}>{pic}</div>
      {locked && <div className="absolute right-2.5 top-2.5 grid h-8 w-8 place-items-center rounded-[3px] bg-black/60 text-[16px] ring-1 ring-white/20">🔒</div>}
      <div className="relative mt-auto">
        <div className="text-[19px] font-black uppercase leading-none text-white" style={{ textShadow: `0 2px 10px rgba(0,0,0,.8)` }}>{title}</div>
        <div className="mt-1 inline-block max-w-full truncate rounded-[3px] bg-black/55 px-1.5 py-0.5 text-[10px] font-black ring-1 ring-white/10" style={{ color }}>{chip}</div>
      </div>
    </button>
  );
}

function Wide({ onClick, icon, title, sub }: { onClick: () => void; icon: string; title: string; sub: string }) {
  return (
    <button onClick={onClick} className="kib-press relative flex items-center gap-2 overflow-hidden rounded-[4px] p-2.5 text-left ring-1 ring-white/15" style={{ background: "linear-gradient(180deg, #141c30, #0a0f1c)" }}>
      <span className="text-[28px] leading-none">{icon}</span>
      <div className="min-w-0">
        <div className="text-[15px] font-black uppercase leading-none tracking-wide text-white">{title}</div>
        <div className="mt-0.5 truncate text-[10px] font-bold text-white/70">{sub}</div>
      </div>
    </button>
  );
}
