#!/usr/bin/env bash
set -euo pipefail

# Publish the flout Docker images to Docker Hub
#
# Builds and pushes multi-platform images (linux/amd64, linux/arm64):
#   bgrgicak/flout        — base image
#   bgrgicak/flout-claude — base + Claude Code
#
# Prerequisites:
#   docker login
#   docker buildx (included with Docker Desktop; on Linux: docker buildx create --use)
#
# Usage:
#   ./publish.sh                  # builds and pushes with version from package.json + latest
#   ./publish.sh 0.2.0            # builds and pushes with explicit version tag + latest
#   ./publish.sh 0.2.0 --no-latest  # pushes only the version tag

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

BASE_REPO="bgrgicak/flout"
CLAUDE_REPO="bgrgicak/flout-claude"
PLATFORMS="linux/amd64,linux/arm64"

# Determine version
if [[ -n "${1:-}" && "$1" != --* ]]; then
  VERSION="$1"
  shift
else
  VERSION=$(node -p "require('$SCRIPT_DIR/package.json').version")
fi

# Check for --no-latest flag
TAG_LATEST=true
for arg in "$@"; do
  if [[ "$arg" == "--no-latest" ]]; then
    TAG_LATEST=false
  fi
done

# Ensure a buildx builder exists
if ! docker buildx inspect flout-builder &>/dev/null; then
  echo "Creating buildx builder 'flout-builder'..."
  docker buildx create --name flout-builder --use
else
  docker buildx use flout-builder
fi

# Build and push base image
TAGS=("-t" "${BASE_REPO}:${VERSION}")
if $TAG_LATEST; then
  TAGS+=("-t" "${BASE_REPO}:latest")
fi

echo "Building and pushing ${BASE_REPO}:${VERSION} for ${PLATFORMS}..."
docker buildx build \
  --platform "$PLATFORMS" \
  "${TAGS[@]}" \
  -f "$SCRIPT_DIR/Dockerfile" \
  --push \
  "$REPO_ROOT"

# Build and push claude image on top of base
# Use the version tag as the base so the digest is resolved per-platform
TAGS=("-t" "${CLAUDE_REPO}:${VERSION}")
if $TAG_LATEST; then
  TAGS+=("-t" "${CLAUDE_REPO}:latest")
fi

echo "Building and pushing ${CLAUDE_REPO}:${VERSION} for ${PLATFORMS}..."
docker buildx build \
  --platform "$PLATFORMS" \
  "${TAGS[@]}" \
  --build-arg "BASE_IMAGE=${BASE_REPO}:${VERSION}" \
  -f "$SCRIPT_DIR/Dockerfile.claude" \
  --push \
  "$REPO_ROOT"

echo "Done. Published ${BASE_REPO}:${VERSION} and ${CLAUDE_REPO}:${VERSION} for ${PLATFORMS}"
