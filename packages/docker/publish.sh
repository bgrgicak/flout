#!/usr/bin/env bash
set -euo pipefail

# Publish the flout Docker images to Docker Hub
#
# Builds and pushes two images:
#   bgrgicak/flout        — base image
#   bgrgicak/flout-claude — base + Claude Code
#
# Prerequisites:
#   docker login
#
# Usage:
#   ./publish.sh                  # builds and pushes with version from package.json + latest
#   ./publish.sh 0.2.0            # builds and pushes with explicit version tag + latest
#   ./publish.sh 0.2.0 --no-latest  # pushes only the version tag

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

BASE_REPO="bgrgicak/flout"
CLAUDE_REPO="bgrgicak/flout-claude"

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

# Build base image
echo "Building ${BASE_REPO}:${VERSION}..."
docker build -t "${BASE_REPO}:${VERSION}" -f "$SCRIPT_DIR/Dockerfile" "$REPO_ROOT"

if $TAG_LATEST; then
  docker tag "${BASE_REPO}:${VERSION}" "${BASE_REPO}:latest"
fi

# Build claude image on top of base
echo "Building ${CLAUDE_REPO}:${VERSION}..."
docker build -t "${CLAUDE_REPO}:${VERSION}" --build-arg "BASE_IMAGE=${BASE_REPO}:${VERSION}" -f "$SCRIPT_DIR/Dockerfile.claude" "$REPO_ROOT"

if $TAG_LATEST; then
  docker tag "${CLAUDE_REPO}:${VERSION}" "${CLAUDE_REPO}:latest"
fi

# Push base
echo "Pushing ${BASE_REPO}:${VERSION}..."
docker push "${BASE_REPO}:${VERSION}"

if $TAG_LATEST; then
  echo "Pushing ${BASE_REPO}:latest..."
  docker push "${BASE_REPO}:latest"
fi

# Push claude
echo "Pushing ${CLAUDE_REPO}:${VERSION}..."
docker push "${CLAUDE_REPO}:${VERSION}"

if $TAG_LATEST; then
  echo "Pushing ${CLAUDE_REPO}:latest..."
  docker push "${CLAUDE_REPO}:latest"
fi

echo "Done. Published ${BASE_REPO}:${VERSION} and ${CLAUDE_REPO}:${VERSION}"
