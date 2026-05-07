#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$ROOT"

printf '\n[pre-compact snapshot]\n'
git branch --show-current 2>/dev/null || true
git status --short 2>/dev/null || true
