#!/bin/bash
# Nightly backup: per-DB custom-format dumps + restic to the offsite
# repository (§6.4 of the accepted infra plan — solid, not overkill).
#
# DESTINATION (the owner, 2026-07-29 — no monthly cloud bill): restic's rest-server
# running in Docker on the operator home machine, data on its otherwise-empty E:
# drive, reached from the VPS over Tailscale. Verified end-to-end on
# 2026-07-29: init, backup, restore, and append-only all confirmed.
# Server config lives in deploy/backup-server/docker-compose.yml.
#
# The server runs with --append-only, so this script CANNOT prune: a
# compromised VPS must not be able to erase history. Retention is a manual
# local operation from the home machine (see deploy/README.md).
#
# Requires /etc/acme-commerce/backup.env (root, chmod 600) providing:
#   RESTIC_REPOSITORY   rest:http://restic-user:<pw>@<tailnet-ip>:8000/restic-user/starlightpayload
#                       (path MUST start with the username — --private-repos)
#   RESTIC_PASSWORD_FILE=/etc/acme-commerce/restic.key
#   REPO_DIR            path to the StarlightPayload checkout
#   SECRETS_DIR         path holding the production env files (default /etc/acme-commerce)
#
# Install via deploy/systemd/acme-commerce-backup.timer (bootstrap does this).
# Restore procedure: deploy/restore.sh (READ deploy/README.md first).
set -euo pipefail

ENV_FILE="${BACKUP_ENV_FILE:-/etc/acme-commerce/backup.env}"
# `set -a` matters: restic reads RESTIC_REPOSITORY and RESTIC_PASSWORD_FILE from
# the ENVIRONMENT, and a plain `source` only creates shell variables. Without it
# the guard below passes (the shell variable exists) and restic then dies with
# "Please specify repository location" — after the dumps have been taken, so the
# unit looks like it ran. Observed on the production box 2026-07-30.
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

: "${RESTIC_REPOSITORY:?}"; : "${REPO_DIR:?}"
SECRETS_DIR="${SECRETS_DIR:-/etc/acme-commerce}"
STAGING="${STAGING:-/var/backups/acme-commerce}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-docker-postgres-1}"
DATE_TAG="$(date +%F)"

mkdir -p "$STAGING/dumps"

# --- 1. Per-database custom-format dumps (restorable individually with
#        pg_restore --no-owner; never a globals dump — §6.3).
for db in payload_db vendure_db authentik_db sharkey_db; do
    docker exec "$POSTGRES_CONTAINER" pg_dump -U platform_admin -d "$db" -Fc -f "/tmp/$db.dump"
    docker cp "$POSTGRES_CONTAINER:/tmp/$db.dump" "$STAGING/dumps/$db.dump"
    docker exec "$POSTGRES_CONTAINER" rm "/tmp/$db.dump"
done
echo "dumps staged: $(ls -sh "$STAGING/dumps" | tail -n +2 | tr '\n' ' ')"

# --- 2. Resolve named-volume mountpoints (never hardcode docker internals).
sharkey_files="$(docker volume inspect --format '{{.Mountpoint}}' docker_sharkey-files 2>/dev/null || true)"
caddy_data="$(docker volume inspect --format '{{.Mountpoint}}' docker_caddy-data 2>/dev/null || true)"

# --- 3. One restic snapshot covering everything restore needs.
#        test-emails are excluded twice over (dockerignore + here).
restic backup \
    --tag "nightly-$DATE_TAG" \
    --exclude "$REPO_DIR/apps/vendure/static/email/test-emails" \
    "$STAGING/dumps" \
    "$REPO_DIR/apps/web/media" \
    "$REPO_DIR/apps/vendure/static" \
    "$REPO_DIR/docker/caddy" \
    "$REPO_DIR/docker/docker-compose.yml" \
    "$REPO_DIR/docker/docker-compose.prod.yml" \
    "$SECRETS_DIR" \
    ${sharkey_files:+"$sharkey_files"} \
    ${caddy_data:+"$caddy_data"}

# --- 4. NO prune here. The rest-server is --append-only, so a delete from
#        this host is refused by design (that is the ransomware guard).
#        Retention runs locally on the backup machine — deploy/README.md.

# --- 5. Integrity: verify the repository once a week (Sunday). Read-only,
#        so it works fine against an append-only server.
if [[ "$(date +%u)" == "7" ]]; then
    restic check
fi

echo "backup complete: $(restic snapshots --latest 1 --compact | tail -2 | head -1)"
