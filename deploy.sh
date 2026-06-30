#!/usr/bin/env bash
#
# deploy.sh — pull latest code, install deps, restart the buzzer server.
# Run this on the server from inside ~/circus-buzzer-v2
#
set -e

echo "==> Pulling latest code..."
git pull

echo "==> Installing dependencies..."
npm install

echo "==> Stopping old node process (if any)..."
pkill -f "node server.js" || echo "No running process found."

# Give the old process a moment to release the port.
sleep 1

echo "==> Starting new server..."
nohup node server.js > buzzer.log 2>&1 &
disown

# Give the server a moment to boot and write its startup line.
sleep 2

echo "==> buzzer.log:"
cat buzzer.log
