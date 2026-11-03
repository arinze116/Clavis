#!/usr/bin/env bash
set -euo pipefail

pm2 status clavis-agent
AGENT_PID="$(pm2 pid clavis-agent | tr -d '[:space:]')"
if [[ -z "$AGENT_PID" || "$AGENT_PID" == "0" ]]; then
  echo "clavis-agent is not online" >&2
  exit 1
fi
if grep -q '^NOTIFICATION_API_ENABLED=true' /opt/clavis/agent/.env 2>/dev/null; then
  API_PORT="$(sed -n 's/^NOTIFICATION_API_PORT=//p' /opt/clavis/agent/.env | head -n 1 | tr -d '[:space:]')"
  API_PORT="${API_PORT:-8787}"
  curl --fail --silent --show-error "http://127.0.0.1:${API_PORT}/health" >/dev/null
  echo "notification API healthy"
fi
pm2 logs clavis-agent --lines 50 --nostream
