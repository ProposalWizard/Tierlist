/**
 * What the 3D signing and the manager's office are built from, off a career: the website's
 * SigningScene3DCareer.tsx and Office3D.tsx (`Office3DCareer`, `managerFor`), the same fields the same way.
 * No React and no phone-only imports, so the headless check (tools/signing-check.ts) builds the room from the
 * very same code the screens use.
 *
 * Not carried over: the fitted face picture (the website fetches your photo and fits it to the 3D head; photo faces
 * are off for the whole game, PHOTO_FACES, so every head is the drawn one) and the 3D Scene Editor's approved edits
 * (the career never passes one on the website either, unless an admin approved it there).
 */
import type { CareerState } from "@/lib/star/types";
import type { SigningManager, SigningYou } from "@/lib/star/signing3dScene";
import { kitsOf } from "@/lib/star/kits";
import { skinToneHex, resolveHairStyle, hairColourHex } from "@/lib/star/playerIdentity";
import { managerLook } from "@/lib/star/managerFace";
import { AVIATORS_CARD, contractRows, signingLines, wornAccessories, type SigningLine } from "@/lib/star/signing3d";
import type { SigningData } from "./signingScene";

/** The hand-written name (components/star/TrialReward.tsx SIGNATURE_D), an SVG path in a 300 x 60 box. */
export const SIGNATURE_D = "M12 44 C 26 12, 38 12, 44 30 C 50 48, 58 48, 66 26 C 72 10, 84 14, 86 34 C 88 50, 100 48, 108 32 C 116 16, 130 18, 132 36 C 134 52, 148 50, 158 30 C 168 10, 184 14, 190 32 C 196 50, 212 48, 224 30 C 234 16, 250 16, 262 34 C 268 43, 278 46, 288 40";

export interface SigningTerms { wage?: number; seasonsRemaining?: number; position?: string; season?: string | null }

/** Office3D.tsx `managerFor`: the manager's look, the scene's shape. */
export function managerFor(name: string): SigningManager {
  const look = managerLook(name);
  return {
    skin: look.skin, hairColour: look.hairColour, grey: look.grey, beard: look.beard !== "none",
    bald: look.hair === "bald", buzz: look.hair === "buzz" || look.hair === "receding" || look.hair === "ring",
  };
}

/** You, as the scene dresses you: your skin, hair, club kit, shirt number, accessories and the Star Pass aviators. */
export function youFor(career: CareerState, club: string, number: number | null): SigningYou {
  const kit = kitsOf(club, career.clubKits?.[club]).home;
  return {
    skin: skinToneHex(career.player.skinTone),
    face: null, // photo faces are off: the drawn head
    accessories: wornAccessories(career.equippedAccessories),
    aviators: career.equippedRewards?.eyes === AVIATORS_CARD,
    kit,
    number,
    hairStyle: resolveHairStyle(career.player.hairStyle),
    hair: hairColourHex(career.player.hairColour),
  };
}

export interface SigningPlan {
  data: SigningData;
  lines: SigningLine[];
  title: string;
  club: string;
  managerName: string;
}

/** The signing (SigningScene3DCareer.tsx): the first contract after the trial (`trial`) or a move to a new club (`transfer`: no shirt number yet). */
export function signingPlan(career: CareerState, club: string, managerName: string, o: { kind?: "trial" | "transfer"; terms?: SigningTerms; number?: number | null } = {}): SigningPlan {
  const kind = o.kind ?? "trial";
  const c = career.contract;
  const seasons = o.terms?.seasonsRemaining ?? c?.seasonsRemaining;
  const number = o.number !== undefined ? o.number : (kind === "transfer" ? null : career.squadNumber ?? null);
  const you = youFor(career, club, number);
  const contract = {
    club, playerName: `${career.player.firstName} ${career.player.lastName}`, managerName, shirt: you.kit.shirt, trim: you.kit.trim,
    rows: contractRows({ seasons, wage: o.terms?.wage ?? c?.wage, number, position: o.terms?.position ?? career.player.position, season: o.terms?.season ?? null }),
  };
  return {
    data: { stage: "signing", you, manager: managerFor(managerName), contract, signaturePath: SIGNATURE_D },
    lines: signingLines({ seasons, number, kind }),
    title: `Signing for ${club}`,
    club, managerName,
  };
}

/** The manager's office (Office3D.tsx `Office3DCareer`): the signing's room with no contract on the desk. */
export function officeData(career: CareerState): SigningData {
  const club = career.player.club;
  const you = youFor(career, club, career.squadNumber ?? null);
  const name = career.manager?.name ?? "The manager";
  return {
    stage: "office", you, manager: managerFor(name),
    contract: { club, playerName: "", managerName: name, rows: [], shirt: you.kit.shirt, trim: you.kit.trim },
    signaturePath: SIGNATURE_D,
  };
}
