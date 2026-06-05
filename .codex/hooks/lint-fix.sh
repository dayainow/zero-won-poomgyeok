#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$ROOT"

if [ ! -f package.json ] || [ ! -d node_modules ]; then
  exit 0
fi

npm run lint:fix --if-present
npm run format --if-present
