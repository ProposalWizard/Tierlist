import type { ComponentType } from "react";
/** A screen gets its route's params. Each area (match, career, world…) lists its own screens. */
export type ScreenComp = ComponentType<{ params?: Record<string, unknown> }>;
export type ScreenMap = Record<string, ScreenComp>;
