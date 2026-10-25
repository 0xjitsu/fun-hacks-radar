#!/usr/bin/env bash
# Checks the og:video link-preview tags in index.html and the size of og/preview.mp4.
# Usage: bash scripts/check-og.sh   (run from the repo root; CI runs it on every PR)
set -euo pipefail
cd "$(dirname "$0")/.."

fail=0
for tag in 'property="og:image"' 'property="og:video"' 'property="og:video:secure_url"' \
  'property="og:video:type" content="video/mp4"' 'property="og:video:width"' 'property="og:video:height"' \
  'name="twitter:card" content="player"' 'name="twitter:player"' 'name="twitter:player:width"' 'name="twitter:player:height"'; do
  grep -q "<meta $tag" index.html || { echo "missing: <meta $tag"; fail=1; }
done

# Every preview URL must be absolute https
if grep -E '"(og:image|og:video|og:video:secure_url|twitter:image|twitter:player)" content="' index.html | grep -v 'content="https://'; then
  echo "preview URL above is not absolute https"; fail=1
fi

for f in og/preview.mp4 og/preview.jpg og/player.html; do
  [ -f "$f" ] || { echo "missing file: $f"; fail=1; }
done

if [ -f og/preview.mp4 ]; then
  size=$(wc -c < og/preview.mp4)
  [ "$size" -lt 5242880 ] || { echo "og/preview.mp4 is $size bytes (limit 5 MB)"; fail=1; }
fi

[ "$fail" -eq 0 ] && echo "og:video check passed"
exit "$fail"
