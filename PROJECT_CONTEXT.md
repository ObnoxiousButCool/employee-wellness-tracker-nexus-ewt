# Project Context — Employee Wellness Tracker Nexus (EWT)

## 1. Overview
Employee Wellness Tracker Nexus (EWT) is a wellness-tracking system for organizations, with
role-based access for Admins, Managers, and Employees. The backend is a Node.js/Express API
backed by PostgreSQL via Prisma; the frontend is a Next.js (App Router) application. As of
story S1, the system provides credential-based authentication (login/logout) issuing an
httpOnly JWT session cookie, plus role-guard middleware that other stories will use to protect
future API routes. The frontend calls the backend through its own Next.js Route Handler proxies
(`app/api/auth/*`) rather than directly from the browser, and gates the three role-specific
landing pages (`/admin/dashboard`, `/manager/dashboard`, `/employee/home`) with a `<RoleGuard>`
server component.

## 2. Architecture & Folder Structure
```
backend/
  package.json, .env.example
  prisma/schema.prisma, prisma/migrations/20260810000000_init/migration.sql
  src/
    app.js, server.js
    config/env.js, config/prisma.js
    models/userModel.js
    middleware/authenticate.js, middleware/requireRole.js
    routes/authRoutes.js            # POST /api/auth/login, POST /api/auth/logout
  tests/auth.test.js, tests/requireRole.test.js

frontend/
  package.json, next.config.js, vitest.config.js, vitest.setup.js, .env.example
  app/
    layout.js, page.js              # / redirects to role landing page, else /login
    login/page.js                   # renders <LoginForm>
    admin/dashboard/page.js         # RoleGuard-wrapped ADMIN landing page
    manager/dashboard/page.js       # RoleGuard-wrapped MANAGER landing page
    employee/home/page.js           # RoleGuard-wrapped EMPLOYEE landing page
    api/auth/login/route.js         # BFF proxy -> backend, forwards ewt_token, sets ewt_session
    api/auth/logout/route.js        # BFF proxy -> backend, clears both cookies
  components/
    LoginForm.jsx                   # client: email/password form, loading/error states
    RoleGuard.jsx                   # server: redirects to /login on missing/wrong-role session
    LogoutButton.jsx                # client: calls /api/auth/logout, redirects to /login
  lib/
    roles.js                        # ROLES, ROLE_LANDING_PATHS, getLandingPathForRole, resolveAccess
    session.js                      # parseSessionToken (verifies ewt_token JWT), getSession
  __tests__/
    roles.test.js, session.test.js, RoleGuard.test.jsx, authRoutes.test.js, LoginForm.test.jsx
    liveIntegration.test.js         # real-socket integration test, see Change Log iteration 3
```

## 3. API Contract (cumulative)

### POST /api/auth/login — introduced in S1 (Backend)
- **Request body:** `{ "email": string, "password": string }`
- **Success response (200):** sets an httpOnly, Secure (in production), SameSite=Strict cookie
  named `ewt_token` containing a signed JWT (HS256, 8h expiry, claims: `userId`, `role`,
  `departmentId`). Response body: `{ "userId": 1, "role": "ADMIN", "departmentId": 3 }`
- **Failure responses:**
  - `401 { "error": "Invalid credentials" }` — unknown email, wrong password, or missing
    email/password (generic message on all of these — no user enumeration).
  - `403 { "error": "Account is inactive" }` — credentials are correct but `active` is false.

### POST /api/auth/logout — introduced in S1 (Backend)
- **Request body:** none.
- **Response (200):** `{ "message": "Logged out" }`, and clears the `ewt_token` cookie.
  Stateless JWT, so this is a no-op server-side (no denylist yet).

### Route guard middleware — introduced in S1 (Backend)
- `authenticate.js` reads the `ewt_token` httpOnly cookie (or `Authorization: Bearer`), verifies
  it, sets `req.user = { userId, role, departmentId }`. Responds `401` if missing/invalid/expired.
- `requireRole(allowedRoles: string[])` runs after `authenticate`; responds `403` if
  `req.user.role` isn't in `allowedRoles`. Future routes should wrap with both.

### Frontend BFF proxy routes — introduced in S1 (Frontend)
The browser only ever talks to the Next.js origin; these routes proxy to the backend so the
backend's `Secure`/`SameSite=Strict` cookie and the frontend's origin are never cross-site.
- `POST /api/auth/login` forwards `{ email, password }` to the backend unchanged, relays the
  backend's `Set-Cookie: ewt_token` header verbatim, and additionally sets its own httpOnly
  `ewt_session` cookie (`{ userId, role, departmentId }`, 8h maxAge). **`ewt_session` is a
  non-authoritative display convenience only** — it is unsigned JSON and never gates access;
  `RoleGuard`/`getSession()` authorize exclusively by verifying the signed `ewt_token` JWT
  (shared `JWT_SECRET`, HS256). Passes through the backend's status code/body as-is (200/401/403).
- `POST /api/auth/logout` forwards the request cookie header to the backend, relays any
  `Set-Cookie` it returns, and unconditionally clears both `ewt_session` and `ewt_token` on the
  frontend origin — even if the backend call itself fails/times out, so the browser is never
  left half-signed-out.

## 4. Data Models (cumulative)

### `users` table — introduced in S1 (Backend), Prisma model `User`
| Field           | Type                              | Notes                                   |
|-----------------|------------------------------------|------------------------------------------|
| `id`            | `Int` (PK, autoincrement)          |                                          |
| `email`         | `String`, unique                   |                                          |
| `password`      | `String`                           | bcrypt hash, cost factor 10; never plaintext |
| `role`          | `Role` enum (`ADMIN`, `MANAGER`, `EMPLOYEE`) |                                |
| `departmentId`  | `Int?` (column `department_id`)    | nullable; no FK table yet                |
| `active`        | `Boolean`, default `true`          | checked on every login attempt           |
| `createdAt`     | `DateTime`, default now            | column `created_at`                      |
| `updatedAt`     | `DateTime`, auto-updated           | column `updated_at`                      |

## 5. Change Log (per story, per layer)

### Story S1
**Backend (iteration 1):** Initialized the Node.js/Express backend under `backend/` with
Prisma + PostgreSQL. Added the `users` table (migration `20260810000000_init`) with `id`,
`email`, `password` (bcrypt, cost 10), `role` enum, `departmentId`, `active`. Implemented
`POST /api/auth/login` (httpOnly/Secure/SameSite=Strict JWT cookie, HS256, 8h, generic 401 on
bad credentials, 403 on inactive) and `POST /api/auth/logout` (stateless no-op clearing the
cookie). Added `authenticate.js` and `requireRole.js` middleware for future protected routes.
`backend/tests/auth.test.js` + `requireRole.test.js` (9 tests, all passing) wired into
`ci_check.py`.

**Frontend (iteration 1):** Built the Next.js App Router frontend under `frontend/`. Added
`/login` (`LoginForm.jsx`, idle/loading/error states) posting to the frontend's own
`POST /api/auth/login`. Because the backend cookie is `httpOnly`/`Secure`/`SameSite=Strict` with
no CORS, implemented login/logout as Next.js Route Handler **BFF proxies** (see API Contract)
so the browser stays same-origin with the frontend, forwarding `ewt_token` verbatim and adding a
same-origin `ewt_session` display cookie. Added `<RoleGuard allowedRoles={[...]}>` wrapping each
of the three role-specific landing pages, redirecting to `/login` on missing/wrong-role session,
matching the `ADMIN/MANAGER/EMPLOYEE` redirect map (also applied at `/`). Added `<LogoutButton>`,
`lib/roles.js` (routing helpers) and `lib/session.js` (`getSession`/`parseSessionToken`). 14
Vitest/RTL tests, wired into `ci_check.py`.

**Fixes (iteration 2) — frontend:** (1) `ewt_session` was unsigned JSON and forgeable from a
browser console; fixed by making `getSession()`/`parseSessionToken()` verify the **signed
`ewt_token` JWT** (`jsonwebtoken`, shared `JWT_SECRET`) instead — `ewt_session` is kept for
display only and never used for access control. (2) Logout returned 502 without clearing cookies
if the backend proxy call threw; fixed by moving cookie-clearing outside the try/catch so both
cookies always clear, even when the backend is unreachable. (3) Added
`__tests__/RoleGuard.test.jsx` and extended `session.test.js`/added `authRoutes.test.js` (26
tests total) covering the forgery and half-signed-out fixes with real signed JWTs. (4) Removed
`frontend/package-lock.json` from git tracking and added it to `.gitignore`.

**Fixes (iteration 3) — frontend:** Addressed all three review findings.

1. *Missing JSX-capable CI syntax gate.* `ci_check.py`'s per-layer syntax check only ran
   `node --check` against `*.js`, silently skipping every `.jsx` file (all pages, layout, and
   the three components) — `node --check` cannot parse JSX at all. Extended `ci_check.py` to
   additionally run each `.jsx` file through `esbuild` (already present transitively via
   vite/vitest, resolved from `frontend/node_modules/.bin`), which parses and transforms JSX
   without executing it; skips gracefully with a log line if `node_modules` isn't installed.
   Verified the gate actually fails closed: temporarily broke `RoleGuard.jsx`'s syntax and
   confirmed `python ci_check.py` caught it and exited 1, then restored the file and confirmed
   it passes again.
2. *Unsubstantiated live-verification claim.* Iterations 1–2 described manually running the real
   backend against the frontend and then discarding the setup, leaving no artifact in the diff to
   back the claim. Added `frontend/__tests__/liveIntegration.test.js` (6 tests, committed): a
   plain `node:http` server implementing the documented login/logout contract byte-for-byte is
   started on a real ephemeral localhost port, and the frontend's actual route handlers
   (`app/api/auth/login/route.js`, `.../logout/route.js`) are driven against it over a real TCP
   socket with **no mocked `fetch`** — asserting the 200/401/403 bodies, a real backend-signed
   JWT relayed in `Set-Cookie` and verified for real by `parseSessionToken`, a forged unsigned
   cookie rejected by that same path, full cookie-clearing on logout, and cookie-clearing surviving
   a real connection failure (an unreachable real socket, not a simulated error). All 6 pass;
   32/32 tests pass overall (`npx vitest run`), wired into `ci_check.py`. This supersedes the
   prior iterations' narrative-only "ran the real backend app.js" claims, which are not
   reproducible from this diff and should not be relied on as evidence.
3. *`PROJECT_CONTEXT.md` exceeding the 200-added-line rule.* Condensed the Architecture tree and
   Change Log entries (this file) to fit the limit without dropping any endpoint, schema, or
   fix detail.
