import { Platform } from 'react-native';

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export const DESKTOP_APP_MAX_WIDTH = 560;

export function getLayoutMetrics(width: number, height: number) {
  const effectiveWidth = Platform.OS === 'web' && width >= 900 ? Math.min(width, DESKTOP_APP_MAX_WIDTH) : width;
  const horizontalFrame = clamp(effectiveWidth * 0.055, 16, 28);
  const contentWidth = effectiveWidth - horizontalFrame * 2;

  return {
    horizontalFrame,
    contentWidth,
    tightGap: clamp(height * 0.012, 6, 10),
    stackGap: clamp(height * 0.024, 12, 22),
    sectionGap: clamp(height * 0.05, 24, 42),
    headerTopGap: clamp(height * 0.022, 12, 22),
    headerMinHeight: clamp(height * 0.085, 58, 86),
    heroHeight: clamp(height * 0.22, 170, 250),
    secondaryZoneHeight: clamp(height * 0.1, 68, 96),
    standardCardMinHeight: clamp(height * 0.115, 84, 122),
    compactRowMinHeight: clamp(height * 0.08, 62, 86),
    bottomNavHeight: clamp(height * 0.09, 68, 84),
    stickyBottomSpace: clamp(height * 0.11, 92, 118),
    immersiveHeroHeight: clamp(height * 0.45, 320, 460),
    bottomControlHeight: clamp(height * 0.09, 72, 92),
    emptyStateMinHeight: clamp(height * 0.2, 150, 220),
  };
}
