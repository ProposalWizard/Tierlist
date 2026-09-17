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
      img.onerror = () => {
        if (img.dataset.retried) return;
        img.dataset.retried = "1";
        window.setTimeout(() => {
          img.src = `${url}${url.includes("?") ? "&" : "?"}retry=1`;
        }, 600);
      };
      img.src = url;
      cache.set(url, img);
      return img;
    },
  };
}
