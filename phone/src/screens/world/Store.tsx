/**
 * THE STORE (Coins): the phone port of components/star/store/CareerStore.tsx
 * + StoreView.tsx, in its layout. The game's top bar; ◂ BACK · STORE · ★ and
 * Coins wallet pills; one row of tabs (Daily · Animations · Accessories ·
 * Boots · Coins); picture cards two across; tap a card for its sheet (big
 * picture, what it is, buy with ★ or Coins, Wear / Use for penalties).
 *
 * Every number and rule is the game's own (lib/star/store/*). The pictures are
 * the website's studio renders (public/shop/store → assets/look/store) with
 * the drawn player trying an accessory on in the corner. No payment code: in a
 * release build a Coin pack reads "Coming soon", as on the website.
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { View, Text, Image, Modal, Pressable, ScrollView, useWindowDimensions, type ImageSourcePropType, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StoreFigure } from "./StoreFigure";
import { CAN, BackPill } from "../../ui/look";
import { SHOP_PIC_3D } from "../../ui/look/worldPics";
import { shopPic3d } from "@/lib/star/shopPicsLook";
import type { CareerState } from "@/lib/star/types";
import { ANIMATIONS, ACCESSORIES, bootsAtLevel, findItem, itemName, isConsumable, isPayToWin, RARITY_LABEL, SLOT_LABEL, ANIMATION_SET_LABEL, type StoreItem, type AccessoryItem, type AnimationSet, type Rarity } from "@/lib/star/store/catalogue";
import { careerStoreState, careerPriceContext, careerStoreBuy, careerStoreEquip, careerStoreUnequip, careerBuyCoinPack, careerConvertCoins, careerBootStatus, shownInCareer, coinPacksAreTestMode, ACCESSORIES_IN_MATCH_NOTE } from "@/lib/star/store/career";
import { priceNow, owns, type Currency, type StoreState } from "@/lib/star/store/purchase";
import { dateKeyFor, dailySpecials, msUntilReset, formatCountdown } from "@/lib/star/store/daily";
import { COIN_PACKS, coinValueLine, formatPounds, packCoinsNow, coinsToStars, packBonusPercent, COINS_PER_WAGE_WEEK } from "@/lib/star/store/coins";
import { signatureOf } from "@/lib/star/signatureBoots";
import { useCareer, setCareer } from "../../game/store";
import { settle } from "../../game/flow";
import { useNav } from "../../nav";
import { Press } from "../../ui/Press";
import { GameTop } from "../../world/chrome";
import { SvgIcon } from "../../world/SvgIcon";
import { clubGlow, rgba } from "../../world/ui";

type PriceContext = ReturnType<typeof careerPriceContext>;
type Who = ReturnType<typeof signatureOf> | null;
type Tab = "daily" | "animations" | "accessories" | "boosts" | "coins";
const TABS: [Tab, string][] = [["daily", "Daily"], ["animations", "Animations"], ["accessories", "Accessories"], ["boosts", "Boots"], ["coins", "Coins"]];
const n = (x: number) => Math.round(x).toLocaleString("en-GB");
const SLATE400 = "#94a3b8";
const RARITY_COLOR: Record<Rarity, string> = { common: "#94a3b8", rare: "#38bdf8", epic: "#a78bfa", legendary: "#fbbf24" };
const RARITY_CHIP: Record<Rarity, [string, string]> = { common: ["rgba(100,116,139,0.35)", "#e2e8f0"], rare: ["rgba(14,165,233,0.35)", "#bae6fd"], epic: ["rgba(139,92,246,0.35)", "#ddd6fe"], legendary: ["rgba(251,191,36,0.35)", "#fef3c7"] };

/** The website's studio renders (public/shop/store). */
const RENDER: Record<string, ImageSourcePropType> = {
  "acc-armband-classic": require("../../../assets/look/store/acc-armband-classic.webp"), "acc-armband-rainbow": require("../../../assets/look/store/acc-armband-rainbow.webp"),
  "acc-boots-blackout": require("../../../assets/look/store/acc-boots-blackout.webp"), "acc-boots-gold": require("../../../assets/look/store/acc-boots-gold.webp"),
  "acc-boots-volt": require("../../../assets/look/store/acc-boots-volt.webp"), "acc-gloves-black": require("../../../assets/look/store/acc-gloves-black.webp"),
  "acc-gloves-gold": require("../../../assets/look/store/acc-gloves-gold.webp"), "acc-headband-ninja": require("../../../assets/look/store/acc-headband-ninja.webp"),
  "acc-headband-white": require("../../../assets/look/store/acc-headband-white.webp"), "acc-sleeves-black": require("../../../assets/look/store/acc-sleeves-black.webp"),
  "acc-sleeves-white": require("../../../assets/look/store/acc-sleeves-white.webp"), "acc-snood-black": require("../../../assets/look/store/acc-snood-black.webp"),
  "acc-tape-white": require("../../../assets/look/store/acc-tape-white.webp"), "boost-stat": require("../../../assets/look/store/boost-stat.webp"),
  "boost-training": require("../../../assets/look/store/boost-training.webp"), "coins-bag": require("../../../assets/look/store/coins-bag.webp"),
  "coins-chest": require("../../../assets/look/store/coins-chest.webp"), "coins-handful": require("../../../assets/look/store/coins-handful.webp"),
  "coins-pouch": require("../../../assets/look/store/coins-pouch.webp"), "coins-stadium": require("../../../assets/look/store/coins-stadium.webp"),
  "coins-vault": require("../../../assets/look/store/coins-vault.webp"),
};
function renderFor(item: StoreItem): ImageSourcePropType | null {
  if (item.kind === "accessory") return item.slot === "celebration" || item.signature ? null : RENDER[`acc-${item.id}`] ?? null;
  if (item.kind === "boost") return item.id === "training-boost" ? RENDER["boost-training"] : item.id === "stat-can" ? RENDER["boost-stat"] : null;
  return null;
}

const COIN = `<circle cx="10" cy="10" r="9" fill="#f59e0b"/><circle cx="10" cy="10" r="6.6" fill="#fcd34d" stroke="#b45309" stroke-width="1"/><path d="M8 6.5 V13.5 M8 10 L12 6.5 M8 10 L12 13.5" stroke="#92400e" stroke-width="1.7" stroke-linecap="round" fill="none"/>`;
const CoinIcon = ({ size = 14 }: { size?: number }) => <SvgIcon body={COIN} box={20} size={size} />;

/** The store's card look: dark glass lit from one corner in a colour. */
function cardLook(color: string, strength = 0.26): ViewStyle {
  return { backgroundImage: `linear-gradient(135deg, ${rgba(color, strength)} 0%, rgba(31,41,55,0.9) 45%, rgba(12,17,28,0.96) 100%)`, borderWidth: 1, borderColor: rgba(color, 0.28) } as ViewStyle;
}
const rarityOf = (item: StoreItem): Rarity | null => (item.kind === "animation" || item.kind === "accessory" ? item.rarity : null);
function inUse(item: StoreItem, state: StoreState): boolean {
  if (item.kind === "animation") return item.set === "penalty" ? state.penaltyRunup === item.id : state.freeKickRunup === item.id;
  if (item.kind === "accessory") return state.equipped[item.slot] === item.id;
  return false;
}

function Stars({ v, size = 12, color = "#f1f5f9" }: { v: number; size?: number; color?: string }) {
  return <Text style={{ color, fontSize: size, lineHeight: size * 1.4, fontWeight: "900", fontVariant: ["tabular-nums"] }}><Text style={{ color: color === "#f1f5f9" ? "#fde047" : color }}>★</Text>{n(v)}</Text>;
}
function Coins({ v, size = 12, color = "#fef3c7" }: { v: number; size?: number; color?: string }) {
  return <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}><CoinIcon size={size + 2} /><Text style={{ color, fontSize: size, lineHeight: size * 1.4, fontWeight: "900", fontVariant: ["tabular-nums"] }}>{n(v)}</Text></View>;
}
function RarityChip({ r }: { r: Rarity }) {
  return <Text style={{ backgroundColor: RARITY_CHIP[r][0], color: RARITY_CHIP[r][1], fontSize: 10, lineHeight: 14, fontWeight: "900", letterSpacing: 0.3, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, overflow: "hidden", textTransform: "uppercase" }}>{RARITY_LABEL[r]}</Text>;
}

/** The picture for any item, `w` wide (StoreView ItemArt). */
function ItemArt({ item, w, wear, tryOn = true, who }: { item: StoreItem; w: number; wear?: AccessoryItem[]; tryOn?: boolean; who: Who }) {
  const box = (h: number, children: ReactNode, bg = "linear-gradient(180deg, #12263f, #0c1a12)") => (
    <View style={{ width: w, height: h, borderRadius: 12, overflow: "hidden", alignItems: "center", justifyContent: "center", backgroundImage: bg } as ViewStyle}>{children}</View>
  );
  if (item.kind === "animation") {
    const h = Math.round(w * 0.75);
    return box(h, <StoreFigure wear={[]} width={w} height={h} runup />, "linear-gradient(180deg, #166534, #14532d)");
  }
  if (item.kind === "accessory") {
    const all = [...(wear ?? []).filter((x) => x.slot !== item.slot), item];
    const src = renderFor(item);
    // the drawn figure stays under 160×160 (one small drawing each: a page of them is light on any phone)
    if (!src) { const h = Math.round(w * 1.05); const big = w > 200; return box(h, <StoreFigure wear={all} width={big ? w : Math.min(w, 150)} height={big ? h : Math.min(h, 165)} signature={who} />); }
    const h = Math.round(w * 0.75);
    return box(h, <>
      <Image source={src} resizeMode="contain" fadeDuration={0} style={{ width: w, height: h }} />
      {tryOn ? (
        <View style={{ position: "absolute", right: 4, bottom: 4, borderRadius: 8, backgroundColor: "rgba(0,0,0,0.45)", borderWidth: 1, borderColor: "rgba(255,255,255,0.15)" }}>
          <StoreFigure wear={all} width={Math.round(w * 0.3)} height={Math.round(w * 0.32)} signature={who} />
        </View>
      ) : null}
    </>, "linear-gradient(180deg, #1b2a44, #0c1522)");
  }
  const h = Math.round(w * 0.8);
  if (item.kind === "boost") {
    const can = item.canId ? CAN[item.canId as keyof typeof CAN] : undefined;
    const src = can ?? renderFor(item);
    return box(h, src ? <Image source={src} resizeMode="contain" fadeDuration={0} style={{ width: w * 0.8, height: h * 0.8 }} /> : <Text style={{ fontSize: h * 0.4 }}>⚡</Text>, "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.04))");
  }
  const still = SHOP_PIC_3D[shopPic3d("boot", (item.boot as { baseId?: string; id: string }).baseId ?? item.boot.id, item.boot.level ?? 1) ?? ""];
  return box(h, still ? <Image source={still} resizeMode="contain" fadeDuration={0} style={{ width: w * 0.84, height: h * 0.9 }} /> : <Text style={{ fontSize: h * 0.4 }}>👟</Text>, "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.04))");
}

function PriceLine({ item, state, ctx, dateKey }: { item: StoreItem; state: StoreState; ctx: PriceContext; dateKey: string }) {
  const { price, full, percentOff } = priceNow(item, ctx, state, dateKey);
  if (price.stars === 0) return <Text style={{ color: "#6ee7b7", fontSize: 12, fontWeight: "900" }}>Free</Text>;
  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Stars v={price.stars} /><Text style={{ color: "#475569", fontSize: 12 }}>·</Text><Coins v={price.coins} />
      </View>
      {percentOff > 0 ? <Text style={{ color: "#64748b", fontSize: 10, lineHeight: 13, fontWeight: "700", textDecorationLine: "line-through" }}>★{n(full.stars)} · {n(full.coins)}</Text> : null}
    </View>
  );
}
function StateBadge({ item, state, equipped }: { item: StoreItem; state: StoreState; equipped?: boolean }) {
  if (isConsumable(item)) {
    const have = state.inventory[item.id] ?? 0;
    return have > 0 ? <Text style={{ color: "#6ee7b7", fontSize: 11, fontWeight: "900" }}>×{have} held</Text> : null;
  }
  if (equipped) return <Text style={{ color: "#6ee7b7", fontSize: 11, fontWeight: "900" }}>✓ Wearing</Text>;
  if (owns(state, item.id)) return <Text style={{ color: "#7dd3fc", fontSize: 11, fontWeight: "900" }}>Owned</Text>;
  return null;
}

export function StoreScreen() {
  const career = useCareer();
  const nav = useNav();
  const vp = useWindowDimensions();
  const inset = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>("daily");
  const [openId, setOpenId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null);
  // Drawn again only when the day turns (new specials); the countdown ticks on its own.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setTimeout(() => setNow(Date.now()), msUntilReset(now) + 500); return () => clearTimeout(t); }, [now]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 2200); return () => clearTimeout(t); }, [toast]);
  const who = useMemo(() => (career ? signatureOf(career) : null), [career]);
  if (!career) return null;
  const glow = clubGlow(career.player.club, career);
  const dateKey = dateKeyFor(now);
  const state = careerStoreState(career);
  const ctx = careerPriceContext(career);
  const shown = (it: StoreItem) => shownInCareer(it, career);
  const run = (r: { ok: boolean; career: CareerState; reason?: string }, done: string) => {
    if (r.ok) { setCareer(r.career); settle(); if (done) setToast({ text: done, ok: true }); } else setToast({ text: r.reason ?? "Not now.", ok: false });
    return r.ok;
  };
  const buy = (id: string, cur: Currency) => { const it = findItem(id); run(careerStoreBuy(career, id, cur, dateKey), `${it ? itemName(it) : id} bought`); };
  const equippedWear = Object.values(state.equipped).map((id) => ACCESSORIES.find((a) => a.id === id)).filter((a): a is AccessoryItem => !!a);
  const colW = Math.floor((vp.width - 32 - 12) / 2);
  const artW = colW - 16;
  const value = coinValueLine(ctx.weeklyWage);
  const open = openId ? findItem(openId) : undefined;

  const itemCard = (item: StoreItem) => {
    const rar = rarityOf(item);
    const { percentOff } = priceNow(item, ctx, state, dateKey);
    const bootLine = item.kind === "boot" ? careerBootStatus(career, item.id) : null;
    const blurb = item.kind === "animation" ? item.blurb : item.kind === "boot"
      ? `+${item.boot.power} power · +${item.boot.technique} technique${item.boot.curve ? " · curve" : ""}${item.boot.extraTouch ? " · extra touch" : ""}`
      : item.kind === "boost" ? item.effect : SLOT_LABEL[item.slot];
    return (
      <Press key={item.id} onPress={() => setOpenId(item.id)} style={[{ width: colW, borderRadius: 16, padding: 8, overflow: "hidden" }, cardLook(rar ? RARITY_COLOR[rar] : "#64748b", rar === "legendary" ? 0.36 : 0.26)]}>
        <ItemArt item={item} w={artW} wear={item.kind === "accessory" ? [] : equippedWear} who={who} />
        {rar ? <View style={{ position: "absolute", left: 12, top: 12 }}><RarityChip r={rar} /></View> : null}
        {percentOff > 0 ? <Text style={{ position: "absolute", right: 12, top: 12, backgroundColor: "#f43f5e", color: "#fff", fontSize: 10, lineHeight: 14, fontWeight: "900", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: "hidden" }}>−{percentOff}%</Text> : null}
        <Text numberOfLines={1} style={{ marginTop: 8, color: "#f1f5f9", fontSize: 13.5, lineHeight: 18, fontWeight: "900" }}>{itemName(item)}</Text>
        <Text numberOfLines={2} style={{ marginTop: 2, minHeight: 28, color: SLATE400, fontSize: 11, lineHeight: 14, fontWeight: "600" }}>{blurb}</Text>
        <View style={{ marginTop: 6, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 4 }}>
          {!isConsumable(item) && owns(state, item.id) ? <View /> : <PriceLine item={item} state={state} ctx={ctx} dateKey={dateKey} />}
          {bootLine ? <Text style={{ color: "#6ee7b7", fontSize: 11, fontWeight: "900" }}>{bootLine}</Text> : <StateBadge item={item} state={state} equipped={inUse(item, state)} />}
        </View>
      </Press>
    );
  };
  const grid = (items: StoreItem[]) => <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>{items.filter(shown).map(itemCard)}</View>;
  const sectionNote = (left: string, right: string) => (
    <View style={{ marginBottom: 12, marginTop: 4, flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
      <Text style={{ color: "#f1f5f9", fontSize: 15, lineHeight: 21, fontWeight: "900" }}>{left}</Text>
      <Text style={{ color: SLATE400, fontSize: 11, fontWeight: "700" }}>{right}</Text>
    </View>
  );
  const specials = dailySpecials(dateKey).filter((s) => { const it = findItem(s.itemId); return !!it && shown(it); });
  const head = specials[0];
  const headItem = head ? findItem(head.itemId) : undefined;
  const headRar = headItem ? rarityOf(headItem) ?? "rare" : "rare";

  return (
    <View style={{ flex: 1, backgroundColor: "#05080f" }}>
      <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundImage: `radial-gradient(90% 40% at 50% -6%, ${rgba(glow, 0.45)} 0%, rgba(0,0,0,0) 70%), radial-gradient(70% 35% at 50% 106%, rgba(245,158,11,0.18) 0%, rgba(0,0,0,0) 70%), linear-gradient(180deg, #0a1120 0%, #05080f 60%)` } as ViewStyle} />
      <GameTop career={career} help={null} />
      {/* ── Header: back, title, wallet ── */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }}>
        <BackPill onPress={() => nav.back()} />
        <Text style={{ color: "#fff", fontSize: 20, lineHeight: 26, fontWeight: "900", letterSpacing: 0.5, textShadowColor: rgba(glow, 0.5), textShadowRadius: 18 }}>STORE</Text>
        <View style={{ flex: 1 }} />
        <View style={pill}><Text style={{ color: "#fde047", fontSize: 13, fontWeight: "900" }}>★</Text><Text style={pillText}>{n(state.stars)}</Text></View>
        <Press onPress={() => setTab("coins")} style={pill}><CoinIcon size={16} /><Text style={pillText}>{n(state.coins)} +</Text></Press>
      </View>
      {/* ── Tabs: one row that scrolls sideways ── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0 }} contentContainerStyle={{ flexDirection: "row", gap: 4, paddingHorizontal: 16, paddingBottom: 8 }}>
        {TABS.map(([id, label]) => {
          const on = tab === id;
          return (
            <Press key={id} onPress={() => setTab(id)} style={[{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999 }, on ? ({ backgroundImage: "linear-gradient(180deg, #ffffff, #e2e8f0)", boxShadow: `0px 4px 14px -4px ${rgba(glow, 0.9)}` } as ViewStyle) : { backgroundColor: "rgba(255,255,255,0.07)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" }]}>
              <Text numberOfLines={1} style={{ color: on ? "#0f172a" : "#cbd5e1", fontSize: 13, lineHeight: 19, fontWeight: "900" }}>{label}</Text>
            </Press>
          );
        })}
      </ScrollView>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 96 + inset.bottom }}>
        {tab === "daily" && (<>
          <DailyHead />
          {headItem && head ? (
            <Press onPress={() => setOpenId(headItem.id)} style={[{ marginBottom: 12, flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 24, padding: 12, overflow: "hidden" }, cardLook(RARITY_COLOR[headRar], 0.42), { borderWidth: 2, borderColor: rgba(RARITY_COLOR[headRar], 0.7) }]}>
              <View style={{ width: "46%", paddingTop: 24 }}><ItemArt item={headItem} w={Math.round((vp.width - 32 - 24 - 12) * 0.46)} wear={headItem.kind === "accessory" ? [] : equippedWear} who={who} /></View>
              <View style={{ flex: 1, minWidth: 0, paddingTop: 24 }}>
                <Text style={{ color: "#f1f5f9", fontSize: 18, lineHeight: 22, fontWeight: "900" }}>{itemName(headItem)}</Text>
                <View style={{ marginTop: 4, flexDirection: "row", alignItems: "center", gap: 6 }}>
                  {rarityOf(headItem) ? <RarityChip r={rarityOf(headItem)!} /> : null}
                  <Text numberOfLines={1} style={{ flexShrink: 1, color: SLATE400, fontSize: 11, fontWeight: "700" }}>{headItem.kind === "animation" ? (headItem.set === "penalty" ? "Penalty run-up" : "Free-kick run-up") : headItem.kind === "accessory" ? SLOT_LABEL[headItem.slot] : headItem.kind === "boot" ? "Boots" : ""}</Text>
                </View>
                <View style={{ marginTop: 12 }}>{owns(state, headItem.id) && !isConsumable(headItem) ? <Text style={{ color: "#7dd3fc", fontSize: 12, fontWeight: "900" }}>Owned</Text> : <PriceLine item={headItem} state={state} ctx={ctx} dateKey={dateKey} />}</View>
                {(state.specialsBought[dateKey] ?? []).includes(headItem.id) ? <Text style={{ marginTop: 4, color: "#64748b", fontSize: 11, fontWeight: "700" }}>Bought today</Text> : null}
              </View>
              <Text style={{ position: "absolute", left: 12, top: 12, backgroundImage: "linear-gradient(180deg, #fcd34d, #f59e0b)", backgroundColor: "#fbbf24", color: "#451a03", fontSize: 10, lineHeight: 14, fontWeight: "900", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: "hidden", textTransform: "uppercase" } as never}>Today's pick</Text>
              <Text style={{ position: "absolute", right: 12, top: 12, backgroundColor: "#f43f5e", color: "#fff", fontSize: 13, lineHeight: 17, fontWeight: "900", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, overflow: "hidden" }}>−{head.percentOff}%</Text>
            </Press>
          ) : null}
          {grid(specials.slice(1).map((s) => findItem(s.itemId)).filter((x): x is StoreItem => !!x))}
        </>)}

        {tab === "animations" && (<>
          {(["penalty", "free_kick"] as AnimationSet[]).map((set) => (
            <View key={set} style={{ marginBottom: 20 }}>
              {sectionNote(ANIMATION_SET_LABEL[set], "Looks only")}
              {grid(ANIMATIONS.filter((a) => a.set === set))}
            </View>
          ))}
          <View style={{ marginBottom: 20 }}>
            {sectionNote("Goal celebrations", "After every goal you score")}
            {grid(ACCESSORIES.filter((a) => a.slot === "celebration"))}
          </View>
        </>)}

        {tab === "accessories" && (<>
          <View style={[{ marginBottom: 16, flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, padding: 12 }, cardLook(glow, 0.3)]}>
            <StoreFigure wear={equippedWear.filter((a) => a.slot !== "celebration")} width={140} height={150} signature={who} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: "#f1f5f9", fontSize: 15, fontWeight: "900" }}>Your player</Text>
              <View style={{ marginTop: 4, flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
                {equippedWear.length === 0 ? <Text style={{ color: SLATE400, fontSize: 12, lineHeight: 16, fontWeight: "600" }}>Nothing on yet — buy something below and tap Wear.</Text> : null}
                {equippedWear.map((w) => (
                  <Press key={w.id} onPress={() => setCareer(careerStoreUnequip(career, w.slot))} style={{ borderRadius: 999, backgroundColor: "rgba(255,255,255,0.1)", paddingHorizontal: 8, paddingVertical: 2 }}>
                    <Text style={{ color: "#e2e8f0", fontSize: 11, fontWeight: "700" }}>{w.name} ✕</Text>
                  </Press>
                ))}
              </View>
              <Text style={{ marginTop: 6, color: "#7dd3fc", fontSize: 11, fontWeight: "700" }}>{ACCESSORIES_IN_MATCH_NOTE}</Text>
            </View>
          </View>
          {grid(ACCESSORIES.filter((a) => a.slot !== "celebration"))}
        </>)}

        {tab === "boosts" && (<>
          <View style={{ marginBottom: 12, borderRadius: 12, borderWidth: 1, borderColor: "rgba(252,211,77,0.6)", backgroundColor: "rgba(251,191,36,0.15)", paddingHorizontal: 12, paddingVertical: 8 }}>
            <Text style={{ color: "#fff", fontSize: 12, lineHeight: 17, fontWeight: "900" }}>🚧 Future update — boots here are a preview. Buy and level boots in Shop → Boots.</Text>
          </View>
          <View style={{ marginBottom: 8, flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
            <Text style={{ color: "#fff", fontSize: 12, fontWeight: "900", letterSpacing: 0.6 }}>BOOTS · LEVEL {ctx.level}</Text>
            <Text style={{ color: "#fff", fontSize: 11, fontWeight: "600" }}>the real shop's boots and prices</Text>
          </View>
          {grid(bootsAtLevel(ctx.level))}
        </>)}

        {tab === "coins" && (<>
          <View style={{ marginBottom: 12, marginTop: 4, borderRadius: 16, borderWidth: 1, borderColor: coinPacksAreTestMode() ? "rgba(251,113,133,0.4)" : "rgba(255,255,255,0.1)", backgroundColor: coinPacksAreTestMode() ? "rgba(244,63,94,0.1)" : "rgba(255,255,255,0.04)", paddingHorizontal: 12, paddingVertical: 8 }}>
            <Text style={{ color: coinPacksAreTestMode() ? "#ffe4e6" : "#cbd5e1", fontSize: 12, fontWeight: "700" }}>{coinPacksAreTestMode() ? "Test mode — no payment is taken. Buy just adds the Coins." : "Buying Coins is coming soon."}</Text>
          </View>
          <View style={[{ marginBottom: 12, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10 }, cardLook("#f59e0b", 0.3)]}>
            <Text style={{ color: "#fffbeb", fontSize: 13, lineHeight: 18, fontWeight: "900" }}>100 Coins = about {value.weeks} weeks' wages at your level: <Text style={{ color: "#fde047" }}>★</Text>{n(value.stars)}</Text>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            {COIN_PACKS.map((p) => {
              const coinsNow = packCoinsNow(p, state.firstPackBought);
              const doubled = coinsNow > p.coins;
              const bonus = packBonusPercent(p);
              const test = coinPacksAreTestMode();
              return (
                <Press key={p.id} disabled={!test} onPress={() => run(careerBuyCoinPack(career, p.id), "Coins added — test, nothing charged")}
                  style={[{ width: colW, alignItems: "center", borderRadius: 16, padding: 12, paddingTop: 20, overflow: "hidden", opacity: 1 }, cardLook(p.bestValue ? "#fbbf24" : doubled ? "#34d399" : "#f59e0b", p.bestValue ? 0.42 : 0.24)]}>
                  {p.bestValue ? <Text style={banner("#fbbf24", "#451a03")}>BEST VALUE</Text> : null}
                  {doubled ? <Text style={banner("#34d399", "#022c22")}>FIRST PURCHASE ×2</Text> : null}
                  {RENDER[`coins-${p.id}`] ? <Image source={RENDER[`coins-${p.id}`]} resizeMode="contain" fadeDuration={0} style={{ width: colW - 24, height: 96 }} /> : <CoinIcon size={48} />}
                  <Text style={{ marginTop: 6, color: SLATE400, fontSize: 11, fontWeight: "900", letterSpacing: 0.3, textTransform: "uppercase" }}>{p.name}</Text>
                  <Text style={{ color: "#fffbeb", fontSize: 20, lineHeight: 26, fontWeight: "900", fontVariant: ["tabular-nums"] }}>{n(coinsNow)}</Text>
                  <Text style={{ height: 16, color: doubled ? SLATE400 : "#6ee7b7", fontSize: 11, lineHeight: 16, fontWeight: "900", textDecorationLine: doubled ? "line-through" : "none" }}>{doubled ? n(p.coins) : bonus > 0 ? `+${bonus}% bonus` : ""}</Text>
                  <Text style={{ marginTop: 4, color: SLATE400, fontSize: 10.5, fontWeight: "600" }}>≈ {n(coinsNow / COINS_PER_WAGE_WEEK)} weeks' wages</Text>
                  <View style={[{ marginTop: 8, alignSelf: "stretch", borderRadius: 12, paddingVertical: 6, alignItems: "center" }, test ? ({ backgroundImage: "linear-gradient(180deg, #ffffff, #e2e8f0)" } as ViewStyle) : { backgroundColor: "rgba(255,255,255,0.15)" }]}>
                    <Text style={{ color: test ? "#0f172a" : "#e2e8f0", fontSize: test ? 14 : 13, fontWeight: "900" }}>{test ? formatPounds(p.pounds) : "Coming soon"}</Text>
                  </View>
                </Press>
              );
            })}
          </View>
          <View style={[{ marginTop: 20, borderRadius: 16, padding: 12 }, cardLook("#fbbf24", 0.2)]}>
            <Text style={{ color: "#f1f5f9", fontSize: 14, fontWeight: "900" }}>Swap Coins for ★</Text>
            <Text style={{ marginBottom: 8, color: SLATE400, fontSize: 11.5, fontWeight: "600" }}>At your wage of <Text style={{ color: "#fde047" }}>★</Text><Text style={{ color: "#f1f5f9", fontWeight: "900" }}>{n(ctx.weeklyWage)}</Text> a week.</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {[100, 500, 1000].map((c) => (
                <Press key={c} disabled={state.coins < c} onPress={() => run(careerConvertCoins(career, c), `+★${n(coinsToStars(c, ctx.weeklyWage))}`)}
                  style={{ flex: 1, alignItems: "center", borderRadius: 12, paddingVertical: 8, backgroundColor: "rgba(255,255,255,0.1)", borderWidth: 1, borderColor: "rgba(255,255,255,0.15)", opacity: state.coins < c ? 0.35 : 1 }}>
                  <Coins v={c} color="#fff" />
                  <Text style={{ marginTop: 2, color: "#cbd5e1", fontSize: 12, fontWeight: "900" }}>→ <Text style={{ color: "#fde047" }}>★</Text>{n(coinsToStars(c, ctx.weeklyWage))}</Text>
                </Press>
              ))}
            </View>
          </View>
          {state.log.length > 0 ? (
            <View style={{ marginTop: 20 }}>
              <Text style={{ marginBottom: 6, color: SLATE400, fontSize: 12, fontWeight: "900", letterSpacing: 0.6 }}>RECEIPTS</Text>
              {state.log.slice(0, 8).map((l, i) => <View key={i} style={{ marginBottom: 4, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.03)", paddingHorizontal: 10, paddingVertical: 6 }}><Text style={{ color: "#cbd5e1", fontSize: 11.5, fontWeight: "600" }}>{l.what}</Text></View>)}
            </View>
          ) : null}
        </>)}
      </ScrollView>

      {open ? (
        <DetailSheet item={open} state={state} ctx={ctx} dateKey={dateKey} wear={equippedWear} who={who} bootLine={open.kind === "boot" ? careerBootStatus(career, open.id) : null}
          onClose={() => setOpenId(null)} onBuy={buy}
          onEquip={(id) => run(careerStoreEquip(career, id), "")}
          onUnequip={(slot) => setCareer(careerStoreUnequip(career, slot))} />
      ) : null}
      {toast ? (
        <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: inset.top + 12, alignItems: "center", zIndex: 50 }}>
          <View style={{ borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8, backgroundImage: toast.ok ? "linear-gradient(180deg, #6ee7b7, #10b981)" : "linear-gradient(180deg, #fb7185, #e11d48)" } as ViewStyle}>
            <Text numberOfLines={1} style={{ color: toast.ok ? "#022c22" : "#fff", fontSize: 13, fontWeight: "900" }}>{toast.ok ? "✓ " : ""}{toast.text}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const pill: ViewStyle = { height: 32, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.1)", borderWidth: 1, borderColor: "rgba(255,255,255,0.14)" };
const pillText = { color: "#fff", fontSize: 13, fontWeight: "900", fontVariant: ["tabular-nums"] } as const;
const banner = (bg: string, ink: string) => ({ position: "absolute", left: 0, right: 0, top: 0, backgroundColor: bg, color: ink, textAlign: "center", fontSize: 10, lineHeight: 14, fontWeight: "900", letterSpacing: 0.6, paddingVertical: 2 } as const);

/** "Daily specials / Same for everyone today" and the "⏱ New in 3h 12m" chip: the one part that ticks. */
function DailyHead() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  return (
    <View style={{ marginBottom: 12, marginTop: 4, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 8 }}>
      <View style={{ flexShrink: 1 }}>
        <Text numberOfLines={1} style={{ color: "#f1f5f9", fontSize: 15, lineHeight: 21, fontWeight: "900" }}>Daily specials</Text>
        <Text numberOfLines={1} style={{ color: SLATE400, fontSize: 11, lineHeight: 16, fontWeight: "700" }}>Same for everyone today</Text>
      </View>
      <Text numberOfLines={1} style={{ color: "#fef3c7", fontSize: 12, lineHeight: 18, fontWeight: "900", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.1)", borderWidth: 1, borderColor: "rgba(252,211,77,0.25)", fontVariant: ["tabular-nums"] }}>⏱ New in {formatCountdown(msUntilReset(now))}</Text>
    </View>
  );
}

/** An item's sheet (StoreView DetailSheet): rarity and Cosmetic / Helps you win, the big picture, what it is, the two buy buttons or Wear / Use. */
function DetailSheet({ item, state, ctx, dateKey, wear, who, bootLine, onClose, onBuy, onEquip, onUnequip }: {
  item: StoreItem; state: StoreState; ctx: PriceContext; dateKey: string; wear: AccessoryItem[]; who: Who; bootLine: string | null;
  onClose: () => void; onBuy: (id: string, c: Currency) => void; onEquip: (id: string) => void; onUnequip: (slot: AccessoryItem["slot"]) => void;
}) {
  const inset = useSafeAreaInsets();
  const vp = useWindowDimensions();
  const rar = rarityOf(item);
  const { price, full, percentOff } = priceNow(item, ctx, state, dateKey);
  const owned = owns(state, item.id);
  const consumable = isConsumable(item);
  const p2w = isPayToWin(item);
  const wearing = inUse(item, state);
  const setWord = item.kind === "animation" ? (item.set === "penalty" ? "penalty" : "free-kick") : "";
  const celeb = item.kind === "accessory" && item.slot === "celebration";
  const desc = item.kind === "animation" ? `${item.set === "penalty" ? "Penalty" : "Free-kick"} run-up · ${item.blurb}`
    : item.kind === "accessory" ? (celeb ? "Celebration · after every goal you score" : `${SLOT_LABEL[item.slot]} · worn over your kit`)
      : item.kind === "boost" ? item.effect
        : `+${item.boot.power} power · +${item.boot.technique} technique · ${item.boot.matches} matches${item.boot.curve ? " · curves the ball" : ""}${item.boot.extraTouch ? " · extra touch" : ""}`;
  const tone = rar ? RARITY_COLOR[rar] : "#8b5cf6";
  const big = (label: string, kind: "primary" | "secondary", onPress: () => void) => (
    <Pressable onPress={onPress} style={[{ borderRadius: 16, paddingVertical: 12, alignItems: "center" }, kind === "primary" ? ({ backgroundImage: "linear-gradient(180deg, #34d399, #059669)" } as ViewStyle) : { backgroundColor: "rgba(255,255,255,0.1)", borderWidth: 1, borderColor: "rgba(255,255,255,0.15)" }]}>
      <Text style={{ color: "#fff", fontSize: 15, fontWeight: "900" }}>{label}</Text>
    </Pressable>
  );
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable onPress={onClose} style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.6)" }} />
        <View style={{ maxHeight: vp.height * 0.92, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderColor: "rgba(255,255,255,0.1)", overflow: "hidden", backgroundImage: `radial-gradient(100% 45% at 50% 0%, ${rgba(tone, 0.28)} 0%, rgba(0,0,0,0) 70%), linear-gradient(180deg, #0f172a, #070b14)` } as ViewStyle}>
          <ScrollView bounces={false} contentContainerStyle={{ padding: 16, paddingBottom: 16 + inset.bottom }}>
            <View style={{ alignSelf: "center", marginBottom: 12, height: 4, width: 40, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.2)" }} />
            <View style={{ marginBottom: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                {rar ? <RarityChip r={rar} /> : null}
                <Text style={{ backgroundColor: p2w ? "rgba(251,191,36,0.2)" : "rgba(255,255,255,0.1)", color: p2w ? "#fde68a" : "#cbd5e1", fontSize: 10, lineHeight: 14, fontWeight: "900", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, overflow: "hidden", textTransform: "uppercase" }}>{p2w ? "Helps you win" : "Cosmetic"}</Text>
              </View>
              <Press onPress={onClose} style={{ width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.1)" }}><Text style={{ color: "#fff", fontSize: 15, fontWeight: "900" }}>✕</Text></Press>
            </View>
            <View style={{ alignSelf: "center" }}><ItemArt item={item} w={Math.min(300, vp.width - 32)} wear={item.kind === "accessory" ? wear : undefined} who={who} /></View>
            <View style={{ marginTop: 12, flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ flexShrink: 1, color: "#f1f5f9", fontSize: 20, lineHeight: 26, fontWeight: "900" }}>{itemName(item)}</Text>
              {percentOff > 0 ? <Text style={{ backgroundColor: "#f43f5e", color: "#fff", fontSize: 11, lineHeight: 15, fontWeight: "900", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: "hidden" }}>−{percentOff}% today</Text> : null}
            </View>
            <Text style={{ marginTop: 2, color: SLATE400, fontSize: 13, lineHeight: 18, fontWeight: "600" }}>{desc}</Text>
            {item.kind === "accessory" && !celeb ? <Text style={{ marginTop: 4, color: "#7dd3fc", fontSize: 11, fontWeight: "700" }}>{ACCESSORIES_IN_MATCH_NOTE}</Text> : null}
            {bootLine ? <Text style={{ marginTop: 4, color: "#6ee7b7", fontSize: 12, fontWeight: "900" }}>{bootLine}</Text> : null}
            <View style={{ marginTop: 16, gap: 8 }}>
              {(!owned || consumable) && price.stars > 0 ? (<>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Pressable disabled={state.stars < price.stars} onPress={() => onBuy(item.id, "stars")} style={{ flex: 1, borderRadius: 16, paddingVertical: 12, alignItems: "center", opacity: state.stars < price.stars ? 0.35 : 1, backgroundImage: "linear-gradient(180deg, #fde68a, #f59e0b)" } as ViewStyle}>
                    <Text style={{ color: "#0f172a", fontSize: 15, fontWeight: "900" }}>★{n(price.stars)}</Text>
                    {percentOff > 0 ? <Text style={{ color: "rgba(15,23,42,0.6)", fontSize: 10, fontWeight: "700", textDecorationLine: "line-through" }}>★{n(full.stars)}</Text> : null}
                  </Pressable>
                  <Pressable disabled={state.coins < price.coins} onPress={() => onBuy(item.id, "coins")} style={{ flex: 1, borderRadius: 16, paddingVertical: 12, alignItems: "center", opacity: state.coins < price.coins ? 0.35 : 1, backgroundImage: "linear-gradient(180deg, #fbbf24, #d97706)" } as ViewStyle}>
                    <Coins v={price.coins} size={15} color="#451a03" />
                    {percentOff > 0 ? <Text style={{ color: "rgba(69,26,3,0.6)", fontSize: 10, fontWeight: "700", textDecorationLine: "line-through" }}>{n(full.coins)}</Text> : null}
                  </Pressable>
                </View>
                {state.stars < price.stars && state.coins < price.coins ? (
                  <View style={{ borderRadius: 12, backgroundColor: "rgba(244,63,94,0.15)", paddingHorizontal: 12, paddingVertical: 8 }}>
                    <Text style={{ color: "#fecdd3", fontSize: 12, lineHeight: 17, fontWeight: "900", textAlign: "center" }}>Not enough yet: you need ★{n(price.stars - state.stars)} more, or {n(price.coins - state.coins)} more Coins</Text>
                  </View>
                ) : null}
                <Text style={{ color: "#64748b", fontSize: 11, fontWeight: "600", textAlign: "center" }}>About {price.weeks < 1 ? price.weeks.toFixed(1) : Math.round(price.weeks * 10) / 10} week{price.weeks === 1 ? "" : "s"} of your wages either way</Text>
              </>) : null}
              {owned && !consumable && (item.kind === "animation" || item.kind === "accessory") ? (
                wearing
                  ? item.kind === "accessory"
                    ? big(celeb ? "Stop using it" : "Take off", "secondary", () => onUnequip(item.slot))
                    : <View style={{ borderRadius: 16, backgroundColor: "rgba(16,185,129,0.2)", paddingVertical: 12 }}><Text style={{ color: "#a7f3d0", fontSize: 15, fontWeight: "900", textAlign: "center" }}>✓ Your {setWord} run-up</Text></View>
                  : big(item.kind === "animation" ? `Use for ${setWord === "penalty" ? "penalties" : "free kicks"}` : celeb ? "Use after my goals" : "Wear", "primary", () => onEquip(item.id))
              ) : null}
              {owned && item.kind === "boot" ? <View style={{ borderRadius: 16, backgroundColor: "rgba(14,165,233,0.15)", paddingVertical: 12 }}><Text style={{ color: "#bae6fd", fontSize: 14, fontWeight: "900", textAlign: "center" }}>Owned</Text></View> : null}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
