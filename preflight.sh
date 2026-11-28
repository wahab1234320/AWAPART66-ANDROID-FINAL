#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$0")"
nginx -t
for c in backend-api-1 backend-db-1; do [[ $(docker inspect -f '{{.State.Running}}' "$c") == true ]]; done
docker exec backend-api-1 node -e 'const e=process.env; for(const k of ["DATABASE_URL","JWT_SECRET","CORS_ORIGIN","PUBLIC_ORIGIN","BREVO_API_KEY","GOOGLE_CLIENT_ID","GOOGLE_CLIENT_SECRET"]) console.log(k+": "+(e[k]?"SET":"MISSING")); if(e.PUBLIC_ORIGIN!=="https://awapart66.com"||!(e.CORS_ORIGIN||"").split(",").map(x=>x.trim()).includes("https://awapart66.com")) process.exitCode=1'
docker exec backend-db-1 sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --schema-only --no-owner --no-privileges' > /tmp/aw66-production-schema-check.sql
# compare schema ignoring dump session random markers and comments
normalize(){ sed -E '/^\\(un)?restrict /d; /^--/d; /^[[:space:]]*$/d' "$1"; }
diff -u <(normalize schema-production.sql) <(normalize /tmp/aw66-production-schema-check.sql)
echo 'PREFLIGHT OK - no production changes made'
