// CANARY (clean) — reading CanvasMatch's props as a TYPE is not mounting it.
// The guard must NOT flag this. See README.md.
import type { ComponentProps } from "react";
import type CanvasMatch from "@/components/star/CanvasMatch";
export type CanaryMatchProps = ComponentProps<typeof CanvasMatch>;
