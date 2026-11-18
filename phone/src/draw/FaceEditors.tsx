/**
 * THE TWO FACE EDITORS — the phone ports of components/star/FaceEditorScreen.tsx
 * ("Player Graphics", the real photos) and FakeFaceEditorScreen.tsx ("Fake
 * Face Graphics", the seven fake faces).
 *
 * What can be changed, as on the website:
 *   Player Graphics  pick a squad player to check it on; drag the face or use
 *                    Size, Left / Right, Up / Down; Crop Photo (drag, zoom);
 *                    Backing circle (on/off, colour); Outline (on/off,
 *                    colour, thickness); Reset to Default.
 *   Fake Faces       pick one of the seven; drag / Size / Left / Right /
 *                    Up / Down; Crop Photo; Reset to Default. Backing and
 *                    outline are shared with real photos (read-only here).
 * How it is saved, as on the website: every change at once, through the
 * game's own saveFaceStyle / saveFakeFaceStyle (lib/star/faceStyle.ts,
 * fakeFaceStyle.ts) into localStorage, which on the phone is the phone's
 * own storage (appFlags.ts). It takes effect at the next match.
 *
 * The preview is drawn by the same lib/star drawPlayerHead the match uses,
 * on the phone through ctx2d (useDrawing.tsx).
 *
 * Like the website, Settings only opens these while photo faces are on
 * (lib/star/faceStyle.ts PHOTO_FACES, false since 12 Oct 2026: every head is
 * drawn, so the photo does not show in the preview either). The drawing test
 * screen (art-test) opens them regardless.
 *
 * Different from the website: colours are picked from swatches (the website's
 * colour picker takes any colour); the squad player is picked with ‹ ›.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PanResponder, ScrollView, Text, View, type LayoutChangeEvent } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Canvas, Image as SkImageView, Path, type SkImage } from "@shopify/react-native-skia";
import type { CareerState } from "@/lib/star/types";
import {
  loadFaceStyle, saveFaceStyle, DEFAULT_FACE_STYLE, FACE_SCALE_RANGE, FACE_OFFSET_RANGE, CROP_VIEWPORT, CROP_ZOOM_RANGE, type FaceStyle,
} from "@/lib/star/faceStyle";
import { loadFakeFaceStyle, saveFakeFaceStyle, DEFAULT_FAKE_FACE_STYLE, type FakeFaceStyle } from "@/lib/star/fakeFaceStyle";
import { FAKE_FACES, fakeFaceFor } from "@/lib/star/fakeFaces";
import { coverScale, clampOffset, initialView, type CropView } from "@/lib/star/portrait";
import { drawPlayerHead } from "@/lib/star/drawPlayerHead";
import { kitsOf } from "@/lib/star/kits";
import { Press } from "../ui/Press";
import { C } from "../ui/theme";
import { Drawn } from "./useDrawing";
import { loadPicture } from "./PlayerFigure";
import { faceRef, loadedFace, type FacePicture } from "./offscreen";

const SIZE = 260;
const FIGURE_R = 72;
const HEAD_BASE_R = FIGURE_R * 0.26;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** The website's simple, representative body, then the configurable head (drawPlayerHead). */
function paintPreview(ctx: CanvasRenderingContext2D, club: string, face: FacePicture | undefined, style: FaceStyle, fake: FakeFaceStyle) {
  ctx.clearRect(0, 0, SIZE, SIZE);
  ctx.fillStyle = "#134e2a";
  ctx.fillRect(0, 0, SIZE, SIZE);
  const kit = kitsOf(club).home;
  const cx = SIZE / 2, cy = SIZE * 0.7, r = FIGURE_R;
  ctx.beginPath(); ctx.ellipse(cx, cy, r * 0.78, r * 0.30, 0, 0, Math.PI * 2); ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.fill();
  ctx.save();
  ctx.translate(cx, cy - r * 0.8);
  ctx.lineCap = "round";
  ctx.strokeStyle = "#c68642";
  ctx.lineWidth = Math.max(2, r * 0.24);
  ctx.beginPath(); ctx.moveTo(-r * 0.24, r * 0.18); ctx.lineTo(-r * 0.24, r * 0.80); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(r * 0.24, r * 0.18); ctx.lineTo(r * 0.24, r * 0.80); ctx.stroke();
  ctx.fillStyle = kit.trim;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(-r * 0.46, -r * 0.02, r * 0.92, r * 0.36, r * 0.12); else ctx.rect(-r * 0.46, -r * 0.02, r * 0.92, r * 0.36);
  ctx.fill();
  ctx.strokeStyle = "#c68642";
  ctx.lineWidth = Math.max(2, r * 0.20);
  ctx.beginPath(); ctx.moveTo(-r * 0.34, -r * 0.30); ctx.lineTo(-r * 0.58, -r * 0.02); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(r * 0.34, -r * 0.30); ctx.lineTo(r * 0.58, -r * 0.02); ctx.stroke();
  ctx.fillStyle = kit.shirt;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(-r * 0.52, -r * 0.56, r * 1.04, r * 0.72, r * 0.17); else ctx.rect(-r * 0.52, -r * 0.56, r * 1.04, r * 0.72);
  ctx.fill();
  ctx.lineWidth = Math.max(1, r * 0.12);
  ctx.strokeStyle = kit.trim;
  ctx.stroke();
  drawPlayerHead(ctx, 0, -r * 0.76, HEAD_BASE_R, r, face as unknown as HTMLImageElement | undefined, style, fake);
  ctx.restore();
}

/** Load one face picture (packed in the app when it can be, else from its address). */
function useFace(url: string | undefined): { face?: FacePicture; image: SkImage | null } {
  const [state, setState] = useState<{ face?: FacePicture; image: SkImage | null }>({ face: url ? faceRef(url) : undefined, image: null });
  useEffect(() => {
    let alive = true;
    setState({ face: url ? faceRef(url) : undefined, image: null });
    if (url) loadPicture(url).then((img) => { if (alive && img) setState({ face: loadedFace(url, img), image: img }); });
    return () => { alive = false; };
  }, [url]);
  return state;
}

/** A drag on a box: reports the movement since the finger went down. */
function useDrag(onStart: () => void, onMove: (dx: number, dy: number) => void) {
  const cb = useRef({ onStart, onMove });
  cb.current = { onStart, onMove };
  return useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => cb.current.onStart(),
    onPanResponderMove: (_e, g) => cb.current.onMove(g.dx, g.dy),
  }), []).panHandlers;
}

/** A slider (the website's range input): tap or drag along the track. */
function Slider({ value, min, max, step, onChange, disabled }: { value: number; min: number; max: number; step: number; onChange: (v: number) => void; disabled?: boolean }) {
  const [w, setW] = useState(1);
  const at = (x: number) => { const v = min + clamp(x / w, 0, 1) * (max - min); onChange(Math.round(v / step) * step); };
  const handlers = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => !disabled,
    onMoveShouldSetPanResponder: () => !disabled,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (e) => at(e.nativeEvent.locationX),
    onPanResponderMove: (e) => at(e.nativeEvent.locationX),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [w, min, max, step, disabled, onChange]).panHandlers;
  const k = clamp((value - min) / (max - min), 0, 1);
  return (
    <View onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width || 1)} {...handlers} style={{ height: 32, justifyContent: "center", opacity: disabled ? 0.4 : 1 }}>
      <View pointerEvents="none" style={{ height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.15)" }}>
        <View style={{ width: `${k * 100}%`, height: "100%", borderRadius: 3, backgroundColor: "#10b981" }} />
      </View>
      <View pointerEvents="none" style={{ position: "absolute", left: k * w - 11, width: 22, height: 22, borderRadius: 11, backgroundColor: "#fff", borderWidth: 3, borderColor: "#10b981" }} />
    </View>
  );
}

function Row({ label, value, children }: { label: string; value: string; children: React.ReactNode }) {
  return (
    <View>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ color: C.text, fontSize: 11, fontWeight: "900", letterSpacing: 1.5 }}>{label.toUpperCase()}</Text>
        <Text style={{ color: C.dim, fontSize: 11, fontWeight: "900" }}>{value}</Text>
      </View>
      {children}
    </View>
  );
}
function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <Press onPress={() => onChange(!on)} style={{ width: 24, height: 24, borderRadius: 5, borderWidth: 2, borderColor: C.text, backgroundColor: on ? "#10b981" : "transparent", alignItems: "center", justifyContent: "center" }}>
      {on ? <Text style={{ color: "#05261a", fontWeight: "900" }}>✓</Text> : null}
    </Press>
  );
}
const SWATCHES = ["#c68642", "#8d5524", "#e0ac69", "#f1c27d", "#ffffff", "#000000", "#111827", "#1f2937", "#dc2626", "#16a34a", "#2563eb", "#facc15", "#7c3aed", "#ec4899"];
function Swatches({ value, onChange, disabled }: { value: string; onChange: (c: string) => void; disabled?: boolean }) {
  const list = SWATCHES.includes(value.toLowerCase()) ? SWATCHES : [value, ...SWATCHES];
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ opacity: disabled ? 0.4 : 1 }} contentContainerStyle={{ gap: 6, paddingVertical: 4 }}>
      {list.map((c) => (
        <Press key={c} disabled={disabled} onPress={() => onChange(c)} style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: c, borderWidth: c.toLowerCase() === value.toLowerCase() ? 3 : 1, borderColor: c.toLowerCase() === value.toLowerCase() ? C.gold : "rgba(255,255,255,0.3)" }}>{null}</Press>
      ))}
    </ScrollView>
  );
}
function Panel({ children }: { children: React.ReactNode }) {
  return <View style={{ backgroundColor: C.panel, borderRadius: 14, borderWidth: 1, borderColor: C.line, padding: 12, gap: 12 }}>{children}</View>;
}

/** Crop Photo: the picture under a dark mask with a round window; drag to move, slide to zoom. */
function CropBox({ image, crop, onCrop, note }: { image: SkImage | null; crop: CropView; onCrop: (c: CropView) => void; note: string }) {
  const iw = image?.width() ?? 0, ih = image?.height() ?? 0;
  const start = useRef(crop);
  const drag = useDrag(() => { start.current = crop; }, (dx, dy) => { if (iw) onCrop(clampOffset({ zoom: crop.zoom, x: start.current.x + dx, y: start.current.y + dy }, iw, ih, CROP_VIEWPORT)); });
  const setZoom = (z: number) => {
    if (!iw) { onCrop({ ...crop, zoom: z }); return; }
    const c = CROP_VIEWPORT / 2, k = z / crop.zoom;
    onCrop(clampOffset({ zoom: z, x: c - (c - crop.x) * k, y: c - (c - crop.y) * k }, iw, ih, CROP_VIEWPORT));
  };
  const s = iw ? coverScale(iw, ih, CROP_VIEWPORT) * crop.zoom : 1;
  const V = CROP_VIEWPORT, R = V / 2;
  const mask = `M0 0 H${V} V${V} H0 Z M${R} 0 A${R} ${R} 0 1 0 ${R} ${V} A${R} ${R} 0 1 0 ${R} 0 Z`;
  return (
    <Panel>
      <Text style={{ color: C.text, fontSize: 11, fontWeight: "900", letterSpacing: 1.5 }}>CROP PHOTO</Text>
      <Text style={{ color: C.text, fontSize: 12, fontWeight: "600" }}>{note}</Text>
      <View {...drag} style={{ width: V, height: V, alignSelf: "center", borderRadius: 8, overflow: "hidden", backgroundColor: "#111", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" }}>
        <Canvas style={{ width: V, height: V }} pointerEvents="none">
          {image ? <SkImageView image={image} x={crop.x} y={crop.y} width={iw * s} height={ih * s} fit="fill" /> : null}
          <Path path={mask} color="rgba(0,0,0,0.6)" fillType="evenOdd" />
        </Canvas>
      </View>
      <Slider value={crop.zoom} min={CROP_ZOOM_RANGE[0]} max={CROP_ZOOM_RANGE[1]} step={0.02} onChange={setZoom} />
    </Panel>
  );
}

function Shell({ title, intro, onBack, children }: { title: string; intro: string; onBack: () => void; children: React.ReactNode }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#030712" }}>
      <ScrollView contentContainerStyle={{ padding: 12, gap: 12, paddingBottom: 40 }}>
        <Press onPress={onBack} style={{ alignSelf: "flex-start", backgroundColor: "#374151", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 }}>
          <Text style={{ color: C.text, fontWeight: "900", fontSize: 12 }}>← Settings</Text>
        </Press>
        <Text style={{ color: C.text, fontSize: 18, fontWeight: "900" }}>{title}</Text>
        <Text style={{ color: C.dim, fontSize: 12, fontWeight: "600" }}>{intro}</Text>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

/** The preview, with the face dragged by a finger (the website's pointer drag). */
function Preview({ club, face, style, fake, offset, onOffset }: {
  club: string; face?: FacePicture; style: FaceStyle; fake: FakeFaceStyle;
  offset: { x: number; y: number }; onOffset: (x: number, y: number) => void;
}) {
  const start = useRef(offset);
  const drag = useDrag(() => { start.current = offset; }, (dx, dy) => onOffset(
    clamp(start.current.x + dx / HEAD_BASE_R, ...FACE_OFFSET_RANGE), clamp(start.current.y + dy / HEAD_BASE_R, ...FACE_OFFSET_RANGE)));
  const draw = useCallback((ctx: CanvasRenderingContext2D) => paintPreview(ctx, club, face, style, fake), [club, face, style, fake]);
  return (
    <>
      <View style={{ alignItems: "center", backgroundColor: "#111827", borderRadius: 14, borderWidth: 1, borderColor: "#374151", padding: 8 }}>
        <View {...drag} style={{ borderRadius: 8, overflow: "hidden" }}><Drawn width={SIZE} height={SIZE} draw={draw} /></View>
      </View>
      <Text style={{ color: C.dim, fontSize: 11, fontWeight: "800", textAlign: "center" }}>Drag the face to move it</Text>
    </>
  );
}

// ── Player Graphics (real photos) ───────────────────────────────────────────

export function FaceEditor({ career, onBack }: { career: CareerState; onBack: () => void }) {
  const squad = career.squad ?? [];
  const first = squad.findIndex((p) => p.imageUrl);
  const [index, setIndex] = useState(first >= 0 ? first : 0);
  const selected = squad[index];
  const url = selected ? (selected.imageUrl ?? fakeFaceFor(selected.id)) : undefined;
  const [fake] = useState(loadFakeFaceStyle);
  const [style, setStyle] = useState<FaceStyle>(loadFaceStyle);
  const { face, image } = useFace(url);
  useEffect(() => { saveFaceStyle(style); }, [style]);
  // The shared crop starts centred on the first photo, only while it is still untouched.
  useEffect(() => {
    if (!image) return;
    setStyle((s) => (s.crop.zoom !== 1 || s.crop.x !== 0 || s.crop.y !== 0) ? s : { ...s, crop: initialView(image.width(), image.height(), CROP_VIEWPORT) });
  }, [image]);
  const set = <K extends keyof FaceStyle>(k: K, v: FaceStyle[K]) => setStyle((s) => ({ ...s, [k]: v }));

  return (
    <Shell title="Player Graphics" onBack={onBack}
      intro="Applies to every player on the pitch, real photo or fake face alike — pick one below just to see it, then drag the face or use the sliders to get it exactly right. Saves as you go; takes effect next match.">
      {squad.length > 0 && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#111827", borderRadius: 10, borderWidth: 1, borderColor: "#374151", padding: 6 }}>
          <Press onPress={() => setIndex((i) => (i - 1 + squad.length) % squad.length)} style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}><Text style={{ color: C.text, fontSize: 22, fontWeight: "900" }}>‹</Text></Press>
          <Text numberOfLines={1} style={{ flex: 1, color: C.text, fontWeight: "800", textAlign: "center" }}>{selected ? `${selected.name} · ${selected.position}${selected.imageUrl ? "" : " (fake face)"}` : ""}</Text>
          <Press onPress={() => setIndex((i) => (i + 1) % squad.length)} style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}><Text style={{ color: C.text, fontSize: 22, fontWeight: "900" }}>›</Text></Press>
        </View>
      )}
      <Preview club={career.player.club} face={face} style={style} fake={fake} offset={{ x: style.offsetX, y: style.offsetY }}
        onOffset={(x, y) => setStyle((s) => ({ ...s, offsetX: x, offsetY: y }))} />
      {selected && !selected.imageUrl && (
        <View style={{ backgroundColor: "rgba(120,53,15,0.3)", borderColor: "#b45309", borderWidth: 1, borderRadius: 10, padding: 8 }}>
          <Text style={{ color: "#fde68a", fontSize: 12, fontWeight: "800", textAlign: "center" }}>This player has no real photo — he's shown with a fake face instead. Size/Position/Crop here have no effect on him; use Settings → Fake Faces to tune those.</Text>
        </View>
      )}
      {url && <CropBox image={image} crop={style.crop} onCrop={(c) => set("crop", c)} note="Real photos include the neck and shirt — drag to move, slide to zoom in, so just the face is what lands inside the circle. One shared crop, used for every player's photo, real or fake." />}
      <Panel>
        <Row label="Size" value={`${style.scale.toFixed(2)}x`}><Slider value={style.scale} min={FACE_SCALE_RANGE[0]} max={FACE_SCALE_RANGE[1]} step={0.05} onChange={(v) => set("scale", v)} /></Row>
        <Row label="Left / Right" value={style.offsetX.toFixed(2)}><Slider value={style.offsetX} min={FACE_OFFSET_RANGE[0]} max={FACE_OFFSET_RANGE[1]} step={0.05} onChange={(v) => set("offsetX", v)} /></Row>
        <Row label="Up / Down" value={style.offsetY.toFixed(2)}><Slider value={style.offsetY} min={FACE_OFFSET_RANGE[0]} max={FACE_OFFSET_RANGE[1]} step={0.05} onChange={(v) => set("offsetY", v)} /></Row>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ color: C.text, fontSize: 11, fontWeight: "900", letterSpacing: 1.5 }}>BACKING CIRCLE</Text>
          <Toggle on={style.showBacking} onChange={(v) => set("showBacking", v)} />
        </View>
        <Swatches value={style.backingColor} disabled={!style.showBacking} onChange={(c) => set("backingColor", c)} />
        <Text style={{ color: C.dim, fontSize: 11, fontWeight: "600" }}>Off shows the photo alone with nothing behind it — a player with no photo yet still gets this fill regardless, so a head is never left blank.</Text>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ color: C.text, fontSize: 11, fontWeight: "900", letterSpacing: 1.5 }}>OUTLINE</Text>
          <Toggle on={style.outlineEnabled} onChange={(v) => set("outlineEnabled", v)} />
        </View>
        <Swatches value={/^#[0-9a-fA-F]{6}$/.test(style.outlineColor) ? style.outlineColor : "#000000"} disabled={!style.outlineEnabled} onChange={(c) => set("outlineColor", c)} />
        <Row label="Outline thickness" value={style.outlineWidth.toFixed(1)}><Slider disabled={!style.outlineEnabled} value={style.outlineWidth} min={0} max={4} step={0.1} onChange={(v) => set("outlineWidth", v)} /></Row>
        <Text style={{ color: C.dim, fontSize: 11, fontWeight: "600" }}>A ring around the circle itself, in this colour and thickness.</Text>
        <Press onPress={() => setStyle(DEFAULT_FACE_STYLE)} style={{ backgroundColor: "#374151", borderRadius: 8, paddingVertical: 9, alignItems: "center" }}>
          <Text style={{ color: C.text, fontWeight: "900", fontSize: 12 }}>Reset to Default</Text>
        </Press>
      </Panel>
    </Shell>
  );
}

// ── Fake Face Graphics ──────────────────────────────────────────────────────

function Thumb({ url, on, shirt, onPress }: { url: string; on: boolean; shirt: string; onPress: () => void }) {
  const { image } = useFace(url);
  const S = 42;
  const s = image ? Math.max(S / image.width(), S / image.height()) : 1;
  return (
    <Press onPress={onPress} style={{ width: S, height: S, borderRadius: 6, overflow: "hidden", borderWidth: 2, borderColor: on ? "#34d399" : "rgba(255,255,255,0.15)", backgroundColor: shirt }}>
      <Canvas style={{ width: S, height: S }} pointerEvents="none">
        {image ? <SkImageView image={image} x={(S - image.width() * s) / 2} y={0} width={image.width() * s} height={image.height() * s} fit="fill" /> : null}
      </Canvas>
    </Press>
  );
}

export function FakeFaceEditor({ career, onBack }: { career: CareerState; onBack: () => void }) {
  const [index, setIndex] = useState(0);
  const url = FAKE_FACES[index];
  const [real] = useState(loadFaceStyle);
  const [style, setStyle] = useState<FakeFaceStyle>(loadFakeFaceStyle);
  const { face, image } = useFace(url);
  useEffect(() => { saveFakeFaceStyle(style); }, [style]);
  useEffect(() => {
    if (!image) return;
    setStyle((s) => (s.crop.zoom !== 1 || s.crop.x !== 0 || s.crop.y !== 0) ? s : { ...s, crop: initialView(image.width(), image.height(), CROP_VIEWPORT) });
  }, [image]);
  const set = <K extends keyof FakeFaceStyle>(k: K, v: FakeFaceStyle[K]) => setStyle((s) => ({ ...s, [k]: v }));
  const shirt = kitsOf(career.player.club).home.shirt;
  return (
    <Shell title="Fake Face Graphics" onBack={onBack}
      intro="Size, position and crop for the seven fake faces — every generated player, and any real player with no scraped photo yet, draws with one of these. Pick one below to check it, drag the face or use the sliders to get it right. Saves as you go; takes effect next match.">
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        {FAKE_FACES.map((src, i) => <Thumb key={src} url={src} on={i === index} shirt={shirt} onPress={() => setIndex(i)} />)}
      </View>
      <Preview club={career.player.club} face={face} style={real} fake={style} offset={{ x: style.offsetX, y: style.offsetY }}
        onOffset={(x, y) => setStyle((s) => ({ ...s, offsetX: x, offsetY: y }))} />
      <CropBox image={image} crop={style.crop} onCrop={(c) => set("crop", c)} note="Drag to move, slide to zoom in, so just the face is what lands inside the circle. One shared crop, used for all seven fake faces alike." />
      <Panel>
        <Row label="Size" value={`${style.scale.toFixed(2)}x`}><Slider value={style.scale} min={FACE_SCALE_RANGE[0]} max={FACE_SCALE_RANGE[1]} step={0.05} onChange={(v) => set("scale", v)} /></Row>
        <Row label="Left / Right" value={style.offsetX.toFixed(2)}><Slider value={style.offsetX} min={FACE_OFFSET_RANGE[0]} max={FACE_OFFSET_RANGE[1]} step={0.05} onChange={(v) => set("offsetX", v)} /></Row>
        <Row label="Up / Down" value={style.offsetY.toFixed(2)}><Slider value={style.offsetY} min={FACE_OFFSET_RANGE[0]} max={FACE_OFFSET_RANGE[1]} step={0.05} onChange={(v) => set("offsetY", v)} /></Row>
        <Text style={{ color: C.dim, fontSize: 11, fontWeight: "600" }}>Backing circle, outline and names are shared with real photos — edit those from the main Player Graphics editor instead.</Text>
        <Press onPress={() => setStyle(DEFAULT_FAKE_FACE_STYLE)} style={{ backgroundColor: "#374151", borderRadius: 8, paddingVertical: 9, alignItems: "center" }}>
          <Text style={{ color: C.text, fontWeight: "900", fontSize: 12 }}>Reset to Default</Text>
        </Press>
      </Panel>
    </Shell>
  );
}
