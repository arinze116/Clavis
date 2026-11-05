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

# Oracle Ubuntu images reject inbound traffic after the SSH rule by default.
# Open only HTTP/HTTPS before that reject rule and persist the exact addition.
if command -v iptables >/dev/null && command -v netfilter-persistent >/dev/null; then
  if ! sudo iptables -C INPUT -p tcp -m state --state NEW \
    -m multiport --dports 80,443 -j ACCEPT 2>/dev/null; then
    REJECT_LINE="$(sudo iptables -L INPUT --line-numbers -n | \
      awk '$2 == "REJECT" { print $1; exit }')"
    if [[ -z "$REJECT_LINE" ]]; then
      echo "Unable to locate the INPUT reject rule; open TCP 80/443 manually."
      exit 1
    fi
    sudo iptables -I INPUT "$REJECT_LINE" -p tcp -m state --state NEW \
      -m multiport --dports 80,443 -j ACCEPT
    sudo netfilter-persistent save
  fi
fi

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
