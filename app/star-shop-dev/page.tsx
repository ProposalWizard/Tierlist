"use client";

/**
 * THE MENU SHOP — the test page (RUL-UI-010, Harry 19 Nov 2026). The new menu
 * shop (components/star/shop/MenuShop.tsx) on a made-up career, so Harry can
 * look at it and try buying before it goes into the game (RUL-UI-002).
 * Nothing is saved: a reload starts the sample career again.
 *
 * The buy handlers below do the same sums as the game's own
 * (app/star-dev/page.tsx handleBuyKib / handleBuyBoot / handleBuyItem /
 * handleBuyFromBlackMarket / handleUseCan), minus the story's phone steps.
 * ?cat=cans|boots|drip|gadgets|cars|homes|holiday opens on that category.
 */
import { useEffect, useState } from "react";
import PageGuide from "@/components/admin/PageGuide";
import { BroadcastPage } from "@/components/admin/broadcast/BroadcastPage";
import { pitchFont } from "@/components/star/ui/pitchFont";
import "@/components/star/ui/pitchLook.css";
import "@/components/star/ui/flat.css";
import "@/components/star/ui/glassLook.css";
import MenuShop, { MENU_CATS, type MenuCat } from "@/components/star/shop/MenuShop";
import MainBar from "@/components/star/MainBar";
import { makeInitialCareer } from "@/lib/star/careerFlow";
import { LIFESTYLE_ALL_LEVELS, BOOTS_ALL_LEVELS, KIB_CANS, kibCanPrice, baseIdOf, type KibCan } from "@/lib/star/shopData";
import { blackMarketPrice, LAWYER_FEE, rollCaught, applyGettingCaught } from "@/lib/star/corruption";
import { freshItem, isWornOut } from "@/lib/star/fame";
import { mulberry32 } from "@/lib/star/season";
import type { CareerState, Boot, OwnedItem } from "@/lib/star/types";

const START_MONEY = 60_000;

function sampleCareer(): CareerState {
  const c = makeInitialCareer({
    firstName: "Sample", lastName: "Player", age: 18, skinTone: "light",
    club: "Barnet", clubBadge: null, position: "ST", nationality: "England", startYear: 2027,
  } as never, ["Barnet", "Yeovil Town"], "national_league");
  const item = (base: string, lv: number) => LIFESTYLE_ALL_LEVELS.find((i) => baseIdOf(i) === base && (i.level ?? 1) === lv);
  const owned = [item("phone", 1), item("car-1", 2), item("silver", 1)].filter(Boolean).map((i) => freshItem(i!));
  const curl = BOOTS_ALL_LEVELS.find((b) => baseIdOf(b) === "curl" && b.level === 2) ?? c.currentBoot;
  return { ...c, money: START_MONEY, kibCans: { basic: 2, premium: 0, elite: 0 }, ownedItems: owned, currentBoot: { ...curl }, energy: 72, unlocks: undefined } as CareerState;
}

export default function ShopTestPage() {
  const [career, setCareer] = useState<CareerState>(sampleCareer);
  const [startCat, setStartCat] = useState<MenuCat>("boots");
  const [say, setSay] = useState<string | null>(null);
  const [tools, setTools] = useState(false);
  const [n, setN] = useState(0);
  // ?cat= opens on that category (read after the first paint, so the server and the browser agree).
  // Drawn in the browser only (no server copy): the shop's pictures and the bars'
  // 3D icons then load after the page is live, as in the game.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("cat");
    const c = MENU_CATS.find((x) => x.id === q)?.id;
    if (c) setStartCat(c);
    setReady(true);
  }, []);

  // ── The game's buy sums (app/star-dev/page.tsx), on this sample career ──
  const buyKib = (can: KibCan) => setCareer((k) => {
    const price = kibCanPrice(can, k.contract.wage);
    if (k.money < price) return k;
    return { ...k, money: k.money - price, kibCans: { ...k.kibCans, [can.id]: k.kibCans[can.id] + 1 } };
  });
  const buyBoot = (boot: Boot) => setCareer((k) => {
    if (k.money < boot.price) return k;
    const stacking = k.currentBoot.id === boot.id;
    return { ...k, money: k.money - boot.price, currentBoot: stacking ? { ...boot, matches: k.currentBoot.matches + boot.matches } : { ...boot } };
  });
  const buyItem = (item: OwnedItem) => setCareer((k) => {
    const base = item.baseId ?? item.id;
    const owned = k.ownedItems.find((o) => (o.baseId ?? o.id) === base);
    const ownedLevel = owned ? (owned.level ?? LIFESTYLE_ALL_LEVELS.find((l) => l.id === owned.id)?.level ?? 0) : 0;
    if (k.money < item.price) return k;
    if (owned && !isWornOut(owned) && (item.level ?? 0) <= ownedLevel && ownedLevel > 0) return k;
    if (owned && !isWornOut(owned) && owned.id === item.id) return k;
    return {
      ...k, money: k.money - item.price,
      ownedItems: [...k.ownedItems.filter((o) => (o.baseId ?? o.id) !== base), freshItem(item)],
      happiness: Math.min(100, k.happiness + Math.floor(item.lifestyleValue / 3)),
    };
  });
  const buyBlack = (boot: Boot, useLawyers: boolean) => {
    const price = blackMarketPrice(boot.price) + (useLawyers ? LAWYER_FEE : 0);
    if (price > career.money) return { ok: false, reason: "Not enough money" };
    const stacking = career.currentBoot.id === boot.id;
    let next: CareerState = { ...career, money: career.money - price, currentBoot: stacking ? { ...boot, matches: career.currentBoot.matches + boot.matches } : { ...boot } };
    const rng = mulberry32(career.season * 33301 + career.week * 419 + boot.id.length);
    if (rollCaught("blackMarket", useLawyers, rng)) next = applyGettingCaught(next, "blackMarket", price, `Caught buying banned boots (${boot.name})`);
    setCareer(next);
    return { ok: true };
  };
  const useCan = (id: KibCan["id"]) => setCareer((k) => {
    if (k.kibCans[id] === 0) return k;
    const can = KIB_CANS.find((c) => c.id === id)!;
    if (can.effect && k.kibAbility?.[can.effect]) return k;
    if (!can.effect && k.energy >= 100) return k;
    return { ...k, kibCans: { ...k.kibCans, [id]: k.kibCans[id] - 1 }, ...(can.effect ? { kibAbility: { ...k.kibAbility, [can.effect]: true } } : {}), energy: Math.min(100, k.energy + can.restore) };
  });

  const bar = <MainBar activeNav={null} onNavigate={(t) => setSay(`In the game this opens ${t === "skills" ? "Training" : t === "media" ? "the Phone" : t === "play" ? "the next match" : "League"}.`)} onHome={() => setSay("In the game this goes Home.")} />;

  return (
    // The admin frame (scripts/admin-look-guard.mjs); the shop sits in a phone-sized box.
    // translateZ(0) keeps the shop's own fixed layers (sheet, bar) inside the box.
    <BroadcastPage title="Menu shop" sub="The new menu shop on a sample career: look and try buying. Nothing here reaches a career.">
    <div className={`select-none star-root ${pitchFont.variable} star-look-pitch star-skin-glass`}
      style={{ position: "relative", transform: "translateZ(0)", overflow: "hidden", width: "100%", maxWidth: 430, height: "min(844px, calc(100dvh - 150px))", minHeight: 560, margin: "0 auto", borderRadius: 18, ["--ms-h" as string]: "100%" } as React.CSSProperties}>
      {ready && <MenuShop key={n} career={career} startCat={startCat} mainBar={bar}
        onBack={() => setSay("In the game Back goes to where you came from.")}
        onSettings={() => setTools((t) => !t)}
        onBuyKib={buyKib} onBuyBoot={buyBoot} onBuyItem={buyItem} onBuyFromBlackMarket={buyBlack} onUseCan={useCan} />}
      {tools && (
        <div className="fixed left-1/2 top-[64px] z-[60] w-[260px] -translate-x-1/2 rounded-2xl bg-[#0d1426] p-3 text-white shadow-2xl ring-1 ring-white/20" data-test-tools>
          <div className="text-[12px] font-black uppercase tracking-wide text-white/70">Test page only</div>
          <button type="button" className="mt-2 w-full rounded-xl bg-white/10 py-2 text-[13px] font-black" onClick={() => setCareer((k) => ({ ...k, money: k.money + 50_000 }))}>+£50k money</button>
          <button type="button" className="mt-2 w-full rounded-xl bg-white/10 py-2 text-[13px] font-black" onClick={() => { setCareer(sampleCareer()); setN((x) => x + 1); setTools(false); }}>Start the sample again</button>
          <button type="button" className="mt-2 w-full rounded-xl py-1.5 text-[12px] font-bold text-white/60" onClick={() => setTools(false)}>Close</button>
        </div>
      )}
      {say && (
        <button type="button" onClick={() => setSay(null)} className="fixed bottom-[96px] left-1/2 z-[60] -translate-x-1/2 rounded-xl bg-black/85 px-3 py-2 text-[12px] font-bold text-white ring-1 ring-white/20">{say}</button>
      )}
    </div>
    <PageGuide page="/star-shop-dev" />
    </BroadcastPage>
  );
}
