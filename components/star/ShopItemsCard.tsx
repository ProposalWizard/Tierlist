"use client";

/**
 * WHAT YOU'VE BOUGHT — on the Stats screen (the left swipe page).
 *
 * Harry, 27 Sep 2026, reviewing the swipe home screens: "on the stats page
 * also show your shop items" — the boots you're wearing and the cans you own,
 * in one glance, without opening the Shop.
 */
import type { CareerState } from "@/lib/star/types";
import { KIB_CANS } from "@/lib/star/shopData";
import KibCanIcon from "./KibCanIcon";

export default function ShopItemsCard({ career, onOpenShop }: { career: CareerState; onOpenShop: () => void }) {
  const boot = career.currentBoot;
  const worn = boot.matches > 0;
  return (
    <div className="mt-2 rounded-lg border-l-4 border-orange-400 bg-gray-800 p-3">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-black uppercase tracking-widest text-orange-300">🛍️ Your shop items</div>
        <button onClick={onOpenShop} className="text-[10px] font-black uppercase tracking-wider text-white/70 hover:text-white">
          Shop →
        </button>
      </div>
      <div className="mt-2 flex items-center gap-2 rounded-lg bg-black/25 p-2">
        <span className="text-xl leading-none">👟</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[12px] font-black text-white">{boot.name}</span>
            {boot.curve && worn && <span className="rounded bg-sky-500/30 px-1 text-[8.5px] font-black text-sky-200">CURVE</span>}
            {boot.extraTouch && worn && <span className="rounded bg-fuchsia-500/30 px-1 text-[8.5px] font-black text-fuchsia-200">TOUCH</span>}
          </div>
          <div className="text-[10.5px] font-bold text-white/70">
            {worn ? `${boot.matches} match${boot.matches === 1 ? "" : "es"} left · Pow +${boot.power} · Tec +${boot.technique}` : "Worn out — no boost"}
          </div>
        </div>
      </div>
      <div className="mt-1.5 grid grid-cols-3 gap-1.5">
        {KIB_CANS.map((c) => {
          const ready = !!(c.effect && career.kibAbility?.[c.effect]);
          return (
            <div key={c.id} className="flex items-center gap-1.5 rounded-lg bg-black/25 p-1.5">
              <KibCanIcon can={c} className="h-8 w-5 shrink-0" />
              <div className="min-w-0">
                <div className="truncate text-[10px] font-black text-white">{c.name.replace(" KIB Can", "")}</div>
                <div className="text-[12px] font-black tabular-nums text-white">×{career.kibCans[c.id]}</div>
                {ready && <div className="text-[8.5px] font-black uppercase text-emerald-300">Ready ✓</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
