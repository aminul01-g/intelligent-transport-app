# --- BASE IMAGE ---
FROM node:20-alpine AS base
WORKDIR /app

# Install build dependencies for Next.js
RUN apk add --no-cache libc6-compat

# Copy workspace settings and metadata
COPY package.json package-lock.json* ./
COPY packages/config/ ./packages/config/
COPY packages/shared-types/ ./packages/shared-types/
COPY packages/ui-kit/ ./packages/ui-kit/
COPY apps/web/ ./apps/web/

# --- DEVELOPMENT TARGET ---
FROM base AS development
ARG NODE_ENV=development
ENV NODE_ENV=${NODE_ENV}
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

RUN npm install
# Build the local libraries
RUN npm run build -w @transport/shared-types
RUN npm run build -w @transport/ui-kit
EXPOSE 3000
CMD ["npm", "run", "dev", "-w", "@transport/web"]

# --- PRODUCTION BUILDER ---
FROM base AS builder
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
RUN npm ci
RUN npm run build -w @transport/shared-types
RUN npm run build -w @transport/ui-kit
RUN npm run build -w @transport/web

# --- PRODUCTION RUNNER ---
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared-types ./packages/shared-types
COPY --from=builder /app/packages/ui-kit ./packages/ui-kit
COPY --from=builder /app/apps/web/.next ./apps/web/.next
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/apps/web/package.json ./apps/web/package.json

EXPOSE 3000
CMD ["npm", "run", "start", "-w", "@transport/web"]
