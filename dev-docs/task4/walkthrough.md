# Infrastructure Layer Setup

The full infrastructure layer configuration has been successfully implemented across the repository.

## What was completed

### Docker Configuration
- **API Dockerfile** ([api.Dockerfile](file:///home/aminul/Development/Work/intelligent-transport-app/infra/docker/api.Dockerfile)):
  - Built a 5-stage Dockerfile: `base` → `deps` → `builder` → `development` → `runner`.
  - Added a dedicated `deps` stage running `npm ci --omit=dev` to ensure the final image size is minimal.
  - Setup a non-root `nodeapp` user in the runner stage.
  - Retained the `development` stage to ensure backward compatibility with `docker-compose.yml`.

- **Web Dockerfile** ([web.Dockerfile](file:///home/aminul/Development/Work/intelligent-transport-app/infra/docker/web.Dockerfile)):
  - Integrated `output: 'standalone'` build via [next.config.mjs](file:///home/aminul/Development/Work/intelligent-transport-app/apps/web/next.config.mjs).
  - Wired in `NEXT_PUBLIC_` environment variables (`API_URL`, `SOCKET_URL`, `GOOGLE_MAPS_API_KEY`) using Docker `ARG` in the builder stage.
  - Setup a non-root `nextjs` user in the minimal runtime stage, dropping the massive `node_modules` layer in favour of standalone compilation.

### GitHub Actions (CI/CD)
- **CI Workflow** ([ci.yml](file:///home/aminul/Development/Work/intelligent-transport-app/.github/workflows/ci.yml)):
  - Split the monolithic job into 5 parallel, dependent jobs: `lint`, `typecheck`, `test-api`, `test-web`, and `build`.
  - Implemented `postgres` and `redis` service containers natively in the GitHub Actions runner for integration testing.
  - Defined caching layers for `npm` node_modules and `.next` Next.js artifacts.

- **Deploy Workflow** ([deploy.yml](file:///home/aminul/Development/Work/intelligent-transport-app/.github/workflows/deploy.yml)):
  - Setup the trigger to `workflow_run` on `CI` conclusion.
  - Integrated `docker/build-push-action` and `ghcr.io` for seamless image publishing.
  - Tagged the outgoing images with both the commit `sha` and `latest`.

### Migration Runner
- **Migrate Script** ([migrate.ts](file:///home/aminul/Development/Work/intelligent-transport-app/infra/scripts/migrate.ts)):
  - Built a complete runner providing `up`, `down`, and `status` subcommands.
  - Incorporated a `schema_migrations` tracking table to ensure each run is fully atomic and tracked over time.
  - Validated execution and TypeScript syntax by providing an independent script-level [tsconfig.json](file:///home/aminul/Development/Work/intelligent-transport-app/infra/scripts/tsconfig.json).

### Automated Testing Setup
- **API (Jest)**: Configured `jest.config.ts` using `ts-jest`, and added an initial bootstrap test to validate Node environments.
- **Web (Vitest)**: Added `vitest.config.ts`, mapping monorepo internal dependencies securely to test runs via `@vitejs/plugin-react` and `@vitest/coverage-v8`.

## Validation Performed
- **YAML Formatting**: Formatted `.yml` workflow files with `prettier` to resolve syntactical issues.
- **TypeScript Build Check**: Verified that the migration scripts build accurately without errors.
- **Workspace State**: Tested configuration alignments across `package.json` arrays to guarantee `npm test` operates robustly within both GitHub Actions and local runs.
