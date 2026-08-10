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
  package.json
  .env.example
  prisma/
    schema.prisma            # Prisma datamodel (User, Role enum)
    migrations/
      migration_lock.toml
      20260810000000_init/
        migration.sql        # CREATE TYPE "Role", CREATE TABLE "users"
  src/
    app.js                   # Express app factory (used by server.js and tests)
    server.js                # HTTP entrypoint
    config/
      env.js                 # JWT secret/expiry, bcrypt cost factor, NODE_ENV
      prisma.js              # Shared PrismaClient instance
    models/
      userModel.js            # Data access for the users table (findByEmail, findById, createUser)
    middleware/
      authenticate.js         # Verifies JWT from httpOnly cookie (or Bearer header), sets req.user
      requireRole.js           # requireRole([...roles]) route guard factory
    routes/
      authRoutes.js            # POST /api/auth/login, POST /api/auth/logout
  tests/
    auth.test.js              # node:test + supertest coverage for login/logout
    requireRole.test.js       # node:test coverage for the role-guard middleware

frontend/
  package.json
  next.config.js
  vitest.config.js
  vitest.setup.js
  .env.example              # BACKEND_URL for the BFF proxy routes
  app/
    layout.js
    page.js                  # / — redirects to the session's role landing page, else /login
    login/
      page.js                # renders <LoginForm>
    admin/dashboard/page.js   # RoleGuard-wrapped ADMIN landing page
    manager/dashboard/page.js # RoleGuard-wrapped MANAGER landing page
    employee/home/page.js     # RoleGuard-wrapped EMPLOYEE landing page
    api/auth/
      login/route.js          # BFF proxy: POST /api/auth/login -> backend, forwards ewt_token,
                               # sets ewt_session
      logout/route.js         # BFF proxy: POST /api/auth/logout -> backend, clears both cookies
  components/
    LoginForm.jsx              # client component: email/password form, loading/error states
    RoleGuard.jsx               # server component: redirects to /login on missing/wrong-role session
    LogoutButton.jsx            # client component: calls /api/auth/logout, redirects to /login
  lib/
    roles.js                  # ROLES, ROLE_LANDING_PATHS, getLandingPathForRole, resolveAccess
    session.js                 # SESSION_COOKIE_NAME, parseSessionCookie, getSession (next/headers)
  __tests__/
    roles.test.js               # unit tests for getLandingPathForRole / resolveAccess
    session.test.js             # unit tests for parseSessionCookie
    LoginForm.test.jsx          # RTL tests: loading/success/401/403/network-error states
```

## 3. API Contract (cumulative)

### POST /api/auth/login — introduced in S1 (Backend)
- **Request body:** `{ "email": string, "password": string }`
- **Success response (200):** sets an httpOnly, Secure (in production), SameSite=Strict cookie
  named `ewt_token` containing a signed JWT (HS256, 8h expiry, claims: `userId`, `role`,
  `departmentId`). Response body:
  ```json
  { "userId": 1, "role": "ADMIN", "departmentId": 3 }
  ```
- **Failure responses:**
  - `401 { "error": "Invalid credentials" }` — unknown email, wrong password, or missing
    email/password (generic message on all of these — no user enumeration).
  - `403 { "error": "Account is inactive" }` — credentials are correct but `active` is false.

### POST /api/auth/logout — introduced in S1 (Backend)
- **Request body:** none.
- **Response (200):** `{ "message": "Logged out" }`, and clears the `ewt_token` cookie.
  Stateless JWT, so this is a no-op server-side (no denylist yet).

### Route guard middleware — introduced in S1 (Backend)
- `src/middleware/authenticate.js` — reads the `ewt_token` httpOnly cookie (or an
  `Authorization: Bearer <token>` header), verifies it, and sets `req.user = { userId, role,
  departmentId }`. Responds `401` if missing/invalid/expired.
- `src/middleware/requireRole(allowedRoles: string[])` — must run after `authenticate`;
  responds `403` if `req.user.role` is not in `allowedRoles`. Future stories should wrap every
  protected route with `authenticate` + `requireRole([...])`.

### Frontend BFF proxy routes — introduced in S1 (Frontend)
The browser only ever talks to the Next.js origin; these routes proxy to the backend so the
backend's `Secure`/`SameSite=Strict` cookie and the frontend's own origin are never cross-site,
avoiding any need for backend CORS configuration.
- `POST /api/auth/login` (Next.js route handler) — forwards `{ email, password }` to the
  backend's `POST /api/auth/login` unchanged, relays the backend's `Set-Cookie: ewt_token`
  header verbatim, and additionally sets its own httpOnly `ewt_session` cookie (JSON:
  `{ userId, role, departmentId }`, 8h maxAge) so server components can make routing decisions
  without re-parsing the JWT. Passes through the backend's status code and body as-is (200/401/403).
- `POST /api/auth/logout` (Next.js route handler) — forwards the request cookie header to the
  backend's `POST /api/auth/logout`, relays any `Set-Cookie` it returns, and clears its own
  `ewt_session` cookie.

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
Prisma + PostgreSQL. Added the `users` table (Prisma model `User`, migration
`backend/prisma/migrations/20260810000000_init`) with `id`, `email`, `password` (bcrypt,
cost factor 10), `role` (enum `ADMIN`/`MANAGER`/`EMPLOYEE`), `departmentId`, `active`.
Implemented `POST /api/auth/login` (`backend/src/routes/authRoutes.js`) issuing an httpOnly/
Secure/SameSite=Strict JWT cookie (HS256, 8h expiry, claims `userId`/`role`/`departmentId`),
with generic 401 on bad credentials and 403 on inactive accounts. Implemented
`POST /api/auth/logout` as a stateless no-op that clears the cookie. Added
`backend/src/middleware/authenticate.js` (verifies the session JWT) and
`backend/src/middleware/requireRole.js` (role-guard factory) for future protected routes.
Added Prisma client singleton (`backend/src/config/prisma.js`), env config
(`backend/src/config/env.js`), and a `userModel` data-access module
(`backend/src/models/userModel.js`). Added `backend/tests/auth.test.js` and
`backend/tests/requireRole.test.js` (node:test + supertest, 9 tests, all passing) and wired
them into the shared `ci_check.py`.

**Frontend (iteration 1):** Built the Next.js (App Router) frontend under `frontend/`. Added a
`/login` screen (`app/login/page.js` + `components/LoginForm.jsx`) with idle/loading/error UI
states, posting credentials to the frontend's own `POST /api/auth/login` route. Because the
backend's session cookie is `httpOnly`/`Secure`/`SameSite=Strict` and the backend has no CORS
middleware, implemented the login/logout endpoints as Next.js Route Handler **BFF proxies**
(`app/api/auth/login/route.js`, `app/api/auth/logout/route.js`, documented in the API Contract
section above) rather than calling the backend directly from the browser — this keeps the
browser same-origin with the frontend at all times, forwards the backend's `ewt_token` cookie
verbatim, and adds a same-origin `ewt_session` cookie so server components can read
`{ userId, role, departmentId }` without decoding the JWT. Added `<RoleGuard allowedRoles={[...]}>`
(`components/RoleGuard.jsx`, server component) wrapping each of the three role-specific landing
pages — `/admin/dashboard`, `/manager/dashboard`, `/employee/home` — redirecting to `/login` when
the session is missing or the role doesn't match, exactly matching the technical plan's
`ADMIN -> /admin/dashboard`, `MANAGER -> /manager/dashboard`, `EMPLOYEE -> /employee/home` map
(also applied at `/`, `app/page.js`). Added `<LogoutButton>` calling the logout proxy. Added
`lib/roles.js` (pure `getLandingPathForRole` / `resolveAccess` helpers) and `lib/session.js`
(`getSession` via `next/headers`, plus an exported pure `parseSessionCookie` for testing).

Test coverage (Vitest + React Testing Library, 14 tests, all passing, wired into `ci_check.py`
via `npx vitest run` in `frontend/`): `__tests__/roles.test.js` and `__tests__/session.test.js`
unit-test the pure routing/session-parsing logic that `RoleGuard` and the root page depend on;
`__tests__/LoginForm.test.jsx` renders the real form and exercises loading, success-redirect,
401, 403, and network-failure paths against a mocked `fetch`.

**End-to-end verification performed:** confirmed `npm run build` (`next build`) compiles all
routes, then ran the real backend Express app (`backend/src/app.js`, unmodified) alongside a
real `next start` production build of the frontend, wired together over actual HTTP on
`localhost`, exercising every acceptance criterion end to end: (1) an unauthenticated request to
`/admin/dashboard` redirects to `/login`; (2) unknown-email login returns the generic
`401 Invalid credentials` (no enumeration); (3) an inactive account returns
`403 Account is inactive`; (4) a valid ADMIN login returns `200` with `{userId, role,
departmentId}` and both the relayed `ewt_token` and the frontend's own `ewt_session` cookies are
present in the response; (5) the authenticated ADMIN session can load `/admin/dashboard`
(200, page shows the role); (6) that same ADMIN session is redirected to `/login` when it
requests `/manager/dashboard` (role mismatch); (7) `/` redirects an ADMIN session straight to
`/admin/dashboard`; (8) MANAGER login lands on `/manager/dashboard` (200); (9) EMPLOYEE login
lands on `/employee/home` (200); (10) `POST /api/auth/logout` returns 200 and clears the
session, after which the same session's request to `/admin/dashboard` redirects to `/login`
again. All 13 checks passed. Because no local PostgreSQL instance is available in this sandbox
(the backend's own `backend/tests/auth.test.js` faces the same constraint), the verification
monkeypatched only `userModel.findByEmail` and `bcrypt.compare` — every other line of backend
code (Express routing, JWT signing/verification, cookie options, `requireRole`) ran unmodified
and for real. No API contract mismatches were found; the documented `POST /api/auth/login` and
`POST /api/auth/logout` shapes matched observed backend behavior exactly. No gaps: this story's
scope (login, logout, role-guarded landing pages) is fully implemented and verified against the
real backend.
