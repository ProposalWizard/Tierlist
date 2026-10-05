"use client";

/**
 * THE MANAGER'S OFFICE — a 3D stage for the talks with your manager
 * (Harry, 5 Oct 2026: "Rebuild that office for the manager relationship
 * conversations").
 *
 * The signing's office (lib/star/signing3dScene.ts, `stage: "office"`) with
 * no contract on the desk, dressed as a working office. The manager sits
 * behind his desk; you sit across it. Whoever is speaking is the shot: over
 * your shoulder at him when he talks, over his at you when you do.
 *
 * It is only a stage: the words and the choices stay with the screen that
 * mounts it (BossChat.tsx — its rules and text are untouched). If the phone
 * can't run 3D it calls onFail and the screen just carries on without it.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { CareerState } from "@/lib/star/types";
import type { SigningManager, SigningSceneHandle, SigningYou } from "@/lib/star/signing3dScene";
import { kitsOf } from "@/lib/star/kits";
import { skinToneHex, resolveHairStyle, hairColourHex } from "@/lib/star/playerIdentity";
import { DEFAULT_FAKE_FACE } from "@/lib/star/fakeFaces";
import { fitImage, getFittedHead, type FittedHead } from "@/lib/star/faceFit";
import { managerLook } from "@/lib/star/managerFace";
import { AVIATORS_CARD, wornAccessories } from "@/lib/star/signing3d";
import { signing3dBlocker } from "./SigningScene3D";
import { SIGNATURE_D } from "./TrialReward";

export type OfficeSpeaker = "boss" | "you" | null;

export interface Office3DProps {
  you: SigningYou;
  manager: SigningManager;
  managerName: string;
  club: string;
  /** Who is talking now: the camera follows. */
  speaker: OfficeSpeaker;
  onFail?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export function managerFor(name: string): SigningManager {
  const look = managerLook(name);
  return {
    skin: look.skin, hairColour: look.hairColour, grey: look.grey, beard: look.beard !== "none",
    bald: look.hair === "bald", buzz: look.hair === "buzz" || look.hair === "receding" || look.hair === "ring",
  };
}

export default function Office3D({ you, manager, managerName, club, speaker, onFail, className, style }: Office3DProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const handle = useRef<SigningSceneHandle | null>(null);
  const [ready, setReady] = useState(false);
  const failRef = useRef(onFail);
  failRef.current = onFail;
  const youRef = useRef(you);
  youRef.current = you;

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    let disposed = false;
    const fail = (why: string) => {
      if (disposed) return;
      console.warn(`[3D office] not playing — ${why}`);
      failRef.current?.();
    };
    const blocker = signing3dBlocker();
    if (blocker) { fail(blocker); return () => { disposed = true; }; }
    (async () => {
      try {
        const { createSigningScene } = await import("@/lib/star/signing3dScene");
        const kit = youRef.current.kit;
        const h = await createSigningScene(el, {
          stage: "office",
          you: youRef.current, manager,
          contract: { club, playerName: "", managerName, rows: [], shirt: kit.shirt, trim: kit.trim },
          signaturePath: SIGNATURE_D,
        });
        if (disposed) { h.dispose(); return; }
        handle.current = h;
        (window as unknown as { __office3d?: SigningSceneHandle; __office3dReady?: boolean }).__office3d = h;
        (window as unknown as { __office3dReady?: boolean }).__office3dReady = true;
        setReady(true);
      } catch (e) {
        fail(`it threw while building: ${(e as Error)?.message ?? e}`);
      }
    })();
    return () => {
      disposed = true;
      handle.current?.dispose();
      handle.current = null;
      (window as unknown as { __office3dReady?: boolean }).__office3dReady = false;
    };
    // built once; the look changes through setYou
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The camera follows whoever is talking.
  useEffect(() => {
    const h = handle.current;
    if (!h || !ready) return;
    if (speaker === "you") h.setShot("reply");
    else h.setShot("talk");
    h.setTalking(speaker);
  }, [speaker, ready]);

  return (
    <div className={className} style={{ position: "relative", overflow: "hidden", background: "#1a120c", ...style }}>
      <div ref={wrap} style={{ position: "absolute", inset: 0 }} />
      {!ready && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,.7)", font: "800 12px system-ui" }}>
          Knocking on his door…
        </div>
      )}
    </div>
  );
}

/** The office with your career's look: your skin, face, hair, kit, accessories. */
export function Office3DCareer({ career, speaker, onFail, className, style }: {
  career: CareerState; speaker: OfficeSpeaker; onFail?: () => void; className?: string; style?: React.CSSProperties;
}) {
  const faceUrl = career.player.portrait ?? DEFAULT_FAKE_FACE;
  const [fitted, setFitted] = useState<FittedHead | null | undefined>(undefined);
  useEffect(() => {
    const img = fitImage(faceUrl);
    const done = () => setFitted(getFittedHead(faceUrl));
    if (img.complete && img.naturalWidth) { done(); return; }
    if (img.complete) { setFitted(null); return; }
    const slow = window.setTimeout(() => setFitted((f) => (f === undefined ? null : f)), 4000);
    const bad = () => setFitted(null);
    img.addEventListener("load", done, { once: true });
    img.addEventListener("error", bad, { once: true });
    return () => { window.clearTimeout(slow); img.removeEventListener("load", done); img.removeEventListener("error", bad); };
  }, [faceUrl]);
  const club = career.player.club;
  const kit = kitsOf(club, career.clubKits?.[club]).home;
  const you: SigningYou = useMemo(() => ({
    skin: skinToneHex(career.player.skinTone),
    face: fitted ?? null,
    accessories: wornAccessories(career.equippedAccessories),
    aviators: career.equippedRewards?.eyes === AVIATORS_CARD,
    kit,
    number: career.squadNumber ?? null,
    hairStyle: resolveHairStyle(career.player.hairStyle),
    hair: hairColourHex(career.player.hairColour),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [fitted, kit.shirt, kit.trim]);
  const name = career.manager?.name ?? "The manager";
  if (fitted === undefined) return <div className={className} style={{ background: "#1a120c", ...style }} />;
  return <Office3D you={you} manager={managerFor(name)} managerName={name} club={club} speaker={speaker} onFail={onFail} className={className} style={style} />;
}
