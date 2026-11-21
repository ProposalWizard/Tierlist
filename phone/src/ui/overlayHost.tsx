/**
 * Where every pop-up and sheet (`Modal`) is drawn: inside the app's own window,
 * above the screens (see src/rn.js for why). App.tsx mounts one.
 */
import type { ComponentType } from "react";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const own = require("react-native") as { __KibOverlayHost?: ComponentType };
export const OverlayHost: ComponentType = own.__KibOverlayHost ?? (() => null);
