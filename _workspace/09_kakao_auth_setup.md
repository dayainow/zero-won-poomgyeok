# Kakao Login Setup (Supabase OAuth)

앱은 `signInWithKakao()` → Supabase `provider: 'kakao'` → 브라우저 OAuth → 딥링크 `zero-won-poomgyeok://auth/callback` 로 세션을 받습니다.

## 1. Kakao Developers

1. [developers.kakao.com](https://developers.kakao.com) → 앱 선택
2. **카카오 로그인** 활성화
3. **Redirect URI** 추가:
   - `https://<project-ref>.supabase.co/auth/v1/callback`
4. **REST API 키** 메모 (Supabase Client ID로 사용)
5. **Client Secret** 발급·활성화 (Supabase Client Secret)

## 2. Supabase Dashboard

1. **Authentication → Providers → Kakao** → Enable
2. Client ID = Kakao **REST API 키**
3. Client Secret = Kakao **Client Secret**
4. **Authentication → URL Configuration → Redirect URLs**에 추가:
   - `zero-won-poomgyeok://auth/callback`
   - Expo Go 개발 시: 앱 로그인 화면 하단에 표시되는 redirect URI도 함께 추가 (필요 시 `npx expo start` 후 `getKakaoRedirectUri()` 값 확인)

## 3. `.env.local`

```env
EXPO_PUBLIC_SUPABASE_URL=https://itppidunbaabyrzwyqcb.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

Project URL은 대시보드 **Settings → API** 값과 **글자 하나까지** 일치해야 합니다.

## 4. 앱 재시작

```bash
npm start
```

Expo Go / APK에서 **카카오로 시작하기** → 카카오 로그인 → 앱 복귀.

## Note

- 네이티브 Kakao SDK 대신 **OAuth 브라우저 방식**이라 Expo Go에서도 동작합니다.
- 프로덕션 APK는 `app.json`의 `scheme: zero-won-poomgyeok` 이 포함된 빌드가 필요합니다.
