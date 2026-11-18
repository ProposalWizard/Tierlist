/**
 * <PlayerFigure career width height ... />: YOUR PLAYER IN HIS CLUB KIT — the
 * website's PlayerAvatar (components/star/PlayerAvatar.tsx: the Home hero
 * when "Player style" is Old, the title screen, Spin your player), drawn by
 * the same lib/star code with the same arguments:
 *   A2 (the default, AVATAR_STYLE) → heroFigure.ts paintHeroFigure + paintHeroShadow
 *       + compositeLit (the rim lights); view "back" → heroBack.ts paintHeroBack
 *   A1 → fiveASide/render.ts drawFigureAt + drawBall
 * plus the club crest on his chest (ClubBadge), placed by the same sums.
 *
 * Face fit, as on the website: his photo (career.player.portrait, else the
 * website's default fake face) is loaded and fitted to the body by
 * lib/star/faceFit.ts `fitFace`. Until it has loaded (or if it cannot be
 * loaded, e.g. offline) he has the plain drawn head, as on the website.
 *
 * Props (PlayerAvatar's)
 *   career      the career (club, kit, skin tone, squad number, photo)
 *   width, height  his box in points; his boots on its bottom edge
 *   ball        A1 only: a ball at his feet (default true)
 *   look        "A2" (default, the website's AVATAR_STYLE) | "A1"
 *   celebrate   arms up (the win celebration); hides the crest
 *   view        "front" (default) | "back" (A2 from behind: surname and number)
 *   faceFit     fit his photo to the body (default true, as the website)
 *
 * Not done: the website's useScannedPortrait (re-scanning an old save's photo
 * once) and its per-browser face style edits (the phone uses the defaults).
 */
import { useCallback, useEffect, useState } from "react";
import { PixelRatio, View } from "react-native";
import { Skia, type SkImage } from "@shopify/react-native-skia";
import type { CareerState } from "@/lib/star/types";
import { kitsOf } from "@/lib/star/kits";
import { skinToneHex } from "@/lib/star/playerIdentity";
import { DEFAULT_FAKE_FACE } from "@/lib/star/fakeFaces";
import type { AvatarStyle } from "@/lib/star/heroFigure";
import { fitFace, type FittedHead } from "@/lib/star/faceFit";
import { Drawn, phoneFontFor } from "./useDrawing";
import { OffscreenCanvas2D, faceRef, loadedFace, withCanvasDocument, absoluteUrl, type FacePicture } from "./offscreen";
import { ClubBadge } from "./ClubBadge";
import { AVATAR_STYLE, paintPlayerFigure, crestPlace } from "./figurePaint";

export { AVATAR_STYLE };
// ── Photos: loaded once per address, and fitted once ────────────────────────

const photos = new Map<string, Promise<SkImage | null>>();
/** Load a picture (https address, a site path, or a data: URL) as a Skia image. */
export function loadPicture(url: string): Promise<SkImage | null> {
  let p = photos.get(url);
  if (!p) {
    p = (async () => {
      try {
        const data = url.startsWith("data:")
          ? Skia.Data.fromBase64(url.slice(url.indexOf(",") + 1))
          : await Skia.Data.fromURI(absoluteUrl(url));
        return Skia.Image.MakeImageFromEncoded(data);
      } catch { return null; }
    })();
    photos.set(url, p);
  }
  return p;
}
const fits = new Map<string, Promise<FittedHead | null>>();
/** lib/star/faceFit.ts fitFace on the loaded photo, once per address. */
export function fittedHead(url: string): Promise<FittedHead | null> {
  let p = fits.get(url);
  if (!p) {
    p = loadPicture(url).then((img) => {
      if (!img) return null;
      try {
        return withCanvasDocument(Skia, () => fitFace(loadedFace(url, img) as unknown as HTMLImageElement), phoneFontFor);
      } catch { return null; }
    });
    fits.set(url, p);
  }
  return p;
}

export function PlayerFigure({ career, width, height, ball = true, look = AVATAR_STYLE, celebrate = false, view = "front", faceFit = true }: {
  career: CareerState; width: number; height: number; ball?: boolean;
  look?: AvatarStyle; celebrate?: boolean; view?: "front" | "back"; faceFit?: boolean;
}) {
  const club = career.player.club;
  const kit = kitsOf(club, career.clubKits?.[club]).home;
  const skin = skinToneHex(career.player.skinTone);
  const faceUrl = career.player.portrait ?? DEFAULT_FAKE_FACE;
  const number = career.squadNumber ?? null;
  const fitOn = faceFit && look === "A2";

  const [face, setFace] = useState<FacePicture>(() => faceRef(faceUrl));
  const [fitted, setFitted] = useState<FittedHead | null>(null);
  useEffect(() => {
    let alive = true;
    setFace(faceRef(faceUrl)); setFitted(null);
    loadPicture(faceUrl).then((img) => { if (alive && img) setFace(loadedFace(faceUrl, img)); });
    if (fitOn) fittedHead(faceUrl).then((f) => { if (alive) setFitted(f); });
    return () => { alive = false; };
  }, [faceUrl, fitOn]);

  // The website's canvas is sized for the screen (dpr, at most 3); so is this
  // one, because the rim lights are made from pixel layers.
  const dpr = Math.min(3, PixelRatio.get() || 1);
  const lastName = career.player.lastName, firstName = career.player.firstName;

  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    paintPlayerFigure(ctx, {
      width, height, dpr, kit, skin, face: face as unknown as HTMLImageElement, number,
      fitted: fitOn ? fitted : null, look, celebrate, view, ball, firstName, lastName,
    }, (w, h) => new OffscreenCanvas2D(Skia, w, h, phoneFontFor) as unknown as HTMLCanvasElement);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height, kit.shirt, kit.trim, skin, face, ball, look, celebrate, number, fitOn, fitted, view, lastName, firstName, dpr]);

  const crest = crestPlace(width, height, look, celebrate, view, ball);

  return (
    <View style={{ width, height }} accessibilityLabel={`${firstName} ${lastName} in the ${club} kit`}>
      <Drawn width={width} height={height} draw={draw} pixelRatio={dpr} rawPixels />
      {crest && (
        <View style={{ position: "absolute", left: crest.left - crest.size / 2, top: crest.top - crest.size / 2, transform: [{ rotate: "-4deg" }] }}>
          <ClubBadge club={club} kit={kit} size={crest.size} shadow />
        </View>
      )}
    </View>
  );
}
