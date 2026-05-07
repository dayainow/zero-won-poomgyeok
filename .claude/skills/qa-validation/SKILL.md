---
name: qa-validation
description: "구현 후 테스트, 타입체크, 린트, 빌드, 브라우저 검증, API-프론트엔드 계약 정합성, 접근성/반응형/회귀 위험 검토가 필요할 때 사용. QA, 검증, 테스트, 릴리스 전 점검, 이전 실패 재검증 요청 시 반드시 사용."
---

# QA Validation Skill

구현 결과가 수용 기준과 모듈 경계를 실제로 만족하는지 검증한다.

## 절차

1. `_workspace/01_product_brief.md`, `_workspace/02_backend_contract.md`, `_workspace/03_frontend_notes.md`를 읽는다.
2. 변경 파일을 확인하고 위험이 큰 경계를 찾는다.
3. repo의 package/test/build 명령을 확인한다.
4. 가능한 검증을 실행한다: typecheck, lint, test, build, browser smoke test.
5. API/client shape, error handling, loading/empty states, accessibility, responsive behavior를 교차 확인한다.
6. `_workspace/04_qa_report.md`에 결과를 남긴다.

## 산출물 형식

```markdown
# QA Report

## Commands Run
## Pass / Fail Summary
## Contract Checks
## Issues
## Reproduction
## Fix Recommendations
## Remaining Risk
```

## 이슈 작성 기준

- 심각도, 재현 단계, 기대 결과, 실제 결과를 포함한다.
- 단순 취향보다 수용 기준, 접근성, data contract, 회귀 위험을 우선한다.
- 검증하지 못한 항목은 통과로 표시하지 말고 remaining risk에 남긴다.
