// Every screen in the app, by name. One line per area.
import type { ScreenMap } from "./types";
import { coreScreens } from "./core";
import { matchScreens } from "./match";
import { artScreens } from "./art";
export const SCREENS: ScreenMap = { ...coreScreens, ...matchScreens, ...artScreens };
