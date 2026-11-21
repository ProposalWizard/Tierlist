/**
 * THE COACH TOUR (the website's components/star/PointerTour.tsx, lib/star/tours.ts):
 * the screen goes dark except for one thing, a yellow ring round it, a white
 * hand pointing at it and the coach's white speech bubble (🧢) beside it.
 * A "press" step waits for the tap on the thing itself; any other step moves
 * on with a tap (NEXT ▸, "Got it" on the last).
 *
 * Targets are named as on the website (data-tour): a view says what it is with
 * `useTourTarget("energy")` (spread on the View), and its place on the screen
 * is measured in window points. A step whose target is not on screen shows the
 * bubble in the middle with no hole.
 *
 *   <PointerTour steps={welcomeTour(true, 0, true)} press={{ "nav-play": () => … }} onDone={…} />
 */
import { useEffect, useRef, useState, useSyncExternalStore, type ComponentRef, type ReactNode } from "react";
import { Modal, Text, View, Pressable, useWindowDimensions, type ViewStyle } from "react-native";
import type { TourStep } from "@/lib/star/tours";

type Box = { x: number; y: number; w: number; h: number };
const boxes = new Map<string, Box>();
const subs = new Set<() => void>();
let version = 0;
function setBox(name: string, b: Box | null) {
  const was = boxes.get(name);
  if (b && was && was.x === b.x && was.y === b.y && was.w === b.w && was.h === b.h) return;
  if (b) boxes.set(name, b); else boxes.delete(name);
  version++;
  subs.forEach((f) => f());
}
function useBoxes(): number {
  return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => version, () => version);
}

/** Name a view for the tour: `<View {...useTourTarget("energy")}>`. */
export function useTourTarget(name: string) {
  const ref = useRef<ComponentRef<typeof View>>(null);
  useEffect(() => () => setBox(name, null), [name]);
  const measure = () => {
    // A frame later: the layout pass has placed it in the window by then.
    requestAnimationFrame(() => ref.current?.measureInWindow((x, y, w, h) => { if (w > 0 && h > 0) setBox(name, { x, y, w, h }); }));
  };
  return { ref, onLayout: measure, collapsable: false as const };
}

const HAND_H = 46;
const DIM = "rgba(0,0,0,0.62)";
const EDGE = 10;

/** The pointing hand (the website draws a white glove; the phone's own pointing finger here). */
function Hand({ down }: { down: boolean }) {
  return <Text style={{ fontSize: 34, lineHeight: HAND_H, textShadowColor: "rgba(0,0,0,0.6)", textShadowRadius: 5, textShadowOffset: { width: 0, height: 3 } }}>{down ? "👇" : "👆"}</Text>;
}

/** Name a view for the tour by wrapping it: `<TourTarget name="app-messages">…</TourTarget>`. */
export function TourTarget({ name, children, style }: { name: string; children: ReactNode; style?: ViewStyle }) {
  return <View {...useTourTarget(name)} style={style}>{children}</View>;
}

export function PointerTour({ steps, onDone, press, skippable, chain }: {
  steps: TourStep[];
  /** Called when the tour ends (the last step pressed or tapped through). */
  onDone: () => void;
  /** What a "press" step's tap does (by target name). The tour ends with it. */
  press?: Record<string, () => void>;
  skippable?: boolean;
  /** A pressed step goes on to the next step instead of ending the tour (Phone → Messages → the offer). */
  chain?: boolean;
}) {
  const [i, setI] = useState(0);
  const [bubbleH, setBubbleH] = useState(110);
  useBoxes();
  const vp = useWindowDimensions();
  const step = steps[i];
  if (!step) return null;
  const last = i === steps.length - 1;
  const next = () => { if (last) onDone(); else setI(i + 1); };
  const hole = step.target === "screen" ? null : boxes.get(step.target) ?? null;
  const isPress = !!step.press;
  const doPress = () => {
    if (chain && !last) { press?.[step.target]?.(); setI(i + 1); return; }
    onDone(); press?.[step.target]?.();
  };

  const bubbleW = Math.min(320, vp.width - 2 * EDGE);
  const cx = hole ? hole.x + hole.w / 2 : vp.width / 2;
  const left = Math.max(EDGE, Math.min(vp.width - bubbleW - EDGE, cx - bubbleW / 2));
  const need = bubbleH + HAND_H + 4;
  let place: "above" | "below" | "inside" = "inside";
  if (hole) {
    const roomAbove = hole.y - EDGE, roomBelow = vp.height - (hole.y + hole.h) - EDGE;
    const wantAbove = hole.y + hole.h / 2 > vp.height * 0.5;
    place = wantAbove && roomAbove >= need ? "above" : !wantAbove && roomBelow >= need ? "below" : roomAbove >= need ? "above" : roomBelow >= need ? "below" : "inside";
  }
  const clampTop = (t: number) => Math.max(EDGE, Math.min(vp.height - bubbleH - EDGE, t));
  const bubbleTop = !hole ? clampTop(vp.height * 0.35)
    : place === "above" ? clampTop(hole.y - HAND_H - 2 - bubbleH)
    : place === "below" ? clampTop(hole.y + hole.h + HAND_H + 2)
    : clampTop(Math.max(hole.y, 0) + 24);
  const handLeft = Math.max(8, Math.min(vp.width - 42, cx - 17));

  const panel = (key: string, s: ViewStyle) => (
    <Pressable key={key} onPress={isPress ? (hole ? undefined : onDone) : next} style={[{ position: "absolute", backgroundColor: DIM }, s]} />
  );
  return (
    <Modal transparent visible animationType="fade" statusBarTranslucent onRequestClose={() => { if (skippable) onDone(); }}>
      <View style={{ flex: 1 }}>
        {hole ? (<>
          {panel("t", { left: 0, top: 0, width: vp.width, height: Math.max(0, hole.y) })}
          {panel("b", { left: 0, top: hole.y + hole.h, width: vp.width, height: Math.max(0, vp.height - hole.y - hole.h) })}
          {panel("l", { left: 0, top: hole.y, width: Math.max(0, hole.x), height: hole.h })}
          {panel("r", { left: hole.x + hole.w, top: hole.y, width: Math.max(0, vp.width - hole.x - hole.w), height: hole.h })}
          <Pressable onPress={isPress ? doPress : next}
            style={{ position: "absolute", left: hole.x - 3, top: hole.y - 3, width: hole.w + 6, height: hole.h + 6, borderRadius: 6, borderWidth: 3, borderColor: "#fde047", boxShadow: "0px 0px 18px 4px rgba(253,224,71,0.55)" } as ViewStyle} />
          {place !== "inside" && (
            <View pointerEvents="none" style={{ position: "absolute", left: handLeft, top: place === "above" ? hole.y - HAND_H - 2 : hole.y + hole.h + 2 }}>
              <Hand down={place === "above"} />
            </View>
          )}
        </>) : panel("all", { left: 0, top: 0, width: vp.width, height: vp.height, backgroundColor: "rgba(0,0,0,0.45)" })}
        {!(isPress && !step.text) && (
          <Pressable onPress={isPress ? undefined : next} onLayout={(e) => { const h = Math.round(e.nativeEvent.layout.height); if (Math.abs(h - bubbleH) > 2) setBubbleH(h); }}
            style={{ position: "absolute", left, top: bubbleTop, width: bubbleW, backgroundColor: "#fff", borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10, boxShadow: "0px 12px 28px -8px rgba(0,0,0,0.75)" } as ViewStyle}>
            {hole && place !== "inside" && (
              <View pointerEvents="none" style={{
                position: "absolute", left: Math.max(14, Math.min(bubbleW - 32, cx - left - 9)), width: 0, height: 0,
                borderLeftWidth: 9, borderRightWidth: 9, borderLeftColor: "transparent", borderRightColor: "transparent",
                ...(place === "above" ? { bottom: -9, borderTopWidth: 9, borderTopColor: "#fff" } : { top: -9, borderBottomWidth: 9, borderBottomColor: "#fff" }),
              }} />
            )}
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: "#059669", alignItems: "center", justifyContent: "center", marginTop: 2 }}>
                <Text style={{ fontSize: 15 }}>🧢</Text>
              </View>
              <Text style={{ flex: 1, color: "#0e1613", fontSize: 16, fontWeight: "900", lineHeight: 21 }}>{step.text}</Text>
            </View>
            {!isPress && (
              <View style={{ marginTop: 4, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                {skippable ? <Text onPress={onDone} style={{ color: "#6b7280", fontSize: 11, fontWeight: "900", letterSpacing: 1.5 }}>SKIP</Text> : <View />}
                <Text style={{ color: "#047857", fontSize: 12, fontWeight: "900", letterSpacing: 1.5 }}>{last ? "GOT IT" : "NEXT ▸"}</Text>
              </View>
            )}
          </Pressable>
        )}
      </View>
    </Modal>
  );
}
