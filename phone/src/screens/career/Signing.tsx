/**
 * THE SIGNING, DRAWN (the website's components/star/SigningScene.tsx, its
 * "Drawn" signing; the packed app plays the 3D office, which Mikey left off
 * the phone, so this is the phone's signing moment in the same look):
 *   1. The office: you and the manager in two leather chairs (the game's own
 *      figure code, your kit; his drawn head and a suit), the club's crest on
 *      the wall, his name plate, the contract on the desk with the whole deal.
 *   2. TAP TO SIGN: the camera drops onto the contract and the pen writes
 *      your name.
 *   3. Back out: the handshake, "WELCOME TO <CLUB>", Continue.
 * Skip is always there.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, Text, View, useWindowDimensions, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { useAnimatedStyle, useSharedValue, withTiming, Easing } from "react-native-reanimated";
import { Canvas, Group, Path, Skia } from "@shopify/react-native-skia";
import type { CareerState } from "@/lib/star/types";
import { kitsOf } from "@/lib/star/kits";
import { skinToneHex } from "@/lib/star/playerIdentity";
import { DEFAULT_FACE_STYLE } from "@/lib/star/faceStyle";
import { DEFAULT_FAKE_FACE_STYLE } from "@/lib/star/fakeFaceStyle";
import { managerLook, drawManagerHead } from "@/lib/star/managerFace";
import { paintHeroFigure, tint, rgba, luminance, HERO_CHIN_Y, HERO_FACE_H, type HeroLook, type P } from "@/lib/star/heroFigure";
import { Drawn } from "../../draw/useDrawing";
import { fittedHead } from "../../draw/PlayerFigure";
import { DEFAULT_FAKE_FACE } from "@/lib/star/fakeFaces";
import type { FittedHead } from "@/lib/star/faceFit";
import { ClubBadge } from "../../draw/ClubBadge";
import { useRiskyPart } from "../../safety";

const SW = 360, SH = 430;
const FIG_S = 0.9;
const YOU_AT: P = [92, 172];
const BOSS_AT: P = [268, 172];
const DESK_Y = 240;
const PAPER = { x: 54, y: 250, w: 242, h: 176 };
const SIG = { x: 132, y: 134, w: 80, h: 22 };
const REACH = { elbow: [171, 140] as P, hand: [196, 150] as P };
const ZOOM_MS = 450, SIGN_MS = 1200, OUT_MS = 450, CHEER_MS = 500;
/** TrialReward.tsx SIGNATURE_D: the hand-written name. */
const SIGNATURE_D = "M12 44 C 26 12, 38 12, 44 30 C 50 48, 58 48, 66 26 C 72 10, 84 14, 86 34 C 88 50, 100 48, 108 32 C 116 16, 130 18, 132 36 C 134 52, 148 50, 158 30 C 168 10, 184 14, 190 32 C 196 50, 212 48, 224 30 C 234 16, 250 16, 262 34 C 268 43, 278 46, 288 40";
const CLUB_SIG_D = "M10 40 C 30 10, 50 50, 70 26 S 110 18, 130 36 S 170 44, 200 22 S 250 30, 290 26";

type Beat = "idle" | "zoom" | "sign" | "shake" | "done";
const money = (n: number) => `★${Math.round(n).toLocaleString("en-GB")}`;

/** SigningScene.tsx paintOffice, line for line. */
function paintOffice(ctx: CanvasRenderingContext2D, o: { you: HeroLook; boss: HeroLook; club: { shirt: string; trim: string }; shake: boolean }) {
  const { shirt } = o.club;
  const wall = ctx.createLinearGradient(0, 0, 0, DESK_Y);
  wall.addColorStop(0, tint(shirt, -0.72)); wall.addColorStop(1, tint(shirt, -0.86));
  ctx.fillStyle = wall; ctx.fillRect(0, 0, SW, DESK_Y + 2);
  const lamp = ctx.createRadialGradient(SW / 2, 66, 6, SW / 2, 66, 170);
  lamp.addColorStop(0, "rgba(255,226,170,0.32)"); lamp.addColorStop(1, "rgba(255,226,170,0)");
  ctx.fillStyle = lamp; ctx.fillRect(0, 0, SW, DESK_Y);
  const panel = ctx.createLinearGradient(0, 132, 0, DESK_Y);
  panel.addColorStop(0, "#2a1a10"); panel.addColorStop(1, "#160d07");
  ctx.fillStyle = panel; ctx.fillRect(0, 132, SW, DESK_Y - 132);
  ctx.fillStyle = "rgba(255,210,150,0.10)"; ctx.fillRect(0, 132, SW, 2);
  ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 1;
  for (let x = 30; x < SW; x += 60) { ctx.beginPath(); ctx.moveTo(x, 136); ctx.lineTo(x, DESK_Y); ctx.stroke(); }
  ctx.fillStyle = rgba(shirt, 0.55); ctx.fillRect(0, 128, SW, 4);
  for (const [cx] of [YOU_AT, BOSS_AT]) {
    const g = ctx.createLinearGradient(cx - 62, 0, cx + 62, 0);
    g.addColorStop(0, "#3b2418"); g.addColorStop(0.5, "#24150d"); g.addColorStop(1, "#120a06");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(cx - 58, DESK_Y); ctx.lineTo(cx - 60, 140);
    ctx.quadraticCurveTo(cx - 58, 108, cx, 104); ctx.quadraticCurveTo(cx + 58, 108, cx + 60, 140);
    ctx.lineTo(cx + 58, DESK_Y); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "rgba(255,220,180,0.18)";
    for (const [dx, dy] of [[-34, 128], [0, 120], [34, 128], [-34, 158], [34, 158]]) { ctx.beginPath(); ctx.arc(cx + dx, dy, 1.6, 0, Math.PI * 2); ctx.fill(); }
  }
  const reach = o.shake ? REACH : undefined;
  ctx.save();
  ctx.translate(YOU_AT[0] - 101 * FIG_S, YOU_AT[1] - 96 * FIG_S); ctx.scale(FIG_S, FIG_S);
  paintHeroFigure(ctx, o.you, DEFAULT_FACE_STYLE, DEFAULT_FAKE_FACE_STYLE, { shadow: false, reach });
  ctx.restore();
  ctx.save();
  ctx.translate(BOSS_AT[0] + 101 * FIG_S, BOSS_AT[1] - 96 * FIG_S); ctx.scale(-FIG_S, FIG_S);
  paintHeroFigure(ctx, o.boss, DEFAULT_FACE_STYLE, DEFAULT_FAKE_FACE_STYLE, { shadow: false, reach });
  ctx.fillStyle = "#eef1f5";
  ctx.beginPath(); ctx.moveTo(90, 83); ctx.lineTo(112, 83); ctx.lineTo(101, 112); ctx.closePath(); ctx.fill();
  ctx.fillStyle = tint(shirt, luminance(shirt) > 0.7 ? -0.35 : 0);
  ctx.beginPath(); ctx.moveTo(98, 87); ctx.lineTo(104, 87); ctx.lineTo(105.5, 96); ctx.lineTo(103, 126); ctx.lineTo(101, 129); ctx.lineTo(99, 126); ctx.lineTo(96.5, 96); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.45)"; ctx.lineWidth = 2.2; ctx.lineJoin = "round";
  ctx.beginPath(); ctx.moveTo(86, 84); ctx.lineTo(95, 104); ctx.lineTo(101, 132); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(116, 84); ctx.lineTo(107, 104); ctx.lineTo(101, 132); ctx.stroke();
  ctx.restore();
  const top = ctx.createLinearGradient(0, DESK_Y, 0, SH);
  top.addColorStop(0, "#4a2e1b"); top.addColorStop(0.35, "#5c3a22"); top.addColorStop(1, "#6e4528");
  ctx.fillStyle = top; ctx.fillRect(0, DESK_Y, SW, SH - DESK_Y);
  ctx.fillStyle = "rgba(255,214,160,0.28)"; ctx.fillRect(0, DESK_Y, SW, 2);
  for (const [cx] of [YOU_AT, BOSS_AT]) {
    const sh = ctx.createRadialGradient(cx, DESK_Y + 4, 2, cx, DESK_Y + 4, 70);
    sh.addColorStop(0, "rgba(0,0,0,0.38)"); sh.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = sh; ctx.fillRect(cx - 80, DESK_Y, 160, 40);
  }
  ctx.strokeStyle = "rgba(0,0,0,0.16)"; ctx.lineWidth = 1;
  for (let i = 0; i < 9; i++) { const y = DESK_Y + 14 + i * 19; ctx.beginPath(); ctx.moveTo(0, y); ctx.bezierCurveTo(SW * 0.3, y - 4, SW * 0.6, y + 5, SW, y - 1); ctx.stroke(); }
}

function plateName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 && !/^the$/i.test(parts[0]) ? `${parts[0][0]}. ${parts.slice(1).join(" ")}` : name;
}

/** A signature written along its path; `progress` 0..1. */
function Signature({ d, width, height, progress, color }: { d: string; width: number; height: number; progress: number; color: string }) {
  const path = useRef(Skia.Path.MakeFromSVGString(d)!).current;
  const s = Math.min(width / 300, height / 60);
  return (
    <Canvas style={{ width, height }}>
      <Group transform={[{ scale: s }]}>
        <Path path={path} style="stroke" strokeWidth={5} strokeCap="round" strokeJoin="round" color={color} start={0} end={progress} />
      </Group>
    </Canvas>
  );
}

export interface SigningTerms { wage?: number; seasonsRemaining?: number; goalBonus?: number; assistBonus?: number; appearanceFee?: number; loyaltyBonus?: number }
export function SigningMoment({ career, club, managerName, onDone, terms, number: shirt }: { career: CareerState; club: string; managerName: string; onDone: () => void;
  /** A move: the new contract (else your contract). */ terms?: SigningTerms; /** The shirt number on it (null: none yet). */ number?: number | null }) {
  const ok = useRiskyPart("player-drawing", { settleMs: 3000 });
  const vp = useWindowDimensions();
  const k = Math.min(1.25, (Math.min(vp.width, 448) - 32) / SW);
  const [beat, setBeat] = useState<Beat>("idle");
  const [ink, setInk] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const kit = kitsOf(club, career.clubKits?.[club]).home;
  const bossLook = managerLook(managerName);
  const c: SigningTerms | undefined = terms ?? career.contract;
  const number = shirt !== undefined ? shirt : career.squadNumber ?? null;
  const rows: [string, string][] = ([
    ["Length", c?.seasonsRemaining ? `${c.seasonsRemaining} season${c.seasonsRemaining === 1 ? "" : "s"}` : ""],
    ["Wage", c?.wage ? `${money(c.wage)} / wk` : ""],
    ["Shirt", number != null ? `#${number}` : ""],
    ["Position", career.player.position ?? ""],
    ["Goal bonus", c?.goalBonus ? money(c.goalBonus) : ""],
    ["Assist bonus", c?.assistBonus ? money(c.assistBonus) : ""],
    ["Appearance", c?.appearanceFee ? money(c.appearanceFee) : ""],
    ["Loyalty", c?.loyaltyBonus ? money(c.loyaltyBonus) : ""],
  ] as [string, string][]).filter(([, v]) => v).slice(0, 8);
  const shake = beat === "shake" || beat === "done";
  // Your face, fitted to the body as the website does (your photo, else your default face).
  const [fitted, setFitted] = useState<FittedHead | null>(null);
  const faceUrl = career.player.portrait ?? DEFAULT_FAKE_FACE;
  useEffect(() => { let alive = true; fittedHead(faceUrl).then((f) => { if (alive) setFitted(f); }); return () => { alive = false; }; }, [faceUrl]);
  const skin = fitted?.skin ?? skinToneHex(career.player.skinTone);
  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    paintOffice(ctx, {
      club: kit, shake,
      you: { shirt: kit.shirt, shorts: kit.trim, trim: kit.trim, skin, number, fitted },
      boss: { shirt: "#1d2430", shorts: "#141922", trim: "#e9edf2", skin: bossLook.skin, number: null, fitted: null,
        drawHead: (g) => drawManagerHead(g, 101, HERO_CHIN_Y, HERO_FACE_H, bossLook) },
    });
  }, [kit.shirt, kit.trim, shake, skin, number, managerName, fitted]); // eslint-disable-line react-hooks/exhaustive-deps

  // The camera: onto the contract, then back out.
  const zoomK = 1.42;
  const focusX = PAPER.x + PAPER.w / 2, focusY = PAPER.y + PAPER.h / 2;
  const tx = Math.min(0, Math.max(SW - SW * zoomK, SW / 2 - focusX * zoomK));
  const ty = Math.min(0, Math.max(SH - SH * zoomK, SH / 2 - focusY * zoomK));
  const z = useSharedValue(0);
  // The website scales about the top-left corner (translate(tx,ty) scale(zoomK));
  // React Native scales about the middle, so the move makes up the difference.
  const camera = useAnimatedStyle(() => {
    const s = 1 + (zoomK - 1) * z.value;
    return { transform: [{ translateX: tx * z.value + (s - 1) * SW / 2 }, { translateY: ty * z.value + (s - 1) * SH / 2 }, { scale: s }] };
  });

  const start = () => {
    if (beat !== "idle") return;
    setBeat("zoom");
    z.value = withTiming(1, { duration: ZOOM_MS, easing: Easing.bezier(0.4, 0.1, 0.25, 1) });
    const at = (ms: number, f: () => void) => { timers.current.push(setTimeout(f, ms)); };
    at(ZOOM_MS, () => setBeat("sign"));
    // the pen writes: the ink runs along the line
    const STEPS = 20;
    for (let i = 1; i <= STEPS; i++) at(ZOOM_MS + ((SIGN_MS - 100) * i) / STEPS, () => setInk(i / STEPS));
    at(ZOOM_MS + SIGN_MS, () => { setBeat("shake"); z.value = withTiming(0, { duration: OUT_MS, easing: Easing.bezier(0.4, 0.1, 0.25, 1) }); });
    at(ZOOM_MS + SIGN_MS + OUT_MS + CHEER_MS, () => setBeat("done"));
  };
  const onStage = () => { if (beat === "idle") start(); else if (beat === "done") onDone(); };
  const outline = { textShadowColor: "#000", textShadowRadius: 3, textShadowOffset: { width: 2, height: 2 } };

  return (
    <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, backgroundColor: "#030712" }}>
      <View style={{ flex: 1, paddingHorizontal: 16, paddingVertical: 16, alignItems: "center", justifyContent: "center" }}>
        <View style={{ width: SW * k, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ flex: 1, color: "#fcd34d", fontSize: 13, fontWeight: "900", letterSpacing: 1.8 }}>{`Signing for ${club}`.toUpperCase()}</Text>
          <Pressable onPress={onDone} disabled={beat === "done"} style={{ minHeight: 36, borderRadius: 999, paddingHorizontal: 12, justifyContent: "center", backgroundColor: "rgba(255,255,255,0.1)", opacity: beat === "done" ? 0 : 1 }}>
            <Text style={{ color: "#fff", fontSize: 12, fontWeight: "900", letterSpacing: 0.6 }}>SKIP</Text>
          </Pressable>
        </View>
        <Pressable onPress={onStage} style={{ width: SW * k, height: SH * k, borderRadius: 16, overflow: "hidden", boxShadow: "0px 18px 40px -16px rgba(0,0,0,0.9), inset 0px 0px 0px 1px rgba(255,255,255,0.08)" } as ViewStyle}>
          <View style={{ width: SW, height: SH, transform: [{ translateX: -(SW - SW * k) / 2 }, { translateY: -(SH - SH * k) / 2 }, { scale: k }] }}>
            <Animated.View style={[{ position: "absolute", left: 0, top: 0, width: SW, height: SH }, camera]}>
              {ok ? <Drawn width={SW} height={SH} draw={draw} /> : <View style={{ width: SW, height: SH, backgroundColor: "#2a1a10" }} />}
              {/* the crest on the wall */}
              <View style={{ position: "absolute", left: SW / 2 - 30, top: 34, opacity: shake ? 0 : 1 }}>
                <ClubBadge club={club} kit={kit} size={60} />
              </View>
              {/* the manager's name plate */}
              <View style={{ position: "absolute", left: 300, top: DESK_Y + 6, width: 58, borderRadius: 3, paddingHorizontal: 4, paddingVertical: 2, backgroundImage: "linear-gradient(180deg,#e7c86f,#b8913d)", boxShadow: "0px 2px 3px rgba(0,0,0,0.5)" } as ViewStyle}>
                <Text numberOfLines={1} style={{ color: "#2a1c08", fontSize: 8.5, fontWeight: "700", fontFamily: "serif", textAlign: "center" }}>{plateName(managerName)}</Text>
                <Text style={{ color: "#2a1c08", fontSize: 6.5, fontWeight: "700", letterSpacing: 0.8, textAlign: "center", opacity: 0.8 }}>MANAGER</Text>
              </View>
              {/* the contract on the desk */}
              <View style={{ position: "absolute", left: PAPER.x, top: PAPER.y, width: PAPER.w, height: PAPER.h, borderRadius: 3, paddingHorizontal: 12, paddingTop: 8, backgroundImage: "linear-gradient(180deg,#fbf8f0,#efe9da)", boxShadow: "0px 10px 18px -6px rgba(0,0,0,0.75), inset 0px 0px 0px 1px rgba(160,120,40,0.35)" } as ViewStyle}>
                <Text style={{ color: "#8a6a23", fontSize: 7, fontWeight: "700", letterSpacing: 2.1, textAlign: "center", fontFamily: "serif" }}>PROFESSIONAL CONTRACT</Text>
                <View style={{ marginTop: 4, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  <ClubBadge club={club} kit={kit} size={20} />
                  <Text numberOfLines={1} style={{ color: "#1b140a", fontSize: 17, fontWeight: "900", fontFamily: "serif" }}>{club}</Text>
                </View>
                <View style={{ marginTop: 8, flexDirection: "row", flexWrap: "wrap", columnGap: 12, rowGap: 4 }}>
                  {rows.map(([label, value]) => (
                    <View key={label} style={{ width: (PAPER.w - 24 - 12) / 2, flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", borderBottomWidth: 1, borderColor: "rgba(59,47,28,0.2)" }}>
                      <Text style={{ color: "#6b5630", fontSize: 7.5, fontWeight: "700", letterSpacing: 0.4 }}>{label.toUpperCase()}</Text>
                      <Text numberOfLines={1} style={{ color: "#1b140a", fontSize: 11.5, fontWeight: "900", fontFamily: "serif" }}>{value}</Text>
                    </View>
                  ))}
                </View>
                <View style={{ position: "absolute", left: 12, right: 12, top: SIG.y - 2 }}>
                  <View style={{ height: SIG.h + 6 }}>
                    <View style={{ position: "absolute", left: 2, top: 2 }}><Signature d={CLUB_SIG_D} width={72} height={20} progress={1} color="#1e3a8a" /></View>
                    <View style={{ position: "absolute", left: SIG.x - 14, top: 0 }}><Signature d={SIGNATURE_D} width={SIG.w + 4} height={SIG.h + 2} progress={beat === "idle" || beat === "zoom" ? 0 : beat === "sign" ? ink : 1} color="#0f172a" /></View>
                    {beat === "idle" && <Text style={{ position: "absolute", left: SIG.x - 12, top: 6, color: "#b45309", fontSize: 8, fontWeight: "900", letterSpacing: 0.4 }}>✕ SIGN HERE</Text>}
                  </View>
                  <View style={{ flexDirection: "row", gap: 12 }}>
                    <Text numberOfLines={1} style={{ flex: 1, borderTopWidth: 1, borderColor: "rgba(59,47,28,0.7)", color: "#5b4a2c", fontSize: 6.5, fontWeight: "700", letterSpacing: 0.4 }}>{`For ${club}`.toUpperCase()}</Text>
                    <Text numberOfLines={1} style={{ flex: 1, borderTopWidth: 1, borderColor: "rgba(59,47,28,0.7)", color: "#5b4a2c", fontSize: 6.5, fontWeight: "700", letterSpacing: 0.4 }}>{`${career.player.firstName} ${career.player.lastName}`.toUpperCase()}</Text>
                  </View>
                </View>
                {/* the pen, travelling along your line */}
                {(beat === "zoom" || beat === "sign") && (
                  <Text style={{ position: "absolute", left: 12 + SIG.x - 14 + (beat === "sign" ? ink * (SIG.w - 4) : 0), top: SIG.y - 26, fontSize: 22, transform: [{ rotate: "-10deg" }] }}>🖊️</Text>
                )}
              </View>
            </Animated.View>
            {shake && (
              <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 22, alignItems: "center" }}>
                <Text style={[{ color: "#fcd34d", fontSize: 20, fontWeight: "900", letterSpacing: -0.4 }, outline]}>WELCOME TO</Text>
                <Text style={[{ marginTop: 4, color: "#fff", fontSize: 26, fontWeight: "900", textTransform: "uppercase" }, outline]}>{club}</Text>
              </View>
            )}
          </View>
        </Pressable>
        <Pressable onPress={beat === "done" ? onDone : start} disabled={beat !== "idle" && beat !== "done"}
          style={{ marginTop: 16, width: SW * k, minHeight: 52, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundImage: "linear-gradient(180deg,#fcd34d,#f59e0b)", boxShadow: "0px 6px 18px -4px rgba(251,191,36,0.6)", opacity: beat !== "idle" && beat !== "done" ? 0.5 : 1 } as ViewStyle}>
          <Text style={{ color: "#451a03", fontSize: 15, fontWeight: "900", letterSpacing: 2 }}>{beat === "idle" ? "TAP TO SIGN" : beat === "done" ? "CONTINUE" : "SIGNING…"}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
