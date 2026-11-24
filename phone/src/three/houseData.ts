/**
 * What your 3D house is built from, off a career: the website's `homeSceneData` and `livingFor`
 * (components/star/Home3D.tsx), the same fields the same way. No React and no phone-only imports,
 * so the headless check (tools/walk-check.ts --place house) builds the house from the very same code.
 */
import type { CareerState } from "@/lib/star/types";
import type { HomeData } from "@/lib/star/home3d/scene";
import { homeTierOf, roomPreset, cabinetSize, roomsFor, livingOn, type HomeTier } from "@/lib/star/home3d/homes";
import { homeStuffOf, carsIn, BIKE_LOD } from "@/lib/star/home3d/rooms";
import { houseLook, type HouseLook } from "@/lib/star/home3d/look";
import { cabinetSlots } from "@/lib/star/home3d/trophies";
import { CASUAL_SETS, wornAt, bootChoices, carsOnDrive, type OutfitChoice } from "@/lib/star/home3d/outfits";
import { sleepNight } from "@/lib/star/home3d/sleep";
import { kitsOf } from "@/lib/star/kits";
import { badgeSvg } from "@/lib/star/clubBadge";
import { skinToneHex, resolveHairStyle, hairColourHex } from "@/lib/star/playerIdentity";
import type { HouseData } from "./houseScene";

type HouseCareer = Pick<CareerState, "player" | "squadNumber" | "currentBoot" | "ownedItems" | "trophies" | "awards" | "ballonDorWins" | "squad"> & Partial<Pick<CareerState, "kibCans" | "horse">>;

/** The home you own (a starter flat before you buy one) and whether its rooms are alive (things you use, team-mates round). */
export function houseKind(career: Pick<CareerState, "ownedItems">, tier?: HomeTier, house?: HouseLook, living?: boolean) {
  const t: HomeTier = tier ?? homeTierOf(career.ownedItems);
  const look = house ?? houseLook();
  const alive = livingOn(t, living) && look === "new";
  return { tier: t, look, alive, rooms: roomsFor(t, look, alive) };
}

/** What the 3D house is built from (the website's homeSceneData). */
export function homeSceneData(career: HouseCareer, tier: HomeTier, house: HouseLook | undefined, choice: OutfitChoice, living?: boolean): HomeData {
  const room = roomPreset(tier);
  const rooms = roomsFor(tier, house ?? houseLook(), livingOn(tier, living));
  const stuff = homeStuffOf(career);
  return {
    tier,
    kits: kitsOf(career.player.club),
    number: career.squadNumber ?? 10,
    worn: wornAt({ outfit: choice, currentBoot: career.currentBoot }, "home"),
    skin: skinToneHex(career.player.skinTone),
    hair: hairColourHex(career.player.hairColour),
    hairStyle: resolveHairStyle(career.player.hairStyle),
    slots: cabinetSlots(career, cabinetSize(tier)),
    cars: carsOnDrive(career, Math.max(room.cars, rooms.includes("garage") ? carsIn("garage", tier) : 0)),
    boots: bootChoices(career),
    casual: CASUAL_SETS,
    rooms,
    stuff,
    bikeModel: stuff.bike ? BIKE_LOD : null,
    club: career.player.club,
    badge: badgeSvg(career.player.club, "home-cinema"),
  };
}

/** Who drops round (the first outfield team-mates of your squad). */
function mates(career: HouseCareer) {
  return (career.squad ?? []).filter((p) => p.position !== "GK").slice(0, 4).map((p, i) => ({ id: p.id, name: p.shortName || p.name, number: [8, 14, 21, 6][i] }));
}

/**
 * The whole of what the house's scene is started with. `sleep` reads the career as it is when you
 * fall asleep (sleep.ts is pure: the screen's setCareer gets the same result) and says what the card says.
 */
export function houseSceneData(
  career: HouseCareer & Pick<CareerState, "outfit" | "lastSleep" | "season" | "week">,
  choice: OutfitChoice,
  opts: { pov?: boolean; tier?: HomeTier; house?: HouseLook; living?: boolean; sleep?: () => { rested: boolean; text: string } | null; onSleep?: () => void; fixedStep?: number } = {},
): HouseData & { tier: HomeTier; alive: boolean } {
  const k = houseKind(career, opts.tier, opts.house, opts.living);
  return {
    tier: k.tier,
    alive: k.alive,
    home: homeSceneData(career, k.tier, opts.house, choice, k.alive),
    pov: opts.pov,
    fixedStep: opts.fixedStep,
    ...(k.alive ? {
      living: {
        mates: mates(career), club: career.player.club,
        onSleep: () => {
          const r = opts.sleep ? opts.sleep() : sleepNight(career as CareerState);
          if (r && r.rested) opts.onSleep?.();
          return opts.onSleep ? (r?.text ?? "A good night.") : "A good night.";
        },
      },
    } : {}),
  };
}
