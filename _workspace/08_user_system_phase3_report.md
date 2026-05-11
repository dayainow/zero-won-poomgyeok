# User System Phase 3 Report

## Scope Completed

Phase 3 adds account data sync beyond saved events.

- Added profile edit UI.
- Connected profile updates to `PATCH /api/me`.
- Added preferences API endpoint.
- Connected notification toggles, default region, and radius to server preferences.
- Added recent search API endpoint.
- Connected signed-in search submissions to server recent-search sync.
- Hydrates app state from `/api/me`:
  - saved ids
  - recent searches
  - push/event/marketing toggles
  - default region
  - radius
- Added follow-up RLS policy migration for upsert/update paths.

## Changed Files

- `App.tsx`
- `api/_lib/userSystem.ts`
- `api/me/preferences.ts`
- `api/me/recent-searches.ts`
- `src/services/userApi.ts`
- `supabase/migrations/202605080002_phase3_policy_updates.sql`
- `_workspace/08_user_system_phase3_report.md`

## New API Contract

### `GET /api/me/preferences`

Requires bearer token. Returns current preferences.

### `PATCH /api/me/preferences`

Body:

```json
{
  "defaultRegion": "서울",
  "radiusKm": 5,
  "pushEnabled": true,
  "eventPushEnabled": true,
  "marketingEnabled": false
}
```

### `GET /api/me/recent-searches`

Requires bearer token. Returns recent searches.

### `POST /api/me/recent-searches`

Body:

```json
{
  "query": "무료공연"
}
```

## Verification

```shell
curl -sS -i https://zero-won-poomgyeok.vercel.app/api/me
npm run typecheck
npm run build
npx vercel deploy --prod --yes --scope dayainows-projects
curl -I https://zero-won-poomgyeok.vercel.app
curl -sS -i https://zero-won-poomgyeok.vercel.app/api/me/preferences
curl -sS -i https://zero-won-poomgyeok.vercel.app/api/me/recent-searches
curl -sS https://zero-won-poomgyeok.vercel.app/api/events
npx vercel inspect zero-won-poomgyeok-m1nq6i5u1-dayainows-projects.vercel.app --scope dayainows-projects
```

Results:

- PASS: short QA before implementation confirmed `/api/me` is protected with `401`.
- PASS: `npm run typecheck`.
- PASS: `npm run build`.
- PASS: Vercel production deployment `dpl_A2QEg7QubRr4FerNSYmUbQM2LmKW` is Ready.
- PASS: `https://zero-won-poomgyeok.vercel.app` returns `HTTP/2 200`.
- PASS: unauthenticated `/api/me/preferences` returns `401`.
- PASS: unauthenticated `/api/me/recent-searches` returns `401`.
- PASS: public `/api/events` still returns `source: "seoul-open-api"`, `count: 500`, `warning: null`.

## Remaining Operator Step

Run this migration in Supabase SQL Editor:

```text
supabase/migrations/202605080002_phase3_policy_updates.sql
```

It allows authenticated users to update their own saved-event and recent-search rows, which is required for upsert-based sync.

## Manual QA Checklist

- Sign in.
- Open My tab and confirm account profile loads.
- Tap profile edit and update nickname/district/interests.
- Search a keyword and confirm it appears in `user_recent_searches`.
- Toggle push/event/marketing settings and confirm `user_preferences` updates.
- Change default region/radius in Settings and confirm `user_preferences` updates.
- Save and unsave an event and confirm `user_saved_events` updates.
