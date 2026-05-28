# Auth System — Task Checklist

## Phase 1: Dependencies
- [x] Install `bcrypt`, `multer` and their `@types/` dev dependencies in `apps/api`

## Phase 2: Shared Types
- [/] Add `DocumentStatus` enum to `packages/shared-types/src/enums.ts`
- [/] Add `User`, `UserPublic`, `UserDocument`, `Wallet`, `RefreshTokenRecord` interfaces to `packages/shared-types/src/index.ts`

## Phase 3: Configuration
- [x] Add `UPLOAD_DIR` to env.ts Zod schema
- [x] Create `apps/api/src/config/multer.ts` (diskStorage, fileFilter, limits)

## Phase 4: Auth Module
- [x] Create `apps/api/src/modules/auth/auth.validation.ts` (Zod schemas)
- [x] Create `apps/api/src/modules/auth/auth.service.ts` (AuthService class)
  - [x] `register()` — bcrypt + atomic user+wallet creation
  - [x] `login()` — credential verification + JWT issuance + refresh token storage
  - [x] `refreshToken()` — decode, compare with timingSafeEqual, rotate
  - [x] `logout()` — revoke single refresh token
  - [x] `uploadDocument()` — validate + persist + DB record
  - [x] `verifyDocument()` — approve/reject + update passenger_category
  - [x] `getMyDocuments()` — fetch user's documents
- [x] Create `apps/api/src/modules/auth/auth.middleware.ts`
  - [x] `authenticate` — JWT verification, req.user augmentation
  - [x] `authorize(...roles)` — role-based access factory
  - [x] `requireVerifiedDocument` — check APPROVED document exists
- [x] Create `apps/api/src/modules/auth/auth.controller.ts`
  - [x] POST /auth/register
  - [x] POST /auth/login
  - [x] POST /auth/refresh
  - [x] POST /auth/logout
  - [x] POST /auth/documents/upload
  - [x] GET /auth/documents/my
  - [x] POST /auth/documents/:id/verify

## Phase 5: Wiring & Verification
- [x] Mount `authRouter` in `apps/api/src/routes/v1/index.ts`
- [x] Run `npm run typecheck --workspace=apps/api` — zero errors
- [x] Audit all files: `password_hash` never in any response
- [x] Audit all SQL: parameterised queries only (no interpolation)
