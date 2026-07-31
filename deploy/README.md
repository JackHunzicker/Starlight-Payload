# Acme Commerce Deployment Runbook

The operational companion to the 2026-07-29 infra plan (§6/§7 of the master
handoff in the internal notes). Everything here was built and validated locally on
2026-07-29; the compose surface is verified to publish **only 80/443** in the
production profile.

## Files

| Path | Purpose |
|---|---|
| `docker/docker-compose.yml` | Base stack (no ports published) |
| `docker/docker-compose.override.yml` | DEV ports + Tina dev target (auto-loaded by plain `docker compose up`) |
| `docker/docker-compose.prod.yml` | Caddy edge (80/443 only), edge/app/data networks, resource limits, log rotation, mailpit behind `--profile rehearsal` |
| `docker/caddy/Caddyfile` | Env-parameterized site blocks, HSTS/security headers, unknown-host rejection |
| `docker/.env.production.example` | Every production key, documented |
| `render-configs.sh` / `.ps1` | Render `*.template` configs (sharkey) from the env file |
| `backup.sh` + `systemd/` | Nightly per-DB dumps + restic offsite (7d/4w/6m) |
| `restore.sh` | Guided §6.3 restore order (fresh roles → `--no-owner` restores → verify) |
| `vps-bootstrap.sh` | Confirmation-gated base hardening (ufw/fail2ban/docker/tailscale/timer) |

## Production run form

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

Never copy the dev override to the VPS. Local rehearsal adds `--profile
rehearsal` (mailpit SMTP sink at `mailpit:1025`, UI on :8025).

## Secrets contract

- Registry of record: `your secret store` (local internal-notes
  machine, gitignored). Production values are **minted fresh at VPS setup**
  (`openssl rand -base64 32`) and recorded there.
- On the VPS: `/etc/acme-commerce/{docker.env,web.env}` root-owned `chmod 600`,
  copied/symlinked to `<repo>/docker/.env` and `<repo>/apps/web/.env`.
- Nothing secret is tracked: postgres init is env-driven (`init-databases.sh`),
  sharkey config renders from a template, web build secrets ride BuildKit
  secret mounts.
- `apps/web/.env` on the VPS must set
  `AUTHENTIK_ISSUER=https://<AUTH_DOMAIN>/application/o/payload-cms/` (browser
  redirects) while compose keeps the internal issuer for token calls.

## Web image build — build ON the VPS, no database needed

**VERIFIED 2026-07-30 with the build cache disabled: the Next.js build
compiles against an unreachable database** (pointed at a black-hole IP;
`✓ Compiled successfully`). Nothing prerenders against Payload any more — the
catch-all route is `force-dynamic` — so the old "the build needs the DB"
constraint is gone.

That collapses the deployment story: **build on the VPS.** No registry, no
`docker save | ssh`, no temporary postgres publish, no DB gymnastics.

```bash
cd docker && docker compose -f docker-compose.yml -f docker-compose.prod.yml build
```

`WEB_BUILD_DATABASE_URL` still has to be *set* (the BuildKit secret mount
expects a file), but its value is now irrelevant to the outcome — leave it
pointing at the production connection string for consistency and do not
arrange for it to be reachable at build time.

Registry-based delivery stays available if the VPS ever gets CPU-constrained
(build locally → push to a private GHCR repo → VPS pulls), but it is no longer
the recommended path: it adds credentials and a moving part for no gain on an
8-core box.

## Migration day (§7.16 — condensed order)

1. SSH (verify stored host-key fingerprints) → key auth only → rotate both
   Netcup passwords → `vps-bootstrap.sh` phases 1–5.
2. Mint production secrets → place `/etc/acme-commerce/*` → `restic init`.
3. `git clone` the repo → link env files → `deploy/render-configs.sh`.
4. **Start bitcoind sync EARLY** (BTCPay official stack, separate compose;
   ~700 GB, takes a day+ — payments are dead until synced).
5. Bring dumps from the dev machine → `deploy/restore.sh <dumps-dir>`
   (only postgres running). **Deploy gate: unpublish/delete the
   `lms-livetest` course before or right after restore.**
6. Restore media/assets/sharkey files into place (restic or rsync).
7. Namecheap DNS: A/AAAA per the domain map (low TTL first), then
   `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d web`
   (one instance, runs migrations) → then the full stack. Caddy issues certs
   once DNS resolves.
8. Authentik: add per-domain redirect URIs for the payload-cms OIDC app
   (each brand domain + `/api/auth/callback/authentik`).
9. BTCPay mainnet checklist (official topology; low-value live purchase;
   over/under/late payment, replay, cancellation; manual pull-payment refund
   runbook) → SPF/DKIM/DMARC TXT records for the chosen SMTP → email matrix
   (verification, reset, order confirmation) against real SMTP.
10. Cross-brand browser smoke + fidelity pass → `systemctl enable --now
    acme-commerce-backup.timer` (bootstrap phase 6) → **one full restore
    drill** → monitoring live → announce.

## Backups (no cloud subscription)

The destination is **restic's rest-server on the operator home machine**, data on its
E: drive, reached from the VPS over Tailscale. Start it there with:

```bash
cd deploy/backup-server && docker compose up -d
```

- Bound to the **tailnet address only**, never `0.0.0.0` — it holds every
  production dump. htpasswd auth on top (`docker exec tl-backup-server
  create_user <name> <password>`).
- `--append-only`: the VPS can add snapshots but **cannot delete or rewrite**
  them, so a compromised server cannot erase your history. `backup.sh`
  therefore does not prune.
- `--private-repos`: the repository path **must start with the username**,
  e.g. `rest:http://restic-user:<pw>@<tailnet-ip>:8000/restic-user/starlightpayload`.
  A path that does not match the user returns 401.
- Retention is a **manual local operation** from the backup machine (it is the
  only host allowed to delete):

```bash
docker run --rm -e RESTIC_REPOSITORY=/data/restic-user/starlightpayload -e RESTIC_PASSWORD=<key> -v E:/acme-commerce-backups:/data restic/restic:latest forget --keep-daily 7 --keep-weekly 4 --keep-monthly 6 --prune
```

- Caveat worth knowing: backups only run while the home machine is on. A
  missed night is caught up by the next run; restic handles gaps fine.
- Verified 2026-07-29 end-to-end: init, backup, restore, and append-only
  refusing a delete.

## Health & monitoring

- `GET /api/health` — shallow (container healthcheck).
- `GET /api/health?deep` — DB round-trip + Vendure `/health`; 503 when
  degraded (point any uptime monitor here).
- Vendure worker: liveness on `:3020/health` (internal), compose healthcheck
  wired; a failed bootstrap now **exits** instead of idling.
- Authentik server + worker: image-native `ak healthcheck` probes.
- Logs: json-file, 10 MB × 5 per service (prod overlay).
- CI (`.github/workflows/ci.yml`): type-check, lint, working-tree gitleaks,
  `pnpm audit --audit-level critical` gate.

## Rollback

- **Code/images**: every loop is one commit on `mvp-storefront-launch`; tags
  are pinned — `git checkout <sha> && docker compose build` reproduces any
  prior stack.
- **Databases**: nightly dumps restore individually via `restore.sh` (or
  manually: `pg_restore -U platform_admin -d <db> --clean --no-owner <dump>`
  with the app stopped).
- **Authentik**: pre-upgrade dumps in `the ops workspace/backups/` (2025.12.2
  and 2026.2.6 checkpoints from 2026-07-29).
- **Caddy/domains**: DNS TTL is the lever — keep it low until stable.

## Local rehearsal (validated form)

```bash
# hosts: *.localhost resolve automatically; Caddy uses its internal CA.
TLR_DOMAIN=tlr.localhost TGP_DOMAIN=tgp.localhost SNM_DOMAIN=snm.localhost \
AUTH_DOMAIN=auth.localhost COMMUNITY_DOMAIN=community.localhost \
VENDURE_DOMAIN=commerce.localhost ACME_EMAIL=dev@localhost \
SMTP_HOST=mailpit SMTP_PORT=1025 EMAIL_FROM_ADDRESS=orders@tlr.localhost \
docker compose -f docker-compose.yml -f docker-compose.prod.yml \
  --profile rehearsal up -d
```

Then: only 80/443 (+8025 mailpit) reachable; every brand serves through
Caddy; `/mailbox` 404s; `/docs/admin/` 404s; unknown Host → 421/404; deep
health `ok`; a full checkout renders order-confirmation mail in mailpit.
