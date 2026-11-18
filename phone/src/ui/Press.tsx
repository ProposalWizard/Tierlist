// A button that reacts the instant a finger lands: it shrinks on the phone's
// graphics thread (no wait for the game's code), and gives a small vibration.
import { type ReactNode } from "react";
import { Pressable, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

const AP = Animated.createAnimatedComponent(Pressable);

export function Press({ onPress, style, children, disabled }: {
  onPress?: () => void; style?: StyleProp<ViewStyle>; children: ReactNode; disabled?: boolean;
}) {
  const s = useSharedValue(1);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <AP disabled={disabled} style={[style, a, disabled && { opacity: 0.45 }]}
      onPressIn={() => { s.value = withTiming(0.95, { duration: 70 }); Haptics.selectionAsync().catch(() => {}); }}
      onPressOut={() => { s.value = withSpring(1, { damping: 14, stiffness: 320 }); }}
      onPress={onPress}>
      {children}
    </AP>
  );
}
