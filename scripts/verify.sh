#!/usr/bin/env bash
set -euo pipefail
verification_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$verification_root"
java -version
if ! docker info >/dev/null 2>&1; then
  echo "Docker is required: real MySQL and SMTP verification must not be silently skipped." >&2
  exit 1
fi
verification_build_directory="${VERIFY_BUILD_DIRECTORY:-$verification_root/backend/target}"
(cd backend && sh mvnw -B -Pdatabase-integration "-Ddashboard.build.directory=$verification_build_directory" clean verify)
(cd frontend && pnpm install --frozen-lockfile && pnpm test && pnpm build)
git diff --check
