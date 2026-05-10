import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

interface IconProps {
  color: string;
  size?: number;
}

function SunIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 256 256">
      <Rect width={256} height={256} fill="none" />
      <Line
        x1={128}
        y1={40}
        x2={128}
        y2={16}
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={16}
      />
      <Circle
        cx={128}
        cy={128}
        r={56}
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={16}
      />
      <Line
        x1={64}
        y1={64}
        x2={48}
        y2={48}
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={16}
      />
      <Line
        x1={64}
        y1={192}
        x2={48}
        y2={208}
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={16}
      />
      <Line
        x1={192}
        y1={64}
        x2={208}
        y2={48}
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={16}
      />
      <Line
        x1={192}
        y1={192}
        x2={208}
        y2={208}
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={16}
      />
      <Line
        x1={40}
        y1={128}
        x2={16}
        y2={128}
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={16}
      />
      <Line
        x1={128}
        y1={216}
        x2={128}
        y2={240}
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={16}
      />
      <Line
        x1={216}
        y1={128}
        x2={240}
        y2={128}
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={16}
      />
    </Svg>
  );
}

function MoonIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 256 256">
      <Rect width={256} height={256} fill="none" />
      <Path
        d="M108.11,28.11A96.09,96.09,0,0,0,227.89,147.89,96,96,0,1,1,108.11,28.11Z"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={16}
      />
    </Svg>
  );
}

interface ThemeToggleProps {
  isDark: boolean;
  onPress: () => void;
  color: string;
  size?: number;
}

const TRANSITION_MS = 150;

export function ThemeToggle({ isDark, onPress, color, size = 22 }: ThemeToggleProps) {
  const progress = useSharedValue(isDark ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(isDark ? 1 : 0, { duration: TRANSITION_MS });
  }, [isDark, progress]);

  const sunStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const visibility = Math.max(0, 1 - p * 2);
    const bloom = 1 - Math.abs(0.5 - p) * 2;
    return {
      opacity: visibility,
      transform: [
        { scale: 1 + bloom * 0.35 },
        { rotate: `${p * 90}deg` },
      ],
    };
  });

  const moonStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const visibility = Math.max(0, p * 2 - 1);
    const bloom = 1 - Math.abs(0.5 - p) * 2;
    return {
      opacity: visibility,
      transform: [
        { scale: 1 + bloom * 0.35 },
        { rotate: `${(p - 1) * 90}deg` },
      ],
    };
  });

  return (
    <Pressable
      onPress={onPress}
      hitSlop={12}
      style={({ pressed }) => [
        styles.button,
        { width: size + 16, height: size + 16 },
        pressed && { opacity: 0.6 },
      ]}>
      <View style={{ width: size, height: size }}>
        <Animated.View style={[styles.iconLayer, sunStyle]}>
          <SunIcon color={color} size={size} />
        </Animated.View>
        <Animated.View style={[styles.iconLayer, moonStyle]}>
          <MoonIcon color={color} size={size} />
        </Animated.View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
