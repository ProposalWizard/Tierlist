/**
 * THE SHOP — the phone port of the website's showroom
 * (components/star/shop2d/ShowroomShop.tsx), in its look. Same categories in
 * the same order, the same items, levels, prices, fame, "lasts" and lock
 * rules, bought through the same rules (world/shop.ts, a port of page.tsx's
 * buy handlers).
 *
 * The look, as the website: the ◂ BACK pill, the 1 | 3 | 5 picker (items on
 * screen), ★money and 👑fame; the categories as Anton words with a bar under
 * the chosen one; each item a dark glass card with its product still (the
 * website's own renders: assets/look/shop, from public/star/shop2d/items);
 * the shop's own bar (Shop · For You · 3D · Boots · Sponsors) over the game's
 * bottom bar. Tap an item for its sheet: big picture, level pips, what it
 * gives, Buy. For You is every item, one per screen, mixed.
 * The 3D shop is not in this app (its button is greyed, as the website greys
 * it where there is no 3D shop).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Image, Modal, ScrollView, Text, View, type ImageSourcePropType, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Boot, CareerState, OwnedItem } from "@/lib/star/types";
import { KIB_CANS, kibCanPrice, kibCanEffectLabel, baseIdOf, type KibCan } from "@/lib/star/shopData";
import { hasBootDeal } from "@/lib/star/sponsorDeals";
import { ruleBookFor } from "@/lib/star/ruleBook";
import { blackMarketPrice, LAWYER_FEE } from "@/lib/star/corruption";
import { fameGainFromBuying, isWornOut, itemLifeSeasons, fameOf, fameLevel, nextFameLevel, ownedFame, OWNED_FAME_MAX } from "@/lib/star/fame";
import { nextUpIndex } from "@/lib/star/shopNextItem";
import { loadShopItemsView, saveShopItemsView } from "@/lib/star/shopItemsView";
import { weeksOfWallet } from "@/lib/star/economy";
import { HELP_TOURS, STORY_SHOP_TOUR } from "@/lib/star/tours";
import { hasSeen, isOpen } from "@/lib/star/unlocks";
import { isStory } from "@/lib/star/story";
import { styleGroupOf, levelName, familyName, fameFromOwned, fameText, type StyleGroup } from "@/lib/star/lifestyleLevels";
import { styleUnlockStar } from "@/lib/star/unlocks";
import { installWebStorage } from "../../match/webStorage";
import { SvgIcon, SHOP_BAR_ICON } from "../../world/SvgIcon";
import { markSeenKeys } from "../../world/help";
import { PointerTour, TourTarget } from "../../ui/tour";
import { SCREENS } from "../../areas/registry";
import { StoreSheet, PicBox, LevelLadder, GiveChips, SaveUp, GoldButton, GreyButton, ConfirmSheet, PurchaseMoment, weeksText, type Moment } from "./shopParts";
import { starsNow } from "@/lib/star/starPoints";
import { SHOP_TIERS } from "@/lib/star/economy";
import { formatMoney, formatWallet } from "@/lib/star/money";
import { useCareer, setCareer } from "../../game/store";
import { useNav } from "../../nav";
import { Press } from "../../ui/Press";
import { C } from "../../world/lookKit";
import { AntonTabs, BackPill, BottomBar, CAN, FONT, LookButton } from "../../ui/look";
import { SHOP_PIC, SHOP_PIC_3D } from "../../ui/look/worldPics";
import { shopPic3d } from "@/lib/star/shopPicsLook";
import { Note, rgba } from "../../world/ui";
import { buyKib, drinkCan, buyBoot, buyBlackMarket, buyItem, bootsForSale, ownedLevelOf, STYLE_BASES, BOOT_ORDER, type Bought } from "../../world/shop";

export type CatId = "cans" | "boots" | StyleGroup;
export const SHOP_CATS: { id: CatId; label: string; icon: string; accent: string }[] = [
  { id: "cans", label: "Cans", icon: "🥫", accent: "#fb923c" },
  { id: "boots", label: "Boots", icon: "👟", accent: "#34d399" },
  { id: "drip", label: "Drip", icon: "🧢", accent: "#fbbf24" },
  { id: "gadgets", label: "Gadgets", icon: "📱", accent: "#38bdf8" },
  { id: "cars", label: "Cars", icon: "🚗", accent: "#f87171" },
  { id: "homes", label: "Homes", icon: "🏠", accent: "#a3e635" },
  { id: "holiday", label: "Holiday", icon: "🏝️", accent: "#22d3ee" },
];
const CAN_TIER: Record<KibCan["id"], number> = { basic: 1, premium: 3, elite: 5 };
const rungName = (lv: number) => SHOP_TIERS[Math.max(1, Math.min(5, lv)) - 1]?.label ?? `Level ${lv}`;
/** Each level's colour (shop2d/parts.tsx TIER_COLOUR: bronze, sapphire, ruby, amethyst, gold). */
const TIER_COLOUR = ["#c08457", "#60a5fa", "#f87171", "#c084fc", "#fbbf24"] as const;
const tierColour = (lv: number) => TIER_COLOUR[Math.max(1, Math.min(5, lv)) - 1];

/** The keys (can id / boot base / style base) in each category, in shop order. */
const KEYS: Record<CatId, string[]> = (() => {
  const out = { cans: KIB_CANS.map((c) => c.id), boots: [] as string[] } as Record<CatId, string[]>;
  for (const g of ["drip", "gadgets", "cars", "homes", "holiday"] as StyleGroup[]) {
    out[g] = Array.from(STYLE_BASES.keys()).filter((b) => styleGroupOf(STYLE_BASES.get(b)![0]) === g);
  }
  return out;
})();

/** The item's still (ShowroomShop bigName): boot-<base>-L<n>, <base>-L<n>, phone-L1; a can's own photo. */
function picOf(cat: CatId, key: string, lv: number): ImageSourcePropType | null {
  if (cat === "cans") return CAN[key as KibCan["id"]] ?? null;
  // The website's New pictures first (shopPicsLook.ts, fixed New): stills of the 3D shop's models.
  const still = shopPic3d(cat === "boots" ? "boot" : "style", key, lv);
  if (still && SHOP_PIC_3D[still]) return SHOP_PIC_3D[still];
  const name = cat === "boots" ? `boot-${key}-L${lv}` : key === "phone" ? "phone-L1" : `${key}-L${lv}`;
  return SHOP_PIC[name] ?? null;
}

type ItemsView = 1 | 3 | 5;
type Tab = "shop" | "foryou" | "boots";

interface Confirm { title: string; sub: string; price: number; verb: string; note?: string; black?: Boot; run: (lawyers: boolean) => Bought;
  /** For the confirm sheet and the purchase moment (filled in by the screen). */
  cat?: CatId; key?: string; level?: number; word?: string; momentTitle?: string; fx?: string }

/** One item, worked out once for every way it is shown (list card, page, sheet). */
interface ItemView {
  cat: CatId; key: string; title: string; sub: string; level: number; levels: number; pic: ImageSourcePropType | null; icon: string;
  stats: { text: string; color: string }[]; badges: { text: string; color: string }[];
  button: { label: string; price?: number; disabled: boolean; run: () => void; danger?: boolean };
  extra: { label: string; disabled: boolean; run: () => void } | null;
  locked: number | null;
}

function itemView({ career, cat, k, boots, level, onAsk, onUse }: {
  career: CareerState; cat: CatId; k: string; boots: Boot[]; level?: number;
  onAsk: (c: Confirm) => void; onUse: (id: KibCan["id"]) => void;
}): ItemView {
  const stats: { text: string; color: string }[] = [];
  const badges: { text: string; color: string }[] = [];
  let title = ""; let sub = ""; let levels = 0; let lv = 1;
  let button: { label: string; price?: number; disabled: boolean; run: () => void; danger?: boolean };
  let extra: { label: string; disabled: boolean; run: () => void } | null = null;
  let locked: number | null = null;

  if (cat === "cans") {
    const c = KIB_CANS.find((x) => x.id === k)!;
    const price = kibCanPrice(c, career.contract.wage);
    const have = career.kibCans[c.id] ?? 0;
    const waiting = !!c.effect && !!career.kibAbility?.[c.effect];
    title = c.name.replace(" KIB Can", ""); sub = "KIB Can"; lv = CAN_TIER[c.id];
    if (c.restore > 0) stats.push({ text: `+${c.restore}⚡ energy`, color: "#fdba74" });
    if (c.effect === "curve") stats.push({ text: "Curve next match", color: "#7dd3fc" });
    if (c.effect === "extraTouch") stats.push({ text: "Touch Mode next match", color: "#f0abfc" });
    stats.push({ text: `Energy ${Math.round(career.energy ?? 0)}/100`, color: C.dim });
    badges.push({ text: `×${have} owned`, color: "#60a5fa" });
    if (waiting) badges.push({ text: "Ready next match", color: C.gold });
    button = { label: career.money >= price ? "Buy" : "Not enough", price, disabled: career.money < price,
      run: () => onAsk({ title: c.name, sub: kibCanEffectLabel(c), price, verb: "Buy", run: () => buyKib(career, c),
        cat, key: k, level: CAN_TIER[c.id], word: "+1 Can!", momentTitle: `${c.name} — ${kibCanEffectLabel(c)}`, fx: c.id === "basic" ? "fx-energy" : c.id === "premium" ? "fx-curve" : "fx-touch" }) };
    extra = { label: waiting ? "Ready" : "Use one", disabled: have === 0 || waiting || (!c.effect && (career.energy ?? 0) >= 100), run: () => onUse(c.id) };
  } else if (cat === "boots") {
    const list = boots.filter((b) => baseIdOf(b) === k).sort((a, b) => (a.level ?? 0) - (b.level ?? 0));
    const cur = career.currentBoot;
    const wearing = baseIdOf(cur);
    const mineLv = wearing === k ? cur.level ?? 1 : 0;
    const def = wearing === k ? (cur.matches > 0 ? Math.min(list.length, mineLv + 1) : mineLv) : 1;
    lv = level ?? def; levels = list.length;
    const b = list.find((x) => x.level === lv) ?? list[0];
    const banned = new Set(ruleBookFor(career, "FA").bannedItems).has(k);
    title = b.name; sub = `Level ${lv} · ${rungName(lv)}`;
    if (wearing === k) badges.push({ text: cur.matches > 0 ? `Equipped L${mineLv} · ${cur.matches} left` : `Worn out L${mineLv}`, color: C.green });
    if (banned) badges.push({ text: "Banned", color: C.red });
    if (hasBootDeal(career)) badges.push({ text: "Sponsor −25%", color: C.gold });
    stats.push({ text: `+${b.power} Power`, color: "#6ee7b7" }, { text: `+${b.technique} Tech`, color: "#6ee7b7" }, { text: `${b.matches} matches`, color: "#fde68a" });
    if (b.curve) stats.push({ text: "CURVE", color: "#7dd3fc" });
    if (b.extraTouch) stats.push({ text: "TOUCH", color: "#f0abfc" });
    const upgrade = wearing === k && lv > mineLv;
    const ask = (black: boolean): Confirm => ({
      title: `${b.name} L${lv}`, sub: `+${b.power} power · +${b.technique} technique · ${b.matches} matches`,
      price: black ? blackMarketPrice(b.price) : b.price, verb: "Buy", note: "You put them on straight away.", black: black ? b : undefined,
      run: (lawyers) => (black ? buyBlackMarket(career, b, lawyers) : buyBoot(career, b)),
      cat, key: k, level: lv, word: "Equipped!", momentTitle: `${b.name} L${lv} — ${b.matches} matches`, fx: b.extraTouch ? "fx-touch" : b.curve ? "fx-curve" : "fx-power",
    });
    button = banned
      ? { label: "Black market", price: blackMarketPrice(b.price), disabled: false, danger: true, run: () => onAsk(ask(true)) }
      : { label: career.money >= b.price ? (upgrade ? "Upgrade" : "Buy") : "Not enough", price: b.price, disabled: career.money < b.price, run: () => onAsk(ask(false)) };
  } else {
    const list = STYLE_BASES.get(k)!;
    const mine = career.ownedItems.find((o) => baseIdOf(o) === k);
    const worn = !!mine && isWornOut(mine);
    const ownLv = mine ? ownedLevelOf(career, k) : 0;
    const yours = !!mine && !worn;
    levels = list.length;
    const def = yours ? Math.min(list.length, ownLv + (ownLv < list.length ? 1 : 0)) : 1;
    lv = list.length === 1 ? 1 : (level ?? def);
    const it: OwnedItem = list.find((l) => l.level === lv) ?? list[0];
    if (career.unlocks) {
      const need = styleUnlockStar(k);
      locked = starsNow(career) >= need ? null : need;
    }
    const blocked = yours && lv <= ownLv;
    const single = list.length === 1;
    const verb = yours ? "Upgrade" : worn && single ? "Repair" : worn ? "Replace" : "Buy";
    const life = itemLifeSeasons(it);
    title = levelName(it); sub = single ? familyName(it) : `${familyName(it)} · L${lv} ${rungName(lv)}`;
    if (yours) badges.push({ text: `Owned${single ? "" : ` L${ownLv}`}`, color: C.green });
    if (worn) badges.push({ text: "Worn out", color: C.red });
    if (yours) badges.push({ text: `${fameText(fameFromOwned(career.ownedItems, mine!))} fame now`, color: C.gold });
    stats.push({ text: `${fameText(fameGainFromBuying(career.ownedItems, it))} fame`, color: "#fcd34d" },
      { text: life === null ? "Lasts forever" : `Lasts ${life} season${life === 1 ? "" : "s"}`, color: C.dim });
    button = locked !== null ? { label: `🔒 Reach ★${locked}`, disabled: true, run: () => {} }
      : blocked ? { label: ownLv === lv ? "You own this one" : `You own level ${ownLv}`, disabled: true, run: () => {} }
      : { label: career.money >= it.price ? verb : "Not enough", price: it.price, disabled: career.money < it.price,
        run: () => onAsk({ title: levelName(it), sub: `${familyName(it)} · ${fameText(fameGainFromBuying(career.ownedItems, it))} fame`, price: it.price, verb,
          note: mine && !worn ? `Replaces your ${levelName(mine)}.` : undefined, run: () => buyItem(career, it),
            cat, key: k, level: lv, word: verb === "Upgrade" ? "Upgraded!" : verb === "Repair" ? "Repaired!" : "Yours!", momentTitle: levelName(it) }) };
  }

  return { cat, key: k, title, sub, level: lv, levels, pic: picOf(cat, k, lv), icon: SHOP_CATS.find((c) => c.id === cat)!.icon, stats, badges, button, extra, locked };
}

/** The item's still in its lit box (or its icon if there is no still). */
function Pic({ v, size, grey }: { v: ItemView; size: number; grey?: boolean }) {
  return v.pic
    ? <Image source={v.pic} resizeMode="contain" fadeDuration={0} style={{ width: "100%", height: "100%", opacity: grey ? 0.35 : 1 }} />
    : <Text style={{ fontSize: size * 0.45, opacity: grey ? 0.35 : 1 }}>{v.icon}</Text>;
}

/** 5 items: one card per row (ShowroomShop ListCard): picture, name, price. Tap to open. */
function ListCard({ v, accent, on, next, own, onTap }: { v: ItemView; accent: string; on: boolean; next: boolean; own: string | null; onTap: () => void }) {
  const locked = v.locked !== null;
  const tier = v.levels > 1 ? tierColour(v.level) : accent;
  return (
    <Press onPress={onTap} style={[{ height: 126, flexDirection: "row", gap: 12, padding: 8, borderRadius: 16, opacity: locked ? 0.6 : 1,
      backgroundImage: "linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.03))" } as ViewStyle,
      { boxShadow: on ? `inset 0px 0px 0px 2px ${accent}, 0px 8px 24px -12px ${accent}` : "inset 0px 0px 0px 1px rgba(255,255,255,0.1)" } as ViewStyle]}>
      <View style={{ width: 132, borderRadius: 12, overflow: "hidden", alignItems: "center", justifyContent: "center", padding: v.cat === "cans" ? 16 : 6,
        backgroundImage: `radial-gradient(70% 65% at 50% 45%, rgba(255,255,255,0.14), rgba(255,255,255,0) 70%), radial-gradient(90% 70% at 50% 55%, ${rgba(tier, 0.18)}, rgba(0,0,0,0) 75%), linear-gradient(180deg, #0a1120, #0a1120)` } as ViewStyle}>
        <Pic v={v} size={110} grey={locked} />
        {locked && <Text style={{ position: "absolute", fontSize: 30 }}>🔒</Text>}
      </View>
      <View style={{ flex: 1, minWidth: 0, justifyContent: "center", gap: 3 }}>
        {next || own ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            {next ? <Text style={{ color: "#05080f", backgroundColor: accent, fontSize: 9.5, lineHeight: 13, fontWeight: "900", letterSpacing: 0.3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: "hidden", textTransform: "uppercase" }}>Next up</Text> : null}
            {own ? <Text style={{ color: "#a7f3d0", backgroundColor: "rgba(6,95,70,0.9)", fontSize: 9.5, lineHeight: 13, fontWeight: "900", letterSpacing: 0.3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: "hidden", textTransform: "uppercase" }}>{own}</Text> : null}
          </View>
        ) : null}
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ color: "#fff", fontFamily: FONT.display, fontSize: 19, lineHeight: 24 }}>{v.title}</Text>
        <Text numberOfLines={1} style={{ color: "rgba(255,255,255,0.7)", fontSize: 11.5, fontWeight: "700" }}>{v.sub}</Text>
        {locked ? (
          <Text style={{ color: "#fcd34d", fontSize: 12, fontWeight: "900", letterSpacing: 0.6 }}>HIGHER STAR RATING</Text>
        ) : (
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
            <Text style={{ color: v.button.disabled ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.85)", fontSize: 11.5, fontWeight: "900", textTransform: "uppercase" }}>{v.button.label}</Text>
            {v.button.price !== undefined && <Text style={{ color: v.button.disabled ? "rgba(255,255,255,0.45)" : "#fcd34d", fontSize: 16, fontWeight: "900" }}>★{formatMoney(v.button.price)}</Text>}
          </View>
        )}
      </View>
    </Press>
  );
}

/**
 * 1 or 3 items: a page per item that you swipe (ShowroomShop ItemPage /
 * SideSlide). The item stands big in a soft cone of light over its shadow;
 * with 3, the ones either side peek in small and faded. Under it: the
 * category and where you are (CANS · 1/3), the next category, the name in
 * Anton, what it gives, Use one and Buy.
 */
function Pages({ items, width, horizontal, narrow, accentOf, view, onOpen, nextCat, startAt = 0 }: {
  items: { cat: CatId; key: string }[]; width: number; horizontal: boolean; narrow?: boolean;
  accentOf: (c: CatId) => string; view: (c: CatId, k: string) => ItemView; onOpen: (c: CatId, k: string) => void; nextCat?: string; startAt?: number;
}) {
  const [h, setH] = useState(0);
  const [at, setAt] = useState(startAt);
  const step = horizontal ? width : h;
  return (
    <View style={{ flex: 1 }} onLayout={(e) => setH(e.nativeEvent.layout.height)}>
      {h > 0 && (
        <FlatList
          data={items}
          horizontal={horizontal}
          keyExtractor={(it) => `${it.cat}-${it.key}`}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          pagingEnabled
          initialScrollIndex={startAt > 0 && startAt < items.length ? startAt : undefined}
          onMomentumScrollEnd={(e) => setAt(Math.round((horizontal ? e.nativeEvent.contentOffset.x : e.nativeEvent.contentOffset.y) / Math.max(1, step)))}
          getItemLayout={(_, i) => ({ length: step, offset: step * i, index: i })}
          renderItem={({ item, index }) => {
            const prev = narrow && items[index - 1] ? view(items[index - 1].cat, items[index - 1].key) : null;
            const next = narrow && items[index + 1] ? view(items[index + 1].cat, items[index + 1].key) : null;
            return <Page v={view(item.cat, item.key)} accent={accentOf(item.cat)} w={width} h={h} prev={prev} next={next}
              pos={`${index + 1}/${items.length}`} nextCat={horizontal ? nextCat : undefined} onOpen={() => onOpen(item.cat, item.key)} />;
          }}
        />
      )}
      {/* the dots: where you are in this category */}
      {horizontal && items.length > 1 && (
        <View pointerEvents="none" style={{ position: "absolute", top: 0, alignSelf: "center", flexDirection: "row", gap: 8, height: 14, alignItems: "center" }}>
          {items.map((_, i) => <View key={i} style={{ width: i === at ? 16 : 6, height: 5, borderRadius: 3, backgroundColor: i === at ? accentOf(items[0].cat) : "rgba(255,255,255,0.4)" }} />)}
        </View>
      )}
    </View>
  );
}

function Page({ v, accent, w, h, prev, next, pos, nextCat, onOpen }: { v: ItemView; accent: string; w: number; h: number; prev: ItemView | null; next: ItemView | null; pos: string; nextCat?: string; onOpen: () => void }) {
  const infoH = 168;
  const picH = Math.max(140, h - infoH - 20);
  const big = Math.min(picH * 0.72, w * 0.62);
  const side = (o: ItemView, d: -1 | 1) => (
    <View pointerEvents="none" style={{ position: "absolute", top: 20 + picH * 0.3, [d < 0 ? "left" : "right"]: -w * 0.06, width: w * 0.3, height: picH * 0.42, opacity: 0.4, alignItems: "center" }}>
      <View style={{ flex: 1, width: "100%", alignItems: "center", justifyContent: "center" }}><Pic v={o} size={picH * 0.42} /></View>
      <Text numberOfLines={1} style={{ color: "rgba(255,255,255,0.9)", fontSize: 11, fontWeight: "900", letterSpacing: 0.6, textTransform: "uppercase" }}>{o.title}</Text>
    </View>
  );
  return (
    <View style={{ width: w, height: h }}>
      <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundImage: `radial-gradient(52% 34% at 50% 40%, rgba(255,255,255,0.16), rgba(255,255,255,0) 70%), radial-gradient(80% 46% at 50% 44%, ${rgba(accent, 0.18)}, rgba(0,0,0,0) 72%)` } as ViewStyle} />
      {prev && side(prev, -1)}
      {next && side(next, 1)}
      <Press onPress={v.locked === null ? onOpen : undefined} style={{ marginTop: 20, height: picH, alignItems: "center", justifyContent: "center" }}>
        <View pointerEvents="none" style={{ position: "absolute", bottom: "10%", width: "74%", height: 40, borderRadius: 999, backgroundImage: "radial-gradient(closest-side, rgba(0,0,0,0.75), rgba(0,0,0,0))" } as ViewStyle} />
        <View style={{ width: big, height: big * 1.05, alignItems: "center", justifyContent: "center" }}><Pic v={v} size={big} grey={v.locked !== null} /></View>
        {v.locked !== null && <Text style={{ position: "absolute", fontSize: 48 }}>🔒</Text>}
      </Press>
      {v.badges.length > 0 && (
        <View pointerEvents="none" style={{ position: "absolute", left: 12, top: 22, flexDirection: "row", flexWrap: "wrap", gap: 4, maxWidth: "70%" }}>
          {v.badges.map((b) => <Text key={b.text} style={{ color: "#fff", backgroundColor: rgba(b.color.startsWith("#") ? b.color : "#60a5fa", 0.45), borderWidth: 1, borderColor: rgba(b.color.startsWith("#") ? b.color : "#60a5fa", 0.9), fontSize: 10, fontWeight: "900", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, overflow: "hidden", textTransform: "uppercase" }}>{b.text}</Text>)}
        </View>
      )}
      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: infoH, paddingHorizontal: 16, paddingTop: 10, backgroundImage: "linear-gradient(0deg, #05080f 0%, rgba(5,8,15,0.9) 60%, rgba(5,8,15,0) 100%)" } as ViewStyle}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ color: accent, fontSize: 11, fontWeight: "900", letterSpacing: 1.8 }}>{SHOP_CATS.find((c) => c.id === v.cat)!.label.toUpperCase()} · {pos}</Text>
          {nextCat ? <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 11, fontWeight: "900", letterSpacing: 1.8 }}>⌃ {nextCat.toUpperCase()}</Text> : null}
        </View>
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ color: "#fff", fontFamily: FONT.display, fontSize: 26, lineHeight: 32 }}>{v.title}</Text>
        <Text numberOfLines={1} style={{ color: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: "700" }}>{v.sub}</Text>
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, marginTop: 6 }}>
          <View style={{ flex: 1, flexDirection: "row", flexWrap: "wrap", columnGap: 10 }}>
            {v.stats.map((st) => <Text key={st.text} style={{ color: st.color, fontSize: 13, fontWeight: "900" }}>{st.text}</Text>)}
          </View>
          {v.locked === null ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              {v.extra && (
                <Press disabled={v.extra.disabled} onPress={v.extra.run} style={{ height: 40, paddingHorizontal: 12, borderRadius: 999, justifyContent: "center", backgroundColor: "rgba(0,0,0,0.4)", borderWidth: 1, borderColor: "rgba(255,255,255,0.3)", opacity: v.extra.disabled ? 0.35 : 1 }}>
                  <Text style={{ color: "#fff", fontSize: 12, fontWeight: "900", textTransform: "uppercase" }}>{v.extra.label}</Text>
                </Press>
              )}
              <BuyPill b={v.button} />
            </View>
          ) : <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 11, fontWeight: "900", letterSpacing: 0.8 }}>🔒 HIGHER STAR RATING</Text>}
        </View>
      </View>
    </View>
  );
}

/** Buy, sized like a native app button: a red pill, the price in a darker capsule (ShowroomShop BuyPill A). */
function BuyPill({ b }: { b: ItemView["button"] }) {
  const off = b.disabled;
  const bg = off ? "rgba(255,255,255,0.12)" : b.danger ? "#dc2626" : "#f87171";
  const ink = off ? "rgba(255,255,255,0.7)" : b.danger ? "#fff" : "#0b1222";
  return (
    <Press disabled={off} onPress={b.run} style={{ height: 44, maxWidth: 210, flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 18, paddingRight: 6, borderRadius: 999, backgroundColor: bg,
      boxShadow: off ? "inset 0px 0px 0px 1px rgba(255,255,255,0.2)" : `0px 6px 16px -6px ${b.danger ? "#dc2626" : "#f87171"}, inset 0px 1px 0px rgba(255,255,255,0.35)` } as ViewStyle}>
      <Text numberOfLines={1} style={{ color: ink, fontSize: 14, fontWeight: "800", flexShrink: 1 }}>{b.label}</Text>
      {b.price !== undefined ? (
        <View style={{ height: 32, paddingHorizontal: 10, borderRadius: 999, justifyContent: "center", backgroundColor: off ? "transparent" : "rgba(0,0,0,0.16)" }}>
          <Text style={{ color: ink, fontSize: 15, fontWeight: "900" }}>★{formatMoney(b.price)}</Text>
        </View>
      ) : <View style={{ width: 12 }} />}
    </Press>
  );
}

/** What the phone opens: the apps you get, one line each (StyleShop.tsx PhoneOpens). */
const PHONE_APPS: { icon: string; name: string; what: string; bg: [string, string] }[] = [
  { icon: "💬", name: "Social", what: "Fans and the press react to you", bg: ["#34d399", "#047857"] },
  { icon: "💌", name: "Messages", what: "Your boss, agent and family", bg: ["#f472b6", "#e11d48"] },
  { icon: "🛒", name: "App Store", what: "More apps as you go up", bg: ["#60a5fa", "#1d4ed8"] },
];
function PhoneOpens() {
  return (
    <View style={{ marginTop: 8, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", padding: 8 }}>
      <Text style={{ marginBottom: 6, color: "#f0abfc", fontSize: 10, fontWeight: "900", letterSpacing: 1.6 }}>WHAT YOU GET</Text>
      <View style={{ flexDirection: "row", gap: 6 }}>
        {PHONE_APPS.map((a) => (
          <View key={a.name} style={{ flex: 1, alignItems: "center" }}>
            <View style={{ width: 44, height: 44, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundImage: `linear-gradient(160deg, ${a.bg[0]}, ${a.bg[1]})` } as ViewStyle}><Text style={{ fontSize: 22 }}>{a.icon}</Text></View>
            <Text style={{ marginTop: 4, color: "#fff", fontSize: 11, lineHeight: 14, fontWeight: "900" }}>{a.name}</Text>
            <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 9.5, lineHeight: 12, fontWeight: "700", textAlign: "center" }}>{a.what}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * The item's sheet (ShowroomShop DetailSheet): the picture in its lit box, the name, the
 * trophy level ladder with prices, three "what it gives" tiles, the save-up box when you
 * can't pay yet, and one full-width button. A can: its effect in big words, three tiles,
 * the wage note, Use one and Buy.
 */
function DetailSheet({ v, career, boots, onLevel, onClose }: { v: ItemView; career: CareerState; boots: Boot[]; onLevel: (lv: number) => void; onClose: () => void }) {
  const pic = <Pic v={v} size={220} grey={v.locked !== null} />;
  if (v.cat === "cans") {
    const c = KIB_CANS.find((x) => x.id === v.key)!;
    const price = kibCanPrice(c, career.contract.wage);
    const have = career.kibCans[c.id] ?? 0;
    return (
      <StoreSheet open onClose={onClose} title={c.name} accent="#fb923c">
        <PicBox lv={CAN_TIER[c.id]}><View style={{ height: "88%", aspectRatio: 0.55 }}>{pic}</View></PicBox>
        <Text style={{ marginTop: 8, color: "#fff", fontFamily: FONT.display, fontSize: 20, lineHeight: 26, textAlign: "center" }}>{kibCanEffectLabel(c)}</Text>
        <View style={{ marginTop: 8 }}><GiveChips items={[
          { label: "You have", value: `×${have}`, color: "#93c5fd" },
          { label: c.effect ? "For" : "Energy", value: c.effect ? "Next match" : `+${c.restore}`, color: "#fdba74" },
          { label: "Energy now", value: `${Math.round(career.energy ?? 0)}`, color: "#ffffff" },
        ]} /></View>
        <Text style={{ marginTop: 8, color: "rgba(255,255,255,0.8)", fontSize: 11, lineHeight: 15, fontWeight: "700" }}>Cans cost a slice of your weekly wage, so they stay worth something as you go up.</Text>
        <View style={{ marginTop: 12, flexDirection: "row", gap: 8 }}>
          <GreyButton style={{ flex: 1 }} disabled={!v.extra || v.extra.disabled} label={v.extra?.label ?? "Use one"} onPress={() => v.extra?.run()} />
          <GoldButton style={{ flex: 1.6 }} disabled={career.money < price} label={career.money < price ? "Not enough" : `Buy ★${formatMoney(price)}`} onPress={v.button.run} />
        </View>
      </StoreSheet>
    );
  }
  if (v.cat === "boots") {
    const levels = boots.filter((b) => baseIdOf(b) === v.key).sort((a, b) => (a.level ?? 0) - (b.level ?? 0));
    const b = levels.find((x) => x.level === v.level) ?? levels[0];
    const lv = b.level ?? 1;
    const cur = career.currentBoot;
    const wearing = baseIdOf(cur);
    const mineLv = wearing === v.key ? cur.level ?? 0 : 0;
    const mineB = levels.find((x) => x.level === mineLv);
    const banned = !!v.button.danger;
    const can = career.money >= b.price;
    return (
      <StoreSheet open onClose={onClose} title={b.name} accent={tierColour(lv)}>
        <PicBox lv={lv}>{pic}</PicBox>
        <View style={{ marginTop: 4, alignItems: "center" }}>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ color: "#fff", fontFamily: FONT.display, fontSize: 22, lineHeight: 28 }}>{b.name} <Text style={{ color: tierColour(lv) }}>L{lv}</Text></Text>
          <Text style={{ color: "rgba(255,255,255,0.65)", fontSize: 11, lineHeight: 15, fontWeight: "900", letterSpacing: 2, textTransform: "uppercase" }}>{rungName(lv)} level{banned ? " · banned by the FA" : ""}</Text>
        </View>
        <LevelLadder selected={lv} onPick={onLevel} rungs={levels.map((x) => ({ level: x.level ?? 1, price: x.price, owned: wearing === v.key && (x.level ?? 0) === mineLv }))} />
        <View style={{ marginTop: 8 }}><GiveChips items={[
          { label: "Power", value: `+${b.power}`, delta: mineB && b.power > mineB.power ? `▲ ${b.power - mineB.power} on yours` : undefined, color: "#6ee7b7" },
          { label: "Technique", value: `+${b.technique}`, delta: mineB && b.technique > mineB.technique ? `▲ ${b.technique - mineB.technique} on yours` : undefined, color: "#6ee7b7" },
          { label: "Matches", value: `${b.matches}`, color: "#fde68a" },
        ]} /></View>
        {b.curve ? <View style={{ marginTop: 8, borderRadius: 4, backgroundColor: "rgba(14,165,233,0.15)", borderWidth: 1, borderColor: "rgba(56,189,248,0.4)", padding: 8 }}><Text style={{ color: "#e0f2fe", fontSize: 11.5, lineHeight: 16, fontWeight: "700" }}>Swipe while a shot is in the air to bend, lift or dip it.</Text></View> : null}
        {b.extraTouch ? <View style={{ marginTop: 8, borderRadius: 4, backgroundColor: "rgba(217,70,239,0.15)", borderWidth: 1, borderColor: "rgba(232,121,249,0.4)", padding: 8 }}><Text style={{ color: "#fae8ff", fontSize: 11.5, lineHeight: 16, fontWeight: "700" }}>Touch Mode: after you strike it, chase it down for a second touch.</Text></View> : null}
        <Text style={{ marginTop: 8, paddingHorizontal: 2, color: "rgba(255,255,255,0.75)", fontSize: 10.5, lineHeight: 15, fontWeight: "700" }}>{weeksText(weeksOfWallet(b.price / b.matches, career.contract.wage))} of income per match</Text>
        <View style={{ marginTop: 8 }}>
          {banned ? <GoldButton danger label={`Buy from shady guys ★${formatMoney(blackMarketPrice(b.price))}`} onPress={v.button.run} />
            : <GoldButton disabled={!can} label={can ? `Buy now ★${formatMoney(b.price)}` : "Not enough money"} onPress={v.button.run} />}
        </View>
      </StoreSheet>
    );
  }
  const levels = STYLE_BASES.get(v.key)!;
  const it = levels.find((l) => l.level === v.level) ?? levels[0];
  const owned = career.ownedItems;
  const mine = owned.find((o) => baseIdOf(o) === v.key);
  const worn = !!mine && isWornOut(mine);
  const ownLv = mine ? ownedLevelOf(career, v.key) : 0;
  const blocked = !!mine && !worn && (it.level ?? 0) <= ownLv;
  const gain = fameGainFromBuying(owned, it);
  const nowFame = mine && !worn ? fameFromOwned(owned, mine) : 0;
  const life = itemLifeSeasons(it);
  const lv = it.level ?? 1;
  const b = v.button;
  return (
    <StoreSheet open onClose={onClose} title={familyName(it)} accent={tierColour(lv)}>
      <PicBox lv={lv}>{pic}</PicBox>
      <View style={{ marginTop: 4, alignItems: "center" }}>
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ color: "#fff", fontFamily: FONT.display, fontSize: 21, lineHeight: 27 }}>{levelName(it)}</Text>
        {levels.length > 1 ? <Text style={{ color: tierColour(lv), fontSize: 11, lineHeight: 15, fontWeight: "900", letterSpacing: 2, textTransform: "uppercase" }}>Level {lv} · {rungName(lv)}</Text> : null}
      </View>
      {v.key === "phone" ? <PhoneOpens /> : null}
      {levels.length > 1 ? <LevelLadder selected={lv} onPick={onLevel} rungs={levels.map((l) => ({ level: l.level ?? 1, price: l.price, owned: !!mine && !worn && (l.level ?? 0) === ownLv }))} /> : null}
      <View style={{ marginTop: 8 }}><GiveChips items={[
        { label: mine && !worn ? `fame (now ${fameText(nowFame)})` : "Fame", value: fameText(gain), color: "#fcd34d" },
        { label: "Lasts", value: life === null ? "Forever" : `${life} season${life === 1 ? "" : "s"}`, color: "#ffffff" },
        { label: "Of income", value: weeksText(weeksOfWallet(it.price, career.contract.wage)), color: "#93c5fd" },
      ]} /></View>
      {v.locked === null && !blocked && career.money < it.price ? <SaveUp have={career.money} need={it.price} wage={career.contract.wage} /> : null}
      <View style={{ marginTop: 8 }}>
        <GoldButton disabled={b.disabled} onPress={b.run}
          label={v.locked !== null ? `🔒 Higher star rating · reach ★${v.locked}` : blocked ? b.label : career.money < it.price ? "Not enough money" : `${b.label} ★${formatMoney(it.price)}`} />
      </View>
    </StoreSheet>
  );
}

/** A short line under the name, like a video's description: never the exact price (ForYouFeed.tsx FLAVOUR). */
const FLAVOUR: Record<CatId, string[]> = {
  cans: ["One can, one big week.", "For the days the legs say no.", "Crack it open before kick-off."],
  boots: ["Laced up and ready.", "Feel every touch.", "New boots, new season."],
  drip: ["Walk in like you own the place.", "The tunnel is a catwalk.", "Dressed for the cameras."],
  gadgets: ["Plugged in between matches.", "Your downtime, upgraded.", "Everyone in the dressing room wants one."],
  cars: ["Turn heads at the training ground.", "The car park will notice.", "Arrive in style."],
  homes: ["Somewhere to call home.", "Room for the trophies.", "The neighbours will talk."],
  holiday: ["Summer break, sorted.", "Switch off between seasons.", "Somewhere far from the press."],
};
const pickLine = (list: string[], key: string) => list[key.split("").reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7) % list.length];

function RoundButton({ icon, label, onPress, disabled, gold, on }: { icon: string; label: string; onPress?: () => void; disabled?: boolean; gold?: boolean; on?: boolean }) {
  return (
    <Press onPress={onPress} disabled={disabled || !onPress} style={{ width: 52, alignItems: "center", gap: 3 }}>
      <View style={[{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" }, gold
        ? ({ backgroundImage: "linear-gradient(180deg,#fde68a,#f59e0b 55%,#d97706)", boxShadow: "0px 4px 14px -4px rgba(245,158,11,0.9)" } as ViewStyle)
        : { backgroundColor: "rgba(0,0,0,0.35)" }]}>
        <Text style={{ color: gold ? "#1c1203" : on ? "#fb7185" : "#fff", fontSize: 17, lineHeight: 21, fontWeight: "900" }}>{icon}</Text>
      </View>
      <Text numberOfLines={1} style={{ color: "rgba(255,255,255,0.9)", fontSize: 10, lineHeight: 13, fontWeight: "700", textShadowColor: "rgba(0,0,0,0.9)", textShadowRadius: 4 }}>{label}</Text>
    </Press>
  );
}

/**
 * FOR YOU (ForYouFeed.tsx): the shop as a short-video feed. One item fills the screen; swipe
 * up and down through every item, locked ones too. A caption bottom-left (name, a short line,
 * tags; never the price) and round buttons bottom-right: Like, Info, See all, Buy / Save up.
 */
function ForYou({ items, width, view, own, stars, onDetails, onSeeAll }: {
  items: { cat: CatId; key: string }[]; width: number; view: (c: CatId, k: string) => ItemView; own: (c: CatId, k: string) => string | null; stars: number;
  onDetails: (c: CatId, k: string) => void; onSeeAll: (c: CatId, k: string) => void;
}) {
  const [h, setH] = useState(0);
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  return (
    <View style={{ flex: 1 }} onLayout={(e) => setH(e.nativeEvent.layout.height)}>
      {h > 0 && (
        <FlatList data={items} keyExtractor={(it) => `${it.cat}-${it.key}`} pagingEnabled showsVerticalScrollIndicator={false}
          getItemLayout={(_, i) => ({ length: h, offset: h * i, index: i })} initialNumToRender={2} windowSize={3}
          renderItem={({ item }) => {
            const v = view(item.cat, item.key);
            const cat = SHOP_CATS.find((c) => c.id === item.cat)!;
            const locked = v.locked !== null;
            const id = `${item.cat}-${item.key}`;
            const o = own(item.cat, item.key);
            const line = locked ? `Opens at ${v.locked}★. You're on ${stars}★ — keep playing.` : pickLine(FLAVOUR[item.cat], item.key);
            const tags = [`#${cat.label.toLowerCase()}`, ...(v.levels > 1 ? [`#level${v.level}`] : []), "#knowitball"];
            return (
              <View style={{ width, height: h }}>
                <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundImage: `radial-gradient(60% 36% at 50% 40%, rgba(255,255,255,0.15), rgba(255,255,255,0) 70%), radial-gradient(90% 55% at 50% 44%, ${rgba(cat.accent, 0.2)}, rgba(0,0,0,0) 72%)` } as ViewStyle} />
                <Press onPress={locked ? undefined : () => onDetails(item.cat, item.key)} style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 110, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 }}>
                  <View style={{ width: "100%", height: "100%", alignItems: "center", justifyContent: "center", transform: [{ scale: v.cat === "cans" ? 0.7 : 1.08 }] }}><Pic v={v} size={Math.min(width, h) * 0.7} grey={locked} /></View>
                  {locked ? <View style={{ position: "absolute", width: 72, height: 72, borderRadius: 36, backgroundColor: "rgba(0,0,0,0.55)", borderWidth: 2, borderColor: "rgba(252,211,77,0.6)", alignItems: "center", justifyContent: "center" }}><Text style={{ fontSize: 36 }}>🔒</Text></View> : null}
                </Press>
                <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 64, bottom: 12, paddingHorizontal: 14 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text numberOfLines={1} style={{ flexShrink: 1, color: "rgba(255,255,255,0.75)", fontSize: 13.5, lineHeight: 18, fontWeight: "700", textShadowColor: "rgba(0,0,0,0.85)", textShadowRadius: 6 }}>{v.title}</Text>
                    {o ? <Text style={{ color: "#d1fae5", backgroundColor: "rgba(4,120,87,0.8)", fontSize: 10, lineHeight: 14, fontWeight: "900", paddingHorizontal: 6, borderRadius: 4, overflow: "hidden", textTransform: "uppercase" }}>{o}</Text> : null}
                  </View>
                  <Text style={{ marginTop: 4, color: "#fff", fontSize: 14.5, lineHeight: 20, fontWeight: "600", textShadowColor: "rgba(0,0,0,0.85)", textShadowRadius: 6 }}>{line}</Text>
                  <Text numberOfLines={1} style={{ marginTop: 2, color: "rgba(255,255,255,0.85)", fontSize: 13, lineHeight: 18, fontWeight: "700", textShadowColor: "rgba(0,0,0,0.85)", textShadowRadius: 6 }}>{tags.join(" ")}</Text>
                </View>
                <View style={{ position: "absolute", right: 6, bottom: 14, alignItems: "center", gap: 12 }}>
                  <RoundButton icon={liked[id] ? "♥" : "♡"} on={liked[id]} label="Like" onPress={() => setLiked((l) => ({ ...l, [id]: !l[id] }))} />
                  <RoundButton icon="ⓘ" label="Info" disabled={locked} onPress={() => onDetails(item.cat, item.key)} />
                  <RoundButton icon="▦" label="See all" onPress={() => onSeeAll(item.cat, item.key)} />
                  {!locked ? <RoundButton gold={!v.button.disabled} disabled={v.button.disabled} onPress={v.button.run} icon={v.button.label === "Upgrade" ? "▲" : "★"}
                    label={v.button.disabled ? (v.button.price !== undefined ? "Save up" : "Owned") : v.button.label} /> : null}
                </View>
              </View>
            );
          }} />
      )}
    </View>
  );
}

export function ShopScreen({ params }: { params?: Record<string, unknown> }) {
  const career = useCareer();
  const nav = useNav();
  const inset = useSafeAreaInsets();
  const start = (params?.cat as CatId | undefined) ?? "cans";
  const [cat, setCat] = useState<CatId>(start === "boots" ? "cans" : start);
  const [tab, setTab] = useState<Tab>(start === "boots" ? "boots" : "shop");
  // 1 | 3 | 5 is kept on this phone, as the website keeps it (star-shop-items-view; 5 by default)
  const [view, setViewState] = useState<ItemsView>(() => { installWebStorage(); return loadShopItemsView(); });
  const setView = (n: ItemsView) => { setViewState(n); saveShopItemsView(n); };
  const [note, setNote] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [moment, setMoment] = useState<Moment | null>(null);
  const [sheet, setSheet] = useState<{ cat: CatId; key: string } | null>(null);
  const [pick, setPick] = useState<Record<string, number>>({});
  const [width, setWidth] = useState(0);
  const [moreOpen, setMoreOpen] = useState(false);
  const [fameOpen, setFameOpen] = useState(false);
  const [helpTour, setHelpTour] = useState(false);
  const [bought, setBought] = useState(0);
  const listRef = useRef<FlatList<string>>(null);
  const flash = (t: string) => { setNote(t); setTimeout(() => setNote((n) => (n === t ? null : n)), 3500); };
  const boots = useMemo(() => (career ? bootsForSale(career) : []), [career]);
  const bootKeys = useMemo(() => BOOT_ORDER.filter((b) => boots.some((x) => baseIdOf(x) === b)), [boots]);
  const forYou = useMemoForYou(bootKeys);
  const shownCat: CatId = tab === "boots" ? "boots" : cat;
  const keys = shownCat === "boots" ? bootKeys : KEYS[shownCat];
  /** Yours already (ShowroomShop isOwned / ownLabel). Cans are used up, never "owned". */
  const isOwned = (c: CatId, k: string): boolean => {
    if (!career || c === "cans") return false;
    if (c === "boots") return baseIdOf(career.currentBoot) === k && career.currentBoot.matches > 0;
    const mine = career.ownedItems.find((o) => baseIdOf(o) === k);
    return !!mine && !isWornOut(mine);
  };
  const ownLabel = (c: CatId, k: string): string | null => {
    if (!career) return null;
    if (c === "cans") { const n = career.kibCans[k as KibCan["id"]] ?? 0; return n > 0 ? `×${n} owned` : null; }
    if (c === "boots") return baseIdOf(career.currentBoot) === k ? (career.currentBoot.matches > 0 ? `On · L${career.currentBoot.level ?? 1}` : "Worn out") : null;
    const mine = career.ownedItems.find((o) => baseIdOf(o) === k);
    if (!mine) return null;
    if (isWornOut(mine)) return "Worn out";
    return (STYLE_BASES.get(k)?.length ?? 1) > 1 ? `Owned · L${ownedLevelOf(career, k)}` : "Owned";
  };
  /** Where a category lands you: the cheapest item you don't own yet (lib/star/shopNextItem.ts). */
  const nextUp = (c: CatId, ks: string[], from = 0): number => {
    if (!career || c === "cans") return Math.max(0, Math.min(ks.length - 1, from));
    const stars = career.unlocks ? starsNow(career) : 0;
    return nextUpIndex(ks.map((k) => {
      if (c === "boots") {
        const l1 = boots.filter((b) => baseIdOf(b) === k).sort((a, b) => (a.level ?? 0) - (b.level ?? 0))[0];
        return { owned: isOwned(c, k), locked: false, price: l1?.price ?? 0 };
      }
      return { owned: isOwned(c, k), locked: !!career.unlocks && stars < styleUnlockStar(k), price: STYLE_BASES.get(k)?.[0]?.price ?? 0 };
    }), from);
  };
  const nu = shownCat === "cans" ? -1 : nextUp(shownCat, keys, -1);
  const landing = nextUp(shownCat, keys);
  // the list opens on the next item (and comes back to it after a purchase)
  useEffect(() => {
    if (view !== 5 || landing <= 0) return;
    const id = setTimeout(() => { try { listRef.current?.scrollToIndex({ index: landing, animated: false, viewPosition: 0 }); } catch { /* not laid out yet */ } }, 60);
    return () => clearTimeout(id);
  }, [shownCat, view, bought]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!career) return null;
  const accent = SHOP_CATS.find((c) => c.id === shownCat)!.accent;
  const apply = (r: Bought, done: string) => {
    if (!r.ok) { flash(r.reason ?? "Can't do that"); return; }
    setCareer(r.career);
    flash(r.unlocked ? `${done} ${r.unlocked}.` : done);
  };
  const v = (c: CatId, k: string) => itemView({ career, cat: c, k, boots, level: pick[k], onAsk: (cf) => { setSheet(null); setConfirm(cf); }, onUse: (id) => apply(drinkCan(career, id), "Drunk.") });
  const fame = fameOf(career);
  const fl = fameLevel(fame);
  const nfl = nextFameLevel(fame);
  const sheetView = sheet ? v(sheet.cat, sheet.key) : null;
  const picFor = (c: CatId, k: string, lv: number) => { const src = picOf(c, k, lv); return src ? <Image source={src} resizeMode="contain" fadeDuration={0} style={{ width: "100%", height: "100%" }} /> : <Text style={{ fontSize: 48 }}>{SHOP_CATS.find((x) => x.id === c)!.icon}</Text>; };
  const moreLinks: { id: string; icon: string; label: string; go: () => void }[] = [
    { id: "sponsors", icon: "🤝", label: "Sponsors", go: () => nav.go("sponsors") },
    ...(SCREENS.store ? [{ id: "store", icon: "🪙", label: "Store", go: () => nav.go("store") }] : []),
  ];
  // The coach: the story's first Shop visit (cans, then Boots), else the first-visit line, else the "?" replay.
  const storyTour = !!career.unlocks && isStory(career) && isOpen(career, "shop") && !hasSeen(career, "story-shop-tour");
  const firstHelp = !storyTour && !!career.unlocks && !hasSeen(career, "help-shop");

  return (
    <View style={{ flex: 1, backgroundColor: "#05080f" }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {/* the shop's dark room, lit from above */}
      <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundImage: `radial-gradient(70% 45% at 50% 30%, rgba(255,255,255,0.09) 0%, rgba(255,255,255,0) 70%), radial-gradient(90% 50% at 50% 100%, ${rgba(accent, 0.1)} 0%, rgba(0,0,0,0) 70%), linear-gradient(180deg, #0d0f14, #05080f)` } as ViewStyle} />

      {/* top: back · 1|3|5 · More · balance + fame */}
      <View style={{ paddingTop: inset.top + 4, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 6, height: inset.top + 50 }}>
        <BackPill onPress={() => nav.back()} />
        <Text numberOfLines={1} style={{ flex: 1, paddingLeft: 4, color: tab === "boots" ? accent : "#fff", fontSize: 16, fontWeight: "900" }}>{tab === "foryou" ? "For You" : tab === "boots" ? "Boots" : ""}</Text>
        {tab !== "foryou" && <ViewSwitch view={view} onPick={setView} />}
        {tab === "shop" && (
          <Press onPress={() => { setMoreOpen((o) => !o); setFameOpen(false); }} style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: moreOpen ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.55)", borderWidth: 1, borderColor: moreOpen ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.2)" }}>
            <Text style={{ color: "#fff", fontSize: 18, lineHeight: 20, fontWeight: "900" }}>⋯</Text>
          </Press>
        )}
        <Press onPress={() => { setFameOpen((o) => !o); setMoreOpen(false); }} style={{ height: 36, flexDirection: "row", alignItems: "center", gap: 6, paddingLeft: 10, paddingRight: 6, borderRadius: 999, backgroundColor: "rgba(0,0,0,0.6)", borderWidth: 1, borderColor: "rgba(252,211,77,0.45)" }}>
          <Text style={{ color: "#fcd34d", fontSize: 13.5, fontWeight: "900" }}>★{formatWallet(career.money)}</Text>
          <Text style={{ color: "#fef3c7", fontSize: 11, fontWeight: "900", backgroundColor: "rgba(252,211,77,0.15)", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999, overflow: "hidden" }}>👑{fame}</Text>
        </Press>
      </View>
      {tab === "shop" && (
        <TourTarget name="cat-cans" style={{ height: 40, justifyContent: "flex-end" }}>
          <AntonTabs value={cat} onChange={setCat} lead={12} tabs={SHOP_CATS.filter((c) => c.id !== "boots").map((c) => [c.id, c.label] as const)} />
        </TourTarget>
      )}
      {tab === "boots" && <View style={{ height: 40 }} />}
      <View style={{ paddingHorizontal: 12 }}><Note text={note} /></View>

      <View style={{ flex: 1 }}>
        {tab === "foryou" ? (
          width > 0 && <ForYou items={forYou} width={width} view={v} own={ownLabel} stars={career.unlocks ? starsNow(career) : 0}
            onDetails={(c, k) => setSheet({ cat: c, key: k })}
            onSeeAll={(c) => { if (c === "boots") setTab("boots"); else { setCat(c); setTab("shop"); } setView(5); }} />
        ) : view === 5 ? (
          <FlatList
            ref={listRef}
            key={`list-${shownCat}`}
            data={keys}
            keyExtractor={(k) => `${shownCat}-${k}`}
            getItemLayout={(_, i) => ({ length: 136, offset: 6 + 136 * i, index: i })}
            contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 6, paddingBottom: 20, gap: 10 }}
            renderItem={({ item: k, index }) => {
              const iv = v(shownCat, k);
              return <ListCard v={iv} accent={accent} on={index === landing} next={index === nu && !isOwned(shownCat, k)} own={ownLabel(shownCat, k)}
                onTap={() => { if (iv.locked === null) setSheet({ cat: shownCat, key: k }); }} />;
            }}
          />
        ) : (
          width > 0 && <Pages key={`p${view}-${shownCat}-${bought}`} items={keys.map((k) => ({ cat: shownCat, key: k }))} width={width} horizontal narrow={view === 3} startAt={landing}
            nextCat={tab === "shop" ? SHOP_CATS.filter((c) => c.id !== "boots")[SHOP_CATS.filter((c) => c.id !== "boots").findIndex((c) => c.id === cat) + 1]?.label : undefined}
            accentOf={() => accent} view={v} onOpen={(c, k) => setSheet({ cat: c, key: k })} />
        )}
        {/* ⋯ More: the links that are not on the shop's bar */}
        {moreOpen && tab === "shop" ? (
          <View style={{ position: "absolute", left: 10, right: 10, top: 2, flexDirection: "row", gap: 6, borderRadius: 14, backgroundColor: "rgba(11,18,34,0.97)", borderWidth: 1, borderColor: "rgba(255,255,255,0.15)", padding: 8 }}>
            {moreLinks.map((l) => (
              <Press key={l.id} onPress={() => { setMoreOpen(false); l.go(); }} style={{ width: "23.5%", alignItems: "center", gap: 4, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.06)", paddingVertical: 8 }}>
                <Text style={{ fontSize: 22, lineHeight: 26 }}>{l.icon}</Text>
                <Text numberOfLines={1} style={{ color: "#fff", fontSize: 10.5, lineHeight: 14, fontWeight: "900", letterSpacing: 0.3, textTransform: "uppercase" }}>{l.label}</Text>
              </Press>
            ))}
          </View>
        ) : null}
        {/* the fame banner: tap ★ 👑 */}
        {fameOpen ? (
          <Press onPress={() => setFameOpen(false)} style={{ position: "absolute", left: 10, right: 10, top: 2, borderRadius: 12, backgroundColor: "rgba(11,18,34,0.97)", borderWidth: 1, borderColor: "rgba(252,211,77,0.4)", padding: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Text style={{ color: "#fcd34d", fontSize: 34, lineHeight: 38, fontWeight: "900", fontVariant: ["tabular-nums"], textShadowColor: "rgba(251,191,36,0.5)", textShadowRadius: 16 }}>{fame}</Text>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ color: "#fef3c7", fontSize: 13, lineHeight: 17, fontWeight: "900", letterSpacing: 1.8, textTransform: "uppercase" }}>Fame · {fl.name}</Text>
                <View style={{ marginTop: 4, height: 9, borderRadius: 5, backgroundColor: "rgba(0,0,0,0.6)", borderWidth: 1, borderColor: "rgba(252,211,77,0.3)", overflow: "hidden" }}>
                  <View style={{ height: "100%", width: `${nfl ? Math.max(3, Math.min(100, ((fame - fl.min) / (nfl.min - fl.min)) * 100)) : 100}%`, backgroundImage: "linear-gradient(90deg, #f59e0b, #fde047)" } as ViewStyle} />
                </View>
                <Text style={{ marginTop: 4, color: "rgba(255,255,255,0.85)", fontSize: 11, lineHeight: 15, fontWeight: "700" }}>{nfl ? `${nfl.min - fame} to ${nfl.name}` : "Top level"}</Text>
              </View>
            </View>
            <View style={{ marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.1)" }}>
              <Text style={{ color: "#fff", fontSize: 11.5, lineHeight: 16, fontWeight: "900" }}>From your stuff <Text style={{ color: "#fcd34d" }}>{fameText(ownedFame(career.ownedItems))}</Text> <Text style={{ color: "rgba(255,255,255,0.6)" }}>/ {OWNED_FAME_MAX}</Text></Text>
            </View>
          </Press>
        ) : null}
      </View>

      <ShopBar active={tab} onPick={(t) => { setTab(t); setMoreOpen(false); setFameOpen(false); }} onSponsors={() => nav.go("sponsors")} />
      <BottomBar active={null} />

      {sheet && sheetView ? (
        <DetailSheet v={sheetView} career={career} boots={boots} onLevel={(lv) => setPick((p) => ({ ...p, [sheet.key]: lv }))} onClose={() => setSheet(null)} />
      ) : null}
      <ConfirmSheet
        info={confirm ? {
          title: confirm.title, sub: confirm.sub, level: confirm.level ?? 1, price: confirm.price, verb: confirm.verb, note: confirm.note,
          pic: confirm.cat && confirm.key ? picFor(confirm.cat, confirm.key, confirm.level ?? 1) : null,
          blackMarket: confirm.black ? { lawyerFee: LAWYER_FEE, lawyerPrice: (l) => confirm.price + (l ? LAWYER_FEE : 0) } : undefined,
        } : null}
        money={career.money} onCancel={() => setConfirm(null)}
        onConfirm={(lawyers) => {
          if (!confirm) return;
          const r = confirm.run(lawyers);
          if (!r.ok) return r.reason ?? "Failed";
          setCareer(r.career); setConfirm(null); setSheet(null); setBought((n) => n + 1);
          if (r.unlocked) flash(`${r.unlocked}.`);
          setMoment({ pic: confirm.cat && confirm.key ? picFor(confirm.cat, confirm.key, confirm.level ?? 1) : null, level: confirm.level ?? 1, title: confirm.momentTitle ?? confirm.title, word: confirm.word, fx: confirm.fx });
        }} />
      {moment ? <PurchaseMoment m={moment} onDone={() => setMoment(null)} /> : null}
      {helpTour ? <PointerTour key="help-shop" steps={HELP_TOURS.shop} onDone={() => setHelpTour(false)} />
        : storyTour ? <PointerTour key="story-shop" steps={STORY_SHOP_TOUR} press={{ "shop-tab-boots": () => setTab("boots") }} onDone={() => markSeenKeys("story-shop-tour", "help-cans", "help-boots", "help-shop")} />
        : firstHelp && !sheet && !confirm && !moment ? <PointerTour key="first-shop" steps={HELP_TOURS.shop} onDone={() => markSeenKeys("help-shop")} /> : null}
    </View>
  );
}

/** For You: every item in the shop, mixed (the same order every visit). */
function useMemoForYou(bootKeys: string[]) {
  return useMemo(() => {
    const all: { cat: CatId; key: string }[] = [];
    const lists = SHOP_CATS.map((c) => (c.id === "boots" ? bootKeys : KEYS[c.id]).map((k) => ({ cat: c.id, key: k })));
    for (let i = 0; lists.some((l) => i < l.length); i++) for (const l of lists) if (l[i]) all.push(l[i]);
    return all;
  }, [bootKeys]);
}

/** 1 | 3 | 5 items on screen (ShowroomShop ViewSwitch). */
function ViewSwitch({ view, onPick }: { view: ItemsView; onPick: (v: ItemsView) => void }) {
  return (
    <View style={{ height: 36, flexDirection: "row", alignItems: "center", padding: 3, borderRadius: 999, backgroundColor: "rgba(0,0,0,0.55)", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" }}>
      {([1, 3, 5] as ItemsView[]).map((n) => (
        <Press key={n} onPress={() => onPick(n)} style={{ width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: view === n ? "#fff" : "transparent" }}>
          <Text style={{ color: view === n ? "#05080f" : "rgba(255,255,255,0.75)", fontSize: 13, fontWeight: "900" }}>{n}</Text>
        </Press>
      ))}
    </View>
  );
}

/** The shop's own bar, TikTok-style: Shop · For You · Boots · Sponsors, in the website's white line icons
 *  (the 3D shop's centre button is left out: it is not in this app). */
function ShopBar({ active, onPick, onSponsors }: { active: Tab; onPick: (t: Tab) => void; onSponsors: () => void }) {
  const tab = (t: Tab | "sponsors", label: string, on: boolean, onPress: () => void) => {
    const color = on ? "#ffffff" : "#999b9f";
    const body = <>
      <SvgIcon body={SHOP_BAR_ICON[t](on)} size={22} color={color} />
      <Text style={{ color: on ? "#fff" : "rgba(255,255,255,0.6)", fontSize: 10, lineHeight: 12, fontWeight: "700" }}>{label}</Text>
    </>;
    return t === "boots"
      ? <TourTarget key={t} name="shop-tab-boots" style={{ flex: 1 }}><Press onPress={onPress} style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 3 }}>{body}</Press></TourTarget>
      : <Press key={t} onPress={onPress} style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 3 }}>{body}</Press>;
  };
  return (
    <View style={{ height: 52, flexDirection: "row", alignItems: "stretch", backgroundColor: "#05080f", borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.1)" }}>
      {tab("shop", "Shop", active === "shop", () => onPick("shop"))}
      {tab("foryou", "For You", active === "foryou", () => onPick("foryou"))}
      {tab("boots", "Boots", active === "boots", () => onPick("boots"))}
      {tab("sponsors", "Sponsors", false, onSponsors)}
    </View>
  );
}
