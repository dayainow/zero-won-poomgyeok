# v32 QA Report

검증일: 2026-06-15 / qa: orchestrator 직접 수행

## 실행 명령 / 결과
| 명령 | 결과 |
|------|------|
| `npm run typecheck` (tsc --noEmit) | ✅ PASS (에러 0) |
| `npm run build` (expo web export) | ✅ PASS (dist 생성) |

## 계약 정합성 교차검증
- ReviewItem shape: 백엔드 `toPublicReview`(likeCount, likedByViewer) ↔ 프론트 `reviewApi.ts ReviewItem`(likeCount:number, likedByViewer:boolean) **일치**.
- `loadEventReviews(eventId, {limit,offset,sort})` → `{reviews, hasMore}` ↔ 백엔드 `GET /api/events/[id]/reviews` 응답 **일치**.
- 좋아요: 프론트 `likeReview`(POST)/`unlikeReview`(DELETE) → `/api/me/review-likes` ↔ vercel.json rewrite → `api/me/reviews.ts` resource=likes 분기(POST 201 / DELETE 200) **일치**. Allow=`GET, POST, DELETE`.
- 인증: 좋아요 미인증 → 백엔드 401; 프론트는 상단 `if(!isSignedIn) openAuthGate` 선차단 + catch UNAUTHORIZED 폴백 **이중 가드**.
- Vercel 함수 수: **12/12 유지**(신규 함수 파일 0, rewrite 통합).

## 기능별 점검
- **피드 무한스크롤**: ScrollView→FlatList(numColumns=3, columnWrapperStyle gap), `slice(0,9)` 제거, visibleCount 12씩 onEndReached 증가, ListFooter 로딩 인디케이터, ListEmpty 유지. RefreshControl은 원래 미사용 → 회귀 없음.
- **후기 전체보기+정렬**: overlay 'reviews' 신규, 정렬 탭(recent/rating/likes), 더보기 offset + hasMore 종료. 상세 미리보기 3개 유지.
- **좋아요**: 낙관적 토글 + 서버 카운트 동기화 + 실패 롤백.
- **Sentry**: app.config.js plugin 추가, App.tsx DSN env 가드 init + `Sentry.wrap`(DSN 없으면 원본 반환=no-op). 서버 observability.ts `SENTRY_DSN` 가드 + 5xx captureException.

## 남은 위험 (실기기/운영)
1. **시각 회귀 미검증**: FlatList 3열 그리드 간격/광고배너 패딩은 코드상 재현했으나 실기기 렌더는 미확인(이 환경에서 디바이스 구동 불가). v32 AAB 설치 후 홈 피드 그리드/스크롤 수동 확인 권장.
2. **likes 정렬 500건 스캔 캡**: 한 이벤트 후기가 500건 초과 시 좋아요순 페이지네이션 정확도 저하(현 규모 무방).
3. **DB 마이그레이션 미적용**: `2026061501_review_likes.sql`는 코드만 추가. 좋아요 기능 동작 전 `supabase db push` 또는 콘솔에서 실행 필요. **미적용 시 좋아요 API 500**.
4. **Sentry DSN 미설정 시 수집 안 됨**(no-op). 운영 활성화하려면 `EXPO_PUBLIC_SENTRY_DSN`(앱 빌드), `SENTRY_DSN`(Vercel) 등록.
5. **Sentry 네이티브 심볼리케이션**: 기존 android/ 폴더 사용으로 gradle plugin 미적용. JS 크래시 캡처는 autolinking으로 동작 기대, gradle 빌드 성공 여부는 v32 빌드에서 최종 확인.
