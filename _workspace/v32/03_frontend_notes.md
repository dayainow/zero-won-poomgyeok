# v32 Frontend Notes — 0원의품격 (frontend-builder)

작성: 2026-06-15 / typecheck: 통과 (`npm run typecheck`)

## 변경 파일
- `App.tsx` — 홈 피드 FlatList 전환, 후기 전체보기 오버레이, 후기 좋아요, Sentry init/wrap.
- `src/services/reviewApi.ts` — `loadEventReviews` 시그니처 확장, `likeReview`/`unlikeReview` 추가, `ReviewItem`에 `likeCount`/`likedByViewer`, `ReviewSort` export.
- `app.config.js` — plugins에 `'@sentry/react-native'` 추가.

(api/, supabase/, vercel.json, package.json 미변경 — 백엔드/완료 영역 보존.)

## 1. 홈 피드 전체보기 + 무한스크롤 (FlatList 전환 방식)
- `FeedScreen`의 최상위 `ScrollView`를 `FlatList`(numColumns=3)로 교체.
- 상단 섹션(피드 헤더/위치/데이터소스 배지/CategoryRow/관심 추천/오늘의 추천/StatCard/"가까운 무료 공간" SectionHeader) 전부를 `ListHeaderComponent`로 이동.
- nearbyGrid는 FlatList data로 렌더. `events.slice(0, 9)` 캡 제거 → `visibleCount` state(기본 12, `FEED_PAGE_SIZE`)로 점진 렌더. `onEndReached`에서 +12, `events.length` 도달 시 종료(ListFooterComponent ActivityIndicator로 진행 표시).
- `events` 참조가 바뀌면(필터/카테고리/위치 변경) `visibleCount`를 12로 리셋하는 effect 추가.
- 시각적 회귀 방지:
  - `columnWrapperStyle = { gap: 12, marginBottom: 12 }` → 기존 `nearbyGrid`(flexWrap + gap:12)와 동일한 3열/간격/좌측정렬 재현. (space-between은 마지막 행 정렬이 어긋나 채택 안 함.)
  - `contentContainerStyle`에 기존 `styles.tabContent` + `paddingBottom: scrollPaddingBottom` 그대로 유지 → 광고배너/탭바 여백 보존.
  - NearbyCard(width 30.9%) 무수정.
  - 빈 상태는 `ListEmptyComponent`로 기존 EmptyState 동일 노출.
  - Android에서 `removeClippedSubviews` 활성(가상화 메모리 이점).

### interestEvents 캡 처리 결정
- `interestEvents.slice(0, 6)`(관심 카테고리 추천)은 **의도된 큐레이션으로 판단해 유지**. "내 관심 카테고리 추천"은 메인 피드가 아니라 상단 추천 섹션이며, 전체 목록은 아래 "가까운 무료 공간"이 담당. 6개 캡 그대로 ListHeader 안에 둠.
- featured(오늘의 추천), reviewEventOptions(후기 작성 옵션) 등 다른 캡도 동일 이유로 유지.

## 2. 후기 전체보기 + 정렬
- 상세(`DetailScreen`)는 미리보기 3개 유지 + 하단에 "후기 전체보기 (event.reviewCount)" 버튼 추가 → `openAllReviews()`.
- 신규 오버레이 `overlay === 'reviews'` + `ReviewsScreen` 컴포넌트(기존 overlay/TopBar/OverlaySafeArea 패턴 따름).
  - 정렬 탭: 최신순/평점순/좋아요순 = `recent`/`rating`/`likes`. 탭 변경 시 목록 초기화 후 offset=0 재조회.
  - `FlatList`로 가상화. `onEndReached` + 하단 "더보기" 버튼 둘 다 제공. offset = 현재 로드된 길이, `{reviews, hasMore}`의 hasMore=false면 "마지막 후기예요." 표시.
  - 중복 id 머지 가드(서버 정렬/페이지 경계에서 중복 방지).
  - 로딩/에러(다시 시도)/빈 상태 모두 처리.
  - 상세가 닫히거나 다른 행사로 바뀌면 전체보기 state 초기화(effect).

## 3. 후기 좋아요(도움돼요)
- `ReviewCard` 공용 컴포넌트(미리보기·전체보기 공통)에 ♥/♡ + "도움돼요 N" 버튼. `accessibilityState.selected`, accessibilityLabel 부여.
- `toggleReviewLike(review)`:
  - 비로그인 → `openAuthGate('signIn')`(기존 auth 오버레이).
  - 낙관적 업데이트: 즉시 likeCount ±1 / likedByViewer 토글을 **detailReviews + allReviews 두 목록 모두**에 반영(`applyLikeToLists`).
  - API 성공 시 서버 재집계 `likeCount`/`liked`로 동기화. 실패 시 롤백 + Alert. 응답 code가 UNAUTHORIZED면 auth 오버레이로 유도.
- `reviewApi`: `likeReview`(POST), `unlikeReview`(DELETE) — 둘 다 `/api/me/review-likes`, 인증 필수(requestWithAuth, 토큰 없으면 UNAUTHORIZED throw).
- `loadEventReviews(eventId, { limit, offset, sort })`: 토큰 있으면 Bearer 첨부해 likedByViewer 채움, 없으면 비인증 호출(전부 false). `{reviews, hasMore}` 반환.

## 4. Sentry (앱)
- `app.config.js` plugins에 `'@sentry/react-native'` 추가(소스맵/네이티브 링크용 config plugin).
- `App.tsx` 최상단: `EXPO_PUBLIC_SENTRY_DSN`가 있을 때만 `Sentry.init({ dsn, environment, tracesSampleRate: 0 })` 호출. init은 try/catch로 감싸 부팅 실패 방지.
- DSN 없으면 init 미호출 + `export default App`(원본). DSN 있으면 `Sentry.wrap(App)`로 래핑.
- import만으로는 크래시 없음(가드는 호출 시점). DSN 미설정 시 빌드/런타임 완전 no-op.
- 검증: `@sentry/react-native` 타입 정의에서 `init`, `wrap` export 확인.

## env 등록 안내
- 앱: `EXPO_PUBLIC_SENTRY_DSN` (EAS/로컬 .env). 미설정 시 Sentry no-op.
- (서버 `SENTRY_DSN`은 백엔드 담당.)

## 검증 결과
- `npm run typecheck` 통과.
- 모든 `loadEventReviews` 호출부 신규 시그니처로 갱신 확인.

## 남은 위험 / QA 체크포인트
- **마지막 행 정렬**: numColumns=3 + columnWrapperStyle gap:12로 기존 그리드 재현. 실기기에서 카드 폭(30.9%)/간격 시각 회귀 여부 QA 확인 권장.
- **likes 정렬 페이지네이션**: 백엔드 500건 스캔 캡(메모리 정렬). 한 이벤트 후기 500건 초과 시 정확도 저하(현 규모 무방).
- **likedByViewer 갱신 타이밍**: 정렬 탭 전환/더보기는 매 요청 토큰 첨부해 재계산. 로그인 직후 이미 열린 목록은 재진입 전까지 미반영(상세 재진입 시 동기화).
- **Sentry 네이티브 링크**: android/ 폴더 존재 → gradle 빌드에서 @sentry/react-native autolinking 성공 여부는 QA가 검증(JS init까지가 v32 범위, 심볼리케이션 고도화는 후속).
- 신고/저장/로그인/필터/검색/지도 등 기존 기능 미변경(회귀 없음 예상, QA 회귀 스위프 권장).
