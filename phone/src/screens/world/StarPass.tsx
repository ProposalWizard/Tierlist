/**
 * THE STAR PASS — the phone port of components/star/StarRatingSheet.tsx, in
 * its look: a road you climb from level 1 at the bottom to 100 at the top,
 * a gold rail on the left with your face at your level, and every reward
 * standing on its podium beside its level (the website's own renders,
 * public/star/star-pass → assets/look/starpass). The road's picture changes
 * every 20 levels (Premier, Europa, Champions, World Cup, Golden Ball).
 * On top: the gold star with your level, STAR PASS in gold Cinzel, your title,
 * LOCKER and PTS. The game's bottom bar underneath, as on the website.
 *
 * Tap a reward to see it big; claim it the moment you reach it ("Use it" or
 * "Later": the game's own starPassClaim). The layout is the one built into
 * the game (rewardCatalogue DEFAULT_PASS_LEVELS): the phone works offline.
 * The tapped reward is live 3D you drag round (../../podium/Podium3D.tsx, the website's Podium3D; WP6), the still
 * picture under it until it is up and for good if the 3D cannot start.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Image, Modal, ScrollView, Text, View, useWindowDimensions, type ImageSourcePropType, type ViewStyle } from "react-native";
import { RewardReveal } from "./Locker";
import { useNav } from "../../nav";
import { starStatus, starTitle, STAR_GATES, ledgerOf, MAX_LEVEL } from "@/lib/star/starPoints";
import { STAR_PASS_THEMES, rewardLevelsOf, rewardTier, themeFor } from "@/lib/star/starPassRewards";
import { findCard, fullCatalogue, DEFAULT_PASS_LEVELS, type CatalogueItem } from "@/lib/star/rewardCatalogue";
import { claimableLevels, claimLevel, equipCard, isClaimed } from "@/lib/star/starPassClaim";
import { DEFAULT_FAKE_FACE } from "@/lib/star/fakeFaces";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCareer, setCareer, getCareer } from "../../game/store";
import { packedPicture } from "../../data/packed";
import { Press } from "../../ui/Press";
import { BottomBar, FONT, LookButton } from "../../ui/look";
import { STAR_PASS_PIC } from "../../ui/look/worldPics";
import { Podium3D } from "../../podium/Podium3D";
import { usePrefs } from "../../game/prefs";

const ART = "/star/star-pass";
const fmt = (n: number) => Math.round(n).toLocaleString("en-GB");
const pic = (url?: string): ImageSourcePropType | undefined => (url ? STAR_PASS_PIC[url] : undefined);

// The website's road (StarRatingSheet.tsx), unchanged.
const GAP = 30;
const SLOT_MEDIUM = 178;
const SLOT_GREAT = 226;
const SLOT_TOP = 250;
const PLINTH_MEDIUM = 196;
const PLINTH_GREAT = 246;
const SLOT_GAP = 14;
const ROAD_TOP = 210;
const ROAD_BOTTOM = 60;
const RAIL_X = 50;
const HEADER_H = 92;
const FADE = 130;

function stopHeight(level: number): number {
  if (level === MAX_LEVEL) return SLOT_TOP;
  return rewardTier(level) === "great" ? SLOT_GREAT : SLOT_MEDIUM;
}
function buildY(stops: number[]): number[] {
  const y = [0, ROAD_BOTTOM];
  if (stops[0] === 1) y[1] = Math.max(ROAD_BOTTOM, stopHeight(1) / 2 + 14);
  for (let i = 2; i <= MAX_LEVEL; i++) {
    const r = stops.find((n) => n >= i) ?? MAX_LEVEL;
    const prev = [...stops].reverse().find((n) => n < i);
    const span = r - (prev ?? 1);
    const below = prev != null ? stopHeight(prev) / 2 : 40;
    const need = (below + stopHeight(r) / 2 + SLOT_GAP) / Math.max(1, span);
    y[i] = y[i - 1] + Math.max(GAP, need);
  }
  return y;
}

export function StarPassScreen() {
  const career = useCareer();
  const catalogue = useMemo(() => fullCatalogue(), []);
  const levels = DEFAULT_PASS_LEVELS;
  const stops = useMemo(() => rewardLevelsOf(levels), [levels]);
  const Y = useMemo(() => buildY(stops), [stops]);
  const [preview, setPreview] = useState<number | null>(null);
  const [reveal, setReveal] = useState<number | null>(null);
  const nav = useNav();
  const [points, setPoints] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [w, setW] = useState(0);
  const scrolled = useRef(false);
  const inset = useSafeAreaInsets();
  if (!career) return null;
  const yOf = (n: number) => Y[Math.max(1, Math.min(MAX_LEVEL, n))];
  const st = starStatus(career);
  const cardAt = (n: number) => findCard(levels[n], catalogue);
  const claimable = new Set(claimableLevels(career, levels, st.stars));
  const nextReward = stops.find((n) => n > st.stars);
  const roadH = yOf(MAX_LEVEL) + ROAD_TOP;
  const lv = Math.min(MAX_LEVEL, st.stars);
  const frac = lv < MAX_LEVEL && !st.gate ? Math.max(0, Math.min(1, st.toNext)) : 0;
  const hereY = yOf(lv) + frac * (yOf(Math.min(MAX_LEVEL, lv + 1)) - yOf(lv));
  const led = ledgerOf(career);
  const gates = STAR_GATES.map((g) => ({ ...g, isOpen: g.open(career, led) }));
  const faceUrl = career.player.portrait ?? DEFAULT_FAKE_FACE;
  const face = /^(data:|file:|https?:)/.test(faceUrl) ? faceUrl : packedPicture(faceUrl);
  const rows: [string, number][] = [
    ["Matches", st.points.match], ["Trophies", st.points.trophies], ["Awards", st.points.awards],
    ["Milestones", st.points.milestones], ["Fame", st.points.status], ...(st.carry > 0 ? [["Carried", st.carry] as [string, number]] : []),
    // Poor matches (rating under 5.5) cost points (starPoints.ts slumpAfterMatch): shown, so
    // the lines add up to STAR POINTS (the total read 780 under lines worth 4,130).
    ...((led.slump?.debt ?? 0) > 0 ? [["Poor matches", -(led.slump!.debt)] as [string, number]] : []),
  ];
  const digits = String(st.stars).length;
  const top = (y: number) => roadH - y; // the road is laid out from its bottom
  const flash = (t: string) => { setNote(t); setTimeout(() => setNote((n) => (n === t ? null : n)), 2600); };
  const shown = preview !== null ? cardAt(preview) : undefined;

  return (
    <View style={{ flex: 1, backgroundColor: "#05080f" }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
        ref={(sv) => {
          // Open on you: your marker a little below the middle of the screen (once).
          if (sv && !scrolled.current) { scrolled.current = true; setTimeout(() => sv.scrollTo({ y: Math.max(0, roadH - hereY - 844 * 0.55), animated: false }), 0); }
        }}>
        <View style={{ height: roadH, overflow: "hidden" }}>
          {/* each stretch's picture, a new one every 20 levels */}
          {STAR_PASS_THEMES.map((t, i) => {
            const first = i === 0, last = t.to >= MAX_LEVEL;
            const bottom = first ? 0 : yOf(t.from) - FADE / 2;
            const tp = last ? roadH : yOf(t.to) + FADE / 2;
            return <Image key={t.key} source={pic(t.bg)!} resizeMode="cover" fadeDuration={0} style={{ position: "absolute", left: 0, right: 0, top: top(tp), height: tp - bottom }} />;
          })}
          {/* the joins: a soft dark band where one picture meets the next */}
          {STAR_PASS_THEMES.slice(1).map((t) => (
            <View key={`j${t.key}`} pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: top(yOf(t.from) + FADE / 2), height: FADE, backgroundImage: "linear-gradient(180deg, rgba(5,8,15,0) 0%, rgba(5,8,15,0.85) 50%, rgba(5,8,15,0) 100%)" } as ViewStyle} />
          ))}

          {/* the rail, filled up to you */}
          <View style={{ position: "absolute", left: RAIL_X - 4, width: 8, top: top(yOf(MAX_LEVEL)), height: yOf(MAX_LEVEL) - ROAD_BOTTOM, borderRadius: 2, backgroundColor: "rgba(0,0,0,0.6)", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" }} />
          <View style={{ position: "absolute", left: RAIL_X - 4, width: 8, top: top(hereY), height: Math.max(0, hereY - ROAD_BOTTOM), borderRadius: 2, backgroundImage: "linear-gradient(0deg, #f59e0b, #fde047)", boxShadow: "0px 0px 12px rgba(251,191,36,0.7)" } as ViewStyle} />

          {/* a mark at every level; the number where there is a reward (and 1 and 100) */}
          {Array.from({ length: MAX_LEVEL }, (_, i) => i + 1).map((n) => {
            const labelled = n === 1 || n === MAX_LEVEL || stops.includes(n);
            const reached = n <= st.stars;
            const s = labelled ? 11 : 4;
            return (
              <View key={n} pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: top(yOf(n)), height: 0 }}>
                <View style={{ position: "absolute", left: RAIL_X - s / 2, top: -s / 2, width: s, height: s, borderRadius: labelled ? 1 : 2, transform: labelled ? [{ rotate: "45deg" }] : undefined,
                  backgroundColor: reached ? "#fde047" : labelled ? "#ffffff" : "rgba(255,255,255,0.6)", borderWidth: labelled && !reached ? 1.5 : 0, borderColor: "rgba(0,0,0,0.45)" }} />
                {labelled && (
                  <Text style={{ position: "absolute", left: 0, width: RAIL_X - 12, top: -11, textAlign: "right", fontFamily: FONT.serif, fontSize: 14, lineHeight: 20, color: reached ? "#fde047" : "#fff", textShadowColor: "#000", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 }}>{n}</Text>
                )}
              </View>
            );
          })}

          {/* a closed gate: a padlock on the rail */}
          {gates.filter((g) => !g.isOpen).map((g) => (
            <View key={g.cap} style={{ position: "absolute", left: RAIL_X - 11, top: top((yOf(g.cap) + yOf(g.cap + 1)) / 2) - 11, width: 22, height: 22, borderRadius: 4, alignItems: "center", justifyContent: "center", backgroundColor: "#7f1d1d", borderWidth: 2, borderColor: "#f87171" }}>
              <Text style={{ fontSize: 11 }}>🔒</Text>
            </View>
          ))}

          {/* a podium and its reward at every reward level */}
          {w > 0 && stops.map((n) => (
            <RewardStop key={n} level={n} y={top(yOf(n))} width={w} card={cardAt(n)} reached={n <= st.stars} next={n === nextReward}
              claimable={claimable.has(n)} claimed={isClaimed(career, n)} onOpen={() => (claimable.has(n) && cardAt(n) ? setReveal(n) : setPreview(n))} />
          ))}

          {/* you */}
          <View style={{ position: "absolute", left: RAIL_X - 19, top: top(hereY) - 19, width: 38, height: 38, borderRadius: 4, overflow: "hidden", backgroundColor: "#111827", borderWidth: 2, borderColor: "#fde047", boxShadow: "0px 0px 14px rgba(253,224,71,0.8)" } as ViewStyle}>
            {face ? <Image source={{ uri: face }} style={{ width: "100%", height: "100%" }} /> : null}
          </View>
        </View>
      </ScrollView>

      {/* where you are: the gold star with your level, laid over the top of the road */}
      <View pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 0, top: 0, paddingTop: inset.top }}>
        <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, height: HEADER_H + 44, backgroundImage: "linear-gradient(180deg, rgba(4,6,12,0.97) 0%, rgba(4,6,12,0.9) 55%, rgba(4,6,12,0) 100%)" } as ViewStyle} />
        <View style={{ height: HEADER_H, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingTop: 8 }}>
          <View style={{ width: 73, height: 70, alignItems: "center", justifyContent: "center" }}>
            <Image source={pic(`${ART}/star-badge.webp`)!} style={{ position: "absolute", width: 73, height: 70 }} />
            <Text style={{ marginTop: 7, color: "#fff", fontFamily: FONT.serif, fontSize: digits >= 3 ? 17 : digits === 2 ? 22 : 26, lineHeight: digits >= 3 ? 22 : 30, textShadowColor: "#5b3a00", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 }}>{st.stars}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ color: "#fde047", fontFamily: FONT.serif, fontSize: 23, lineHeight: 28, letterSpacing: 2.6, textShadowColor: "rgba(146,64,14,0.9)", textShadowOffset: { width: 0, height: 1.5 }, textShadowRadius: 0 }}>STAR PASS</Text>
            <Text numberOfLines={1} style={{ marginTop: 3, color: "#fff", fontSize: 12, fontWeight: "900", letterSpacing: 1.9, textTransform: "uppercase" }}>{starTitle(st.stars)}</Text>
            {st.gate ? <Text numberOfLines={1} style={{ marginTop: 2, color: "#fff", fontSize: 11, fontWeight: "900" }}>🔒 {st.gate.need}</Text> : null}
          </View>
          <SquareBtn icon="🎒" label="Locker" onPress={() => nav.go("locker")} />
          <SquareBtn icon="★" label="Pts" on={points} onPress={() => setPoints((v) => !v)} />
        </View>
        <View style={{ height: 1, marginHorizontal: 0, backgroundImage: "linear-gradient(90deg, rgba(253,224,71,0), rgba(253,224,71,0.85), rgba(253,224,71,0))" } as ViewStyle} />
        {points && (
          <View style={{ marginTop: 8, marginHorizontal: 16, borderRadius: 3, overflow: "hidden", backgroundColor: "#0b0f1a", borderWidth: 1, borderColor: "rgba(253,224,71,0.35)" }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 8 }}>
              <Text style={{ color: "#fcd34d", fontSize: 12, fontWeight: "900", letterSpacing: 1.8 }}>STAR POINTS</Text>
              <Text style={{ color: "#fcd34d", fontSize: 12, fontWeight: "900" }}>{fmt(st.total)}</Text>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {rows.map(([k, v]) => (
                <View key={k} style={{ width: "50%", flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 6, borderTopWidth: 1, borderColor: "rgba(0,0,0,0.6)" }}>
                  <Text style={{ color: "#fff", fontSize: 12.5, fontWeight: "900", textTransform: "uppercase" }}>{k}</Text>
                  <Text style={{ color: "#fff", fontSize: 12.5, fontWeight: "900" }}>{fmt(v)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
        {note && (
          <View style={{ marginTop: 8, marginHorizontal: 16, padding: 10, borderRadius: 10, backgroundColor: "rgba(3,7,18,0.95)", borderWidth: 1, borderColor: "rgba(252,211,77,0.5)" }}>
            <Text style={{ color: "#fff", fontWeight: "800", textAlign: "center" }}>{note}</Text>
          </View>
        )}
      </View>

      <BottomBar active={null} plain />

      <Modal visible={preview !== null && !!shown} transparent animationType="fade" onRequestClose={() => setPreview(null)}>
        {shown && preview !== null && (
          <Preview card={shown} level={preview} claimable={claimable.has(preview)} claimed={isClaimed(career, preview)} reached={preview <= st.stars} onClose={() => setPreview(null)}
            onLater={() => { const c = getCareer(); if (c) setCareer(claimLevel(c, preview, shown, starStatus(c).stars)); setPreview(null); }}
            onUse={() => { const c = getCareer(); if (c) setCareer(equipCard(claimLevel(c, preview, shown, starStatus(c).stars), shown)); setPreview(null); }} />
        )}
      </Modal>
      {/* Claim: the full-screen reward reveal (LEVEL n REWARD, Later / Use now) */}
      {reveal !== null && cardAt(reveal) ? (
        <RewardReveal card={cardAt(reveal)!} level={reveal} career={career}
          onLater={() => { const c = getCareer(); const cd = cardAt(reveal); if (c && cd) setCareer(claimLevel(c, reveal, cd, starStatus(c).stars)); setReveal(null); }}
          onUse={() => { const c = getCareer(); const cd = cardAt(reveal); if (c && cd) setCareer(equipCard(claimLevel(c, reveal, cd, starStatus(c).stars), cd)); setReveal(null); }} />
      ) : null}
    </View>
  );
}

/** The glow under the next / claimable podium breathes, and its box bobs (StarRatingSheet's pulse and bounce). */
function usePulse(on: boolean) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!on) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(t, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(t, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [on, t]);
  return t;
}

function SquareBtn({ icon, label, on, onPress }: { icon: string; label: string; on?: boolean; onPress: () => void }) {
  return (
    <Press onPress={onPress} style={[{ width: 44, height: 44, borderRadius: 4, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(253,224,71,0.6)" },
      on ? ({ backgroundImage: "linear-gradient(180deg, #fde047, #f59e0b)" } as ViewStyle) : { backgroundColor: "rgba(255,255,255,0.08)" }]}>
      <Text style={{ fontSize: 15, color: on ? "#111827" : "#fde047" }}>{icon}</Text>
      <Text style={{ marginTop: 1, fontSize: 9, fontWeight: "900", letterSpacing: 1, color: on ? "#111827" : "#fde047" }}>{label.toUpperCase()}</Text>
    </Press>
  );
}

/** One reward: its podium (and the reward on it) beside its level, a faint line out from the rail. */
function RewardStop({ level, y, width, card, reached, next, claimable, claimed, onOpen }: {
  level: number; y: number; width: number; card: CatalogueItem | undefined; reached: boolean; next: boolean; claimable: boolean; claimed: boolean; onOpen: () => void;
}) {
  const tier = rewardTier(level);
  const great = tier === "great";
  const isTop = level === MAX_LEVEL;
  const theme = themeFor(level);
  const art = card?.art;
  const scene = pic(art?.scene);
  const plinth = pic(isTop ? `${ART}/crown-100.webp` : `${ART}/plinth-${theme.key}-${tier}.webp`);
  const box = pic(art?.image) ?? pic(`${ART}/box-${tier}.webp`);
  const plinthW = isTop ? 240 : great ? PLINTH_GREAT : PLINTH_MEDIUM;
  const slotH = stopHeight(level);
  const aspect = scene ? art?.sceneAspect ?? 0.7 : isTop ? 392 / 442 : great ? 322 / 556 : 217 / 468;
  const room = width - (RAIL_X + 22) - 8;
  let w = scene ? plinthW / (art?.sceneFit ?? 1) : plinthW;
  w *= Math.min(1, slotH / (w * aspect), Math.min(360, room) / w);
  const h = w * aspect;
  const lit = reached || next;
  const glow = claimable ? "#fde047" : theme.accent;
  const moving = claimable || next;
  const pulse = usePulse(moving);
  return (
    <>
      <View pointerEvents="none" style={{ position: "absolute", left: RAIL_X + 8, width: 150, top: y - 1, height: 2, opacity: lit ? 0.85 : 0.4, backgroundImage: `linear-gradient(90deg, ${reached ? "#fde047" : theme.accent}, rgba(0,0,0,0))` } as ViewStyle} />
      <View style={{ position: "absolute", left: RAIL_X + 22, right: 8, top: y - slotH / 2, height: slotH, alignItems: "center", justifyContent: "flex-end" }}>
        <Press onPress={onOpen} style={{ width: w, height: h, opacity: lit ? 1 : 0.85 }}>
          {lit && <Animated.View pointerEvents="none" style={{ position: "absolute", left: "5%", right: "5%", top: "30%", bottom: 0, opacity: moving ? pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }) : 1 }}><View style={{ flex: 1, backgroundImage: `radial-gradient(closest-side, ${glow}88, ${glow}00)` } as ViewStyle} /></Animated.View>}
          {(scene ?? plinth) ? <Image source={(scene ?? plinth)!} resizeMode="contain" fadeDuration={0} style={{ width: w, height: h }} /> : null}
          {!isTop && !scene && box ? <Animated.Image source={box} resizeMode="contain" fadeDuration={0} style={{ position: "absolute", left: (w - (great ? 92 : 70)) / 2, bottom: h * (great ? 0.52 : 0.46), width: great ? 92 : 70, height: great ? 92 : 70, transform: [{ translateY: moving ? pulse.interpolate({ inputRange: [0, 1], outputRange: [0, -7] }) : 0 }] }} /> : null}
          {claimed && !isTop && (
            <View style={{ position: "absolute", right: "6%", top: "8%", width: 24, height: 24, borderRadius: 4, alignItems: "center", justifyContent: "center", backgroundColor: "#4ade80" }}>
              <Text style={{ color: "#030712", fontWeight: "900", fontSize: 13 }}>✓</Text>
            </View>
          )}
          {card?.comingSoon && !claimed && !isTop && (
            <View style={{ position: "absolute", bottom: "2%", alignSelf: "center", paddingHorizontal: 12, paddingVertical: 4, borderRadius: 3, backgroundColor: "rgba(15,23,42,0.85)", borderWidth: 1, borderColor: "rgba(255,255,255,0.35)" }}>
              <Text style={{ color: "#fff", fontSize: 11, fontWeight: "900", letterSpacing: 2 }}>SOON</Text>
            </View>
          )}
          {claimable && (
            <View pointerEvents="none" style={{ position: "absolute", bottom: "2%", alignSelf: "center", height: 38, paddingHorizontal: 20, justifyContent: "center", borderRadius: 3, backgroundImage: "linear-gradient(180deg, #fde047, #f59e0b)", boxShadow: "0px 0px 18px rgba(251,191,36,0.75)" } as ViewStyle}>
              <Text style={{ color: "#030712", fontSize: 14, fontWeight: "900", letterSpacing: 2.5 }}>CLAIM</Text>
            </View>
          )}
        </Press>
      </View>
    </>
  );
}

/** A reward, big: what it is; claim it ("Use it" / "Later") once you reach it. */
function Preview({ card, level, claimable, claimed, reached, onClose, onLater, onUse }: {
  card: CatalogueItem; level: number; claimable: boolean; claimed: boolean; reached: boolean; onClose: () => void; onLater: () => void; onUse: () => void;
}) {
  const theme = themeFor(level);
  const big = pic(card.art?.scene) ?? pic(card.art?.image) ?? pic(`${ART}/plinth-${theme.key}-${rewardTier(level)}.webp`);
  // The reward as live 3D you drag round (the website's RewardPreview: `art.live ?? art.spin`), the still picture under it
  // until it is up and for good if the 3D cannot start (crash guard off, no GL, over 20 s).
  const vp = useWindowDimensions();
  const prefs = usePrefs();
  const [up3d, setUp3d] = useState(false);
  const [fail3d, setFail3d] = useState(false);
  const boxW = Math.min(340, vp.width - 72), boxH = 260;
  const live = card.art?.live ?? card.art?.spin;
  const cfg = useMemo(() => {
    if (!live) return null;
    if (card.art?.live) { const k = Math.min(boxW / live.w, boxH / live.h); return { ...live, w: Math.round(live.w * k), h: Math.round(live.h * k) }; }
    return { ...live, w: boxW, h: boxH };
  }, [card.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // Settings → Live 3D scenes is OFF by default: then the still stays and no 3D view is made
  const show3d = !!cfg && !fail3d && prefs.live3dScenes;
  return (
    <View style={{ flex: 1, backgroundColor: "rgba(3,5,10,0.92)", justifyContent: "center", padding: 20 }}>
      <View style={{ borderRadius: 4, padding: 16, gap: 10, backgroundColor: "#0b0f1a", borderWidth: 1, borderColor: "rgba(253,224,71,0.45)" }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text style={{ flex: 1, color: "#fde047", fontFamily: FONT.serif, fontSize: 15, letterSpacing: 1.6 }}>LEVEL {level}</Text>
          <Press onPress={onClose} style={{ width: 40, height: 40, borderRadius: 4, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.1)" }}><Text style={{ color: "#fff", fontSize: 18, fontWeight: "900" }}>✕</Text></Press>
        </View>
        <View style={{ height: show3d ? boxH : 240, alignItems: "center", justifyContent: "center" }}>
          <View pointerEvents="none" style={{ position: "absolute", left: "8%", right: "8%", top: "30%", bottom: "6%", backgroundImage: `radial-gradient(closest-side, ${theme.accent}55, ${theme.accent}00)` } as ViewStyle} />
          {big && !(show3d && up3d) ? <Image source={big} resizeMode="contain" style={{ width: "100%", height: "100%" }} /> : null}
          {show3d && <View style={{ position: "absolute" }}><Podium3D cfg={cfg!} showSpeed={prefs.show3dSpeed} onReady={() => setUp3d(true)} onFail={() => setFail3d(true)} /></View>}
        </View>
        {show3d && up3d ? <Text style={{ textAlign: "center", color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: "900", letterSpacing: 2.2, textTransform: "uppercase" }}>Drag to spin it</Text> : null}
        <Text style={{ color: "#fff", fontWeight: "900", fontSize: 22, textAlign: "center" }}>{card.name}</Text>
        {card.note ? <Text style={{ color: "rgba(255,255,255,0.75)", fontWeight: "700", textAlign: "center" }}>{card.note}</Text> : null}
        {claimable ? (
          <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
            <LookButton kind="glass" label="Later" onPress={onLater} style={{ flex: 1 }} />
            <LookButton kind="gold" label="Use it" onPress={onUse} style={{ flex: 1 }} />
          </View>
        ) : (
          <Text style={{ color: claimed ? "#4ade80" : "rgba(255,255,255,0.6)", fontWeight: "900", textAlign: "center", letterSpacing: 1.4 }}>
            {claimed ? "✓ YOURS" : card.comingSoon ? "COMING SOON" : reached ? "" : `REACH LEVEL ${level}`}
          </Text>
        )}
      </View>
    </View>
  );
}
