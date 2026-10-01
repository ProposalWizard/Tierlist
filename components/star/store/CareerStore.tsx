"use client";

/**
 * THE STORE, IN THE CAREER (Harry, 28 Sep 2026: "add store aswell").
 *
 * The same screen as the test area (StoreView), fed by the career instead of
 * a test wallet. Every button runs lib/star/store/career.ts, which runs the
 * test area's own rules on a view of the save and writes the result back:
 * ★ is your money, a run-up you buy is yours in Settings → Run-ups and in the
 * match, a KIB can lands on the Home cans card, and a boot goes on your feet
 * the way the Boots shop does it.
 *
 * Coin packs never take money: in development they just add Coins (with the
 * "Test mode" banner), in the live game they read "Coming soon".
 */
import { useEffect, useState } from "react";
import type { CareerState } from "@/lib/star/types";
import StoreView from "./StoreView";
import { useClubTheme } from "../ui";
import { dateKeyFor } from "@/lib/star/store/daily";
import {
  careerStoreState, careerPriceContext, careerStoreBuy, careerStoreEquip, careerStoreUnequip,
  careerBuyCoinPack, careerConvertCoins, careerBootStatus, shownInCareer, coinPacksAreTestMode,
  ACCESSORIES_IN_MATCH_NOTE, type CareerStoreResult,
} from "@/lib/star/store/career";

export default function CareerStore({ career, onChange, onBack, hud }: {
  /** The top HUD (ui/TopHud.tsx): energy never leaves. */
  hud?: React.ReactNode;
  career: CareerState;
  /** The career after a purchase / equip. */
  onChange: (next: CareerState) => void;
  onBack: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const dateKey = dateKeyFor(now);
  const { glow } = useClubTheme(career);
  const run = (r: CareerStoreResult) => {
    if (r.ok) onChange(r.career);
    return { ok: r.ok, reason: r.reason };
  };

  return (
    <StoreView
      state={careerStoreState(career)}
      ctx={careerPriceContext(career)}
      dateKey={dateKey}
      now={now}
      glow={glow}
      back={{ onClick: onBack }}
      hud={hud}
      hide={(item) => !shownInCareer(item, career)}
      packs={coinPacksAreTestMode() ? "test" : "soon"}
      accessoriesNote={ACCESSORIES_IN_MATCH_NOTE}
      bootStatus={(id) => careerBootStatus(career, id)}
      onBuy={(id, cur) => run(careerStoreBuy(career, id, cur, dateKey))}
      onEquip={(id) => run(careerStoreEquip(career, id))}
      onUnequip={(slot) => onChange(careerStoreUnequip(career, slot))}
      onPack={(id) => (coinPacksAreTestMode() ? run(careerBuyCoinPack(career, id)) : { ok: false, reason: "Coming soon" })}
      onSwap={(c) => run(careerConvertCoins(career, c))}
    />
  );
}
