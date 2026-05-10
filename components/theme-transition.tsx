import { ReactNode, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useFluxColors } from '@/hooks/use-flux-colors';
import { useStore } from '@/lib/store';

const TRANSITION_MS = 150;

export function ThemeTransition({ children }: { children: ReactNode }) {
  const themeMode = useStore((s) => s.themeMode);
  const colors = useFluxColors();
  const opacity = useSharedValue(0);

  const prevTheme = useRef(themeMode);
  const prevBg = useRef(colors.bg);
  const [overlayBg, setOverlayBg] = useState(colors.bg);

  useEffect(() => {
    if (prevTheme.current !== themeMode) {
      setOverlayBg(prevBg.current);
      opacity.value = 1;
      opacity.value = withTiming(0, { duration: TRANSITION_MS });
      prevTheme.current = themeMode;
    }
    prevBg.current = colors.bg;
  }, [themeMode, colors.bg, opacity]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <View style={styles.root}>
      {children}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          { backgroundColor: overlayBg },
          overlayStyle,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
