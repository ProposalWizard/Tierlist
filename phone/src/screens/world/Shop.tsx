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
import { useMemo, useState } from "react";
import { FlatList, Image, Modal, ScrollView, Text, View, type ImageSourcePropType, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Boot, CareerState, OwnedItem } from "@/lib/star/types";
import { KIB_CANS, kibCanPrice, kibCanEffectLabel, baseIdOf, type KibCan } from "@/lib/star/shopData";
import { hasBootDeal } from "@/lib/star/sponsorDeals";
import { ruleBookFor } from "@/lib/star/ruleBook";
import { blackMarketPrice, LAWYER_FEE } from "@/lib/star/corruption";
import { fameGainFromBuying, isWornOut, itemLifeSeasons, fameOf } from "@/lib/star/fame";
import { styleGroupOf, levelName, familyName, fameFromOwned, fameText, type StyleGroup } from "@/lib/star/lifestyleLevels";
import { styleUnlockStar } from "@/lib/star/unlocks";
import { starsNow } from "@/lib/star/starPoints";
import { SHOP_TIERS } from "@/lib/star/economy";
import { formatMoney, formatWallet } from "@/lib/star/money";
import { useCareer, setCareer } from "../../game/store";
import { useNav } from "../../nav";
import { Press } from "../../ui/Press";
import { C } from "../../world/lookKit";
import { AntonTabs, BackPill, BottomBar, CAN, FONT, LookButton } from "../../ui/look";
import { SHOP_PIC } from "../../ui/look/worldPics";
import { Btn, Note, rgba } from "../../world/ui";
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
  const name = cat === "boots" ? `boot-${key}-L${lv}` : key === "phone" ? "phone-L1" : `${key}-L${lv}`;
  return SHOP_PIC[name] ?? null;
}

type ItemsView = 1 | 3 | 5;
type Tab = "shop" | "foryou" | "boots";

interface Confirm { title: string; sub: string; price: number; verb: string; note?: string; black?: Boot; run: (lawyers: boolean) => Bought }

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
      run: () => onAsk({ title: c.name, sub: kibCanEffectLabel(c), price, verb: "Buy", run: () => buyKib(career, c) }) };
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
          note: mine && !worn ? `Replaces your ${levelName(mine)}.` : undefined, run: () => buyItem(career, it) }) };
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
function ListCard({ v, accent, on, onTap }: { v: ItemView; accent: string; on: boolean; onTap: () => void }) {
  const locked = v.locked !== null;
  const tier = v.levels > 1 ? tierColour(v.level) : accent;
  const own = v.badges.find((b) => /^Owned|^Equipped/.test(b.text))?.text ?? null;
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
        {own ? <Text style={{ alignSelf: "flex-start", color: "#a7f3d0", backgroundColor: "rgba(6,95,70,0.9)", fontSize: 9.5, fontWeight: "900", letterSpacing: 0.6, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, overflow: "hidden", textTransform: "uppercase" }}>{own}</Text> : null}
        <Text numberOfLines={1} style={{ color: "#fff", fontFamily: FONT.display, fontSize: 19, lineHeight: 24 }}>{v.title}</Text>
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
function Pages({ items, width, horizontal, narrow, accentOf, view, onOpen, nextCat }: {
  items: { cat: CatId; key: string }[]; width: number; horizontal: boolean; narrow?: boolean;
  accentOf: (c: CatId) => string; view: (c: CatId, k: string) => ItemView; onOpen: (c: CatId, k: string) => void; nextCat?: string;
}) {
  const [h, setH] = useState(0);
  const [at, setAt] = useState(0);
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
        <Text numberOfLines={1} style={{ color: "#fff", fontFamily: FONT.display, fontSize: 26, lineHeight: 32 }}>{v.title}</Text>
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

/** The level pips (ShowroomShop Pips): one bar per level, coloured up to the one shown; tap one to see it. */
function Pips({ level, of, onPick }: { level: number; of: number; onPick: (lv: number) => void }) {
  if (of <= 1) return null;
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      {Array.from({ length: of }, (_, i) => (
        <Press key={i} onPress={() => onPick(i + 1)} style={{ height: 26, justifyContent: "center", paddingHorizontal: 3 }}>
          <View style={{ width: 22, height: i + 1 === level ? 9 : 7, borderRadius: 5, backgroundColor: i < level ? tierColour(i + 1) : "rgba(255,255,255,0.2)" }} />
        </Press>
      ))}
    </View>
  );
}

/** The item's sheet: big picture, the level pips, what it gives, Buy. */
function DetailSheet({ v, accent, catLabel, onLevel, onClose }: { v: ItemView; accent: string; catLabel: string; onLevel: (lv: number) => void; onClose: () => void }) {
  const inset = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.65)" }}>
      <Press onPress={onClose} style={{ flex: 1 }}><View /></Press>
      <View style={{ borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 18 + inset.bottom, gap: 8,
        backgroundImage: `radial-gradient(80% 40% at 50% 0%, ${rgba(accent, 0.22)}, rgba(0,0,0,0) 70%), linear-gradient(180deg, #0b1222, #05080f)`, borderTopWidth: 1, borderColor: "rgba(255,255,255,0.15)" } as ViewStyle}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text style={{ flex: 1, color: accent, fontSize: 11, fontWeight: "900", letterSpacing: 1.8, textTransform: "uppercase" }}>{v.cat === "cans" ? `${v.title} ${v.sub}` : catLabel}</Text>
          <Press onPress={onClose} style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.1)" }}><Text style={{ color: "#fff", fontSize: 16, fontWeight: "900" }}>✕</Text></Press>
        </View>
        <View style={{ height: 220, alignItems: "center", justifyContent: "center" }}>
          <View pointerEvents="none" style={{ position: "absolute", bottom: 14, width: "70%", height: 34, borderRadius: 999, backgroundImage: "radial-gradient(closest-side, rgba(0,0,0,0.75), rgba(0,0,0,0))" } as ViewStyle} />
          <Pic v={v} size={220} grey={v.locked !== null} />
        </View>
        <Text numberOfLines={1} style={{ color: "#fff", fontFamily: FONT.display, fontSize: 28, lineHeight: 34 }}>{v.title}</Text>
        <Text numberOfLines={1} style={{ color: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: "700" }}>{v.sub}</Text>
        <Pips level={v.level} of={v.levels} onPick={onLevel} />
        {v.badges.length > 0 && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
            {v.badges.map((b) => <Text key={b.text} style={{ color: "#111", backgroundColor: b.color, fontSize: 10, fontWeight: "900", paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, overflow: "hidden" }}>{b.text}</Text>)}
          </View>
        )}
        <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 12 }}>
          {v.stats.map((s) => <Text key={s.text} style={{ color: s.color, fontWeight: "900", fontSize: 13 }}>{s.text}</Text>)}
        </View>
        {v.locked !== null ? (
          <Text style={{ color: "#fcd34d", fontWeight: "900", letterSpacing: 0.8, marginTop: 6 }}>🔒 HIGHER STAR RATING · REACH ★{v.locked}</Text>
        ) : (
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 8, marginTop: 6 }}>
            {v.extra && (
              <Press disabled={v.extra.disabled} onPress={v.extra.run} style={{ height: 40, paddingHorizontal: 14, borderRadius: 999, justifyContent: "center", backgroundColor: "rgba(0,0,0,0.4)", borderWidth: 1, borderColor: "rgba(255,255,255,0.3)", opacity: v.extra.disabled ? 0.35 : 1 }}>
                <Text style={{ color: "#fff", fontSize: 12, fontWeight: "900", textTransform: "uppercase" }}>{v.extra.label}</Text>
              </Press>
            )}
            <BuyPill b={v.button} />
          </View>
        )}
      </View>
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
  const [view, setView] = useState<ItemsView>(5);
  const [note, setNote] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [sheet, setSheet] = useState<{ cat: CatId; key: string } | null>(null);
  const [pick, setPick] = useState<Record<string, number>>({});
  const [width, setWidth] = useState(0);
  const flash = (t: string) => { setNote(t); setTimeout(() => setNote((n) => (n === t ? null : n)), 3500); };
  const boots = useMemo(() => (career ? bootsForSale(career) : []), [career]);
  const bootKeys = useMemo(() => BOOT_ORDER.filter((b) => boots.some((x) => baseIdOf(x) === b)), [boots]);
  const forYou = useMemoForYou(bootKeys);
  if (!career) return null;
  const shownCat: CatId = tab === "boots" ? "boots" : cat;
  const accent = SHOP_CATS.find((c) => c.id === shownCat)!.accent;
  const keys = shownCat === "boots" ? bootKeys : KEYS[shownCat];
  const apply = (r: Bought, done: string) => {
    if (!r.ok) { flash(r.reason ?? "Can't do that"); return; }
    setCareer(r.career);
    flash(r.unlocked ? `${done} ${r.unlocked}.` : done);
  };
  const v = (c: CatId, k: string) => itemView({ career, cat: c, k, boots, level: pick[k], onAsk: setConfirm, onUse: (id) => apply(drinkCan(career, id), "Drunk.") });
  const fame = fameOf(career);
  const sheetView = sheet ? v(sheet.cat, sheet.key) : null;

  return (
    <View style={{ flex: 1, backgroundColor: "#05080f" }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {/* the shop's dark room, lit from above */}
      <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundImage: `radial-gradient(70% 45% at 50% 30%, rgba(255,255,255,0.09) 0%, rgba(255,255,255,0) 70%), radial-gradient(90% 50% at 50% 100%, ${rgba(accent, 0.1)} 0%, rgba(0,0,0,0) 70%), linear-gradient(180deg, #0d0f14, #05080f)` } as ViewStyle} />

      {/* top: back · 1|3|5 · balance + fame */}
      <View style={{ paddingTop: inset.top + 4, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 6, height: inset.top + 50 }}>
        <BackPill onPress={() => nav.back()} />
        <Text numberOfLines={1} style={{ flex: 1, paddingLeft: 4, color: tab === "boots" ? accent : "#fff", fontSize: 16, fontWeight: "900" }}>{tab === "foryou" ? "For You" : tab === "boots" ? "Boots" : ""}</Text>
        {tab !== "foryou" && <ViewSwitch view={view} onPick={setView} />}
        <View style={{ height: 36, flexDirection: "row", alignItems: "center", gap: 6, paddingLeft: 10, paddingRight: 6, borderRadius: 999, backgroundColor: "rgba(0,0,0,0.6)", borderWidth: 1, borderColor: "rgba(252,211,77,0.45)" }}>
          <Text style={{ color: "#fcd34d", fontSize: 13.5, fontWeight: "900" }}>★{formatWallet(career.money)}</Text>
          <Text style={{ color: "#fef3c7", fontSize: 11, fontWeight: "900", backgroundColor: "rgba(252,211,77,0.15)", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999, overflow: "hidden" }}>👑{fame}</Text>
        </View>
      </View>
      {tab === "shop" && (
        <View style={{ height: 40, justifyContent: "flex-end" }}>
          <AntonTabs value={cat} onChange={setCat} lead={Math.round(width * 0.38)} tabs={SHOP_CATS.filter((c) => c.id !== "boots").map((c) => [c.id, c.label] as const)} />
        </View>
      )}
      {tab === "boots" && <View style={{ height: 40 }} />}
      <View style={{ paddingHorizontal: 12 }}><Note text={note} /></View>

      <View style={{ flex: 1 }}>
        {tab === "foryou" ? (
          width > 0 && <Pages key="fy" items={forYou} width={width} horizontal={false} accentOf={(c) => SHOP_CATS.find((x) => x.id === c)!.accent} view={v} onOpen={(c, k) => setSheet({ cat: c, key: k })} />
        ) : view === 5 ? (
          <FlatList
            key={`list-${shownCat}`}
            data={keys}
            keyExtractor={(k) => `${shownCat}-${k}`}
            contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 6, paddingBottom: 20, gap: 10 }}
            renderItem={({ item: k, index }) => <ListCard v={v(shownCat, k)} accent={accent} on={index === 0} onTap={() => setSheet({ cat: shownCat, key: k })} />}
          />
        ) : (
          width > 0 && <Pages key={`p${view}-${shownCat}`} items={keys.map((k) => ({ cat: shownCat, key: k }))} width={width} horizontal narrow={view === 3}
            nextCat={tab === "shop" ? SHOP_CATS.filter((c) => c.id !== "boots")[SHOP_CATS.filter((c) => c.id !== "boots").findIndex((c) => c.id === cat) + 1]?.label : undefined}
            accentOf={() => accent} view={v} onOpen={(c, k) => setSheet({ cat: c, key: k })} />
        )}
      </View>

      <ShopBar active={tab} onPick={(t) => setTab(t)} onSponsors={() => nav.go("sponsors")} />
      <BottomBar active={null} />

      <Modal visible={!!sheetView} transparent animationType="slide" onRequestClose={() => setSheet(null)}>
        {sheet && sheetView && (
          <DetailSheet v={sheetView} accent={SHOP_CATS.find((c) => c.id === sheet.cat)!.accent} catLabel={SHOP_CATS.find((c) => c.id === sheet.cat)!.label}
            onLevel={(lv) => setPick((p) => ({ ...p, [sheet.key]: lv }))} onClose={() => setSheet(null)} />
        )}
      </Modal>
      <ConfirmSheet c={confirm} money={career.money} onClose={() => setConfirm(null)}
        onRun={(lawyers) => { if (!confirm) return; const r = confirm.run(lawyers); setConfirm(null); setSheet(null); apply(r, `${confirm.title}: yours!`); }} />
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

/** The shop's own bar, TikTok-style: Shop · For You · 3D · Boots · Sponsors. */
function ShopBar({ active, onPick, onSponsors }: { active: Tab; onPick: (t: Tab) => void; onSponsors: () => void }) {
  const tab = (t: Tab | "sponsors", label: string, icon: string, on: boolean, onPress: () => void) => (
    <Press key={t} onPress={onPress} style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 3 }}>
      <Text style={{ fontSize: 17, opacity: on ? 1 : 0.6 }}>{icon}</Text>
      <Text style={{ color: on ? "#fff" : "rgba(255,255,255,0.6)", fontSize: 10, fontWeight: "700" }}>{label}</Text>
    </Press>
  );
  return (
    <View style={{ height: 50, flexDirection: "row", alignItems: "stretch", backgroundColor: "#05080f", borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.1)" }}>
      {tab("shop", "Shop", "🛍️", active === "shop", () => onPick("shop"))}
      {tab("foryou", "For You", "▶️", active === "foryou", () => onPick("foryou"))}
      {/* The walk-around 3D shop is not in this app (Mikey's choice of 3D): no dead button. */}
      {tab("boots", "Boots", "👟", active === "boots", () => onPick("boots"))}
      {tab("sponsors", "Sponsors", "🤝", false, onSponsors)}
    </View>
  );
}

function ConfirmSheet({ c, money, onClose, onRun }: { c: Confirm | null; money: number; onClose: () => void; onRun: (lawyers: boolean) => void }) {
  const [lawyers, setLawyers] = useState(false);
  const price = c ? c.price + (c.black && lawyers ? LAWYER_FEE : 0) : 0;
  return (
    <Modal visible={!!c} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.65)" }}>
        {c && (
          <View style={{ backgroundImage: "linear-gradient(180deg, #0b1222, #05080f)", borderTopLeftRadius: 22, borderTopRightRadius: 22, borderTopWidth: 1, borderColor: "rgba(255,255,255,0.15)", padding: 18, paddingBottom: 34, gap: 10 } as ViewStyle}>
            <Text style={{ color: C.text, fontFamily: FONT.display, fontSize: 24, lineHeight: 30 }}>{c.title}</Text>
            <Text style={{ color: C.dim, fontWeight: "700" }}>{c.sub}</Text>
            {c.note ? <Text style={{ color: C.text, fontWeight: "700" }}>{c.note}</Text> : null}
            {c.black && (
              <Press onPress={() => setLawyers((l) => !l)} style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderRadius: 12, backgroundColor: lawyers ? rgba("#fbbf24", 0.25) : C.panel2 }}>
                <Text style={{ fontSize: 18 }}>{lawyers ? "☑" : "☐"}</Text>
                <Text style={{ color: C.text, fontWeight: "800", flex: 1 }}>Pay lawyers (+★{formatMoney(LAWYER_FEE)}): less chance of getting caught</Text>
              </Press>
            )}
            <Text style={{ color: C.gold, fontWeight: "900", fontSize: 24 }}>★{formatMoney(price)}</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Btn style={{ flex: 1 }} tone="plain" label="Not now" onPress={onClose} />
              <Btn style={{ flex: 2 }} tone={c.black ? "red" : "gold"} disabled={money < price} label={money < price ? "Not enough money" : c.verb} onPress={() => onRun(lawyers)} />
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}
