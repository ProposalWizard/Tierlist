/**
 * THE PICTURE BEHIND A SCREEN (put it first inside the screen's root View;
 * it fills the root and takes no touches):
 *   <Backdrop kind="stadium" />                   the blurred day stadium (Stats, League, Phone, Post-match)
 *   <Backdrop kind="title" sky="sunset" />        the stadium seen from the pitch (title screen)
 *   <Backdrop kind="home" sky="sunset" lineY={y} />  Home's scene, its hoardings on screen height y
 *   <Backdrop kind="green" />                     the new-career pages' green
 *   <Backdrop kind="night" />                     plain dark (a screen with its own picture on top)
 * One still picture each: drawn once, never redrawn.
 */
import { useState } from "react";
import { Image, View, type ImageSourcePropType, type ViewStyle } from "react-native";
import type { HomeSky } from "@/lib/star/kickoff";
import { HOME_SCENE, HOME_SCENE_ASPECT, HOME_SCENE_LINE, STADIUM_BLUR, TITLE_STADIUM, TITLE_STADIUM_ASPECT } from "./pictures";

const FILL = { position: "absolute", left: 0, top: 0, right: 0, bottom: 0 } as const;

export type BackdropKind = "stadium" | "title" | "home" | "green" | "night";

export function Backdrop({ kind, sky = "sunset", lineY }: { kind: BackdropKind; sky?: HomeSky; lineY?: number }) {
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const measure = (e: { nativeEvent: { layout: { width: number; height: number } } }) => {
    const { width, height } = e.nativeEvent.layout;
    if (!box || box.w !== width || box.h !== height) setBox({ w: width, h: height });
  };
  return (
    <View pointerEvents="none" onLayout={measure} style={[FILL, { overflow: "hidden", backgroundColor: kind === "green" ? "#022c22" : "#0b1a2e" }]}>
      {kind === "green" && <View style={[FILL, { backgroundImage: "linear-gradient(180deg, #064e3b, #022c22)" } as ViewStyle]} />}
      {kind === "stadium" && box && (
        <>
          <Cover src={STADIUM_BLUR} aspect={1344 / 752} w={box.w + 80} h={box.h + 80} focusY={0.3} offset={-40} />
          {/* glassLook --sk-page: a little darker towards the bottom */}
          <View style={[FILL, { backgroundImage: "linear-gradient(180deg, rgba(6,18,34,0.10) 0%, rgba(6,18,34,0.28) 45%, rgba(4,14,24,0.55) 100%)" } as ViewStyle]} />
        </>
      )}
      {kind === "title" && box && (
        <>
          <Cover src={TITLE_STADIUM[sky]} aspect={TITLE_STADIUM_ASPECT} w={box.w * 1.08} h={box.h * 1.08} focusY={0.62} offset={-0.04 * box.w} offsetY={-0.04 * box.h} />
          {/* TitleScreen.tsx: a dark edge, darker at the top behind the name */}
          <View style={[FILL, { backgroundImage: "radial-gradient(120% 70% at 30% 52%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.5) 100%), linear-gradient(180deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0) 24%)" } as ViewStyle]} />
        </>
      )}
      {kind === "home" && box && <HomeScene sky={sky} w={box.w} h={box.h} lineY={lineY ?? box.h * 0.55} />}
    </View>
  );
}

/** A picture covering w×h (as CSS background-size: cover), its focus point `focusY` (0-1) kept in view. */
function Cover({ src, aspect, w, h, focusY, offset = 0, offsetY }: { src: ImageSourcePropType; aspect: number; w: number; h: number; focusY: number; offset?: number; offsetY?: number }) {
  const imgH = Math.max(h, w * aspect);
  const imgW = imgH / aspect;
  return <Image source={src} resizeMode="stretch" fadeDuration={0} style={{ position: "absolute", width: imgW, height: imgH, left: offset + (w - imgW) / 2, top: (offsetY ?? offset) + (h - imgH) * focusY }} />;
}

/**
 * Home's one picture (HomeHub.tsx HomeScene): as small as it can be while
 * covering the screen, with its hoardings on `lineY`.
 */
function HomeScene({ sky, w, h, lineY }: { sky: HomeSky; w: number; h: number; lineY: number }) {
  const f = HOME_SCENE_LINE[sky];
  const imgH = Math.max(w * HOME_SCENE_ASPECT, lineY / f, (h - lineY) / (1 - f));
  const imgW = imgH / HOME_SCENE_ASPECT;
  return <Image source={HOME_SCENE[sky]} resizeMode="stretch" fadeDuration={0} style={{ position: "absolute", width: imgW, height: imgH, left: (w - imgW) / 2, top: lineY - f * imgH }} />;
}
