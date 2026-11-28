#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$0")"
echo '=== PRODUKSI: konfigurasi tanpa nilai rahasia ==='
docker exec backend-api-1 node -e 'for(const k of ["PUBLIC_ORIGIN","BREVO_API_KEY","GOOGLE_CLIENT_ID","GOOGLE_CLIENT_SECRET"]) console.log(k+": "+(process.env[k]?"OK":"MISSING"))'
echo '=== HALAMAN PUBLIK ==='
for f in portal.html customer.html; do
 t=$(mktemp); curl -fsS "https://awapart66.com/$f?v=265" -o "$t"; if cmp -s "$t" "web/$f"; then echo "$f: MATCH"; else echo "$f: DIFFERENT"; fi; rm -f "$t"
done
echo '=== BACKEND ==='
docker exec backend-api-1 node --check /app/src/server.js
if [[ $(docker exec backend-api-1 sha256sum /app/src/server.js | awk '{print $1}') == $(sha256sum backend/server.js | awk '{print $1}') ]]; then echo 'backend: MATCH'; else echo 'backend: DIFFERENT'; fi
echo 'AUDIT SELESAI - tidak ada perubahan produksi'
