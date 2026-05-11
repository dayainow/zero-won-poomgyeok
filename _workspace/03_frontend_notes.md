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
- Detail: hero image, transparent top actions, free/reservation badge, info grid, description, hashtags, map preview, sticky save/reserve actions.
- Map: dark map-like panel, category pins, selected bottom card, save toggle.
- Search: recent searches, trending keywords, result list, empty state.
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
- Onboarding completion is persisted under `zero-won-poomgyeok:onboarded`.

## Accessibility / Responsive Checks

- Primary interactive elements use `Pressable` with `accessibilityRole="button"`.
- Category and filter chips expose selected state.
- Text uses stable non-viewport font sizes and line heights.
- Cards, tabs, and fixed controls have stable dimensions to reduce layout shift.
- Narrow grid cards use `numberOfLines` where title overflow is likely.

## Known Gaps

- React Navigation is not installed, so MVP uses local state-based navigation in `App.tsx`.
- `react-native-maps` is not installed, so Map is represented by a dark interactive map panel with pins.
- `lucide-react-native`, `expo-image`, and Pretendard font are not installed, so MVP uses text symbols, built-in `Image`, and system font weights.
- Local Expo web dev server does not serve Vercel functions by itself. Use Vercel deployment, `vercel dev`, or `EXPO_PUBLIC_EVENTS_API_URL` when testing the live API locally.
- Pull-to-refresh and skeleton loading are not implemented yet.
