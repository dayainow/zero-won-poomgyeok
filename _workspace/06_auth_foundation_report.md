# Auth Foundation Implementation Report

## Scope Completed

Phase 1 of `_workspace/05_user_system_harness_plan.md` is implemented as an auth foundation.

- Added Supabase Auth client boundary.
- Added email/password sign in and sign up overlay.
- Added session restore and auth state subscription.
- Added private-action login gate for save actions.
- Saved tab now requires login.
- My tab now reflects signed-in vs signed-out state.
- Settings now has account section, login CTA, and sign out action.
- Public feed, map, detail, search, filter remain usable without login.

## Changed Files

- `App.tsx`
- `src/services/authClient.ts`
- `.env.example`
- `package.json`
- `package-lock.json`
- `_workspace/06_auth_foundation_report.md`

## New Dependencies

- `@supabase/supabase-js`
- `react-native-url-polyfill`

`@react-native-async-storage/async-storage` was already installed and is reused for native session persistence.

## Env Required Before Real Login Works

Local `.env.local` and Vercel production/preview/development envs need:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

The app intentionally does not require these envs to boot. If they are absent, the auth screen displays an environment warning and public browsing remains available.

## Current Behavior

### Signed Out

- Feed, map, detail, search, filter are available.
- Save action opens login overlay.
- Saved tab shows login CTA.
- My tab shows login CTA and zero private stats.
- Settings shows login/account setup state.

### Signed In

- Session is restored through Supabase.
- Save action updates local saved state.
- Pending save action is replayed after successful login.
- Settings can sign out.

Server-side saved event sync is not implemented yet. That belongs to Phase 2/3: database contract and client sync.

## Verification

```shell
npm install @supabase/supabase-js react-native-url-polyfill --save
npm run typecheck
npm run build
node -e "<check Supabase env presence without printing values>"
npx vercel deploy --prod --yes --scope dayainows-projects
curl -I https://zero-won-poomgyeok.vercel.app
curl -sS https://zero-won-poomgyeok.vercel.app/api/events
npx vercel inspect zero-won-poomgyeok-nioa3yzhm-dayainows-projects.vercel.app --scope dayainows-projects
```

Results:

- PASS: dependencies installed.
- PASS: `npm run typecheck`.
- PASS: `npm run build`.
- INFO: local `.env.local` does not yet include Supabase URL/publishable key.
- PASS: Vercel production deployment `dpl_BzKeiSVKTUTtQXxJ23tDqw6rGbat` is Ready and aliased to `https://zero-won-poomgyeok.vercel.app`.
- PASS: production `/api/events` still returns `source: "seoul-open-api"`, `count: 500`, `warning: null`.
- INFO: `npm install` still reports 13 dependency vulnerabilities from the existing tree.

## Next Harness Phase

Phase 2 should provision the data layer and server contract:

1. Create Supabase project.
2. Add env vars locally and to Vercel.
3. Add SQL migrations for `profiles`, `user_saved_events`, `user_preferences`, `user_recent_searches`.
4. Add token verification helper for Vercel Functions.
5. Add `/api/me` and `/api/me/saved-events` endpoints.
6. Add smoke checks:
   - `GET /api/me` without token returns `401`.
   - Signed-in token returns profile.
   - Save/delete saved event round trip works.
