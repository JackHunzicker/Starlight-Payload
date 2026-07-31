#!/bin/bash
# Guided restore implementing the §6.3 order (ChatGPT correction, accepted):
#   fresh secrets -> ONLY postgres up -> fresh roles + databases -> per-DB
#   pg_restore --no-owner -> media/assets -> verify -> one app instance ->
#   the rest -> browser smoke.
#
# Usage: deploy/restore.sh <dumps-dir>
#   <dumps-dir> holds payload_db.dump vendure_db.dump authentik_db.dump
#   sharkey_db.dump (from deploy/backup.sh staging or `restic restore`).
#
# DESTRUCTIVE: drops + recreates the four service databases. It refuses to run
# unless the app services are stopped. Read deploy/README.md first.
set -euo pipefail

DUMPS="${1:?usage: restore.sh <dumps-dir>}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-docker-postgres-1}"
ENV_FILE="${ENV_FILE:-docker/.env}"

confirm() {
    read -r -p "$1 [y/N] " reply
    [[ "$reply" == "y" || "$reply" == "Y" ]] || { echo "aborted"; exit 1; }
}

for db in payload_db vendure_db authentik_db sharkey_db; do
    [[ -f "$DUMPS/$db.dump" ]] || { echo "missing $DUMPS/$db.dump"; exit 1; }
done

# Guard: only postgres may be running (initdb scripts never run post-restore —
# roles are created explicitly below, with the CURRENT passwords from env).
running="$(docker ps --format '{{.Names}}' | grep -E 'docker-(web|vendure|sharkey|authentik|starlight|caddy)' || true)"
if [[ -n "$running" ]]; then
    echo "Stop the app services first:"; echo "$running"; exit 1
fi

# shellcheck disable=SC1090
source <(grep -E '^(PAYLOAD|VENDURE|SHARKEY|AUTHENTIK)_DB_PASSWORD=' "$ENV_FILE" | sed 's/\r$//')

psql_admin() { docker exec -i "$POSTGRES_CONTAINER" psql -U platform_admin -d postgres -v ON_ERROR_STOP=1 "$@"; }

echo "== 1. Fresh roles (passwords from $ENV_FILE — mint production values FIRST)"
confirm "Recreate roles + databases (DROPS existing data in the four DBs)?"
recreate() {
    local db="$1" user="$2" password="$3"
    # \gexec runs the SELECTed statement — create-if-absent without a DO block
    # (psql -v substitution does not reach inside dollar-quoted bodies).
    docker exec -i "$POSTGRES_CONTAINER" psql -U platform_admin -d postgres -v ON_ERROR_STOP=1 \
        -v db="$db" -v user="$user" -v password="$password" <<'SQL'
DROP DATABASE IF EXISTS :"db";
SELECT format('CREATE USER %I', :'user')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = :'user') \gexec
ALTER USER :"user" WITH PASSWORD :'password';
CREATE DATABASE :"db" OWNER :"user";
GRANT ALL PRIVILEGES ON DATABASE :"db" TO :"user";
SQL
    echo "  $db ready (owner $user, current password applied)"
}
recreate payload_db payload_user "$PAYLOAD_DB_PASSWORD"
recreate vendure_db vendure_user "$VENDURE_DB_PASSWORD"
recreate sharkey_db sharkey_user "$SHARKEY_DB_PASSWORD"
recreate authentik_db authentik_user "$AUTHENTIK_DB_PASSWORD"

echo "== 2. Per-DB restore (--no-owner, ownership to the service user)"
restore_db() {
    local db="$1" user="$2"
    docker cp "$DUMPS/$db.dump" "$POSTGRES_CONTAINER:/tmp/restore-$db.dump"
    docker exec "$POSTGRES_CONTAINER" pg_restore -U platform_admin -d "$db" \
        --no-owner --role="$user" --exit-on-error "/tmp/restore-$db.dump"
    docker exec "$POSTGRES_CONTAINER" rm "/tmp/restore-$db.dump"
    echo "  $db restored"
}
restore_db payload_db payload_user
restore_db vendure_db vendure_user
restore_db sharkey_db sharkey_user
restore_db authentik_db authentik_user

echo "== 3. Verify"
for db in payload_db vendure_db authentik_db sharkey_db; do
    tables="$(docker exec "$POSTGRES_CONTAINER" psql -U platform_admin -d "$db" -tAc \
        "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")"
    echo "  $db: $tables tables"
done
docker exec "$POSTGRES_CONTAINER" psql -U platform_admin -d payload_db -tAc \
    "SELECT 'payload migrations: ' || count(*) FROM payload_migrations" || true
docker exec "$POSTGRES_CONTAINER" psql -U platform_admin -d vendure_db -tAc \
    "SELECT 'vendure migrations: ' || count(*) FROM migrations" || true

cat <<'NEXT'
== 4. Next (manual, in order):
   a. Restore media/assets/sharkey files from the restic snapshot into place.
   b. Start ONE app instance:  docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d web
      (its boot runs payload migrate against the restored DB)
   c. Start the rest:          ... up -d
   d. Authed + anonymous browser smoke on every hostname (deploy/README.md).
NEXT
