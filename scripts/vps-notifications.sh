#!/usr/bin/env bash
set -euo pipefail

DOMAIN="${CLAVIS_NOTIFICATION_DOMAIN:-}"
LETSENCRYPT_EMAIL="${CLAVIS_LETSENCRYPT_EMAIL:-}"
API_PORT="${CLAVIS_NOTIFICATION_PORT:-8787}"

if [[ -z "$DOMAIN" || -z "$LETSENCRYPT_EMAIL" ]]; then
  echo "Set CLAVIS_NOTIFICATION_DOMAIN and CLAVIS_LETSENCRYPT_EMAIL before running this script."
  exit 1
fi

sudo apt-get update
sudo apt-get install -y nginx certbot python3-certbot-nginx

sudo tee /etc/nginx/sites-available/clavis-notifications >/dev/null <<EOF
limit_req_zone \$binary_remote_addr zone=clavis_notifications:10m rate=3000r/m;

server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;

    client_max_body_size 32k;

    location = /health {
        proxy_pass http://127.0.0.1:$API_PORT/health;
        proxy_set_header Host \$host;
    }

    location = /v1/notifications {
        limit_req zone=clavis_notifications burst=500 nodelay;
        proxy_pass http://127.0.0.1:$API_PORT/v1/notifications;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_read_timeout 35s;
    }
}
EOF

sudo ln -sfn /etc/nginx/sites-available/clavis-notifications /etc/nginx/sites-enabled/clavis-notifications
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx \
  --domain "$DOMAIN" \
  --email "$LETSENCRYPT_EMAIL" \
  --agree-tos \
  --non-interactive \
  --redirect

echo "Notification API ready at https://$DOMAIN/v1/notifications"
