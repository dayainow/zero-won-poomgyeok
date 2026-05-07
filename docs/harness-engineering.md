# 0원의품격 Harness Engineering

참고 글: https://yozm.wishket.com/magazine/detail/3733/

## 도입 방향

요즘IT 글의 핵심은 프롬프트만으로 에이전트 행동을 강제하지 않고, 실행 환경 자체를 설계하는 것입니다. 이 프로젝트는 `today-library`의 Harness-style agent team을 기반으로 하되, 새 앱을 만들 때 반복적으로 필요한 안전장치와 검증 지점을 명시적으로 둡니다.

## 3-Layer 구조

### Layer 1. Hooks

`.claude/hooks/`에 실행 가능한 스크립트를 둡니다.

- `guard.sh`: 위험한 Bash 명령을 사전에 차단합니다.
- `lint-fix.sh`: 파일 수정 후 가능한 자동 정리를 수행합니다.
- `quality-gate.sh`: 응답 종료 또는 서브 에이전트 종료 시 타입 체크와 lint를 시도합니다.
- `pre-compact.sh`: 컨텍스트 압축 전 브랜치와 변경 파일 상태를 남깁니다.

Claude Code에서는 `.claude/settings.json`의 hooks 설정으로 연결합니다. Codex처럼 hooks가 직접 실행되지 않는 런타임에서는 같은 정책을 `AGENTS.md`와 sandbox/approval 규칙으로 따릅니다.

### Layer 2. Shared Instructions

`AGENTS.md`는 Codex, Cursor, Claude 계열 런타임이 공통으로 읽을 수 있는 프로젝트 포인터입니다.

프로젝트 기본 루프는 아래처럼 유지합니다.

```text
GROUND -> APPLY -> VERIFY
  ^                 |
  |                 v
  +----- ADAPT <----+
```

- GROUND: 기억이 아니라 현재 파일을 읽고 판단합니다.
- APPLY: 기존 패턴을 따르고 최소 변경으로 구현합니다.
- VERIFY: `npm run typecheck`, lint, smoke check 등 도구로 확인합니다.
- ADAPT: 실패 원인을 좁힌 뒤 필요한 만큼만 다시 읽고 수정합니다.

### Layer 3. Specialist Agents

`.claude/agents/`와 `.claude/skills/`는 앱 개발 작업을 다음 역할로 나눕니다.

- `product-architect`: 요구사항, 사용자 흐름, 수용 기준, 데이터 계약
- `frontend-builder`: UI, client state, accessibility, responsive behavior
- `backend-integrator`: API, server logic, env/integration boundary
- `qa-guardian`: tests, build checks, regression review

중간 산출물은 `_workspace/`에 저장해서 다음 에이전트나 다음 세션이 이어받을 수 있게 합니다.

## 0원의품격에 맞춘 다음 단계

1. `docs/poomgyeok-culture-design-spec.html`의 데이터 후보를 product brief로 정리합니다.
2. 현재 `/api/libraries` seed를 `/api/events` 계약으로 확장합니다.
3. 공공 API별 normalizer를 `api/_lib/`에 분리합니다.
4. 무료/저렴/임박 상태를 클라이언트 타입에 추가합니다.
5. QA가 API shape, 빈 상태, 위치 권한, 캐시 fallback을 교차 검증합니다.
