# Product Brief (1만명 최소 출시 재정의)

## 목표

현재 앱의 가장 큰 출시 차단 요소인 "후기 데이터 로컬 저장(AsyncStorage) 한계"를 제거하고, 1만명 규모에서 최소한의 신뢰성과 운영 가능성을 확보한다.  
이번 턴은 빅뱅 전환이 아니라, 이미 존재하는 Supabase Auth + Vercel API 기반 위에 **후기 서버 저장/조회 + 권한 + 기본 운영 안전장치**를 얹는 것을 목표로 한다.

## 현재 상태 진단 (핵심 갭)

- 인증 기초(Supabase)와 사용자 데이터 API(`/api/me*`)는 이미 존재한다.
- 저장한 행사/환경설정/최근검색은 서버 동기화가 가능하다.
- 후기는 `App.tsx`에서 `REVIEWS_KEY = zero-won-poomgyeok:user-reviews`로만 로컬 저장되어 디바이스 종속이다.
- 결과적으로 다중 디바이스, 데이터 복구, 운영 대응(신고/숨김/모니터링), 악성 사용자 제어가 불가능하다.

## 출시 범위 재정의

### Must (이번 턴에서 구현 가능한 핵심 범위)

1. **후기 서버 저장/조회 도입 (최소 CRUD)**
   - 인증 사용자만 후기 작성 가능.
   - 후기 작성 API: `POST /api/reviews`
   - 행사별 후기 조회 API: `GET /api/events/:eventId/reviews` 또는 동등 라우트
   - 내가 작성한 후기 조회 API: `GET /api/me/reviews`
   - 앱에서 후기 작성 성공 시 서버 반영 결과를 기준으로 UI 갱신(로컬 단독 저장 제거 또는 캐시 보조로 축소).

2. **인증/권한 최소선 고정**
   - 작성/수정/삭제는 본인 토큰 필수.
   - 공개 조회는 비로그인 허용(행사 상세 신뢰도 강화를 위해).
   - 서버에서 `user_id`를 토큰에서만 결정하고 클라이언트 입력 신뢰 금지.

3. **스팸/악성 1차 방어**
   - 본문 길이 제한(예: 10~500자), 평점 범위 제한(1~5), 공백 후기 차단.
   - 사용자당 작성 빈도 제한(예: 분당 N회) 또는 동일 행사 중복 작성 제한(정책 택1, Must에서 1개는 반드시 적용).
   - 신고/숨김의 완전 기능 대신, 운영자 수동 대응 가능한 `status` 필드(`visible`, `hidden`)를 데이터 모델에 포함.

4. **운영 관측성 최소선**
   - 후기 API 에러를 구조화해 반환(`error`, `message`, `code`).
   - 서버 로그에서 후기 생성 실패/권한 실패/검증 실패를 구분 가능하게 이벤트명 고정.
   - 최소 운영 지표 3개를 수집 가능 상태로 정의: 후기 생성 성공률, 4xx 비율, 5xx 비율.

### Next (후속 범위)

- AI/자동 욕설 필터, 정교한 스팸 탐지, 사용자 차단/제재 워크플로우.
- 신고 접수 UI/관리자 콘솔/처리 이력.
- 후기 좋아요, 정렬 고도화(최신/평점/신뢰도), 이미지 첨부.
- 캐시/인덱스/페이지네이션 고도화, 랭킹/통계 재계산 파이프라인.
- 외부 모니터링 연동(Sentry/Datadog)과 알림 룰 자동화.

## 사용자 흐름 (Must 기준)

1. 비로그인 사용자는 행사 상세에서 후기를 읽을 수 있다.
2. 비로그인 사용자가 후기 작성 버튼을 누르면 로그인 오버레이로 이동한다.
3. 로그인 사용자가 평점+코멘트를 제출하면 서버 검증 후 저장된다.
4. 저장 성공 시 상세 후기 목록과 내 후기 목록이 즉시 갱신된다.
5. 제한/검증 실패 시 사용자에게 원인(길이 초과, 중복, 빈도 제한)을 명확히 안내한다.

## 데이터 계약 (Must)

### Review Entity (초안)

- `id`: string (uuid)
- `eventId`: string
- `userId`: string (서버 결정)
- `rating`: number (1..5)
- `comment`: string (trimmed)
- `status`: `'visible' | 'hidden'`
- `createdAt`: string (ISO)
- `updatedAt`: string (ISO)

### Review API (초안)

- `POST /api/reviews`
  - auth required
  - body: `{ eventId: string; rating: number; comment: string }`
  - 200: `{ review: Review }`
- `GET /api/events/{eventId}/reviews`
  - public
  - query(선택): `cursor`, `limit`
  - 200: `{ reviews: Review[]; nextCursor?: string }`
- `GET /api/me/reviews`
  - auth required
  - 200: `{ reviews: Review[] }`

### 에러 규약

- 공통 형태: `{ error: string; message: string; code?: string }`
- 대표 코드:
  - `UNAUTHORIZED`
  - `INVALID_REVIEW_PAYLOAD`
  - `REVIEW_RATE_LIMITED`
  - `REVIEW_DUPLICATED`
  - `REVIEW_ENDPOINT_FAILED`

## 수용 기준 (Must)

- 후기 작성 데이터가 앱 재시작/기기 변경 후에도 동일 계정에서 유지된다.
- 비로그인 작성 시도는 401 또는 로그인 유도 동작으로 차단된다.
- 잘못된 페이로드(평점 범위, 본문 길이, 빈 값)는 400으로 일관 처리된다.
- 동일 사용자-행사 중복 정책 또는 작성 빈도 제한 정책이 실제로 동작한다.
- 행사 상세에서 서버 후기 조회 결과가 렌더링된다(빈 상태/에러 상태 포함).
- `npm run typecheck` 통과.

## 구현 분해 (오케스트레이터 전달용)

### Backend 체크리스트

- [ ] Supabase `reviews` 테이블(또는 동등 모델) 추가: `event_id`, `user_id`, `rating`, `comment`, `status`, timestamps
- [ ] RLS/권한: 본인만 쓰기/수정, 공개 조회는 `visible`만
- [ ] `POST /api/reviews` 구현 + 검증 + 에러 코드 표준화
- [ ] `GET /api/events/:eventId/reviews` 구현 (기본 최신순, limit)
- [ ] `GET /api/me/reviews` 구현
- [ ] 스팸 완화 1개 이상 구현(중복 제한 또는 빈도 제한)
- [ ] 후기 API 로그 이벤트명 표준화 (success/validation/auth/failure)

### Frontend 체크리스트

- [ ] `App.tsx` 후기 작성 경로를 서버 API 기반으로 전환
- [ ] 로컬 `userReviews` 단독 소스 제거(필요 시 임시 캐시는 서버 결과 보조용)
- [ ] 행사 상세에 서버 후기 목록 렌더링(로딩/빈/에러 상태)
- [ ] 비로그인 작성 시 로그인 유도 흐름 유지
- [ ] 검증 실패/제한 실패 메시지 UX 정리
- [ ] 성공 모달 이후 서버 재조회 또는 낙관적 갱신 동작 보장

### QA 체크리스트

- [ ] 로그인/비로그인 권한 케이스 점검 (작성/조회)
- [ ] 평점/본문 검증 실패 케이스 점검
- [ ] 중복 또는 빈도 제한 정책 점검
- [ ] 앱 재시작 및 재로그인 후 후기 데이터 유지 점검
- [ ] 서버 에러 시 UI 폴백/에러 문구 점검
- [ ] 타입체크 및 기본 회귀(저장/검색/필터/지도) 점검

## 위험 및 결정 필요 항목

- 중복 제한 vs 빈도 제한 중 어떤 정책을 Must 우선으로 채택할지 결정 필요(추천: 동일 사용자-행사 1건 제한).
- 기존 이벤트 `reviewCount/rating`과 실제 서버 후기 집계 동기화 방식은 Next로 분리 가능.
- 후기 운영자 도구가 아직 없으므로 `status` 기반 수동 SQL 대응 절차를 운영 문서에 함께 남겨야 한다.
