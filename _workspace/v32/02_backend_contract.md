# v32 Backend Contract (IMPLEMENTED — backend-integrator 갱신 2026-06-15)

상태: 구현 완료, `npm run typecheck` 통과. 마이그레이션은 파일만 추가(실DB 적용 별도).

## 변경 파일 목록
- `supabase/migrations/2026061501_review_likes.sql` (신규)
- `api/_lib/userSystem.ts` (수정)
- `api/_lib/observability.ts` (수정: Sentry)
- `api/events/[eventId]/reviews.ts` (수정: offset/sort/viewer/hasMore)
- `api/me/reviews.ts` (수정: 좋아요 POST/DELETE 분기)
- `vercel.json` (수정: review-likes rewrite)
- 프론트엔드 파일은 미변경(프론트 에이전트 담당).

## A. 후기 정렬 + 페이지네이션

### getEventReviews 시그니처 (구현됨)
`api/_lib/userSystem.ts`
```ts
export type ReviewSort = 'recent' | 'rating' | 'likes';

getEventReviews(eventId: string, options?: {
  limit?: number;                 // 기본 20, 최대 50 (normalizeLimit)
  offset?: number;                // 기본 0, 음수는 0
  sort?: ReviewSort;              // 기본 'recent', 미지원 값은 'recent' 폴백
  viewerUserId?: string | null;  // 좋아요 likedByViewer 계산용, null이면 false
}): Promise<PublicReview[]>
```
정렬 매핑:
- recent: created_at desc (DB range 페이지네이션)
- rating: rating desc, created_at desc (DB range 페이지네이션)
- likes: like_count desc, created_at desc
  - like_count는 reviews 테이블 컬럼이 아니라 review_likes 집계.
  - 구현: status=visible 후보를 created_at desc로 최대 500건(REVIEW_LIKES_SORT_SCAN_CAP) 스캔 → 좋아요 카운트 attach → 메모리 정렬(count desc, created_at desc) → offset/limit slice.
  - 위험: 한 이벤트 후기가 500건 초과 시 likes 정렬 페이지네이션 정확도 저하. 현 규모 무방. 초과 시 denormalized like_count 컬럼 도입 권장.

상태 필터: 기존대로 status='visible'만.

### 공개 엔드포인트
`GET /api/events/[eventId]/reviews?limit=&offset=&sort=`
- 쿼리 검증: sort ∈ {recent,rating,likes} 아니면 undefined→서버 'recent' 폴백. limit/offset 비숫자면 undefined 폴백(throw 안 함). limit 미지정 시 기본 20.
- Authorization Bearer 있으면 `resolveOptionalViewerUserId(request)`로 viewer userId 추출(없거나 무효면 null=비로그인, 절대 throw 안 함) → likedByViewer 채움.
- 응답: `{ reviews: PublicReview[], hasMore: boolean }`
  - hasMore = `reviews.length === effectiveLimit` (effectiveLimit = limit ?? 20)
  - reviews 키 유지(기존 호출 호환).
- 캐시 헤더: 기존 `public, s-maxage=30, stale-while-revalidate=120` 유지.

## B. 후기 좋아요

### DB 마이그레이션 (신규: supabase/migrations/2026061501_review_likes.sql)
```sql
create table if not exists public.review_likes (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (review_id, user_id)
);
create index review_likes_review_idx on public.review_likes(review_id);
create index review_likes_user_idx on public.review_likes(user_id);
alter table public.review_likes enable row level security;
-- insert/delete: auth.uid() = user_id, select using(true)
-- grant select,insert,delete to authenticated; grant select to anon
```
destructive change: 없음(신규 테이블 + create if not exists, drop policy if exists만).
적용 방법: `supabase db push` 또는 Supabase 콘솔 SQL 에디터에 파일 내용 실행. 실제 DB 적용은 별도 운영 작업.

### 좋아요 API (신규 함수 파일 없음 — 함수 12/12 한도 유지)
`vercel.json` rewrite 추가:
```json
{ "source": "/api/me/review-likes", "destination": "/api/me/reviews?resource=likes" }
```

`api/me/reviews.ts` 분기 (인증 필수: requireViewer, 미인증 자동 401):
- `POST /api/me/review-likes` (resource=likes)
  - body: `{ reviewId: string }`
  - 동작: idempotent insert(unique 위반 23505는 통과). 23503(FK)이면 "해당 후기를 찾을 수 없습니다."(400).
  - 응답 201: `{ liked: true, likeCount: number }` (likeCount = 작업 후 재집계)
  - rateLimit: `review-like:user:{id}` 60/분, `review-like:ip:{ip}` 120/분
- `DELETE /api/me/review-likes` (resource=likes) — DELETE 메서드 분기 신규 추가
  - body: `{ reviewId: string }`
  - 동작: 본인 좋아요 삭제(없어도 성공). 응답 200: `{ liked: false, likeCount: number }`
  - rateLimit: `review-unlike:user:{id}` 60/분, `review-unlike:ip:{ip}` 120/분
- Allow 헤더: `GET, POST, DELETE`
- 에러 shape: 기존 규약 `{ message }`(+code). resolveStatus: 'required'/'찾을 수 없습니다' → 400, rateLimit → 429.

### userSystem.ts 신규 export
```ts
likeReviewForViewer(viewer: ViewerContext, reviewId: string): Promise<{ liked: true; likeCount: number }>
unlikeReviewForViewer(viewer: ViewerContext, reviewId: string): Promise<{ liked: false; likeCount: number }>
resolveOptionalViewerUserId(request: VercelRequest): Promise<string | null>
```

## C. PublicReview 응답 shape (확장, 구현됨)
`toPublicReview` 출력 (getEventReviews / getMyReviews / createReviewForViewer 모두 동일 타입):
```ts
type PublicReview = {
  id: string;
  eventId: string;
  eventTitle: string;
  rating: number;
  comment: string;
  status: 'visible' | 'hidden';
  createdAt: string;
  updatedAt: string;
  likeCount: number;       // 신규, 항상 존재(기본 0)
  likedByViewer: boolean;  // 신규, viewer 없으면 false
};
```
- userId 미노출 유지.
- likeCount/likedByViewer 수집: 현재 페이지 review id 집합에 대해
  - `review_likes`를 `review_id IN (ids)`로 1회 조회 후 메모리 집계 → counts
  - viewerUserId 있으면 `user_id=viewer AND review_id IN (ids)` 1회 조회 → likedByViewer set
  - (collectReviewLikeMeta / attachLikeMeta 헬퍼)
- createReviewForViewer 응답: 갓 생성한 후기는 likeCount=0, likedByViewer=false (기본값).
- getMyReviews: 좋아요 카운트 + 본인 좋아요 여부 채움.

## D. Sentry (서버, 구현됨)
`api/_lib/observability.ts`:
- `@sentry/node`(8.55.2) import. `process.env.SENTRY_DSN` 없으면 완전 no-op(init/capture 모두 skip).
- init: 모듈 로드시 1회(`Sentry.init({ dsn, environment, tracesSampleRate: 0 })`). environment = VERCEL_ENV ?? NODE_ENV.
- `captureException(error, extra?)` export. DSN 없으면 no-op. 내부 throw는 try/catch로 흡수.
- `withRequestContext(...).log(level, event, meta, error?)`에 4번째 인자 error 추가. level==='error'일 때 captureException 자동 호출(requestId/event/meta를 extra로). error 미전달 시 합성 Error 생성.
- 핸들러(api/me/reviews.ts, api/events/[eventId]/reviews.ts)의 catch에서 obs.log에 원본 error 전달 → 5xx 경로가 Sentry로 보고.

### env 요구
- `SENTRY_DSN` (서버, Vercel 환경변수). 미설정 시 no-op.
- (앱: `EXPO_PUBLIC_SENTRY_DSN` — 프론트 담당.)

## 회귀/제약 확인
- createReview / report(review_reports) 흐름 미변경.
- 기존 엔드포인트 응답 키 유지(`reviews`, `review`, report result).
- 함수 파일 신규 추가 없음(12/12 한도 유지) — rewrite로 통합.
- package.json 변경 없음.

## QA 교차검증 포인트 (qa-guardian에게)
- 비로그인 GET reviews → likedByViewer 전부 false, 200.
- 로그인 GET reviews(Bearer) → 본인이 누른 후기만 likedByViewer true.
- sort=likes 정렬 정확성 + offset 더보기 연속성(500건 이하).
- 좋아요 POST 두 번(동일 reviewId) → 둘 다 201, likeCount 증가 1회만(idempotent).
- DELETE 좋아요 안 누른 상태 → 200, likeCount 변화 없음.
- 미인증 POST/DELETE review-likes → 401.
- 잘못된 limit/offset/sort 쿼리 → 폴백 동작(500 아님).
- SENTRY_DSN 미설정 빌드/런타임 무영향.

## 미해결/위험
- likes 정렬 500건 스캔 캡: 초과 이벤트 발생 시 denormalized like_count 컬럼 + 트리거 도입 필요(현 비범위).
- like/unlike 후 카운트 재집계는 추가 쿼리 1회(현 규모 무방).
