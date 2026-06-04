# Frontend Notes

## Changed Files

- `App.tsx`
- `src/types.ts`
- `src/data/events.ts`
- `src/services/cultureApi.ts`
- `api/events.ts`
- `api/_lib/publicCultureEvents.ts`
- `api/debug/culture-events.ts`
- `_workspace/01_product_brief.md`
- `_workspace/02_backend_contract.md`
- `_workspace/04_qa_report.md`

## UI States Covered

- Onboarding: 3-step first-run flow, persisted with AsyncStorage.
- Feed: brand header, search/notification entry, location chip, API source/status chip, category row, featured card, stats, nearby grid.
- Detail: hero image, transparent top actions, free/reservation badge, info grid, description, hashtags, live map preview, sticky save/reserve actions.
- Map: native iOS/Android uses `react-native-maps`; web now prefers Kakao Maps when `EXPO_PUBLIC_KAKAO_MAP_APP_KEY` is configured, then Naver Maps fallback, and finally CARTO/OSM dark tiles.
- Search: recent searches, trending keywords, Kakao 장소 추천(디바운스), 앱 내 결과, empty state.
- Filter: region, radius, category, price, date selection, result count CTA.
- Saved: category filter, 2-column saved cards, empty state CTA.
- My: profile card, stats row, menu routing.
- Itinerary: upcoming saved events and empty state.
- Notifications: grouped mock notification rows.
- Settings: menu rows, switches, app info.
- EmptyState: reusable centered pattern with optional CTA.

## Data Dependencies

- Culture content loads from `/api/events` on web, which normalizes Seoul Open Data Plaza `culturalEventInfo`.
- If the API is unavailable, the app falls back to `CULTURE_EVENTS`.
- Feed header displays source label, event count, last updated time, and fallback warning when present.
- Distance is calculated with `getEventDistanceKm` from current or fallback coordinates.
- Saved ids are persisted under `zero-won-poomgyeok:saved-events`.
- Recent searches are persisted under `zero-won-poomgyeok:recent-searches`.
- Kakao 장소 검색/지오코딩은 `/api/map/search`, `/api/map/geocode`를 통해 호출되며, 클라이언트·서버에서 캐시/요청 제한을 함께 적용한다.
- Onboarding completion is persisted under `zero-won-poomgyeok:onboarded`.

## Accessibility / Responsive Checks

- Primary interactive elements use `Pressable` with `accessibilityRole="button"`.
- Category and filter chips expose selected state.
- Text uses stable non-viewport font sizes and line heights.
- Cards, tabs, and fixed controls have stable dimensions to reduce layout shift.
- Narrow grid cards use `numberOfLines` where title overflow is likely.

## Known Gaps

- React Navigation is not installed, so MVP uses local state-based navigation in `App.tsx`.
- Native map rendering now depends on `react-native-maps`. Web rendering needs `EXPO_PUBLIC_KAKAO_MAP_APP_KEY` (권장) 또는 `EXPO_PUBLIC_NAVER_MAP_CLIENT_ID`; 둘 다 없으면 browser preview uses remote fallback tiles from `basemaps.cartocdn.com`.
- `lucide-react-native`, `expo-image`, and Pretendard font are not installed, so MVP uses text symbols, built-in `Image`, and system font weights.
- Local Expo web dev server does not serve Vercel functions by itself. Use Vercel deployment, `vercel dev`, or `EXPO_PUBLIC_EVENTS_API_URL` when testing the live API locally.
- Pull-to-refresh and skeleton loading are not implemented yet.

## 2026-06-02 업데이트

- 후기 작성 성공 피드백을 시스템 `Alert`에서 앱 내 커스텀 성공 모달(`ReviewSuccessModal`)로 교체했다.
- 모달 구성은 아이콘(이모지), 타이틀, 본문, 확인 버튼이며 `OverlaySafeArea`와 기존 color/style token을 재사용한다.
- 확인 버튼은 `accessibilityRole="button"`을 지정했고, 본문은 line height를 명시해 가독성을 보강했다.

## 2026-06-02 서버 후기 전환 추가

- `App.tsx` 후기 제출 흐름을 로컬 즉시 저장에서 서버 `createReview` 호출 기반으로 전환했다.
- 미로그인 상태에서 후기 제출 시 작성 오버레이 내 오류 문구를 보여주고 인증 오버레이를 열어 로그인 흐름으로 유도한다.
- 마이 탭의 후기 수는 `loadMyReviews()` 결과를 우선 사용하고, 비로그인 상태에서는 기존 `REVIEWS_KEY`를 읽은 최소 fallback count만 사용한다.
- 상세 화면(`DetailScreen`)에 최근 후기 섹션을 추가했고, `loadEventReviews(eventId, 3)`로 최신 3개를 로딩/빈 상태/에러+재시도 UI와 함께 렌더링한다.
- 빠른 후기 플로우의 핵심 UX(지도 1개 고정 작성, 메인 주변 5개 선택)는 그대로 유지했다.
- 신규 클라이언트 API 파일 `src/services/reviewApi.ts`를 추가해 후기 생성/내 후기 조회/행사 후기 조회를 통합했다.
