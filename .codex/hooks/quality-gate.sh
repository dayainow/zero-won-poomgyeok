#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$ROOT"

if [ ! -f package.json ]; then
  exit 0
fi

if [ ! -d node_modules ]; then
  printf 'quality-gate: node_modules is missing; run npm install before relying on automated checks.\n' >&2
  exit 0
fi

node - <<'NODE'
const pkg = require('./package.json');
const scripts = pkg.scripts || {};

if (!scripts.typecheck && !scripts.lint) {
  process.exit(0);
}

console.log(JSON.stringify({
  typecheck: Boolean(scripts.typecheck),
  lint: Boolean(scripts.lint)
}));
NODE

if node -e "const s=require('./package.json').scripts||{}; process.exit(s.typecheck ? 0 : 1)"; then
  npm run typecheck
fi

if node -e "const s=require('./package.json').scripts||{}; process.exit(s.lint ? 0 : 1)"; then
  npm run lint
fi
