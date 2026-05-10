import { FluxColors } from '@/constants/theme';
import { useThemeStore } from '@/lib/theme-store';

export function useFluxColors() {
  const themeMode = useThemeStore((s) => s.themeMode);
  return themeMode === 'dark' ? FluxColors.dark : FluxColors.light;
}
