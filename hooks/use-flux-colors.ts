import { FluxColors } from '@/constants/theme';
import { useStore } from '@/lib/store';

export function useFluxColors() {
  const themeMode = useStore((s) => s.themeMode);
  return themeMode === 'dark' ? FluxColors.dark : FluxColors.light;
}
