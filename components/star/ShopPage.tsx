"use client";

/**
 * THE RIGHT SWIPE PAGE — shops and the casino.
 *
 * PROTOTYPE (home-screen proto, 27 Sep 2026). Harry: "stats/records left -
 * shops/casino right". Reskinned in the home screen's look (28 Sep 2026).
 *
 * Reordered 30 Sep 2026 (Harry, review of Mikey v0.7, p36): "Probably should
 * do these four first instead of those two … this makes them seem like small
 * things." The four shops — KIB Cans, Boots, Style, Sponsors — now come
 * first as big picture tiles, each with a live line (cans owned, boots left,
 * fame from your stuff, deals signed). The Store and the Casino sit under
 * them, side by side. "My stuff" (everything you own) is last.
 */
import type { CareerState } from "@/lib/star/types";
import { KIB_CANS, baseIdOf } from "@/lib/star/shopData";
import { ownedFame, isWornOut } from "@/lib/star/fame";
import { fameText } from "@/lib/star/lifestyleLevels";
import { brandsOf } from "@/lib/star/sponsorDeals";
import type { HubPhase } from "./HomeHub";
import KibCanIcon from "./KibCanIcon";
import BootPicture from "./BootPicture";
import StylePicture from "./StylePicture";
import { RiseIn, Shine, useClubTheme, rgba } from "./ui";
import type React from "react";

export default function ShopPage({ career, onOpen }: { career: CareerState; onOpen: (ph: HubPhase) => void }) {
  const { glow } = useClubTheme(career);
  const cans = KIB_CANS.reduce((n, c) => n + (career.kibCans[c.id] ?? 0), 0);
  const boot = career.currentBoot;
  const deals = brandsOf(career).deals.length;
  const working = career.ownedItems.filter((o) => !isWornOut(o));
  // The Style tile shows your best thing, or a sports car if you own nothing.
  const best = [...working].sort((a, b) => b.lifestyleValue - a.lifestyleValue)[0];
  const styleArt = best ? { base: baseIdOf(best), level: best.level ?? 1 } : { base: "car-3", level: 3 };

  return (
    <div className="space-y-2.5 pb-3">
      {/* No "Your money" panel up here: money is the chip in the top bar on
          every page (Harry, 1 Oct 2026). */}
      <RiseIn onPageActive index={0}>
        <div className="grid grid-cols-2 gap-2.5">
          <BigTile
            onClick={() => onOpen("shop-kib")}
            color="#fb923c"
            title="KIB Cans"
            sub="Energy and boosts"
            chip={`${cans} owned`}
            art={
              <div className="flex items-end justify-center gap-1.5">
                {KIB_CANS.map((c, i) => <KibCanIcon key={c.id} can={c} className={i === 1 ? "h-[74px] w-[46px]" : "h-[60px] w-[38px]"} />)}
              </div>
            }
          />
          <BigTile
            onClick={() => onOpen("shop-boots")}
            color="#38bdf8"
            title="Boots"
            sub="Power, technique, curl"
            chip={boot.matches > 0 ? `${boot.name} · ${boot.matches} left` : "Yours are worn out"}
            art={<BootPicture base={baseIdOf(boot)} level={boot.level ?? 3} className="h-[80px] w-[125px]" />}
          />
          <BigTile
            onClick={() => onOpen("shop-lifestyle")}
            color="#e879f9"
            title="Style"
            sub="Cars, homes, drip, holidays"
            chip={`${fameText(ownedFame(career.ownedItems))} fame from stuff`}
            art={<StylePicture base={styleArt.base} level={styleArt.level} className="h-[80px] w-[125px]" />}
          />
          <BigTile
            onClick={() => onOpen("sponsors")}
            color="#34d399"
            title="Sponsors"
            sub="Deals and objectives"
            chip={deals === 0 ? "No deals yet" : `${deals} deal${deals === 1 ? "" : "s"} signed`}
            art={<span className="text-[58px] leading-none" style={{ filter: "drop-shadow(0 6px 10px rgba(0,0,0,.55))" }}>🤝</span>}
          />
        </div>
      </RiseIn>

      <RiseIn onPageActive index={1}>
        <div className="grid grid-cols-2 gap-2.5">
          <SmallHero onClick={() => onOpen("store")} icon="🛒" title="Store" sub={`${(career.coins ?? 0).toLocaleString("en-GB")} Coins · specials`} colors={["#fbbf24", "#7c3aed"]} />
          <SmallHero onClick={() => onOpen("casino-menu")} icon="🎰" title="Casino" sub="Slots, cards, racing" colors={["#facc15", "#dc2626"]} />
        </div>
      </RiseIn>
      {/* "My stuff" no longer sits here (Harry, 1 Oct 2026, 05:22): it lives on
          the Style page, behind its My stuff button. */}
    </div>
  );
}

/** One of the four big shop tiles: a picture, a name, a live line. */
function BigTile({ onClick, color, title, sub, chip, art }: {
  onClick: () => void; color: string; title: string; sub: string; chip: string; art: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="kib-press relative flex h-[184px] flex-col overflow-hidden rounded-2xl p-2.5 text-left"
      style={{
        background: `radial-gradient(90% 70% at 50% 18%, ${rgba(color, 0.42)} 0%, transparent 70%), var(--sk-card, linear-gradient(180deg, rgba(31,41,55,.92), rgba(10,15,26,.97)))`,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,.14), inset 0 0 0 1px ${rgba(color, 0.4)}, 0 12px 26px -12px ${rgba(color, 0.75)}`,
      }}
    >
      <Shine loop every={6} />
      <div className="relative flex h-[92px] items-center justify-center">{art}</div>
      <div className="relative mt-auto">
        <div className="text-[19px] font-black leading-none text-white" style={{ textShadow: `0 2px 10px ${rgba(color, 0.6)}` }}>{title}</div>
        <div className="mt-0.5 text-[10.5px] font-bold text-white/75">{sub}</div>
        <div className="mt-1 inline-block max-w-full truncate rounded-full bg-black/45 px-2 py-0.5 text-[10px] font-black ring-1 ring-white/10" style={{ color }}>{chip}</div>
      </div>
    </button>
  );
}

/** The Store and the Casino — still lit, now half width, under the four. */
function SmallHero({ onClick, icon, title, sub, colors }: { onClick: () => void; icon: string; title: string; sub: string; colors: [string, string] }) {
  const [a, b] = colors;
  return (
    <button
      onClick={onClick}
      className="kib-press relative flex items-center gap-2 overflow-hidden rounded-2xl p-2.5 text-left"
      style={{
        background: `radial-gradient(80% 120% at 0% 0%, ${rgba(a, 0.45)} 0%, transparent 60%), radial-gradient(70% 120% at 100% 100%, ${rgba(b, 0.4)} 0%, transparent 60%), var(--sk-card, var(--sk-card, linear-gradient(180deg, #172033, #0a0f1a)))`,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,.16), inset 0 0 0 1px ${rgba(a, 0.35)}`,
      }}
    >
      <span className="text-[28px] leading-none" style={{ filter: "drop-shadow(0 3px 5px rgba(0,0,0,.5))" }}>{icon}</span>
      <div className="min-w-0">
        <div className="text-[15px] font-black uppercase leading-none tracking-wide text-white">{title}</div>
        <div className="mt-0.5 truncate text-[10px] font-bold text-white/70">{sub}</div>
      </div>
    </button>
  );
}
