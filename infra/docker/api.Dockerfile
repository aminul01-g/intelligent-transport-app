# --- BASE IMAGE ---
FROM node:20-alpine AS base
WORKDIR /app

# Install build dependencies if needed
RUN apk add --no-cache libc6-compat

# Copy configuration and workspaces metadata
COPY package.json package-lock.json* ./
COPY packages/config/ ./packages/config/
COPY packages/shared-types/ ./packages/shared-types/
COPY apps/api/ ./apps/api/

# --- DEVELOPMENT TARGET ---
FROM base AS development
ARG NODE_ENV=development
ENV NODE_ENV=${NODE_ENV}
RUN npm install
# Compile shared packages
RUN npm run build -w @transport/shared-types
EXPOSE 4000
CMD ["npm", "run", "dev", "-w", "@transport/api"]

# --- PRODUCTION BUILDER ---
FROM base AS builder
RUN npm ci
RUN npm run build -w @transport/shared-types
RUN npm run build -w @transport/api

# --- PRODUCTION RUNNER ---
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared-types ./packages/shared-types
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json

EXPOSE 4000
CMD ["node", "apps/api/dist/index.js"]
