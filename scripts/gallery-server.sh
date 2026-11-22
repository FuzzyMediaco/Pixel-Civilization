#!/usr/bin/env bash
# Starts (if not already running) a Vite dev server for the element gallery on port 5199.
PORT=${GALLERY_PORT:-5199}
if curl -s "http://localhost:$PORT/gallery.html" >/dev/null 2>&1; then echo "gallery server already on $PORT"; exit 0; fi
cd "$(dirname "$0")/.."
nohup npx vite --port "$PORT" --strictPort > /tmp/gallery-server.log 2>&1 &
for i in $(seq 1 60); do
  if curl -s "http://localhost:$PORT/gallery.html" >/dev/null 2>&1; then echo "gallery server up on $PORT"; exit 0; fi
  sleep 1
done
echo "failed to start; see /tmp/gallery-server.log"; exit 1
