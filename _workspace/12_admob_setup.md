# AdMob 설정 (0원의품격)

모바일 앱 광고는 **Google AdSense가 아니라 AdMob** 입니다.

## 코드 반영

- 하단 **배너 광고** (`AdBanner`) — 탭 바 위
- 개발 빌드: Google **테스트 광고** ID (`__DEV__` 시 TestIds.BANNER)
- Expo Go에서는 네이티브 모듈 미지원 → **EAS / dev client 빌드** 필요

## 1. AdMob 콘솔

1. [admob.google.com](https://admob.google.com) 로그인
2. **앱 추가** → Android `com.dobedub.zerowonpoomgyeok`, iOS `com.dobedub.zerowonpoomgyeok`
3. **광고 단위** → **배너** 생성 → 단위 ID 복사

## 2. `.env.local`

```env
EXPO_PUBLIC_ADMOB_ENABLED=true
EXPO_PUBLIC_ADMOB_ANDROID_BANNER_UNIT_ID=ca-app-pub-발급ID/배너단위ID
EXPO_PUBLIC_ADMOB_IOS_BANNER_UNIT_ID=ca-app-pub-발급ID/배너단위ID
```

`app.json` 플러그인의 **앱 ID**(`~` 포함)도 AdMob에서 발급한 값으로 교체:

```json
[
  "react-native-google-mobile-ads",
  {
    "androidAppId": "ca-app-pub-xxxxxxxx~xxxxxxxx",
    "iosAppId": "ca-app-pub-xxxxxxxx~xxxxxxxx"
  }
]
```

## 3. 빌드 (필수)

```bash
eas build --platform android --profile production
```

Expo Go로는 광고가 안 보입니다.

## 4. Play Console

- **앱 콘텐츠 → 광고** → **예, 앱에 광고가 있습니다**
- **데이터 보안** → 광고 ID / 광고 관련 항목 재검토

## 5. 비활성화

```env
EXPO_PUBLIC_ADMOB_ENABLED=false
```

## 6. 자주 하는 실수

| 잘못된 값 | 올바른 값 |
|-----------|-----------|
| `ca-app-pub-4061122570976810~5123687949` (앱 ID) | `ca-app-pub-4061122570976810/1234567890` (배너 단위 ID) |
| `ADMOB_ENABLED=false`인데 패키지만 링크됨 | `react-native.config.js`로 네이티브 autolink 제외 필요 (v11+) |

## 7. 앱 시작 직후 크래시

`react-native-google-mobile-ads`가 dependency에 있으면 AndroidManifest에 **앱 ID**가 반드시 필요합니다.

- `EXPO_PUBLIC_ADMOB_ENABLED=false` → 플러그인 + autolink 모두 꺼야 안전 (v11)
- `EXPO_PUBLIC_ADMOB_ENABLED=true` → `app.config.js` 플러그인에 `androidAppId` 필수

내부 테스트 배너: `ca-app-pub-3940256099942544/6300978111`
