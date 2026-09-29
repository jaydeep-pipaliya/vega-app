import {Platform, Dimensions} from 'react-native';

export const isTV = Platform.isTV;
export const isAndroidTV = Platform.OS === 'android' && Platform.isTV;
export const isTVOS = Platform.OS === 'ios' && Platform.isTV;

export const {width: SCREEN_WIDTH, height: SCREEN_HEIGHT} = Dimensions.get('window');

export const TV_FOCUS_SCALE = 1.08;
export const TV_FOCUS_BORDER_WIDTH = 3;
export const TV_FOCUS_ANIMATION_DURATION = 150;

export const TV_POSTER_WIDTH = isTV ? 180 : 100;
export const TV_POSTER_HEIGHT = isTV ? 270 : 150;

export const TV_CARD_WIDTH = isTV ? 200 : 120;
export const TV_CARD_HEIGHT = isTV ? 300 : 180;
export const TV_CARD_MARGIN = isTV ? 16 : 8;

export const TV_HERO_HEIGHT = isTV ? '45vh' : '55vh';

export const TV_FONT_SIZES = {
  title: isTV ? 32 : 24,
  subtitle: isTV ? 20 : 16,
  body: isTV ? 18 : 14,
  small: isTV ? 16 : 12,
};

export const TV_SPACING = {
  xs: isTV ? 8 : 4,
  sm: isTV ? 12 : 8,
  md: isTV ? 20 : 12,
  lg: isTV ? 32 : 20,
  xl: isTV ? 48 : 32,
};

export const TV_REMOTE_KEYS = {
  SELECT: 'select',
  PLAY_PAUSE: 'playPause',
  MENU: 'menu',
  LEFT: 'left',
  RIGHT: 'right',
  UP: 'up',
  DOWN: 'down',
  BACK: 'back',
} as const;
