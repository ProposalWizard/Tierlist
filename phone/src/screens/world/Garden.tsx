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
 *   shop door      → the 3D shop (screens/world/Shop3D.tsx; its plain card offers the normal Shop if the 3D cannot start)
 *   training gate  → the 3D training pitch (screens/world/Training3D.tsx); the app's Training screen when the 3D is off
 *   house door     → your 3D house (screens/world/House3D.tsx; its front door and Back lead out here)
 *   casino door    → shut: "Casino · Locked" (this app has no casino)
 * Back goes to where you came from (the Phone).
 *
 * KIB RIDE (25 Nov 2026): if you own a horse you can get on it (a Ride button on its card, or a tap on it) and ride it round the garden; every car
 * you own can be driven (a chip for each on the cars' card, a Drive button when you stand by one, or a tap on it). While you ride or drive the
 * stick steers, the spot cards go, and a small speed readout and a Dismount / Get out button take their place. The scene is ../../three/garden/sceneRide.ts.
 */
import { useMemo, useRef, useState } from "react";
import { Image, Platform, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { CareerState } from "@/lib/star/types";
import type { GardenCallbacks, GardenController, GardenData, GardenSpot, RideInfo } from "../../three/garden/sceneRide";
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
import { markStep, partOff } from "../../safety";
import { SCREENS } from "../../areas/registry";
import { packedPicture } from "../../data/packed";
import { absoluteUrl } from "../../draw/offscreen";
import { Walk3D, type WalkApi } from "../../three/Walk3D";
import { loadGardenStart } from "../../three/gardenScene";
import { TrophyImage } from "../career/Ceremonies";

const INK = "#f7f1e8";
const GOLD = "#facc15";
/** The car families the shop has a 3D model of (lib/star/shop3d/catalogue.ts). */
const CAR_MODELS = ["car-1", "car-2", "suv", "car-3", "classic", "car-4"];

/** The car families you own, in the order the garden parks them (the scene parks the first three). */
const ownedCarIds = (career: CareerState) => { const owned = new Set(career.ownedItems.map((it) => baseIdOf(it))); return CAR_MODELS.filter((id) => owned.has(id)).slice(0, 3); };
const carName = (career: CareerState, id: string) => career.ownedItems.find((it) => baseIdOf(it) === id)?.name ?? "Car";

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
  const [ride, setRide] = useState<RideInfo | null>(null);
  const rideSeen = useRef<string>("walk");
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
    // params.sky: the look check's way to ask for a time of day ("day" | "sunset" | "night"); the game leaves it to your next match
    const sky = params?.sky === "day" || params?.sky === "sunset" || params?.sky === "night" ? params.sky : undefined;
    const d = gardenSceneData(career, arrive, sky);
    // params.step: the look check's way to make every frame move the game on by a fixed time (software GL draws a frame a second); the game never passes it
    if (typeof params?.step === "number" && params.step > 0 && params.step <= 0.2) d.fixedStep = params.step;
    return d;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** The 3D shop, stepping in at its doors; the app's own Shop when the 3D is off (the crash guard) or cannot open. */
  const onShop = () => { comeBack = "shop"; if (partOff("3d") || !SCREENS["shop-3d"]) nav.go("shop"); else nav.go("shop-3d", { from: "garden", atDoor: true }); };
  /** The 3D training pitch (the website's training gate); the app's own Training screen when the crash guard has the 3D off. */
  const onTraining = () => { comeBack = "training"; if (partOff("3d") || !SCREENS["training-3d"]) nav.go("career-training"); else nav.go("training-3d"); };
  /** Your 3D house; its front door and Back bring you out at its door. Shut when the crash guard has the 3D off. */
  const onHouse = () => { if (partOff("3d") || !SCREENS["house"]) return; comeBack = "house"; nav.go("house", { from: "garden" }); };
  const hooks = useRef({ onShop, onTraining, onHouse });
  hooks.current = { onShop, onTraining, onHouse };

  const callbacks = (api: WalkApi): GardenCallbacks => ({
    onNear: (s) => { if (!api.dead()) setNear(s); },
    onFps: () => { /* the speed readout (Settings → Show 3D speed) counts frames itself */ },
    onRide: (r) => {
      if (api.dead()) return;
      // the crash trail (../../safety.ts): a close in the middle of a ride shows which kind in Settings next launch
      const now = r.mode === "walk" ? "walk" : `${r.mode}:${r.phase === "leave" ? "stop" : "start"}`;
      if (now !== rideSeen.current) {
        rideSeen.current = now;
        markStep("The garden", r.mode === "walk" ? "ride stop / drive stop" : r.phase === "leave" ? "ride/drive stopping" : r.mode === "horse" ? "ride start" : "drive start");
      }
      setRide(r);
    },
    onShopDoor: () => { if (!api.dead()) hooks.current.onShop(); },
    onTrainingGate: () => { if (!api.dead()) hooks.current.onTraining(); },
    onHouseDoor: () => { if (!api.dead()) hooks.current.onHouse(); },
    // no onCasinoDoor: the casino's door stays shut (not in this app)
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
        {ctrl && ride && ride.mode !== "walk" && (
          <SafeAreaView edges={["bottom"]} pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 0, bottom: 0, alignItems: "flex-end", justifyContent: "flex-end", paddingRight: 12, paddingBottom: 24 }}>
            <RideHud ride={ride} career={career} onStop={() => ctrl.ride.stop()} />
          </SafeAreaView>
        )}
        {ctrl && (!ride || ride.mode === "walk") && near && near !== "fountain" && (
          <SafeAreaView edges={["bottom"]} pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 0, bottom: 0, alignItems: "flex-end", justifyContent: "flex-end", paddingRight: 12, paddingBottom: 24 }}>
            <SpotCard spot={near} career={career} info={info} visitors={visitors} onShop={onShop} onTraining={onTraining} onHouse={onHouse} ride={ride} onRide={() => ctrl.ride.mountHorse()} onDrive={(i) => ctrl.ride.driveCar(i)} />
          </SafeAreaView>
        )}
        {/* a horse or a car of yours is close but its card is not up (left outside the paddock, a car parked elsewhere): a button of its own */}
        {ctrl && ride && ride.mode === "walk" && !ride.off && (ride.canRide && near !== "horse" || ride.canDrive && near !== "cars") && (
          <SafeAreaView edges={["bottom"]} pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 0, bottom: 0, alignItems: "flex-end", justifyContent: "flex-end", paddingRight: 12, paddingBottom: (near && near !== "fountain" ? 110 : 24) }}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {ride.canRide && near !== "horse" && <Press onPress={() => ctrl.ride.mountHorse()} style={[goBtn, { flexDirection: "row", gap: 6 }]}><Text style={{ fontSize: 16 }}>🐎</Text><Text style={{ color: "#111", fontWeight: "900", fontSize: 15 }}>Ride</Text></Press>}
              {ride.canDrive && near !== "cars" && ride.car !== null && <Press onPress={() => ctrl.ride.driveCar(ride.car ?? undefined)} style={[goBtn, { flexDirection: "row", gap: 6 }]}><Text style={{ fontSize: 16 }}>🚗</Text><Text style={{ color: "#111", fontWeight: "900", fontSize: 15 }}>Drive</Text></Press>}
            </View>
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
function SpotCard({ spot, career, info, visitors, onShop, onTraining, onHouse, ride, onRide, onDrive }: {
  spot: GardenSpot; career: CareerState; info: ReturnType<typeof gardenData>; visitors: CareerState["squad"]; onShop: () => void; onTraining: () => void; onHouse: () => void;
  ride: RideInfo | null; onRide: () => void; onDrive: (i: number) => void;
}) {
  if (spot === "shop") {
    return (
      <View style={[card, { flexDirection: "row", alignItems: "center", gap: 10 }]}>
        <Text style={{ fontSize: 24 }}>🛍️</Text>
        <Press onPress={onShop} style={goBtn}><Text style={{ color: "#111", fontWeight: "900", fontSize: 15 }}>Shop ›</Text></Press>
      </View>
    );
  }
  if (spot === "house") {
    return (
      <View style={[card, { flexDirection: "row", alignItems: "center", gap: 10 }]}>
        <Text style={{ fontSize: 24 }}>🏠</Text>
        <Press onPress={onHouse} style={goBtn}><Text style={{ color: "#111", fontWeight: "900", fontSize: 15 }}>Your house ›</Text></Press>
      </View>
    );
  }
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
            {ride && !ride.off && <Press onPress={onRide} style={[goBtn, { alignSelf: "stretch", marginTop: 2 }]}><Text style={{ color: "#111", fontWeight: "900", fontSize: 15 }}>Ride ›</Text></Press>}
          </View>
        ) : (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, opacity: 0.6 }}><Text style={{ fontSize: 22 }}>🐎</Text><Text style={{ color: INK, fontWeight: "900" }}>0</Text></View>
        )}
      </View>
    );
  }
  if (spot === "cars") {
    const n = career.ownedItems.filter((it) => CAR_MODELS.includes(baseIdOf(it))).length;
    const ids = ownedCarIds(career);
    return (
      <View style={[card, { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }]}>
        <Text style={{ fontSize: 22 }}>🚗</Text><Text style={{ color: INK, fontWeight: "900", fontSize: 18 }}>{n}</Text>
        {ride && !ride.off && ids.map((id, i) => (
          <Press key={id} onPress={() => onDrive(i)} style={[goBtn, { height: 34, paddingHorizontal: 12 }]}><Text numberOfLines={1} style={{ color: "#111", fontWeight: "900", fontSize: 13, maxWidth: 110 }}>Drive {carName(career, id)}</Text></Press>
        ))}
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

/** While you ride or drive: how fast, and the way off. */
function RideHud({ ride, career, onStop }: { ride: RideInfo; career: CareerState; onStop: () => void }) {
  const horse = ride.mode === "horse";
  const word = ride.phase === "call" ? "Coming…" : ride.phase === "mount" ? (horse ? "Getting on…" : "Getting in…") : ride.phase === "leave" ? "Slowing…" : horse ? ride.gait.charAt(0).toUpperCase() + ride.gait.slice(1) : "";
  const car = !horse && ride.car !== null ? carName(career, ownedCarIds(career)[ride.car] ?? "") : "";
  return (
    <View style={[card, { flexDirection: "row", alignItems: "center", gap: 12 }]}>
      <Text style={{ fontSize: 22 }}>{horse ? "🐎" : "🚗"}</Text>
      <View style={{ minWidth: 70 }}>
        <Text style={{ color: INK, fontWeight: "900", fontSize: 20, lineHeight: 22 }}>{ride.mph}<Text style={{ fontSize: 11, fontWeight: "800", opacity: 0.7 }}> mph</Text></Text>
        {(word || car) ? <Text numberOfLines={1} style={{ color: GOLD, fontWeight: "800", fontSize: 11 }}>{word || car}</Text> : null}
      </View>
      {ride.phase !== "call" && <Press onPress={onStop} style={goBtn}><Text style={{ color: "#111", fontWeight: "900", fontSize: 15 }}>{horse ? "Dismount" : "Get out"}</Text></Press>}
    </View>
  );
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
