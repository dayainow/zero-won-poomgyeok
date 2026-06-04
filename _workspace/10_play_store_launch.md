# Play Store 출시 가이드 (이슈 2)

## 완료된 준비물

- 개인정보처리방침 URL: `https://zero-won-poomgyeok.vercel.app/privacy-policy.html`
- 앱 설정 > 개인정보 처리 메뉴에서 위 URL 연결
- EAS production 프로필: Android App Bundle(`.aab`) + 프로덕션 API URL env

## 1. Play Console — 앱 만들기

1. [Google Play Console](https://play.google.com/console) → **앱 만들기**
2. 앱 이름: **0원의품격**
3. 기본 언어: **한국어**
4. 앱 / 게임: **앱**
5. 무료 / 유료: **무료**

## 2. 스토어 등록정보 (복붙용)

### 앱 이름
`0원의품격`

### 짧은 설명 (80자 이내)
`서울 무료·저렴한 문화행사와 도서관을 지도에서 찾고, 저장하고, 후기를 남기세요.`

### 전체 설명
```
0원의품격은 서울의 무료·저렴한 문화생활을 한곳에서 찾는 앱입니다.

■ 이런 분께 추천해요
· 주말에 갈 만한 무료 전시·공연을 빠르게 찾고 싶을 때
· 집 근처 도서관·문화공간을 지도에서 보고 싶을 때
· 다녀온 곳 후기를 남기고 다른 사람의 경험도 참고하고 싶을 때

■ 주요 기능
· 서울 문화행사 피드 — 카테고리·지역·가격·날짜 필터
· 지도 탐색 — 내 위치 기준 가까운 행사 보기
· 저장함 — 가고 싶은 행사 저장
· 후기 — 다녀온 행사 평점·코멘트 작성
· 로그인 — 이메일 또는 카카오 간편 로그인

■ 데이터 및 권한
· 위치 권한: 가까운 행사 추천 및 지도 표시 (선택)
· 계정 정보: 저장함·후기 동기화

■ 문의
privacy@olalab.kr
https://olalab.kr
```

### 카테고리
- **앱 카테고리**: 지도 및 내비게이션 (또는 여행 및 지역)
- **태그**: 문화, 전시, 공연, 도서관, 무료, 서울

### 연락처
- 이메일: `privacy@olalab.kr`
- 웹사이트: `https://olalab.kr`
- 개인정보처리방침 URL: `https://zero-won-poomgyeok.vercel.app/privacy-policy.html`

## 3. 그래픽 에셋 체크리스트

| 항목 | 규격 | 상태 |
|------|------|------|
| 앱 아이콘 | 512×512 PNG | `./assets/icon.png` 사용 |
| 스크린샷 (휴대전화) | 최소 2장, 권장 4~8장 | **직접 캡처 필요** |
| 기능 그래픽 | 1024×500 JPG/PNG | **제작 필요** (선택) |

권장 캡처 화면: 홈 피드, 지도, 행사 상세, 후기 작성, 저장함, 로그인

## 4. 콘텐츠 등급 (IARC)

설문 시 아래 기준으로 답변:

| 질문 유형 | 답변 |
|-----------|------|
| 폭력·성적·약물·도박 콘텐츠 | 없음 |
| 사용자 간 상호작용 | **예** (후기 UGC) |
| 위치 공유 | **예** (선택적 위치 권한) |
| 디지털 구매 | **아니오** (무료 앱) |
| 광고 | **아니오** (MVP 기준) |

예상 등급: **전체이용가** 또는 **3세 이상** (한국)

## 5. 데이터 보안 설문 (Data safety)

Play Console > **앱 콘텐츠** > **데이터 보안**

### 수집 여부: **예, 사용자 데이터를 수집합니다**

| 데이터 유형 | 수집 | 공유 | 목적 | 필수/선택 |
|-------------|------|------|------|-----------|
| 이메일 주소 | 예 | 아니오 | 계정 관리 | 필수(가입 시) |
| 사용자 ID | 예 | 아니오 | 계정 관리 | 필수 |
| 위치 (대략/정확) | 예 | 아니오 | 앱 기능 | **선택** |
| 사용자 생성 콘텐츠 (후기) | 예 | 아니오 | 앱 기능 | 선택 |
| 앱 활동 (저장·검색) | 예 | 아니오 | 앱 기능 | 선택 |
| 진단 (크래시 로그) | 아니오* | — | — | — |

\* Sentry 미연동 기준. 추후 연동 시 업데이트 필요.

### 데이터 처리
- 전송 중 암호화: **예** (HTTPS)
- 사용자 삭제 요청 가능: **예** (이메일 문의)
- 독립적인 보안 검토: **아니오**

### 제3자
- Supabase (인증·DB)
- Vercel (API 호스팅)
- Kakao (소셜 로그인, 지도 API — 해당 기능 사용 시)

## 6. EAS Android 프로덕션 빌드

### 사전: EAS Secrets 등록 (Expo Dashboard 또는 CLI)

아래는 **민감 키** — `eas.json`이 아닌 EAS Secrets에 등록:

```bash
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "https://....supabase.co"
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY --value "sb_publishable_..."
```

`eas.json` production env에 이미 포함된 값:
- `EXPO_PUBLIC_APP_URL`
- `EXPO_PUBLIC_EVENTS_API_URL`
- `EXPO_PUBLIC_PRIVACY_POLICY_URL`

### 빌드 명령

```bash
# EAS CLI 설치·로그인 (최초 1회)
npm install -g eas-cli
eas login

# 프로덕션 AAB 빌드
eas build --platform android --profile production
```

빌드 완료 후 Expo 대시보드에서 `.aab` 다운로드.

### 내부 테스트 트랙 업로드

```bash
eas submit --platform android --profile production
```

또는 Play Console > **테스트** > **내부 테스트** > 새 버전 만들기 > `.aab` 업로드

## 7. 출시 전 최종 확인

- [ ] 개발자 신원 인증 **승인** 완료
- [ ] 개인정보처리방침 URL 브라우저에서 열림
- [ ] 실기기: 로그인 → 후기 작성 → 상세 노출
- [ ] Play Console 스토어 등록정보·스크린샷·데이터 보안·콘텐츠 등급 완료
- [ ] `.aab` 내부 테스트 설치 후 크래시 없음

## 8. olalab.kr에 방침 페이지 미러 (선택)

Play Console에는 Vercel URL로도 등록 가능합니다.  
olalab.kr에도 동일 내용을 올리려면 `public/privacy-policy.html` 내용을 사이트에 복사하거나  
`https://zero-won-poomgyeok.vercel.app/privacy-policy.html` 로 리다이렉트하면 됩니다.
