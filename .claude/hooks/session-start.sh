#!/bin/bash
# Installs dependencies so a fresh web session can run the test suite and
# ESLint. Sessions in Claude Code on the web start from a clean clone, and
# node_modules is gitignored -- without this, `npm test` fails with
# "vitest: not found" and the agent has no way to check its own work.
set -euo pipefail

# Local machines already have a populated node_modules and manage it by hand.
# Only the disposable remote containers need this.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# `npm install` rather than `npm ci`: the container image is cached after this
# hook completes, and `npm ci` deletes node_modules before every run, which
# throws that cache away. install is idempotent and a no-op once the tree
# matches package-lock.json.
npm install --no-audit --no-fund

# The Supabase browser client throws at import time when these are missing,
# which fails `npm run build` during static generation. Throwaway placeholders,
# exactly as .github/workflows/ci.yml does it -- nothing here reaches a real
# database. The unit tests need neither; the build does.
{
  echo 'export NEXT_PUBLIC_SUPABASE_URL="https://placeholder.supabase.co"'
  echo 'export NEXT_PUBLIC_SUPABASE_ANON_KEY="placeholder-anon-key"'
} >> "$CLAUDE_ENV_FILE"
