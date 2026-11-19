/**
 * THE LOOK'S FONTS (the website's, see README.md):
 * - Anton: tall, condensed capitals for headings, names and big numbers
 *   (the website's "display" face, components/star/ui/pitchFont.ts).
 * - Cinzel (Black): the gold serif of STAR PASS (app/layout.tsx --font-cinzel).
 * - Body: the phone's own sans (Roboto on Android), as the website's font-sans is.
 *
 * Both files are in phone/assets/look/fonts (SIL Open Font License). They load
 * once at start (App.tsx waits for them, at most FONT_WAIT_MS); if a file
 * fails, words fall back to the body font and the app still runs.
 */
import { useEffect, useState } from "react";
import * as Font from "expo-font";

export const FONT = {
  /** Anton: headings, names, big numbers. Has one weight: never set fontWeight with it. */
  display: "Anton",
  /** Cinzel Black: the Star Pass's gold serif. */
  serif: "Cinzel-Black",
  /** The phone's own sans: leave fontFamily unset. */
  body: undefined as string | undefined,
};

const FILES = {
  [FONT.display]: require("../../../assets/look/fonts/Anton.ttf"),
  [FONT.serif]: require("../../../assets/look/fonts/Cinzel-Black.ttf"),
};

/** The longest the app waits for the fonts before it starts anyway. */
export const FONT_WAIT_MS = 1500;

let ready = false;
const loading: Promise<void> = Font.loadAsync(FILES)
  .catch(() => { /* the body font stands in */ })
  .then(() => { ready = true; });

/** True once the look's fonts are loaded (or have given up). */
export function useLookFonts(): boolean {
  const [ok, setOk] = useState(ready);
  useEffect(() => {
    if (ok) return;
    let live = true;
    const t = setTimeout(() => live && setOk(true), FONT_WAIT_MS);
    loading.then(() => live && setOk(true));
    return () => { live = false; clearTimeout(t); };
  }, [ok]);
  return ok;
}
