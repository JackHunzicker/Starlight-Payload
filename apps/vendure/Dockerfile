# Production Dockerfile for Vendure
# Build from monorepo root: docker build -f apps/vendure/Dockerfile .

FROM node:24-alpine AS base
RUN corepack enable && corepack prepare pnpm@11.16.0 --activate

# Install dependencies and build
FROM base AS builder
WORKDIR /app

# Copy full monorepo for pnpm workspace resolution
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY apps/vendure ./apps/vendure
COPY packages ./packages

# Install all dependencies in the monorepo context
RUN pnpm install --frozen-lockfile

WORKDIR /app/apps/vendure
RUN pnpm run build
RUN pnpm run build:dashboard

# Production image
FROM base AS runner
WORKDIR /app/apps/vendure

ENV NODE_ENV=production

# Copy built application and dependencies
COPY --from=builder /app/apps/vendure/dist ./dist
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/apps/vendure/node_modules ./node_modules
COPY --from=builder /app/apps/vendure/package.json ./

# Copy static assets (email templates, images)
COPY --from=builder /app/apps/vendure/static ./static

# 7774 serves the API and the React Dashboard (/dashboard).
EXPOSE 7774

# Default to server, override in docker-compose for worker
CMD ["node", "dist/index.js"]
