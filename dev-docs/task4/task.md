# Infrastructure Layer — Task Tracker

- `[x]` 1. Rewrite `infra/docker/api.Dockerfile` (base→deps→builder→development→runner)
- `[x]` 2. Rewrite `infra/docker/web.Dockerfile` (deps→builder→development→runner, standalone)
- `[x]` 3. Add `output: 'standalone'` to `apps/web/next.config.mjs`
- `[x]` 4. Rewrite `.github/workflows/ci.yml` (5 parallel jobs)
- `[x]` 5. Rewrite `.github/workflows/deploy.yml` (workflow_run + ghcr.io push)
- `[x]` 6. Rewrite `infra/scripts/migrate.ts` (up/down/status commands)
- `[x]` 7. Add Jest to `apps/api` (package.json, jest.config.ts, placeholder test)
- `[x]` 8. Add Vitest to `apps/web` (package.json, vitest.config.ts, placeholder test)
- `[x]` 9. Create `infra/scripts/tsconfig.json` for migrate.ts compilation
- `[x]` 10. Verify builds and lint YAML
