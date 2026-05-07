---
name: product-analysis
description: "앱 기능의 요구사항 분석, 사용자 흐름, 범위/비범위, 수용 기준, 데이터 계약 초안 작성이 필요할 때 사용. 새 기능 기획, 구현 전 계획, 모호한 요청 정리, 이전 결과 보완 요청 시 반드시 사용."
---

# Product Analysis Skill

제품 의도를 구현 가능한 계약으로 바꾼다.

## 절차

1. 사용자 요청을 목표, 사용자, 주요 흐름, 제약으로 나눈다.
2. 기존 코드 구조와 이미 존재하는 기능을 확인한다.
3. 범위와 비범위를 짧게 구분한다.
4. 화면 상태와 데이터 shape를 함께 정의한다.
5. 수용 기준은 QA가 바로 테스트할 수 있는 문장으로 쓴다.
6. `_workspace/01_product_brief.md`에 결과를 저장한다.

## 산출물 형식

```markdown
# Product Brief

## Goal
## Scope
## Non-goals
## User Flow
## UI States
## Data Contract
## Acceptance Criteria
## Implementation Tasks
## Risks / Questions
```

## 좋은 기준

- 각 acceptance criterion은 관찰 가능한 동작이어야 한다.
- 데이터 계약은 field name, optional 여부, error shape를 포함한다.
- 질문은 구현을 막는 것만 남기고, 나머지는 추천 기본값으로 진행한다.
