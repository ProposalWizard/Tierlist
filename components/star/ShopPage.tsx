"use client";

/**
 * THE RIGHT SWIPE PAGE — shops and the casino.
 *
 * PROTOTYPE (home-screen proto, 27 Sep 2026). Harry: "stats/records left -
 * shops/casino right". Big tiles into the real screens; what you already own
 * sits underneath (ShopItemsCard, moved here from the Stats page).
 */
import type { CareerState } from "@/lib/star/types";
import { formatMoney } from "@/lib/star/money";
import type { HubPhase } from "./HomeHub";
import ShopItemsCard from "./ShopItemsCard";

const TILES: { ph: HubPhase; icon: string; label: string; sub: string; tone: string }[] = [
  { ph: "shop-kib", icon: "🥤", label: "KIB Cans", sub: "Energy and boot boosts", tone: "from-orange-500/40 to-orange-700/20 border-orange-400/40" },
  { ph: "shop-boots", icon: "👟", label: "Boots", sub: "Power, technique, curl", tone: "from-sky-500/40 to-sky-700/20 border-sky-400/40" },
  { ph: "shop-lifestyle", icon: "💎", label: "Style", sub: "Cars, houses, drip", tone: "from-fuchsia-500/40 to-fuchsia-700/20 border-fuchsia-400/40" },
  { ph: "sponsors", icon: "🤝", label: "Sponsors", sub: "Deals and objectives", tone: "from-emerald-500/40 to-emerald-700/20 border-emerald-400/40" },
];

export default function ShopPage({ career, onOpen }: { career: CareerState; onOpen: (ph: HubPhase) => void }) {
  return (
    <div className="space-y-2 pb-2">
      <div className="flex items-center justify-between rounded-xl bg-black/25 px-3 py-2">
        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-white/70">Your money</span>
        <span className="text-[18px] font-black tabular-nums text-yellow-200">★ {formatMoney(career.money)}</span>
      </div>
      <button
        onClick={() => onOpen("store")}
        className="relative block w-full overflow-hidden rounded-2xl border border-amber-300/60 bg-gradient-to-br from-amber-400/40 via-violet-600/25 to-sky-700/30 p-4 text-left active:scale-[0.99]"
      >
        <div className="text-[34px] leading-none">🛒</div>
        <div className="mt-1 text-[20px] font-black text-white">Store</div>
        <div className="text-[11px] font-bold text-white/70">Daily specials, run-ups, accessories, boosts, Coins</div>
        <div className="absolute right-3 top-3 rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-black text-amber-200">
          {(career.coins ?? 0).toLocaleString("en-GB")} Coins · Open →
        </div>
      </button>
      <button
        onClick={() => onOpen("casino-menu")}
        className="relative block w-full overflow-hidden rounded-2xl border border-yellow-400/50 bg-gradient-to-br from-yellow-500/35 via-red-600/25 to-purple-800/30 p-4 text-left active:scale-[0.99]"
      >
        <div className="text-[34px] leading-none">🎰</div>
        <div className="mt-1 text-[20px] font-black text-white">Casino</div>
        <div className="text-[11px] font-bold text-white/70">Slots, blackjack, horse racing, bets on the season</div>
        <div className="absolute right-3 top-3 rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-black text-yellow-200">Open →</div>
      </button>
      <div className="grid grid-cols-2 gap-2">
        {TILES.map((t) => (
          <button
            key={t.ph}
            onClick={() => onOpen(t.ph)}
            className={`rounded-2xl border bg-gradient-to-br ${t.tone} p-3 text-left active:scale-[0.98]`}
          >
            <div className="text-[26px] leading-none">{t.icon}</div>
            <div className="mt-1 text-[14px] font-black text-white">{t.label}</div>
            <div className="text-[10px] font-bold text-white/65">{t.sub}</div>
          </button>
        ))}
      </div>
      <ShopItemsCard career={career} onOpenShop={() => onOpen("shop-kib")} />
    </div>
  );
}
