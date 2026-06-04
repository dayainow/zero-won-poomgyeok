# 실기기 E2E 체크리스트 (이슈 3)

Play Console 신원 확인 대기 중에 진행할 항목입니다.

## 자동 검증 (완료)

```bash
npm run smoke:prod
```

| 항목 | 결과 |
|------|------|
| GET /api/events | PASS |
| GET /api/events/{id}/reviews | PASS |
| POST /api/me/reviews (비로그인 401) | PASS |
| GET /privacy-policy.html | PASS |

로그인·후기 작성까지 자동 검증:

```bash
SMOKE_TEST_EMAIL=test1@poomgyeok.dev \
SMOKE_TEST_PASSWORD=비밀번호 \
EXPO_PUBLIC_SUPABASE_URL=https://ltppidunbaabyrzwyqcb.supabase.co \
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=... \
npm run smoke:prod
```

## EAS 프로덕션 빌드

- EAS production env: Supabase URL/Key 등록 완료
- 빌드 명령: `eas build --platform android --profile production`
- 완료 후 Expo 대시보드에서 `.aab` 다운로드
- **신원 확인 승인 후** Play Console 내부 테스트에 업로드

## 실기기 수동 체크 (15분)

새 `.aab`/APK 설치 후:

1. [ ] 앱 실행 → 온보딩/홈 피드 로딩
2. [ ] 지도 탭 → 지도 표시 (OSM 타일)
3. [ ] 이메일 로그인 (`test1@poomgyeok.dev`)
4. [ ] 행사 저장 → 저장함 탭 확인
5. [ ] 지도 `+` → 후기 작성 → 성공 모달
6. [ ] 행사 상세 → 후기 목록에 방금 작성한 후기
7. [ ] 설정 → 개인정보 처리 → 브라우저 방침 페이지
8. [ ] 앱 종료 후 재실행 → 로그인·저장·후기 유지

## 카카오 로그인 (프로덕션 빌드)

- Supabase Redirect URLs: `zero-won-poomgyeok://auth/callback`
- Expo Go용 `exp://` URI는 프로덕션 AAB에 불필요
- 카카오 Developers Redirect: `https://ltppidunbaabyrzwyqcb.supabase.co/auth/v1/callback`

## 계정 확인 후 Play Console

1. 앱 만들기 → 0원의품격
2. `_workspace/10_play_store_launch.md` 스토어 등록정보 붙여넣기
3. `.aab` 내부 테스트 업로드
4. 데이터 보안·콘텐츠 등급 설문
