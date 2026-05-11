# User System Phase 2 Report

## Scope Completed

Phase 2 adds the server-side user data contract for Supabase-backed accounts.

- Added Supabase SQL migration for user-owned tables and RLS policies.
- Added Vercel API helper for Supabase bearer-token validation.
- Added `/api/me` with `GET` and `PATCH`.
- Added `/api/me/saved-events` with `GET` and `POST`.
- Added `/api/me/saved-events/:eventId` with `DELETE`.
- Added client API wrapper for authenticated user requests.
- Connected signed-in saved/unsaved actions to server APIs with optimistic UI.
- Connected signed-in My tab to server profile/saved state loading.
- Added Supabase public envs to Vercel production.

## Changed Files

- `api/_lib/userSystem.ts`
- `api/me.ts`
- `api/me/saved-events.ts`
- `api/me/saved-events/[eventId].ts`
- `src/services/userApi.ts`
- `App.tsx`
- `.env.example`
- `supabase/migrations/202605080001_user_system.sql`
- `_workspace/05_user_system_harness_plan.md`
- `_workspace/07_user_system_phase2_report.md`

## Database Migration

Status: completed manually in Supabase SQL Editor on 2026-05-08.

Source SQL:

```text
supabase/migrations/202605080001_user_system.sql
```

It creates:

- `profiles`
- `user_preferences`
- `user_saved_events`
- `user_recent_searches`

It also enables RLS and adds own-user policies based on `auth.uid()`.

## API Contract

### `GET /api/me`

Requires `Authorization: Bearer <supabase_access_token>`.

Returns:

- `profile`
- `preferences`
- `savedEventIds`
- `savedEvents`
- `recentSearches`

### `PATCH /api/me`

Updates profile fields:

- `nickname`
- `district`
- `interests`
- `marketingConsent`
- `onboardingCompleted`

### `GET /api/me/saved-events`

Returns saved event ids and saved event snapshots.

### `POST /api/me/saved-events`

Body:

```json
{
  "event": {
    "id": "culture-event-id"
  }
}
```

The real request sends the full `CultureEvent` snapshot.

### `DELETE /api/me/saved-events/:eventId`

Deletes one saved event for the authenticated user.

## Verification

```shell
node -e "<check Supabase public env presence without printing values>"
npm run typecheck
npm run build
npx vercel env ls production --scope dayainows-projects
npx vercel env add EXPO_PUBLIC_SUPABASE_URL production --scope dayainows-projects
npx vercel env add EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY production --scope dayainows-projects
npx vercel deploy --prod --yes --scope dayainows-projects
curl -I https://zero-won-poomgyeok.vercel.app
curl -sS -i https://zero-won-poomgyeok.vercel.app/api/me
curl -sS https://zero-won-poomgyeok.vercel.app/api/events
npx vercel inspect zero-won-poomgyeok-heowp5grn-dayainows-projects.vercel.app --scope dayainows-projects
```

Results:

- PASS: local Supabase public envs are present.
- PASS: `npm run typecheck`.
- PASS: `npm run build`.
- PASS: Vercel production deployment `dpl_2arNQyBUZRefQr7tnECw2DfREDrw` is Ready.
- PASS: `https://zero-won-poomgyeok.vercel.app` returns `HTTP/2 200`.
- PASS: unauthenticated `GET /api/me` returns `401` with `UNAUTHORIZED`.
- PASS: public `GET /api/events` still returns `source: "seoul-open-api"`, `count: 500`, `warning: null`.

## Remaining Manual QA Step

Create or sign into a test account in the app, save an event, and confirm it appears in `user_saved_events`.

If Supabase email confirmation is enabled, configure Auth URLs before testing:

- Site URL: `https://zero-won-poomgyeok.vercel.app`
- Redirect URL: `https://zero-won-poomgyeok.vercel.app/**`

## Phase 3 Next

- Add recent search server sync.
- Add profile edit UI backed by `PATCH /api/me`.
- Add preferences server sync for region, radius, interests, and toggles.
- Add a small smoke script that can test `/api/me` with a real test account token.
