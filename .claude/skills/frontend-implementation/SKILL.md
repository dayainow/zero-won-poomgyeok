---
name: frontend-implementation
description: "프론트엔드 UI, React/Next.js 컴포넌트, 상태 관리, API 연결, 접근성, 반응형 구현과 UI 버그 수정 시 사용. 화면 구현, 디자인 반영, 이전 UI 결과 보완 요청 시 반드시 사용."
---

# Frontend Implementation Skill

제품 brief와 backend contract를 실제 UI로 구현한다.

## 절차

1. 기존 컴포넌트, 라우팅, 스타일링, 데이터 fetching 패턴을 확인한다.
2. `_workspace/01_product_brief.md`와 `_workspace/02_backend_contract.md`를 읽는다.
3. UI 상태를 먼저 나열한다: loading, empty, error, success, disabled, permission-limited.
4. 기존 디자인 시스템과 컴포넌트 패턴을 우선 사용한다.
5. data shape mismatch가 있으면 backend-integrator에게 알리고 contract를 갱신한다.
6. 자체 검증 결과를 `_workspace/03_frontend_notes.md`에 남긴다.

## 구현 기준

- 텍스트가 버튼, 카드, 좁은 viewport에서 넘치지 않게 한다.
- interactive element에는 접근 가능한 이름과 상태를 제공한다.
- 레이아웃 shift를 줄이기 위해 반복 UI에는 안정적인 크기 제약을 둔다.
- 사용자가 바로 조작할 수 있는 화면을 우선한다.

## 산출물 형식

```markdown
# Frontend Notes

## Changed Files
## UI States Covered
## Data Dependencies
## Accessibility / Responsive Checks
## Known Gaps
```
