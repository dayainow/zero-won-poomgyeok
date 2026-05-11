# 0원의 품격 — Agent Build Specification

> **이 문서의 용도**: AI 코딩 에이전트(Claude Code, Cursor, Copilot 등)에게 이 문서 한 장을 던지면 앱이 빌드되도록 작성된 구현 스펙. 디자이너의 시안을 기준으로 컬러·타이포·컴포넌트·화면·데이터 모델·구현 순서를 모두 명시한다.

---

## 0. 에이전트에게 — 시작 지침

당신은 시니어 React Native 엔지니어다. 아래 스펙대로 "0원의 품격"이라는 한국어 모바일 앱을 빌드한다. 이 문서가 절대적인 진실이며, 디자인 디테일·컬러 토큰·타이포·컴포넌트·문구는 모두 이 스펙을 따른다. 임의로 바꾸지 말 것.

작업 순서는 §11 (구현 단계)을 따른다. 단계마다 빌드 가능한 상태를 유지하고, 각 단계 끝에 어떤 화면이 동작하는지 짧게 보고할 것.

---

## 1. 프로덕트 개요

### 1.1 한 줄 정의
무료·저렴한 전시·공연·클래스·문화공간을 위치 기반으로 큐레이션해주는 다크 테마 모바일 앱.

### 1.2 브랜드 카피
> **"좋은 문화는 누구에게나 열려 있어야 하니까"**
> 무료로 즐길 수 있는 다양한 문화생활을 발견해보세요.

서브 태그라인: **"문화생활을 더 가까이, 취향에 맞게 발견하는 경험"**

### 1.3 4가지 핵심 가치 (앱 진입 시 노출)

| 키워드 | 카피 | 아이콘 |
|---|---|---|
| **무료** | 0원으로 즐기는 문화생활 | 라임 원형 + 무료 마크 |
| **발견** | 취향을 찾는 새로운 시선 | 라임 원형 + 발견 마크 |
| **저장** | 나만의 리스트로 정리 | 라임 원형 + 북마크 |
| **가까이** | 지금, 내 주변에서 | 라임 원형 + 핀 |

### 1.4 타겟 사용자
- 20대 대학생·취준생 (가처분 소득 적지만 문화생활 욕구 높음)
- 20~30대 직장인 (점심·퇴근 후 짧은 여가)
- 가족 단위 (아이와 함께 무료 체험)

### 1.5 MVP 범위 — 12개 화면

| # | 화면 | 분류 |
|---|---|---|
| 01 | Feed (피드) | 메인 탭 |
| 02 | Detail (상세) | Stack |
| 03 | Map (지도) | 메인 탭 |
| 04 | Search (검색) | Modal |
| 05 | Filter (필터) | Modal Stack |
| 06 | Saved (저장함) | 메인 탭 |
| 07 | Itinerary (나의 일정) | Stack from My |
| 08 | My (마이) | 메인 탭 |
| 09 | Settings (설정) | Stack from My |
| 10 | Notifications (알림) | Stack |
| 11 | Onboarding (온보딩) | 최초 진입 |
| 12 | Empty State (빈 상태) | 패턴 |

---

## 2. 기술 스택

| Layer | Choice | 이유 |
|---|---|---|
| Framework | **React Native + Expo (SDK 51+)** | 크로스 플랫폼, 빠른 프로토타입 |
| Language | **TypeScript (strict)** | 타입 안전성 |
| Navigation | **@react-navigation/native** + bottom-tabs + native-stack | 표준 |
| State | **Zustand** + **TanStack Query** | 단순한 글로벌 + 서버 상태 |
| Styling | **StyleSheet + 디자인 토큰 (theme.ts)** | RN 기본, NativeWind 사용 안 함 |
| Fonts | **Pretendard** (Variable, 자체 호스팅) | 한국어 가독성 |
| Icons | **lucide-react-native** | 가벼운 라인 아이콘 |
| Images | **expo-image** | 캐싱, blur placeholder |
| Maps | **react-native-maps** (Google Maps Provider) | 지도 화면용 |
| Storage | **AsyncStorage** | 저장함, 사용자 설정 |
| API Client | **ky** or **axios** | REST 호출 |

```bash
npx create-expo-app poomgyeok --template blank-typescript
```

---

## 3. 디자인 시스템

> **출처**: 디자이너 시안 (다크 테마, 네온 라임 액센트, Pretendard).
> 다크 테마가 기본이며, 라이트 테마는 v2 이후 추가.

### 3.1 컬러 토큰 (`theme/colors.ts`)

```typescript
export const colors = {
  // ── Surface (배경 위계) ──
  bg:         '#0F0F0F',  // 앱 최하위 배경
  bgElevated: '#1A1A1A',  // 카드, 시트
  bgRaised:   '#252525',  // 카드 위 요소
  bgHover:    '#2A2A2A',

  // ── Border / Divider ──
  border:     '#2E2E2E',
  borderSubtle: '#202020',

  // ── Text ──
  textPrimary:   '#FFFFFF',
  textSecondary: '#B5B5B5',
  textMuted:     '#7A7A7A',
  textDisabled:  '#4D4D4D',

  // ── Brand Accent (네온 라임) — Primary ──
  // 핵심 강조색. "0원의 품격"의 "0", FAB, 활성 탭, 무료 뱃지, CTA 버튼
  accent:       '#D4FF00',
  accentHover:  '#C5F500',
  accentMuted:  '#9BBF00',
  onAccent:     '#0F0F0F',  // accent 위에 올라가는 텍스트 (어두움)

  // ── Secondary Accents (지도 핀, 카테고리 구분, 액센트 그라데이션) ──
  // 지도에서 카테고리별 핀 컬러로 사용. 시안의 보라·핑크 보조 컬러.
  violet:       '#8B5CF6',  // 공연, 행사 핀
  violetMuted:  '#5B3DA6',
  pink:         '#EC4899',  // 클래스, 워크숍 핀
  pinkMuted:    '#A8326A',
  // 온보딩 배경 그라데이션에도 활용 (라임→보라→핑크 페이드)

  // ── Status ──
  success: '#7BD389',
  warning: '#F5C518',
  danger:  '#FF5252',

  // ── Overlay ──
  scrim: 'rgba(0,0,0,0.7)',
} as const;

export type ColorToken = keyof typeof colors;
```

### 3.2 타이포 (`theme/typography.ts`)

폰트 패밀리는 **Pretendard Variable** 단일 패밀리. weight로 위계를 만든다.

```typescript
export const typography = {
  // Display — 매스트헤드 "0원의 품격"
  displayBold: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.5,
  },
  // H1 — 화면 타이틀 ("MMCA 현대차 시리즈 2024")
  h1: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 24,
    lineHeight: 32,
    letterSpacing: -0.4,
  },
  // H2 — 섹션 타이틀 ("오늘의 추천")
  h2: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: -0.2,
  },
  // H3 — 카드 타이틀
  h3: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: -0.2,
  },
  // Body — 본문
  body: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 14,
    lineHeight: 22,
  },
  bodyMedium: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 14,
    lineHeight: 22,
  },
  // Caption — 메타데이터, 거리, 별점
  caption: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 12,
    lineHeight: 16,
  },
  // Label — 탭바, 버튼, 카테고리 칩
  label: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 12,
    lineHeight: 16,
  },
  // Tag — 무료 뱃지
  tag: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0,
  },
  // Number — 통계 카드 숫자 (12, 28, 43)
  numberLarge: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.5,
  },
} as const;
```

### 3.3 스페이싱 / 라운드 / 그림자

```typescript
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 };
export const radius = { sm: 6, md: 10, lg: 14, xl: 20, pill: 999 };
export const shadow = {
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
};
```

### 3.4 디자인 원칙

1. **다크가 기본** — 모든 화면은 `colors.bg` 또는 `colors.bgElevated` 배경
2. **네온 라임은 절제해서** — 한 화면에 1~2곳만 강조 (브랜드 마크, 무료 뱃지, 활성 탭, FAB)
3. **무료를 자랑한다** — "무료" 뱃지는 항상 카드 좌상단, 네온 라임 배경
4. **이미지 우선** — 카드의 첫 시선은 이미지, 그 다음이 텍스트
5. **숫자는 크게** — 통계(12, 28, 43)는 H1급 크기로 임팩트
6. **모서리는 부드럽게** — 카드 radius 14px, 칩/버튼 radius 999px(pill)

---

## 4. 네비게이션 구조

### 4.1 탭 5개 (FAB 가운데)

```
┌─────────────────────────────────────────┐
│ 피드  지도   [+]   저장함   마이        │
└─────────────────────────────────────────┘
```

| Tab | Icon (lucide) | Screen |
|---|---|---|
| 피드 (Feed) | `Home` | FeedScreen |
| 지도 (Map) | `MapPin` | MapScreen |
| **[+] FAB** | `Plus` | 액션 시트 (행사 제보, 후기 작성) |
| 저장함 (Saved) | `Bookmark` | SavedScreen |
| 마이 (Profile) | `User` | ProfileScreen |

활성 탭은 `colors.accent` 컬러, 비활성은 `colors.textMuted`. FAB은 항상 `colors.accent` 배경 + `colors.onAccent` 아이콘.

### 4.2 Stack 화면 (탭 위로 push)

- `DetailScreen` — 행사 상세
- `SearchScreen` — 검색 (피드 헤더 종 아이콘 또는 검색 아이콘에서)
- `NotificationsScreen` — 알림
- `ReviewWriteScreen` — 후기 작성
- `OnboardingScreen` — 최초 진입 시
- `WebViewScreen` — 외부 예약 링크

---

## 5. 화면 명세

### 5.1 FeedScreen — 피드 (홈)

**구조 (위에서 아래로):**

1. **StatusBar** (light-content)
2. **Header**
   - 좌: `0원의 품격` (displayBold, "0"만 `colors.accent`)
   - 우: 알림 종 아이콘 (`Bell`, 24px, `colors.textPrimary`)
3. **Subtitle** — `body`, `colors.textSecondary`, "지금 무료로 즐길 수 있는 문화생활을 추천하세요."
4. **CategoryRow** (horizontal scroll, 6개 카테고리)
   - 전체 / 전시 / 공연 / 클래스 / 행사 / 공간
   - 각 칩: 원형 아이콘 + 라벨 (세로 정렬)
   - 활성 칩: 아이콘 배경이 `colors.accent`, 라벨 bold
   - 비활성 칩: 아이콘 배경 `colors.bgRaised`
5. **SectionHeader** — "오늘의 추천" + "더보기 >" (오른쪽 끝)
6. **FeaturedCard** (큰 카드 1개)
   - 16:10 이미지 + 좌상단 `무료` 뱃지 + 우상단 `X` 닫기 (관심없음)
   - 하단: 제목 (h3), 부제목 (caption — "국립현대미술관 서울 · 1.2km")
   - 우측 하단: 좋아요 카운트 (`Heart` + 숫자)
   - 카드 radius 14px
7. **StatsRow** (3개 카드 가로)
   - 카드 1: "오늘 무료" / **12** / "지금 예약 가능" (배경 `colors.accent`, 텍스트 `colors.onAccent`)
   - 카드 2: "만원 이하" / **28** / "가성비 추천"
   - 카드 3: "주말 추천" / **43** / "이번 주말"
   - 카드 1만 강조색, 2·3은 `colors.bgElevated`
8. **SectionHeader** — "가까운 무료 공간" + "전체보기 >"
9. **NearbyGrid** (3열 그리드, 정사각 카드)
   - 각 카드: 이미지 + 좌상단 `무료` 뱃지 + 하단 텍스트 (제목 / 부제목 / 거리)
   - 거리 라벨: `Users` 아이콘 + "1.8km" (caption)
10. **BottomTabBar** (피드 탭 활성)

**인터랙션:**
- FeaturedCard 탭 → DetailScreen (item.id 전달)
- 카테고리 칩 탭 → 같은 피드 필터 적용 (Zustand `selectedCategory`)
- "더보기" 탭 → 해당 카테고리의 풀리스트 화면
- 알림 종 탭 → NotificationsScreen

### 5.2 DetailScreen — 행사 상세

**구조:**

1. **TopBar (transparent over hero)**
   - 좌: 뒤로가기 (`ArrowLeft`)
   - 우: 공유 (`Share2`) + 북마크 (`Bookmark`)
   - 아이콘은 모두 흰색, 반투명 원형 배경(rgba(0,0,0,0.4)) 위에
2. **HeroImage** — 가로 100%, 4:3 비율
3. **Content padding 20px**
   - **무료 뱃지** — `accent` 배경, `onAccent` 텍스트, radius 6px, padding 6×10
   - **Title** (h1) — "MMCA 현대차 시리즈 2024"
   - **Subtitle** — "국립현대미술관 서울 · 1.2km" (`textSecondary`)
   - **RatingRow** — `Star` (filled, accent) + "4.8 (128)" + 구분점 + `MessageCircle` + "리뷰 2.4k"
4. **InfoGrid (3열)** — `colors.bgElevated` 배경, radius 14
   - 각 셀: 아이콘 + 라벨(caption muted) + 값(bodyMedium)
   - 셀 1: 입장료 — "무료" / 관람료
   - 셀 2: 예약 — "예약 필요" / 온라인 사전 예약
   - 셀 3: 운영 — "10:00–18:00" / 매주 월요일 휴무
5. **Description** (body) — 2~3 문단
6. **HashtagRow** — `#현대미술 #전시추천 #무료전시` (accent 컬러, 가로 wrap)
7. **MapPreview**
   - "📍 서울 종로구 삼청로 30 국립현대미술관 서울" 주소
   - 지도 (높이 180), accent 컬러 핀
   - 우하단: "1.2km · 도보 15분" + "길찾기" 버튼 (uppercase label, border)
8. **BottomActions** (sticky bottom)
   - 좌: `저장하기` — outline 버튼, border `colors.border`, `Bookmark` 아이콘 + 라벨
   - 우: `예약하기` — solid `accent` 배경, `onAccent` 텍스트, `Calendar` 아이콘 + 라벨
   - 비율 1:2 (저장:예약)
   - 카드 radius 14px

### 5.3 SavedScreen — 저장함

**구조:**

1. **Header** — 좌: "저장함" (h1), 우: "편집" 텍스트 버튼
2. **FilterRow** (horizontal scroll)
   - 칩: "전체 12" / "전시 5" / "공연 3" / "행사 2" / "공간 2"
   - 활성 칩: `accent` 배경 + `onAccent` 텍스트
   - 비활성: `bgElevated` 배경 + `textPrimary` 텍스트
   - radius pill, padding 8×16
3. **Grid** (2열)
   - 카드 비율 5:6 (이미지 위, 텍스트 아래)
   - 좌상단 뱃지: `무료` (accent) 또는 `예약` (accent)
   - 하단: 제목(h3) + 부제목(caption muted) + 좋아요(`Heart` + 숫자, 우측 정렬)
   - 카드 radius 14px, 카드 사이 간격 12px
4. **BottomTabBar** (저장함 활성 — `accent` 컬러)

### 5.4 MapScreen — 지도 (03)

**구조 (시안 기준):**

1. **TopBar (지도 위에 sticky overlay)**
   - 검색바 (rounded pill, `bgElevated`, padding 14×16)
   - placeholder: "지역, 장소, 키워드 검색"
2. **CategoryFilterRow** (검색바 아래, 가로 스크롤)
   - 칩: 전체 / 전시 / 공연 / 클래스 / 공간
   - 활성 칩: `accent` 배경 + `onAccent` 텍스트
   - 비활성: `bgElevated` 배경 + `textSecondary`
3. **FullScreen Map** (`react-native-maps`)
   - 다크 스타일 (`customMapStyle` JSON 적용 — 도로 어둡게, POI 숨김)
   - **핀 마커: 원형 아바타 스타일** ⭐
     - 50px 원, 행사 썸네일 이미지를 원형 마스크로 보여줌
     - 보더 2px, 카테고리별 컬러 (전시=라임, 공연=보라, 클래스=핑크)
     - 활성 핀(현재 선택)은 라임 글로우 + 살짝 확대
4. **BottomCard** (지도 위 sticky, 하단 80px above tabbar)
   - 가로 카드: 좌측 썸네일(64×64) + 우측 정보
   - 정보: 제목(h3) / 거리(`1.5km · 도보 18분`) / 운영시간(`오늘 10:00–20:00`)
   - 우상단: 좋아요 하트 (탭으로 저장 토글)
   - 카드 radius 14, `bgElevated`, shadow.card
   - 좌우 스와이프로 다음/이전 핀의 정보 슬라이드

**인터랙션:**
- 핀 탭 → 해당 핀의 BottomCard 표시 + 지도 살짝 zoom in
- BottomCard 탭 → DetailScreen

### 5.5 SearchScreen — 검색 (04)

피드의 검색 아이콘 또는 지도 검색바에서 진입. 모달 (presentation: modal, `slide_from_bottom`).

**구조 (시안 기준):**

1. **SearchBar (sticky top)**
   - `Search` 아이콘 + placeholder "정해서를 알려해사세요" *(또는 "장소·전시·공연 검색")*
   - 우측 끝: "취소" 텍스트 버튼 (`textSecondary`)
   - 자동 포커스, 키보드 자동 노출
2. **최근 검색 섹션**
   - 헤더: "최근 검색" (h2)
   - 칩 리스트 (가로 wrap, pill 형태)
     - 예: "전시", "서울시립미술관", "무료전시"
     - 각 칩: `bgElevated` 배경, X 아이콘으로 개별 삭제
3. **추천 검색어 섹션**
   - 헤더: "추천 검색어" (h2)
   - 세로 리스트 (각 행: `Search` 아이콘 + 키워드)
   - 예: 무료공연 / 이번 주말 / MMCA / 아트선재센터 / 연극 / 클래스
4. **검색어 입력 시 동작**
   - 2글자 이상 입력 시 디바운스(300ms) 후 검색 결과 화면으로 전환
   - 결과 화면: 카드 리스트 (NearbyCard와 동일 디자인) + 결과 없음 시 EmptyState

### 5.6 FilterScreen — 필터 (05)

피드/지도 우상단 필터 아이콘에서 진입. 풀스크린 stack.

**구조:**

1. **TopBar**
   - 좌: 뒤로가기 (`ArrowLeft`)
   - 중: "필터" (h2)
   - 우: "초기화" 텍스트 버튼 (`textSecondary`)
2. **ScrollView Body**

   **A. 지역 (Region)**
   - 슬라이더 위 라벨: "내 주변 / 반경 5km"
   - 슬라이더: 1km ~ 30km, accent 컬러 트랙
   - 그 아래 지역 칩 그리드 (3열 wrap):
     - 전체 / 서울 / 경기 / 인천 / 부산 / 대구 / 광주 / 대전 / 기타

   **B. 카테고리 (Category)**
   - 칩 그리드: 전체 / 전시 / 공연 / 클래스 / 행사 / 공간

   **C. 가격 (Price)**
   - 칩 그리드: 전체 / 무료 / 1만원 이하 / 1–3만원 / 3만원 이상
   - "무료" 칩이 선택되면 미세하게 라임 외곽선 강조

   **D. 날짜 (Date)**
   - 칩: 전체 / 오늘 / 이번 주 / 이번 달 / 직접 선택
   - "직접 선택" 탭 시 캘린더 모달 노출 (date range)

3. **BottomSticky CTA**
   - "적용하기" 버튼 (full width, `accent` 배경, `onAccent` 텍스트, 높이 56)

**상태:**
- 모든 칩은 multi-select 가능 (지역·날짜는 single-select)
- "전체" 선택 시 다른 칩들 자동 해제
- 적용 시 결과 카운트 표시: "결과 28개 보기" (선택값 있을 때)

### 5.7 SavedScreen — 저장함 (06)

(이전 명세와 동일, 5.3 참조)
- 헤더 "저장함" + "편집"
- 필터 칩: 전체 12 / 전시 5 / 공연 3 / 행사 2 / 공간 2
- 2열 그리드 카드 (5:6 비율, 무료/예약 뱃지 + 좋아요 카운트)

### 5.8 ItineraryScreen — 나의 일정 (07)

마이 → "나의 일정" 메뉴에서 진입.

**구조:**

1. **TopBar** (백 + 타이틀 "나의 일정")
2. **TabRow**
   - 예정 (3) / 지난 일정 (8)
   - 활성 탭: 라벨 bold + 하단 라임 인디케이터
3. **List (날짜 그룹)**
   - 그룹 헤더: "오늘 · 5.20" (caption, accent)
   - 일정 카드 (각 행):
     - 시간 (caption, h3급): "10:00 – 18:00"
     - 제목 (h3): "MMCA 현대차 시리즈 2024"
     - 부제목 (caption muted): "국립현대미술관 서울"
     - 우상단 뱃지: "예약" (accent) 또는 "무료"
     - 하단 디바이더 (`borderSubtle`)
4. **빈 상태**
   - 5.12 EmptyState 패턴 사용

### 5.9 MyScreen — 마이 (08)

탭바 마이.

**구조 (시안 기준):**

1. **Header** — "설정" *(또는 "마이")* (h1), 우상단: 알림 종 (`Bell`)
2. **ProfileCard** (full width 카드, `bgElevated`, padding 20)
   - 좌: 아바타 (60px 원형, 보라→핑크 그라데이션 fallback)
   - 우: 닉네임 (h2) — `@yujin_` 형식 + "프로필 편집" 텍스트 링크
3. **StatsRow** (3개 균등 분할, 디바이더 세로선)
   - 저장한 콘텐츠 / **128**
   - 방문한 곳 / **36**
   - 팔로워 / **24**
   - 숫자는 numberLarge, 라벨은 caption muted
   - 카드 탭 시 해당 리스트로 이동
4. **메뉴 리스트** (각 행: 라벨 + 우측 chevron)
   - `Calendar` 나의 일정 → ItineraryScreen
   - `Clock` 최근 본 콘텐츠
   - `Bell` 알림
   - `Info` 이용 안내
   - `MessageCircle` 문의하기
5. **BottomTabBar** (마이 활성)

### 5.10 SettingsScreen — 설정 (09)

마이 헤더의 톱니바퀴 또는 메뉴에서 진입.

**구조:**

1. **TopBar** (백 + 타이틀 "설정")
2. **섹션 — 알림**
   - "알림 설정" (chevron) → 상세 알림 화면
   - "관심 카테고리 관리" (chevron)
   - "기본 지역 설정" — 우측 값 "서울" + chevron
3. **섹션 — 토글**
   - 푸시 알림 (`Switch`, default ON, accent track)
   - 이벤트 알림 (`Switch`, default ON)
   - 마케팅 정보 수신 (`Switch`, default OFF)
4. **섹션 — 정보**
   - 앱 정보 — 우측 값 "버전 1.0.0"
   - 로그아웃 (텍스트만, danger 컬러)

**Switch 컴포넌트 스타일:**
- ON: 트랙 `accent`, 썸 흰색
- OFF: 트랙 `bgRaised`, 썸 `textMuted`

### 5.11 OnboardingScreen — 온보딩 (11)

최초 진입 시 노출 (`isOnboarded === false`).

**구조 (시안 기준):**

1. **풀스크린 그라데이션 배경**
   - 우상단에서 좌하단으로: 라임(투명 30%) → 보라 → 핑크 → 검정
   - 미세한 노이즈 텍스처 오버레이 (5% opacity)
2. **메인 카피 (좌측 정렬, 화면 중앙)**
   - 작은 키커: 없음
   - **메인 타이틀** (h1급 32~36px bold):
     ```
     좋은 문화는
     누구에게나
     열려 있어야 하니까
     ```
   - 한 줄씩 단계적 페이드인 애니메이션 (200ms 간격)
3. **서브 카피** (메인 아래 24px 간격)
   - body, `textSecondary`, line-height 1.6
   - "무료로 즐길 수 있는\n다양한 문화생활을 발견해보세요."
4. **하단 영역** (하단 padding 40)
   - 좌: 진행 dots (3개, 활성은 길쭉한 막대 라임)
   - 우: 화살표 FAB (원형, `accent` 배경, `ArrowRight` 아이콘 `onAccent`)

**3단계 흐름:**
- 1단계: 위 카피 ("좋은 문화는…")
- 2단계: "내 주변에서, 지금 바로" — 위치 권한 요청
- 3단계: 관심 카테고리 선택 (6개 토글) → "시작하기"

### 5.12 EmptyState — 빈 상태 패턴 (12)

저장함 / 일정 / 검색결과 / 알림이 비었을 때 공통 사용.

**구조:**

1. **Illustration** (200×200)
   - 다크 톤 isometric 일러스트 또는 아이콘
   - 시안에서는 박스+북마크 일러스트 (저장함 비었을 때)
2. **Title** (h2, `textPrimary`)
   - 예: "저장한 콘텐츠가 아직 없어요"
3. **Description** (body, `textSecondary`, 가운데 정렬, 2줄)
   - 예: "마음에 드는 콘텐츠를 저장하고\n나만의 리스트를 만들어보세요."
4. **CTA Button** (선택적)
   - "콘텐츠 둘러보기" (`accent` 배경, full width 또는 auto)
   - 탭 시 피드 탭으로 이동

**컴포넌트 시그니처:**
```tsx
<EmptyState
  illustration="bookmark-empty"   // 'bookmark-empty' | 'search-empty' | 'calendar-empty' | 'bell-empty'
  title="저장한 콘텐츠가 아직 없어요"
  description="마음에 드는 콘텐츠를 저장하고 나만의 리스트를 만들어보세요."
  cta={{ label: '콘텐츠 둘러보기', onPress: () => navigate('Feed') }}
/>
```

### 5.13 NotificationsScreen — 알림 (10)

마이 헤더 종 또는 피드 종에서 진입.

1. **TopBar** (백 + 타이틀 "알림" + 설정 아이콘)
2. **List**
   - 그룹 헤더 ("오늘", "어제", "이번 주")
   - 알림 행: 미읽 dot (`accent`) + 태그 라벨 + 제목 + 본문 + 시간
3. **빈 상태**: 5.12 EmptyState 사용 (illustration: bell-empty)

### 5.14 ReviewWriteScreen — 후기 작성 (옵션)

FAB → 액션시트 → "후기 작성" 선택 시 (MVP에서는 후순위).
- 별점 (5개 별, 탭으로 평점)
- 사진 추가 (최대 5장, expo-image-picker)
- 한 줄 평 (input)
- 상세 후기 (textarea)
- 제출 버튼 (`accent`)

---

## 6. 컴포넌트 라이브러리

`/components` 폴더에 모두 모음.

```
components/
├── primitives/
│   ├── Text.tsx          // typography 토큰 prop
│   ├── Pressable.tsx     // haptic feedback 포함
│   └── Icon.tsx          // lucide wrapper
├── badges/
│   ├── FreeBadge.tsx     // "무료" — accent 배경
│   └── ReservationBadge.tsx // "예약"
├── cards/
│   ├── FeaturedCard.tsx
│   ├── NearbyCard.tsx    // 정사각형, 그리드용
│   ├── SavedCard.tsx     // 5:6 비율, SavedScreen용
│   └── StatCard.tsx      // 통계 카드 (variant: highlight | normal)
├── filters/
│   ├── CategoryRow.tsx
│   └── FilterPill.tsx
├── headers/
│   ├── Header.tsx
│   ├── SectionHeader.tsx // "오늘의 추천 더보기 >"
│   └── HeroHeader.tsx    // DetailScreen용
├── nav/
│   ├── BottomTabBar.tsx  // 5탭 + 중앙 FAB
│   └── FAB.tsx
└── feedback/
    ├── EmptyState.tsx
    └── Skeleton.tsx
```

### 6.1 핵심 컴포넌트 시그니처

```typescript
// FreeBadge.tsx
type Props = { variant?: 'free' | 'reservation' | 'cheap' };
export const FreeBadge = ({ variant = 'free' }: Props) => { /* ... */ };

// FeaturedCard.tsx
type Props = {
  item: Event;
  onPress: () => void;
  onDismiss?: () => void;
  onFavorite?: () => void;
};

// NearbyCard.tsx
type Props = {
  item: Event;
  onPress: () => void;
  size?: 'sm' | 'md';
};

// StatCard.tsx
type Props = {
  label: string;     // "오늘 무료"
  value: number;     // 12
  caption: string;   // "지금 예약 가능"
  highlight?: boolean; // accent 배경 여부
};

// CategoryRow.tsx
type Category = '전체' | '전시' | '공연' | '클래스' | '행사' | '공간';
type Props = {
  selected: Category;
  onSelect: (c: Category) => void;
};
```

---

## 7. 데이터 모델

`/types/index.ts`

```typescript
export type Category = '전체' | '전시' | '공연' | '클래스' | '행사' | '공간';

export type PriceTier = 'free' | 'cheap' | 'mid';   // 무료 / 1만원↓ / 2만원↓

export type Event = {
  id: string;
  title: string;             // "MMCA 현대차 시리즈 2024"
  subtitle: string;          // "국립현대미술관 서울"
  category: Category;
  priceTier: PriceTier;
  priceLabel: string;        // "무료" | "8,000원" 등
  reservationRequired: boolean;
  thumbnail: string;         // URL
  images: string[];
  description: string;       // 2~3 문단
  hashtags: string[];        // ["현대미술", "전시추천", "무료전시"]
  location: {
    address: string;
    lat: number;
    lng: number;
  };
  distanceKm?: number;       // 사용자 위치 기반 계산
  schedule: {
    startDate: string;       // ISO
    endDate: string;
    operatingHours: string;  // "10:00–18:00"
    closedDays: string;      // "매주 월요일"
  };
  rating: number;            // 0~5
  reviewCount: number;
  favoriteCount: number;
  reservationUrl?: string;
};

export type SavedEvent = {
  eventId: string;
  savedAt: string;
};

export type Notification = {
  id: string;
  type: 'reminder' | 'today_pick' | 'story' | 'urgent';
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  eventId?: string;
};

export type User = {
  id: string;
  nickname: string;          // "고래"
  handle: string;            // "@AVIATE8"
  district: string;          // "마포구"
  interests: Category[];
  budgetTier: PriceTier;
  visitedCount: number;
  upcomingCount: number;
  reviewCount: number;
};
```

---

## 8. API 엔드포인트 (또는 Mock)

> MVP는 mock JSON 파일로 시작. `/mocks/events.json` 등에 더미 데이터 30개 작성.
> 실제 백엔드 붙기 전까지 `apiClient`가 mock을 리턴하도록 추상화.

```typescript
// services/api.ts
export const api = {
  // Feed
  getFeed: (category?: Category) => Promise<Event[]>;
  getFeatured: () => Promise<Event>;            // 오늘의 추천 1개
  getNearby: (lat: number, lng: number) => Promise<Event[]>;
  getStats: () => Promise<{ free: number; cheap: number; weekend: number }>;

  // Detail
  getEvent: (id: string) => Promise<Event>;

  // Saved
  getSaved: () => Promise<Event[]>;
  toggleSaved: (eventId: string) => Promise<boolean>;

  // Search
  search: (query: string) => Promise<Event[]>;
  getTrending: () => Promise<{ keyword: string; count: number }[]>;

  // Notifications
  getNotifications: () => Promise<Notification[]>;
  markRead: (id: string) => Promise<void>;

  // User
  getMe: () => Promise<User>;
  updateInterests: (cats: Category[]) => Promise<User>;
};
```

---

## 9. 상태 관리

### 9.1 Zustand Stores

```typescript
// stores/authStore.ts
type AuthState = {
  user: User | null;
  isOnboarded: boolean;
  setUser: (u: User) => void;
  completeOnboarding: () => void;
};

// stores/feedStore.ts
type FeedState = {
  selectedCategory: Category;
  setCategory: (c: Category) => void;
};

// stores/savedStore.ts
type SavedState = {
  savedIds: Set<string>;
  toggle: (id: string) => void;
  has: (id: string) => boolean;
};
```

### 9.2 TanStack Query

서버 데이터는 React Query 사용:
- `useFeed(category)`, `useFeatured()`, `useNearby()`, `useStats()`
- `useEvent(id)`, `useSaved()`
- 5분 staleTime, persist는 AsyncStorage

---

## 10. 폴더 구조

```
poomgyeok/
├── App.tsx                      // 루트, NavigationContainer
├── app.json                     // Expo config
├── /assets
│   ├── /fonts                   // Pretendard-Regular/Medium/SemiBold/Bold.otf
│   ├── /images                  // 로고, 더미 이미지
│   └── /icons
├── /src
│   ├── /screens
│   │   ├── FeedScreen.tsx
│   │   ├── DetailScreen.tsx
│   │   ├── SavedScreen.tsx
│   │   ├── MapScreen.tsx
│   │   ├── ProfileScreen.tsx
│   │   ├── SearchScreen.tsx
│   │   ├── NotificationsScreen.tsx
│   │   ├── OnboardingScreen.tsx
│   │   └── ReviewWriteScreen.tsx
│   ├── /components              // §6 참조
│   ├── /navigation
│   │   ├── RootNavigator.tsx    // Auth/Onboarding/Main
│   │   ├── MainTabs.tsx         // 5탭 + FAB
│   │   └── linking.ts           // deep linking
│   ├── /stores                  // Zustand
│   ├── /hooks                   // useEvent, useSaved, useLocation
│   ├── /services
│   │   ├── api.ts
│   │   └── storage.ts
│   ├── /theme
│   │   ├── colors.ts
│   │   ├── typography.ts
│   │   └── index.ts
│   ├── /types
│   ├── /utils
│   │   ├── distance.ts          // Haversine 공식
│   │   ├── date.ts              // dayjs wrapper, D-day 계산
│   │   └── format.ts            // 가격 포맷
│   └── /mocks
│       ├── events.json
│       ├── notifications.json
│       └── user.json
└── package.json
```

---

## 11. 구현 단계 (Phased Build)

> 에이전트는 이 순서대로 빌드한다. 각 단계 끝에 빌드 가능 상태 유지.

### Phase 1 — 기반 (Day 1)
1. `npx create-expo-app poomgyeok --template blank-typescript`
2. Pretendard 폰트 등록 (`expo-font`)
3. `theme/` 폴더 (colors, typography, space, radius)
4. `components/primitives/Text.tsx` 작성 (variant prop)
5. `components/primitives/Icon.tsx` (lucide wrapper)
6. `App.tsx`에서 폰트 로드 + dark statusBar
7. **결과**: 다크 배경에 "0원의 품격" 한 줄 출력

### Phase 2 — 네비게이션 (Day 1~2)
1. React Navigation 설치 + 설정
2. `MainTabs.tsx` — 5탭 + 가운데 FAB
3. `BottomTabBar.tsx` 커스텀 컴포넌트
4. 각 탭에 빈 placeholder 화면
5. **결과**: 탭 5개 동작, FAB 탭 시 액션 시트 (TODO)

### Phase 3 — 디자인 시스템 컴포넌트 (Day 2~3)
1. `FreeBadge`, `FilterPill`, `SectionHeader`
2. `StatCard` (highlight + normal)
3. `FeaturedCard`, `NearbyCard`, `SavedCard`
4. Storybook 또는 데모 화면에서 검증
5. **결과**: 모든 카드 컴포넌트가 mock 데이터로 렌더링

### Phase 4 — Mock 데이터 + API 추상 (Day 3)
1. `/mocks/events.json` — 30개 이벤트 (다양한 카테고리)
2. `services/api.ts` — mock 리턴
3. TanStack Query 설치 + Provider
4. `hooks/useFeed.ts` 등 작성
5. **결과**: API 추상이 동작, 어디서든 데이터 호출 가능

### Phase 5 — FeedScreen (Day 4)
1. Header + Subtitle + CategoryRow
2. Featured 영역 (`useFeatured`)
3. StatsRow (`useStats`)
4. NearbyGrid (`useNearby`)
5. Pull-to-refresh + skeleton 로딩
6. **결과**: 시안과 일치하는 피드 화면

### Phase 6 — DetailScreen (Day 5)
1. HeroImage + transparent topBar
2. 메타데이터 (제목, 별점, InfoGrid)
3. 설명 + 해시태그
4. MapPreview (react-native-maps)
5. Sticky BottomActions
6. **결과**: 피드에서 카드 탭 → 상세 진입 동작

### Phase 7 — SavedScreen (Day 6)
1. Zustand `savedStore` + AsyncStorage persist
2. FilterRow + Grid
3. DetailScreen에서 저장하기 토글 → SavedScreen 반영
4. **결과**: 저장/해제 + 필터 동작

### Phase 8 — MapScreen + ProfileScreen (Day 7)
1. Map: 다크 스타일 + 핀 + BottomSheet
2. Profile: ProfileCard + StatsRow + MenuList
3. **결과**: 5탭 모두 컨텐츠 있음

### Phase 9 — Stack 화면들 (Day 8)
1. SearchScreen (모달)
2. NotificationsScreen
3. OnboardingScreen (최초 실행 시)
4. **결과**: 부가 화면 완성

### Phase 10 — 마감 (Day 9~10)
1. 위치 권한 (expo-location)
2. 거리 계산 (Haversine)
3. Push 알림 (expo-notifications)
4. 접근성: accessibilityLabel 전면 적용
5. 다크모드 색 대비 검증 (WCAG AA)
6. iOS/Android 빌드 테스트

---

## 12. 핵심 화면 구현 가이드 (코드 시작점)

### 12.1 FeedScreen 골격

```tsx
// screens/FeedScreen.tsx
import { ScrollView, View, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFeatured, useStats, useNearby } from '@/hooks';
import { useFeedStore } from '@/stores/feedStore';
import { Text, Header, CategoryRow, SectionHeader,
         FeaturedCard, StatCard, NearbyCard } from '@/components';
import { colors, space } from '@/theme';

export const FeedScreen = ({ navigation }) => {
  const category = useFeedStore(s => s.selectedCategory);
  const setCategory = useFeedStore(s => s.setCategory);
  const { data: featured } = useFeatured();
  const { data: stats } = useStats();
  const { data: nearby = [] } = useNearby();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        refreshControl={<RefreshControl tintColor={colors.accent} />}
        contentContainerStyle={{ paddingBottom: space.xxxl }}
      >
        {/* 1. Header */}
        <Header
          title={<BrandTitle />}  // "0원의 품격" — "0"만 accent
          rightAction={{ icon: 'Bell', onPress: () => navigation.navigate('Notifications') }}
        />
        {/* 2. Subtitle */}
        <Text variant="body" color="textSecondary" style={{ paddingHorizontal: space.lg }}>
          지금 무료로 즐길 수 있는 문화생활을 추천하세요.
        </Text>
        {/* 3. CategoryRow */}
        <CategoryRow selected={category} onSelect={setCategory} />
        {/* 4. SectionHeader 오늘의 추천 */}
        <SectionHeader title="오늘의 추천" actionLabel="더보기" onAction={() => {}} />
        {/* 5. FeaturedCard */}
        {featured && <FeaturedCard item={featured} onPress={() => navigation.navigate('Detail', { id: featured.id })} />}
        {/* 6. StatsRow */}
        <View style={{ flexDirection: 'row', gap: space.sm, paddingHorizontal: space.lg }}>
          <StatCard label="오늘 무료" value={stats?.free ?? 0} caption="지금 예약 가능" highlight />
          <StatCard label="만원 이하" value={stats?.cheap ?? 0} caption="가성비 추천" />
          <StatCard label="주말 추천" value={stats?.weekend ?? 0} caption="이번 주말" />
        </View>
        {/* 7. SectionHeader 가까운 무료 공간 */}
        <SectionHeader title="가까운 무료 공간" actionLabel="전체보기" onAction={() => {}} />
        {/* 8. NearbyGrid */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm,
                       paddingHorizontal: space.lg }}>
          {nearby.map(item => (
            <NearbyCard key={item.id} item={item}
                        onPress={() => navigation.navigate('Detail', { id: item.id })} />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};
```

### 12.2 BrandTitle 구현

```tsx
const BrandTitle = () => (
  <Text variant="displayBold">
    <Text variant="displayBold" style={{ color: colors.accent }}>0</Text>
    원의 품격
  </Text>
);
```

### 12.3 FreeBadge

```tsx
export const FreeBadge = ({ variant = 'free' }: { variant?: 'free' | 'reservation' }) => {
  const label = variant === 'free' ? '무료' : '예약';
  return (
    <View style={{
      backgroundColor: colors.accent,
      paddingHorizontal: space.sm,
      paddingVertical: 4,
      borderRadius: radius.sm,
      alignSelf: 'flex-start',
    }}>
      <Text variant="tag" style={{ color: colors.onAccent }}>{label}</Text>
    </View>
  );
};
```

---

## 13. 접근성 체크리스트

- [ ] 모든 인터랙션 컴포넌트에 `accessibilityLabel`
- [ ] 터치 영역 최소 44×44pt
- [ ] 컬러 대비 WCAG AA 이상 (특히 `textMuted` on `bg`)
- [ ] `Heart`, `Bookmark` 등 토글 상태는 `accessibilityState={{ selected }}`
- [ ] FAB은 `accessibilityRole="button"` + 명확한 라벨
- [ ] 다이내믹 타입 (`allowFontScaling`) 본문은 허용, 숫자/뱃지는 고정
- [ ] 스크린리더 — 카테고리 칩 그룹은 `accessibilityRole="tablist"`

---

## 14. 인수 기준 (Definition of Done)

각 화면 PR이 머지되려면:

1. **시안 일치** — 컬러·간격·타이포 토큰 사용, 픽셀 단위 하드코딩 금지
2. **로딩/빈/에러 상태** — 3가지 모두 처리
3. **iOS/Android 둘 다** 빌드되고 동작
4. **TypeScript 에러 0개**
5. **접근성 라벨** 모든 터치 요소
6. **Pull-to-refresh** 데이터 화면 모두 적용
7. **Mock 데이터 30개** 이상으로 검증

---

## 15. 향후 (v2 이후, 이번 MVP 범위 밖)

- 라이트 모드
- 행사 제보 폼 (FAB → 제보)
- 친구 기능 / 소셜
- 푸시 알림 서버 연동
- 후기 사진 업로드 → S3
- 결제 연동 (저렴 행사 직접 결제)
- 다국어 (영어, 일본어)

---

## 16. 에이전트가 막힐 때

- 컬러는 항상 `colors.*` 토큰 사용. 절대 `#FF0000` 같은 직접 값 금지
- 폰트도 `typography.*` 토큰
- 스타일은 `StyleSheet.create()` 사용 (인라인 스타일은 동적인 경우만)
- 막히면 시안 캡처와 §5 (화면 명세) 다시 읽고, 그래도 모호하면 합리적 기본값을 정한 뒤 코드 주석에 `// DESIGN-DECISION:` 으로 남길 것
- 디자이너 시안에서 정확한 픽셀 값이 안 보이면 §3.3의 스페이싱 토큰 중 가장 가까운 값 사용

---

**End of Spec.**

> 에이전트, 시작해도 좋다. Phase 1부터.
