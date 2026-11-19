/**
 * THE LOOK'S PICTURES, copied from the website's public/ into
 * phone/assets/look (only the ones a screen uses; add a line here when a
 * screen needs another). Same files the packed app shows.
 */
import type { ImageSourcePropType } from "react-native";
import type { HomeSky } from "@/lib/star/kickoff";

/** The stadium seen from the pitch: the title screen (public/home/title-stadium-<sky>.webp, 752×1344). */
export const TITLE_STADIUM: Record<HomeSky, ImageSourcePropType> = {
  day: require("../../../assets/look/bg/title-stadium-day.webp"),
  sunset: require("../../../assets/look/bg/title-stadium-sunset.webp"),
  night: require("../../../assets/look/bg/title-stadium-night.webp"),
};
export const TITLE_STADIUM_ASPECT = 1344 / 752;

/** Home's picture: sky, stand, hoardings and the mown pitch (public/home/scene-<sky>.webp, 900×1609). */
export const HOME_SCENE: Record<HomeSky, ImageSourcePropType> = {
  day: require("../../../assets/look/bg/scene-day.webp"),
  sunset: require("../../../assets/look/bg/scene-sunset.webp"),
  night: require("../../../assets/look/bg/scene-night.webp"),
};
export const HOME_SCENE_ASPECT = 1609 / 900;
/** Where the grass meets the hoardings in each Home picture (0-1 down it), from HomeHub.tsx SCENE_LINE. */
export const HOME_SCENE_LINE: Record<HomeSky, number> = { day: 0.516, sunset: 0.49, night: 0.487 };

/**
 * The blurred day stadium behind Stats, League, Phone, Post-match (the glass
 * skin, glassLook.css 1: blur 12px, brightness .85, saturate 1.15). Blurred
 * ONCE when it was made (assets/look/bg/stadium-blur.webp, 376×672, 4 KB), so
 * the phone never blurs anything.
 */
export const STADIUM_BLUR: ImageSourcePropType = require("../../../assets/look/bg/stadium-blur.webp");

/** The 3D icons (public/icons3d) and other small pictures. */
export const ICON = {
  energy: require("../../../assets/look/icons/energy.png"),
  world: require("../../../assets/look/icons/world.png"),
  fame: require("../../../assets/look/icons/fame.png"),
  starFull: require("../../../assets/look/icons/star-full.png"),
  starEmpty: require("../../../assets/look/icons/star-empty.png"),
  /** The match's own ball (public/star/ball.webp). */
  ball: require("../../../assets/look/icons/ball.webp"),
  /** A boot (public/shop/boot-control-L1.webp): Home's Assists tile. */
  boot: require("../../../assets/look/icons/boot-control-L1.webp"),
} satisfies Record<string, ImageSourcePropType>;

/** The KIB cans (public/star/kib-<id>.webp, 271×650, transparent). */
export const CAN: Record<"basic" | "premium" | "elite", ImageSourcePropType> = {
  basic: require("../../../assets/look/icons/kib-basic.webp"),
  premium: require("../../../assets/look/icons/kib-premium.webp"),
  elite: require("../../../assets/look/icons/kib-elite.webp"),
};
