/**
 * THE STORE (Coins) — the phone port of components/star/store/CareerStore.tsx
 * + StoreView.tsx. Shown in the packed app on the website (only the casino is
 * taken out there), so it is here too.
 *
 * Every number and rule is the game's own (lib/star/store/*): today's
 * specials, run-ups, accessories, boosts and boots priced in ★ or Coins, the
 * Coins-to-★ swap at your wage, and the Coin packs (no payment code anywhere:
 * in a release build a pack reads "Coming soon", as on the website).
 * Drawn as lists: the website's little run-up and accessory previews are not
 * on the phone yet.
 */
import { useEffect, useState } from "react";
import { View, Text } from "react-native";
import type { CareerState } from "@/lib/star/types";
import { ANIMATIONS, ACCESSORIES, BOOSTS, bootsAtLevel, findItem, itemName, isConsumable, RARITY_LABEL, SLOT_LABEL, ANIMATION_SET_LABEL, type StoreItem } from "@/lib/star/store/catalogue";
import { careerStoreState, careerPriceContext, careerStoreBuy, careerStoreEquip, careerStoreUnequip, careerBuyCoinPack, careerConvertCoins, careerBootStatus, shownInCareer, coinPacksAreTestMode } from "@/lib/star/store/career";
import { priceNow, owns, type Currency } from "@/lib/star/store/purchase";
import { dateKeyFor, dailySpecials, msUntilReset, formatCountdown } from "@/lib/star/store/daily";
import { COIN_PACKS, coinValueLine, formatPounds, packCoinsNow } from "@/lib/star/store/coins";
import { useCareer, setCareer } from "../../game/store";
import { settle } from "../../game/flow";
import { useNav } from "../../nav";
import { Press } from "../../ui/Press";
import { Frame, Card, Label, Btn, C } from "../career/kit";

type Tab = "specials" | "runups" | "style" | "boosts" | "boots" | "coins";
const TABS: [Tab, string][] = [["specials", "Today"], ["runups", "Run-ups"], ["style", "Style"], ["boosts", "Boosts"], ["boots", "Boots"], ["coins", "Coins"]];

export function StoreScreen() {
  const career = useCareer();
  const nav = useNav();
  const [tab, setTab] = useState<Tab>("specials");
  const [note, setNote] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  if (!career) return null;
  const dateKey = dateKeyFor(now);
  const state = careerStoreState(career);
  const ctx = careerPriceContext(career);
  const run = (r: { ok: boolean; career: CareerState; reason?: string }, done: string) => {
    if (r.ok) { setCareer(r.career); settle(); setNote(done); } else setNote(r.reason ?? "Not now.");
  };
  const buy = (id: string, cur: Currency) => run(careerStoreBuy(career, id, cur, dateKey), `Bought: ${itemName(findItem(id)!)}`);

  const itemCard = (item: StoreItem, off?: number) => {
    if (!shownInCareer(item, career)) return null;
    const { price, full, percentOff } = priceNow(item, ctx, state, dateKey);
    const have = owns(state, item.id) && !isConsumable(item);
    const equippedNow = item.kind === "accessory" ? state.equipped[item.slot] === item.id
      : item.kind === "animation" ? (item.set === "penalty" ? state.penaltyRunup : state.freeKickRunup) === item.id : false;
    const sub = item.kind === "animation" ? `${ANIMATION_SET_LABEL[item.set]} · ${RARITY_LABEL[item.rarity]} · ${item.blurb}`
      : item.kind === "accessory" ? `${SLOT_LABEL[item.slot]} · ${RARITY_LABEL[item.rarity]}`
      : item.kind === "boost" ? `${item.effect}${item.kind === "boost" && item.canId ? ` · you have ${state.inventory[item.id] ?? 0}` : ""}`
      : `+${item.boot.power} power · +${item.boot.technique} technique · ${item.boot.matches} matches${careerBootStatus(career, item.id) ? ` · ${careerBootStatus(career, item.id)}` : ""}`;
    const swatch = item.kind === "accessory" ? item.color : null;
    return (
      <Card key={item.id + (off ?? "")}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          {swatch ? <View style={{ width: 26, height: 26, borderRadius: 6, backgroundColor: swatch.startsWith("#") ? swatch : "#64748b" }} /> : null}
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.text, fontWeight: "900", fontSize: 15 }}>{itemName(item)}{percentOff ? <Text style={{ color: C.green }}>  −{percentOff}%</Text> : null}</Text>
            <Text style={{ color: C.dim, fontSize: 12 }}>{sub}</Text>
          </View>
        </View>
        {have ? (
          <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
            {item.kind === "accessory" && equippedNow
              ? <View style={{ flex: 1 }}><Btn small kind="plain" label="Take off" onPress={() => { setCareer(careerStoreUnequip(career, item.slot)); setNote("Taken off."); }} /></View>
              : (item.kind === "accessory" || item.kind === "animation")
                ? <View style={{ flex: 1 }}><Btn small kind={equippedNow ? "plain" : "primary"} disabled={equippedNow} label={equippedNow ? "In use" : "Use it"} onPress={() => run(careerStoreEquip(career, item.id), "Done.")} /></View>
                : <Text style={{ color: C.green, fontWeight: "900" }}>Owned</Text>}
          </View>
        ) : (
          <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
            <View style={{ flex: 1 }}><Btn small kind="gold" disabled={price.stars > state.stars} label={`★${price.stars.toLocaleString("en-GB")}${percentOff ? ` (was ★${full.stars.toLocaleString("en-GB")})` : ""}`} onPress={() => buy(item.id, "stars")} /></View>
            <View style={{ flex: 1 }}><Btn small kind="plain" disabled={price.coins > state.coins} label={`🪙 ${price.coins.toLocaleString("en-GB")}`} onPress={() => buy(item.id, "coins")} /></View>
          </View>
        )}
        {!have && price.weeks > 0 ? <Text style={{ color: C.dim, fontSize: 11, marginTop: 4 }}>About {price.weeks < 1 ? "half a" : Math.round(price.weeks * 10) / 10} week{price.weeks >= 1.5 ? "s" : ""} of wages</Text> : null}
      </Card>
    );
  };
  const value = coinValueLine(ctx.weeklyWage);
  return (
    <Frame kicker="The Store" title={`★${state.stars.toLocaleString("en-GB")} · 🪙 ${state.coins.toLocaleString("en-GB")}`} onBack={() => nav.back()}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {TABS.map(([id, label]) => (
          <Press key={id} onPress={() => { setTab(id); setNote(null); }} style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 99, backgroundColor: tab === id ? C.gold : C.panel2 }}>
            <Text style={{ color: tab === id ? "#1a1405" : C.text, fontWeight: "900", fontSize: 12 }}>{label}</Text>
          </Press>
        ))}
      </View>
      {note ? <Card tone={C.gold}><Text style={{ color: "#fde68a", fontWeight: "800" }}>{note}</Text></Card> : null}
      {tab === "specials" && (
        <>
          <Label>{`Today's specials · new in ${formatCountdown(msUntilReset(now))}`}</Label>
          {dailySpecials(dateKey).map((s) => { const it = findItem(s.itemId); return it ? itemCard(it, s.percentOff) : null; })}
        </>
      )}
      {tab === "runups" && ANIMATIONS.map((a) => itemCard(a))}
      {tab === "style" && ACCESSORIES.map((a) => itemCard(a))}
      {tab === "boosts" && BOOSTS.map((b) => itemCard(b))}
      {tab === "boots" && bootsAtLevel(ctx.level).map((b) => itemCard(b))}
      {tab === "coins" && (
        <>
          <Card>
            <Label>Swap Coins for ★</Label>
            <Text style={{ color: C.text }}>{value.coins} Coins ≈ {value.weeks} week{value.weeks === 1 ? "" : "s"} of wages ≈ ★{value.stars.toLocaleString("en-GB")}</Text>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
              {[50, 100, 250].map((n) => (
                <View key={n} style={{ flex: 1 }}><Btn small kind="plain" disabled={state.coins < n} label={`🪙 ${n}`} onPress={() => run(careerConvertCoins(career, n), `Swapped ${n} Coins.`)} /></View>
              ))}
            </View>
          </Card>
          {COIN_PACKS.map((p) => (
            <Card key={p.id} tone={p.bestValue ? C.gold : undefined}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.text, fontWeight: "900" }}>{p.name}{p.bestValue ? "  · BEST VALUE" : ""}</Text>
                  <Text style={{ color: C.dim, fontSize: 12 }}>🪙 {packCoinsNow(p, state.firstPackBought).toLocaleString("en-GB")} · {formatPounds(p.pounds)}</Text>
                </View>
                <View style={{ width: 120 }}>
                  <Btn small kind="plain" label={coinPacksAreTestMode() ? "Add (test)" : "Coming soon"} disabled={!coinPacksAreTestMode()}
                    onPress={() => run(careerBuyCoinPack(career, p.id), "Coins added (test mode).")} />
                </View>
              </View>
            </Card>
          ))}
        </>
      )}
    </Frame>
  );
}
