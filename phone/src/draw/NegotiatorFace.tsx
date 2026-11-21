/**
 * <NegotiatorFace mood size />: THE OTHER SIDE OF THE TABLE, DRAWN (the website's
 * components/star/NegotiationScreen.tsx AgentPortrait): a head-and-shoulders bust
 * in a suit and tie on a round dark ground; only the eyebrows, eyes and mouth change
 * with the mood (happy: smiling, green tie; neutral: flat; angry: frowning, red tie).
 * Never an emoji face: Samsung draws its own.
 *
 *   mood  "happy" | "neutral" | "angry"   (lib/star/negotiation.ts moodToFace)
 *   size  in points (default 60)
 */
import { useMemo } from "react";
import { View } from "react-native";
import { Canvas, ImageSVG, Skia } from "@shopify/react-native-skia";

export type FaceMood = "happy" | "neutral" | "angry";

function markup(mood: FaceMood): string {
  const skin = "#e8b98c", hair = "#8a5a2b";
  const suit = mood === "angry" ? "#3a2430" : "#2b3a52";
  const tie = mood === "happy" ? "#2e9e5b" : mood === "angry" ? "#c23b3b" : "#5b6b8a";
  const cheek = mood === "angry" ? "#d97a6a" : "#f2a98f";
  const bg = mood === "happy" ? "#1f5a3d" : mood === "angry" ? "#5a2323" : "#233047";
  const brows = mood === "angry"
    ? `<path d="M 33,36 L 43,39" stroke="#3a2a18" stroke-width="2.4" stroke-linecap="round" fill="none"/><path d="M 67,36 L 57,39" stroke="#3a2a18" stroke-width="2.4" stroke-linecap="round" fill="none"/>`
    : mood === "happy"
    ? `<path d="M 33,38 C 37,35 41,35 44,37" stroke="#3a2a18" stroke-width="2.2" stroke-linecap="round" fill="none"/><path d="M 67,38 C 63,35 59,35 56,37" stroke="#3a2a18" stroke-width="2.2" stroke-linecap="round" fill="none"/>`
    : `<path d="M 33,37 L 44,37.5" stroke="#3a2a18" stroke-width="2.2" stroke-linecap="round" fill="none"/><path d="M 67,37 L 56,37.5" stroke="#3a2a18" stroke-width="2.2" stroke-linecap="round" fill="none"/>`;
  const eyes = mood === "happy"
    ? `<path d="M 34,44 C 36,41.5 40,41.5 42,44" stroke="#2a1c10" stroke-width="2.2" stroke-linecap="round" fill="none"/><path d="M 58,44 C 60,41.5 64,41.5 66,44" stroke="#2a1c10" stroke-width="2.2" stroke-linecap="round" fill="none"/>`
    : `<ellipse cx="38" cy="44" rx="2.6" ry="${mood === "angry" ? 2.1 : 2.6}" fill="#2a1c10"/><ellipse cx="62" cy="44" rx="2.6" ry="${mood === "angry" ? 2.1 : 2.6}" fill="#2a1c10"/>`;
  const mouth = mood === "happy"
    ? `<path d="M 38,54 C 43,60 57,60 62,54" stroke="#5a2a1c" stroke-width="2.4" stroke-linecap="round" fill="none"/>`
    : mood === "angry"
    ? `<path d="M 39,57 C 44,54.5 56,54.5 61,57" stroke="#5a2a1c" stroke-width="2.4" stroke-linecap="round" fill="none"/>`
    : `<path d="M 40,56 L 60,56" stroke="#5a2a1c" stroke-width="2.4" stroke-linecap="round" fill="none"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
<defs><radialGradient id="g" cx="50%" cy="40%" r="65%"><stop offset="0%" stop-color="${bg}"/><stop offset="100%" stop-color="#0c1220"/></radialGradient></defs>
<circle cx="50" cy="50" r="50" fill="url(#g)"/>
<path d="M 14,100 C 16,78 30,68 50,68 C 70,68 84,78 86,100 Z" fill="${suit}"/>
<path d="M 40,72 L 50,84 L 60,72 L 54,68 L 46,68 Z" fill="#f4f1ea"/>
<path d="M 50,84 L 46,74 L 50,78 L 54,74 Z" fill="${tie}"/>
<rect x="43" y="56" width="14" height="16" rx="4" fill="${skin}"/>
<ellipse cx="50" cy="42" rx="21" ry="23" fill="${skin}"/>
<circle cx="29" cy="43" r="3.4" fill="${skin}"/><circle cx="71" cy="43" r="3.4" fill="${skin}"/>
<path d="M 29,38 C 27,20 40,12 50,12 C 60,12 73,20 71,38 C 68,28 60,24 50,24 C 40,24 32,28 29,38 Z" fill="${hair}"/>
<path d="M 29,38 C 27,30 30,26 33,24 C 30,29 30,34 31,39 Z" fill="${hair}"/>
<path d="M 71,38 C 73,30 70,26 67,24 C 70,29 70,34 69,39 Z" fill="${hair}"/>
<ellipse cx="37" cy="49" rx="4.2" ry="2.6" fill="${cheek}" fill-opacity="0.55"/><ellipse cx="63" cy="49" rx="4.2" ry="2.6" fill="${cheek}" fill-opacity="0.55"/>
${brows}${eyes}${mouth}</svg>`;
}

const cache = new Map<FaceMood, ReturnType<typeof Skia.SVG.MakeFromString>>();
function faceSvg(mood: FaceMood) {
  let o = cache.get(mood);
  if (o === undefined) {
    try { o = Skia.SVG.MakeFromString(markup(mood)); } catch { o = null; }
    cache.set(mood, o);
  }
  return o;
}

export function NegotiatorFace({ mood, size = 60 }: { mood: FaceMood; size?: number }) {
  const svg = useMemo(() => faceSvg(mood), [mood]);
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: "hidden", backgroundColor: "#0c1220" }}>
      {svg ? <Canvas style={{ width: size, height: size }}><ImageSVG svg={svg} x={0} y={0} width={size} height={size} /></Canvas> : null}
    </View>
  );
}
