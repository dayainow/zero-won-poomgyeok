import { Platform } from 'react-native';

/** Google 공식 테스트 배너 — 내부 테스트·ID 미설정 시 fallback */
export const TEST_ANDROID_BANNER = 'ca-app-pub-3940256099942544/6300978111';
export const TEST_IOS_BANNER = 'ca-app-pub-3940256099942544/2934735716';

export const AD_BANNER_HEIGHT = 56;

export function isAdMobSupportedPlatform() {
  return Platform.OS === 'android' || Platform.OS === 'ios';
}

export function isAdMobEnabled() {
  if (!isAdMobSupportedPlatform()) {
    return false;
  }

  return process.env.EXPO_PUBLIC_ADMOB_ENABLED === 'true';
}

export function isValidBannerAdUnitId(unitId: string) {
  const normalized = unitId.trim();

  if (!normalized || normalized.includes('~')) {
    return false;
  }

  return /^ca-app-pub-\d+\/\d+$/.test(normalized);
}

export function getConfiguredBannerAdUnitId() {
  if (Platform.OS === 'android') {
    return process.env.EXPO_PUBLIC_ADMOB_ANDROID_BANNER_UNIT_ID?.trim() ?? '';
  }

  if (Platform.OS === 'ios') {
    return process.env.EXPO_PUBLIC_ADMOB_IOS_BANNER_UNIT_ID?.trim() ?? '';
  }

  return '';
}

export function getBannerAdUnitId() {
  const configured = getConfiguredBannerAdUnitId();

  if (isValidBannerAdUnitId(configured)) {
    return configured;
  }

  if (Platform.OS === 'ios') {
    return TEST_IOS_BANNER;
  }

  return TEST_ANDROID_BANNER;
}
