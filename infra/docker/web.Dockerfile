# =============================================================================
# web.Dockerfile — Multi-stage production image for @transport/web (Next.js)
#
# Requires next.config.mjs to have: output: 'standalone'
#
# Stages:
#   deps        — Full install of all workspace dependencies
#   builder     — Compile shared packages + Next.js build (standalone output)
#   development — Dev target used by docker-compose.yml (hot-reload)
#   runner      — Minimal standalone Next.js server; non-root user; EXPOSE 3000
#
# NEXT_PUBLIC_ variables are baked into the client bundle at build time via ARG.
# Pass them at docker build time: --build-arg NEXT_PUBLIC_API_URL=https://...
# =============================================================================

# -----------------------------------------------------------------------------
# Stage: deps
# Install ALL dependencies (Next.js build tools are devDependencies).
# Copying only manifests first for maximum layer-cache efficiency.
# -----------------------------------------------------------------------------
FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat

# Root workspace manifest
COPY package.json package-lock.json* ./

# Workspace package manifests
COPY packages/config/package.json       ./packages/config/package.json
COPY packages/shared-types/package.json ./packages/shared-types/package.json
COPY packages/ui-kit/package.json       ./packages/ui-kit/package.json
COPY apps/web/package.json              ./apps/web/package.json

# Full install (Next.js needs devDeps like typescript, postcss, tailwindcss)
RUN npm ci

# -----------------------------------------------------------------------------
# Stage: builder
# Bakes NEXT_PUBLIC_ environment variables into the client bundle.
# These are public values — safe to embed in the image at build time.
# -----------------------------------------------------------------------------
FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat

# Accept NEXT_PUBLIC_ vars as build-time arguments
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SOCKET_URL
ARG NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

# Set as ENV so Next.js inlines them into the client JS bundle during build
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SOCKET_URL=$NEXT_PUBLIC_SOCKET_URL
ENV NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=$NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
ENV NODE_ENV=production

# Bring in pre-installed node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy full source of all workspace packages
COPY packages/config/       ./packages/config/
COPY packages/shared-types/ ./packages/shared-types/
COPY packages/ui-kit/       ./packages/ui-kit/
COPY apps/web/              ./apps/web/
COPY package.json           ./package.json

# Build workspace packages in dependency order
RUN npm run build -w @transport/shared-types
RUN npm run build -w @transport/ui-kit

# Build Next.js (outputs to apps/web/.next/standalone/ because output:'standalone')
RUN npm run build:web

# -----------------------------------------------------------------------------
# Stage: development
# Used by docker-compose.yml (target: development) for hot-reload workflow.
# -----------------------------------------------------------------------------
FROM node:20-alpine AS development
WORKDIR /app
RUN apk add --no-cache libc6-compat

ARG NODE_ENV=development
ENV NODE_ENV=${NODE_ENV}

# Accept NEXT_PUBLIC_ vars for local dev overrides
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SOCKET_URL
ARG NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_SOCKET_URL=${NEXT_PUBLIC_SOCKET_URL}
ENV NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=${NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}

COPY package.json package-lock.json* ./
COPY packages/config/       ./packages/config/
COPY packages/shared-types/ ./packages/shared-types/
COPY packages/ui-kit/       ./packages/ui-kit/
COPY apps/web/              ./apps/web/

RUN npm install

RUN npm run build -w @transport/shared-types
RUN npm run build -w @transport/ui-kit

EXPOSE 3000
CMD ["npm", "run", "dev", "-w", "@transport/web"]

# -----------------------------------------------------------------------------
# Stage: runner
# Minimal standalone Next.js server.
#   • Uses the self-contained .next/standalone/ output (includes its own server.js)
#   • Does NOT need node_modules — Next.js standalone bundles all deps
#   • Runs as non-root user (nextjs:nodejs)
# -----------------------------------------------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Create non-root system group and user
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

# Copy public assets (served directly by Next.js standalone server)
COPY --from=builder /app/apps/web/public ./apps/web/public

# Copy the standalone server bundle (self-contained, includes minimal node_modules)
COPY --from=builder --chown=nextjs:nodejs \
    /app/apps/web/.next/standalone ./

# Copy static assets into the expected location relative to the standalone server
COPY --from=builder --chown=nextjs:nodejs \
    /app/apps/web/.next/static ./apps/web/.next/static

# Drop privileges
USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# The standalone build produces apps/web/server.js as the entrypoint
CMD ["node", "apps/web/server.js"]
