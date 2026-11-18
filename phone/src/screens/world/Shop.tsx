/**
 * THE SHOP — the phone port of the website's showroom
 * (components/star/shop2d/ShowroomShop.tsx). Same categories in the same
 * order (Cans, Boots, Drip, Gadgets, Cars, Homes, Holiday), the same items,
 * levels, prices, fame, "lasts" and lock rules, bought through the same
 * rules (world/shop.ts, a port of page.tsx's buy handlers).
 *
 * Phone-native layout: a category row on top, one card per item in a
 * FlatList, a level picker on each card, and a confirm sheet before money
 * leaves. Pictures are placeholders (a big icon) until the DRAWING area's
 * drawings land.
 */
import { useMemo, useState } from "react";
import { FlatList, Modal, Text, View } from "react-native";
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
import { C } from "../../ui/theme";
import { ScreenFrame, Chips, Btn, Note, rgba } from "../../world/ui";
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

/** The keys (can id / boot base / style base) in each category, in shop order. */
const KEYS: Record<CatId, string[]> = (() => {
  const out = { cans: KIB_CANS.map((c) => c.id), boots: [] as string[] } as Record<CatId, string[]>;
  for (const g of ["drip", "gadgets", "cars", "homes", "holiday"] as StyleGroup[]) {
    out[g] = Array.from(STYLE_BASES.keys()).filter((b) => styleGroupOf(STYLE_BASES.get(b)![0]) === g);
  }
  return out;
})();

interface Confirm { title: string; sub: string; price: number; verb: string; note?: string; black?: Boot; run: (lawyers: boolean) => Bought }

export function ShopScreen({ params }: { params?: Record<string, unknown> }) {
  const career = useCareer();
  const nav = useNav();
  const start = (params?.cat as CatId | undefined) ?? "cans";
  const [cat, setCat] = useState<CatId>(start);
  const [note, setNote] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [pick, setPick] = useState<Record<string, number>>({});
  const flash = (t: string) => { setNote(t); setTimeout(() => setNote((n) => (n === t ? null : n)), 3500); };
  const boots = useMemo(() => (career ? bootsForSale(career) : []), [career]);
  if (!career) return null;
  const accent = SHOP_CATS.find((c) => c.id === cat)!.accent;
  const keys = cat === "boots" ? BOOT_ORDER.filter((b) => boots.some((x) => baseIdOf(x) === b)) : KEYS[cat];
  const apply = (r: Bought, done: string) => {
    if (!r.ok) { flash(r.reason ?? "Can't do that"); return; }
    setCareer(r.career);
    flash(r.unlocked ? `${done} ${r.unlocked}.` : done);
  };

  return (
    <ScreenFrame title="Shop" kicker={`★ ${formatWallet(career.money)} · ${fameText(fameOf(career))} fame`} onBack={() => nav.back()} scroll={false}
      right={<Press onPress={() => nav.go("sponsors")} style={{ backgroundColor: C.panel2, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8 }}><Text style={{ color: C.text, fontWeight: "900" }}>🤝 Sponsors</Text></Press>}>
      <View style={{ paddingHorizontal: 12, gap: 8 }}>
        <Chips value={cat} onChange={setCat} items={SHOP_CATS.map((c) => [c.id, `${c.icon} ${c.label}`] as const)} />
        <Note text={note} />
      </View>
      <FlatList
        data={keys}
        keyExtractor={(k) => `${cat}-${k}`}
        contentContainerStyle={{ padding: 12, paddingBottom: 60, gap: 10 }}
        renderItem={({ item: key }) => (
          <ItemCard career={career} cat={cat} k={key} accent={accent} boots={boots} level={pick[key]} onLevel={(lv) => setPick((p) => ({ ...p, [key]: lv }))}
            onAsk={setConfirm} onUse={(id) => apply(drinkCan(career, id), "Drunk.")} />
        )}
      />
      <ConfirmSheet c={confirm} money={career.money} onClose={() => setConfirm(null)}
        onRun={(lawyers) => { if (!confirm) return; const r = confirm.run(lawyers); setConfirm(null); apply(r, `${confirm.title}: yours!`); }} />
    </ScreenFrame>
  );
}

function ItemCard({ career, cat, k, accent, boots, level, onLevel, onAsk, onUse }: {
  career: CareerState; cat: CatId; k: string; accent: string; boots: Boot[]; level?: number;
  onLevel: (lv: number) => void; onAsk: (c: Confirm) => void; onUse: (id: KibCan["id"]) => void;
}) {
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

  const icon = SHOP_CATS.find((c) => c.id === cat)!.icon;
  return (
    <View style={{ backgroundColor: C.panel, borderRadius: 18, borderWidth: 1, borderColor: rgba(accent, 0.5), padding: 12, opacity: locked !== null ? 0.75 : 1 }}>
      <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
        <View style={{ width: 76, height: 76, borderRadius: 16, backgroundColor: rgba(accent, 0.2), alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 40 }}>{icon}</Text>
          <Text style={{ position: "absolute", bottom: 3, right: 6, color: C.gold, fontWeight: "900", fontSize: 11 }}>L{lv}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ color: C.text, fontWeight: "900", fontSize: 17 }}>{title}</Text>
          <Text numberOfLines={1} style={{ color: C.dim, fontWeight: "700", fontSize: 12 }}>{sub}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
            {badges.map((b) => <Text key={b.text} style={{ color: "#111", backgroundColor: b.color, fontSize: 10, fontWeight: "900", paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, overflow: "hidden" }}>{b.text}</Text>)}
          </View>
        </View>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 8 }}>
        {stats.map((s) => <Text key={s.text} style={{ color: s.color, fontWeight: "800", fontSize: 12 }}>{s.text}</Text>)}
      </View>
      {levels > 1 && (
        <View style={{ flexDirection: "row", gap: 6, marginTop: 8 }}>
          {Array.from({ length: levels }, (_, i) => i + 1).map((n) => (
            <Press key={n} onPress={() => onLevel(n)} style={{ flex: 1, paddingVertical: 6, borderRadius: 8, alignItems: "center", backgroundColor: n === lv ? accent : "rgba(255,255,255,0.08)" }}>
              <Text style={{ color: n === lv ? "#111" : C.text, fontWeight: "900", fontSize: 12 }}>L{n}</Text>
            </Press>
          ))}
        </View>
      )}
      <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
        <Btn style={{ flex: 2 }} tone={button.danger ? "red" : "gold"} disabled={button.disabled} onPress={button.run}
          label={button.price !== undefined ? `${button.label} · ★${formatMoney(button.price)}` : button.label} />
        {extra && <Btn style={{ flex: 1 }} tone="plain" disabled={extra.disabled} onPress={extra.run} label={extra.label} />}
      </View>
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
          <View style={{ backgroundColor: C.panel, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 18, paddingBottom: 34, gap: 10 }}>
            <Text style={{ color: C.text, fontWeight: "900", fontSize: 20 }}>{c.title}</Text>
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
