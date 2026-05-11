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

## Request Shape

No required query parameters for MVP.

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

Client lookups throw `Error("Event not found: {id}")` when `getEvent` receives an unknown id.

## Auth / Permission

- No auth in MVP.
- Location permission is client-side only through `expo-location`.
- Saved events, onboarding, recent search are stored locally in AsyncStorage.

## Env / External Services

- `SEOUL_OPEN_API_KEY`: server-only Seoul Open Data Plaza key for `culturalEventInfo`.
- `SEOUL_PUBLIC_DATA_API_KEY`: backward-compatible alias accepted by the server code.
- `SEOUL_CULTURE_EVENT_API_URL`: optional endpoint template override for testing.
- `EXPO_PUBLIC_EVENTS_API_URL`: optional client override. Web defaults to relative `/api/events`.
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
