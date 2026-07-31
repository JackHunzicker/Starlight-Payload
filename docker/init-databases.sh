#!/bin/bash
# Acme Commerce: create per-service databases and users on FIRST postgres boot.
#
# postgres:17 runs every *.sh in /docker-entrypoint-initdb.d ONLY when the
# datadir is empty, WITH the container's environment available — which is why
# this is a shell script and not a .sql file: the passwords stay in the
# environment (compose passes them from docker/.env) and nothing secret is
# tracked. On an existing cluster this never runs, so it can neither rotate nor
# repair credentials — the VPS restore flow creates roles explicitly instead
# (deploy/README.md, restore order).
#
# MUST be LF — enforced via .gitattributes (*.sh text eol=lf).
set -euo pipefail

: "${PAYLOAD_DB_PASSWORD:?PAYLOAD_DB_PASSWORD is required}"
: "${VENDURE_DB_PASSWORD:?VENDURE_DB_PASSWORD is required}"
: "${SHARKEY_DB_PASSWORD:?SHARKEY_DB_PASSWORD is required}"
: "${AUTHENTIK_DB_PASSWORD:?AUTHENTIK_DB_PASSWORD is required}"

# psql's -v substitution keeps the passwords out of SQL text and injection-safe:
# :"var" quotes identifiers, :'var' quotes literals.
create_service_db() {
    local db="$1" user="$2" password="$3"
    psql -v ON_ERROR_STOP=1 \
        -v db="$db" -v user="$user" -v password="$password" \
        --username "$POSTGRES_USER" --dbname postgres <<'SQL'
CREATE USER :"user" WITH PASSWORD :'password';
CREATE DATABASE :"db" OWNER :"user";
GRANT ALL PRIVILEGES ON DATABASE :"db" TO :"user";
SQL
}

create_service_db payload_db payload_user "$PAYLOAD_DB_PASSWORD"
create_service_db vendure_db vendure_user "$VENDURE_DB_PASSWORD"
create_service_db sharkey_db sharkey_user "$SHARKEY_DB_PASSWORD"

echo "Acme Commerce service databases initialized."
