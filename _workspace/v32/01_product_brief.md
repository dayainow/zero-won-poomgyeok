# v32 Product Brief — 0원의품격 다음 버전

작성: 2026-06-15 / orchestrator: app-delivery-orchestrator

## 목표
v31(versionCode 9) 출시 이후 사용성·운영 가시성을 높이는 4종 개선을 v32에 반영한다.

## 범위 (Must)
1. **홈 피드 전체보기 + 무한스크롤** (프론트 전용)
2. **후기 전체보기 + 정렬** (프론트 + 백엔드)
3. **Sentry 크래시/에러 모니터링** (앱 + 서버, DSN env 가드)
4. **후기 좋아요(도움돼요)** (DB + API + 프론트)

## 비범위 / 이미 구현됨
- **후기 신고**: 이미 완전 구현(`review_reports` 테이블, `/api/me/review-reports`, App.tsx 신고 버튼). 건드리지 않는다.
- 이미지 첨부, 관리자 콘솔, 신뢰도 랭킹: v32 비범위.

## 현 구조 사실 (확인됨)
- 이벤트는 `loadCultureEventsData()`가 **전량을 한 번에 fetch**해 클라이언트에서 필터/슬라이스. → 피드 무한스크롤은 **API 페이지네이션 불필요, 프론트 점진 렌더**로 해결.
- 홈 피드 "가까운 무료 공간"은 `events.slice(0, 9)` (App.tsx:1663)로 9개 캡.
- 상세 후기는 `loadEventReviews(eventId, 3)` (App.tsx:813) + `.slice(0,3)` (App.tsx:1805)로 3개 캡, 정렬 없음(백엔드 created_at desc 고정).
- 후기 백엔드: `api/_lib/userSystem.ts > getEventReviews(eventId, { limit })`, 공개 GET `/api/events/[eventId]/reviews`. `toPublicReview`는 userId 미노출(검증 완료).

## 사용자 흐름
1. 홈에서 조건에 맞는 행사를 스크롤하면 9개 이후로도 계속 로드된다(점진 렌더, 끝 도달 시 종료).
2. 행사 상세에서 "후기 전체보기"를 누르면 모든 후기를 정렬(최신/평점/좋아요순) 옵션과 함께 본다. 더보기로 추가 로드.
3. 로그인 사용자가 후기의 "도움돼요"를 누르면 좋아요가 토글되고 카운트가 즉시 갱신된다. 비로그인은 로그인 오버레이로 유도.
4. 앱/서버에서 처리되지 않은 에러·크래시는 Sentry로 수집된다(DSN 설정 시).

## 수용 기준
- [ ] 홈 피드가 9개 제한 없이 전체 행사를 FlatList로 가상화 렌더, 스크롤로 추가 로드.
- [ ] 상세 후기 전체보기 화면/모달에서 정렬(최신·평점·좋아요) + 더보기(offset) 동작.
- [ ] 후기 좋아요 토글이 낙관적 갱신 + 서버 반영, 중복 좋아요 방지(unique), 카운트 정확.
- [ ] 비로그인 좋아요 시도 → 로그인 오버레이.
- [ ] Sentry: DSN env 있으면 init, 없으면 안전 no-op(빌드/런타임 영향 없음).
- [ ] `npm run typecheck` + `npm run build` 통과.

## 잔여 위험 / 결정사항
- **Sentry 네이티브**: android/ 폴더가 이미 존재 → eas build --local은 네이티브를 그대로 사용. @sentry/react-native는 Expo autolinking으로 잡힐 것으로 기대하나, 소스맵/심볼 업로드용 config plugin·gradle plugin은 prebuild 재생성이 필요. v32에서는 **JS 레벨 init(크래시/에러 캡처)**까지 하고, 심볼리케이션 고도화는 후속으로 둔다. QA가 gradle 빌드에서 링크 성공 여부 검증.
- **Sentry DSN**: `EXPO_PUBLIC_SENTRY_DSN`(앱), `SENTRY_DSN`(서버) env 필요. 미설정 시 no-op. 최종 보고에 env 등록 안내.
- 좋아요 카운트는 읽기 시 집계(review_likes group) 또는 denormalized counter 중 백엔드가 선택, 응답 shape는 계약 고정.
