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
import KibCanIcon from "@/components/star/KibCanIcon";
import { ClubCard, Pop } from "@/components/star/legacy/ui";

export default function ShopItemsCard({ career, onOpenShop, showCans = true, glow = "#fb923c" }: {
  career: CareerState; onOpenShop: () => void;
  showCans?: boolean;
  /** The club colour the card is lit with on Home. */
  glow?: string;
}) {
  const boot = career.currentBoot;
  const worn = boot.matches > 0;
  return (
    <ClubCard glow={glow} strength={0.22} className="mt-2 rounded-2xl p-3">
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
          <div className="text-[10.5px] font-bold text-white">
            {worn ? <><Pop value={boot.matches}>{boot.matches}</Pop> match{boot.matches === 1 ? "" : "es"} left · Pow +{boot.power} · Tec +{boot.technique}</> : "Worn out — no boost"}
          </div>
        </div>
      </div>
      {/* Everything else you own — items, cars, houses (Mikey, 29 Sep 2026:
          "it's just showing KIB cans instead of the items you actually own"). */}
      {career.ownedItems.length > 0 ? (
        <div className="mt-1.5 grid grid-cols-2 gap-1.5">
          {career.ownedItems.map((it) => (
            <div key={it.id} className="flex items-center gap-2 rounded-lg bg-black/25 p-1.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-fuchsia-500/20 text-[17px]">
                {it.category === "vehicle" ? "🚗" : it.category === "property" ? "🏠" : "💎"}
              </span>
              <div className="min-w-0">
                <div className="truncate text-[11px] font-black text-white">{it.name}</div>
                <div className="text-[10px] font-bold text-white">{it.level ? `Level ${it.level} · ` : ""}+{it.lifestyleValue} fame</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-1.5 rounded-lg bg-black/25 p-2 text-[11px] font-bold text-white">No items, cars or houses yet — Shop → Style.</div>
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
