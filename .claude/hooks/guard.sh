#!/usr/bin/env bash
set -euo pipefail

HOOK_INPUT="$(cat)"

COMMAND="$(
  printf '%s' "$HOOK_INPUT" | python3 -c '
import json
import sys

try:
    payload = json.load(sys.stdin)
except Exception:
    payload = {}

print(payload.get("tool_input", {}).get("command", ""))
' 2>/dev/null || true
)"

if [ -z "$COMMAND" ]; then
  exit 0
fi

block() {
  printf 'BLOCKED by .claude/hooks/guard.sh: %s\n' "$1" >&2
  exit 2
}

case "$COMMAND" in
  *"git add ."*|*"git add -A"*)
    block "stage explicit files instead of using git add . or git add -A"
    ;;
  *"git reset --hard"*|*"git checkout -- ."*|*"git restore ."*)
    block "destructive git workspace reset requires explicit human approval"
    ;;
  *"rm -rf /"*|*"rm -rf ~"*|*"find / -delete"*)
    block "destructive filesystem command is not allowed"
    ;;
  *"git push --force"*|*"git push -f"*)
    block "force push requires explicit human approval"
    ;;
  *"curl "*"| sh"*|*"curl "*"| bash"*|*"wget "*"| sh"*|*"wget "*"| bash"*)
    block "piping downloaded scripts into a shell is not allowed"
    ;;
  *"sudo "*)
    block "sudo is outside the project harness"
    ;;
esac

exit 0
