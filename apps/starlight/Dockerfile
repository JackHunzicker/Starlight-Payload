# Starlight (The Archive) — two targets:
#   dev        — TinaCMS dev server wrapping `astro dev` (live editing; /docs/admin
#                served; TINA_PUBLIC_IS_LOCAL). Local compose only.
#   production — `tinacms build && astro build` (SSR, @astrojs/node standalone),
#                Tina admin SPA STRIPPED, no dev servers, no GraphQL port.
# Build from monorepo root: docker build -f apps/starlight/Dockerfile --target <t> .
# Compose picks the target explicitly (docker-compose.override.yml = dev,
# docker-compose.prod.yml = production) — never rely on last-stage default.

FROM node:24-alpine AS base
RUN corepack enable && corepack prepare pnpm@11.16.0 --activate

# Install dependencies
FROM base AS deps
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY apps/starlight/package.json ./apps/starlight/
RUN pnpm install --frozen-lockfile --filter @starlight/docs...

# ============================== DEV TARGET ==================================
# Runs TinaCMS + Astro dev servers together for live editing.
FROM base AS dev
WORKDIR /app/apps/starlight

COPY --from=deps /app/node_modules /app/node_modules
COPY --from=deps /app/apps/starlight/node_modules ./node_modules

# Copy all source files (needed for live editing)
COPY apps/starlight/ ./

# Copy workspace config for pnpm
COPY pnpm-workspace.yaml /app/
COPY package.json /app/

# TinaCMS needs write access to content directory for editing
RUN chmod -R 777 ./src/content

# NOTE: tinacms dev generates client/admin assets at runtime on first start
# We need write access to public/admin for generated assets
RUN chmod -R 777 ./public

# Environment
ENV HOST=0.0.0.0
ENV PORT=7776
ENV TINA_PUBLIC_IS_LOCAL=true

EXPOSE 7776

# Run TinaCMS dev server which wraps Astro
# --datalayer-port 9001 avoids port 9000 conflicts
# This enables live editing: TinaCMS handles /admin, writes to filesystem
CMD ["npx", "tinacms", "dev", "-c", "astro dev --host --port 7776", "--datalayer-port", "9001"]

# =========================== PRODUCTION TARGET ==============================
FROM base AS prod-builder
WORKDIR /app/apps/starlight

COPY --from=deps /app/node_modules /app/node_modules
COPY --from=deps /app/apps/starlight/node_modules ./node_modules
COPY apps/starlight/ ./
COPY pnpm-workspace.yaml /app/
COPY package.json /app/

# `astro build` alone fails (Starlight's collections need Tina's generated
# files), so run the full build, then STRIP the generated Tina admin SPA from
# the client output — production serves no /docs/admin surface at all.
ENV TINA_PUBLIC_IS_LOCAL=true
RUN pnpm run build && rm -rf dist/client/admin public/admin

FROM base AS production
WORKDIR /app/apps/starlight
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 astro

# SSR runtime: @astrojs/node standalone entry + externals from node_modules.
COPY --from=deps --chown=astro:nodejs /app/node_modules /app/node_modules
COPY --from=deps --chown=astro:nodejs /app/apps/starlight/node_modules ./node_modules
COPY --from=prod-builder --chown=astro:nodejs /app/apps/starlight/dist ./dist
COPY --from=prod-builder --chown=astro:nodejs /app/apps/starlight/package.json ./package.json

USER astro

ENV HOST=0.0.0.0
ENV PORT=7776

EXPOSE 7776

CMD ["node", "dist/server/entry.mjs"]
