#!/bin/sh
set -e

REPO_DIR="${CI_WORKSPACE:-$(pwd)}/repository"
if [ ! -d "$REPO_DIR/web" ]; then
  REPO_DIR="$(pwd)"
fi

cd "$REPO_DIR/web"

corepack enable
corepack prepare pnpm@10.17.0 --activate
pnpm install --frozen-lockfile
pnpm build
pnpm exec cap sync ios
