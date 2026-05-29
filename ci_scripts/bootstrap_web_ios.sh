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

corepack prepare pnpm@10.17.0 --activate
corepack pnpm install --frozen-lockfile
corepack pnpm build
corepack pnpm exec cap sync ios

touch "$MARKER"
