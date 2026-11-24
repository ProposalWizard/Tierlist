/**
 * THE 3D SHOP (the website's components/star/Shop3D.tsx on the phone).
 *
 * Walk round the showroom: boots on their plinths, the motors on the turntable (cars, the
 * motorbike, the private jet), the KIB can fridge, the watches and jewellery counter and the
 * homes' model table. The scene is the website's own (lib/star/shop3d/scene.ts, look H);
 * ../../three/Walk3D.tsx runs it on the phone's GL view with the stick, tap to walk, drag to
 * look round and pinch to zoom.
 *
 * As the website: NOTHING IS BOUGHT IN 3D. Standing at (or tapping) an item opens its card (the
 * five levels, what each gives, the price); "See it in the shop" opens that item's sheet in the
 * app's own Shop (screens/world/Shop.tsx), where Buy works and saves exactly as it always does
 * (world/shop.ts). So there is one buying path, and no second set of rules to keep in step.
 *
 * Ways in (and out):
 *   the Garden's shop door    params { from: "garden", atDoor: true }: you step in at the doors;
 *                             Back and the doorway both go back to the Garden, outside the door.
 *   the Shop's big "3D" button  params { from: "shop" }: Back goes to the Shop; the doorway leads
 *                             out to the Garden (when you have it).
 * When the 3D cannot start (or the crash guard has switched it off) the plain card offers
 * "Open the normal shop", and the Shop's 3D button and the Garden's door go to the 2D Shop.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Platform, Text, View, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { CareerState } from "@/lib/star/types";
import { shopDisplays, type DisplayId, type ShopPrices } from "@/lib/star/shop3d/catalogue";
import type { KitColours, ShopCallbacks, ShopController, Picked } from "@/lib/star/shop3d/scene";
import { kitsOf } from "@/lib/star/kits";
import { formatMoney, formatWallet, MONEY_SIGN } from "@/lib/star/money";
import { baseIdOf, kibCanPrice, KIB_CANS } from "@/lib/star/shopData";
import { hasBootDeal, bootPrice } from "@/lib/star/sponsorDeals";
import { SHOP_TIERS } from "@/lib/star/economy";
import { divisionOf } from "@/lib/star/calendar";
import { shop3dPlayerLook } from "@/lib/star/signing3d";
import { skinToneHex, resolveHairStyle, hairColourHex } from "@/lib/star/playerIdentity";
import { appInstalled } from "@/lib/star/unlocks";
import { useCareer } from "../../game/store";
import { usePrefs } from "../../game/prefs";
import { useNav } from "../../nav";
import { Press } from "../../ui/Press";
import { partOff } from "../../safety";
import { Walk3D, type WalkApi } from "../../three/Walk3D";
import { loadShopStart, type ShopData } from "../../three/shopScene";

const INK = "#f7f1e8";
const MUTED = "#c9bba8";
const GOLD = "#facc15";

export function Shop3DScreen({ params }: { params?: Record<string, unknown> }) {
  const career = useCareer();
  if (!career) return null;
  return <Shop3D career={career} params={params} />;
}

/** What the 3D shop is built from, off a career (components/star/Shop3D.tsx: the career's own prices and kit). */
export function shopSceneData(career: CareerState, atDoor: boolean): ShopData {
  const prices: ShopPrices = {
    boot: (p) => bootPrice(career, p),
    can: (c) => kibCanPrice(c, career.contract.wage),
  };
  return {
    kit: kitsOf(career.player.club).home,
    displays: shopDisplays(prices, { h: true }), // look H is the only look (look3dStyle.ts)
    atDoor,
    number: career.squadNumber ?? 10,
    player: {
      look: shop3dPlayerLook(),
      skin: skinToneHex(career.player.skinTone),
      hair: hairColourHex(career.player.hairColour),
      hairStyle: resolveHairStyle(career.player.hairStyle),
      // no `worn`: the casual sets come from the house's wardrobe (not in this app yet); he wears the club kit
    },
  };
}

/** The shop's category in the app's own Shop for each display (the website's shop-boots / shop-kib / shop-lifestyle). */
const SHOP_CAT: Record<DisplayId, string> = { boots: "boots", cans: "cans", car: "cars", homes: "homes", counter: "gadgets" };

function Shop3D({ career, params }: { career: CareerState; params?: Record<string, unknown> }) {
  const nav = useNav();
  const prefs = usePrefs();
  const insets = useSafeAreaInsets();
  const from: "garden" | "shop" = params?.from === "garden" ? "garden" : "shop";
  const atDoor = params?.atDoor === true;
  // the doorway leads out to the Garden when you have it (the website: always, in a career)
  const gardenOk = from === "garden" || (!partOff("3d") && (career.unlocks ? appInstalled(career, "garden") : true));
  const [ctrl, setCtrl] = useState<ShopController | null>(null);
  const [near, setNear] = useState<DisplayId | null>(null);
  const [dismissed, setDismissed] = useState<DisplayId | null>(null);
  const [tapped, setTapped] = useState<Picked | null>(null);
  const [itemIx, setItemIx] = useState(0);
  const [levelIx, setLevelIx] = useState(0);

  // one visit: the career's prices and kit as it opens
  const data = useMemo<ShopData>(() => shopSceneData(career, atDoor), []); // eslint-disable-line react-hooks/exhaustive-deps
  const displays = data.displays;
  const kit: KitColours = data.kit;
  // the level the shop opens on: the one priced for your league
  const homeLevel = Math.max(1, SHOP_TIERS.findIndex((t) => t.anchor === divisionOf(career)) + 1);

  /** What the career has of each item, for the "Owned" chip. */
  const owned = useMemo(() => {
    const o: Record<string, string> = {};
    const b = career.currentBoot;
    if (b && b.matches > 0) o[baseIdOf(b)] = `Wearing L${b.level ?? 1}`;
    for (const it of career.ownedItems) o[baseIdOf(it)] = `Owned L${it.level ?? 1}`;
    const cans = KIB_CANS.reduce((n, c) => n + (career.kibCans[c.id] ?? 0), 0);
    if (cans > 0) o.kib = `×${cans}`;
    return o;
  }, [career]);

  const goOut = useRef<() => void>(() => undefined);
  goOut.current = () => { if (from === "garden") nav.back(); else nav.replace("garden", { arrive: "shop" }); };

  const callbacks = (api: WalkApi): ShopCallbacks => ({
    onNear: (id) => { if (!api.dead()) setNear(id); },
    onFps: () => { /* the speed readout (Settings → Show 3D speed) counts frames itself */ },
    ...(gardenOk ? { onDoor: () => { if (!api.dead()) goOut.current(); } } : {}),
    onContextLost: () => { if (!api.dead()) { console.warn("3D shop: the phone took the 3D away"); api.restart(); } },
  });

  useEffect(() => { ctrl?.setKit(kit); }, [ctrl]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { ctrl?.setOwned(owned); }, [owned, ctrl]);
  if (Platform.OS === "web" && ctrl) (globalThis as unknown as { __shop3d?: ShopController }).__shop3d = ctrl;

  // arriving at a display: pick the item you are standing at
  useEffect(() => {
    if (!near) { setDismissed(null); return; }
    if (tapped) return;
    setItemIx(ctrl ? ctrl.nearestItem(near) : 0);
    setLevelIx(Math.max(0, homeLevel - 1));
    ctrl?.setStick(0, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [near]);

  const openId: DisplayId | null = tapped ? tapped.display : near && dismissed !== near ? near : null;
  const open = openId ? displays[openId] : null;
  const item = open ? open.items[Math.min(itemIx, open.items.length - 1)] : null;
  const level = item ? item.levels[Math.min(levelIx, item.levels.length - 1)] : null;
  const levelNo = Math.min(levelIx, (item?.levels.length ?? 1) - 1) + 1;

  useEffect(() => {
    if (open && item) ctrl?.select(open.id, Math.min(itemIx, open.items.length - 1));
  }, [open, item, itemIx, ctrl]);
  useEffect(() => {
    if (open && item) ctrl?.setLevel(open.id, Math.min(itemIx, open.items.length - 1), levelNo);
  }, [open, item, itemIx, levelNo, ctrl]);
  const isOpen = !!open;
  useEffect(() => { ctrl?.setCardOpen(isOpen); }, [isOpen, ctrl]);

  const step = (d: number) => {
    if (!open) return;
    const n = open.items.length;
    setItemIx((i) => (i + d + n) % n);
  };
  const close = () => {
    if (tapped) setTapped(null);
    if (near) setDismissed(near);
    ctrl?.setStick(0, 0);
  };
  /** A short tap (the website's onTap): a display you are not at, he walks up to it; the floor, he walks there; at it, its card. */
  const onTap = (c: ShopController, x: number, y: number) => {
    const p = c.pick(x, y);
    if (p && near !== p.display && c.walkToItem) { c.walkToItem(p); return; }
    if (!p) { c.tap?.(x, y); return; }
    setTapped(p);
    setItemIx(p.index);
    setLevelIx(Math.max(0, Math.min(homeLevel, displays[p.display].items[p.index].levels.length) - 1));
    c.setStick(0, 0);
  };
  /** "See it in the shop": the app's own Shop, on that item (it replaces this screen; its Back goes where this one would). */
  const seeInShop = (display: DisplayId, id: string, lv: number) => {
    const p = { cat: SHOP_CAT[display], focus: { id, level: lv } };
    if (from === "shop") { nav.back(); nav.replace("shop", p); } else nav.replace("shop", p);
  };
  const ownTag = item ? owned[item.id] : undefined;
  const isModel = !!item?.model;
  const top = Math.max(12, insets.top);

  return (
    <View style={{ flex: 1, backgroundColor: "#120e0b" }}>
      <Walk3D<ShopData, ShopCallbacks, ShopController>
        name="The 3D shop" cover="#120e0b" load={loadShopStart} data={data} callbacks={callbacks}
        onBack={() => nav.back()} onController={setCtrl} showSpeed={prefs.show3dSpeed}
        onTap={onTap} hideStick={!!open}
        loading={{ title: "Opening the shop…", sub: "Loading the 3D models" }}
        fallback={from === "garden" ? { label: "Open the normal shop", onPress: () => nav.replace("shop") } : undefined}>
        {/* top bar */}
        <View pointerEvents="box-none" style={{ position: "absolute", top: 0, left: 0, right: 0, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingTop: top }}>
          <Press onPress={() => nav.back()} style={[pill, { gap: 4, paddingLeft: 10 }]}>
            <Text style={{ color: INK, fontSize: 20, lineHeight: 22, marginTop: -2 }}>‹</Text>
            <Text style={{ color: INK, fontSize: 13, fontWeight: "800" }}>{from === "garden" ? "Garden" : "Shop"}</Text>
          </Press>
          <View pointerEvents="none" style={[pill, { gap: 6 }]}>
            <Text style={{ color: INK, fontWeight: "900", fontSize: 14 }}>3D Shop</Text>
            <Text style={{ fontSize: 10, fontWeight: "900", letterSpacing: 0.8, color: "#111", backgroundColor: GOLD, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2, overflow: "hidden" }}>BETA</Text>
          </View>
          <View style={{ flex: 1 }} pointerEvents="none" />
          <View pointerEvents="none" style={pill}>
            <Text style={{ color: "#fde047", fontWeight: "900", fontSize: 13 }}>{MONEY_SIGN}{formatWallet(career.money)}</Text>
          </View>
        </View>

        {ctrl && !open && !near && (
          <View pointerEvents="none" style={{ position: "absolute", bottom: 40, right: 16, maxWidth: 176 }}>
            <Text style={{ textAlign: "right", fontSize: 12.5, fontWeight: "800", color: INK, lineHeight: 17.5, textShadowColor: "rgba(0,0,0,0.8)", textShadowRadius: 6, textShadowOffset: { width: 0, height: 1 } }}>
              Walk up to anything, or tap it to walk there. Drag the view to look round.
            </Text>
          </View>
        )}

        {ctrl && open && item && level && (
          <View style={{ position: "absolute", left: 10, right: 10, bottom: Math.max(10, insets.bottom), backgroundColor: "rgba(20,15,11,0.94)", borderWidth: 1, borderColor: "rgba(250,204,21,0.25)", borderRadius: 20, padding: 14, boxShadow: "0px 18px 40px -12px rgba(0,0,0,0.8)" } as ViewStyle}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ fontSize: 11, fontWeight: "900", letterSpacing: 0.9, textTransform: "uppercase", color: MUTED }}>{open.title}</Text>
              {ownTag ? <Text style={{ fontSize: 11, fontWeight: "900", color: "#fff", backgroundColor: "#16a34a", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, overflow: "hidden" }}>{ownTag}</Text> : null}
              <View style={{ flex: 1 }} />
              <Press onPress={close} style={[round, { width: 40, height: 40, borderRadius: 20 }]}><Text style={{ color: INK, fontSize: 15, fontWeight: "900" }}>✕</Text></Press>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4, marginBottom: 10 }}>
              {open.items.length > 1 ? <Press onPress={() => step(-1)} style={round}><Text style={roundText}>‹</Text></Press> : null}
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <View style={{ width: 14, height: 14, borderRadius: 4, backgroundColor: item.colour, borderWidth: 1, borderColor: "rgba(255,255,255,0.3)" }} />
                  <Text numberOfLines={1} style={{ flexShrink: 1, color: INK, fontSize: 21, fontWeight: "900" }}>{item.name}</Text>
                </View>
                <Text style={{ fontSize: 11, fontWeight: "800", color: MUTED, marginTop: 1 }}>
                  {(isModel ? (item.modelLevel != null ? `3D model · level ${item.modelLevel} shown` : "3D model") : item.picture ? `Picture of level ${levelNo}` : open.items.length > 1 ? "" : "Three cans")
                    + (open.items.length > 1 ? ` · ${Math.min(itemIx, open.items.length - 1) + 1} of ${open.items.length}` : "")}
                </Text>
              </View>
              {open.items.length > 1 ? <Press onPress={() => step(1)} style={round}><Text style={roundText}>›</Text></Press> : null}
            </View>
            <View style={{ flexDirection: "row", gap: 6 }}>
              {item.levels.map((l, i) => {
                const on = i === Math.min(levelIx, item.levels.length - 1);
                return (
                  <Press key={l.label} onPress={() => setLevelIx(i)} style={{
                    flex: 1, borderRadius: 12, paddingVertical: 7, paddingHorizontal: 2, alignItems: "center",
                    borderWidth: on ? 2 : 1, borderColor: on ? GOLD : "rgba(255,255,255,0.12)",
                    backgroundColor: on ? "rgba(250,204,21,0.12)" : "rgba(255,255,255,0.04)",
                  }}>
                    <Text numberOfLines={1} style={{ color: INK, fontSize: 13, fontWeight: "900" }}>{l.label}</Text>
                    <Text numberOfLines={1} style={{ color: "#fde047", fontSize: 12, fontWeight: "800" }}>{MONEY_SIGN}{formatMoney(l.price)}</Text>
                  </Press>
                );
              })}
            </View>
            <Text style={{ color: MUTED, fontSize: 13, fontWeight: "700", marginTop: 9, marginBottom: 10, marginHorizontal: 2, minHeight: 18 }}>
              {level.rung ? <Text style={{ color: INK }}>{level.rung} · </Text> : null}{level.gives}
            </Text>
            <Press onPress={() => seeInShop(open.id, item.id, levelNo)} style={cta}>
              <Text style={{ color: "#111", fontSize: 16, fontWeight: "900" }}>See it in the shop ›</Text>
            </Press>
          </View>
        )}
      </Walk3D>
    </View>
  );
}

const pill = { flexDirection: "row" as const, alignItems: "center" as const, height: 36, paddingHorizontal: 12, borderRadius: 18, backgroundColor: "rgba(18,13,10,0.62)", borderWidth: 1, borderColor: "rgba(255,230,200,0.14)" };
const round = { width: 34, height: 34, borderRadius: 17, alignItems: "center" as const, justifyContent: "center" as const, borderWidth: 1, borderColor: "rgba(255,255,255,0.14)", backgroundColor: "rgba(255,255,255,0.06)" };
const roundText = { color: INK, fontSize: 20, fontWeight: "900" as const, lineHeight: 22 };
const cta = { height: 48, borderRadius: 14, backgroundColor: GOLD, alignItems: "center" as const, justifyContent: "center" as const };
