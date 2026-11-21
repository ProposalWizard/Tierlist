/**
 * ROOM FOR THE CAMERA CUT-OUT. The game is full screen (the status bar is hidden)
 * and draws under the punch-hole camera, so a picture fills the whole phone with
 * no dark band; words and buttons at the very top start below the camera.
 *
 *   <TopSpace min={44} />     first child of something pinned to the top: as tall
 *                             as the design's own gap (min), or the camera's
 *                             height plus `pad`, whichever is more
 *   useTop(44)                the same number, for a style
 */
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export function useTop(min: number, pad = 10): number {
  return Math.max(min, useSafeAreaInsets().top + pad);
}

export function TopSpace({ min, pad = 10 }: { min: number; pad?: number }) {
  return <View pointerEvents="none" style={{ height: useTop(min, pad) }} />;
}
