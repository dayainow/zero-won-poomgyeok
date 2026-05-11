# QA Report

## Commands Run

```shell
npm install
npm run typecheck
npm run typecheck
npm start -- --localhost
curl -I http://localhost:8081
npx expo install react-dom react-native-web @expo/metro-runtime
npm run web -- --localhost
curl -I "http://localhost:8081/?platform=web"
npm run typecheck
curl -s "http://localhost:8081/?platform=web"
npm run build
node -e "<check SEOUL_OPEN_API_KEY is not present in web bundle>"
npm run typecheck
npm run build
npx vercel env ls production --scope dayainows-projects
npx vercel env add SEOUL_OPEN_API_KEY production --scope dayainows-projects
npx vercel deploy --prod --yes --scope dayainows-projects
curl -I https://zero-won-poomgyeok.vercel.app
curl -sS https://zero-won-poomgyeok.vercel.app/api/events
curl -sS https://zero-won-poomgyeok.vercel.app/api/debug/culture-events
npx vercel deploy --prod --yes --scope dayainows-projects
curl -I https://zero-won-poomgyeok.vercel.app
curl -sS https://zero-won-poomgyeok.vercel.app/api/events
curl -sS https://zero-won-poomgyeok.vercel.app/api/debug/culture-events
npx vercel inspect zero-won-poomgyeok-irzxbeycm-dayainows-projects.vercel.app --scope dayainows-projects
npx vercel deploy --yes --scope dayainows-projects
curl -I https://zero-won-poomgyeok.vercel.app
curl -I https://zero-won-poomgyeok.vercel.app/api/events
npx vercel inspect zero-won-poomgyeok-7na6igkcg-dayainows-projects.vercel.app --scope dayainows-projects
```

## Pass / Fail Summary

- PASS: dependencies installed successfully.
- PASS: `npm run typecheck` completed with no TypeScript errors.
- PASS: repeated `npm run typecheck` completed with no TypeScript errors.
- PASS: Expo Metro dev server started at `http://localhost:8081`.
- PASS: `curl -I http://localhost:8081` returned `HTTP/1.1 200 OK`.
- PASS: Expo web support packages installed with SDK-compatible versions.
- PASS: Expo web dev server started and `http://localhost:8081/?platform=web` returned `Content-Type: text/html`.
- PASS: final `npm run typecheck` completed with no TypeScript errors.
- PASS: `public/index.html` now returns an Expo web app shell with `#root` and `index.bundle` instead of the old API landing page.
- PASS: production deployment completed on Vercel.
- PASS: `https://zero-won-poomgyeok.vercel.app` returned `HTTP/2 200`.
- PASS: `https://zero-won-poomgyeok.vercel.app/api/events` returned `HTTP/2 200` and mock culture event JSON.
- PASS: Vercel inspect reports deployment `dpl_71XaXnt4WQs9U55NZcnPwwqTq3KZ` as `Ready`.
- PASS: web bundle check confirmed the local `SEOUL_OPEN_API_KEY` value is not included in exported client JavaScript.
- PASS: final `npm run typecheck` completed with no TypeScript errors after Seoul API integration.
- PASS: final `npm run build` completed with Expo web export.
- PASS: `SEOUL_OPEN_API_KEY` was added to Vercel production environment variables.
- PASS: production deployment `dpl_5ydPfvGMZPvLyCfeVpqHfLQN1QGk` completed and was aliased to `https://zero-won-poomgyeok.vercel.app`.
- PASS: `GET /api/events` returned `source: "seoul-open-api"`, `count: 500`, `warning: null`.
- PASS: `GET /api/debug/culture-events` returned `ok: true`, `hasApiKey: true`, `status: 200`.

## Contract Checks

- `CultureEvent` type in `src/types.ts` matches the product brief fields.
- `src/data/events.ts` provides mock records for all MVP category groups except `전체`, which is a UI/filter category.
- `src/services/cultureApi.ts` exposes feed, nearby, stats, detail, search, trending, notification, and user access boundaries.
- `api/events.ts` exposes a serverless endpoint with source, updatedAt, count, optional warning, and events.
- `api/_lib/publicCultureEvents.ts` normalizes Seoul `culturalEventInfo` rows into the same `CultureEvent` shape.
- `App.tsx` consumes the same `CultureEvent` shape across Feed, Detail, Map, Search, Saved, and Itinerary, with API loading/fallback state.

## Issues

No blocking type or contract issues found.

## Reproduction

Not applicable for passed checks.

## Fix Recommendations

- Add real navigation and map dependencies in a follow-up if the project wants closer 1:1 behavior with the design spec.
- Add an Expo web/mobile smoke test once a dev server is started on the target device/runtime.
- Replace remote mock images with owned assets or cached image service before release.

## Remaining Risk

- Visual QA was not completed in a simulator/browser in this pass.
- Browser automation via `agent-browser` was not available in this environment.
- Local Expo web does not serve Vercel functions by itself; use production, `vercel dev`, or `EXPO_PUBLIC_EVENTS_API_URL` for local live API checks.
- The old API landing page was moved from `/` to `/api-status.html` so it no longer masks the Expo app on web.
- Expo warned that `expo@54.0.33` should be updated to `~54.0.34` for best SDK compatibility.
- `npm install` reported 13 package vulnerabilities from the dependency tree. They were not changed because vulnerability remediation can involve broader package decisions.
- The generated `3-layer-harness` standalone repo remains under `_workspace/3-layer-harness/` from the earlier sharing task and is unrelated to this MVP implementation.
