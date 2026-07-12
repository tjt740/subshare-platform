#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ -f "$APP_DIR/.deploy.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$APP_DIR/.deploy.env"
  set +a
fi

ALIYUN_HOST="${ALIYUN_HOST:-47.106.176.71}"
ALIYUN_USER="${ALIYUN_USER:-admin}"
ALIYUN_PORT="${ALIYUN_PORT:-22}"
ALIYUN_SSH_KEY="${ALIYUN_SSH_KEY:-$HOME/.ssh/ccbot_aliyun_deploy}"
ALIYUN_DEPLOY_PATH="${ALIYUN_DEPLOY_PATH:-/home/admin/subshare-platform}"
PUBLIC_PORT="${PUBLIC_PORT:-9999}"
API_PORT="${API_PORT:-9998}"
SERVER_NAME="${SERVER_NAME:-$ALIYUN_HOST}"
PUBLIC_ROOT="${PUBLIC_ROOT:-/var/www/subshare-platform}"
DB_FILE="${DB_FILE:-/var/lib/subshare-platform/app.db}"

if [[ ! -f "$ALIYUN_SSH_KEY" ]]; then
  echo "SSH key not found: $ALIYUN_SSH_KEY" >&2
  exit 1
fi

SSH=(ssh -i "$ALIYUN_SSH_KEY" -o BatchMode=yes -o IdentitiesOnly=yes -p "$ALIYUN_PORT")
RSYNC_SSH="ssh -i $ALIYUN_SSH_KEY -o BatchMode=yes -o IdentitiesOnly=yes -p $ALIYUN_PORT"
TARGET="$ALIYUN_USER@$ALIYUN_HOST"

echo "[deploy] validating local build"
cd "$APP_DIR"
npm run build

echo "[deploy] syncing code to $TARGET:$ALIYUN_DEPLOY_PATH"
"${SSH[@]}" "$TARGET" "mkdir -p '$ALIYUN_DEPLOY_PATH'"
rsync -az --delete \
  --exclude '.git/' \
  --exclude '.github/' \
  --exclude '.deploy.env' \
  --exclude 'node_modules/' \
  --exclude 'web/dist/' \
  --exclude 'admin/dist/' \
  --exclude 'server/dist/' \
  --exclude 'server/data/*.db*' \
  --exclude '*.log' \
  -e "$RSYNC_SSH" \
  "$APP_DIR/" "$TARGET:$ALIYUN_DEPLOY_PATH/"

echo "[deploy] installing and restarting services"
"${SSH[@]}" "$TARGET" \
  "cd '$ALIYUN_DEPLOY_PATH' && PUBLIC_PORT='$PUBLIC_PORT' API_PORT='$API_PORT' SERVER_NAME='$SERVER_NAME' PUBLIC_ROOT='$PUBLIC_ROOT' DB_FILE='$DB_FILE' ./scripts/deploy_server.sh"

echo "[deploy] checking public endpoint"
curl --fail --silent --show-error --retry 5 --retry-delay 2 \
  "http://$ALIYUN_HOST:$PUBLIC_PORT/api/health"
echo
echo "[deploy] complete: http://$ALIYUN_HOST:$PUBLIC_PORT/"
echo "[deploy] admin:    http://$ALIYUN_HOST:$PUBLIC_PORT/admin/"
