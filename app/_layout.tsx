import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { ThemeTransition } from '@/components/theme-transition';
import { useFluxColors } from '@/hooks/use-flux-colors';
import { initAudio } from '@/lib/clicks';
import { useStore } from '@/lib/store';

function StackHost() {
  const colors = useFluxColors();
  return (
    <View style={[styles.host, { backgroundColor: colors.bg }]}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      />
    </View>
  );
}

export default function RootLayout() {
  const themeMode = useStore((s) => s.themeMode);
  useEffect(() => {
    void initAudio();
  }, []);
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
