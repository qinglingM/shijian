#!/bin/sh
set -ex

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
if [ -n "$CI_PRIMARY_REPOSITORY_PATH" ] && [ -f "$CI_PRIMARY_REPOSITORY_PATH/web/package.json" ]; then
  REPO_DIR="$CI_PRIMARY_REPOSITORY_PATH"
else
  REPO_DIR="$SCRIPT_DIR"
  while [ "$REPO_DIR" != "/" ] && [ ! -f "$REPO_DIR/web/package.json" ]; do
    REPO_DIR="$(dirname "$REPO_DIR")"
  done
fi

if [ ! -f "$REPO_DIR/web/package.json" ]; then
  echo "Unable to locate repository root containing web/package.json"
  exit 1
fi

MARKER="$REPO_DIR/.ci_web_ios_bootstrapped"

if [ -f "$MARKER" ]; then
  echo "Web/iOS bootstrap already completed."
  exit 0
fi

cd "$REPO_DIR/web"

export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

if ! command -v node >/dev/null 2>&1; then
  brew install node
fi

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
