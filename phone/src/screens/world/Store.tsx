/**
 * THE STORE (Coins) — the phone port of components/star/store/CareerStore.tsx
 * + StoreView.tsx. Shown in the packed app on the website (only the casino is
 * taken out there), so it is here too.
 *
 * Every number and rule is the game's own (lib/star/store/*): the daily
 * specials, run-ups and goal celebrations, accessories and boots priced in ★ or Coins, the
 * Coins-to-★ swap at your wage, and the Coin packs (no payment code anywhere:
 * in a release build a pack reads "Coming soon", as on the website).
 * Drawn as lists: the website's little run-up and accessory previews are not
 * on the phone yet.
 */
import { useEffect, useState } from "react";
import { View, Text } from "react-native";
import type { CareerState } from "@/lib/star/types";
import { ANIMATIONS, ACCESSORIES, bootsAtLevel, findItem, itemName, isConsumable, RARITY_LABEL, SLOT_LABEL, ANIMATION_SET_LABEL, type StoreItem } from "@/lib/star/store/catalogue";
import { careerStoreState, careerPriceContext, careerStoreBuy, careerStoreEquip, careerStoreUnequip, careerBuyCoinPack, careerConvertCoins, careerBootStatus, shownInCareer, coinPacksAreTestMode } from "@/lib/star/store/career";
import { priceNow, owns, type Currency } from "@/lib/star/store/purchase";
import { dateKeyFor, dailySpecials, msUntilReset, formatCountdown } from "@/lib/star/store/daily";
import { COIN_PACKS, coinValueLine, formatPounds, packCoinsNow, coinsToStars, packBonusPercent, COINS_PER_WAGE_WEEK } from "@/lib/star/store/coins";
import { useCareer, setCareer } from "../../game/store";
import { settle } from "../../game/flow";
import { useNav } from "../../nav";
import { Press } from "../../ui/Press";
import { Frame, Card, Label, Btn, C } from "../career/kit";

// The website's tabs (StoreView.tsx): Daily, Animations (run-ups and goal
// celebrations), Accessories, Boots (cans live in the Shop) and Coins.
type Tab = "specials" | "runups" | "style" | "boots" | "coins";
const TABS: [Tab, string][] = [["specials", "Daily"], ["runups", "Animations"], ["style", "Accessories"], ["boots", "Boots"], ["coins", "Coins"]];

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
              : item.kind === "animation" && equippedNow
                ? <Text style={{ color: C.green, fontWeight: "900" }}>✓ Your {item.set === "penalty" ? "penalty" : "free-kick"} run-up</Text>
                : (item.kind === "accessory" || item.kind === "animation")
                  ? <View style={{ flex: 1 }}><Btn small kind="primary" label={item.kind === "animation" ? `Use for ${item.set === "penalty" ? "penalties" : "free kicks"}` : "Wear"} onPress={() => run(careerStoreEquip(career, item.id), "Done.")} /></View>
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
          <Label>{`Daily specials · same for everyone today · new in ${formatCountdown(msUntilReset(now))}`}</Label>
          {dailySpecials(dateKey).map((s, i) => {
            const it = findItem(s.itemId);
            if (!it) return null;
            return (
              <View key={s.itemId}>
                {i === 0 ? <Text style={{ color: C.gold, fontWeight: "900", fontSize: 11, letterSpacing: 1.5, marginBottom: 4 }}>TODAY'S PICK · −{s.percentOff}%</Text> : null}
                {itemCard(it, s.percentOff)}
                {(state.specialsBought[dateKey] ?? []).includes(s.itemId) ? <Text style={{ color: C.dim, fontSize: 11, fontWeight: "700", marginTop: 2 }}>Bought today</Text> : null}
              </View>
            );
          })}
        </>
      )}
      {tab === "runups" && (
        <>
          <Label>Penalty run-ups</Label>
          {ANIMATIONS.filter((a) => a.set === "penalty").map((a) => itemCard(a))}
          <Label>Free-kick run-ups</Label>
          {ANIMATIONS.filter((a) => a.set !== "penalty").map((a) => itemCard(a))}
          <Label>Goal celebrations · after every goal you score</Label>
          {ACCESSORIES.filter((a) => a.slot === "celebration").map((a) => itemCard(a))}
        </>
      )}
      {tab === "style" && (
        <>
          <Card>
            <Text style={{ color: C.text, fontWeight: "900", fontSize: 15 }}>Your player</Text>
            {(() => {
              const on = ACCESSORIES.filter((a) => a.slot !== "celebration" && state.equipped[a.slot] === a.id);
              return on.length === 0
                ? <Text style={{ color: C.dim, fontSize: 12, marginTop: 4 }}>Nothing on yet — buy something below and tap Wear.</Text>
                : <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                    {on.map((w) => (
                      <Press key={w.id} onPress={() => { setCareer(careerStoreUnequip(career, w.slot)); setNote("Taken off."); }} style={{ backgroundColor: C.panel2, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4 }}>
                        <Text style={{ color: C.text, fontWeight: "800", fontSize: 12 }}>{itemName(w)} ✕</Text>
                      </Press>
                    ))}
                  </View>;
            })()}
          </Card>
          {ACCESSORIES.filter((a) => a.slot !== "celebration").map((a) => itemCard(a))}
        </>
      )}
      {tab === "boots" && (
        <>
          <Card tone={C.gold}><Text style={{ color: C.text, fontWeight: "900", fontSize: 12 }}>🚧 Future update — boots here are a preview. Buy and level boots in Shop → Boots.</Text></Card>
          <Label>{`Boots · level ${ctx.level} · the real shop's boots and prices`}</Label>
          {bootsAtLevel(ctx.level).map((b) => itemCard(b))}
        </>
      )}
      {tab === "coins" && (
        <>
          {COIN_PACKS.map((p) => {
            const now = packCoinsNow(p, state.firstPackBought);
            const doubled = now > p.coins;
            const bonus = packBonusPercent(p);
            return (
              <Card key={p.id} tone={p.bestValue ? C.gold : doubled ? C.green : undefined}>
                {p.bestValue ? <Text style={{ color: C.gold, fontWeight: "900", fontSize: 11, letterSpacing: 1.5 }}>BEST VALUE</Text> : null}
                {doubled ? <Text style={{ color: C.green, fontWeight: "900", fontSize: 11, letterSpacing: 1.5 }}>FIRST PURCHASE ×2</Text> : null}
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.dim, fontWeight: "900", fontSize: 11 }}>{p.name.toUpperCase()}</Text>
                    <Text style={{ color: C.text, fontWeight: "900", fontSize: 20 }}>🪙 {now.toLocaleString("en-GB")}{doubled ? <Text style={{ color: C.dim, fontSize: 12, textDecorationLine: "line-through" }}>  {p.coins.toLocaleString("en-GB")}</Text> : bonus > 0 ? <Text style={{ color: C.green, fontSize: 12 }}>  +{bonus}% bonus</Text> : null}</Text>
                    <Text style={{ color: C.dim, fontSize: 11 }}>≈ {Math.round((now / COINS_PER_WAGE_WEEK) * 10) / 10} weeks' wages</Text>
                  </View>
                  <View style={{ width: 120 }}>
                    <Btn small kind="plain" label={coinPacksAreTestMode() ? formatPounds(p.pounds) : "Coming soon"} disabled={!coinPacksAreTestMode()}
                      onPress={() => run(careerBuyCoinPack(career, p.id), "Coins added — test, nothing charged")} />
                  </View>
                </View>
              </Card>
            );
          })}
          <Card>
            <Label>Swap Coins for ★</Label>
            <Text style={{ color: C.dim, fontSize: 12 }}>At your wage of ★{ctx.weeklyWage.toLocaleString("en-GB")} a week.</Text>
            <Text style={{ color: C.dim, fontSize: 12 }}>{value.coins} Coins ≈ {value.weeks} week{value.weeks === 1 ? "" : "s"} of wages ≈ ★{value.stars.toLocaleString("en-GB")}</Text>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
              {[100, 500, 1000].map((n) => (
                <View key={n} style={{ flex: 1 }}><Btn small kind="plain" disabled={state.coins < n} label={`🪙 ${n} → ★${coinsToStars(n, ctx.weeklyWage).toLocaleString("en-GB")}`} onPress={() => run(careerConvertCoins(career, n), `+★${coinsToStars(n, ctx.weeklyWage).toLocaleString("en-GB")}`)} /></View>
              ))}
            </View>
          </Card>
          {state.log.length > 0 && (
            <Card>
              <Label>Receipts</Label>
              {state.log.slice(0, 8).map((l, i) => <Text key={i} style={{ color: C.text, fontSize: 12, paddingVertical: 2 }}>{l.what}</Text>)}
            </Card>
          )}
        </>
      )}
    </Frame>
  );
}
