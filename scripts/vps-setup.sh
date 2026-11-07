#!/usr/bin/env bash
set -euo pipefail

INSTALL_DIR="/opt/clavis"
LOG_DIR="/var/log/clavis"
DEPLOY_BRANCH="${CLAVIS_BRANCH:-main}"

curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get update
sudo apt-get install -y nodejs git
sudo npm install -g pm2

if [[ ! -d "$INSTALL_DIR/.git" ]]; then
  sudo git clone --branch "$DEPLOY_BRANCH" --single-branch \
    https://github.com/arinze116/Clavis.git "$INSTALL_DIR"
fi
sudo chown -R "$USER":"$USER" "$INSTALL_DIR"

cd "$INSTALL_DIR"
git fetch origin
git checkout "$DEPLOY_BRANCH"
git pull --ff-only origin "$DEPLOY_BRANCH"
npm ci

sudo mkdir -p "$LOG_DIR"
sudo chown -R "$USER":"$USER" "$LOG_DIR"

if [[ ! -f agent/.env ]]; then
  cp .env.example agent/.env
  chmod 600 agent/.env
fi

mkdir -p agent/config/payrolls agent/data/contracts agent/reports
chmod 700 agent/data
if [[ ! -f agent/config/payroll.local.json ]]; then
  printf '{\n  "businesses": []\n}\n' > agent/config/payroll.local.json
  chmod 600 agent/config/payroll.local.json
fi

echo "Edit $INSTALL_DIR/agent/.env with testnet and notification credentials."
echo "Then run: cd $INSTALL_DIR && pm2 start ecosystem.config.cjs && pm2 save && pm2 startup"
echo "For wallet-linked notifications, configure HTTPS with scripts/vps-notifications.sh."
