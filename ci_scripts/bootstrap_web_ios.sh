#!/bin/sh
set -e

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
REPO_DIR="$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)"
MARKER="$REPO_DIR/.ci_web_ios_bootstrapped"

if [ -f "$MARKER" ]; then
  echo "Web/iOS bootstrap already completed."
  exit 0
fi

cd "$REPO_DIR/web"

if command -v corepack >/dev/null 2>&1; then
  corepack prepare pnpm@10.17.0 --activate
  PNPM="corepack pnpm"
elif command -v npx >/dev/null 2>&1; then
  PNPM="npx -y pnpm@10.17.0"
else
  echo "Neither corepack nor npx is available; cannot install web dependencies."
  exit 127
fi

$PNPM install --frozen-lockfile
$PNPM build
$PNPM exec cap sync ios

touch "$MARKER"
