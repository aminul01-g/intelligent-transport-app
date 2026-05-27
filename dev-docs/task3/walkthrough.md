# Web App Bootstrap Complete

The Next.js web application (`apps/web`) has been successfully set up with role-based routing and styling.

## Changes Made

### 1. Configuration & Styling
- Configured `next.config.mjs` for strict types, API domains, and external server components.
- Configured `tailwind.config.ts` and `postcss.config.js` in `apps/web`, introducing custom design tokens (colors, borderRadius, fonts) consistent with the project's brand guidelines.
- Installed `tailwindcss` v3 temporarily to fix compatibility with Next.js PostCSS resolution.
- Added `apps/web/src/app/globals.css` containing base tailwind styles.
- Created `cn()` utility (`lib/cn.ts`) for classname merging using `clsx` and `tailwind-merge`.

### 2. UI Kit Additions
- Added `ToastContainer` UI component to `@transport/ui-kit`.
- Exported the container and utils via `index.ts`.

### 3. Core Libraries & State
- **API Client:** Developed `src/lib/api-client.ts` with a mutex-based JWT token refresh mechanism to handle concurrent 401 Unauthorized responses seamlessly.
- **Zustand Stores:**
  - `auth.store.ts` for managing user state and persisting tokens.
  - `notifications.store.ts` for global toast notifications.
  - `socket.store.ts` for managing WebSocket connection status.

### 4. Route Protection & Navigation
- Created `<RoleGuard>` component to enforce user role-based access to specific routes.
- Setup `src/app/page.tsx` with role-based redirection logic for the root path.
- Configured `src/app/providers.tsx` as a Client Component boundary for layout.

### 5. Application Routes (Stubs)
Successfully created the stub pages for all application domains:
- **Auth:** `/login`, `/register`
- **Passenger:** `/passenger/dashboard`, `/passenger/map`, `/passenger/wallet`, `/passenger/history`
- **Driver:** `/driver/dashboard`, `/driver/navigation`, `/driver/check-in`
- **Manager:** `/manager/dashboard`, `/manager/fleet`
- **Company:** `/company/dashboard`, `/company/analytics`

### 6. Verification
- Resolved extensive ESLint and TypeScript issues to ensure complete Airbnb-style compliance.
- Fixed `max-len`, trailing commas, and unsafe assignments.
- Successfully built the application using `npm run build` (`next build`), verifying that static and dynamic pages compile correctly.

> [!TIP]
> The app is fully scaffolded and builds successfully. To run the development server, run `npm run dev --workspace=@transport/web`.
