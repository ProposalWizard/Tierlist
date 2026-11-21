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
import { View, Text, Image, ScrollView, type ViewStyle } from "react-native";
import { StoreFigure } from "./StoreFigure";
import { CAN } from "../../ui/look";
import { SHOP_PIC_3D } from "../../ui/look/worldPics";
import { shopPic3d } from "@/lib/star/shopPicsLook";
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
import { Frame, Card, Label, Btn, C } from "../../world/lookKit";

// The website's tabs (StoreView.tsx): Daily, Animations (run-ups and goal
// celebrations), Accessories, Boots (cans live in the Shop) and Coins.
type Tab = "specials" | "runups" | "style" | "boots" | "coins";
const TABS: [Tab, string][] = [["specials", "Daily"], ["runups", "Animations"], ["style", "Accessories"], ["boots", "Boots"], ["coins", "Coins"]];

export function StoreScreen() {
  const career = useCareer();
  const nav = useNav();
  const [tab, setTab] = useState<Tab>("specials");
  const [note, setNote] = useState<string | null>(null);
  // The whole Store is drawn again only when the day turns (new specials), not every second:
  // the countdown ticks on its own (DailyCountdown).
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setTimeout(() => setNow(Date.now()), msUntilReset(now) + 500); return () => clearTimeout(t); }, [now]);
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
    return (
      <Card key={item.id + (off ?? "")}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <ItemPicture item={item} width={64} height={64} />
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
            <View style={{ flex: 1 }}><Btn small kind="gold" disabled={price.stars > state.stars} label={`★${price.stars.toLocaleString("en-GB")}`} onPress={() => buy(item.id, "stars")} /></View>
            <View style={{ flex: 1 }}><Btn small kind="plain" disabled={price.coins > state.coins} label={`🪙 ${price.coins.toLocaleString("en-GB")}`} onPress={() => buy(item.id, "coins")} /></View>
          </View>
        )}
        {/* The old price struck through under the buttons (StoreView), never inside one where it was cut off. */}
        {!have && percentOff ? <Text style={{ color: C.dim, fontSize: 11, marginTop: 4, textDecorationLine: "line-through" }}>★{full.stars.toLocaleString("en-GB")} · 🪙 {full.coins.toLocaleString("en-GB")}</Text> : null}
        {!have && price.weeks > 0 ? <Text style={{ color: C.dim, fontSize: 11, marginTop: 4 }}>About {price.weeks < 1 ? "half a" : Math.round(price.weeks * 10) / 10} week{price.weeks >= 1.5 ? "s" : ""} of wages</Text> : null}
      </Card>
    );
  };
  const value = coinValueLine(ctx.weeklyWage);
  return (
    <Frame kicker="The Store" title={`★${state.stars.toLocaleString("en-GB")} · 🪙 ${state.coins.toLocaleString("en-GB")}`} onBack={() => nav.back()}>
      {/* ONE row that scrolls sideways (StoreView's tabs): "Coins" never drops to a second row. */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginHorizontal: -12 }} contentContainerStyle={{ flexDirection: "row", gap: 6, paddingHorizontal: 12 }}>
        {TABS.map(([id, label]) => (
          <Press key={id} onPress={() => { setTab(id); setNote(null); }} style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 99, backgroundColor: tab === id ? C.gold : C.panel2 }}>
            <Text numberOfLines={1} style={{ color: tab === id ? "#1a1405" : C.text, fontWeight: "900", fontSize: 12, lineHeight: 16 }}>{label}</Text>
          </Press>
        ))}
      </ScrollView>
      {note ? <Card tone={C.gold}><Text style={{ color: "#fde68a", fontWeight: "800" }}>{note}</Text></Card> : null}
      {tab === "specials" && (
        <>
          <DailyCountdown />
          {/* StoreView's daily specials: TODAY'S PICK as one big picture card, the rest as picture tiles two across. */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {dailySpecials(dateKey).map((s, i) => {
              const it = findItem(s.itemId);
              if (!it || !shownInCareer(it, career)) return null;
              const { price, full, percentOff } = priceNow(it, ctx, state, dateKey);
              const bought = (state.specialsBought[dateKey] ?? []).includes(s.itemId) || (owns(state, it.id) && !isConsumable(it));
              const big = i === 0;
              const rarity = it.kind === "animation" || it.kind === "accessory" ? it.rarity : null;
              return (
                <Press key={s.itemId} onPress={() => { if (!bought) buy(it.id, price.stars <= state.stars ? "stars" : "coins"); }}
                  style={{ width: big ? "100%" : "48.5%", borderRadius: 16, overflow: "hidden", borderWidth: 1.5, borderColor: big ? "rgba(253,224,71,0.7)" : "rgba(255,255,255,0.18)", backgroundImage: "linear-gradient(180deg, rgba(30,58,95,0.9), rgba(10,22,40,0.92))" } as ViewStyle}>
                  <View style={{ flexDirection: big ? "row" : "column" }}>
                    <View style={{ width: big ? "48%" : "100%", height: big ? 132 : 110, alignItems: "center", justifyContent: "flex-end", backgroundImage: "linear-gradient(180deg, #14532d, #166534)" } as ViewStyle}>
                      <ItemPicture item={it} width={big ? 150 : 140} height={big ? 128 : 106} />
                      {rarity && <Text style={{ position: "absolute", left: 6, top: 6, backgroundColor: RARITY_BG[rarity], color: "#fff", fontSize: 9, fontWeight: "900", letterSpacing: 1, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: "hidden" }}>{RARITY_LABEL[rarity].toUpperCase()}</Text>}
                      {percentOff ? <Text style={{ position: "absolute", right: 6, top: 6, backgroundColor: "#e11d48", color: "#fff", fontSize: 11, fontWeight: "900", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: "hidden" }}>−{percentOff}%</Text> : null}
                    </View>
                    <View style={{ flex: big ? 1 : undefined, padding: 10, gap: 2 }}>
                      {big && <Text style={{ alignSelf: "flex-start", backgroundColor: "#fde047", color: "#030712", fontSize: 9, fontWeight: "900", letterSpacing: 1, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: "hidden", marginBottom: 2 }}>TODAY'S PICK</Text>}
                      <Text numberOfLines={1} style={{ color: "#fff", fontSize: big ? 18 : 14, fontWeight: "900" }}>{itemName(it)}</Text>
                      <Text numberOfLines={big ? 2 : 1} style={{ color: C.dim, fontSize: 11 }}>{it.kind === "animation" ? `${ANIMATION_SET_LABEL[it.set]}` : it.kind === "accessory" ? SLOT_LABEL[it.slot] : ""}</Text>
                      {bought ? <Text style={{ color: C.green, fontWeight: "900", fontSize: 12, marginTop: 4 }}>Bought today</Text> : (
                        <>
                          <Text style={{ color: "#fff", fontSize: 13, fontWeight: "900", marginTop: 4 }}>★{price.stars.toLocaleString("en-GB")}  <Text style={{ color: "#fcd34d" }}>🪙 {price.coins.toLocaleString("en-GB")}</Text></Text>
                          {percentOff ? <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 10.5, textDecorationLine: "line-through" }}>★{full.stars.toLocaleString("en-GB")} · {full.coins.toLocaleString("en-GB")}</Text> : null}
                        </>
                      )}
                    </View>
                  </View>
                </Press>
              );
            })}
          </View>
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

const RARITY_BG: Record<string, string> = { common: "#4b5563", rare: "#2563eb", epic: "#7c3aed", legendary: "#d97706" };

/** An item's picture (StoreView's previews, still): the man with the accessory on or in
 *  the celebration's pose; a run-up, the man at the ball; boots, the shop's still; a can. */
function ItemPicture({ item, width, height }: { item: StoreItem; width: number; height: number }) {
  if (item.kind === "accessory") return <StoreFigure wear={[item]} width={width} height={height} />;
  if (item.kind === "animation") return <StoreFigure wear={[]} width={width} height={height} runup />;
  if (item.kind === "boost") {
    const can = item.canId ? CAN[item.canId as keyof typeof CAN] : undefined;
    return can ? <Image source={can} resizeMode="contain" style={{ width, height: height * 0.9 }} /> : <Text style={{ fontSize: height * 0.5 }}>⚡</Text>;
  }
  const still = SHOP_PIC_3D[shopPic3d("boot", (item.boot as { baseId?: string; id: string }).baseId ?? item.boot.id, item.boot.level ?? 1) ?? ""];
  return still ? <Image source={still} resizeMode="contain" style={{ width, height }} /> : <Text style={{ fontSize: height * 0.5 }}>👟</Text>;
}

/** "new in 3h 12m 05s": the one line that changes every second, on its own. */
function DailyCountdown() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  // StoreView DailyTab: two lines on the left, the countdown in a chip on the right.
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 8, marginTop: 2 }}>
      <View style={{ flexShrink: 1 }}>
        <Text numberOfLines={1} style={{ color: C.text, fontSize: 15, lineHeight: 22, fontWeight: "900" }}>Daily specials</Text>
        <Text numberOfLines={1} style={{ color: "#94a3b8", fontSize: 11, lineHeight: 16, fontWeight: "700" }}>Same for everyone today</Text>
      </View>
      <Text numberOfLines={1} style={{ color: "#fef3c7", fontSize: 12, lineHeight: 18, fontWeight: "900", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.1)", borderWidth: 1, borderColor: "rgba(252,211,77,0.25)", fontVariant: ["tabular-nums"] }}>⏱ New in {formatCountdown(msUntilReset(now))}</Text>
    </View>
  );
}
