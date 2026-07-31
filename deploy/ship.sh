#!/bin/bash
# Ship the committed HEAD of this repo to production. Safe to run from any
# agent session: every step verifies before acting, and nothing here touches
# databases or env files.
#
#   bash deploy/ship.sh              # preflight + transfer + fast-forward ONLY
#   bash deploy/ship.sh --build      # ...then rebuild + restart app services
#   bash deploy/ship.sh --check      # just run the health matrix and exit
#
# What it deliberately does NOT do: force-push, reset, restore, or touch
# /etc/acme-commerce. Those are vps-migrate.sh phases with their own guards.
#
# Windows note: run from Git Bash. The bundled Windows OpenSSH cannot negotiate
# with the server's OpenSSH 10.
set -euo pipefail

VPS="${VPS:-root@203.0.113.10}"
KEY="${KEY:-$HOME/.ssh/starlight_vps}"
REPO_DIR="${REPO_DIR:-/opt/starlightpayload}"
BRANCH="${BRANCH:-mvp-storefront-launch}"
LOCAL="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SSH=(ssh -i "$KEY" -o BatchMode=yes "$VPS")
COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"

say() { printf '\n== %s\n' "$*"; }

checks() {
    say "health matrix"
    for u in https://example.com/ https://orbitlabs.example/ \
             https://vertexsupply.example/ https://commerce.example.com/dashboard/ \
             https://community.example.com/ https://pay.example.com/; do
        printf '  %-48s %s\n' "$u" "$(curl -sL -o /dev/null -w '%{http_code}' --max-time 20 "$u" || echo ERR)"
    done
    printf '  deep health: %s\n' "$(curl -sL --max-time 20 'https://example.com/api/health?deep' || echo ERR)"
}

[ "${1:-}" = "--check" ] && { checks; exit 0; }

say "preflight (local)"
cd "$LOCAL"
[ "$(git branch --show-current)" = "$BRANCH" ] || { echo "not on $BRANCH" >&2; exit 1; }
if [ -n "$(git status --porcelain)" ]; then
    echo "NOTE: working tree has uncommitted changes — shipping committed HEAD only."
fi
NEW=$(git rev-parse HEAD)
echo "shipping: $(git log --oneline -1)"

say "preflight (server) — refuse to ship onto drift"
DRIFT=$("${SSH[@]}" "git -C $REPO_DIR status --porcelain | wc -l")
[ "$DRIFT" = "0" ] || { echo "server tree has $DRIFT modified files — investigate before shipping" >&2; exit 1; }
OLD=$("${SSH[@]}" "git -C $REPO_DIR rev-parse HEAD")
echo "server at: $OLD"
[ "$OLD" = "$NEW" ] && { echo "server already has this commit"; [ "${1:-}" = "--build" ] || exit 0; }

say "bundle + transfer"
BUNDLE="$(mktemp -u).bundle"
git bundle create "$BUNDLE" "$BRANCH" 2>/dev/null
scp -i "$KEY" "$BUNDLE" "$VPS:/root/starlight.bundle"
rm -f "$BUNDLE"

say "fast-forward the server (aborts rather than rewrites on divergence)"
"${SSH[@]}" "git -C $REPO_DIR fetch /root/starlight.bundle $BRANCH && git -C $REPO_DIR merge --ff-only FETCH_HEAD && git -C $REPO_DIR log --oneline -1"

if [ "${1:-}" != "--build" ]; then
    say "code delivered, NOT built. Run: bash deploy/ship.sh --build"
    exit 0
fi

say "rebuild + restart app services"
"${SSH[@]}" "cd $REPO_DIR/docker && $COMPOSE build web vendure-server && $COMPOSE up -d web vendure-server vendure-worker"

# Single-file bind mounts (Caddyfile, init-databases.sh) bind the INODE. Git
# replaces files on merge, so a reload serves the OLD config while reporting
# success — the container must be recreated. See the 2026-07-31 incident.
if "${SSH[@]}" "git -C $REPO_DIR diff --name-only $OLD $NEW | grep -q 'docker/caddy/Caddyfile'"; then
    say "Caddyfile changed — recreating caddy (reload is NOT enough on a single-file mount)"
    "${SSH[@]}" "cd $REPO_DIR/docker && $COMPOSE up -d --force-recreate caddy"
fi

say "wait for web health"
"${SSH[@]}" 'for i in $(seq 1 40); do s=$(docker inspect -f "{{.State.Health.Status}}" docker-web-1 2>/dev/null); [ "$s" = healthy ] && { echo healthy; exit 0; }; sleep 3; done; echo "NOT healthy"; exit 1'

checks
say "done — rollback: ssh in, git -C $REPO_DIR checkout $OLD && rebuild"
