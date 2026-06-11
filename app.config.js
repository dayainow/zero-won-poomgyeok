const admobEnabled = process.env.EXPO_PUBLIC_ADMOB_ENABLED === 'true';
const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? '';

/** @type {import('expo/config').ExpoConfig['plugins']} */
const plugins = [
  'expo-web-browser',
  'expo-font',
  [
    'expo-image-picker',
    {
      photosPermission:
        '프로필 사진으로 사용할 이미지를 선택하기 위해 사진 접근 권한이 필요합니다.',
    },
  ],
];

if (admobEnabled) {
  plugins.push([
    'react-native-google-mobile-ads',
    {
      androidAppId: 'ca-app-pub-4061122570976810~5123687949',
      iosAppId: 'ca-app-pub-3940256099942544~1458002511',
      delayAppMeasurementInit: true,
      optimizeInitialization: false,
      optimizeAdLoading: false,
    },
  ]);
}

/** @type {import('expo/config').ExpoConfig} */
module.exports = {
  expo: {
    name: '0원의품격',
    slug: 'zero-won-poomgyeok',
    scheme: 'zero-won-poomgyeok',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon-v2.png',
    userInterfaceStyle: 'light',
    newArchEnabled: true,
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#F7F8FB',
    },
    ios: {
      bundleIdentifier: 'com.ola.zerowonpoomgyeok',
      supportsTablet: true,
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          '가까운 무료 문화공간과 도서관을 거리순으로 보여주기 위해 현재 위치를 사용합니다.',
      },
      ...(googleMapsApiKey ? { config: { googleMapsApiKey } } : {}),
    },
    android: {
      package: 'com.ola.zerowonpoomgyeok',
      versionCode: 5,
      permissions: ['ACCESS_COARSE_LOCATION', 'ACCESS_FINE_LOCATION'],
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon-v2.png',
        backgroundColor: '#EAF6FF',
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      ...(googleMapsApiKey
        ? { config: { googleMaps: { apiKey: googleMapsApiKey } } }
        : {}),
    },
    web: {
      favicon: './assets/favicon.png',
    },
    plugins,
    extra: {
      eas: {
        projectId: 'ea4a9552-a81d-4317-96eb-4ab3bb9b7e5f',
      },
    },
    owner: 'dayainow',
  },
};
