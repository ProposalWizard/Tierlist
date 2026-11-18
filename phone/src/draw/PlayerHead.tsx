/**
 * <PlayerHead id shirt shorts trim size skin? round? />: A MAN'S DRAWN HEAD AND
 * SHOULDERS, IN HIS KIT — the website's team-sheet chip
 * (components/star/DrawnHeadChip.tsx), drawn by the same lib/star code
 * (fiveASide/render.ts `drawFigureAt`, the "3d" figure look) with the same
 * numbers. Photo faces are off on the website (PHOTO_FACES), so this is the
 * same drawn head the match draws on him: his own skin and hair from his id.
 *
 * Props (the website chip's, plus `round`)
 *   id      who he is (his hair and skin come from it): a player id or name
 *   shirt, shorts, trim   his kit colours (CSS colours)
 *   size    the square chip, in points
 *   skin    his own skin colour (your player's skinTone hex); absent = from his id
 *   round   clip to a circle, as the team sheets show it (default true)
 */
import { useCallback } from "react";
import { View } from "react-native";
import { Drawn } from "./useDrawing";
import { paintHeadChip } from "./figurePaint";

export function PlayerHead({ id, shirt, shorts, trim, size, skin, round = true }: {
  id: string; shirt: string; shorts: string; trim: string; size: number; skin?: string; round?: boolean;
}) {
  const draw = useCallback((g: CanvasRenderingContext2D) => paintHeadChip(g, { id, shirt, shorts, trim, size, skin }), [id, shirt, shorts, trim, size, skin]);
  return (
    <View style={{ width: size, height: size, borderRadius: round ? size / 2 : 0, overflow: "hidden" }}>
      <Drawn width={size} height={size} draw={draw} />
    </View>
  );
}
