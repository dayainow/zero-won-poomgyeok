# 0원의품격

GitHub / npm / Expo project slug: `zero-won-poomgyeok`

0원으로 즐길 수 있는 전시, 공연, 도서관 행사, 공공 문화공간을 찾는 Expo MVP입니다.

이 폴더는 `today-library`와 같은 기술 스펙으로 시작합니다.

- Expo / React Native / TypeScript
- Vercel serverless API
- 공공데이터 캐시 JSON + 앱 내장 fallback
- 위치 기반 거리 정렬
- 검색, 필터, 즐겨찾기 로컬 저장
- 전화, 홈페이지, 외부 지도 길찾기 연결
- `.claude` 기반 App Delivery 하네스

## 디자인 스펙

초기 UI/UX 레퍼런스는 `docs/poomgyeok-culture-design-spec.html`에 포함했습니다.

현재 코드는 `today-library`의 검증된 앱 구조를 seed로 가져온 상태라, 첫 실행 가능한 데이터셋은 공공도서관입니다. 다음 구현 단계에서 한국문화정보원 공연전시정보, KOPIS, TourAPI, 서울 열린데이터광장 문화행사, 정보나루 행사 데이터를 같은 API 경계로 추가하면 됩니다.

## 실행

```shell
source ~/.nvm/nvm.sh
nvm use 20
npm install
npm run ios
npm run android
```

Expo Go로 확인하려면:

```shell
npm start
```

## 공공데이터 캐시 API

앱은 공공데이터 API 키를 직접 들고 있지 않습니다. Vercel serverless 함수가 공공데이터를 가져와 `/api/libraries` JSON으로 노출하고, 응답에는 하루 CDN 캐시를 겁니다.

```shell
cp .env.example .env.local
```

`.env.local`에 아래 값을 채웁니다.

```shell
PUBLIC_DATA_SERVICE_KEY=공공데이터포털_인증키
CRON_SECRET=긴_랜덤_문자열
PUBLIC_APP_URL=https://your-vercel-domain.vercel.app
EXPO_PUBLIC_LIBRARY_API_URL=https://your-vercel-domain.vercel.app/api/libraries
```

로컬에서 API만 확인하려면:

```shell
npm run api:dev
curl http://localhost:3000/api/libraries
```

앱을 로컬 API에 붙여 보려면 `EXPO_PUBLIC_LIBRARY_API_URL=http://localhost:3000/api/libraries`로 설정한 뒤 Expo를 다시 시작합니다.

## 하네스 엔지니어링

이 프로젝트는 프롬프트 지시만 믿지 않고, 작업 흐름과 검증 환경이 품질을 강제하도록 구성했습니다.

- Layer 1: `.claude/hooks/`의 실행 가드와 품질 게이트
- Layer 2: `AGENTS.md`와 `CLAUDE.md`의 멀티 모델 공용 컨벤션
- Layer 3: `.claude/agents/`와 `.claude/skills/`의 specialist team

자세한 도입 메모는 `docs/harness-engineering.md`를 보세요.
