#!/usr/bin/env bash
# Optional: turn the Pi's HDMI output into the room patient monitor (no desktop needed).
# Run after install.sh:  sudo bash deploy/install-display.sh
set -euo pipefail
[ "$(id -u)" -eq 0 ] || { echo "Run with sudo."; exit 1; }
apt-get install -y cage chromium seatd
id -u display >/dev/null 2>&1 || useradd --create-home --uid 1001 --shell /usr/sbin/nologin display
usermod -aG video,render,input,seat display 2>/dev/null || usermod -aG video,render,input display
systemctl enable --now seatd 2>/dev/null || true
install -m 644 "$(dirname "$0")/code-shift-display.service" /etc/systemd/system/code-shift-display.service
systemctl daemon-reload
systemctl set-default graphical.target
systemctl enable --now code-shift-display
echo "Display kiosk enabled. The HDMI screen shows https://127.0.0.1:4317/display after boot."
echo "Stop it with: sudo systemctl stop code-shift-display"
