/**
 * YOUR HOUSE, IN 3D (the website's components/star/Home3D.tsx on the phone).
 *
 * The rooms you walk through: the wardrobe and mirror, the trophy cabinet, your cars out of the
 * window, and (a living house) the things you use and the team-mates who drop round. The scene is
 * the website's own (lib/star/home3d/scene.ts, not touched); ../../three/Walk3D.tsx runs it on the
 * phone's GL view with the stick, tap to walk, drag to look round, pinch to zoom.
 *
 * This file is the view round it, the website's screen line for line: the Back pill, the home's
 * name, the trophy count, the room's name and dots, the hint, and the card when you stop at
 * something:
 *   - the wardrobe: pick a casual set, a club kit or your boots; you change into it and see it in
 *     the mirror. The choice is saved on the career (withOutfit), and the Garden and the 3D shop
 *     show the casual set.
 *   - the trophy cabinet: what you have won, and how many times.
 *   - the drive window: the cars you own.
 *   - a living house: a thing or a team-mate's card (use it, leave, chat, sleep till morning).
 * The front door leads out to the Garden (`onDoor`).
 *
 * `HouseView` is also what HousePhone.tsx hosts behind the phone in your hand (in your own eyes,
 * held, with the touches off): one house, never loaded twice.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Platform, ScrollView, Text, View, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { CareerState } from "@/lib/star/types";
import type { HomeCallbacks, HomeController, HomeSpot } from "@/lib/star/home3d/scene";
import type { InteractCard } from "@/lib/star/world3d/interact";
import { roomPreset, homeNameOf, type HomeTier, type RoomId } from "@/lib/star/home3d/homes";
import { ROOM_LABEL } from "@/lib/star/home3d/rooms";
import { cabinetSlots } from "@/lib/star/home3d/trophies";
import { cabinetSize } from "@/lib/star/home3d/homes";
import { CASUAL_SETS, outfitOf, withOutfit, wornAt, bootChoices, carsOnDrive, type OutfitChoice } from "@/lib/star/home3d/outfits";
import { sleepNight } from "@/lib/star/home3d/sleep";
import { kitsOf } from "@/lib/star/kits";
import { levelName } from "@/lib/star/lifestyleLevels";
import { baseIdOf } from "@/lib/star/shopData";
import { useCareer, setCareer, getCareer } from "../../game/store";
import { usePrefs } from "../../game/prefs";
import { Press } from "../../ui/Press";
import { Walk3D, type WalkApi } from "../../three/Walk3D";
import { loadHouseStart, type HouseData } from "../../three/houseScene";
import { houseSceneData, houseKind } from "../../three/houseData";
import { TrophyImage } from "../career/Ceremonies";

const INK = "#f7f1e8";
const MUTED = "#c9bba8";
const GOLD = "#facc15";

type Tab = "casual" | "kit" | "boots";

/** What to look for in each room (bottom right; the website's ROOM_HINT). */
const ROOM_HINT: Partial<Record<RoomId, string>> = {
  main: "Wardrobe and mirror on the left. Trophies at the back. Your cars out of the window.",
  hallway: "Walk through a doorway to go to that room. The front door goes out to the garden.",
  lounge: "Your cars are out of the window.",
  dressing: "Wardrobe and mirror on the left. Your watches and jewellery on the island.",
  trophy: "Every trophy you have won is in the cabinet.",
};

export interface HouseViewProps {
  career: CareerState;
  /** Open in his eyes (the 3D phone is up): the scene's pov; HousePhone eases it out. */
  pov?: boolean;
  /** False: the 3D only, no buttons, no stick, and touches go through (the phone is up). */
  chrome?: boolean;
  backLabel?: string;
  onBack: () => void;
  /** Walked out of the front door. Absent: the door is shut. */
  onDoor?: () => void;
  /** The house is on screen and moving: its controller (HousePhone drives the camera with it). */
  onReady?: (c: HomeController) => void;
  /** The house was let go (the GL view was made again, or the screen closed). */
  onGone?: () => void;
  /** The 3D could not start: a way out besides Back. */
  fallback?: { label: string; onPress: () => void };
  /** Test hook: a home to force (the check's stills). */
  tier?: HomeTier;
}

export function HouseView({ career, pov = false, chrome = true, backLabel = "Home", onBack, onDoor, onReady, onGone, fallback, tier: tierProp }: HouseViewProps) {
  const prefs = usePrefs();
  const insets = useSafeAreaInsets();
  const [ctrl, setCtrl] = useState<HomeController | null>(null);
  const [near, setNear] = useState<HomeSpot | null>(null);
  const [dismissed, setDismissed] = useState<HomeSpot | null>(null);
  const [choice, setChoice] = useState<OutfitChoice>(() => outfitOf(career));
  const [tab, setTab] = useState<Tab>(() => (outfitOf(career).wear === "casual" ? "casual" : "kit"));
  const [changing, setChanging] = useState(false);
  const [roomNow, setRoomNow] = useState<RoomId | null>(null);
  const [lifeCard, setLifeCard] = useState<InteractCard | null>(null);
  const doorRef = useRef(onDoor);
  doorRef.current = onDoor;
  const readyRef = useRef(onReady);
  readyRef.current = onReady;
  const goneRef = useRef(onGone);
  goneRef.current = onGone;

  // one visit: the home you own as it opens (the website builds it once per visit too)
  const built = useMemo(() => houseSceneData(career as never, outfitOf(career), {
    pov, tier: tierProp,
    sleep: () => { const c = getCareer(); return c ? sleepNight(c) : null; },
    onSleep: () => setCareer((c) => (c ? sleepNight(c).career : c)),
  }), []); // eslint-disable-line react-hooks/exhaustive-deps
  const data: HouseData = built;
  const tier = built.tier;
  const kind = useMemo(() => houseKind(career, tierProp), []); // eslint-disable-line react-hooks/exhaustive-deps
  const rooms = kind.rooms;
  const room = roomPreset(tier);
  const kits = kitsOf(career.player.club);
  const slots = useMemo(() => cabinetSlots(career, cabinetSize(tier)), [career, tier]);
  const cars = useMemo(() => carsOnDrive(career, Math.max(room.cars, data.home.cars.length)), [career, room.cars, data.home.cars.length]);
  const boots = useMemo(() => bootChoices(career), [career]);
  const homeName = tierProp ? room.label : homeNameOf(career.ownedItems);

  const callbacks = (api: WalkApi): HomeCallbacks => ({
    onNear: (s) => { if (!api.dead()) setNear(s); },
    onRoom: (id) => { if (!api.dead()) setRoomNow(id); },
    onCard: (c) => { if (!api.dead()) setLifeCard(c); },
    onFps: () => { /* the speed readout (Settings → Show 3D speed) counts frames itself */ },
    ...(onDoor ? { onDoor: () => { if (!api.dead()) doorRef.current?.(); } } : {}),
    onContextLost: () => { if (!api.dead()) { console.warn("3D house: the phone took the 3D away"); api.restart(); } },
  });
  if (Platform.OS === "web" && ctrl) (globalThis as unknown as { __home3d?: HomeController }).__home3d = ctrl;

  const open: HomeSpot | null = near && dismissed !== near ? near : null;
  useEffect(() => { if (!near) setDismissed(null); }, [near]);
  useEffect(() => { ctrl?.setCardOpen(open); if (open) ctrl?.setStick(0, 0); }, [open, ctrl]);

  /** Pick something in the wardrobe: change into it, save it. */
  const pick = (patch: Partial<OutfitChoice>) => {
    const next: OutfitChoice = { ...choice, ...patch };
    setChoice(next);
    setCareer((c) => (c ? withOutfit(c, next) : c));
    if (!ctrl) return;
    setChanging(true);
    ctrl.wear(wornAt({ outfit: next, currentBoot: career.currentBoot }, "home")).finally(() => setChanging(false));
  };
  /** A short tap (the website's onTap): a spot already open opens again; else he walks there. */
  const onTap = (c: HomeController, x: number, y: number) => {
    const s = c.pick(x, y);
    if (s && s === near) { setDismissed(null); return; }
    c.tap(x, y);
  };
  const close = () => { if (near) setDismissed(near); ctrl?.setStick(0, 0); };
  const casualOn = choice.wear === "casual";
  const top = Math.max(12, insets.top);
  const trophyTotal = slots.filter((s) => s.won).reduce((n, s) => n + s.count, 0);

  return (
    <View style={{ flex: 1, backgroundColor: "#1a1612" }}>
      <Walk3D<HouseData, HomeCallbacks, HomeController>
        name="Your house" cover="#1a1612" load={loadHouseStart} data={data} callbacks={callbacks}
        onBack={onBack} onController={(c) => { setCtrl(c); if (c) readyRef.current?.(c); else goneRef.current?.(); }} showSpeed={prefs.show3dSpeed && chrome}
        onTap={onTap} hideStick={!!open || !chrome} inert={!chrome}
        loading={{ title: "Opening your house…", sub: "Loading the 3D" }} fallback={fallback}>
        {chrome && (
          <>
            {/* top bar */}
            <View pointerEvents="box-none" style={{ position: "absolute", top: 0, left: 0, right: 0, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingTop: top }}>
              <Press onPress={onBack} style={[pill, { gap: 4, paddingLeft: 10 }]}>
                <Text style={{ color: INK, fontSize: 20, lineHeight: 22, marginTop: -2 }}>‹</Text>
                <Text style={{ color: INK, fontSize: 13, fontWeight: "800" }}>{backLabel}</Text>
              </Press>
              <View pointerEvents="none" style={[pill, { gap: 6, maxWidth: "52%" }]}>
                <Text style={{ fontSize: 14 }}>🏠</Text>
                <Text numberOfLines={1} style={{ color: INK, fontWeight: "900", fontSize: 14, flexShrink: 1 }}>{homeName}</Text>
              </View>
              <View style={{ flex: 1 }} pointerEvents="none" />
              <View pointerEvents="none" style={[pill, { gap: 6 }]}>
                <Text style={{ fontSize: 15 }}>🏆</Text>
                <Text style={{ color: GOLD, fontWeight: "900", fontSize: 13 }}>{trophyTotal}</Text>
              </View>
            </View>

            {ctrl && rooms.length > 1 && roomNow && (
              <View pointerEvents="box-none" style={{ position: "absolute", top: top + 48, left: 0, right: 0, alignItems: "center", gap: 6 }}>
                <View pointerEvents="none" style={[pill, { height: 30 }]}><Text style={{ color: INK, fontWeight: "900", fontSize: 13 }}>{ROOM_LABEL[roomNow]}</Text></View>
                <View style={{ flexDirection: "row", gap: 2 }}>
                  {rooms.map((id) => (
                    <Press key={id} onPress={() => { void ctrl.goToRoom(id); }} hitSlop={6} style={{ width: 26, height: 26, alignItems: "center", justifyContent: "center" }}>
                      <View style={{ width: id === roomNow ? 10 : 7, height: id === roomNow ? 10 : 7, borderRadius: 5, backgroundColor: id === roomNow ? GOLD : "rgba(255,255,255,0.55)" }} />
                    </Press>
                  ))}
                </View>
              </View>
            )}

            {ctrl && !open && !lifeCard && (
              <View pointerEvents="none" style={{ position: "absolute", bottom: 40, right: 16, maxWidth: 180 }}>
                <Text style={{ textAlign: "right", fontSize: 12.5, fontWeight: "800", color: INK, lineHeight: 17.5, textShadowColor: "rgba(0,0,0,0.8)", textShadowRadius: 6, textShadowOffset: { width: 0, height: 1 } }}>
                  {ROOM_HINT[roomNow ?? "main"] ?? ""}
                </Text>
              </View>
            )}

            {/* a living house: the card of a thing or a team-mate (lib/star/world3d/interact.ts) */}
            {ctrl && lifeCard && (
              <View style={{ position: "absolute", left: 12, right: 12, bottom: Math.max(16, insets.bottom), maxWidth: 460, alignSelf: "center", padding: 12, paddingHorizontal: 14, borderRadius: 14, backgroundColor: "rgba(8,10,16,0.9)", borderTopWidth: 3, borderTopColor: GOLD }}>
                {lifeCard.sub ? <Text style={{ fontSize: 11, fontWeight: "900", color: GOLD, textTransform: "uppercase", letterSpacing: 0.5 }}>{lifeCard.sub}</Text> : null}
                <Text style={{ fontSize: 18, fontWeight: "900", color: "#f8fafc" }}>{lifeCard.title}</Text>
                {lifeCard.lines.map((l, i) => <Text key={i} style={{ fontSize: 14, lineHeight: 19, marginTop: 4, color: i ? "#cbd5e1" : "#f8fafc" }}>{l}</Text>)}
                {lifeCard.change ? <Text style={{ fontSize: 12, fontWeight: "800", color: "#86efac", marginTop: 6 }}>{lifeCard.change}</Text> : null}
                <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                  {lifeCard.actions.map((a) => (
                    <Press key={a.id} onPress={() => ctrl.act?.(a.id)} style={{ flex: a.primary ? 2 : 1, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center", borderWidth: a.primary ? 0 : 1, borderColor: "rgba(255,255,255,0.25)", backgroundColor: a.primary ? GOLD : "transparent" }}>
                      <Text style={{ color: a.primary ? "#111" : "#f8fafc", fontWeight: "900", fontSize: 14 }}>{a.label}</Text>
                    </Press>
                  ))}
                </View>
              </View>
            )}

            {ctrl && open && (
              <View style={[card, { bottom: Math.max(10, insets.bottom) }]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <Text style={{ fontSize: 11, fontWeight: "900", letterSpacing: 0.9, textTransform: "uppercase", color: MUTED }}>
                    {open === "wardrobe" ? "Wardrobe" : open === "cabinet" ? "Trophy cabinet" : "Your cars"}
                  </Text>
                  {open === "wardrobe" && changing ? <Text style={{ fontSize: 11, fontWeight: "900", color: "#111", backgroundColor: GOLD, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, overflow: "hidden" }}>Changing…</Text> : null}
                  <View style={{ flex: 1 }} />
                  <Press onPress={close} style={[round, { width: 40, height: 40, borderRadius: 20 }]}><Text style={{ color: INK, fontSize: 15, fontWeight: "900" }}>✕</Text></Press>
                </View>

                {open === "wardrobe" && (
                  <>
                    <View style={{ flexDirection: "row", gap: 6, marginBottom: 10 }}>
                      {(["casual", "kit", "boots"] as Tab[]).map((t) => (
                        <Press key={t} onPress={() => setTab(t)} style={[tabStyle, tab === t ? tabOn : null]}>
                          <Text style={{ color: INK, fontWeight: "900", fontSize: 13 }}>{t === "casual" ? "Clothes" : t === "kit" ? "Kits" : "Boots"}</Text>
                        </Press>
                      ))}
                    </View>
                    {tab === "casual" && (
                      <View style={grid}>
                        {CASUAL_SETS.map((s) => {
                          const on = casualOn && choice.casual === s.id;
                          const [a, b] = s.swatch(kits.home);
                          return (
                            <Press key={s.id} onPress={() => pick({ wear: "casual", casual: s.id })} style={[tile, on ? tileOn : null, { width: "31%" }]}>
                              <Swatch top={a} low={b} />
                              <Text style={{ color: INK, fontSize: 12, fontWeight: "900", lineHeight: 14 }}>{s.label}</Text>
                            </Press>
                          );
                        })}
                      </View>
                    )}
                    {tab === "kit" && (
                      <View style={grid}>
                        {(["home", "away"] as const).map((k) => {
                          const on = !casualOn && choice.kit === k;
                          return (
                            <Press key={k} onPress={() => pick({ wear: "kit", kit: k })} style={[tile, on ? tileOn : null, { width: "48%" }]}>
                              <Swatch top={kits[k].shirt} low={kits[k].trim} kit />
                              <Text style={{ color: INK, fontSize: 12, fontWeight: "900" }}>{k === "home" ? "Home kit" : "Away kit"}</Text>
                            </Press>
                          );
                        })}
                      </View>
                    )}
                    {tab === "boots" && (
                      <View style={grid}>
                        {boots.map((b) => {
                          const on = (choice.boots ?? "own") === b.id;
                          return (
                            <Press key={b.id} onPress={() => pick({ wear: "kit", boots: b.id })} style={[tile, on ? tileOn : null, { width: "48%" }]}>
                              <View style={{ width: 40, height: 16, borderRadius: 8, backgroundColor: b.colour, borderWidth: 1, borderColor: "rgba(255,255,255,0.35)" }} />
                              <Text style={{ color: INK, fontSize: 12, fontWeight: "900", lineHeight: 14 }}>{b.label}</Text>
                            </Press>
                          );
                        })}
                      </View>
                    )}
                    <Text style={{ fontSize: 12, fontWeight: "700", color: MUTED, marginTop: 8 }}>
                      {casualOn ? "You wear these clothes in the garden and the shop. Training is always in kit." : "Boots show with a kit."}
                    </Text>
                  </>
                )}

                {open === "cabinet" && (
                  <ScrollView style={{ maxHeight: 250 }} contentContainerStyle={{ flexDirection: "row", flexWrap: "wrap", rowGap: 8 }}>
                    {slots.map((s) => (
                      <View key={s.name} style={{ width: "25%", alignItems: "center", gap: 2, opacity: s.won ? 1 : 0.38 }}>
                        <TrophyImage name={s.name} height={40} />
                        <Text numberOfLines={2} style={{ color: INK, fontSize: 10, fontWeight: "800", textAlign: "center", lineHeight: 11 }}>{s.name}</Text>
                        {s.count > 1 ? <Text style={{ position: "absolute", right: 6, top: 0, fontSize: 11, fontWeight: "900", color: "#111", backgroundColor: GOLD, borderRadius: 9, paddingHorizontal: 5, overflow: "hidden" }}>×{s.count}</Text> : null}
                      </View>
                    ))}
                  </ScrollView>
                )}

                {open === "drive" && (
                  cars.length === 0 ? (
                    <Text style={{ fontSize: 14, fontWeight: "800", color: MUTED }}>No cars yet. Buy one in the shop and it parks here.</Text>
                  ) : (
                    <View style={{ gap: 6 }}>
                      {career.ownedItems.filter((it) => cars.some((c) => c.id === baseIdOf(it))).map((it) => (
                        <View key={it.id} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                          <Text>🚗</Text><Text style={{ color: INK, fontWeight: "900", fontSize: 14 }}>{levelName(it)}</Text>
                        </View>
                      ))}
                    </View>
                  )
                )}
              </View>
            )}
          </>
        )}
      </Walk3D>
    </View>
  );
}

/** A little outfit drawing: a top over trousers (or shorts for a kit), drawn with boxes. */
function Swatch({ top, low, kit = false }: { top: string; low: string; kit?: boolean }) {
  return (
    <View style={{ width: 44, height: 44, alignItems: "center" }}>
      <View style={{ width: 40, height: 6, marginTop: 3, borderRadius: 3, backgroundColor: top, borderWidth: 1, borderColor: "rgba(0,0,0,0.45)" }} />
      <View style={{ width: 22, height: 19, backgroundColor: top, borderWidth: 1, borderColor: "rgba(0,0,0,0.45)" }} />
      <View style={{ width: 18, height: kit ? 8 : 15, marginTop: 1, backgroundColor: low, borderWidth: 1, borderColor: "rgba(0,0,0,0.45)" }} />
    </View>
  );
}

const pill = { flexDirection: "row" as const, alignItems: "center" as const, height: 36, paddingHorizontal: 12, borderRadius: 18, backgroundColor: "rgba(18,13,10,0.62)", borderWidth: 1, borderColor: "rgba(255,230,200,0.14)" };
const round = { width: 34, height: 34, borderRadius: 17, alignItems: "center" as const, justifyContent: "center" as const, borderWidth: 1, borderColor: "rgba(255,255,255,0.14)", backgroundColor: "rgba(255,255,255,0.06)" };
const card = { position: "absolute", left: 10, right: 10, backgroundColor: "rgba(20,15,11,0.94)", borderWidth: 1, borderColor: "rgba(250,204,21,0.25)", borderRadius: 20, padding: 14, boxShadow: "0px 18px 40px -12px rgba(0,0,0,0.8)" } as ViewStyle;
const tabStyle = { flex: 1, height: 36, borderRadius: 10, alignItems: "center" as const, justifyContent: "center" as const, borderWidth: 1, borderColor: "rgba(255,255,255,0.14)", backgroundColor: "rgba(255,255,255,0.05)" };
const tabOn = { backgroundColor: "rgba(250,204,21,0.16)", borderWidth: 2, borderColor: GOLD };
const grid = { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 6, rowGap: 6 };
const tile = { alignItems: "center" as const, gap: 4, paddingVertical: 8, paddingHorizontal: 4, borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", backgroundColor: "rgba(255,255,255,0.04)" };
const tileOn = { borderWidth: 2, borderColor: GOLD, backgroundColor: "rgba(250,204,21,0.12)" };
