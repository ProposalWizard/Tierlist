"use client";

/**
 * WHAT YOU'VE BOUGHT — on the Home screen (and the Shop page).
 *
 * Harry, 27 Sep 2026: "on the stats page also show your shop items" — the
 * boots you're wearing and the cans you own, in one glance, without opening
 * the Shop. 28 Sep: "Your shop items ... could go back onto the home screen."
 * On Home the cans are already shown, big, in the card right above, so Home
 * passes `showCans={false}` and this card is just what you're wearing.
 */
import type { CareerState } from "@/lib/star/types";
import { KIB_CANS } from "@/lib/star/shopData";
import { rgba } from "@/lib/star/heroFigure";
import KibCanIcon from "./KibCanIcon";

export default function ShopItemsCard({ career, onOpenShop, showCans = true, glow = "#fb923c" }: {
  career: CareerState; onOpenShop: () => void;
  showCans?: boolean;
  /** The club colour the card is lit with on Home. */
  glow?: string;
}) {
  const boot = career.currentBoot;
  const worn = boot.matches > 0;
  return (
    <div
      className="mt-2 rounded-2xl p-3"
      style={{
        background: `radial-gradient(120% 140% at 0% 0%, ${rgba(glow, 0.22)} 0%, transparent 55%), linear-gradient(180deg, rgba(31,41,55,.92), rgba(12,17,28,.96))`,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,.10), inset 0 0 0 1px ${rgba(glow, 0.2)}, 0 10px 24px -12px rgba(0,0,0,.8)`,
      }}
    >
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-300">🛍️ Your shop items</div>
        <button onClick={onOpenShop} className="kib-press rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white/80 hover:text-white">
          Shop →
        </button>
      </div>
      <div className="mt-2 flex items-center gap-2.5 rounded-xl bg-black/30 p-2 ring-1 ring-white/5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-gradient-to-b from-sky-400/30 to-sky-700/20 text-[22px] leading-none ring-1 ring-sky-300/25">👟</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[13px] font-black text-white">{boot.name}</span>
            {boot.curve && worn && <span className="rounded bg-sky-500/30 px-1 text-[8.5px] font-black text-sky-200">CURVE</span>}
            {boot.extraTouch && worn && <span className="rounded bg-fuchsia-500/30 px-1 text-[8.5px] font-black text-fuchsia-200">TOUCH</span>}
          </div>
          <div className="text-[10.5px] font-bold text-white/70">
            {worn ? `${boot.matches} match${boot.matches === 1 ? "" : "es"} left · Pow +${boot.power} · Tec +${boot.technique}` : "Worn out — no boost"}
          </div>
        </div>
      </div>
      {showCans && (
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
      )}
    </div>
  );
}
