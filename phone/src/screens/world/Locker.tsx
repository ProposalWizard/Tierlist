/**
 * THE LOCKER (the website's components/star/LockerSheet.tsx): everything you
 * own, however you got it (Star Pass, Store), by the catalogue's twelve
 * categories. Tap a thing to use it; tap again to stop. Things you don't own
 * yet are blacked out ("???"), so you can see what is left to collect.
 * Opened from the Star Pass's LOCKER button. 2D, as on the website.
 *
 * Also here: RewardArt (a catalogue card's picture at any size) and the
 * full-screen RewardReveal the Star Pass shows when you tap Claim.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Image, Modal, ScrollView, Text, View, useWindowDimensions, type ImageSourcePropType, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { CareerState } from "@/lib/star/types";
import { CATEGORIES, fullCatalogue, type CatalogueItem, type RewardCategory } from "@/lib/star/rewardCatalogue";
import { ownsCard, isUsing, equipCard, stopUsing, showsInGame } from "@/lib/star/starPassClaim";
import { DEFAULT_PENALTY_RUNUP, DEFAULT_FREE_KICK_RUNUP } from "@/lib/star/runupStyles";
import { ACCESSORIES } from "@/lib/star/store/catalogue";
import { signatureOf } from "@/lib/star/signatureBoots";
import { useCareer, setCareer } from "../../game/store";
import { useNav } from "../../nav";
import { Press } from "../../ui/Press";
import { FONT } from "../../ui/look";
import { STAR_PASS_PIC } from "../../ui/look/worldPics";
import { StoreFigure } from "./StoreFigure";
import { Podium3D } from "../../podium/Podium3D";

const pic = (url?: string): ImageSourcePropType | undefined => (url ? STAR_PASS_PIC[url] : undefined);

/** The two free Standard run-ups: always owned, so you can switch back. */
const STANDARDS: CatalogueItem[] = [
  { id: "runup-standard", name: "Standard", category: "penalty-runup", status: "in-game", grant: { kind: "penaltyRunup", id: DEFAULT_PENALTY_RUNUP }, art: { icon: "🏃" } },
  { id: "runup-fk_standard", name: "Standard", category: "freekick-runup", status: "in-game", grant: { kind: "freeKickRunup", id: DEFAULT_FREE_KICK_RUNUP }, art: { icon: "🏃" } },
];

/** A catalogue card's picture (RewardArt.tsx): its scene or image, a run-up's man at the ball, the player wearing an accessory, else its icon tile. */
export function RewardArt({ card, w, h, career, live = false }: { card: CatalogueItem; w: number; h: number; career?: CareerState | null; live?: boolean }) {
  const a = card.art;
  const src = pic(a.scene) ?? pic(a.image);
  const [fail3d, setFail3d] = useState(false);
  const [up3d, setUp3d] = useState(false);
  // `live` (the claim reveal, one at a time): the website's live 3D podium you spin (RewardArt.tsx `a.live && live`); the still is under it until it is up, and stays if the 3D cannot start.
  const cfg = useMemo(() => {
    if (!live || !a.live) return null;
    const k = Math.min(w / a.live.w, h / a.live.h);
    return { ...a.live, w: Math.round(a.live.w * k), h: Math.round(a.live.h * k) };
  }, [live, card.id, w, h]); // eslint-disable-line react-hooks/exhaustive-deps
  if (cfg && !fail3d) {
    return (
      <View style={{ width: w, height: h, alignItems: "center", justifyContent: "center" }}>
        {src && !up3d ? <Image source={src} resizeMode="contain" fadeDuration={0} style={{ width: w, height: h }} /> : null}
        <View style={{ position: "absolute" }}><Podium3D cfg={cfg} onReady={() => setUp3d(true)} onFail={() => setFail3d(true)} /></View>
      </View>
    );
  }
  if (src) return <Image source={src} resizeMode="contain" fadeDuration={0} style={{ width: w, height: h }} />;
  const g = card.grant;
  if (g.kind === "penaltyRunup" || g.kind === "freeKickRunup") return <StoreFigure wear={[]} width={w} height={h} runup />;
  if (g.kind === "accessory") {
    const item = ACCESSORIES.find((x) => x.id === g.id);
    if (item) return <StoreFigure wear={[item]} width={w} height={h} signature={career ? signatureOf(career) : null} />;
  }
  return (
    <View style={{ width: w, height: h, alignItems: "center", justifyContent: "center", backgroundImage: `radial-gradient(closest-side, ${(a.color ?? "#64748b")}55, rgba(0,0,0,0))` } as ViewStyle}>
      <Text style={{ fontSize: Math.min(w, h) * 0.42 }}>{a.icon ?? "🎁"}</Text>
    </View>
  );
}

export function LockerScreen() {
  const career = useCareer();
  const nav = useNav();
  const inset = useSafeAreaInsets();
  const vp = useWindowDimensions();
  const catalogue = useMemo(() => fullCatalogue(), []);
  const [cat, setCat] = useState<RewardCategory | null>(null);
  if (!career) return null;
  const owns = (c: CatalogueItem) => STANDARDS.includes(c) || ownsCard(career, c);
  // Open on the first category you own something in (past the Standards).
  const shownCat: RewardCategory = cat ?? CATEGORIES.find((k) => catalogue.some((c) => c.category === k.id && ownsCard(career, c)))?.id ?? "penalty-runup";
  const all = [...STANDARDS, ...catalogue].filter((c) => c.category === shownCat && (c.status !== "idea" || ownsCard(career, c)));
  const cards = [...all.filter(owns), ...all.filter((c) => !owns(c))];
  const ownedCount = (k: RewardCategory) => catalogue.filter((c) => c.category === k && ownsCard(career, c)).length;
  const tap = (c: CatalogueItem) => {
    if (!owns(c)) return;
    if (isUsing(career, c)) { if (!STANDARDS.includes(c)) setCareer(stopUsing(career, c)); }
    else if (STANDARDS.includes(c)) setCareer(stopUsing(career, c)); // Standard = stop using the other one
    else setCareer(equipCard(career, c));
  };
  const colW = Math.floor((vp.width - 32 - 8) / 2);
  return (
    <View style={{ flex: 1, backgroundColor: "#05080f", paddingTop: inset.top }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
        <Text style={{ color: "#fde047", fontFamily: FONT.serif, fontSize: 23, lineHeight: 28, letterSpacing: 2.8, textShadowColor: "rgba(245,158,11,0.9)", textShadowOffset: { width: 0, height: 1.5 }, textShadowRadius: 0 }}>LOCKER</Text>
      </View>
      {/* one row of categories */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0, marginTop: 12 }} contentContainerStyle={{ flexDirection: "row", gap: 6, paddingHorizontal: 16, paddingBottom: 8 }}>
        {CATEGORIES.map((k) => {
          const on = k.id === shownCat;
          const n = ownedCount(k.id);
          return (
            <Press key={k.id} onPress={() => setCat(k.id)} style={[{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 3 }, on ? ({ backgroundImage: "linear-gradient(180deg, #fde047, #f59e0b)" } as ViewStyle) : { backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)" }]}>
              <Text numberOfLines={1} style={{ color: on ? "#111827" : "#fff", fontSize: 12, lineHeight: 16, fontWeight: "900", letterSpacing: 0.3, textTransform: "uppercase" }}>{k.label}{n > 0 ? `  ${n}` : ""}</Text>
            </Press>
          );
        })}
      </ScrollView>
      <ScrollView contentContainerStyle={{ flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 20 }}>
        {cards.map((c) => {
          const have = owns(c);
          const using = have && isUsing(career, c);
          return (
            <Press key={c.id} disabled={!have} onPress={() => tap(c)} style={[{ width: colW, borderRadius: 3, overflow: "hidden", alignItems: "center", backgroundImage: "linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.02))", borderWidth: using ? 2 : 1, borderColor: using ? "#fde047" : "rgba(255,255,255,0.12)", opacity: 1 } as ViewStyle]}>
              <View style={{ height: 150, width: "100%", alignItems: "center", justifyContent: "center" }}>
                <RewardArt card={c} w={Math.min(160, colW - 8)} h={145} career={career} />
                {!have ? <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "rgba(3,5,10,0.86)" }} /> : null}
              </View>
              <View style={{ width: "100%", flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 8, paddingBottom: 8, paddingTop: 4 }}>
                <Text numberOfLines={1} style={{ flex: 1, minWidth: 0, color: "#fff", fontSize: 13, lineHeight: 17, fontWeight: "900", letterSpacing: 0.3, textTransform: "uppercase" }}>{have ? c.name : "???"}</Text>
                {have && !showsInGame(c) ? <Text style={{ backgroundColor: "rgba(255,255,255,0.15)", color: "#fff", fontSize: 9, lineHeight: 12, fontWeight: "900", letterSpacing: 0.6, paddingHorizontal: 4, paddingVertical: 2, borderRadius: 2, overflow: "hidden" }}>SOON</Text> : null}
              </View>
              {using ? <Text style={{ position: "absolute", left: 6, top: 6, backgroundColor: "#fcd34d", color: "#030712", fontSize: 10, lineHeight: 13, fontWeight: "900", letterSpacing: 0.6, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 2, overflow: "hidden" }}>IN USE</Text> : null}
            </Press>
          );
        })}
      </ScrollView>
      {/* the bottom bar: Back */}
      <View style={{ paddingHorizontal: 8, paddingTop: 6, paddingBottom: Math.max(8, inset.bottom), backgroundColor: "#0b0f1a", borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.15)" }}>
        <Press onPress={() => nav.back()} style={{ height: 52, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)" }}>
          <Text style={{ color: "#fcd34d", fontSize: 16, fontWeight: "900" }}>‹</Text>
          <Text style={{ color: "#fff", fontSize: 14, fontWeight: "900", letterSpacing: 1, textTransform: "uppercase" }}>Back</Text>
        </Press>
      </View>
    </View>
  );
}

/**
 * THE REWARD REVEAL (RewardReveal.tsx): what you see when you tap Claim on a
 * Star Pass level. The screen goes dark, light rays turn behind it, the reward
 * rises in big, its name, then USE NOW or LATER. Either way it is yours and in
 * the Locker; USE NOW also puts it on.
 */
export function RewardReveal({ card, level, career, onUse, onLater }: { card: CatalogueItem; level: number; career: CareerState; onUse: () => void; onLater: () => void }) {
  const vp = useWindowDimensions();
  const spin = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(0)).current;
  const name = useRef(new Animated.Value(0)).current;
  const flash = useRef(new Animated.Value(0.9)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 18000, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    Animated.timing(flash, { toValue: 0, duration: 600, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    Animated.sequence([Animated.delay(350), Animated.timing(rise, { toValue: 1, duration: 700, easing: Easing.out(Easing.back(1.6)), useNativeDriver: true })]).start();
    Animated.sequence([Animated.delay(1300), Animated.timing(name, { toValue: 1, duration: 450, easing: Easing.out(Easing.quad), useNativeDriver: true })]).start();
    return () => loop.stop();
  }, [spin, rise, name, flash]);
  const cat = CATEGORIES.find((c) => c.id === card.category)?.label ?? "";
  const artW = Math.min(340, vp.width - 32);
  const artH = Math.round(artW * 1.05);
  const R = Math.max(vp.width, vp.height) * 0.8;
  const rays = Array.from({ length: 16 }, (_, i) => i);
  return (
    <Modal visible animationType="fade" onRequestClose={onLater}>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", overflow: "hidden", backgroundImage: "radial-gradient(circle at 50% 45%, #2a1d05 0%, #05060c 70%)", backgroundColor: "#05060c" } as ViewStyle}>
        {/* light rays turning behind it */}
        <Animated.View pointerEvents="none" style={{ position: "absolute", left: vp.width / 2 - R, top: vp.height * 0.44 - R, width: R * 2, height: R * 2, opacity: 0.9, transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) }] }}>
          {rays.map((i) => (
            <View key={i} style={{ position: "absolute", left: R - R * 0.07, top: 0, width: R * 0.14, height: R, transform: [{ translateY: R / 2 }, { rotate: `${i * 22.5}deg` }, { translateY: -R / 2 }] }}>
              <View style={{ flex: 1, backgroundImage: "linear-gradient(180deg, rgba(253,224,71,0), rgba(253,224,71,0.05) 45%, rgba(253,224,71,0.16))" } as ViewStyle} />
            </View>
          ))}
        </Animated.View>
        <Animated.View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "#fff", opacity: flash }} />
        <Text style={{ color: "#fcd34d", fontSize: 12, fontWeight: "900", letterSpacing: 3.6, textTransform: "uppercase" }}>Level {level} reward</Text>
        <Animated.View style={{ width: artW, height: artH, marginVertical: 12, alignItems: "center", justifyContent: "center", opacity: rise.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 1] }), transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }, { scale: rise.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] }}>
          <View pointerEvents="none" style={{ position: "absolute", left: "12%", right: "12%", top: "12%", bottom: "12%", backgroundImage: "radial-gradient(closest-side, rgba(253,224,71,0.35), rgba(253,224,71,0))" } as ViewStyle} />
          <RewardArt card={card} w={artW} h={artH} career={career} live />
        </Animated.View>
        <Animated.View style={{ paddingHorizontal: 24, alignItems: "center", opacity: name, transform: [{ translateY: name.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }}>
          <Text style={{ color: "#fff", fontSize: 11, fontWeight: "900", letterSpacing: 2.8, textTransform: "uppercase" }}>{cat}</Text>
          <Text numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.6} style={{ marginTop: 4, color: "#fde047", fontFamily: FONT.serif, fontSize: 30, lineHeight: 34, letterSpacing: 1.8, textAlign: "center", textTransform: "uppercase", textShadowColor: "rgba(245,158,11,0.9)", textShadowOffset: { width: 0, height: 1.5 }, textShadowRadius: 0 }}>{card.name}</Text>
          <View style={{ marginTop: 24, flexDirection: "row", justifyContent: "center", gap: 12 }}>
            <Press onPress={onLater} style={{ height: 48, width: 132, borderRadius: 3, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.1)", borderWidth: 1, borderColor: "rgba(255,255,255,0.35)" }}>
              <Text style={{ color: "#fff", fontSize: 15, fontWeight: "900", letterSpacing: 0.8, textTransform: "uppercase" }}>Later</Text>
            </Press>
            <Press onPress={onUse} style={{ height: 48, width: 160, borderRadius: 3, alignItems: "center", justifyContent: "center", backgroundImage: "linear-gradient(180deg, #fde047, #f59e0b)", boxShadow: "0px 0px 22px rgba(251,191,36,0.55)" } as ViewStyle}>
              <Text style={{ color: "#030712", fontSize: 15, fontWeight: "900", letterSpacing: 0.8, textTransform: "uppercase" }}>Use now</Text>
            </Press>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
