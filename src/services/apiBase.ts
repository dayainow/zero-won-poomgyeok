import { Platform } from 'react-native';

const appApiBaseUrl = process.env.EXPO_PUBLIC_APP_URL;

/** 웹은 상대 경로, 네이티브는 EXPO_PUBLIC_APP_URL 기준 절대 URL */
export function getAppApiUrl(path: string) {
  if (Platform.OS === 'web') {
    return path;
  }

  if (!appApiBaseUrl) {
    throw new Error(
      '모바일 런타임에서는 EXPO_PUBLIC_APP_URL이 필요합니다. 예: https://your-vercel-domain.vercel.app',
    );
  }

  return `${appApiBaseUrl.replace(/\/$/, '')}${path}`;
}
