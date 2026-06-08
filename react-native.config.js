/**
 * AdMob 비활성 빌드에서는 네이티브 SDK를 링크하지 않습니다.
 * (패키지만 dependency에 있고 APPLICATION_ID가 없으면 앱 시작 직후 크래시)
 */
const admobEnabled = process.env.EXPO_PUBLIC_ADMOB_ENABLED === 'true';

module.exports = {
  dependencies: {
    'react-native-google-mobile-ads': admobEnabled
      ? {}
      : {
          platforms: {
            android: null,
            ios: null,
          },
        },
  },
};
