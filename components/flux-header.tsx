import { usePathname, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { Fonts, Spacing, Typography } from '@/constants/theme';
import { useFluxColors } from '@/hooks/use-flux-colors';
import { playClick } from '@/lib/clicks';
import { useThemeStore } from '@/lib/theme-store';

import { ThemeToggle } from './theme-icon';

interface FluxHeaderProps {
  showBack?: boolean;
}

function ChevronLeft({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 256 256">
      <Path
        d="M160,208,80,128l80-80"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={20}
      />
    </Svg>
  );
}

function SearchIcon({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 256 256">
      <Path
        d="M112,192a80,80,0,1,1,80-80A80,80,0,0,1,112,192Z"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={20}
      />
      <Path
        d="M168,168l56,56"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={20}
      />
    </Svg>
  );
}

export function FluxHeader({ showBack = false }: FluxHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const colors = useFluxColors();
  const themeMode = useThemeStore((s) => s.themeMode);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const isDark = themeMode === 'dark';
  const atHome = pathname === '/' || pathname === '';

  const handleThemePress = () => {
    playClick('tick');
    toggleTheme();
  };

  const goHome = () => {
    if (!atHome && router.canGoBack()) {
      router.replace('/');
    }
  };

  return (
    <View
      style={[
        styles.header,
        {
          paddingTop: insets.top + Spacing.sm,
          backgroundColor: colors.bg,
          borderBottomColor: colors.border,
        },
      ]}>
      <View style={styles.left}>
        {showBack && (
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            style={({ pressed }) => [
              styles.backButton,
              pressed && { opacity: 0.5 },
            ]}>
            <ChevronLeft color={colors.text} />
          </Pressable>
        )}
        {atHome ? (
          <Text style={[styles.headerTitle, { color: colors.text }]}>flux</Text>
        ) : (
          <Pressable
            onPress={goHome}
            hitSlop={8}
            style={({ pressed }) => pressed && { opacity: 0.6 }}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>flux</Text>
          </Pressable>
        )}
      </View>
      <View style={styles.right}>
        {atHome && (
          <Pressable
            onPress={() => {
              playClick('open');
              router.push('/search');
            }}
            hitSlop={8}
            style={({ pressed }) => pressed && { opacity: 0.5 }}>
            <SearchIcon color={colors.text} />
          </Pressable>
        )}
        <ThemeToggle
          isDark={isDark}
          onPress={handleThemePress}
          color={colors.text}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.h,
    paddingBottom: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  backButton: {
    marginLeft: -4,
  },
  headerTitle: {
    fontFamily: Fonts?.mono ?? 'monospace',
    fontSize: Typography.title.fontSize,
    fontWeight: Typography.title.fontWeight,
  },
});
