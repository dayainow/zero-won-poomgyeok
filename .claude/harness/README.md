# Harness Setup

This project has a local Harness-style setup based on `revfactory/harness`, adapted for `0원의품격`.

## What Is Installed

- `.claude/agents/`: reusable specialist agent definitions.
- `.claude/skills/`: project-local skills and the team orchestrator.
- `.claude/hooks/`: command guardrails and quality gates.
- `CLAUDE.md`: a small new-session pointer so the orchestrator can be rediscovered.
- `AGENTS.md`: a compatibility pointer for Codex or other agent runtimes.

## Runtime Notes

The original Harness project targets Claude Code Agent Teams. For full team behavior in Claude Code, start the session with:

```shell
export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
```

Then ask:

```text
앱 개발 하네스로 이 기능 구현해줘
app-delivery-orchestrator로 이 버그 수정해줘
하네스 점검해줘
```

If the current runtime does not expose `TeamCreate`, `SendMessage`, and `TaskCreate`, use the same files as a lightweight harness: run specialist agents as sub-agents, pass state through `_workspace/`, and let the main agent integrate the result.

## Harness Engineering Notes

The project follows a 3-layer harness:

1. Hooks: `.claude/hooks/guard.sh`, `lint-fix.sh`, `quality-gate.sh`, `pre-compact.sh`.
2. Shared instructions: `AGENTS.md` and `CLAUDE.md`.
3. Specialist agents: product, frontend, backend, QA.

The working loop is:

```text
GROUND -> APPLY -> VERIFY
  ^                 |
  |                 v
  +----- ADAPT <----+
```

See `docs/harness-engineering.md` for the adoption rationale and next steps.

## Official Plugin Option

To install the upstream Claude Code plugin globally inside Claude Code:

```text
/plugin marketplace add revfactory/harness
/plugin install harness@harness
```

This local setup remains useful even when the plugin is installed, because it defines this project's concrete team and workflow.

## Local Team Pattern

The default pattern is pipeline plus fan-out/fan-in:

1. Product analysis and acceptance criteria.
2. Frontend and backend work in parallel where possible.
3. QA cross-checks API/client contracts and runs verification.
4. The orchestrator integrates final notes and records harness changes.
