import { Platform } from 'react-native';

// Single accent — the only color that matters
const PRIMARY = '#3553FF';

export interface FluxColorSet {
  bg: string;
  text: string;
  surface: string;
  muted: string;
  border: string;
  gradient: readonly string[];
}

export const FluxColors = {
  primary: PRIMARY,

  light: {
    bg: '#FFFFFF',
    text: '#0A0A0A',
    surface: '#F5F7FF',
    muted: '#9CA3AF',
    border: '#E5E7EB',
    gradient: [PRIMARY, '#6679FF', '#B3BDFF', '#E8EBFF', '#FFFFFF'] as const,
  },

  dark: {
    bg: '#0A0A0A',
    text: '#FFFFFF',
    surface: '#11132B',
    muted: '#6B7280',
    border: '#1F2937',
    gradient: [PRIMARY, '#1A2A8A', '#0F1554', '#0A0E2A', '#0A0A0A'] as const,
  },
};

export const Fonts = Platform.select({
  ios: {
    mono: 'SF Mono',
    serif: 'New York',
  },
  default: {
    mono: 'JetBrains Mono',
    serif: 'Noto Serif',
  },
});

export const Typography = {
  title: { fontSize: 20, fontWeight: '600' as const, lineHeight: 28 },
  label: { fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },
  meta: { fontSize: 12, fontWeight: '400' as const, lineHeight: 16 },
  body: { fontSize: 17, fontWeight: '400' as const, lineHeight: 27 }, // 17 * 1.6 ≈ 27
};

export const Spacing = {
  h: 24, // horizontal padding
  v: 20, // vertical item gap
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
};

export const Radii = {
  card: 12,
  button: 12,
};
