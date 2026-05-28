# Auth System — Complete Implementation Plan

Build the full authentication, authorization, and document verification system for the transport API.

## Proposed Changes

### Overview — New Files

| # | File | Purpose |
|---|------|---------|
| 1 | `apps/api/src/modules/auth/auth.service.ts` | Core business logic: register, login, refresh, logout, uploadDocument, verifyDocument |
| 2 | `apps/api/src/modules/auth/auth.middleware.ts` | `authenticate`, `authorize(...roles)`, `requireVerifiedDocument` |
| 3 | `apps/api/src/modules/auth/auth.controller.ts` | Express route handlers bound to service methods |
| 4 | `apps/api/src/modules/auth/auth.validation.ts` | Zod schemas: RegisterDto, LoginDto, VerifyDocumentDto |
| 5 | `apps/api/src/config/multer.ts` | Multer diskStorage config, file filter, 5MB limit |

### Overview — Modified Files

| # | File | Change |
|---|------|--------|
| 6 | `packages/shared-types/src/index.ts` | Add `User`, `UserPublic`, `UserDocument` interfaces + `DocumentStatus` enum |
| 7 | `packages/shared-types/src/enums.ts` | Add `DocumentStatus` enum |
| 8 | `apps/api/src/config/env.ts` | Add `UPLOAD_DIR` env var (default `./uploads`) |
| 9 | `apps/api/src/routes/v1/index.ts` | Mount `authRouter` at `/auth` |
| 10 | `apps/api/package.json` | Add `bcrypt` and `multer` dependencies |

---

### Shared Types (`packages/shared-types/src/`)

#### [MODIFY] [enums.ts](file:///home/aminul/Development/Work/intelligent-transport-app/packages/shared-types/src/enums.ts)

Add `DocumentStatus` enum:

```typescript
export enum DocumentStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}
```

#### [MODIFY] [index.ts](file:///home/aminul/Development/Work/intelligent-transport-app/packages/shared-types/src/index.ts)

Add database-mapped interfaces and the critical `UserPublic` type:

```typescript
// ── Auth entity types ──

export interface User {
  id: string;
  email: string;
  phone: string;
  password_hash: string;
  role: UserRole;
  passenger_category: PassengerCategory;
  full_name: string;
  avatar_url: string | null;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

/** User shape safe for API responses — password_hash is NEVER exposed. */
export type UserPublic = Omit<User, 'password_hash'>;

export interface UserDocument {
  id: string;
  user_id: string;
  document_type: string;
  document_url: string;
  verified_by: string | null;
  verified_at: string | null;
  status: DocumentStatus;
  created_at: string;
}

export interface Wallet {
  id: string;
  user_id: string;
  balance: string;        // NUMERIC comes as string from pg
  held_balance: string;
  currency: string;
  updated_at: string;
}

export interface RefreshTokenRecord {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  revoked_at: string | null;
  device_info: Record<string, unknown> | null;
  created_at: string;
}
```

---

### Environment Config

#### [MODIFY] [env.ts](file:///home/aminul/Development/Work/intelligent-transport-app/apps/api/src/config/env.ts)

Add `UPLOAD_DIR` to the Zod schema:

```typescript
UPLOAD_DIR: z.string().default('./uploads'),
```

---

### Multer Config

#### [NEW] `apps/api/src/config/multer.ts`

- `diskStorage` with destination = `env.UPLOAD_DIR`
- Filename pattern: `${userId}_${Date.now()}_${sanitisedOriginalName}`
  - `sanitisedOriginalName`: replace non-alphanumeric chars (except `.` and `-`) with `_`
- `fileFilter`: reject mimetypes not in `['image/jpeg', 'image/png', 'application/pdf']` → throw `AppError.badRequest('INVALID_FILE_TYPE: only JPEG, PNG, and PDF allowed')`
- `limits.fileSize`: `5 * 1024 * 1024`

> [!IMPORTANT]
> The `userId` used in the filename comes from `req.user.userId` (set by `authenticate` middleware which runs before multer in the route chain). We'll pass it via a getter on the storage config.

---

### Auth Module (`apps/api/src/modules/auth/`)

#### [NEW] `auth.validation.ts`

Zod schemas with `.strict()` (no extra fields):

```typescript
RegisterDto = z.object({
  email: z.string().email(),
  phone: z.string().regex(/^\+880\d{10}$/, 'Bangladesh phone: +880xxxxxxxxxx'),
  password: z.string().min(8)
    .regex(/[A-Z]/, 'At least 1 uppercase letter')
    .regex(/\d/, 'At least 1 digit')
    .regex(/[^a-zA-Z0-9]/, 'At least 1 special character'),
  confirmPassword: z.string(),
  role: z.nativeEnum(UserRole),
  full_name: z.string().min(2),
  passenger_category: z.nativeEnum(PassengerCategory).optional(),
}).strict().refine(d => d.password === d.confirmPassword, {
  message: 'Passwords must match',
  path: ['confirmPassword'],
}).refine(d => {
  // passenger_category only valid when role is PASSENGER
  if (d.passenger_category && d.role !== UserRole.PASSENGER) return false;
  return true;
}, { message: 'passenger_category only valid for PASSENGER role', path: ['passenger_category'] });

LoginDto = z.object({
  email: z.string().email(),
  password: z.string(),
}).strict();

VerifyDocumentDto = z.object({
  approve: z.boolean(),
}).strict();
```

---

#### [NEW] `auth.service.ts`

Class `AuthService` — constructor takes `db` and `cache` (matching existing patterns from [db/index.ts](file:///home/aminul/Development/Work/intelligent-transport-app/apps/api/src/db/index.ts) and [cache/index.ts](file:///home/aminul/Development/Work/intelligent-transport-app/apps/api/src/cache/index.ts)).

**`register(dto)`**:
1. Hash password via `bcrypt.hash(dto.password, 12)`
2. Inside `db.transaction`:
   - `INSERT INTO users` → returning all columns except `password_hash`
   - `INSERT INTO wallets (user_id, balance, held_balance, currency)` VALUES `($1, 0, 0, 'BDT')`
3. Stub email verification: `console.log('[AUTH] Verification email sent to:', dto.email)` in dev
4. Return `{ user: UserPublic, wallet: Wallet }`

**`login(dto)`**:
1. `SELECT * FROM users WHERE email = $1` — if not found throw `AppError.unauthorized('INVALID_CREDENTIALS')`
2. `bcrypt.compare(dto.password, user.password_hash)` — if false throw same error (don't reveal which field failed)
3. Build JWT payload: `{ userId: user.id, role: user.role, passengerCategory: user.passenger_category, email: user.email }`
4. Sign `accessToken` with `env.JWT_ACCESS_SECRET`, expires `env.JWT_ACCESS_EXPIRY`
5. Sign `refreshToken` with `env.JWT_REFRESH_SECRET`, expires `env.JWT_REFRESH_EXPIRY`
6. Hash refresh token: `crypto.createHash('sha256').update(refreshToken).digest('hex')`
7. `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, device_info)`
8. Strip `password_hash` from user, return `{ user: UserPublic, accessToken, refreshToken }`

**`refreshToken(token, deviceInfo)`**:
1. `jwt.decode(token)` (no verify) → extract `userId`
2. `SELECT * FROM refresh_tokens WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > NOW()`
3. Hash incoming token → `crypto.createHash('sha256').update(token).digest('hex')`
4. For each stored record, compare with `crypto.timingSafeEqual(Buffer.from(storedHash, 'hex'), Buffer.from(incomingHash, 'hex'))` — note both buffers must be same length
5. If no match → `AppError.unauthorized('REFRESH_TOKEN_INVALID')`
6. Verify JWT signature: `jwt.verify(token, env.JWT_REFRESH_SECRET)`
7. Revoke old: `UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1`
8. Issue new pair, store new hash, return new tokens

**`logout(userId, refreshToken)`**:
1. Hash the token, find the matching record for this userId
2. `UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND token_hash = $2`
3. If no rows affected, silently succeed (idempotent)

**`uploadDocument(userId, file)`**:
1. Validate mimetype ∈ `['image/jpeg', 'image/png', 'application/pdf']` — throw `AppError.badRequest` if invalid
2. Validate file size ≤ 5MB — throw `AppError.badRequest` if exceeded
3. `INSERT INTO user_documents (user_id, document_type, document_url, status)` VALUES `($1, $2, $3, 'PENDING')`
   - `document_type` inferred from original filename or passed as form field
   - `document_url` = relative path to the saved file
4. Return the created `UserDocument` record

**`verifyDocument(documentId, managerId, approve)`**:
1. `SELECT * FROM user_documents WHERE id = $1` — throw `AppError.notFound` if missing
2. `UPDATE user_documents SET status = $1, verified_by = $2, verified_at = NOW() WHERE id = $3`
3. If `approve === true`:
   - Map `document_type` → `PassengerCategory`:
     - `'student_id'` → `STUDENT`
     - `'employee_card'` → `WORKER`
     - `'govt_credential'` → `GOVT_PERSONNEL`
   - `UPDATE users SET passenger_category = $1 WHERE id = $2`
4. Return updated document record

**`getMyDocuments(userId)`**:
- `SELECT * FROM user_documents WHERE user_id = $1 ORDER BY created_at DESC`

---

#### [NEW] `auth.middleware.ts`

**`authenticate`**:
1. Extract token from `Authorization: Bearer <token>` header
2. `jwt.verify(token, env.JWT_ACCESS_SECRET)` → decode payload
3. Attach to `req.user = { userId, role, passengerCategory, email }` via Express request augmentation
4. On failure: `throw AppError.unauthorized('TOKEN_INVALID')`

**`authorize(...roles: UserRole[])`**:
- Middleware factory: check `req.user.role` ∈ `roles`
- If not: `throw AppError.forbidden('INSUFFICIENT_ROLE')`

**`requireVerifiedDocument`**:
- Query: `SELECT 1 FROM user_documents WHERE user_id = $1 AND status = 'APPROVED' LIMIT 1`
- If no row: `throw AppError.forbidden('DOCUMENT_VERIFICATION_REQUIRED')`

**TypeScript augmentation**:
```typescript
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        role: UserRole;
        passengerCategory: PassengerCategory;
        email: string;
      };
    }
  }
}
```

---

#### [NEW] `auth.controller.ts`

Route handlers using `asyncHandler` wrapper and Zod validation:

| Method | Path | Guards | Handler Logic |
|--------|------|--------|---------------|
| `POST` | `/auth/register` | — | Validate `RegisterDto`, call `authService.register()` |
| `POST` | `/auth/login` | — | Validate `LoginDto`, call `authService.login()` |
| `POST` | `/auth/refresh` | — | Extract `refreshToken` from body, call `authService.refreshToken()` |
| `POST` | `/auth/logout` | `authenticate` | Extract `refreshToken` from body + `req.user.userId`, call `authService.logout()` |
| `POST` | `/auth/documents/upload` | `authenticate` + multer | Call `authService.uploadDocument()` with `req.user.userId` and `req.file` |
| `GET` | `/auth/documents/my` | `authenticate` | Call `authService.getMyDocuments(req.user.userId)` |
| `POST` | `/auth/documents/:id/verify` | `authenticate` + `authorize(MANAGER)` | Validate `VerifyDocumentDto`, call `authService.verifyDocument()` |

All responses wrapped in `ApiResponse<T>` envelope: `{ success: true, data: ... }`.

---

### Route Wiring

#### [MODIFY] [v1/index.ts](file:///home/aminul/Development/Work/intelligent-transport-app/apps/api/src/routes/v1/index.ts)

```diff
+import { authRouter } from '../../modules/auth/auth.controller';
 
 const v1Router = Router();
+v1Router.use('/auth', authRouter);
```

---

### Dependencies

#### [MODIFY] [package.json](file:///home/aminul/Development/Work/intelligent-transport-app/apps/api/package.json)

Install via npm:

```bash
npm install bcrypt multer --workspace=apps/api
npm install -D @types/bcrypt @types/multer --workspace=apps/api
```

> [!NOTE]
> `jsonwebtoken` and `@types/jsonwebtoken` are already installed. `crypto` is a Node.js built-in — no install needed.

---

## Security Design Decisions

| Concern | Approach |
|---------|----------|
| Password storage | bcrypt cost factor 12 — high enough for production, ~250ms per hash |
| Refresh token storage | SHA-256 hash stored in DB — raw token never persisted |
| Timing attacks | `crypto.timingSafeEqual` for all token comparisons |
| Token rotation | Old refresh token revoked atomically when new one is issued |
| Credential enumeration | Login returns same error for bad email vs bad password |
| SQL injection | All queries use `$1, $2, ...` parameterised placeholders exclusively |
| password_hash leakage | `UserPublic = Omit<User, 'password_hash'>` enforced at type level; all SELECT queries exclude the column or strip it before return |
| File upload | Mimetype whitelist + 5MB size limit + sanitised filenames |
| JWT secrets | Read from `env.ts` validated config — never hardcoded |

---

## Open Questions

> [!IMPORTANT]
> **Document type as form field vs inference**: The spec says `document_type` determines the passenger category mapping. Should `document_type` be:
> - A) A free-text form field sent alongside the file upload (e.g. `student_id`, `employee_card`, `govt_credential`), or
> - B) Inferred from the filename?
>
> **I'm defaulting to option A** — a required string field in the multipart form — since it's more reliable. Let me know if you prefer otherwise.

> [!NOTE]
> **Upload storage**: The spec mentions "Save file to /uploads/ directory (or stub S3 upload)". I'll implement local disk storage with `multer.diskStorage` and add a `// TODO: Replace with S3 upload in production` comment for future migration.

---

## Verification Plan

### Automated Checks
1. **TypeScript compilation**: `npm run typecheck --workspace=apps/api` — must pass with zero errors
2. **Lint**: `npm run lint` — must pass

### Manual Verification
- Review all files to confirm `password_hash` never appears in any response shape
- Verify parameterised queries in every SQL statement (no string interpolation)
- Confirm JWT secrets sourced from `env` object only
