/**
 * ONE real photo, loaded once, reused every frame — the exact cache
 * CanvasMatch.tsx built for real match figures, extracted so the
 * first-person dribble mode (FirstPersonDribble.tsx) can draw real faces
 * too without a second copy of this. A `Map<url, HTMLImageElement>` per
 * caller (each `useRef(createFaceImageCache())` gets its own, same
 * lifetime as the component that owns it) rather than one shared module-
 * level cache — a match and a dribble run are different sessions with
 * different lifetimes, and there is no reason a photo loaded for one
 * should outlive it into the other.
 *
 * Deliberately a lighter retry than the ball-loading pattern elsewhere in
 * this codebase (one retry with a cache-busting param, not a five-attempt
 * backoff): a slow or missing face just leaves that one man on whatever
 * plain fallback drawPlayerHead already falls back to — an ordinary state,
 * not a broken one, and a squad can be twenty-plus distinct real photos in
 * one match.
 */
import { FAKE_FACES, fakeFaceFor } from "./fakeFaces";

/**
 * NEVER A BLANK CIRCLE. A photo that will not load (a dead link, or no route
 * to the photo store — the final playtest's sandbox drew every head but
 * yours as a plain circle, with 91 "Failed to fetch" errors) used to leave
 * its man on drawPlayerHead's plain backing for the whole match. After its
 * one retry it now becomes a fake face — the same one for that photo every
 * time (fakeFaceFor on its address), and drawn with the fake-face style
 * because drawPlayerHead recognises the fake face's own file.
 */
export function fallbackFaceFor(url: string): string {
  return fakeFaceFor(url);
}

export interface FaceImageCache {
  get(url: string | undefined): HTMLImageElement | undefined;
}

export function createFaceImageCache(): FaceImageCache {
  const cache = new Map<string, HTMLImageElement>();
  return {
    get(url: string | undefined): HTMLImageElement | undefined {
      if (!url) return undefined;
      const existing = cache.get(url);
      if (existing) return existing;
      const img = new Image();
      const isFake = FAKE_FACES.includes(url);
      img.onerror = () => {
        if (!img.dataset.retried && !isFake) {
          img.dataset.retried = "1";
          window.setTimeout(() => {
            img.src = `${url}${url.includes("?") ? "&" : "?"}retry=1`;
          }, 600);
          return;
        }
        // The retry failed too: a fake face, once (a fake face that fails
        // itself — the site's own file — has nothing left to fall back to).
        if (img.dataset.faked || isFake) return;
        img.dataset.faked = "1";
        img.src = fallbackFaceFor(url);
      };
      img.src = url;
      cache.set(url, img);
      return img;
    },
  };
}
