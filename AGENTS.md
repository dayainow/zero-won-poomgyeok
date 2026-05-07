# Agent Harness Pointer

This workspace is configured with a Harness-style agent team under `.claude/`.

Use `.claude/skills/app-delivery-orchestrator/SKILL.md` for app, website, full-stack feature, refactor, bugfix, integration, or QA work that benefits from multiple specialist agents. Use `.claude/skills/harness/SKILL.md` when creating, auditing, or evolving the harness itself.

The primary team is:

- `product-architect`: product intent, acceptance criteria, data contracts, implementation plan.
- `frontend-builder`: UI, client state, accessibility, responsive behavior.
- `backend-integrator`: APIs, data model, server logic, environment and integration boundaries.
- `qa-guardian`: tests, verification, build checks, cross-boundary regression review.

Keep intermediate multi-agent outputs in `_workspace/` so later agents can read prior findings without relying on chat history.

## Project Profile

- App name: `0원의품격`
- Package name: `zero-won-poomgyeok`
- Stack: Expo, React Native, TypeScript, Vercel serverless API.
- Seed domain: free public cultural places and library/event data.
- Design reference: `docs/poomgyeok-culture-design-spec.html`.

## Harness Engineering Loop

Use the simple loop from the harness engineering note:

1. GROUND: read the current files and contracts first.
2. APPLY: follow local patterns, preserve policy boundaries, and keep changes scoped.
3. VERIFY: run the smallest useful tool check, usually `npm run typecheck` after dependencies are installed.
4. ADAPT: if verification fails, diagnose the cause before changing approach.

Layer 1 guardrails live in `.claude/hooks/`. Layer 2 conventions live in this file and `CLAUDE.md`. Layer 3 specialist roles live in `.claude/agents/`.
