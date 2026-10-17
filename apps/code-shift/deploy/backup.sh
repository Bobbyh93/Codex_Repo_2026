#!/usr/bin/env bash
# Copy the evidence database and the barcode registrations (config.sqlite) safely (uses SQLite's online backup, works while the service runs).
# Usage: sudo bash deploy/backup.sh [destination-folder]
set -euo pipefail
DATA_DIR=${DATA_DIR:-/var/lib/code-shift}
DEST=${1:-/home/${SUDO_USER:-pi}/code-shift-backups}
mkdir -p "$DEST"
STAMP=$(date +%Y%m%d-%H%M%S)
backup() { node -e "const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(process.argv[1],{readOnly:true});db.exec(\"VACUUM INTO '\"+process.argv[2]+\"'\");db.close();" "$1" "$2"; echo "Backup written: $2"; }
backup "$DATA_DIR/code-shift.sqlite" "$DEST/code-shift-$STAMP.sqlite"
# config.sqlite holds the physical barcode registrations, which outlive each group's evidence database
if [ -f "$DATA_DIR/config.sqlite" ]; then backup "$DATA_DIR/config.sqlite" "$DEST/code-shift-config-$STAMP.sqlite"; fi
