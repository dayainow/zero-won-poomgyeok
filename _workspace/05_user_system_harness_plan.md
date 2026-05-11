# User System Harness Plan

## Goal

`0원의품격` MVP를 실제 배포 가능한 개인화 서비스로 발전시킨다. 현재 로컬 `AsyncStorage`에 머무는 온보딩, 저장 콘텐츠, 최근 검색, 마이 화면 데이터를 로그인 기반의 서버 저장 데이터로 옮기고, 웹/모바일/재설치 후에도 같은 유저 경험이 이어지게 한다.

## Current State

- Auth: 없음.
- Profile: `MOCK_USER` 정적 데이터.
- Saved events: `AsyncStorage` key `zero-won-poomgyeok:saved-events`.
- Recent searches: `AsyncStorage` key `zero-won-poomgyeok:recent-searches`.
- Onboarding: `AsyncStorage` key `zero-won-poomgyeok:onboarded`.
- API: Vercel Functions, `GET /api/events`는 서울 열린데이터광장 문화행사 API와 연결됨.
- Database: 없음.

## Recommended Direction

### MVP 추천안: Supabase Auth + Postgres

현재 앱이 Expo/React Native이고 Next.js가 아니므로, Expo에서 바로 세션을 유지할 수 있는 Auth와 유저 DB가 한 묶음인 구성이 가장 단순하다.

- Supabase Auth: Expo/React Native에서 `AsyncStorage` 기반 세션 유지 가능.
- Supabase Postgres: `profiles`, `saved_events`, `preferences`, `recent_searches` 저장.
- Vercel Functions: 클라이언트 JWT를 검증하고 서버에서 필요한 DB 작업을 수행.

### 대안: Clerk Expo + Neon Postgres

인증 UX와 계정 관리 완성도가 더 중요하면 Clerk Expo를 쓰고, 유저 데이터는 Neon Postgres에 저장한다.

- Clerk: Expo용 hooks/native auth UI 제공.
- Neon: Vercel Marketplace에서 연결 가능한 serverless Postgres.
- 단점: Auth와 DB가 분리되어 서버 권한 매핑과 유저 동기화 레이어가 필요하다.

### Decision Needed

다음 구현 전에 하나만 결정하면 된다.

- 빠른 MVP와 적은 통합 수: Supabase Auth + Postgres.
- 더 강한 계정 관리 UX와 독립 DB 구성: Clerk Expo + Neon.

이 계획서는 Supabase Auth + Postgres 기준으로 작성하되, API 경계는 Clerk + Neon으로도 바꿀 수 있게 둔다.

## Product Architect Output

### MVP User Stories

1. 사용자는 이메일 또는 소셜 로그인으로 가입/로그인할 수 있다.
2. 로그인하지 않아도 피드 탐색은 가능하다.
3. 저장, 일정, 알림 설정, 프로필 편집은 로그인 후 서버에 저장된다.
4. 비로그인 사용자가 저장 버튼을 누르면 로그인 화면으로 이동하고, 로그인 후 기존 액션이 이어진다.
5. 같은 계정으로 다른 기기에서 로그인하면 저장함과 관심 설정이 복원된다.
6. 로그아웃해도 공개 피드 탐색은 계속 가능하며 개인 데이터는 숨겨진다.
7. 계정 삭제 요청 시 프로필, 저장, 최근 검색, 알림 설정이 삭제 또는 익명화된다.

### MVP Scope

- Auth state: signed out, signing in, signed in, session expired.
- Auth screens: sign in, sign up, password reset or magic link, sign out confirmation.
- Profile: nickname, district, interests, marketing consent.
- Saved events: server sync, local optimistic UI, event snapshot fallback.
- Preferences: default region, preferred categories, push/event/marketing toggles.
- Recent searches: optional server sync after login.
- Protected actions: save, itinerary, profile edit, notification settings.

### Non-goals For First Pass

- Paid membership, payment, coupons.
- Social graph/following.
- Full notification delivery pipeline.
- Admin console.
- In-app account deletion automation beyond API/data contract. The UI can expose request/delete flow, but policy/legal copy should be finalized separately.

## Backend Integrator Output

### Data Model

Auth provider owns identity. App DB owns product-specific user data.

```sql
profiles
- id uuid primary key
- auth_user_id text unique not null
- nickname text not null
- district text
- avatar_url text
- interests text[] not null default '{}'
- marketing_consent boolean not null default false
- onboarding_completed_at timestamptz
- created_at timestamptz not null default now()
- updated_at timestamptz not null default now()

user_saved_events
- id uuid primary key
- user_id uuid references profiles(id) on delete cascade
- event_id text not null
- event_source text not null default 'seoul-open-api'
- event_title text not null
- event_category text not null
- event_location text
- event_start_date date
- event_end_date date
- event_snapshot jsonb not null
- saved_at timestamptz not null default now()
- unique(user_id, event_id)

user_preferences
- user_id uuid primary key references profiles(id) on delete cascade
- default_region text not null default '서울'
- radius_km integer not null default 5
- push_enabled boolean not null default true
- event_push_enabled boolean not null default true
- marketing_enabled boolean not null default false
- updated_at timestamptz not null default now()

user_recent_searches
- id uuid primary key
- user_id uuid references profiles(id) on delete cascade
- query text not null
- searched_at timestamptz not null default now()
- unique(user_id, query)
```

### API Contract

Public:

- `GET /api/events`: unchanged, no auth required.

Auth required:

- `GET /api/me`: profile, preferences, saved ids, recent searches.
- `PATCH /api/me`: nickname, district, interests, consents.
- `POST /api/me/onboarding`: mark onboarding completed.
- `GET /api/me/saved-events`: saved event list.
- `POST /api/me/saved-events`: save event snapshot.
- `DELETE /api/me/saved-events/:eventId`: unsave.
- `GET /api/me/recent-searches`: list recent searches.
- `POST /api/me/recent-searches`: upsert query.
- `PATCH /api/me/preferences`: push/default region/radius/category settings.
- `DELETE /api/me`: account deletion or deletion-request entry.

### Auth Boundary

- Client sends bearer access token to app API.
- Server validates token using provider SDK/JWT verification.
- Server maps auth user id to `profiles.auth_user_id`.
- API never trusts `user_id` from request body.
- RLS can be enabled if the client talks directly to Supabase; if all writes go through Vercel Functions, server-side policies still need least-privilege service key handling.

### Env

Supabase path:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` or server-only DB credentials for Vercel Functions

Clerk + Neon path:

- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `DATABASE_URL`

Never expose service-role or DB credentials through `EXPO_PUBLIC_*`.

## Frontend Builder Output

### App State Changes

Add an `AuthProvider` or `UserProvider` boundary above the current app shell.

State groups:

- `authState`: loading, signedOut, signedIn, expired.
- `viewer`: profile + preferences + saved ids.
- `localGuestState`: saved/search/onboarding while signed out.
- `syncState`: idle, syncing, failed.

### Screen Changes

- Onboarding: after completion, save locally for guests; save to `/api/me/onboarding` for signed-in users.
- Feed/detail saved button: if signed out, open auth gate; after login, replay save action.
- Saved tab: signed out state shows login CTA and optional local guest saves; signed in state loads server saves.
- My tab: replace `MOCK_USER` with `/api/me`; show login CTA when signed out.
- Settings: sign out button, notification toggles, account deletion entry.
- Profile edit: nickname, district, interest categories.

### Migration UX

When a guest logs in:

1. Read local saved ids and recent searches.
2. Ask or silently merge depending on product decision.
3. POST unsynced saved event snapshots to server.
4. Clear only successfully migrated local records.

## QA Guardian Output

### Required Automated Checks

- `npm run typecheck`
- `npm run build`
- API unit or smoke tests for auth-required endpoints.
- Deployment smoke:
  - `GET /api/events` returns public feed.
  - `GET /api/me` without token returns `401`.
  - `GET /api/me` with valid token returns profile payload.
  - Save event then reload saved list.
  - Delete saved event then reload saved list.

### Manual Test Matrix

- Guest can browse feed, map, detail, search.
- Guest save action opens auth gate.
- New user signs up and lands back in intended action.
- Existing user logs in and sees saved events.
- Logout hides private data.
- Session expiration returns to signed-out state without breaking public feed.
- Reinstall or browser storage clear still restores server saves after login.
- API key and DB credentials are absent from web bundle.

### Security Checks

- A user cannot read another user's saved events.
- API rejects body-supplied `user_id`.
- Server-only keys are absent from `dist` bundle.
- CORS and auth headers are handled intentionally.
- Account deletion path removes or anonymizes personal data.

## Implementation Phases

### Phase 1: Auth Foundation

- Status: implemented in `_workspace/06_auth_foundation_report.md`.
- Provider path: Supabase Auth.
- Added auth client and session restore/subscription boundary.
- Added sign in/up/out UI.
- Added token retrieval helper for future API calls.
- Kept public feed working for signed-out users.

### Phase 2: Database + Server Contract

- Status: code implemented in `_workspace/07_user_system_phase2_report.md`.
- Supabase public envs were added locally and to Vercel production.
- Added schema migration script.
- Added `/api/me` and saved event endpoints.
- Added token verification middleware/helper.
- Added server-side profile bootstrap on first login.
- Pending operator step: run `supabase/migrations/202605080001_user_system.sql` in the Supabase SQL editor or via Supabase CLI before signed-in saved-event sync can succeed.

### Phase 3: Client Sync

- Status: implemented in `_workspace/08_user_system_phase3_report.md`.
- Replaced My tab display with real profile when signed in.
- Hydrates saved ids, recent searches, and preferences from `/api/me`.
- Added optimistic save/unsave with rollback in Phase 2 and retained it.
- Added profile edit, preferences sync, and recent-search sync.
- Pending operator step: run `supabase/migrations/202605080002_phase3_policy_updates.sql`.

### Phase 4: Preferences + Settings

- Persist region/radius/interests.
- Persist notification toggles.
- Add profile edit and sign out.
- Add deletion request/delete account flow.

### Phase 5: Release Hardening

- Add smoke tests.
- Verify Vercel envs.
- Verify production deployment.
- Add privacy copy and consent text.
- Add monitoring/logging around auth/API failures.

## Acceptance Criteria

- Public feed remains usable without login.
- Signed-in user data persists across browser/device sessions.
- Saved events are stored server-side and scoped per user.
- My tab reflects real profile data, not `MOCK_USER`.
- Settings toggles persist after reload.
- Unauthorized private endpoints return `401`.
- Another user's data cannot be accessed by changing ids in requests.
- Vercel production build passes and required env vars are configured.

## Open Questions

- Should login be required only on private actions, or before onboarding completion?
- Which login methods should launch first: email/password, magic link, Google, Apple, Kakao/Naver?
- Should guest saved items auto-merge after login or ask for confirmation?
- Do we need Kakao/Naver social login for Korean users in MVP?
- Do we need push notifications in the first user-system release, or only saved preference toggles?

## Sources Checked

- Supabase React Native Auth docs: https://supabase.com/docs/guides/auth/quickstarts/react-native
- Supabase Auth overview: https://supabase.com/docs/guides/auth
- Clerk Expo authentication: https://clerk.com/expo-authentication
- Clerk Expo native AuthView docs: https://clerk.com/docs/reference/expo/native-components/auth-view
- Vercel Postgres/Marketplace guidance: https://vercel.com/docs/postgres
- Vercel Neon Marketplace page: https://vercel.com/marketplace/neon/
