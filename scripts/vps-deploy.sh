#!/usr/bin/env bash
set -euo pipefail

DEPLOY_BRANCH="${CLAVIS_BRANCH:-main}"

cd /opt/clavis
git fetch origin "$DEPLOY_BRANCH"
git checkout "$DEPLOY_BRANCH"
git pull --ff-only origin "$DEPLOY_BRANCH"
npm ci
npm run typecheck
npm run build
pm2 restart clavis-agent --update-env
pm2 save
pm2 logs clavis-agent --lines 20 --nostream
