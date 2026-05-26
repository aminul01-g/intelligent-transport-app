# Scaffold Monorepo for Intelligent Transport Ecosystem

We will scaffold a production-grade monorepo structure inside the directory `/home/aminul/Development/Work/Intelligent_Transport_System/transport-app` utilizing `npm` workspaces.

The structure will include:
- A root workspace configuration with npm scripts (`dev`, `build`, `lint`, `typecheck`, `test`).
- Shared configurations (TypeScript base configuration with strict mode, Prettier, and Airbnb ESLint for TypeScript).
- Two shared packages (`shared-types` and `ui-kit`).
- Two applications (`api` as a Node/Express TypeScript backend and `web` as a Next.js 14 frontend).
- Containerization setup (`docker-compose.yml`, development Dockerfiles, and production stubs).
- CI/CD workflow stubs (`ci.yml` and `deploy.yml`).

## User Review Required

> [!IMPORTANT]
> - All files will be placed under `/home/aminul/Development/Work/Intelligent_Transport_System/transport-app` so that the project root aligns with `/transport-app` relative to your workspace.
> - The Next.js app is configured to support strict module resolution and strict TypeScript options (e.g., `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`).
> - We will use ESLint with TypeScript and Airbnb rule extensions, defining `.eslintrc.js` inside `packages/config` to extend easily in other packages.
> - The `docker-compose.yml` configures Postgres 16 and Redis 7 with complete healthchecks and dependencies.

## Open Questions
- None.

---

## Proposed Changes

### Root Configurations

#### [NEW] [package.json](file:///home/aminul/Development/Work/Intelligent_Transport_System/transport-app/package.json)
Contains the root workspaces, devDependencies (`concurrently`, `typescript`, `eslint`, `prettier`), and scripts for `dev` (runs api + web concurrently), building, testing, and linting.

#### [NEW] [.gitignore](file:///home/aminul/Development/Work/Intelligent_Transport_System/transport-app/.gitignore)
Standard gitignore omitting `node_modules`, `dist`, `.next`, and all `.env*` files except `.env.example`.

#### [NEW] [.env.example](file:///home/aminul/Development/Work/Intelligent_Transport_System/transport-app/.env.example)
A master `.env.example` at the root with inline comments explaining each variable.

#### [NEW] [docker-compose.yml](file:///home/aminul/Development/Work/Intelligent_Transport_System/transport-app/docker-compose.yml)
Declares services: `postgres`, `redis`, `api`, and `web` with correct ports, volumes, healthchecks, networks, dependencies, and build arguments.

#### [NEW] [docker-compose.prod.yml](file:///home/aminul/Development/Work/Intelligent_Transport_System/transport-app/docker-compose.prod.yml)
A stub with TODOs for production-specific Docker compose settings.

---

### Config Package (`packages/config`)

#### [NEW] [tsconfig.base.json](file:///home/aminul/Development/Work/Intelligent_Transport_System/transport-app/packages/config/tsconfig.base.json)
The shared TypeScript configuration containing ES2022 target, strict mode checks (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), bundler resolution, and path aliases.

#### [NEW] [.eslintrc.js](file:///home/aminul/Development/Work/Intelligent_Transport_System/transport-app/packages/config/.eslintrc.js)
ESLint config with Airbnb TypeScript extension.

#### [NEW] [.prettierrc](file:///home/aminul/Development/Work/Intelligent_Transport_System/transport-app/packages/config/.prettierrc)
Standard Prettier code formatting choices.

---

### Shared Packages

#### [NEW] [package.json](file:///home/aminul/Development/Work/Intelligent_Transport_System/transport-app/packages/shared-types/package.json)
Package metadata for `@transport/shared-types`.

#### [NEW] [tsconfig.json](file:///home/aminul/Development/Work/Intelligent_Transport_System/transport-app/packages/shared-types/tsconfig.json)
Extends root tsconfig base.

#### [NEW] [index.ts](file:///home/aminul/Development/Work/Intelligent_Transport_System/transport-app/packages/shared-types/src/index.ts)
Shared types definitions and barrel export.

#### [NEW] [package.json](file:///home/aminul/Development/Work/Intelligent_Transport_System/transport-app/packages/ui-kit/package.json)
Package metadata for `@transport/ui-kit`.

#### [NEW] [tsconfig.json](file:///home/aminul/Development/Work/Intelligent_Transport_System/transport-app/packages/ui-kit/tsconfig.json)
Extends root tsconfig base.

#### [NEW] [index.ts](file:///home/aminul/Development/Work/Intelligent_Transport_System/transport-app/packages/ui-kit/src/index.ts)
Shared UI component definitions and barrel export.

---

### Backend Service (`apps/api`)

#### [NEW] [package.json](file:///home/aminul/Development/Work/Intelligent_Transport_System/transport-app/apps/api/package.json)
Dependencies and scripts for the Node.js API application.

#### [NEW] [tsconfig.json](file:///home/aminul/Development/Work/Intelligent_Transport_System/transport-app/apps/api/tsconfig.json)
Extends root tsconfig base.

#### [NEW] [.env.example](file:///home/aminul/Development/Work/Intelligent_Transport_System/transport-app/apps/api/.env.example)
API environment variables.

#### [NEW] [index.ts](file:///home/aminul/Development/Work/Intelligent_Transport_System/transport-app/apps/api/src/index.ts)
Express/Node application entry point stub.

---

### Frontend Service (`apps/web`)

#### [NEW] [package.json](file:///home/aminul/Development/Work/Intelligent_Transport_System/transport-app/apps/web/package.json)
Dependencies and scripts for the Next.js frontend application.

#### [NEW] [tsconfig.json](file:///home/aminul/Development/Work/Intelligent_Transport_System/transport-app/apps/web/tsconfig.json)
Extends root tsconfig base.

#### [NEW] [.env.example](file:///home/aminul/Development/Work/Intelligent_Transport_System/transport-app/apps/web/.env.example)
Web environment variables.

#### [NEW] [next.config.mjs](file:///home/aminul/Development/Work/Intelligent_Transport_System/transport-app/apps/web/next.config.mjs)
Next.js configuration using the modern ESM format.

#### [NEW] [page.tsx](file:///home/aminul/Development/Work/Intelligent_Transport_System/transport-app/apps/web/src/app/page.tsx)
Landing page boilerplate for the Next.js application.

#### [NEW] [layout.tsx](file:///home/aminul/Development/Work/Intelligent_Transport_System/transport-app/apps/web/src/app/layout.tsx)
Root layout component boilerplate.

#### [NEW] [sw.js](file:///home/aminul/Development/Work/Intelligent_Transport_System/transport-app/apps/web/public/sw.js)
Service worker empty stub.

---

### Infrastructure, Workflows & Documents

#### [NEW] [api.Dockerfile](file:///home/aminul/Development/Work/Intelligent_Transport_System/transport-app/infra/docker/api.Dockerfile)
Dockerfile for api.

#### [NEW] [web.Dockerfile](file:///home/aminul/Development/Work/Intelligent_Transport_System/transport-app/infra/docker/web.Dockerfile)
Dockerfile for Next.js web application.

#### [NEW] [.gitkeep](file:///home/aminul/Development/Work/Intelligent_Transport_System/transport-app/infra/migrations/.gitkeep)
Gitkeep file to preserve the empty migrations directory in version control.

#### [NEW] [migrate.ts](file:///home/aminul/Development/Work/Intelligent_Transport_System/transport-app/infra/scripts/migrate.ts)
Migration runner stub.

#### [NEW] [seed.ts](file:///home/aminul/Development/Work/Intelligent_Transport_System/transport-app/infra/scripts/seed.ts)
Seeding script stub.

#### [NEW] [.gitkeep](file:///home/aminul/Development/Work/Intelligent_Transport_System/transport-app/docs/.gitkeep)
Gitkeep file to preserve the empty docs directory in version control.

#### [NEW] [ci.yml](file:///home/aminul/Development/Work/Intelligent_Transport_System/transport-app/.github/workflows/ci.yml)
GitHub action workflow for testing/linting.

#### [NEW] [deploy.yml](file:///home/aminul/Development/Work/Intelligent_Transport_System/transport-app/.github/workflows/deploy.yml)
GitHub action workflow stub for deployment.

---

## Verification Plan

### Automated Tests
- Validate all `package.json` configurations are correct and can resolve workspace dependencies.
- Compile packages and applications to verify there are no TypeScript syntax errors or resolution issues.
  - Run `npm run typecheck` from the root workspace.
  - Run `npm run lint` to ensure ESLint rules pass.

### Manual Verification
- Verify that `npm install` runs successfully at the root level and creates a unified `node_modules` structure linking the workspaces correctly.
- Verify `docker-compose.yml` configuration checks.
