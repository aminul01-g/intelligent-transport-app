# =============================================================================
# api.Dockerfile — Multi-stage production image for @transport/api
#
# Stages:
#   base        — Shared Alpine base with libc6-compat
#   deps        — Production-only node_modules (npm ci --omit=dev)
#   builder     — Full install + TypeScript compile → dist/
#   development — Dev target used by docker-compose.yml (hot-reload)
#   runner      — Minimal production image; non-root user; EXPOSE 4000
# =============================================================================

# -----------------------------------------------------------------------------
# Stage: base
# Shared base image — sets WORKDIR and installs native build tools.
# -----------------------------------------------------------------------------
FROM node:20-alpine AS base
WORKDIR /app
# libc6-compat is required for some native npm packages on Alpine
RUN apk add --no-cache libc6-compat

# -----------------------------------------------------------------------------
# Stage: deps
# Install ONLY production dependencies (--omit=dev).
# Copying only package manifests first maximises Docker layer cache reuse —
# this layer is only invalidated when lock-file or package.json files change.
# -----------------------------------------------------------------------------
FROM base AS deps

# Root workspace manifest
COPY package.json package-lock.json* ./

# Workspace package manifests (needed for npm workspaces resolution)
COPY packages/config/package.json       ./packages/config/package.json
COPY packages/shared-types/package.json ./packages/shared-types/package.json
COPY apps/api/package.json              ./apps/api/package.json

# Install production deps only — keeps node_modules lean for the runner stage
RUN npm ci --omit=dev

# -----------------------------------------------------------------------------
# Stage: builder
# Full install (includes devDependencies for tsc) then compile.
# -----------------------------------------------------------------------------
FROM base AS builder

# Copy root manifests
COPY package.json package-lock.json* ./

# Copy full source trees for all required packages
COPY packages/config/       ./packages/config/
COPY packages/shared-types/ ./packages/shared-types/
COPY apps/api/              ./apps/api/

# Install everything (devDeps needed for tsc / ts-node)
RUN npm ci

# Compile shared-types first (api depends on its output)
RUN npm run build -w @transport/shared-types

# Compile the API — TypeScript outputs to apps/api/dist/
RUN npm run build:api

# -----------------------------------------------------------------------------
# Stage: development
# Used by docker-compose.yml (target: development).
# Mounts source via volumes, uses nodemon for hot-reload.
# -----------------------------------------------------------------------------
FROM base AS development
ARG NODE_ENV=development
ENV NODE_ENV=${NODE_ENV}

COPY package.json package-lock.json* ./
COPY packages/config/       ./packages/config/
COPY packages/shared-types/ ./packages/shared-types/
COPY apps/api/              ./apps/api/

RUN npm install

# Build shared-types so the API can resolve @transport/shared-types imports
RUN npm run build -w @transport/shared-types

EXPOSE 4000
CMD ["npm", "run", "dev", "-w", "@transport/api"]

# -----------------------------------------------------------------------------
# Stage: runner
# Minimal production image.
#   • Copies prod-only node_modules from the 'deps' stage
#   • Copies compiled dist/ from the 'builder' stage
#   • Runs as a non-root user (nodeapp:nodejs)
# -----------------------------------------------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Create non-root system group and user
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nodeapp

# Copy production node_modules (minimal, no devDeps)
COPY --from=deps /app/node_modules           ./node_modules

# Copy compiled API output
COPY --from=builder /app/apps/api/dist       ./dist

# Copy shared-types build (runtime peer dependency)
COPY --from=builder /app/packages/shared-types ./packages/shared-types

# Copy root package.json (required for npm workspaces runtime resolution)
COPY --from=builder /app/package.json        ./package.json

# Drop privileges — never run as root in production
USER nodeapp

EXPOSE 4000
CMD ["node", "dist/index.js"]
