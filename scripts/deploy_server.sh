#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_NAME="${APP_NAME:-subshare-platform}"
PUBLIC_PORT="${PUBLIC_PORT:-9999}"
API_PORT="${API_PORT:-9998}"
SERVER_NAME="${SERVER_NAME:-47.106.176.71}"
PUBLIC_ROOT="${PUBLIC_ROOT:-/var/www/$APP_NAME}"
WEB_ROOT="$PUBLIC_ROOT/web"
ADMIN_ROOT="$PUBLIC_ROOT/admin"
DB_FILE="${DB_FILE:-/var/lib/$APP_NAME/app.db}"
ENV_FILE="${ENV_FILE:-/etc/$APP_NAME.env}"
NGINX_CONF="${NGINX_CONF:-/etc/nginx/conf.d/$APP_NAME.conf}"
SERVICE_NAME="${SERVICE_NAME:-$APP_NAME}"
DEPLOY_USER="${DEPLOY_USER:-${SUDO_USER:-$(id -un)}}"

sudo_cmd() {
  if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then
    "$@"
  else
    sudo "$@"
  fi
}

wait_for_url() {
  local url="$1"
  local attempts="${2:-30}"
  local attempt

  for ((attempt = 1; attempt <= attempts; attempt++)); do
    if curl --fail --silent --max-time 3 "$url" >/dev/null; then
      return 0
    fi
    sleep 1
  done

  echo "Health check failed after $attempts attempts: $url" >&2
  curl --fail --silent --show-error --max-time 3 "$url" >/dev/null
}

install_packages() {
  if command -v nginx >/dev/null 2>&1 &&
    command -v node >/dev/null 2>&1 &&
    command -v npm >/dev/null 2>&1 &&
    command -v rsync >/dev/null 2>&1 &&
    command -v curl >/dev/null 2>&1; then
    return
  fi

  if command -v dnf >/dev/null 2>&1; then
    sudo_cmd dnf install -y nginx nodejs npm rsync curl
  elif command -v yum >/dev/null 2>&1; then
    sudo_cmd yum install -y nginx nodejs npm rsync curl
  elif command -v apt-get >/dev/null 2>&1; then
    sudo_cmd apt-get update -qq
    sudo_cmd apt-get install -y nginx nodejs npm rsync curl
  else
    echo "Unsupported package manager. Install nginx, Node.js 18+, npm, rsync, and curl." >&2
    exit 1
  fi
}

install_packages

node_major="$(node --version | sed -E 's/^v([0-9]+).*/\1/')"
if (( node_major < 18 )); then
  echo "Node.js 18 or newer is required; found $(node --version)." >&2
  exit 1
fi

cd "$APP_DIR"
npm ci --include=dev
npm run build

sudo_cmd mkdir -p "$WEB_ROOT" "$ADMIN_ROOT" "$(dirname "$DB_FILE")"
sudo_cmd rsync -a --delete "$APP_DIR/web/dist/" "$WEB_ROOT/"
sudo_cmd rsync -a --delete "$APP_DIR/admin/dist/" "$ADMIN_ROOT/"
sudo_cmd find "$PUBLIC_ROOT" -type d -exec chmod 755 {} \;
sudo_cmd find "$PUBLIC_ROOT" -type f -exec chmod 644 {} \;
sudo_cmd chown -R "$DEPLOY_USER":"$(id -gn "$DEPLOY_USER")" "$(dirname "$DB_FILE")"

jwt_secret=""
if sudo_cmd test -f "$ENV_FILE"; then
  jwt_secret="$(sudo_cmd awk -F= '$1 == "JWT_SECRET" { print substr($0, index($0, "=") + 1); exit }' "$ENV_FILE")"
fi
if [[ -z "$jwt_secret" ]]; then
  if command -v openssl >/dev/null 2>&1; then
    jwt_secret="$(openssl rand -hex 32)"
  else
    jwt_secret="$(od -An -N32 -tx1 /dev/urandom | tr -d ' \n')"
  fi
fi

tmp_env="$(mktemp)"
cat > "$tmp_env" <<EOF
NODE_ENV=production
HOST=127.0.0.1
PORT=$API_PORT
DB_FILE=$DB_FILE
JWT_SECRET=$jwt_secret
EOF
sudo_cmd install -m 600 "$tmp_env" "$ENV_FILE"
rm -f "$tmp_env"

node_bin="$(command -v node)"
tmp_service="$(mktemp)"
cat > "$tmp_service" <<EOF
[Unit]
Description=SubShare NestJS API
After=network.target

[Service]
Type=simple
User=$DEPLOY_USER
Group=$(id -gn "$DEPLOY_USER")
WorkingDirectory=$APP_DIR
EnvironmentFile=$ENV_FILE
ExecStart=$node_bin $APP_DIR/server/dist/main.js
Restart=always
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF
sudo_cmd mv "$tmp_service" "/etc/systemd/system/$SERVICE_NAME.service"

tmp_nginx="$(mktemp)"
cat > "$tmp_nginx" <<EOF
server {
    listen $PUBLIC_PORT;
    server_name $SERVER_NAME;

    client_max_body_size 10m;

    location /api/ {
        proxy_pass http://127.0.0.1:$API_PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Forwarded-Port \$server_port;
    }

    location = /admin {
        return 301 /admin/;
    }

    location /admin/ {
        root $PUBLIC_ROOT;
        try_files \$uri \$uri/ /admin/index.html;
    }

    location / {
        root $WEB_ROOT;
        try_files \$uri \$uri/ /index.html;
    }
}
EOF
sudo_cmd mv "$tmp_nginx" "$NGINX_CONF"

sudo_cmd systemctl daemon-reload
sudo_cmd systemctl enable "$SERVICE_NAME"
sudo_cmd systemctl restart "$SERVICE_NAME"
sudo_cmd nginx -t
sudo_cmd systemctl enable nginx
sudo_cmd systemctl reload nginx || sudo_cmd systemctl restart nginx

if command -v firewall-cmd >/dev/null 2>&1 && sudo_cmd firewall-cmd --state >/dev/null 2>&1; then
  sudo_cmd firewall-cmd --permanent --add-port="$PUBLIC_PORT/tcp"
  sudo_cmd firewall-cmd --reload
fi

wait_for_url "http://127.0.0.1:$API_PORT/api/health" 30
wait_for_url "http://127.0.0.1:$PUBLIC_PORT/api/health" 10

echo "Deployed $APP_NAME: public=$PUBLIC_PORT api=127.0.0.1:$API_PORT"
