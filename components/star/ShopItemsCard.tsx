"use client";

/**
 * MY STUFF, IN ONE GLANCE — on the Shop page.
 *
 * Harry, 27 Sep 2026: "on the stats page also show your shop items". 30 Sep
 * (p40): "maybe like a little place where you can see all your stuff." The
 * boots you're wearing, your cans and everything you own, each as its own
 * picture with the fame it is giving you now; "See all" opens the full
 * My stuff view in Style.
 *
 * The fame number used to be the item's raw status (a Level 3 Phone showed
 * "+6 fame" here while Style said +0.5). It is now the real share of your
 * fame (lifestyleLevels.ts's fameFromOwned), the same number Style shows.
 */
import type { CareerState } from "@/lib/star/types";
import { KIB_CANS, baseIdOf } from "@/lib/star/shopData";
import { isWornOut, ownedFame } from "@/lib/star/fame";
import { levelName, fameFromOwned, fameText } from "@/lib/star/lifestyleLevels";
import KibCanIcon from "./KibCanIcon";
import BootPicture from "./BootPicture";
import StylePicture, { LEVEL_TILE } from "./StylePicture";
import { ClubCard, Pop } from "./ui";

export default function ShopItemsCard({ career, onOpenShop, showCans = true, glow = "#fb923c" }: {
  career: CareerState; onOpenShop: () => void;
  showCans?: boolean;
  /** The club colour the card is lit with. */
  glow?: string;
}) {
  const boot = career.currentBoot;
  const worn = boot.matches > 0;
  const items = [...career.ownedItems].sort((a, b) => fameFromOwned(career.ownedItems, b) - fameFromOwned(career.ownedItems, a));
  return (
    <ClubCard glow={glow} strength={0.22} className="mt-2 rounded-2xl p-3">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-300">🛍️ My stuff</div>
        <button onClick={onOpenShop} className="kib-press rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white/85 hover:text-white">
          See all →
        </button>
      </div>
      <div className="mt-2 flex items-center gap-2.5 rounded-xl bg-black/30 p-2 ring-1 ring-white/5">
        <span className="grid h-10 w-[60px] shrink-0 place-items-center rounded-lg bg-gradient-to-b from-sky-400/30 to-sky-700/20 ring-1 ring-sky-300/25">
          <BootPicture base={baseIdOf(boot)} level={boot.level ?? 1} className="h-9 w-[56px]" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[13px] font-black text-white">{boot.name}</span>
            {boot.curve && worn && <span className="rounded bg-sky-500/30 px-1 text-[8.5px] font-black text-sky-200">CURVE</span>}
            {boot.extraTouch && worn && <span className="rounded bg-fuchsia-500/30 px-1 text-[8.5px] font-black text-fuchsia-200">TOUCH</span>}
          </div>
          <div className="text-[10.5px] font-bold text-white">
            {worn ? <><Pop value={boot.matches}>{boot.matches}</Pop> match{boot.matches === 1 ? "" : "es"} left · Pow +{boot.power} · Tec +{boot.technique}</> : "Worn out — no boost"}
          </div>
        </div>
      </div>
      {items.length > 0 ? (
        <>
          <div className="mt-1.5 flex items-center justify-between px-0.5 text-[10px] font-black">
            <span className="uppercase tracking-widest text-white/70">Your things</span>
            <span className="text-amber-300">{fameText(ownedFame(career.ownedItems))} fame</span>
          </div>
          <div className="mt-1 grid grid-cols-3 gap-1.5">
            {items.slice(0, 6).map((it) => {
              const lv = it.level ?? 1;
              const dead = isWornOut(it);
              return (
                <button key={it.id} onClick={onOpenShop} className="kib-press overflow-hidden rounded-lg bg-black/25 text-left ring-1 ring-white/5">
                  <div style={{ background: `linear-gradient(180deg, ${LEVEL_TILE[lv][0]}, ${LEVEL_TILE[lv][1]})` }}>
                    <StylePicture base={baseIdOf(it)} level={lv} className={`block aspect-[100/64] w-full ${dead ? "opacity-40 grayscale" : ""}`} />
                  </div>
                  <div className="px-1 pb-1 pt-0.5">
                    <div className="truncate text-[10px] font-black text-white">{levelName(it)}</div>
                    <div className="text-[9.5px] font-black text-amber-300">{dead ? "Worn out" : `${fameText(fameFromOwned(career.ownedItems, it))} fame`}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <div className="mt-1.5 rounded-lg bg-black/25 p-2 text-[11px] font-bold text-white">No cars, homes or drip yet — Shop → Style.</div>
      )}
      {showCans && (
        <div className="mt-1.5 grid grid-cols-3 gap-1.5">
          {KIB_CANS.map((c) => {
            const ready = !!(c.effect && career.kibAbility?.[c.effect]);
            return (
              <div key={c.id} className="flex items-center gap-1.5 rounded-lg bg-black/25 p-1.5">
                <KibCanIcon can={c} className="h-8 w-5 shrink-0" />
                <div className="min-w-0">
                  <div className="truncate text-[10px] font-black text-white">{c.name.replace(" KIB Can", "")}</div>
                  <div className="text-[12px] font-black tabular-nums text-white"><Pop value={career.kibCans[c.id]}>×{career.kibCans[c.id]}</Pop></div>
                  {ready && <div className="text-[8.5px] font-black uppercase text-emerald-300">Ready ✓</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </ClubCard>
  );
}
