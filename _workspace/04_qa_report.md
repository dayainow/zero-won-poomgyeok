# QA Report

## Commands Run

```shell
npm run typecheck
npm run build
```

## Pass / Fail Summary

- PASS: `npm run typecheck` 통과 (TypeScript 오류 없음).
- PASS: `npm run build` 통과 (Expo web export 완료).
- FAIL: 코드/계약 교차검증에서 치명 2건, 중요 2건 확인.

## Contract Checks

- API 경로 사용은 프론트 기준 `POST /api/reviews`, `GET /api/me/reviews`, `GET /api/events/{eventId}/reviews`로 연결됨.
- 하지만 백엔드 구현이 `api/reviews.ts`와 `api/me/reviews.ts` 두 경로로 분산되어 작성/검증/에러 규약이 이원화됨.
- 에러 shape는 일부 엔드포인트에서 `{ error, message, code }`, 일부에서 `{ message }`만 반환되어 일관성 깨짐.
- 공개 후기 조회는 `user_id`를 그대로 반환해 개인정보 최소화 원칙과 충돌함.

## Issues

### 치명

1. **스키마-API 불일치로 후기 저장 실패 가능성 매우 높음**
   - 위치: `supabase/migrations/202606021640_reviews_system.sql`, `api/reviews.ts`
   - 내용: 마이그레이션에는 `status` 컬럼이 없고 `comment` 최대 길이는 300인데, API는 `status: 'visible'`을 insert하고 `comment <= 500`을 허용함.
   - 영향: `POST /api/reviews`가 DB 에러(컬럼 없음/체크 제약 위반)로 500 실패 가능.

2. **공개 후기 조회에서 사용자 식별자 노출**
   - 위치: `api/_lib/userSystem.ts` (`toPublicReview`, `getEventReviews`), `api/events/[eventId]/reviews.ts`
   - 내용: 공개 엔드포인트 응답에 `userId`가 포함됨.
   - 영향: 비로그인 사용자가 이벤트 후기 조회만으로 내부 사용자 식별자를 수집 가능(PII/추적 리스크).

### 중요

3. **리뷰 생성/조회 API 계약 이원화로 회귀 위험**
   - 위치: `api/reviews.ts`, `api/me/reviews.ts`, `src/services/reviewApi.ts`, `src/services/userApi.ts`
   - 내용: 작성 API가 `/api/reviews`와 `/api/me/reviews` 두 군데 존재하고, 유효성/중복 정책/응답 status 및 에러 shape가 서로 다름.
   - 영향: 클라이언트/운영/테스트 기준이 분산되어 경로 혼용 시 예외 처리 회귀 가능.

4. **중복방지 정책 불일치(영구 중복 차단 vs 5분 윈도우)**
   - 위치: `api/reviews.ts`(동일 event+user 영구 차단), `api/_lib/userSystem.ts` + `api/me/reviews.ts`(5분 제한)
   - 내용: 같은 기능(후기 작성)에 경로별로 다른 정책이 적용됨.
   - 영향: 엔드포인트 선택에 따라 사용자 경험/운영 정책이 달라져 버그로 인식될 수 있음.

### 권장

5. **이벤트 후기 응답 shape-프론트 타입의 잠재적 불일치**
   - 위치: `api/_lib/userSystem.ts` (`toPublicReview`), `src/services/reviewApi.ts` (`ReviewItem`)
   - 내용: 클라이언트 타입은 `status`를 필수로 기대하지만, `getEventReviews()` 변환 결과에는 `status`가 없음.
   - 영향: 현재는 런타임에서 조용히 동작할 수 있으나, 추후 UI에서 `status` 사용 시 즉시 회귀 가능.

6. **기존 로그인/저장함 플로우 수동 회귀 미완료**
   - 위치: `App.tsx` 인증 오버레이/탭 상태 전환
   - 내용: 정적 분석 및 빌드 검증만 수행했고, 실제 디바이스에서 로그인→저장함→후기 작성 연속 시나리오 수동 검증은 이번 패스에서 미실행.

## Reproduction

1. 치명 #1:
   - DB에 `202606021640_reviews_system.sql`만 적용된 상태에서 `POST /api/reviews` 호출.
   - body 예시: `{ "eventId":"e1", "rating":5, "comment":"좋아요" }`.
   - 예상: 200 + review.
   - 실제: `status` 컬럼/코멘트 길이 규칙 충돌로 500 또는 DB 에러 가능.

2. 치명 #2:
   - 비로그인 상태로 `GET /api/events/{eventId}/reviews` 호출.
   - 응답 review 배열에 `userId` 포함 여부 확인.
   - 예상: 공개 조회용 최소 필드(닉네임/익명화 식별자 등)만 노출.
   - 실제: 내부 `userId` 노출.

3. 중요 #3/#4:
   - 동일 사용자로 `/api/reviews`와 `/api/me/reviews` 각각 POST 테스트.
   - 중복 작성 시 status/message/code를 비교.
   - 예상: 동일 정책/동일 에러 규약.
   - 실제: 정책 및 에러 shape가 경로별로 다름.

## Fix Recommendations

- 단일 작성 경로로 통합 권장: `POST /api/reviews`만 유지하고 `/api/me/reviews`는 GET 전용으로 축소.
- DB 계약 우선 정합: `status` 컬럼 추가 및 comment 길이(300 vs 500) 정책을 API/마이그레이션/프론트 문구까지 일치시킬 것.
- 공개 후기 응답에서 `userId` 제거(또는 익명화된 안전 식별자 사용), 필요 시 닉네임만 선택 노출.
- 에러 shape를 전 엔드포인트에서 `{ error, message, code }`로 통일하고 프론트 매핑을 단일화.

## Remaining Risk

- 로그인/저장함/후기 작성 통합 플로우의 실제 디바이스 수동 회귀 테스트는 미완료.
- Vercel 함수 실환경(API + RLS) 연동 E2E 호출은 이번 패스에서 미실행.
