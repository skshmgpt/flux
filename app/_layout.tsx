import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { InteractionManager, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { ThemeTransition } from '@/components/theme-transition';
import { useFluxColors } from '@/hooks/use-flux-colors';
import { useArticleStore } from '@/lib/article-store';
import { initAudio } from '@/lib/clicks';
import { useStore } from '@/lib/store';
import { useThemeStore } from '@/lib/theme-store';

function StackHost() {
  const colors = useFluxColors();
  return (
    <View style={[styles.host, { backgroundColor: colors.bg }]}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
        }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="feed/[url]" />
        <Stack.Screen name="article/[url]" />
      </Stack>
    </View>
  );
}

export default function RootLayout() {
  const themeMode = useThemeStore((s) => s.themeMode);
  const feedsHydrated = useStore((s) => s.isHydrated);
  const articlesHydrated = useArticleStore((s) => s.isHydrated);
  const refreshAllFeeds = useStore((s) => s.refreshAllFeeds);
  const didRefresh = useRef(false);

  useEffect(() => {
    void initAudio();
    void useArticleStore.getState().hydrate();
  }, []);

  useEffect(() => {
    if (feedsHydrated && articlesHydrated && !didRefresh.current) {
      didRefresh.current = true;
      // Wait until the first frames have painted before doing any feed work,
      // so the home list renders immediately on cold launch.
      InteractionManager.runAfterInteractions(() => {
        refreshAllFeeds();
      });
    }
  }, [feedsHydrated, articlesHydrated, refreshAllFeeds]);

  return (
    <SafeAreaProvider>
      <ThemeTransition>
        <StackHost />
      </ThemeTransition>
      <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  host: { flex: 1 },
});
