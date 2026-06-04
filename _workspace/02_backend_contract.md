# Backend Contract

## Endpoints / Actions

### `GET /api/events`

Returns normalized culture events for `0원의품격`.

Implemented in `api/events.ts` and `api/_lib/publicCultureEvents.ts`.

Primary source:

- Seoul Open Data Plaza `culturalEventInfo`
- Endpoint template: `http://openapi.seoul.go.kr:8088/{key}/json/culturalEventInfo/{start}/{end}`
- Required env: `SEOUL_OPEN_API_KEY`

Fallback source:

- `src/data/events.ts` mock catalog
- Used when env is missing, the external API fails, or no rows can be normalized.

### `GET /api/debug/culture-events`

Returns a no-cache diagnostic payload for the Seoul API integration without exposing the full API key.

Implemented in `api/debug/culture-events.ts`.

### `GET /api/map/search?query={keyword}&size={1..15}`

카카오 로컬 키워드 검색 프록시. 서버에서 `KAKAO_REST_API_KEY`를 사용해 호출하며,
IP 기준 분당 요청 제한과 5분 캐시를 적용한다.

Implemented in `api/map/search.ts`, `api/_lib/kakaoLocal.ts`.

### `GET /api/map/geocode?query={addressOrPlace}`

카카오 주소 검색 + 키워드 fallback 지오코딩 프록시.
IP 기준 분당 요청 제한과 5분 캐시를 적용한다.

Implemented in `api/map/geocode.ts`, `api/_lib/kakaoLocal.ts`.

### `POST /api/me/reviews`

로그인 사용자 후기 작성.

Implemented in `api/me/reviews.ts`, `api/_lib/userSystem.ts`.

### `GET /api/me/reviews?limit={1..50}`

로그인 사용자 본인 후기 목록 조회(최신순).

Implemented in `api/me/reviews.ts`, `api/_lib/userSystem.ts`.

### `GET /api/events/{eventId}/reviews?limit={1..50}`

이벤트 후기 목록 조회(최신순, 공개 read).

Implemented in `api/events/[eventId]/reviews.ts`, `api/_lib/userSystem.ts`.

## Request Shape

No required query parameters for MVP.

Review create request:

```ts
{
  eventId: string;
  eventTitle: string;
  rating: number; // 1..5
  comment: string; // 0..300
}
```

Future compatible query parameters:

- `category`: category filter
- `region`: region filter
- `price`: price tier filter
- `date`: date range preset
- `lat`, `lng`: nearby sorting

## Response Shape

```ts
{
  source: 'seoul-open-api' | 'mock-culture-events';
  updatedAt: string;
  count: number;
  warning?: string;
  events: CultureEvent[];
}
```

Review response:

```ts
{
  id: string;
  userId: string;
  eventId: string;
  eventTitle: string;
  rating: number;
  comment: string;
  createdAt: string;
  updatedAt: string;
}
```

Review API payload:

```ts
{ review: Review } // POST /api/me/reviews
{ reviews: Review[] } // GET /api/me/reviews, GET /api/events/{eventId}/reviews
```

## Client API

Implemented in `src/services/cultureApi.ts`.

- `cultureApi.getFeed(category, filters)`
- `cultureApi.getFeatured()`
- `cultureApi.getNearby(coordinate, category, filters)`
- `cultureApi.getStats(filters)`
- `cultureApi.getEvent(id)`
- `cultureApi.search(query, filters)`
- `cultureApi.getTrending()`
- `cultureApi.getNotifications()`
- `cultureApi.getMe()`

Implemented in `src/services/userApi.ts`.

- `createViewerReview(input)`
- `loadViewerReviews(limit?)`
- `loadEventReviews(eventId, limit?)`

## Response Entity

`CultureEvent` is defined in `src/types.ts`.

Required fields:

- id, title, subtitle, category
- priceTier, priceLabel, reservationRequired
- thumbnail, images
- description, hashtags
- location.address, location.lat, location.lng
- schedule.startDate, schedule.endDate, schedule.operatingHours, schedule.closedDays
- rating, reviewCount, favoriteCount
- reservationUrl optional

## Error Shape

`GET /api/events` intentionally returns `200` with fallback data when the external API fails, because the MVP feed should remain usable. The fallback response includes `warning`.

Review API error shape:

```ts
{
  message: string;
}
```

주요 status code:

- `201`: 후기 작성 성공
- `200`: 후기 조회 성공
- `400`: 입력 검증 실패(`eventId`, `eventTitle`, `rating`, `comment`, `limit`)
- `401`: 로그인 토큰 누락/무효
- `429`: 동일 사용자 + 동일 이벤트 단시간 중복 작성 차단(5분)
- `500`: 서버 내부 오류

Client lookups throw `Error("Event not found: {id}")` when `getEvent` receives an unknown id.

## Auth / Permission

- `POST /api/me/reviews`, `GET /api/me/reviews`: bearer auth 필수.
- `GET /api/events/{eventId}/reviews`: 공개 조회 허용.
- Location permission is client-side only through `expo-location`.
- Saved events, onboarding, recent search are stored locally in AsyncStorage.

Supabase RLS (`public.reviews`):

- insert: `auth.uid() = user_id`
- select own: `auth.uid() = user_id`
- select public event: 공개 조회 허용(앱은 eventId 필터된 endpoint로만 노출)

## Env / External Services

- `SEOUL_OPEN_API_KEY`: server-only Seoul Open Data Plaza key for `culturalEventInfo`.
- `SEOUL_PUBLIC_DATA_API_KEY`: backward-compatible alias accepted by the server code.
- `SEOUL_CULTURE_EVENT_API_URL`: optional endpoint template override for testing.
- `EXPO_PUBLIC_EVENTS_API_URL`: optional client override. Web defaults to relative `/api/events`.
- `KAKAO_REST_API_KEY`: server-only Kakao Local API REST key.
- `EXPO_PUBLIC_KAKAO_MAP_APP_KEY`: Kakao Maps JavaScript SDK key (web client).
- `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: 후기 API 포함 사용자 시스템 공통 의존.
- Remote image URLs are used in mock data and may depend on network availability.
- Reservation/directions open external URLs with React Native `Linking`.

## Fixtures / Seeds

`src/data/events.ts` includes:

- 12 curated mock `CultureEvent` records across exhibition, performance, class, event, and space categories.
- `TRENDING_SEARCHES`.
- `MOCK_NOTIFICATIONS`.
- `MOCK_USER`.

## Risks

- Seoul API rows without title, venue, or coordinates are excluded from the normalized feed.
- Seoul API category/price fields are mapped heuristically into the MVP categories and price tiers.
- Search/filter are client-side and should move server-side once event count grows.
- Push notifications are represented as mock rows; no push token registration exists yet.
- 공개 후기 조회 정책은 RLS 레벨에서 전체 select를 허용하므로, 앱/서버 레이어에서 eventId 경로를 통한 접근을 유지해야 한다.
- 동일 사용자 이벤트 재작성은 5분 윈도우 차단만 적용되며, 영구 1회 제한은 아직 아니다.
