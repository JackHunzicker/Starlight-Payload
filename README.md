# Multi-brand commerce platform

A self-hosted monorepo that runs **several storefronts from one deployment**, each
resolved by hostname, with a shared commerce engine, a visual page editor, a docs
site, a course platform and a community server behind a single TLS edge.

It is a working integration, not a starter template: the parts that are genuinely
hard — per-brand catalogues, editor-owned page chrome, an identity that spans the
CMS and the shop, and a production compose profile that publishes nothing but
80/443 — are already solved here.

## What is in it

| Piece | Role |
|---|---|
| **Next.js 16 + Payload CMS 3** | Storefront and CMS in one app. Pages are Puck documents; brand is resolved from the request `Host`. |
| **Vendure 3.7** | Commerce engine — catalogue, orders, stock, shipping, payments. Each brand is a Vendure channel. |
| **Puck** | Visual page editor. Pages are composed from registered blocks, including page-owned header/footer. |
| **Astro Starlight** | Documentation site, proxied at `/docs/`. |
| **Sharkey** | Community server, rebranded through its admin API by an overlay script (never a fork). |
| **Caddy** | The only public listener. Automatic TLS, security headers, per-hostname routing, unknown hosts rejected. |
| **PostgreSQL 17** | One container, one database per service, one role per service. |

An LMS (courses → sections → activities, with enrolment and completion) is built
into the Payload app.

## Running it

Requirements: Docker, Node 24.x LTS, pnpm 11.

```bash
pnpm install
cp docker/.env.example docker/.env   # then fill in the blanks
cd docker && docker compose up -d
```

That starts the development profile, which publishes each service on its own port.
Production is a different compose overlay that publishes **only** Caddy:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

Ports in development: `7773` app + CMS admin, `7774` Vendure API and its React
Dashboard at `/dashboard`, `7776` docs, `7777` community, `5432` PostgreSQL.

## Multi-tenancy

Brands are declared in `apps/web/src/lib/tenants.ts` — a code, a display name and
the hostnames that map to it. A request whose `Host` matches no brand is refused
rather than silently served the default catalogue. Three demo brands ship as
examples (`tlr`, `snm`, `tgp`); rename or replace them.

Vendure enforces the same split with channels: a shop-API request without a
channel token is rejected instead of answering from the default channel.

## Demo data

`apps/vendure/src/scripts/catalog-data.ts` is **sample data**. It exercises the
awkward cases on purpose — made-to-order lines with no stock, inventory-tracked
lines that must not oversell, products that are priced but deliberately not yet
sellable, and two preparations under one listing. Replace `CATALOG` with your own;
nothing outside that file knows what is in it.

## Notes worth reading before you deploy

- **`NEXT_PUBLIC_*` and `STARLIGHT_URL` are baked at image build time.** Changing
  them requires a rebuild, not an env edit.
- **Config mounted as a single file** (the Caddyfile, the Postgres init script) is
  bound by inode. Git replaces files rather than editing them, so after pulling a
  config change you must **recreate** the container — reloading the process will
  silently keep serving the old file.
- **Never publish an admin UI that hard-codes an API port.** Anything serialized to
  the browser must be reachable from the browser; behind a reverse proxy an
  internal container port is not.
- Vendure's schema changes go through migrations; `synchronize` is off deliberately.
  Payload's `push` is off for the same reason.
- Secrets belong in env files mounted at runtime, never in the image and never in
  git. `docker/.env.production.example` documents every key.

## Licence

MIT — see [LICENSE](LICENSE), including the note on third-party components.
