#!/usr/bin/env bash
# Copy the evidence database safely (uses SQLite's online backup, works while the service runs).
# Usage: sudo bash deploy/backup.sh [destination-folder]
set -euo pipefail
DATA_DIR=${DATA_DIR:-/var/lib/code-shift}
DEST=${1:-/home/${SUDO_USER:-pi}/code-shift-backups}
mkdir -p "$DEST"
OUT="$DEST/code-shift-$(date +%Y%m%d-%H%M%S).sqlite"
node -e "const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(process.argv[1],{readOnly:true});db.exec(\"VACUUM INTO '\"+process.argv[2]+\"'\");db.close();" "$DATA_DIR/code-shift.sqlite" "$OUT"
echo "Backup written: $OUT"
