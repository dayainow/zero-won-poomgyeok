---
name: app-delivery-orchestrator
description: "앱/웹사이트/풀스택 기능 개발 하네스의 오케스트레이터. 새 앱 만들기, 기능 구현, 버그 수정, 리팩터링, UI/프론트엔드/백엔드/API/QA 협업, 재실행, 업데이트, 수정, 보완, 이전 결과 개선 요청 시 반드시 사용."
---

# App Delivery Orchestrator

앱 개발 작업을 제품 설계, 프론트엔드, 백엔드/통합, QA가 함께 처리하도록 조율한다.

## 실행 모드: 에이전트 팀 우선

Claude Code Agent Teams가 가능하면 `TeamCreate`, `TaskCreate`, `SendMessage`를 사용한다. 현재 런타임에 팀 도구가 없으면 같은 에이전트 정의를 기준으로 서브 에이전트 또는 병렬 위임을 사용하고, 모든 중간 산출물은 `_workspace/`에 저장한다.

## 에이전트 구성

| 팀원 | 역할 | 연결 스킬 | 주요 출력 |
|------|------|-----------|-----------|
| product-architect | 요구사항, 사용자 흐름, 수용 기준, 데이터 계약 | product-analysis | `_workspace/01_product_brief.md` |
| backend-integrator | API, server logic, data contract, env/integration | backend-integration | `_workspace/02_backend_contract.md` |
| frontend-builder | UI, client state, responsive/a11y implementation | frontend-implementation | `_workspace/03_frontend_notes.md` |
| qa-guardian | tests, build, contract verification, regression review | qa-validation | `_workspace/04_qa_report.md` |

## 워크플로우

### Phase 0: 컨텍스트 확인

1. `_workspace/` 존재 여부를 확인한다.
2. 사용자가 부분 수정, 재실행, 업데이트를 요청했으면 관련 이전 산출물을 먼저 읽는다.
3. 새 입력으로 전체 재실행이 필요하면 이전 `_workspace/`를 보존할 이름으로 옮긴 뒤 새 `_workspace/`를 만든다.

### Phase 1: 제품/계약 정리

1. product-architect가 repo 구조와 사용자 요청을 분석한다.
2. `_workspace/01_product_brief.md`에 목표, 범위, 비목표, 사용자 흐름, 수용 기준, 데이터 계약 초안을 작성한다.
3. 모호성이 구현 위험으로 이어질 때만 사용자에게 짧게 질문한다. 그렇지 않으면 보수적인 기본값을 선택한다.

### Phase 2: 병렬 구현

1. backend-integrator는 필요한 API, data access, server action, validation, env 경계를 구현하거나 정리한다.
2. frontend-builder는 UI, state, loading/empty/error states, responsive/a11y behavior를 구현한다.
3. 계약 변경이 생기면 두 구현 에이전트가 서로 알리고 `_workspace/02_backend_contract.md`와 `_workspace/03_frontend_notes.md`를 갱신한다.

### Phase 3: 교차 검증

1. qa-guardian이 product brief, backend contract, frontend notes, 변경 파일을 읽는다.
2. API/client data shape, error shape, auth/permission, loading/error UI, accessibility, responsive behavior를 교차 확인한다.
3. repo에 맞는 검증 명령을 실행한다. 명령이 없거나 환경이 막히면 이유와 남은 위험을 기록한다.

### Phase 4: 수정 루프

1. QA 실패가 있으면 해당 구현 에이전트가 실패 항목만 수정한다.
2. 계약 변경이 동반되면 product-architect가 brief를 갱신한다.
3. qa-guardian은 실패 항목을 재검증하고 `_workspace/04_qa_report.md`를 업데이트한다.

### Phase 5: 최종 보고

1. 변경 파일, 검증 결과, 남은 위험을 요약한다.
2. 하네스 자체가 바뀌었으면 `CLAUDE.md` 변경 이력에 날짜와 이유를 남긴다.
3. `_workspace/`는 삭제하지 않는다.

## 데이터 흐름

```text
사용자 요청
  -> product-architect: _workspace/01_product_brief.md
  -> backend-integrator: _workspace/02_backend_contract.md
  -> frontend-builder: _workspace/03_frontend_notes.md
  -> qa-guardian: _workspace/04_qa_report.md
  -> 오케스트레이터 최종 통합
```

## 에러 핸들링

| 상황 | 전략 |
|------|------|
| 스택이 비어 있거나 불명확 | product-architect가 scaffold 후보와 추천안을 기록하고, 구현은 최소 변경으로 시작한다. |
| 프론트/백엔드 계약 충돌 | 두 산출물에 충돌을 표시하고 product-architect가 단일 계약으로 정리한다. |
| 테스트 환경 없음 | qa-guardian이 가능한 정적 검증과 수동 체크리스트를 남긴다. |
| 팀원 작업 실패 | 1회 재시도 후 실패 영역을 최종 보고의 잔여 위험으로 명시한다. |
| 외부 서비스 접근 불가 | backend-integrator가 mock boundary와 필요한 env를 기록한다. |

## 테스트 시나리오

### 정상 흐름

1. 사용자가 "로그인 화면과 API 연결 구현해줘"라고 요청한다.
2. product-architect가 흐름과 수용 기준을 작성한다.
3. backend-integrator와 frontend-builder가 병렬 구현한다.
4. qa-guardian이 API/client shape와 UI 상태를 검증한다.
5. 최종 응답에는 변경 요약, 검증 명령, 남은 위험이 포함된다.

### 에러 흐름

1. backend-integrator가 env 미설정으로 외부 API 검증을 못 한다.
2. mock 가능한 경계와 필요한 env 이름을 `_workspace/02_backend_contract.md`에 기록한다.
3. frontend-builder는 mock boundary를 명확히 표시하고 UI 흐름을 구현한다.
4. qa-guardian은 미검증 외부 연동을 잔여 위험으로 보고한다.
