# Set Up /apps/web — Frontend App Bootstrap

Build out the Next.js frontend application on top of the existing Prompt 1.1 monorepo scaffold. This covers configuration, Tailwind theming, layout with providers, route structure, Zustand state management, a typed API client with token refresh, and role-based route guarding.

## User Review Required

> [!IMPORTANT]
> **Route Group Conflict**: The spec lists routes like `(passenger)/dashboard/page.tsx` and `(driver)/dashboard/page.tsx`. In Next.js App Router, parenthesized folders are **route groups** — they are stripped from the URL. This means both would map to `/dashboard`, causing a build-time conflict.
>
> Since the root page redirects to `/{role}/dashboard` (e.g. `/passenger/dashboard`), the URLs clearly need the role prefix. **Proposed fix**: use actual folders for role-based routes (`passenger/dashboard/page.tsx` → URL `/passenger/dashboard`), and keep `(auth)` as a true route group (`(auth)/login/page.tsx` → URL `/login`).

> [!WARNING]
> **Supporting types needed**: The spec references `User` and `Notification` types that don't exist in `shared-types` yet. I'll define them locally in the web app under `src/types/` to avoid modifying the shared-types package scope. They can be promoted later.

> [!IMPORTANT]
> **ToastContainer stub**: The layout wraps children in `ToastContainer (from ui-kit)`, but ui-kit has no such component. I'll create a minimal `ToastContainer.tsx` in ui-kit and export it from the barrel.

## Dependencies (Already Installed ✅)

| Package | Workspace | Type |
|---|---|---|
| `next-themes`, `next-auth`, `zustand`, `clsx`, `tailwind-merge`, `socket.io-client` | `@transport/web` | dependency |
| `tailwindcss`, `postcss`, `autoprefixer` | `@transport/web` | devDependency |
| `clsx`, `tailwind-merge` | `@transport/ui-kit` | dependency |

---

## Proposed Changes

### 1. Next.js Config

#### [MODIFY] [next.config.mjs](file:///home/aminul/Development/Work/intelligent-transport-app/apps/web/next.config.mjs)
- `typescript.ignoreBuildErrors: false` (enforce strict TS in build)
- `images.domains` set to the API domain (`localhost` for dev)
- `experimental.serverComponentsExternalPackages: ['socket.io-client']`
- Expose `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_SOCKET_URL` via `env` field

---

### 2. Tailwind CSS

#### [NEW] [tailwind.config.ts](file:///home/aminul/Development/Work/intelligent-transport-app/apps/web/tailwind.config.ts)
- Content: `['./src/**/*.{ts,tsx}']`
- Extend theme with brand colors, border-radius tokens, Inter font family
- Darkmode: `'class'` (compatible with next-themes)

#### [NEW] [postcss.config.js](file:///home/aminul/Development/Work/intelligent-transport-app/apps/web/postcss.config.js)
- Standard Tailwind PostCSS config (`tailwindcss`, `autoprefixer`)

#### [NEW] [globals.css](file:///home/aminul/Development/Work/intelligent-transport-app/apps/web/src/app/globals.css)
- Tailwind directives (`@tailwind base/components/utilities`)
- Base body styles

#### [NEW] [cn.ts](file:///home/aminul/Development/Work/intelligent-transport-app/apps/web/src/lib/cn.ts)
- `cn()` utility using `clsx` + `tailwind-merge`

#### [NEW] [cn.ts](file:///home/aminul/Development/Work/intelligent-transport-app/packages/ui-kit/src/utils/cn.ts)
- Independent `cn()` in ui-kit (same implementation, own copy — no cross-package dependency)

#### [MODIFY] [index.ts](file:///home/aminul/Development/Work/intelligent-transport-app/packages/ui-kit/src/index.ts)
- Add `export * from './utils/cn'` and `export * from './ToastContainer'`

---

### 3. Root Layout & Providers

#### [NEW] [providers.tsx](file:///home/aminul/Development/Work/intelligent-transport-app/apps/web/src/app/providers.tsx)
- Client component wrapping: `SessionProvider` (next-auth/react) → `ThemeProvider` (next-themes, `defaultTheme='system'`) → `ToastContainer` (ui-kit)
- Extracted as a separate file because providers require `'use client'` but layout.tsx exports `metadata` (server component only)

#### [MODIFY] [layout.tsx](file:///home/aminul/Development/Work/intelligent-transport-app/apps/web/src/app/layout.tsx)
- Load Inter variable font via `next/font/google`
- Apply font className to `<body>`
- Import `globals.css`
- Wrap children in `<Providers>`
- Metadata: title template `%s | Transport App`, description, viewport

#### [NEW] [auth-options.ts](file:///home/aminul/Development/Work/intelligent-transport-app/apps/web/src/lib/auth-options.ts)
- Placeholder `NextAuthOptions` export (empty providers array, session strategy JWT)
- Needed by both the root page's `getServerSession()` and the providers

---

### 4. Root Page (Session Redirect)

#### [MODIFY] [page.tsx](file:///home/aminul/Development/Work/intelligent-transport-app/apps/web/src/app/page.tsx)
- Server component using `getServerSession(authOptions)`
- Unauthenticated → `redirect('/login')`
- Authenticated → `redirect('/{role}/dashboard')` using a `UserRole → path` map

---

### 5. Route Structure — Page Stubs

Each is a minimal default export returning a `<div>` with the page name.

| File | URL |
|---|---|
| `(auth)/login/page.tsx` | `/login` |
| `(auth)/register/page.tsx` | `/register` |
| `passenger/dashboard/page.tsx` | `/passenger/dashboard` |
| `passenger/map/page.tsx` | `/passenger/map` |
| `passenger/wallet/page.tsx` | `/passenger/wallet` |
| `passenger/history/page.tsx` | `/passenger/history` |
| `driver/dashboard/page.tsx` | `/driver/dashboard` |
| `driver/navigation/page.tsx` | `/driver/navigation` |
| `driver/check-in/page.tsx` | `/driver/check-in` |
| `manager/dashboard/page.tsx` | `/manager/dashboard` |
| `manager/fleet/page.tsx` | `/manager/fleet` |
| `company/dashboard/page.tsx` | `/company/dashboard` |
| `company/analytics/page.tsx` | `/company/analytics` |

All paths are relative to `apps/web/src/app/`.

---

### 6. Supporting Types

#### [NEW] [user.ts](file:///home/aminul/Development/Work/intelligent-transport-app/apps/web/src/types/user.ts)
- `User` interface: `id`, `email`, `name`, `role: UserRole`

#### [NEW] [notification.ts](file:///home/aminul/Development/Work/intelligent-transport-app/apps/web/src/types/notification.ts)
- `Notification` interface: `id`, `title`, `message`, `type` (info/success/warning/error), `read`, `createdAt`

---

### 7. UI-Kit Addition

#### [NEW] [ToastContainer.tsx](file:///home/aminul/Development/Work/intelligent-transport-app/packages/ui-kit/src/ToastContainer.tsx)
- Minimal client component stub rendering a toast portal container `<div id="toast-container">`
- Exported from ui-kit barrel

---

### 8. Zustand Stores

All under `apps/web/src/store/`:

#### [NEW] [auth.store.ts](file:///home/aminul/Development/Work/intelligent-transport-app/apps/web/src/store/auth.store.ts)
- State: `user: User | null`, `accessToken: string | null`, `isAuthenticated: boolean`, `isLoading: boolean`
- Actions: `setAuth(user, token)`, `clearAuth()`, `setLoading(bool)`
- `persist` middleware with `partialize` — persists only `accessToken` to localStorage
- **No token refresh logic** (handled exclusively by API client)

#### [NEW] [notifications.store.ts](file:///home/aminul/Development/Work/intelligent-transport-app/apps/web/src/store/notifications.store.ts)
- State: `notifications: Notification[]`, `unreadCount: number`
- Actions: `addNotification`, `markRead(id)`, `markAllRead`, `clearAll`

#### [NEW] [socket.store.ts](file:///home/aminul/Development/Work/intelligent-transport-app/apps/web/src/store/socket.store.ts)
- State: `isConnected: boolean`, `connectionError: string | null`
- Actions: `setConnected(bool)`, `setError(string | null)`

---

### 9. API Client

#### [NEW] [api-client.ts](file:///home/aminul/Development/Work/intelligent-transport-app/apps/web/src/lib/api-client.ts)
- Typed fetch wrapper returning `ApiResponse<T>`
- Auto-attaches JWT Bearer token from `useAuthStore.getState()`
- **401 refresh mutex pattern**:
  - Module-level `let refreshPromise: Promise<string> | null = null`
  - On 401: if no refresh in progress, call `POST /auth/refresh`, update store, retry once
  - If refresh fails (401): `clearAuth()` + `redirect('/login')`
- Methods: `apiClient.get<T>`, `apiClient.post<T>`, `apiClient.patch<T>`, `apiClient.delete<T>`
- Throws `AppError`-shaped objects on non-2xx

---

### 10. Route Guard

#### [NEW] [RoleGuard.tsx](file:///home/aminul/Development/Work/intelligent-transport-app/apps/web/src/components/guards/RoleGuard.tsx)
- `'use client'` component
- Reads auth state from Zustand `useAuthStore`
- Unauthenticated → redirect to `/login`
- Wrong role → render inline 403 page (preserves URL for debugging)
- Props: `allowedRoles: UserRole[]`, `children: React.ReactNode`

---

## File Summary (24 files)

| Action | Count |
|---|---|
| NEW | 21 |
| MODIFY | 3 |
| **Total** | **24** |

---

## Verification Plan

### Automated
1. `npm run typecheck -w @transport/web` — ensure zero TS errors
2. `npm run build -w @transport/web` — confirm Next.js builds with `ignoreBuildErrors: false`

### Manual
- Verify `cn()` is importable from both `@/lib/cn` and `@transport/ui-kit`
- Verify all 13 route URLs resolve without conflicts
- Verify Zustand auth store persists only `accessToken` in localStorage
