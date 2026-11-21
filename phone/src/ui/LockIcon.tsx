/**
 * The website's drawn padlock (components/star/UnlockChain.tsx LockIcon: a 15×10
 * body with a rounded shackle, in a 24 box, stroke 2.4). Drawn with views, never the
 * 🔒 emoji where the website draws it: Samsung's emoji is a different, yellow lock.
 *   <LockIcon size={14} color="rgba(255,255,255,0.8)" />
 */
import { View } from "react-native";

export function LockIcon({ size = 14, color = "rgba(255,255,255,0.8)", fill = "rgba(255,255,255,0.2)" }: { size?: number; color?: string; fill?: string }) {
  const u = size / 24, sw = Math.max(1, 2.4 * u);
  return (
    <View style={{ width: size, height: size }}>
      <View style={{ position: "absolute", left: 8 * u - sw / 2, top: 3.5 * u - sw / 2, width: 8 * u + sw, height: 9 * u, borderTopLeftRadius: 4 * u + sw / 2, borderTopRightRadius: 4 * u + sw / 2, borderWidth: sw, borderBottomWidth: 0, borderColor: color }} />
      <View style={{ position: "absolute", left: 4.5 * u - sw / 2, top: 10.5 * u - sw / 2, width: 15 * u + sw, height: 10 * u + sw, borderRadius: 2.5 * u + sw / 2, borderWidth: sw, borderColor: color, backgroundColor: fill }} />
    </View>
  );
}
