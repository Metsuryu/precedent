#!/usr/bin/env bash
# Deploy to production without dev-only modules (devtools webtrigger), so the
# app stays eligible for "Runs on Atlassian". The original manifest is restored on exit.
# Usage: scripts/deploy-prod.sh [--check-only]
set -euo pipefail
cd "$(dirname "$0")/.."
cp manifest.yml .manifest.dev.bak
trap 'mv -f .manifest.dev.bak manifest.yml' EXIT
node scripts/strip-dev.mjs .manifest.dev.bak > manifest.yml
if grep -q 'devtools' manifest.yml; then echo "devtools still present" >&2; exit 1; fi
forge lint
forge eligibility -e production || true
if [[ "${1:-}" != "--check-only" ]]; then
  forge deploy -e production --non-interactive
fi
