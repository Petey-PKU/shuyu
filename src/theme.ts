import { Platform } from 'react-native';

export const colors = {
  canvas: '#F4F1EA',
  surface: '#FCFAF6',
  surfaceStrong: '#FFFFFF',
  ink: '#171816',
  inkMuted: '#72746F',
  line: 'rgba(23,24,22,0.09)',
  accent: '#FF7043',
  accentSoft: '#FFE3D8',
  sage: '#839C86',
  sageSoft: '#DFE9DF',
  blue: '#6D89A7',
  night: '#171816',
  nightSurface: '#22231F',
  nightText: '#F5F1E8',
  danger: '#D95F59',
};

export const radii = {
  small: 12,
  medium: 18,
  large: 26,
  pill: 999,
};

export const shadows = {
  card: Platform.select({
    ios: {
      shadowColor: '#2A2C28',
      shadowOpacity: 0.08,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
    },
    android: { elevation: 3 },
    default: {},
  }),
};

export const typography = {
  serif: Platform.select({ ios: 'New York', android: 'serif', default: 'serif' }),
  sans: Platform.select({ ios: 'System', android: 'sans-serif', default: 'sans-serif' }),
};

export const bookAccents = ['#D76A43', '#4F7462', '#6F7FA2', '#8A6E92', '#B68A4D'];
