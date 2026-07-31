#!/bin/bash
# NON-INTERACTIVE migration driver, meant to be driven over SSH one phase at a
# time. The companion `vps-bootstrap.sh` is confirmation-gated and needs a TTY;
# this does the same work unattended, so an agent (or a phone) can run it.
#
#   vps-migrate.sh base      apt + fail2ban + unattended-upgrades + ufw + docker
#                            + tailscale (install only) + /etc/acme-commerce
#   vps-migrate.sh repo      clone from /root/starlight.bundle -> $REPO_DIR,
#                            link the env files, render templated configs
#   vps-migrate.sh tailnet   print the tailscale login URL and exit (a human
#                            taps it; joining needs a browser or an auth key)
#   vps-migrate.sh btcpay    start the pruned mainnet BTCPay stack
#   vps-migrate.sh build     build the application images
#   vps-migrate.sh restore   DESTRUCTIVE: recreate + restore the four databases
#                            from $DUMPS, then media/assets. Postgres only.
#   vps-migrate.sh up        start web alone (migrations), then the full stack
#   vps-migrate.sh postup    Authentik callback cleanup, Vendure stock cache +
#                            catalogue reindex, Sharkey overlay re-applied
#   vps-migrate.sh checks    HTTP/TLS/health matrix across every hostname
#
# Every phase is idempotent and safe to re-run, EXCEPT `restore`, which refuses
# unless the app services are down and requires RESTORE_CONFIRM=yes.
set -euo pipefail

REPO_DIR="${REPO_DIR:-/opt/starlightpayload}"
SECRETS="${SECRETS:-/etc/acme-commerce}"
BUNDLE="${BUNDLE:-/root/starlight.bundle}"
DUMPS="${DUMPS:-/root/dumps}"
BRANCH="${BRANCH:-mvp-storefront-launch}"
COMPOSE=(-f docker-compose.yml -f docker-compose.prod.yml)

log() { printf '\n=== %s\n' "$*"; }
have() { command -v "$1" >/dev/null 2>&1; }

phase_base() {
    export DEBIAN_FRONTEND=noninteractive
    log "apt update + upgrade"
    apt-get -qq update
    apt-get -qq -y -o Dpkg::Options::=--force-confold upgrade
    log "base packages"
    apt-get -qq -y install fail2ban ufw unattended-upgrades curl git gnupg \
        ca-certificates restic jq
    dpkg-reconfigure -f noninteractive unattended-upgrades
    systemctl enable --now fail2ban

    log "ufw — 22/80/443 only"
    # Docker-published ports bypass UFW. That is acceptable here precisely
    # because the production compose publishes only Caddy's 80/443, and BTCPay
    # binds the docker0 gateway rather than 0.0.0.0.
    ufw --force default deny incoming
    ufw --force default allow outgoing
    for p in 22/tcp 80/tcp 443/tcp 443/udp; do ufw allow "$p" >/dev/null; done
    ufw --force enable

    log "ssh — keys only, no root password login"
    install -d -m 755 /etc/ssh/sshd_config.d
    cat > /etc/ssh/sshd_config.d/10-acme-commerce.conf <<'SSHD'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
SSHD
    # Never lock ourselves out: only apply if the config parses AND a key is
    # already authorized.
    if sshd -t && [ -s /root/.ssh/authorized_keys ]; then
        systemctl reload ssh || systemctl reload sshd
        echo "password auth disabled"
    else
        rm -f /etc/ssh/sshd_config.d/10-acme-commerce.conf
        echo "REFUSED to disable password auth (config invalid or no authorized key)" >&2
        exit 1
    fi

    have docker || { log "docker engine"; curl -fsSL https://get.docker.com | sh; }
    systemctl enable --now docker
    have tailscale || { log "tailscale"; curl -fsSL https://tailscale.com/install.sh | sh; }

    log "secrets + staging directories"
    install -d -m 700 -o root -g root "$SECRETS" /var/backups/acme-commerce
    log "base complete"
    docker --version; tailscale version | head -1; ufw status | head -6
}

phase_repo() {
    [ -f "$BUNDLE" ] || { echo "missing bundle: $BUNDLE" >&2; exit 1; }
    if [ -d "$REPO_DIR/.git" ]; then
        log "repo exists — fetching from the bundle"
        git -C "$REPO_DIR" fetch "$BUNDLE" "+refs/heads/*:refs/remotes/bundle/*" --tags
        git -C "$REPO_DIR" checkout -q "$BRANCH"
        git -C "$REPO_DIR" reset --hard "bundle/$BRANCH"
    else
        log "cloning $BRANCH from the bundle"
        git clone -q --branch "$BRANCH" "$BUNDLE" "$REPO_DIR"
        # Point origin at GitHub so later pulls work once a deploy key exists;
        # the bundle itself stays as a fallback remote.
        git -C "$REPO_DIR" remote set-url origin \
            git@github.com:JackExample Owner/StarlightPayload.git
        git -C "$REPO_DIR" remote add bundle "$BUNDLE" 2>/dev/null || true
    fi

    log "linking env files from $SECRETS (never tracked, never in the image)"
    for pair in "docker.env:docker/.env" "web.env:apps/web/.env"; do
        src="$SECRETS/${pair%%:*}"; dst="$REPO_DIR/${pair##*:}"
        [ -f "$src" ] || { echo "missing $src" >&2; exit 1; }
        ln -sfn "$src" "$dst"
        echo "  $dst -> $src"
    done

    log "rendering templated configs (sharkey)"
    ( cd "$REPO_DIR" && set -a && . "$SECRETS/docker.env" && set +a \
      && bash deploy/render-configs.sh )
    git -C "$REPO_DIR" log --oneline -1
}

phase_tailnet() {
    if tailscale status >/dev/null 2>&1; then
        echo "already on the tailnet: $(tailscale ip -4)"
        return
    fi
    log "tailscale login URL (a human must open this once)"
    # `tailscale up` blocks on the browser flow; capture the URL and leave the
    # daemon waiting so the tap completes the join.
    timeout 25 tailscale up --accept-dns=false 2>&1 | grep -Eo 'https://login\.tailscale\.com/[a-zA-Z0-9]+' | head -1 \
      || echo "no URL captured — check: tailscale status"
}

phase_btcpay() {
    cd "$REPO_DIR/docker/btcpay"
    [ -f .env ] || { echo "missing docker/btcpay/.env (copy .env.mainnet.example and fill)" >&2; exit 1; }
    grep -q '^NBITCOIN_NETWORK=mainnet' .env || { echo "refusing: .env is not mainnet" >&2; exit 1; }
    log "disk headroom before the initial block download"
    df -h /var/lib/docker | tail -1
    log "starting the pruned mainnet stack (chain sync takes a day or more)"
    docker compose -f compose.yml -f compose.mainnet.yml -p btcpay-mainnet up -d
    docker compose -p btcpay-mainnet ps --format '{{.Name}}\t{{.State}}'
}

phase_build() {
    cd "$REPO_DIR/docker"
    log "building images (the web build needs no reachable database)"
    DOCKER_BUILDKIT=1 docker compose "${COMPOSE[@]}" build
    docker images --format '{{.Repository}}:{{.Tag}}\t{{.Size}}' | grep -E '^docker-' || true
}

phase_restore() {
    [ "${RESTORE_CONFIRM:-}" = "yes" ] || { echo "set RESTORE_CONFIRM=yes — this DROPS the four databases" >&2; exit 1; }
    cd "$REPO_DIR/docker"
    log "postgres only"
    docker compose "${COMPOSE[@]}" up -d postgres
    for _ in $(seq 1 30); do
        docker exec docker-postgres-1 pg_isready -U platform_admin -q && break
        sleep 2
    done
    log "restore (fresh roles -> per-database pg_restore --no-owner)"
    cd "$REPO_DIR"
    # Feed restore.sh's confirm prompts from a HEREDOC, never `yes y | ...`:
    # when the script exits, `yes` dies of SIGPIPE (141) and `pipefail` makes
    # the whole pipeline "fail" even though the restore succeeded — which under
    # `set -e` silently skips everything below. Observed live on 2026-07-30.
    bash deploy/restore.sh "$DUMPS" <<'CONFIRMS'
y
y
y
CONFIRMS

    log "DEPLOY GATE: unpublish the livetest course"
    # `lms-livetest` is published on purpose so the local e2e suite has a free,
    # enrollable course. On a public site it is a visible fake product, so the
    # gate runs here rather than living in a checklist a human can skip.
    docker exec docker-postgres-1 psql -U platform_admin -d payload_db -v ON_ERROR_STOP=1 -c \
        "UPDATE courses SET status='draft' WHERE slug='lms-livetest' AND status<>'draft';"
    docker exec docker-postgres-1 psql -U platform_admin -d payload_db -tAc \
        "SELECT 'published courses remaining: ' || count(*) FROM courses WHERE status='published'"

    log "media + assets"
    # Explicit `if`, not `[ -f x ] && tar`: as the last statement of a function
    # that idiom returns non-zero when the file is absent, which `set -e` in the
    # caller turns into a silent abort.
    if [ -f "$DUMPS/web-media.tgz" ]; then
        tar xzf "$DUMPS/web-media.tgz" -C "$REPO_DIR/apps/web"
    else
        echo "  no web-media.tgz — skipped"
    fi
    if [ -f "$DUMPS/vendure-assets.tgz" ]; then
        tar xzf "$DUMPS/vendure-assets.tgz" -C "$REPO_DIR/apps/vendure/static"
    else
        echo "  no vendure-assets.tgz — skipped"
    fi
    # The container runs as uid 1001 and must be able to write uploads.
    chown -R 1001:1001 "$REPO_DIR/apps/web/media" "$REPO_DIR/apps/vendure/static"
    du -sh "$REPO_DIR/apps/web/media" "$REPO_DIR/apps/vendure/static"
}

phase_up() {
    cd "$REPO_DIR/docker"
    log "web alone — its boot applies payload migrations exactly once"
    docker compose "${COMPOSE[@]}" up -d web
    for _ in $(seq 1 60); do
        [ "$(docker inspect -f '{{.State.Health.Status}}' docker-web-1 2>/dev/null)" = healthy ] && break
        sleep 3
    done
    docker inspect -f 'web: {{.State.Health.Status}}' docker-web-1
    log "the rest of the stack"
    docker compose "${COMPOSE[@]}" up -d
    docker compose "${COMPOSE[@]}" ps --format '{{.Name}}\t{{.State}}\t{{.Status}}'
}

phase_postup() {
    cd "$REPO_DIR/docker"
    set -a; . "$SECRETS/docker.env"; set +a

    log "Authentik: drop the localhost callback"
    # The production redirect URI travels inside the dump; the dev one must not
    # remain allowed on a public instance.
    if [ -f "$DUMPS/post-restore-authentik.sql" ]; then
        docker exec -i docker-postgres-1 psql -U platform_admin -d authentik_db \
            -v ON_ERROR_STOP=1 < "$DUMPS/post-restore-authentik.sql"
    else
        echo "  (no post-restore-authentik.sql — skipped)"
    fi

    log "Vendure: clear the channel/stock-location cache"
    # This cache survives restarts; stale entries make every product read as
    # out of stock after a restore.
    docker exec docker-postgres-1 psql -U platform_admin -d vendure_db -v ON_ERROR_STOP=1 -c \
        "DELETE FROM cache_item WHERE key LIKE 'MultiChannelStockLocationStrategy%';"

    log "Vendure: re-run the catalogue configuration (idempotent; queues a reindex)"
    # The shop API reads the search index, not the table, so disabled products
    # stay visible until it is rebuilt.
    docker compose "${COMPOSE[@]}" exec -T vendure-server node dist/scripts/configure-mvp.js

    log "Sharkey: re-apply the Acme Commerce overlay against the production URL"
    # No node on the host by design — run it in a throwaway container. The
    # instance is reached over its public hostname, so this needs Caddy up.
    docker run --rm -v "$REPO_DIR/apps/sharkey:/s:ro" \
        -e "SHARKEY_URL=$SHARKEY_URL" \
        -e "SHARKEY_ADMIN_USERNAME=$SHARKEY_ADMIN_USERNAME" \
        -e "SHARKEY_ADMIN_PASSWORD=$SHARKEY_ADMIN_PASSWORD" \
        -e "TLR_PUBLIC_URL=$TLR_PUBLIC_URL" \
        node:24-alpine node /s/rebrand.mjs

    log "postup complete"
}

phase_checks() {
    cd "$REPO_DIR/docker"
    set -a; . "$SECRETS/docker.env"; set +a
    log "container health"
    docker compose "${COMPOSE[@]}" ps --format '{{.Name}}\t{{.State}}\t{{.Status}}'
    # The app sets `trailingSlash: true`, so almost every path answers 308 on
    # the first hop. Reporting only the first status would show 308 everywhere
    # and read as broken; reporting only the final status would hide a wrong
    # redirect. So: first -> final.
    probe() { # probe <url>  ->  "308 -> 200"
        local first final
        first=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$1" || echo ERR)
        final=$(curl -sL -o /dev/null -w '%{http_code}' --max-time 25 "$1" || echo ERR)
        printf '%s -> %s' "$first" "$final"
    }

    log "public HTTPS matrix (first -> final; want ... -> 200)"
    for h in "$TLR_DOMAIN" "www.$TLR_DOMAIN" "$TGP_DOMAIN" "$SNM_DOMAIN" \
             "$AUTH_DOMAIN" "$COMMUNITY_DOMAIN" "$VENDURE_DOMAIN" "${PAY_DOMAIN:-}"; do
        [ -n "$h" ] || continue
        printf '  %-34s %s\n' "$h" "$(probe "https://$h/")"
    done

    log "redirect-only domains (want 301 -> 200, landing on the primary)"
    for h in "$SNM_REDIRECT_DOMAIN" "$TGP_REDIRECT_DOMAIN"; do
        [ -n "$h" ] || continue
        dest=$(curl -s -o /dev/null -w '%{redirect_url}' --max-time 20 "https://$h/" || true)
        printf '  %-34s %s  -> %s\n' "$h" "$(probe "https://$h/")" "${dest:-none}"
    done

    log "must NOT be reachable (want ... -> 404)"
    for path in "$TLR_DOMAIN/mailbox" "$TLR_DOMAIN/docs/admin/"; do
        printf '  %-34s %s\n' "$path" "$(probe "https://$path")"
    done

    log "deep health (want database + vendure ok)"
    curl -sL --max-time 25 "https://$TLR_DOMAIN/api/health?deep" || true
    echo
    log "unknown host on plain HTTP (want 421)"
    curl -s -o /dev/null -w '  %{http_code}\n' --max-time 15 \
        -H 'Host: nope.invalid' "http://$TLR_DOMAIN/" || true
    log "host port surface (want only 80/443)"
    # `| head` would SIGPIPE the upstream and, with pipefail, make a passing
    # check run exit non-zero — so bound the output in awk instead.
    ss -lntp | awk 'NR==1 || /0\.0\.0\.0|\[::\]/ {n++; if (n<=15) print}'
}

for phase in "$@"; do
    case "$phase" in
        base|repo|tailnet|btcpay|build|restore|up|postup|checks) "phase_$phase" ;;
        *) echo "unknown phase: $phase" >&2; exit 2 ;;
    esac
done
