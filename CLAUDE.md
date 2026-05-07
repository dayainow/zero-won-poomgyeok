# Project Instructions

## 하네스: App Delivery

**목표:** `0원의품격` 앱/웹사이트/풀스택 기능을 제품 설계, 구현, 통합, QA까지 에이전트 팀으로 조율한다.

**트리거:** 앱 생성, 기능 구현, 버그 수정, 리팩터링, UI/프론트엔드/백엔드/API/QA가 함께 필요한 작업 요청 시 `app-delivery-orchestrator` 스킬을 사용하라. 단순 질문이나 작은 단일 파일 수정은 직접 응답 가능하다.

**실행 메모:** Claude Code Agent Teams를 사용할 때는 세션 시작 전에 `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`을 활성화한다. Agent Teams 도구가 없는 런타임에서는 같은 에이전트/스킬 파일을 기준으로 파일 기반 산출물(`_workspace/`)과 서브 에이전트 위임으로 폴백한다.

**하네스 엔지니어링:** 프롬프트 지시만 믿지 말고 `.claude/hooks/`의 guard, lint-fix, quality-gate를 우선한다. 기본 작업 루프는 GROUND -> APPLY -> VERIFY -> ADAPT다.

**프로젝트 메모:** UI/UX 레퍼런스는 `docs/poomgyeok-culture-design-spec.html`, 하네스 도입 메모는 `docs/harness-engineering.md`를 먼저 확인한다.

**변경 이력:**
| 날짜 | 변경 내용 | 대상 | 사유 |
|------|----------|------|------|
| 2026-04-22 | 초기 App Delivery 하네스 구성 | `.claude/agents`, `.claude/skills`, `CLAUDE.md` | 에이전트 협업 기반 작업 흐름 도입 |
| 2026-05-07 | `0원의품격` 새 앱 scaffold 및 하네스 엔지니어링 hook 도입 | `AGENTS.md`, `CLAUDE.md`, `.claude/hooks`, `docs/harness-engineering.md` | 새 앱에서도 동일한 App Delivery 품질 루프를 재사용 |
