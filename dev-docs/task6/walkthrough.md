# Authentication System Walkthrough

The core authentication system and document verification workflows have been successfully implemented. The API now supports secure registration, login, token rotation, role-based authorization, and multipart document uploads.

## Security & Architecture Highlights

> [!IMPORTANT]
> The `UserPublic` type enforces that `password_hash` can **never** be included in an API response. The `stripPasswordHash` helper strips this field from the raw database row before returning it to the client.

- **Password Hashing**: Implemented using `bcrypt` with a cost factor of 12.
- **Token Rotation**: 
  - Access tokens (JWT) have a short lifespan (`15m`).
  - Refresh tokens (`7d`) are persisted as **SHA-256 hashes** in the `refresh_tokens` table.
  - When rotating tokens, `crypto.timingSafeEqual` is used to prevent timing attacks.
  - An old token is atomically revoked (`revoked_at = NOW()`) when a new pair is issued.
- **Atomic Operations**: Registration creates both the `User` and `Wallet` records in a single database transaction (`db.transaction`). If either fails, neither is created.
- **SQL Injection Prevention**: Every single query uses strict parameterized placeholders (`$1`, `$2`). Zero string interpolation is used.

## Core Modules Created

### 1. Auth Service
[auth.service.ts](file:///home/aminul/Development/Work/intelligent-transport-app/apps/api/src/modules/auth/auth.service.ts) contains the business logic. It handles standard authentication flows as well as the specialized document verification required for discounts (e.g., mapping a `student_id` to the `STUDENT` passenger category).

### 2. Multer Upload Config
[multer.ts](file:///home/aminul/Development/Work/intelligent-transport-app/apps/api/src/config/multer.ts) restricts uploads to `image/jpeg`, `image/png`, and `application/pdf` with a hard limit of 5MB. Files are saved directly to the path defined by `env.UPLOAD_DIR`.

### 3. Middleware Pipeline
[auth.middleware.ts](file:///home/aminul/Development/Work/intelligent-transport-app/apps/api/src/modules/auth/auth.middleware.ts) exports three core guards:
- `authenticate`: Validates the JWT and augments the Express `req` object with typed user data.
- `authorize(...roles)`: RBAC barrier (e.g., `authorize(UserRole.MANAGER)`).
- `requireVerifiedDocument`: Queries the database to ensure the user has an `APPROVED` document before granting access to specific flows.

### 4. Strict Validation
[auth.validation.ts](file:///home/aminul/Development/Work/intelligent-transport-app/apps/api/src/modules/auth/auth.validation.ts) leverages Zod to lock down API inputs. `RegisterDto` strictly enforces Bangladesh phone numbers (`+880...`) and robust password strength rules.

## Verification

The entire `apps/api` workspace was compiled and verified using strict TypeScript mode (`tsc --noEmit`). The `db` generic constraints were aligned precisely with `pg.QueryResultRow` to ensure zero compilation errors across the shared types and PostgreSQL queries.
