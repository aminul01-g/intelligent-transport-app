# Infrastructure Layer — Full Configuration

Configure the complete infrastructure layer for the intelligent-transport-app monorepo: production Docker images, CI/CD GitHub Actions workflows, and a transactional database migration runner.

## Current State

The repository already has skeleton files for all 5 deliverables, but they are incomplete stubs:

| File | Status |
|---|---|
| [api.Dockerfile](file:///home/aminul/Development/Work/intelligent-transport-app/infra/docker/api.Dockerfile) | Has 4 stages, but no dedicated `deps` stage — builder copies all of `node_modules` to runner (bloated image). No non-root user. |
| [web.Dockerfile](file:///home/aminul/Development/Work/intelligent-transport-app/infra/docker/web.Dockerfile) | Copies full `.next/` + all `node_modules` instead of using Next.js standalone output. Only passes `NEXT_PUBLIC_API_URL`, missing `SOCKET_URL` and `GOOGLE_MAPS_API_KEY`. No non-root user. |
| [next.config.mjs](file:///home/aminul/Development/Work/intelligent-transport-app/apps/web/next.config.mjs) | Missing `output: 'standalone'` — required for the web Dockerfile's standalone runner strategy. |
| [ci.yml](file:///home/aminul/Development/Work/intelligent-transport-app/.github/workflows/ci.yml) | Single monolithic `build-and-test` job. References a `transport-app/` subdirectory that doesn't exist. No service containers. No coverage uploads. |
| [deploy.yml](file:///home/aminul/Development/Work/intelligent-transport-app/.github/workflows/deploy.yml) | All steps are TODO comments. Triggers on `push` instead of `workflow_run`. No `ghcr.io` integration. |
| [migrate.ts](file:///home/aminul/Development/Work/intelligent-transport-app/infra/scripts/migrate.ts) | Connects to DB but has no migration logic (TODO stub). No `schema_migrations` table. No `up`/`down`/`status` commands. |

## User Review Required

> [!IMPORTANT]
> **Next.js config change**: Adding `output: 'standalone'` to [next.config.mjs](file:///home/aminul/Development/Work/intelligent-transport-app/apps/web/next.config.mjs) changes how Next.js builds work — it bundles a self-contained Node.js server into `.next/standalone/`. This is required for the Docker runner but means `npm run start` locally will also use standalone mode. This is the standard production deployment pattern for Next.js in Docker.

> [!WARNING]
> **Breaking change to docker-compose targets**: The existing [docker-compose.yml](file:///home/aminul/Development/Work/intelligent-transport-app/docker-compose.yml) references a `development` target in both Dockerfiles. The new api.Dockerfile restructures stages into `base → deps → builder → runner` — the `development` target will be removed. You will need to either:
> - (A) Add a `development` stage alias back into the Dockerfiles for docker-compose dev compatibility, or
> - (B) Update docker-compose.yml to remove the `target: development` line and mount source via volumes instead.
>
> **My recommendation**: Option (A) — I will preserve the `development` stage in both Dockerfiles so docker-compose continues working unchanged.

## Open Questions

> [!IMPORTANT]
> **Test framework configuration**: The spec calls for Jest (api) and Vitest (web), but neither [apps/api/package.json](file:///home/aminul/Development/Work/intelligent-transport-app/apps/api/package.json) nor [apps/web/package.json](file:///home/aminul/Development/Work/intelligent-transport-app/apps/web/package.json) currently has a `test` script or test framework dependency. Should I:
> - (A) Add Jest + config to `apps/api` and Vitest + config to `apps/web` as part of this work, or
> - (B) Create the CI workflow jobs that will call `npm test` but leave the actual test framework setup for a future task?
>
> I will go with **(A)** — add minimal test scaffold (config + one placeholder test) so the CI pipeline is fully runnable.

> [!NOTE]
> **Monorepo workspace context**: The Dockerfiles must copy `packages/config/`, `packages/shared-types/`, and `packages/ui-kit/` (for web) since they are workspace dependencies resolved at install time. The existing Dockerfiles already do this, and I will preserve that pattern.

---

## Proposed Changes

### Docker — API

#### [MODIFY] [api.Dockerfile](file:///home/aminul/Development/Work/intelligent-transport-app/infra/docker/api.Dockerfile)

Complete rewrite to implement the 4-stage architecture with a dedicated `deps` stage:

```dockerfile
# --- Stage: base ---
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat

# --- Stage: deps (production-only node_modules) ---
FROM base AS deps
COPY package.json package-lock.json* ./
COPY packages/config/package.json ./packages/config/package.json
COPY packages/shared-types/package.json ./packages/shared-types/package.json
COPY apps/api/package.json ./apps/api/package.json
RUN npm ci --omit=dev

# --- Stage: builder (full install + compile) ---
FROM base AS builder
COPY package.json package-lock.json* ./
COPY packages/config/ ./packages/config/
COPY packages/shared-types/ ./packages/shared-types/
COPY apps/api/ ./apps/api/
RUN npm ci
RUN npm run build -w @transport/shared-types
RUN npm run build -w @transport/api    # outputs to apps/api/dist/

# --- Stage: development (preserved for docker-compose) ---
FROM base AS development
# ... (full source + npm install + dev CMD)

# --- Stage: runner (minimal production image) ---
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodeapp
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/packages/shared-types ./packages/shared-types
COPY --from=builder /app/package.json ./package.json
USER nodeapp
EXPOSE 4000
CMD ["node", "dist/index.js"]
```

Key changes:
- **Dedicated `deps` stage** copies only `package.json` files and runs `npm ci --omit=dev` → minimal `node_modules`
- **Non-root user** (`nodeapp:nodejs`) in runner stage
- **`development` stage preserved** for docker-compose compatibility
- Runner copies compiled output from `builder` but `node_modules` from `deps`

---

### Docker — Web

#### [MODIFY] [web.Dockerfile](file:///home/aminul/Development/Work/intelligent-transport-app/infra/docker/web.Dockerfile)

Rewrite to use Next.js standalone output with all three `NEXT_PUBLIC_` build args:

```dockerfile
# --- Stage: deps ---
FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json* ./
COPY packages/*/package.json ...  # workspace package.jsons
COPY apps/web/package.json ./apps/web/package.json
RUN npm ci

# --- Stage: builder ---
FROM node:20-alpine AS builder
WORKDIR /app
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SOCKET_URL
ARG NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SOCKET_URL=$NEXT_PUBLIC_SOCKET_URL
ENV NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=$NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build -w @transport/shared-types
RUN npm run build -w @transport/ui-kit
RUN npm run build -w @transport/web

# --- Stage: development (preserved for docker-compose) ---

# --- Stage: runner (standalone Next.js server) ---
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "apps/web/server.js"]
```

Key changes:
- **Standalone output**: `next build` with `output: 'standalone'` produces `.next/standalone/` with a self-contained `server.js`
- **All 3 `NEXT_PUBLIC_` ARGs** baked in at build time
- **Non-root user** (`nextjs:nodejs`)
- Image size drops significantly (no full `node_modules` in runner)

#### [MODIFY] [next.config.mjs](file:///home/aminul/Development/Work/intelligent-transport-app/apps/web/next.config.mjs)

Add `output: 'standalone'` to the Next.js config:

```diff
 const nextConfig = {
+  output: 'standalone',
   reactStrictMode: true,
   transpilePackages: ['@transport/shared-types', '@transport/ui-kit'],
```

---

### CI Workflow

#### [MODIFY] [ci.yml](file:///home/aminul/Development/Work/intelligent-transport-app/.github/workflows/ci.yml)

Complete rewrite from monolithic single job to 5 parallel/dependent jobs:

**Triggers**: `push` to `main`, `pull_request` to `main` (removes `master`, `dev`).

| Job | Dependencies | Services | Key Steps |
|---|---|---|---|
| `lint` | — | — | `npm ci` → `npm run lint` |
| `typecheck` | — | — | `npm ci` → `npm run typecheck` |
| `test-api` | — | postgres:16-alpine, redis:7-alpine | `npm ci` → `npm test -w @transport/api` → upload coverage |
| `test-web` | — | — | `npm ci` → `npm test -w @transport/web` → upload coverage |
| `build` | lint, typecheck | — | `npm ci` → `build:api` + `build:web` → cache `.next/` |

All jobs:
- Use `ubuntu-latest` and `actions/setup-node@v4` with `node-version: 20`
- Cache `node_modules` via `actions/cache@v4` keyed on `hashFiles('package-lock.json')`
- The `build` job additionally caches `.next/cache` keyed on `hashFiles('apps/web/src/**')`

Service containers for `test-api`:
```yaml
services:
  postgres:
    image: postgres:16-alpine
    env:
      POSTGRES_DB: transport_test
      POSTGRES_USER: test_user
      POSTGRES_PASSWORD: test_pass
    ports: ['5432:5432']
    options: --health-cmd pg_isready --health-interval 10s --health-timeout 5s --health-retries 5
  redis:
    image: redis:7-alpine
    ports: ['6379:6379']
    options: --health-cmd "redis-cli ping" --health-interval 10s --health-timeout 5s --health-retries 5
```

---

### Deploy Workflow

#### [MODIFY] [deploy.yml](file:///home/aminul/Development/Work/intelligent-transport-app/.github/workflows/deploy.yml)

Complete rewrite:

```yaml
name: Deploy
on:
  workflow_run:
    workflows: ["CI"]
    types: [completed]

jobs:
  push-images:
    runs-on: ubuntu-latest
    if: ${{ github.event.workflow_run.conclusion == 'success' }}
    permissions:
      contents: read
      packages: write
    steps:
      - Checkout
      - Login to ghcr.io (docker/login-action@v3, GITHUB_TOKEN)
      - Set up Docker Buildx
      - Build + push API image (tagged sha + latest)
      - Build + push Web image (tagged sha + latest, with --build-arg for NEXT_PUBLIC_* from secrets)
```

Image tags:
- `ghcr.io/${{ github.repository }}/api:${{ github.sha }}` + `:latest`
- `ghcr.io/${{ github.repository }}/web:${{ github.sha }}` + `:latest`

---

### Migration Runner

#### [MODIFY] [migrate.ts](file:///home/aminul/Development/Work/intelligent-transport-app/infra/scripts/migrate.ts)

Complete rewrite implementing `up`, `down`, and `status` subcommands:

**Schema tracking table**:
```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
  filename    TEXT PRIMARY KEY,
  applied_at  TIMESTAMPTZ DEFAULT NOW()
);
```

**Command: `up`**
1. Read all `*.sql` files from `infra/migrations/` (excluding `*.down.sql`), sorted lexicographically
2. Query `schema_migrations` for already-applied filenames
3. For each pending migration:
   - `BEGIN` transaction
   - Execute SQL file contents
   - `INSERT INTO schema_migrations (filename) VALUES ($1)`
   - `COMMIT`
4. Print summary of applied migrations

**Command: `down`**
1. Query `schema_migrations` for the most recently applied migration (by `applied_at DESC LIMIT 1`)
2. Derive the rollback filename: `<name>.down.sql`
3. If rollback file doesn't exist, exit with error
4. `BEGIN` → execute rollback SQL → `DELETE FROM schema_migrations WHERE filename = $1` → `COMMIT`

**Command: `status`**
1. Read all migration files from disk
2. Query `schema_migrations` for applied filenames
3. Print table: `filename | status (applied/pending) | applied_at`

**Invocation**: `npx ts-node infra/scripts/migrate.ts up|down|status`

---

### Test Scaffolding (supporting CI)

#### [NEW] apps/api/jest.config.ts
Minimal Jest config targeting `apps/api/src/**/*.test.ts`.

#### [NEW] apps/api/src/__tests__/health.test.ts
One placeholder test that verifies the health endpoint returns 200.

#### [NEW] apps/web/vitest.config.ts
Minimal Vitest config for `apps/web`.

#### [NEW] apps/web/src/__tests__/page.test.tsx
One placeholder test that verifies the home page renders.

#### [MODIFY] [apps/api/package.json](file:///home/aminul/Development/Work/intelligent-transport-app/apps/api/package.json)
Add `"test": "jest --coverage"` script and Jest + ts-jest devDependencies.

#### [MODIFY] [apps/web/package.json](file:///home/aminul/Development/Work/intelligent-transport-app/apps/web/package.json)
Add `"test": "vitest run --coverage"` script and Vitest devDependencies.

---

## Verification Plan

### Automated Tests

1. **Docker builds** — Validate both images build successfully:
   ```bash
   docker build -f infra/docker/api.Dockerfile -t transport-api:test .
   docker build -f infra/docker/web.Dockerfile -t transport-web:test \
     --build-arg NEXT_PUBLIC_API_URL=http://localhost:4000 \
     --build-arg NEXT_PUBLIC_SOCKET_URL=ws://localhost:4000 \
     --build-arg NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=test .
   ```

2. **Non-root user verification**:
   ```bash
   docker run --rm transport-api:test whoami  # should print "nodeapp"
   docker run --rm transport-web:test whoami  # should print "nextjs"
   ```

3. **CI workflow syntax validation**:
   ```bash
   # Validate YAML syntax
   npx yaml-lint .github/workflows/ci.yml
   npx yaml-lint .github/workflows/deploy.yml
   ```

4. **Migration script dry run** (requires running Postgres from docker-compose):
   ```bash
   npx ts-node infra/scripts/migrate.ts status
   ```

5. **TypeScript compilation**:
   ```bash
   npx tsc --noEmit -p infra/scripts/tsconfig.json  # (will create tsconfig for scripts)
   ```

### Manual Verification

- Push a branch and open a PR to `main` to trigger the CI workflow and verify all 5 jobs run in parallel/with correct dependencies
- Merge to `main` and verify the deploy workflow triggers on CI success
