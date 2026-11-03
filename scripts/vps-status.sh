#!/usr/bin/env bash
set -euo pipefail

pm2 status clavis-agent
AGENT_PID="$(pm2 pid clavis-agent | tr -d '[:space:]')"
if [[ -z "$AGENT_PID" || "$AGENT_PID" == "0" ]]; then
  echo "clavis-agent is not online" >&2
  exit 1
fi
pm2 logs clavis-agent --lines 50 --nostream
