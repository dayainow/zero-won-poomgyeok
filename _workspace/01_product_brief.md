# Product Brief

## Goal

`docs/product`의 기획서, 화면설계서, Agent Build Spec을 기준으로 `0원의품격` MVP를 현재 Expo/React Native 앱에 구현한다. MVP는 무료/저렴한 문화 콘텐츠를 다크 테마와 네온 라임 액센트로 탐색, 검색, 저장, 일정/알림 확인까지 경험하게 하는 것이다.

## Scope

- 다크 테마 UI와 디자인 토큰을 앱에 반영한다.
- 12개 MVP 화면 흐름을 구현한다: 온보딩, 피드, 상세, 지도, 검색, 필터, 저장함, 나의 일정, 마이, 설정, 알림, 빈 상태.
- 현재 의존성 범위에서 단일 앱 상태 기반 네비게이션을 사용한다.
- 서울 열린데이터광장 문화행사 API를 서버리스 endpoint로 연결하고, 실패 시 mock 데이터로 fallback한다.
- mock 이벤트 데이터와 API 추상 레이어를 유지해 로컬/장애 상황에서도 앱을 확인할 수 있게 한다.
- AsyncStorage로 온보딩 완료, 저장 콘텐츠, 최근 검색을 유지한다.
- expo-location으로 위치 권한을 요청하고 거리순 탐색을 지원한다.

## Non-goals

- React Navigation, Zustand, TanStack Query, lucide, react-native-maps, expo-image 신규 설치는 이번 MVP 구현에서 제외한다.
- 실제 예약/결제/푸시 발송은 외부 링크와 mock 알림으로 대체한다.

## User Flow

1. 최초 진입 시 온보딩 3단계를 본다.
2. 피드에서 카테고리, 오늘의 추천, 통계, 가까운 무료 공간을 확인한다.
3. 카드 탭으로 상세에 들어가 저장, 예약 링크, 길찾기를 실행한다.
4. 지도 탭에서 카테고리별 핀과 하단 카드를 통해 주변 콘텐츠를 탐색한다.
5. 검색 모달에서 최근 검색/추천 검색어/검색 결과를 확인한다.
6. 필터에서 지역, 카테고리, 가격, 날짜 조건을 적용한다.
7. 저장함에서 저장한 콘텐츠를 필터링하고 빈 상태를 확인한다.
8. 마이에서 일정, 알림, 설정 화면으로 이동한다.

## UI States

- Loading: 온보딩/앱 시작, 위치 요청, 서울 문화행사 API refresh.
- Empty: 저장함, 검색 결과, 일정, 알림.
- Error/Warning: 위치 권한 거부 또는 위치 조회 실패 시 서울시청 기준 fallback 안내.
- Success: 피드 데이터 렌더링, 저장 토글, 필터 적용, 최근 검색 저장.

## Data Contract

### Event

- `id`: string
- `title`: string
- `subtitle`: string
- `category`: `'전체' | '전시' | '공연' | '클래스' | '행사' | '공간'`
- `priceTier`: `'free' | 'cheap' | 'mid'`
- `priceLabel`: string
- `reservationRequired`: boolean
- `thumbnail`: string
- `images`: string[]
- `description`: string
- `hashtags`: string[]
- `location`: `{ address: string; lat: number; lng: number }`
- `schedule`: `{ startDate: string; endDate: string; operatingHours: string; closedDays: string }`
- `rating`: number
- `reviewCount`: number
- `favoriteCount`: number
- `reservationUrl?`: string

### API

- `GET /api/events`: 서울 열린데이터광장 `culturalEventInfo`를 `CultureEvent[]`로 정규화한다.
- `GET /api/debug/culture-events`: 배포 환경의 API 키/외부 API 연결 상태를 점검한다.
- `getFeed(category?, filters?)`
- `getFeatured()`
- `getNearby(lat, lng, category?, filters?)`
- `getStats(filters?)`
- `getEvent(id)`
- `search(query, filters?)`
- `getTrending()`
- `getNotifications()`
- `getMe()`

## Acceptance Criteria

- 앱 기본 화면이 다크 테마이며 브랜드명 `0원의 품격`의 `0`이 라임 액센트로 보인다.
- 온보딩 완료 후 피드 탭으로 진입하고 완료 상태가 AsyncStorage에 저장된다.
- 피드에는 카테고리 row, 오늘의 추천, 3개 통계 카드, 가까운 무료 공간 카드가 보인다.
- 피드/지도/저장함/마이 4개 탭과 중앙 FAB가 동작한다.
- 카드 탭 시 상세 화면으로 이동하고 저장/예약/길찾기 액션이 제공된다.
- 저장 토글은 상세, 피드 카드, 지도 하단 카드, 저장함에 일관되게 반영된다.
- 검색 모달은 최근 검색, 추천 검색어, 2글자 이상 검색 결과, 결과 없음 상태를 제공한다.
- 필터 화면에서 지역/카테고리/가격/날짜를 선택하고 적용하면 피드/지도 결과가 줄어든다.
- 지도 화면은 실제 지도 패키지 없이 다크 맵 패널과 카테고리 핀/하단 카드로 MVP 탐색 흐름을 제공한다.
- 마이 화면에서 일정, 알림, 설정 화면으로 진입할 수 있다.
- `npm run typecheck`가 통과해야 한다.
- Vercel 배포 환경에서 `SEOUL_OPEN_API_KEY`가 설정되면 `/api/events` 응답의 `source`가 `seoul-open-api`가 된다.
- 서울 API 장애나 키 누락 시 앱은 mock 데이터로 계속 렌더링되고 피드 상단에 fallback 안내가 보인다.

## Implementation Tasks

1. `src/types.ts`에 문화 이벤트, 알림, 사용자, 필터 타입을 추가한다.
2. `src/data/events.ts`에 MVP mock 이벤트/알림/사용자 데이터를 추가한다.
3. `src/services/cultureApi.ts`에 API 로딩, fallback, 거리/필터/search 로직을 추가한다.
4. `api/events.ts`와 `api/_lib/publicCultureEvents.ts`에 서울 문화행사 API 연동 endpoint를 추가한다.
5. `App.tsx`를 다크 테마 MVP 앱으로 교체한다.
6. `_workspace/02_backend_contract.md`, `_workspace/03_frontend_notes.md`, `_workspace/04_qa_report.md`를 작성한다.

## Risks / Questions

- 실제 `react-native-maps`와 `expo-image`는 설치되어 있지 않아 시안의 지도/이미지 캐싱은 MVP 대체 UI로 구현한다.
- Pretendard 폰트 파일이 없어 시스템 폰트 weight로 위계를 구성한다.
- 원격 이미지 URL은 네트워크 상태에 따라 표시 실패할 수 있어 카드 배경색과 텍스트가 정보 전달을 보완한다.
- 공공 API 필드 품질에 따라 좌표 없는 행사는 제외된다.
