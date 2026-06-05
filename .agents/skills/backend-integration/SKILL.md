---
name: backend-integration
description: "API, server action, route handler, data model, validation, auth, env var, external service integration 구현 또는 수정 시 사용. 프론트엔드와 데이터 계약을 맞추거나 서버 버그를 고칠 때 반드시 사용."
---

# Backend Integration Skill

프론트엔드가 사용할 수 있는 안정적인 서버/데이터 경계를 만든다.

## 절차

1. 기존 backend, API, data access, auth, validation 패턴을 확인한다.
2. `_workspace/01_product_brief.md`를 읽고 필요한 data contract를 정한다.
3. endpoint/action별 request, response, error shape를 작성한다.
4. env var, external service, persistence 요구사항을 기록한다.
5. 구현 후 frontend-builder와 field name, optional 값, error 상태를 교차 확인한다.
6. `_workspace/02_backend_contract.md`를 갱신한다.

## 산출물 형식

```markdown
# Backend Contract

## Endpoints / Actions
## Request Shape
## Response Shape
## Error Shape
## Auth / Permission
## Env / External Services
## Fixtures / Seeds
## Risks
```

## 검증 기준

- 입력 검증과 권한 조건을 명시한다.
- 실패 응답도 UI가 처리할 수 있는 형태로 정의한다.
- destructive data change 가능성이 있으면 별도 경고한다.
