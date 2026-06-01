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

NODE_VERSION="22.12.0"
NODE_HOME="$REPO_DIR/.ci-node/node"
export PATH="$NODE_HOME/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"

if [ ! -x "$NODE_HOME/bin/node" ] || [ "$("$NODE_HOME/bin/node" -v)" != "v$NODE_VERSION" ]; then
  case "$(uname -m)" in
    arm64) NODE_ARCH="arm64" ;;
    x86_64) NODE_ARCH="x64" ;;
    *)
      echo "Unsupported macOS architecture: $(uname -m)"
      exit 1
      ;;
  esac

  NODE_DIST="node-v$NODE_VERSION-darwin-$NODE_ARCH"
  NODE_TARBALL="$REPO_DIR/.ci-node/$NODE_DIST.tar.xz"
  NODE_URL="https://nodejs.org/dist/v$NODE_VERSION/$NODE_DIST.tar.xz"

  mkdir -p "$REPO_DIR/.ci-node"
  curl --retry 3 --retry-delay 2 --retry-all-errors -fsSL "$NODE_URL" -o "$NODE_TARBALL"
  rm -rf "$NODE_HOME" "$REPO_DIR/.ci-node/$NODE_DIST"
  tar -xJf "$NODE_TARBALL" -C "$REPO_DIR/.ci-node"
  mv "$REPO_DIR/.ci-node/$NODE_DIST" "$NODE_HOME"
fi

if [ "$(node -v 2>/dev/null)" != "v$NODE_VERSION" ]; then
  echo "Node.js v$NODE_VERSION is unavailable after bootstrap."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is unavailable; cannot install web dependencies."
  exit 127
fi

PNPM="npx -y pnpm@10.17.0"

$PNPM install --frozen-lockfile
$PNPM build
$PNPM exec cap sync ios

touch "$MARKER"
