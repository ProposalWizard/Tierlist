// Every screen in the app, by name. One line per area.
import type { ScreenMap } from "./types";
import { coreScreens } from "./core";
import { matchScreens } from "./match";
import { worldScreens } from "./world";
import { careerScreens } from "./career";
import { artScreens } from "./art";
import { glueScreens } from "./glue";
export const SCREENS: ScreenMap = { ...coreScreens, ...matchScreens, ...careerScreens, ...worldScreens, ...artScreens, ...glueScreens };
