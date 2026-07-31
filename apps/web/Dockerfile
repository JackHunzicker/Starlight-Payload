# Production Dockerfile for Payload CMS (Next.js)
# Build from monorepo root: docker build -f apps/web/Dockerfile .
# Requires output: 'standalone' in next.config.mjs

FROM node:24-alpine AS base
RUN corepack enable && corepack prepare pnpm@11.16.0 --activate

# Install dependencies and build
FROM base AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy full monorepo for pnpm workspace resolution
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY apps/web ./apps/web
COPY packages ./packages

# Install all dependencies in the monorepo context
RUN pnpm install --frozen-lockfile

WORKDIR /app/apps/web

# Non-secret build-time env vars. Secrets (DATABASE_URL, PAYLOAD_SECRET) are
# BuildKit secret mounts on the build step below — never ARG/ENV, which persist
# in `docker history` for the life of the image.
ARG NEXT_PUBLIC_SERVER_URL
ARG STARLIGHT_URL
# NEXT_PUBLIC_* is inlined into the client bundle at BUILD time — a runtime
# env var never reaches a 'use client' component. The community CTA token
# resolves against this, so it must be a build arg.
ARG NEXT_PUBLIC_COMMUNITY_URL

ENV NEXT_PUBLIC_SERVER_URL=$NEXT_PUBLIC_SERVER_URL
ENV STARLIGHT_URL=$STARLIGHT_URL
ENV NEXT_PUBLIC_COMMUNITY_URL=$NEXT_PUBLIC_COMMUNITY_URL
ENV NEXT_TELEMETRY_DISABLED=1

RUN --mount=type=secret,id=web_build_database_url \
    --mount=type=secret,id=payload_secret \
    DATABASE_URL="$(cat /run/secrets/web_build_database_url)" \
    PAYLOAD_SECRET="$(cat /run/secrets/payload_secret)" \
    pnpm run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Public assets, if any (tolerant glob — apps/web/public does not exist today).
# The standalone server serves public/ relative to server.js: apps/web/public,
# NOT /app/public — an earlier revision copied to the wrong place.
RUN mkdir -p apps/web/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public* ./apps/web/public/

# Set correct permissions for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Copy standalone output (preserves monorepo structure)
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
# Static files must be at apps/web/.next/static relative to server.js location
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

# Copy node_modules for payload CLI (needed for migrations)
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/node_modules ./apps/web/node_modules

# Copy payload config and source for migrations
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/src ./apps/web/src
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/package.json ./apps/web/package.json
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/tsconfig.json ./apps/web/tsconfig.json
# PostCSS config: payload-puck's styles endpoint compiles the editor iframe CSS at
# runtime via postcss-load-config, which resolves from the server cwd (apps/web).
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/postcss.config.mjs ./apps/web/postcss.config.mjs

USER nextjs

EXPOSE 7773

ENV PORT=7773
ENV HOSTNAME="0.0.0.0"

# Run migrations then start server.
# --forceAcceptWarning: the DB has been schema-pushed in dev mode, so `payload migrate`
# otherwise blocks on an interactive confirmation prompt that hangs the container.
CMD cd apps/web && npx payload migrate --forceAcceptWarning && cd ../.. && node apps/web/server.js
