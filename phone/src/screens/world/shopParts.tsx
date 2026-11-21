/**
 * THE SHOP'S SHEET PIECES (the website's components/star/shop2d/parts.tsx and
 * StyleShop.tsx SaveUp): the sheet with its coloured top edge, the trophy level
 * ladder L1–L5 with prices, the "what it gives" tiles, the save-up box, the
 * full-width gold button, the confirm sheet (Price · Left after) and the
 * purchase moment (gold burst, the item drops in, "Yours!").
 * Same words, sizes and colours as the website.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Easing, Image, Modal, Pressable, ScrollView, Text, View, useWindowDimensions, type ImageSourcePropType, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatMoney } from "@/lib/star/money";
import { weeksOfWallet } from "@/lib/star/economy";
import { Press } from "../../ui/Press";
import { rgba } from "../../world/ui";

export const RANK: ImageSourcePropType[] = [
  require("../../../assets/look/ui/rank-1.webp"), require("../../../assets/look/ui/rank-2.webp"), require("../../../assets/look/ui/rank-3.webp"),
  require("../../../assets/look/ui/rank-4.webp"), require("../../../assets/look/ui/rank-5.webp"),
];
const BURST: ImageSourcePropType = require("../../../assets/look/ui/burst.webp");
export const FX: Record<string, ImageSourcePropType> = {
  "fx-energy": require("../../../assets/look/ui/fx-energy.webp"), "fx-curve": require("../../../assets/look/ui/fx-curve.webp"),
  "fx-touch": require("../../../assets/look/ui/fx-touch.webp"), "fx-power": require("../../../assets/look/ui/fx-power.webp"),
};

/** Each level's colour (bronze, sapphire, ruby, amethyst, gold). */
export const TIER_COLOUR = ["#c08457", "#60a5fa", "#f87171", "#c084fc", "#fbbf24"] as const;
export const tierColour = (lv: number) => TIER_COLOUR[Math.max(1, Math.min(5, lv)) - 1];

/** "0.10 wks" (ShopSheet.tsx weeksText). */
export function weeksText(weeks: number): string {
  if (!Number.isFinite(weeks)) return "";
  if (weeks >= 100) return `${Math.round(weeks)} wks`;
  if (weeks >= 10) return `${weeks.toFixed(0)} wks`;
  if (weeks >= 1) return `${weeks.toFixed(1)} wks`;
  return `${weeks.toFixed(2)} wks`;
}

/** The sheet: rises from the bottom, a 2 px edge in the accent, a grab bar, the title in spaced caps, ×. */
export function StoreSheet({ open, onClose, title, accent = "#fbbf24", children }: { open: boolean; onClose: () => void; title: string; accent?: string; children: ReactNode }) {
  const inset = useSafeAreaInsets();
  const vp = useWindowDimensions();
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable onPress={onClose} style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.7)" }} />
        <View style={{ maxHeight: vp.height * 0.9, borderTopWidth: 2, borderTopColor: accent, backgroundImage: "linear-gradient(180deg, rgba(14,20,38,0.99), rgba(7,11,22,1))", boxShadow: `0px -14px 44px -12px ${rgba(accent, 0.67)}` } as ViewStyle}>
          <ScrollView bounces={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 + inset.bottom }}>
            <View style={{ alignSelf: "center", width: 40, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.25)", marginBottom: 8 }} />
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
              <Text numberOfLines={1} style={{ flex: 1, color: accent, fontSize: 12, lineHeight: 16, fontWeight: "900", letterSpacing: 2.4, textTransform: "uppercase" }}>{title}</Text>
              <Press onPress={onClose} style={{ width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.1)" }}>
                <Text style={{ color: "#fff", fontSize: 18, lineHeight: 20, fontWeight: "900" }}>×</Text>
              </Press>
            </View>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/** The picture's lit box (4:3), tinted in the level's colour. */
export function PicBox({ lv, children }: { lv: number; children: ReactNode }) {
  return (
    <View style={{ width: "100%", aspectRatio: 4 / 3, borderRadius: 10, overflow: "hidden", alignItems: "center", justifyContent: "center", backgroundColor: "#0a1120",
      backgroundImage: `radial-gradient(70% 60% at 50% 45%, rgba(255,255,255,0.14), rgba(255,255,255,0) 70%), radial-gradient(90% 70% at 50% 50%, ${rgba(tierColour(lv), 0.2)}, rgba(0,0,0,0) 75%)` } as ViewStyle}>
      {children}
    </View>
  );
}

export interface Rung { level: number; price: number; owned?: boolean; sold?: boolean }

/** THE LEVEL LADDER: five trophies on one line, bronze to gold. The one you own has a tick, the one shown is lit; tap one to look at it. */
export function LevelLadder({ rungs, selected, onPick }: { rungs: Rung[]; selected: number; onPick: (lv: number) => void }) {
  const ownedLv = Math.max(0, ...rungs.filter((r) => r.owned).map((r) => r.level));
  const n = rungs.length;
  return (
    <View style={{ marginTop: 12, borderRadius: 4, backgroundColor: "rgba(0,0,0,0.3)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", paddingHorizontal: 4, paddingBottom: 8, paddingTop: 10 }}>
      <View pointerEvents="none" style={{ position: "absolute", left: "10%", right: "10%", top: 30, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.1)" }} />
      <View pointerEvents="none" style={{ position: "absolute", left: "10%", top: 30, height: 4, borderRadius: 2, width: `${n > 1 ? Math.max(0, (ownedLv - 1) / (n - 1)) * 80 : 0}%`, backgroundImage: "linear-gradient(90deg,#c08457,#60a5fa,#f87171,#c084fc,#fbbf24)" } as ViewStyle} />
      <View style={{ flexDirection: "row" }}>
        {rungs.map((r) => {
          const on = r.level === selected;
          const above = r.level > ownedLv;
          const s = on ? 44 : 34;
          return (
            <Press key={r.level} onPress={() => onPick(r.level)} style={{ flex: 1, alignItems: "center", gap: 2 }}>
              <View style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
                {on ? <View pointerEvents="none" style={{ position: "absolute", left: -6, right: -6, top: -6, bottom: -6, borderRadius: 30, backgroundImage: `radial-gradient(closest-side, ${rgba(tierColour(r.level), 0.6)}, ${rgba(tierColour(r.level), 0)})` } as ViewStyle} /> : null}
                <Image source={RANK[Math.max(1, Math.min(5, r.level)) - 1]} fadeDuration={0} style={{ width: s, height: s, opacity: above && !on ? 0.55 : 1 }} />
                {r.owned ? (
                  <View style={{ position: "absolute", right: -2, bottom: -2, width: 16, height: 16, borderRadius: 8, backgroundColor: "#34d399", borderWidth: 2, borderColor: "#070b16", alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ color: "#022c22", fontSize: 8, lineHeight: 10, fontWeight: "900" }}>✓</Text>
                  </View>
                ) : null}
              </View>
              <Text style={{ color: on ? "#fff" : "rgba(255,255,255,0.65)", fontSize: 10, lineHeight: 11, fontWeight: "900" }}>{n === 1 ? "" : `L${r.level}`}</Text>
              <Text style={{ color: r.sold ? "#fca5a5" : on ? "#fde047" : "rgba(253,224,71,0.6)", fontSize: 10, lineHeight: 11, fontWeight: "900", fontVariant: ["tabular-nums"] }}>{r.sold ? "SOLD" : formatMoney(r.price)}</Text>
            </Press>
          );
        })}
      </View>
    </View>
  );
}

/** "What it gives": up to three tiles, a big value over a small caps label (a delta under it when upgrading). */
export function GiveChips({ items }: { items: { label: string; value: string; delta?: string; color: string }[] }) {
  return (
    <View style={{ flexDirection: "row", gap: 6 }}>
      {items.map((it) => (
        <View key={it.label} style={{ flex: 1, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", paddingHorizontal: 6, paddingVertical: 6, alignItems: "center" }}>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ color: it.color, fontSize: 16, lineHeight: 20, fontWeight: "900", fontVariant: ["tabular-nums"] }}>{it.value}</Text>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ color: "rgba(255,255,255,0.7)", fontSize: 9.5, lineHeight: 14, fontWeight: "900", letterSpacing: 0.3, textTransform: "uppercase" }}>{it.label}</Text>
          {it.delta ? <Text style={{ color: "#6ee7b7", fontSize: 10, lineHeight: 14, fontWeight: "900" }}>{it.delta}</Text> : null}
        </View>
      ))}
    </View>
  );
}

/** "You need ★850 more": the red save-up box with its bar. */
export function SaveUp({ have, need, wage }: { have: number; need: number; wage: number }) {
  const short = Math.max(0, need - have);
  const pct = Math.max(3, Math.min(100, (have / need) * 100));
  return (
    <View style={{ marginTop: 8, borderRadius: 12, backgroundColor: "rgba(239,68,68,0.1)", borderWidth: 1, borderColor: "rgba(248,113,113,0.4)", padding: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <Text style={{ color: "#fff", fontSize: 12, lineHeight: 16, fontWeight: "900" }}>You need ★{formatMoney(short)} more</Text>
        <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 10.5, lineHeight: 15, fontWeight: "700" }}>{weeksText(weeksOfWallet(short, wage))} of income</Text>
      </View>
      <View style={{ marginTop: 6, height: 8, borderRadius: 4, backgroundColor: "rgba(0,0,0,0.4)", overflow: "hidden" }}>
        <View style={{ width: `${pct}%`, height: "100%", borderRadius: 4, backgroundImage: "linear-gradient(90deg, #f59e0b, #fde047)" } as ViewStyle} />
      </View>
      <Text style={{ marginTop: 4, color: "rgba(255,255,255,0.8)", fontSize: 10, lineHeight: 14, fontWeight: "700" }}>You have ★{formatMoney(have)}. Play matches to earn your wage.</Text>
    </View>
  );
}

/** The big gold buy button, full width (grey when you can't, red for the black market). */
export function GoldButton({ label, disabled, danger, onPress, style }: { label: string; disabled?: boolean; danger?: boolean; onPress: () => void; style?: ViewStyle }) {
  const look: ViewStyle = disabled
    ? { backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" }
    : danger
      ? ({ backgroundImage: "linear-gradient(180deg,#f87171,#b91c1c)", boxShadow: "inset 0px 1px 0px rgba(255,255,255,0.4), 0px 8px 20px -8px rgba(220,38,38,0.9)" } as ViewStyle)
      : ({ backgroundImage: "linear-gradient(180deg,#fde68a,#f59e0b 55%,#d97706)", boxShadow: "inset 0px 1px 0px rgba(255,255,255,0.6), inset 0px -2px 0px rgba(120,53,15,0.5), 0px 8px 22px -8px rgba(245,158,11,0.95)" } as ViewStyle);
  return (
    <Pressable disabled={disabled} onPress={onPress} style={[{ borderRadius: 4, paddingVertical: 12, paddingHorizontal: 8, alignItems: "center", justifyContent: "center" }, look, style]}>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ color: disabled ? "rgba(255,255,255,0.55)" : danger ? "#fff" : "#1c1203", fontSize: 15, lineHeight: 20, fontWeight: "900", letterSpacing: 0.4, textTransform: "uppercase" }}>{label}</Text>
    </Pressable>
  );
}
/** The grey twin beside it (Use one, Cancel). */
export function GreyButton({ label, disabled, onPress, style }: { label: string; disabled?: boolean; onPress: () => void; style?: ViewStyle }) {
  return (
    <Pressable disabled={disabled} onPress={onPress} style={[{ borderRadius: 4, paddingVertical: 12, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.15)", opacity: disabled ? 0.35 : 1 }, style]}>
      <Text numberOfLines={1} style={{ color: "#fff", fontSize: 14, lineHeight: 20, fontWeight: "900", letterSpacing: 0.4, textTransform: "uppercase" }}>{label}</Text>
    </Pressable>
  );
}

// ── Confirm, then the purchase moment ───────────────────────────────────────

export interface ConfirmInfo {
  title: string; sub?: string; level: number; price: number; pic: ReactNode; verb: string; note?: string;
  /** The black market: lawyers and the risk. */
  blackMarket?: { lawyerFee: number; lawyerPrice: (lawyers: boolean) => number };
}

/** "Are you sure?": the item, its price, what you'll have left. */
export function ConfirmSheet({ info, money, onCancel, onConfirm }: { info: ConfirmInfo | null; money: number; onCancel: () => void; onConfirm: (lawyers: boolean) => string | void }) {
  const [lawyers, setLawyers] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { setLawyers(false); setMsg(null); }, [info?.title]);
  if (!info) return null;
  const price = info.blackMarket ? info.blackMarket.lawyerPrice(lawyers) : info.price;
  const after = money - price;
  const ok = after >= 0;
  const tile = (big: string, small: string, color: string) => (
    <View style={{ flex: 1, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", paddingVertical: 6, alignItems: "center" }}>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ color, fontSize: 15, lineHeight: 20, fontWeight: "900", fontVariant: ["tabular-nums"] }}>{big}</Text>
      <Text style={{ color: "rgba(255,255,255,0.65)", fontSize: 9, lineHeight: 13, fontWeight: "900", letterSpacing: 0.3, textTransform: "uppercase" }}>{small}</Text>
    </View>
  );
  return (
    <StoreSheet open onClose={onCancel} title={info.blackMarket ? "Black market" : "Confirm purchase"} accent={info.blackMarket ? "#ef4444" : "#fbbf24"}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ width: 96, height: 128, borderRadius: 8, borderWidth: 2, borderColor: tierColour(info.level), backgroundColor: "#0a1120", alignItems: "center", justifyContent: "center", padding: 6, overflow: "hidden" }}>{info.pic}</View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: "#fff", fontSize: 20, lineHeight: 24, fontWeight: "900" }}>{info.title}</Text>
          {info.sub ? <Text style={{ marginTop: 2, color: "rgba(255,255,255,0.8)", fontSize: 11.5, lineHeight: 16, fontWeight: "700" }}>{info.sub}</Text> : null}
          <View style={{ marginTop: 8, flexDirection: "row", gap: 6 }}>
            {tile(`★${formatMoney(price)}`, "Price", "#fde047")}
            {tile(ok ? `★${formatMoney(after)}` : `−★${formatMoney(-after)}`, ok ? "Left after" : "Short", ok ? "#fff" : "#fca5a5")}
          </View>
        </View>
      </View>
      {info.note ? <Text style={{ marginTop: 8, color: "rgba(255,255,255,0.8)", fontSize: 11, lineHeight: 15, fontWeight: "700" }}>{info.note}</Text> : null}
      {info.blackMarket ? (
        <View style={{ marginTop: 12, borderRadius: 4, backgroundColor: "rgba(69,10,10,0.6)", borderWidth: 1, borderColor: "rgba(220,38,38,0.7)", padding: 10 }}>
          <Text style={{ color: "#fee2e2", fontSize: 11, lineHeight: 15, fontWeight: "700" }}>Banned by the FA — a real chance of getting caught buying it anyway.</Text>
          <Press onPress={() => setLawyers((l) => !l)} style={{ marginTop: 8, flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ width: 16, height: 16, borderRadius: 3, borderWidth: 1.5, borderColor: "#fff", backgroundColor: lawyers ? "#fbbf24" : "transparent", alignItems: "center", justifyContent: "center" }}>
              {lawyers ? <Text style={{ color: "#111", fontSize: 10, lineHeight: 12, fontWeight: "900" }}>✓</Text> : null}
            </View>
            <Text style={{ flex: 1, color: "rgba(255,255,255,0.9)", fontSize: 11, lineHeight: 15, fontWeight: "700" }}>Hire lawyers first (★{formatMoney(info.blackMarket.lawyerFee)} — cuts the risk a lot, doesn't remove it)</Text>
          </Press>
        </View>
      ) : null}
      {msg ? <View style={{ marginTop: 8, borderRadius: 4, backgroundColor: "rgba(239,68,68,0.15)", borderWidth: 1, borderColor: "rgba(248,113,113,0.4)", padding: 8 }}><Text style={{ color: "#fecaca", fontSize: 11.5, fontWeight: "900", textAlign: "center" }}>{msg}</Text></View> : null}
      <View style={{ marginTop: 12, flexDirection: "row", gap: 8 }}>
        <GreyButton label="Cancel" onPress={onCancel} style={{ flex: 1 }} />
        <GoldButton style={{ flex: 1.8 }} danger={!!info.blackMarket} disabled={!ok} label={ok ? `${info.verb} ★${formatMoney(price)}` : "Not enough money"} onPress={() => { const r = onConfirm(lawyers); if (r) setMsg(r); }} />
      </View>
    </StoreSheet>
  );
}

export interface Moment { pic: ReactNode; level: number; title: string; word?: string; fx?: string }

/**
 * THE PURCHASE MOMENT: the screen dims, the gold burst spins out, the thing you
 * bought drops in under its level's trophy, and a word says what happened.
 * Tap to skip; it closes itself after about 1.7 s.
 */
export function PurchaseMoment({ m, onDone }: { m: Moment; onDone: () => void }) {
  const t = useRef(new Animated.Value(0)).current;
  const done = useRef(onDone); done.current = onDone;
  useEffect(() => {
    Animated.timing(t, { toValue: 1, duration: 1600, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    const id = setTimeout(() => done.current(), 1750);
    return () => clearTimeout(id);
  }, [t]);
  const drop = { opacity: t.interpolate({ inputRange: [0, 0.12, 1], outputRange: [0, 1, 1] }),
    transform: [{ translateY: t.interpolate({ inputRange: [0, 0.24, 0.33, 0.44, 1], outputRange: [-60, 6, -3, 0, 0] }) }, { scale: t.interpolate({ inputRange: [0, 0.24, 0.33, 0.44, 1], outputRange: [0.4, 1.12, 0.97, 1, 1] }) }] };
  const word = { opacity: t.interpolate({ inputRange: [0, 0.17, 0.34, 1], outputRange: [0, 0, 1, 1] }),
    transform: [{ translateY: t.interpolate({ inputRange: [0, 0.17, 0.34, 1], outputRange: [16, 16, 0, 0] }) }, { scale: t.interpolate({ inputRange: [0, 0.17, 0.34, 1], outputRange: [0.8, 0.8, 1, 1] }) }] };
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onDone}>
      <Pressable onPress={onDone} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.75)", alignItems: "center", justifyContent: "center" }}>
        <View style={{ width: 340, height: 340, alignItems: "center", justifyContent: "center" }}>
          <Animated.Image source={BURST} fadeDuration={0} style={{ position: "absolute", width: 340, height: 340,
            opacity: t.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0, 1, 0] }),
            transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1.25] }) }, { rotate: t.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "40deg"] }) }] }} />
          {m.fx && FX[m.fx] ? <Animated.Image source={FX[m.fx]} fadeDuration={0} style={{ position: "absolute", width: 218, height: 218,
            opacity: t.interpolate({ inputRange: [0, 0.19, 0.62, 1], outputRange: [0, 0.9, 0.6, 0.6] }), transform: [{ scale: t.interpolate({ inputRange: [0, 0.62, 1], outputRange: [0.5, 1.1, 1.1] }) }] }} /> : null}
          <Animated.View style={[{ alignItems: "center" }, drop]}>
            <Image source={RANK[Math.max(1, Math.min(5, m.level)) - 1]} fadeDuration={0} style={{ width: 40, height: 40, marginBottom: -10, zIndex: 1 }} />
            <View style={{ width: 170, height: 130, alignItems: "center", justifyContent: "center" }}>{m.pic}</View>
          </Animated.View>
        </View>
        <Animated.View pointerEvents="none" style={[{ alignItems: "center", marginTop: -40, paddingHorizontal: 16 }, word]}>
          <Text style={{ color: "#fde047", fontSize: 34, lineHeight: 38, fontWeight: "900", textTransform: "uppercase", textShadowColor: "rgba(0,0,0,0.9)", textShadowRadius: 16, textShadowOffset: { width: 0, height: 3 } }}>{m.word ?? "Purchased!"}</Text>
          <Text style={{ marginTop: 4, color: "#fff", fontSize: 14, lineHeight: 19, fontWeight: "900", textAlign: "center" }}>{m.title}</Text>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}
