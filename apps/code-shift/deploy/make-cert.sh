#!/usr/bin/env bash
# Generates the self-signed HTTPS certificate the phones trust once. Re-run if the Pi's IP or name changes.
# Usage: sudo bash deploy/make-cert.sh [ip] [name]     defaults: 192.168.8.10 codeshift.lan
set -euo pipefail
IP=${1:-192.168.8.10}; NAME=${2:-codeshift.lan}; DIR=${DATA_DIR:-/var/lib/code-shift}/tls
mkdir -p "$DIR"
openssl req -x509 -newkey rsa:2048 -sha256 -days 1825 -nodes \
  -keyout "$DIR/code-shift.key" -out "$DIR/code-shift.crt" \
  -subj "/CN=Code Shift Simulation ($NAME)" \
  -addext "subjectAltName=IP:$IP,IP:127.0.0.1,DNS:$NAME,DNS:localhost" \
  -addext "basicConstraints=critical,CA:TRUE" \
  -addext "keyUsage=critical,digitalSignature,keyEncipherment,keyCertSign" \
  -addext "extendedKeyUsage=serverAuth" >/dev/null 2>&1
chmod 640 "$DIR"/code-shift.*
chown -R code-shift:code-shift "$DIR" 2>/dev/null || true
echo "Certificate written to $DIR (valid 5 years, SAN: $IP, $NAME)."
echo "Phones download it from http://$IP:8080/cert"
