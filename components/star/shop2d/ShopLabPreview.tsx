"use client";

/**
 * The media lab's shop bench (/star-dev/media-lab?shop=kib|boots|lifestyle|landing
 * &look=new|old). A sample National League career with ★1,000,000, a few cans,
 * a phone and a car; buying works on this sample only (nothing is saved).
 */
import { useState } from "react";
import type { CareerState, Boot, OwnedItem } from "@/lib/star/types";
import { makeInitialCareer } from "@/lib/star/careerFlow";
import { LIFESTYLE_ALL_LEVELS, kibCanPrice, baseIdOf, type KibCan } from "@/lib/star/shopData";
import { blackMarketPrice, LAWYER_FEE } from "@/lib/star/corruption";
import Shop from "../Shop";
import ShopPage from "../ShopPage";
import StoreShop from "./StoreShop";
import StoreLanding from "./StoreLanding";
import type { StoreTab } from "./parts";

function sampleCareer(): CareerState {
  const c = makeInitialCareer({
    firstName: "Sample", lastName: "Player", age: 18, skinTone: "light",
    club: "Barnet", clubBadge: null, position: "ST", nationality: "England", startYear: 2027,
  } as never, ["Barnet", "Yeovil Town"], "national_league");
  const pick = (base: string, lv: number) => LIFESTYLE_ALL_LEVELS.find((i) => baseIdOf(i) === base && (i.level ?? 1) === lv) ?? LIFESTYLE_ALL_LEVELS.find((i) => baseIdOf(i) === base);
  const owned = [pick("phone", 1), pick("car-1", 2), pick("silver", 1)].filter(Boolean) as OwnedItem[];
  return { ...c, money: 1_000_000, kibCans: { basic: 3, premium: 1, elite: 0 }, ownedItems: owned, energy: 72, unlocks: undefined } as CareerState;
}

export default function ShopLabPreview({ kind, look, onBack }: { kind: StoreTab | "landing"; look: "new" | "old"; onBack: () => void }) {
  const [career, setCareer] = useState<CareerState>(sampleCareer);
  const [tab, setTab] = useState<StoreTab>(kind === "landing" ? "kib" : kind);
  const [page, setPage] = useState<"landing" | "shop">(kind === "landing" ? "landing" : "shop");
  const buyKib = (c: KibCan) => setCareer((k) => ({ ...k, money: k.money - kibCanPrice(c, k.contract.wage), kibCans: { ...k.kibCans, [c.id]: (k.kibCans[c.id] ?? 0) + 1 } }));
  const buyBoot = (b: Boot) => setCareer((k) => ({ ...k, money: k.money - b.price, currentBoot: { ...b } }));
  const buyItem = (it: OwnedItem) => setCareer((k) => ({ ...k, money: k.money - it.price, ownedItems: [...k.ownedItems.filter((o) => baseIdOf(o) !== baseIdOf(it)), { ...it }] }));
  const black = (b: Boot, lawyers: boolean) => {
    const price = blackMarketPrice(b.price) + (lawyers ? LAWYER_FEE : 0);
    if (career.money < price) return { ok: false, reason: "Not enough money" };
    setCareer((k) => ({ ...k, money: k.money - price, currentBoot: { ...b } }));
    return { ok: true };
  };
  const useCan = (id: KibCan["id"]) => setCareer((k) => ({ ...k, kibCans: { ...k.kibCans, [id]: Math.max(0, (k.kibCans[id] ?? 0) - 1) }, energy: Math.min(100, (k.energy ?? 0) + 30) }));
  const open = (ph: string) => {
    if (ph === "shop-kib") { setTab("kib"); setPage("shop"); }
    else if (ph === "shop-boots") { setTab("boots"); setPage("shop"); }
    else if (ph === "shop-lifestyle") { setTab("lifestyle"); setPage("shop"); }
  };

  if (page === "landing") {
    return (
      <div className="min-h-[100dvh] bg-[#070b16] px-4 pt-4 text-white">
        {look === "new" ? <StoreLanding career={career} onOpen={open as never} /> : <ShopPage career={career} onOpen={open as never} />}
      </div>
    );
  }
  const back = kind === "landing" ? () => setPage("landing") : onBack;
  return look === "new" ? (
    <StoreShop career={career} kind={tab} onKind={setTab} onBack={back} onHome={back}
      onBuyKib={buyKib} onBuyBoot={buyBoot} onBuyItem={buyItem} onBuyFromBlackMarket={black} onUseCan={useCan} onOpen3D={() => {}} />
  ) : (
    <Shop key={tab} career={career} kind={tab} onBack={back} onBuyKib={buyKib} onBuyBoot={buyBoot} onBuyItem={buyItem} onBuyFromBlackMarket={black} />
  );
}
