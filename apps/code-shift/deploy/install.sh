#!/usr/bin/env bash
# Code Shift — Raspberry Pi 5 install (Raspberry Pi OS 64-bit Lite, Bookworm or newer).
# Run from the unpacked project folder:  sudo bash deploy/install.sh
# Needs internet ONCE (for Node and npm packages). After install the Pi can run fully offline.
set -euo pipefail
APP_DIR=/opt/code-shift
DATA_DIR=/var/lib/code-shift
SRC_DIR="$(cd "$(dirname "$0")/.." && pwd)"
[ "$(id -u)" -eq 0 ] || { echo "Run with sudo."; exit 1; }

echo "== Node.js 24 (needed for built-in SQLite)"
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
  apt-get install -y nodejs
fi
apt-get install -y openssl rsync
node --version

echo "== Service account and directories"
id -u code-shift >/dev/null 2>&1 || useradd --system --home "$APP_DIR" --shell /usr/sbin/nologin code-shift
mkdir -p "$APP_DIR" "$DATA_DIR"
rsync -a --delete --exclude node_modules --exclude data --exclude test-results --exclude playwright-report "$SRC_DIR"/ "$APP_DIR"/

echo "== Dependencies and production build"
cd "$APP_DIR"
export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
npm ci --no-audit --no-fund
npm run build
npm prune --omit=dev --no-audit --no-fund
chown -R code-shift:code-shift "$APP_DIR" "$DATA_DIR"
chmod 750 "$DATA_DIR"

echo "== HTTPS certificate (needed for phone camera scanning)"
if [ ! -f "$DATA_DIR/tls/code-shift.crt" ]; then DATA_DIR="$DATA_DIR" bash "$APP_DIR/deploy/make-cert.sh" "${CODE_SHIFT_IP:-192.168.8.10}" "${CODE_SHIFT_NAME:-codeshift.lan}"; fi
chown -R code-shift:code-shift "$DATA_DIR"

[ -f /etc/code-shift.env ] || { printf "# Optional. Connected mode for the AI patient voice: set a key and restart the service.
# ANTHROPIC_API_KEY=sk-ant-...
# AI_PATIENT=off   # force the scripted patient even when a key is present
" > /etc/code-shift.env; chmod 600 /etc/code-shift.env; }

echo "== systemd service"
install -m 644 deploy/code-shift.service /etc/systemd/system/code-shift.service
systemctl daemon-reload
systemctl enable --now code-shift
sleep 2
systemctl --no-pager --lines=6 status code-shift || true

IP=$(hostname -I | awk '{print $1}')
echo
echo "Code Shift is running."
echo "  Instructor / students:  https://${IP:-<pi-ip>}:4317   (phones: install the certificate once from http://${IP:-<pi-ip>}:8080/cert)"
echo "  Room monitor display:   https://${IP:-<pi-ip>}:4317/display   (or run deploy/install-display.sh for the HDMI kiosk)"
echo "  Printable labels:       https://${IP:-<pi-ip>}:4317/labels   (sign in as instructor first)"
echo "  Instructor key:         sudo cat $DATA_DIR/instructor-key.txt"
echo "  Logs:                   journalctl -u code-shift -f"
echo "  Evidence database:      $DATA_DIR/code-shift.sqlite (back this up after each session)"
