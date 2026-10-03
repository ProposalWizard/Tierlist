"use client";

/**
 * The 3D signing, played inside a career (Settings → "3D signing scene
 * (beta)"). Everything comes off the save: your skin tone, your face picture
 * (or the default fake face), your equipped accessories and Star Pass
 * aviators, the club's kit, the shirt number, the seasons and the wage.
 * Whoever plays sees themself.
 */
import { useEffect, useMemo, useState } from "react";
import type { CareerState } from "@/lib/star/types";
import { kitsOf } from "@/lib/star/kits";
import { skinToneHex, resolveHairStyle, hairColourHex } from "@/lib/star/playerIdentity";
import { DEFAULT_FAKE_FACE } from "@/lib/star/fakeFaces";
import { fitImage, getFittedHead, type FittedHead } from "@/lib/star/faceFit";
import { managerLook } from "@/lib/star/managerFace";
import { AVIATORS_CARD, contractRows, signingLines, wornAccessories } from "@/lib/star/signing3d";
import type { SigningYou } from "@/lib/star/signing3dScene";
import SigningScene3D from "./SigningScene3D";
import { useScannedPortrait } from "./useScannedPortrait";
import type { ContractTerms } from "./TrialReward";

export default function SigningScene3DCareer({
  career, club, playerName, managerName, terms, onDone, onFail, kind = "trial",
}: {
  career: CareerState;
  club: string;
  playerName: string;
  managerName: string;
  terms?: ContractTerms;
  onDone: () => void;
  /** The 3D could not start: show the drawn signing instead. */
  onFail: () => void;
  /** The first contract after the trial, or a move to a new club later. A
   *  move has no new shirt number yet, and the manager talks about your
   *  play, not a trial. */
  kind?: "trial" | "transfer";
}) {
  const scanned = useScannedPortrait(career.player.portrait);
  const faceUrl = scanned ?? career.player.portrait ?? DEFAULT_FAKE_FACE;
  const [fitted, setFitted] = useState<FittedHead | null | undefined>(undefined);
  useEffect(() => {
    const img = fitImage(faceUrl);
    const done = () => setFitted(getFittedHead(faceUrl));
    if (img.complete && img.naturalWidth) { done(); return; }
    const fail = () => setFitted(null);
    // The picture is cached: one that already FAILED is "complete" with no
    // width and will never fire another event — waiting for it left a blank
    // screen with no Skip, for good. Go on without the face instead, and
    // never wait more than a few seconds for one that is slow.
    if (img.complete) { fail(); return; }
    const slow = window.setTimeout(() => setFitted((f) => (f === undefined ? null : f)), 4000);
    img.addEventListener("load", done, { once: true });
    img.addEventListener("error", fail, { once: true });
    return () => { window.clearTimeout(slow); img.removeEventListener("load", done); img.removeEventListener("error", fail); };
  }, [faceUrl]);

  const kit = kitsOf(club, career.clubKits?.[club]).home;
  const c = career.contract;
  const seasons = terms?.seasons ?? c?.seasonsRemaining;
  const number = terms?.squadNumber ?? (kind === "transfer" ? null : career.squadNumber ?? null);

  const you: SigningYou = useMemo(() => ({
    skin: skinToneHex(career.player.skinTone),
    face: fitted ?? null,
    accessories: wornAccessories(career.equippedAccessories),
    aviators: career.equippedRewards?.eyes === AVIATORS_CARD,
    kit,
    number,
    hairStyle: resolveHairStyle(career.player.hairStyle),
    hair: hairColourHex(career.player.hairColour),
  }), [career.player.skinTone, career.player.hairStyle, career.player.hairColour, fitted, career.equippedAccessories, career.equippedRewards, kit, number]);

  const look = managerLook(managerName);
  const manager = {
    skin: look.skin, hairColour: look.hairColour, grey: look.grey, beard: look.beard !== "none",
    bald: look.hair === "bald", buzz: look.hair === "buzz" || look.hair === "receding" || look.hair === "ring",
  };
  const contract = {
    club, playerName, managerName, shirt: kit.shirt, trim: kit.trim,
    rows: contractRows({
      seasons, wage: terms?.wage ?? c?.wage, number,
      position: terms?.position ?? career.player.position, season: terms?.season ?? null,
    }),
  };

  // Wait for the face (or for it to fail) so the scene builds once.
  if (fitted === undefined) {
    return <div style={{ position: "fixed", inset: 0, background: "#120c08" }} />;
  }
  return (
    <SigningScene3D
      you={you}
      manager={manager}
      contract={contract}
      lines={signingLines({ seasons, number, kind })}
      title={`Signing for ${club}`}
      onDone={onDone}
      onFail={onFail}
    />
  );
}
