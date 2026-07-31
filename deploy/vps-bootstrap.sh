#!/bin/bash
# Netcup RS 2000 G12 base hardening + docker bootstrap (§7.16). Run as root on
# a FRESH Debian/Ubuntu box AFTER: SSH in verifying the stored host-key
# fingerprints (stored in your password manager), key
# auth installed, password login disabled, both Netcup passwords rotated.
#
# Each phase is confirmation-gated; rerun safely (idempotent-ish).
set -euo pipefail

confirm() { read -r -p "$1 [y/N] " r; [[ "$r" == "y" || "$r" == "Y" ]]; }

if confirm "Phase 1: apt update/upgrade + base packages (fail2ban, ufw, unattended-upgrades)?"; then
    apt-get update && apt-get -y upgrade
    apt-get -y install fail2ban ufw unattended-upgrades curl git gnupg ca-certificates restic
    dpkg-reconfigure -f noninteractive unattended-upgrades
    systemctl enable --now fail2ban
fi

if confirm "Phase 2: UFW (allow 22, 80, 443; deny rest)? NOTE: Docker-published ports bypass UFW — the prod compose publishes ONLY caddy 80/443, which is exactly the allowed set."; then
    ufw default deny incoming
    ufw default allow outgoing
    ufw allow 22/tcp
    ufw allow 80/tcp
    ufw allow 443/tcp
    ufw allow 443/udp   # HTTP/3
    ufw --force enable
fi

if confirm "Phase 3: install Docker Engine (official repo)?"; then
    curl -fsSL https://get.docker.com | sh
    systemctl enable --now docker
fi

if confirm "Phase 4: install + join tailscale (Puck AI bridge; §6.5 one-mechanism)?"; then
    curl -fsSL https://tailscale.com/install.sh | sh
    echo "Run manually with your auth key:  tailscale up --authkey=<key>"
fi

if confirm "Phase 5: create /etc/acme-commerce (root-owned 700) for env files + restic key?"; then
    install -d -m 700 -o root -g root /etc/acme-commerce
    install -d -m 700 -o root -g root /var/backups/acme-commerce
    cat <<'TODO'
Place these files (root, chmod 600), minted FRESH per docker/.env.production.example:
  /etc/acme-commerce/docker.env        -> symlink/copy to <repo>/docker/.env
  /etc/acme-commerce/web.env           -> symlink/copy to <repo>/apps/web/.env
  /etc/acme-commerce/backup.env        (RESTIC_REPOSITORY, creds, REPO_DIR, ...)
  /etc/acme-commerce/restic.key        (openssl rand -base64 32)
Then: restic init   (creates the encrypted repository)
TODO
fi

if confirm "Phase 6: install the nightly backup timer (deploy/systemd/*)?"; then
    script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    cp "$script_dir/systemd/acme-commerce-backup.service" /etc/systemd/system/
    cp "$script_dir/systemd/acme-commerce-backup.timer" /etc/systemd/system/
    systemctl daemon-reload
    systemctl enable --now acme-commerce-backup.timer
    systemctl list-timers acme-commerce-backup.timer --no-pager
fi

echo "Bootstrap done. Continue with deploy/README.md (restore order, stack start, smoke)."
