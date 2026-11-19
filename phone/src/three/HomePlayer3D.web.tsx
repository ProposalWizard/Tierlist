/**
 * WEB ONLY (the look check, phone/tools/look). The Android app never reads this
 * file: on a phone `./HomePlayer3D` is HomePlayer3D.tsx, the live 3D player.
 *
 * In a browser the phone's 3D (expo-gl + three loaded in parts) does not start,
 * so Home and the title show the drawn figure, which is what the phone itself
 * shows when 3D can't start. The look check's sheets say so.
 */
import type { ReactNode } from "react";
import type { CareerState } from "@/lib/star/types";

export const IDLE_MS = 6000;
export const MAX_PIXEL_RATIO = 2;
export const home3dStats = { frames: 0, jsMs: [] as number[], calls: 0, triangles: 0, buildMs: 0, firstMs: 0 };

export function HomePlayer3D({ fallback }: {
  career: CareerState; width: number; height: number; where: "home" | "title"; kitShirt: string; kitTrim: string; fallback: ReactNode;
}) {
  return <>{fallback}</>;
}
