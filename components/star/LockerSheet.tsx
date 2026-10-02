"use client";

/**
 * THE LOCKER (Mikey, 2 Oct 2026) — everything you own, however you got it
 * (Star Pass, Store), by the catalogue's categories. Tap a thing to use it
 * (pick the run-up, wear it, use the ball/car/sunglasses); tap again to stop.
 * Things you don't own yet are blacked out, so you can see what's left to
 * collect.
 *
 * Opened from the Star Pass's bottom bar. Collectibles (a car, a ball,
 * sunglasses) are kept and switched on here, and show on your player once
 * the avatar is settled — marked SOON until then.
 */
import { createPortal } from "react-dom";
import { useMemo, useState } from "react";
import type { CareerState } from "@/lib/star/types";
import { CATEGORIES, type CatalogueItem, type RewardCategory } from "@/lib/star/rewardCatalogue";
import { ownsCard, isUsing, equipCard, stopUsing, showsInGame } from "@/lib/star/starPassClaim";
import { DEFAULT_PENALTY_RUNUP, DEFAULT_FREE_KICK_RUNUP } from "@/lib/star/runupStyles";
import { BottomBar, BarButton, Chev } from "./ui";
import RewardArt from "./RewardArt";

/** The two free Standard run-ups: always owned, so you can switch back. */
const STANDARDS: CatalogueItem[] = [
  { id: "runup-standard", name: "Standard", category: "penalty-runup", status: "in-game", grant: { kind: "penaltyRunup", id: DEFAULT_PENALTY_RUNUP }, art: { icon: "🏃" } },
  { id: "runup-fk_standard", name: "Standard", category: "freekick-runup", status: "in-game", grant: { kind: "freeKickRunup", id: DEFAULT_FREE_KICK_RUNUP }, art: { icon: "🏃" } },
];

export default function LockerSheet({ career, catalogue, onCareer, onClose }: {
  career: CareerState;
  catalogue: CatalogueItem[];
  onCareer?: (c: CareerState) => void;
  onClose: () => void;
}) {
  const owns = (c: CatalogueItem) => STANDARDS.includes(c) || ownsCard(career, c);
  // Open on the first category you own something in (past the Standards).
  const [cat, setCat] = useState<RewardCategory>(() =>
    CATEGORIES.find((k) => catalogue.some((c) => c.category === k.id && ownsCard(career, c)))?.id ?? "penalty-runup");
  const cards = useMemo(() => {
    const all = [...STANDARDS, ...catalogue].filter((c) => c.category === cat && c.status !== "idea");
    return [...all.filter(owns), ...all.filter((c) => !owns(c))];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat, catalogue, career]);
  const ownedCount = (k: RewardCategory) => catalogue.filter((c) => c.category === k && ownsCard(career, c)).length;

  const tap = (c: CatalogueItem) => {
    if (!owns(c) || !onCareer) return;
    if (isUsing(career, c)) { if (!STANDARDS.includes(c)) onCareer(stopUsing(career, c)); }
    else if (STANDARDS.includes(c)) onCareer(stopUsing(career, c)); // Standard = stop using the other one
    else onCareer(equipCard(career, c));
  };

  return createPortal(
    <div data-locker className="fixed inset-0 z-[80] flex flex-col bg-[#05080f] text-white">
      <div className="mx-auto w-full max-w-md px-4 pt-4">
        <div className="font-display text-[23px] font-black uppercase leading-none tracking-[0.12em]" style={{
          background: "linear-gradient(180deg, #fff6c8 0%, #fde047 45%, #f59e0b 100%)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
        }}>Locker</div>
      </div>
      {/* One row of categories. */}
      <div className="mx-auto mt-3 flex w-full max-w-md gap-1.5 overflow-x-auto px-4 pb-2" style={{ scrollbarWidth: "none" }}>
        {CATEGORIES.map((k) => {
          const on = k.id === cat;
          const n = ownedCount(k.id);
          return (
            <button key={k.id} onClick={() => setCat(k.id)} className="kib-press shrink-0 px-3 py-2 text-[12px] font-black uppercase tracking-wide" style={{
              borderRadius: 3, color: on ? "#111827" : "#ffffff",
              background: on ? "linear-gradient(180deg, #fde047, #f59e0b)" : "rgba(255,255,255,.08)",
              boxShadow: on ? undefined : "inset 0 0 0 1px rgba(255,255,255,.18)",
            }}>
              {k.label}{n > 0 && <span className="ml-1.5 tabular-nums">{n}</span>}
            </button>
          );
        })}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto" style={{ paddingBottom: 84 }}>
        <div className="mx-auto grid w-full max-w-md grid-cols-2 gap-2 px-4 pt-1">
          {cards.map((c) => {
            const have = owns(c);
            const using = have && isUsing(career, c);
            return (
              <button key={c.id} onClick={() => tap(c)} disabled={!have} data-locker-card={c.id} className="kib-press relative flex flex-col items-center overflow-hidden text-left" style={{
                borderRadius: 3, background: "linear-gradient(180deg, rgba(255,255,255,.07), rgba(255,255,255,.02))",
                boxShadow: using ? "inset 0 0 0 2px #fde047, 0 0 14px rgba(253,224,71,.35)" : "inset 0 0 0 1px rgba(255,255,255,.12)",
              }}>
                <div className="grid h-[150px] w-full place-items-center" style={have ? undefined : { filter: "brightness(0) opacity(.55)" }}>
                  <RewardArt card={c} w={160} h={145} live={have} />
                </div>
                <div className="flex w-full items-center gap-1.5 px-2 pb-2 pt-1">
                  <span className="min-w-0 flex-1 truncate text-[13px] font-black uppercase tracking-wide">{have ? c.name : "???"}</span>
                  {have && !showsInGame(c) && <span className="shrink-0 bg-white/15 px-1 py-0.5 text-[9px] font-black uppercase tracking-wider" style={{ borderRadius: 2 }}>Soon</span>}
                </div>
                {using && <span className="absolute left-1.5 top-1.5 bg-amber-300 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-gray-950" style={{ borderRadius: 2 }}>In use</span>}
              </button>
            );
          })}
        </div>
      </div>
      <BottomBar cols="1fr">
        <BarButton icon={<Chev dir="left" size={16} className="text-amber-300" />} label="Back" onClick={onClose} />
      </BottomBar>
    </div>,
    document.body,
  );
}
