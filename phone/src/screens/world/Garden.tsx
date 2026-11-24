/**
 * THE GARDEN, IN 3D (the website's components/star/Garden3D.tsx on the phone).
 *
 * Your place as a footballer, walked: the stable and your horse, the cars you
 * own, the trophy cabinet, the fountain, the gazebo with three team-mates, and
 * the doors to the shop, your house and the training pitch (the casino's stays
 * shut: not in this app). The scene is the website's own
 * (lib/star/garden3d/scene.ts); ../../three/Walk3D.tsx runs it on the phone's GL
 * view with the stick, tap to walk, drag to look round, pinch to zoom.
 *
 * This file is the screen: the data the scene is built from (the same as the
 * website's gardenSceneData), the doors' callbacks, the top bar and the small
 * card when you stand at something (pictures and numbers, no sentences).
 *
 *   shop door      → the shop (TODO WP2: the 3D shop; for now the app's own Shop screen)
 *   training gate  → the Training screen (TODO WP4: the 3D pitch)
 *   house door     → stays shut (TODO WP3: your 3D house)
 *   casino door    → shut: "Casino · Locked" (this app has no casino)
 * Back goes to where you came from (the Phone).
 */
import { useMemo, useRef, useState } from "react";
import { Image, Platform, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { CareerState } from "@/lib/star/types";
import type { GardenCallbacks, GardenController, GardenData, GardenSpot } from "@/lib/star/garden3d/scene";
import { kitsOf } from "@/lib/star/kits";
import { gardenData } from "@/lib/star/gardenLevel";
import { homeSkyFor } from "@/lib/star/kickoff";
import { nextFixtureFor } from "@/lib/star/competitions";
import { baseIdOf } from "@/lib/star/shopData";
import { shuffle } from "@/lib/star/cups";
import { fakeFaceFor } from "@/lib/star/fakeFaces";
import { shop3dPlayerLook } from "@/lib/star/signing3d";
import { skinToneHex, resolveHairStyle, hairColourHex } from "@/lib/star/playerIdentity";
import { wornAt } from "@/lib/star/home3d/outfits";
import { useCareer } from "../../game/store";
import { usePrefs } from "../../game/prefs";
import { useNav } from "../../nav";
import { Press } from "../../ui/Press";
import { packedPicture } from "../../data/packed";
import { absoluteUrl } from "../../draw/offscreen";
import { Walk3D, type WalkApi } from "../../three/Walk3D";
import { loadGardenStart } from "../../three/gardenScene";
import { TrophyImage } from "../career/Ceremonies";

const INK = "#f7f1e8";
const GOLD = "#facc15";
/** The car families the shop has a 3D model of (lib/star/shop3d/catalogue.ts). */
const CAR_MODELS = ["car-1", "car-2", "suv", "car-3", "classic", "car-4"];

/** Where you step out when you come back from a door (set when you walk through one). */
let comeBack: GardenData["arrive"] | null = null;

/**
 * What the 3D garden is built from, off a career: the website's gardenSceneData
 * (components/star/Garden3D.tsx), the same fields the same way. `sky` unset: the time of
 * day of your next match.
 */
export function gardenSceneData(career: CareerState, arrive: GardenData["arrive"], sky?: GardenData["sky"]): GardenData {
  const info = gardenData(career);
  const yours = career.squadNumber ?? 10;
  const numbers = [7, 4, 9, 11, 6, 8].filter((n) => n !== yours).slice(0, 3);
  const owned = new Set(career.ownedItems.map((it) => baseIdOf(it)));
  return {
    kit: kitsOf(career.player.club).home,
    number: yours,
    tier: info.tier,
    stable: info.stable,
    horse: career.horse ? { name: career.horse.name } : null,
    trophies: info.shelf,
    cars: CAR_MODELS.filter((id) => owned.has(id)).map((id) => `/star/shop3d/items/${id.startsWith("car-") ? id : `car-${id}`}.glb`),
    sky: sky ?? homeSkyFor(career, nextFixtureFor(career)),
    mates: numbers,
    arrive,
    // the 3D shop's own player, so you are the same person here as in the shop
    player: {
      look: shop3dPlayerLook(),
      skin: skinToneHex(career.player.skinTone),
      hair: hairColourHex(career.player.hairColour),
      hairStyle: resolveHairStyle(career.player.hairStyle),
    },
    // the clothes from your home's wardrobe; back from training: the kit
    worn: wornAt(career, arrive === "training" ? "training" : "garden"),
  };
}

export function GardenScreen({ params }: { params?: Record<string, unknown> }) {
  const career = useCareer();
  if (!career) return null;
  return <Garden career={career} params={params} />;
}

function Garden({ career, params }: { career: CareerState; params?: Record<string, unknown> }) {
  const nav = useNav();
  const prefs = usePrefs();
  const [near, setNear] = useState<GardenSpot | null>(null);
  const info = useMemo(() => gardenData(career), [career]);
  // Three real team-mates, picked at random each visit (as the website).
  const [visitors] = useState(() => {
    const squad = career.squad ?? [];
    return squad.length <= 3 ? squad : shuffle(squad, Math.random).slice(0, 3);
  });
  // the garden is built once per visit
  const data = useMemo<GardenData>(() => {
    const arrive = (params?.arrive as GardenData["arrive"] | undefined) ?? comeBack ?? "gate";
    comeBack = null;
    return gardenSceneData(career, arrive);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** TODO(WP2): the 3D shop (screen "shop-3d"). Until it exists, the app's own Shop screen. */
  const onShop = () => { comeBack = "shop"; nav.go("shop"); };
  /** TODO(WP4): the 3D training pitch. Until it exists, the Training screen. */
  const onTraining = () => { comeBack = "training"; nav.go("career-training"); };
  const hooks = useRef({ onShop, onTraining });
  hooks.current = { onShop, onTraining };

  const callbacks = (api: WalkApi): GardenCallbacks => ({
    onNear: (s) => { if (!api.dead()) setNear(s); },
    onFps: () => { /* the speed readout (Settings → Show 3D speed) counts frames itself */ },
    onShopDoor: () => { if (!api.dead()) hooks.current.onShop(); },
    onTrainingGate: () => { if (!api.dead()) hooks.current.onTraining(); },
    // no onHouseDoor (TODO WP3: your 3D house) and no onCasinoDoor: both doors stay shut
    onContextLost: () => { if (!api.dead()) { console.warn("3D garden: the phone took the 3D away"); api.restart(); } },
  });

  const [ctrl, setCtrl] = useState<GardenController | null>(null);
  if (Platform.OS === "web" && ctrl) (globalThis as unknown as { __garden3d?: GardenController }).__garden3d = ctrl;

  return (
    <View style={{ flex: 1, backgroundColor: "#0d1420" }}>
      <Walk3D<GardenData, GardenCallbacks, GardenController>
        name="The garden" load={loadGardenStart} data={data} callbacks={callbacks}
        onBack={() => nav.back()} onController={setCtrl} showSpeed={prefs.show3dSpeed}>
        <SafeAreaView edges={["top", "bottom"]} pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}>
          <View pointerEvents="box-none" style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingTop: 12 }}>
            <Press onPress={() => { comeBack = null; nav.back(); }} style={[pill, { gap: 4, paddingLeft: 10 }]}>
              <Text style={{ color: INK, fontSize: 20, lineHeight: 22, marginTop: -2 }}>‹</Text>
              <Text style={{ color: INK, fontSize: 13, fontWeight: "800" }}>Back</Text>
            </Press>
            <View style={{ flex: 1 }} pointerEvents="none" />
            <View style={[pill, { gap: 6 }]} pointerEvents="none">
              <Text style={{ fontSize: 16 }}>🏆</Text>
              <Text style={{ color: GOLD, fontSize: 13, fontWeight: "900" }}>{info.trophyCount + (career.ballonDorWins ?? 0)}</Text>
            </View>
            {career.horse && (
              <View style={[pill, { gap: 6 }]} pointerEvents="none">
                <Text style={{ fontSize: 16 }}>🐎</Text>
                <Text style={{ color: INK, fontSize: 13, fontWeight: "900" }}>{career.horse.racesWon}</Text>
              </View>
            )}
          </View>
        </SafeAreaView>
        {ctrl && near && near !== "fountain" && (
          <SafeAreaView edges={["bottom"]} pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 0, bottom: 0, alignItems: "flex-end", justifyContent: "flex-end", paddingRight: 12, paddingBottom: 24 }}>
            <SpotCard spot={near} career={career} info={info} visitors={visitors} onShop={onShop} onTraining={onTraining} />
          </SafeAreaView>
        )}
      </Walk3D>
    </View>
  );
}

const pill = { flexDirection: "row" as const, alignItems: "center" as const, height: 36, paddingHorizontal: 12, borderRadius: 18, backgroundColor: "rgba(18,13,10,0.62)", borderWidth: 1, borderColor: "rgba(255,230,200,0.14)" };
const card = { backgroundColor: "rgba(14,12,10,0.86)", borderWidth: 1, borderColor: "rgba(250,204,21,0.25)", borderRadius: 18, padding: 12, maxWidth: 300 };
const goBtn = { height: 38, paddingHorizontal: 16, borderRadius: 12, backgroundColor: GOLD, alignItems: "center" as const, justifyContent: "center" as const };

const pictureUri = (url: string) => packedPicture(url) ?? absoluteUrl(url);

/** The small card for wherever you are standing (components/star/Garden3D.tsx SpotCard). */
function SpotCard({ spot, career, info, visitors, onShop, onTraining }: {
  spot: GardenSpot; career: CareerState; info: ReturnType<typeof gardenData>; visitors: CareerState["squad"]; onShop: () => void; onTraining: () => void;
}) {
  if (spot === "shop") {
    return (
      <View style={[card, { flexDirection: "row", alignItems: "center", gap: 10 }]}>
        <Text style={{ fontSize: 24 }}>🛍️</Text>
        <Press onPress={onShop} style={goBtn}><Text style={{ color: "#111", fontWeight: "900", fontSize: 15 }}>Shop ›</Text></Press>
      </View>
    );
  }
  // your house: the door stays shut for now (WP3), so no card
  if (spot === "house") return null;
  if (spot === "casino") {
    // the casino is shut in this app: said on the door (the website's app version says the same)
    return (
      <View style={[card, { flexDirection: "row", alignItems: "center", gap: 10 }]}>
        <Text style={{ fontSize: 24 }}>🔒</Text>
        <Text style={{ color: INK, fontWeight: "900", fontSize: 15 }}>Casino · Locked</Text>
      </View>
    );
  }
  if (spot === "training") {
    return (
      <View style={[card, { flexDirection: "row", alignItems: "center", gap: 10 }]}>
        <Text style={{ fontSize: 24 }}>⚽</Text>
        <Press onPress={onTraining} style={goBtn}><Text style={{ color: "#111", fontWeight: "900", fontSize: 15 }}>Training ›</Text></Press>
      </View>
    );
  }
  if (spot === "trophies") {
    const shelf = info.shelf;
    return (
      <View style={card}>
        {shelf.length === 0 ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={{ fontSize: 22, opacity: 0.5 }}>🏆</Text>
            <Text style={{ color: INK, fontWeight: "900", fontSize: 18 }}>0</Text>
          </View>
        ) : (
          <View style={{ flexDirection: "row", flexWrap: "wrap", width: 4 * 62, gap: 6 }}>
            {shelf.slice(0, 12).map((t) => (
              <View key={t.name} style={{ width: 56, alignItems: "center" }}>
                <View>
                  <TrophyImage name={t.name} height={42} />
                  {t.count > 1 && <Text style={{ position: "absolute", right: -6, top: 26, fontSize: 11, fontWeight: "900", color: "#111", backgroundColor: GOLD, borderRadius: 9, paddingHorizontal: 5, overflow: "hidden" }}>×{t.count}</Text>}
                </View>
                <Text numberOfLines={1} style={{ marginTop: 2, color: INK, fontSize: 9, fontWeight: "800", opacity: 0.8 }}>{t.name}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  }
  if (spot === "mates") {
    return (
      <View style={[card, { flexDirection: "row", gap: 10 }]}>
        {visitors.map((p) => (
          <View key={p.id} style={{ alignItems: "center", gap: 4, width: 64 }}>
            <Image source={{ uri: pictureUri(p.imageUrl ?? fakeFaceFor(p.id)) }} style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: "#2a2622", borderWidth: 2, borderColor: "rgba(255,255,255,0.25)" }} />
            <Text numberOfLines={1} style={{ color: INK, fontSize: 11, fontWeight: "900", textAlign: "center", maxWidth: 64 }}>{p.name.split(" ").slice(-1)[0]}</Text>
          </View>
        ))}
      </View>
    );
  }
  if (spot === "horse") {
    const h = career.horse;
    return (
      <View style={card}>
        {h ? (
          <View style={{ gap: 6, minWidth: 170 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><Text style={{ fontSize: 16 }}>🐎</Text><Text style={{ color: INK, fontWeight: "900", fontSize: 16 }}>{h.name}</Text></View>
            <Bar icon="⚡" v={h.speed} />
            <Bar icon="🫁" v={h.stamina} />
            <View style={{ flexDirection: "row", gap: 12 }}>
              <Text style={{ color: INK, fontSize: 13, fontWeight: "900" }}>🏁 {h.racesRun}</Text>
              <Text style={{ color: GOLD, fontSize: 13, fontWeight: "900" }}>🥇 {h.racesWon}</Text>
            </View>
          </View>
        ) : (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, opacity: 0.6 }}><Text style={{ fontSize: 22 }}>🐎</Text><Text style={{ color: INK, fontWeight: "900" }}>0</Text></View>
        )}
      </View>
    );
  }
  if (spot === "cars") {
    const n = career.ownedItems.filter((it) => CAR_MODELS.includes(baseIdOf(it))).length;
    return (
      <View style={[card, { flexDirection: "row", alignItems: "center", gap: 8 }]}>
        <Text style={{ fontSize: 22 }}>🚗</Text><Text style={{ color: INK, fontWeight: "900", fontSize: 18 }}>{n}</Text>
      </View>
    );
  }
  if (spot === "teqball") {
    return (
      <View style={[card, { flexDirection: "row", alignItems: "center", gap: 8 }]}>
        <Text style={{ fontSize: 22 }}>⚽</Text><Text style={{ color: INK, fontWeight: "900" }}>Teqball</Text>
      </View>
    );
  }
  return null;
}

function Bar({ icon, v }: { icon: string; v: number }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Text style={{ width: 18 }}>{icon}</Text>
      <View style={{ flex: 1, height: 8, backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 2, overflow: "hidden" }}>
        <View style={{ width: `${Math.max(0, Math.min(100, v))}%`, height: "100%", backgroundColor: GOLD }} />
      </View>
      <Text style={{ color: INK, fontSize: 12, fontWeight: "900", width: 22, textAlign: "right" }}>{v}</Text>
    </View>
  );
}
