"use client";
/**
 * A PLAYER'S HEADSHOT, SHOT FROM THE 3D MODEL (B15, 20 Oct 2026; Harry:
 * "Player of the Month and similar cards … the drawn heads look
 * unprofessional — they should be headshots shot from our 3D model").
 *
 * Shows his drawn head (DrawnHeadChip) straight away, and swaps in the 3D
 * headshot once it is ready: made as the card comes near the screen, one at a
 * time, once per device (lib/star/headshot3d). If WebGL is missing or the
 * picture fails, the drawn head simply stays. Never a blank circle.
 *
 * Photo faces stay off (PHOTO_FACES): this is the game's own Style A model,
 * his head, build, skin and hair seeded from his id (you: Settings → Your look),
 * in his club's kit.
 */
import { createContext, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import DrawnHeadChip from "./DrawnHeadChip";
import type { CareerState } from "@/lib/star/types";
import { playerOf } from "@/lib/star/potm";
import { toonYou, subscribeToonYou } from "@/lib/star/style3d/toon/bodies";
import { headshotLookFor, headshotKey, headshotIdFor, headshotView, type HeadshotKit, type HeadshotState } from "@/lib/star/headshot3d/look";
import { headshotFromMemory } from "@/lib/star/headshot3d/store";

/** Cropping in (a small round chip) keeps this point still: the face's middle lands a little above the chip's. */
const ZOOM_ORIGIN = "50% 52%";

type IdOf = (name: string, club: string, isYou?: boolean) => string;
const IdCtx = createContext<IdOf | null>(null);

/**
 * The squad ids for a screen that only knows men by name and club (season
 * awards, the Ballon d'Or): the same id the Player of the Month card uses
 * (potm.ts playerOf), so a man has the same face on every card.
 */
export function HeadshotCareer({ career, children }: { career: CareerState; children: ReactNode }) {
  const idOf = useMemo<IdOf>(() => (name, club, isYou) => headshotIdFor(name, club, isYou, isYou ? undefined : playerOf(career, name, club)?.id), [career]);
  return <IdCtx.Provider value={idOf}>{children}</IdCtx.Provider>;
}

/** His headshot id on this screen (club|name when no HeadshotCareer is above). */
export function useHeadshotId(): IdOf {
  return useContext(IdCtx) ?? ((name, club, isYou) => headshotIdFor(name, club, isYou));
}

export default function Headshot3D({ id, you, position, skin, kit, size, zoom = 1, className, style, fallback }: {
  /** His stable id (squad id; "you" for you). The same id is the same face everywhere. */
  id: string;
  you?: boolean;
  position?: string;
  skin?: string;
  kit: HeadshotKit;
  /** Width and height on screen, px. */
  size: number;
  /** >1 crops in on the face (a small round chip), from the top. */
  zoom?: number;
  className?: string;
  style?: CSSProperties;
  /** What shows until the headshot lands (default: his drawn head in his kit). */
  fallback?: ReactNode;
}) {
  const yourPick = useSyncExternalStore(subscribeToonYou, toonYou, toonYou);
  const isYou = you || id === "you";
  const look = useMemo(
    () => headshotLookFor({ id, you: isYou, position, skin, kit }, yourPick),
    [id, isYou, position, skin, kit.shirt, kit.trim, kit.shorts, yourPick], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const key = headshotKey(id, look);
  const box = useRef<HTMLDivElement>(null);
  // a face made earlier this visit shows at once (no drawn head flashing first)
  const [shot, setShot] = useState<{ key: string; url: string | null; state: HeadshotState }>(() => {
    const mem = headshotFromMemory(key);
    return { key, url: mem, state: mem ? "ready" : "waiting" };
  });
  const cur = shot.key === key ? shot : { key, url: headshotFromMemory(key), state: (headshotFromMemory(key) ? "ready" : "waiting") as HeadshotState };

  useEffect(() => {
    if (cur.state === "ready") return;
    const el = box.current;
    if (!el) return;
    let dead = false;
    const ask = () => {
      void import("@/lib/star/headshot3d/maker").then(({ makeHeadshot }) => makeHeadshot(id, look)).then((url) => {
        if (!dead) setShot({ key, url, state: url ? "ready" : "failed" });
      }).catch(() => { if (!dead) setShot({ key, url: null, state: "failed" }); });
    };
    // made only as the card comes near the screen (a page of cards never asks for every face at once)
    if (typeof IntersectionObserver === "undefined") { ask(); return () => { dead = true; }; }
    const io = new IntersectionObserver((es) => {
      if (es.some((e) => e.isIntersecting)) { io.disconnect(); ask(); }
    }, { rootMargin: "240px" });
    io.observe(el);
    return () => { dead = true; io.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const view = headshotView(cur.state, cur.url);
  // the drawn head was up: the picture fades in over it (a face already made shows at once)
  const wasDrawn = useRef(false);
  if (view === "drawn") wasDrawn.current = true;
  return (
    <div ref={box} className={`relative shrink-0 overflow-hidden ${className ?? ""}`} style={{ width: size, height: size, ...style }}
      data-headshot={id} data-headshot-view={view}>
      {view === "picture" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={cur.url!} alt="" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full"
          onLoad={(e) => { if (wasDrawn.current) e.currentTarget.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: 180, easing: "ease-out" }); }}
          style={{ objectFit: "cover", transform: zoom !== 1 ? `scale(${zoom})` : undefined, transformOrigin: ZOOM_ORIGIN }} />
      ) : (
        <div className="absolute inset-0" style={{ transform: zoom !== 1 ? `scale(${zoom})` : undefined, transformOrigin: ZOOM_ORIGIN }}>
          {fallback ?? <DrawnHeadChip id={id} shirt={kit.shirt} shorts={kit.shorts ?? kit.trim} trim={kit.trim} size={size} />}
        </div>
      )}
    </div>
  );
}
