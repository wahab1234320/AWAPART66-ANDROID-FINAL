#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
cd "$(dirname "$0")"
BASE=$PWD
TARGET=/opt/awapart66/backend
WEB=/var/www/awapart66
cd "$TARGET"
# Refuse unknown code instead of overwriting prior fixes.
current=$(sha256sum src/server.js | awk '{print $1}')
grep -Fxq "$current" "$BASE/fix/allowed-backend.sha256" || { echo 'STOP: backend aktif berbeda dari sumber yang diperiksa. Tidak ada perubahan.'; exit 1; }
for f in account-email.html account-email.js recovery.html recovery.js; do test -f "$WEB/$f"; done
docker compose exec -T api node -e 'if(process.env.PUBLIC_ORIGIN!=="https://awapart66.com"||!process.env.BREVO_API_KEY)process.exit(1)' || { echo 'STOP: PUBLIC_ORIGIN produksi atau Brevo belum sesuai. Tidak ada perubahan.'; exit 1; }
node --input-type=module --check < "$BASE/backend/server.js"
node --check "$BASE/fix/account-email.js"
B=$(mktemp -d /opt/awapart66-backup-v266.XXXXXX)
cp -a src/server.js "$B/server.js"
cp -a "$WEB/account-email.js" "$B/account-email.js"
docker compose exec -T db pg_dump -U awapart -d awapart66 -Fc > "$B/database.dump"
rollback(){ trap - ERR; cp -a "$B/server.js" src/server.js; cp -a "$B/account-email.js" "$WEB/account-email.js"; docker compose up -d --build --no-deps api; echo "Rollback kode: $B"; }
trap rollback ERR
cp "$BASE/backend/server.js" src/server.js
cp "$BASE/fix/account-email.js" "$WEB/account-email.js"
docker compose up -d --build --no-deps api
ok=0
for i in $(seq 1 30); do if curl -fsS http://127.0.0.1:8080/health >/dev/null; then ok=1; break; fi; sleep 2; done
test "$ok" = 1
docker compose exec -T api node -e 'if(process.env.PUBLIC_ORIGIN!=="https://awapart66.com"||!process.env.BREVO_API_KEY)process.exit(1)'
trap - ERR
echo "PATCH TERPASANG; backup $B. Uji reset seluruh akun sebelum rilis."
