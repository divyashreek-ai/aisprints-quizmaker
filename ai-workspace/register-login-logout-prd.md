Date created: August 30, 2026
Date last modified: August 31, 2026

# Register, Login, Logout - Technical PRD

## Overview/Problem

The Greenfield Quizmaker application will eventually let multiple teachers collaborate on a shared MCQ test bank. Before quiz content or collaboration can exist, the app needs secure user registration, login, and logout with persisted credentials. The starter had no database, user model, or auth flow.

This phase establishes that foundation with a stateless model: no sessions, cookies, JWT, or route protection. After register/login, the client redirects to an MCQ placeholder stub only.

### Implementation Status

| Item | Status |
|------|--------|
| **Overall** | **COMPLETE** — all 5 phases delivered and verified |
| **Branch** | `feature/register-login-logout` |
| **Automated tests** | 45 Vitest tests across 11 files — all passing |
| **Manual verification** | Passed on `npm run preview` (August 31, 2026): register, login, logout, navigation |
| **Git commits (Phases 1–4 + wrangler)** | `4aec4a6` → `2678904` on feature branch |
| **Phase 5** | Implemented locally; pending commit when directed |

---

## Hypothesis

We believe that secure email-and-password registration and login with a User Service and D1 persistence will give teachers a reliable account baseline and unblock future MCQ and collaboration features without over-engineering session management in the first sprint.

---

## Scope

### In Scope

- Cloudflare **D1** with binding `DB` in `wrangler.jsonc`
- **`users` table**: PK, first name, last name, username, email, password hash, timestamps; unique indexes on username and email
- **Migration** applied locally only
- **Password hashing/verification** (PBKDF2 via Web Crypto); never store plain text
- **User Service** (`src/lib/services/`) for all CRUD and credential ops; routes never query D1 directly
- **API**: `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`
- **Zod validation** and consistent error handling
- **Pages**: `/`, `/register`, `/login`, `/mcq` (stub); redirect to `/mcq` after register/login
- **Vitest TDD** for each phase (Red → Green)

### Out of Scope

- MCQ/test-bank functionality, collaboration, social login
- JWT/tokens, cookies, sessions, route protection
- Password reset, email verification, profile UI, RBAC, rate limiting

### Cut

- **Server Actions** — REST API endpoints per this PRD; forms call via `fetch`
- **Argon2** — Web Crypto PBKDF2 avoids a new dependency
- **Authenticated MCQ stub** — stateless phase; stub is not gated
- **E2E browser tests** — Vitest unit/component tests + manual `npm run preview`

---

## Architecture

```
Browser → POST /api/auth/* → Route handlers → User Service → D1 (binding: DB)
                ↓                      ↓
         shadcn forms           password.ts (hash/verify)
         sessionStorage          validation/user.ts (Zod)
         router.push redirects   lib/api/http.ts (JSON helpers)
```

| Layer | Location | Role |
|-------|----------|------|
| UI pages | `src/app/{page,register,login,mcq}/page.tsx` | Route shells; centered layouts |
| UI components | `src/components/{signup-form,login-form,mcq-stub}.tsx` | Client forms, fetch, redirects |
| shadcn/ui | `src/components/ui/{button,card,field,input,...}.tsx` | Generated UI primitives |
| API | `src/app/api/auth/{register,login,logout}/route.ts` | Validate, delegate, map HTTP errors |
| HTTP helpers | `src/lib/api/http.ts` | JSON parse, validation/500 responses |
| User Service | `src/lib/services/user-service.ts` | CRUD, duplicate checks, credential verify |
| Password | `src/lib/auth/password.ts` | `hashPassword`, `verifyPassword` |
| Validation | `src/lib/validation/user.ts` | `registerSchema`, `loginSchema` |
| Database | `migrations/0001_create_users_table.sql` | `users` table + indexes |
| Config | `wrangler.jsonc` | D1 binding `DB`, `workers_dev: true` |
| Tests | Colocated `*.test.ts(x)` | Vitest + Testing Library |

**Stateless auth:** Register/login verify credentials and return JSON; client redirects to `/mcq`. Logout returns `{ success: true }`; client clears optional `sessionStorage` key `quizmaker.displayName` and navigates to `/login`. No persistent server auth state.

**Client display name:** After successful register/login, forms store `${firstName} ${lastName}` in `sessionStorage` under `quizmaker.displayName`. The MCQ stub reads this for a welcome message. Refresh or direct navigation may not show it — by design for this phase.

---

## Technical Requirements

### Database Schema

Database: `quizmaker-db` · Binding: `DB`

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  first_name TEXT NOT NULL CHECK (length(trim(first_name)) >= 1),
  last_name TEXT NOT NULL CHECK (length(trim(last_name)) >= 1),
  username TEXT NOT NULL COLLATE NOCASE,
  email TEXT NOT NULL COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX idx_users_username ON users(username);
CREATE UNIQUE INDEX idx_users_email ON users(email);
```

Password hash format: `pbkdf2-sha256$<iterations>$<base64-salt>$<base64-hash>` (≥100k iterations, 16-byte salt).

### User Service Interface

```typescript
createUserService(db: D1Database) → {
  createUser, getUserById, getUserByUsername, getUserByEmail,
  updateUser, deleteUser
  // verifyCredentials added in Phase 3
}
```

**Phase 2 (User Service only):**
- `createUser`: normalize email (lowercase), check duplicates, persist `passwordHash` as supplied; return public user (no hash)
- CRUD methods query D1 only; no password hashing or verification in this layer yet

**Phase 3 (auth utilities wired in):**
- `createUser` updated to accept plain `password` and hash via `password.ts` before insert
- `verifyCredentials`: load by username, verify hash; return public user or `null`

- D1: numbered placeholders (`?1`, `?2`); use `all()` not `first()`

### API Endpoints

#### POST /api/auth/register

| Field | Rules |
|-------|-------|
| firstName, lastName | Required, trim, 1–100 chars |
| username | 3–30 chars, `^[a-zA-Z0-9_]+$` |
| email | Valid email, max 255 |
| password | 8–128 chars |
| confirmPassword | Must match password |

| Status | Body |
|--------|------|
| 201 | `{ user: { id, firstName, lastName, username, email } }` |
| 400 | `{ error: "Validation failed", details }` |
| 409 | `{ error: "Username already taken" }` or `{ error: "Email already registered" }` |
| 500 | `{ error: "Internal server error" }` |

#### POST /api/auth/login

| Status | Body |
|--------|------|
| 200 | `{ user: { id, firstName, lastName, username, email } }` |
| 400 | Validation failed |
| 401 | `{ error: "Invalid username or password" }` (same for missing user and wrong password) |
| 500 | Internal server error |

#### POST /api/auth/logout

| Status | Body |
|--------|------|
| 200 | `{ success: true }` — no cookies/tokens set or cleared |

### UI Pages

| Route | Purpose |
|-------|---------|
| `/` | Landing with Register / Login links |
| `/register` | shadcn **SignupForm** → `POST /api/auth/register` → 201 → redirect `/mcq` |
| `/login` | shadcn **LoginForm** → `POST /api/auth/login` → 200 → redirect `/mcq` |
| `/mcq` | Stub: "MCQ Test Bank (Coming Soon)"; logout → `/login` |

### shadcn/ui Auth Components

Adapt the provided shadcn Sign Up and Login reference layouts. Components live in `src/components/`; pages compose them under `src/app/`.

| Component | File | Notes |
|-----------|------|-------|
| **SignupForm** | `src/components/signup-form.tsx` | Card + Field + Input; `'use client'`; wired to register API |
| **LoginForm** | `src/components/login-form.tsx` | Card + Field + Input; `'use client'`; wired to login API |
| **McqStub** | `src/components/mcq-stub.tsx` | Placeholder + logout; `'use client'` |

**SignupForm adaptations** (from reference snippet):

- Layout: centered page (`min-h-svh`, `max-w-sm`) per reference; Card header "Create an account"
- Fields: **first name**, **last name**, **username**, **email**, **password**, **confirm password** (API requires split names + username, not a single "Full Name")
- Keep `FieldDescription` hints on email/password fields
- **Omit** "Sign up with Google" (social login out of scope)
- Submit button: "Create Account"; link to `/login` via Next.js `Link`
- On **201**: store optional `displayName` in `sessionStorage`; `router.push('/mcq')`
- On **400/409**: show error via `FieldError`

**LoginForm adaptations** (from reference snippet):

- Layout: centered page; Card header "Login to your account"
- Fields: **username** + **password** (API uses username, not email)
- **Omit** "Forgot your password?" and "Login with Google" (out of scope)
- Submit button: "Login"; link to `/register` via Next.js `Link`
- On **200**: optional `sessionStorage` display name; redirect `/mcq`
- On **401**: generic `"Invalid username or password"` via `FieldError`

**Styling:** Tailwind utilities via shadcn theme tokens (`bg-background`, `text-muted-foreground`, etc.) from `globals.css`. No custom CSS modules.

**Page shells** (match reference):

```tsx
// src/app/register/page.tsx
import { SignupForm } from "@/components/signup-form";
// flex min-h-svh … max-w-sm wrapper

// src/app/login/page.tsx
import { LoginForm } from "@/components/login-form";
// same centered shell
```

### Security

- Never persist, log, or return plain-text passwords
- Parameterized SQL only; generic login failure message
- TLS in production (Cloudflare)

---

## Implementation Record

Complete map of delivered code. Line references reflect the implementation as of August 31, 2026.

### Phase 1 — Database Foundation

| Artifact | Path |
|----------|------|
| Migration | `migrations/0001_create_users_table.sql` |
| Wrangler D1 binding | `wrangler.jsonc` (`binding: "DB"`, `database_name: "quizmaker-db"`) |
| Generated types | `cloudflare-env.d.ts` (`DB: D1Database`) |
| Schema tests | `src/lib/db/schema.test.ts` |

Migration DDL (implemented):

```sql
-- migrations/0001_create_users_table.sql
CREATE TABLE users (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  first_name TEXT NOT NULL CHECK (length(trim(first_name)) >= 1),
  last_name TEXT NOT NULL CHECK (length(trim(last_name)) >= 1),
  username TEXT NOT NULL COLLATE NOCASE,
  email TEXT NOT NULL COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX idx_users_username ON users(username);
CREATE UNIQUE INDEX idx_users_email ON users(email);
```

Apply locally: `npx wrangler d1 migrations apply quizmaker-db --local`

### Phase 2 — User Service

| Artifact | Path |
|----------|------|
| Service | `src/lib/services/user-service.ts` |
| Tests | `src/lib/services/user-service.test.ts` |

Factory and public types:

```typescript
// src/lib/services/user-service.ts
export type PublicUser = { id, firstName, lastName, username, email, createdAt, updatedAt };
export function createUserService(db: D1Database) → {
  createUser, getUserById, getUserByUsername, getUserByEmail,
  updateUser, deleteUser, verifyCredentials  // verifyCredentials added Phase 3
}
```

Duplicate errors: `DuplicateUsernameError`, `DuplicateEmailError`. D1 queries use numbered placeholders (`?1`) and `.all()` (not `.first()`). Public methods never return `password_hash`.

### Phase 3 — Password, Validation & Auth Logic

| Artifact | Path |
|----------|------|
| Password module | `src/lib/auth/password.ts` |
| Password tests | `src/lib/auth/password.test.ts` |
| Zod schemas | `src/lib/validation/user.ts` |
| Validation tests | `src/lib/validation/user.test.ts` |
| Dependency | `zod` in `package.json` |

Password hashing (Web Crypto PBKDF2-SHA256, 100k iterations, 16-byte salt):

```typescript
// src/lib/auth/password.ts
const ITERATIONS = 100_000;
export async function hashPassword(plain: string): Promise<string>
export async function verifyPassword(plain: string, encoded: string): Promise<boolean>
// Format: pbkdf2-sha256$<iterations>$<base64-salt>$<base64-hash>
```

Validation schemas:

```typescript
// src/lib/validation/user.ts
export const registerSchema = z.object({ firstName, lastName, username, email, password, confirmPassword })
  .refine(password === confirmPassword, { path: ["confirmPassword"] });
export const loginSchema = z.object({ username, password });
```

User Service updates: `createUser` accepts plain `password`, calls `hashPassword` before insert; `verifyCredentials` loads by username and calls `verifyPassword`.

### Phase 4 — API Routes

| Artifact | Path |
|----------|------|
| Register route | `src/app/api/auth/register/route.ts` |
| Login route | `src/app/api/auth/login/route.ts` |
| Logout route | `src/app/api/auth/logout/route.ts` |
| HTTP helpers | `src/lib/api/http.ts` |
| Route tests | `src/app/api/auth/{register,login,logout}/route.test.ts` |

Shared route pattern — parse JSON, Zod validate, delegate to User Service:

```typescript
// src/app/api/auth/register/route.ts (representative)
const body = await parseJsonBody(request);
const parsed = registerSchema.safeParse(body);
const { env } = await getCloudflareContext();
const userService = createUserService(env.DB);
const user = await userService.createUser({ ...parsed.data });
return Response.json({ user }, { status: 201 });
// Maps DuplicateUsernameError → 409, DuplicateEmailError → 409
```

```typescript
// src/app/api/auth/login/route.ts
const user = await userService.verifyCredentials(username, password);
if (!user) return Response.json({ error: "Invalid username or password" }, { status: 401 });
return Response.json({ user });
```

```typescript
// src/app/api/auth/logout/route.ts
export async function POST(_request: Request) {
  return Response.json({ success: true });
}
```

HTTP helpers in `src/lib/api/http.ts`: `parseJsonBody`, `validationErrorResponse`, `invalidRequestBodyResponse`, `internalServerErrorResponse`.

**Test import convention:** Route tests import handlers via `@/app/api/auth/.../route` (not `./route`) for App Router resolution.

**Wrangler addition (post-Phase 4):** `"workers_dev": true` in `wrangler.jsonc` for preview/deploy subdomain access.

### Phase 5 — Frontend & Integration

| Artifact | Path |
|----------|------|
| Signup form | `src/components/signup-form.tsx` |
| Login form | `src/components/login-form.tsx` |
| MCQ stub | `src/components/mcq-stub.tsx` |
| Register page | `src/app/register/page.tsx` |
| Login page | `src/app/login/page.tsx` |
| MCQ page | `src/app/mcq/page.tsx` |
| Landing page | `src/app/page.tsx` |
| Component tests | `src/components/{signup-form,login-form,mcq-stub}.test.tsx` |
| Landing test | `src/app/page.test.tsx` |
| Test setup | `vitest.setup.ts` (`@testing-library/jest-dom/vitest`) |

**SignupForm** — client-side Zod validation, then API call and redirect:

```typescript
// src/components/signup-form.tsx
const parsed = registerSchema.safeParse(payload);
const response = await fetch("/api/auth/register", { method: "POST", body: JSON.stringify(parsed.data) });
sessionStorage.setItem("quizmaker.displayName", `${user.firstName} ${user.lastName}`);
router.push("/mcq");
```

**LoginForm** — username + password (not email):

```typescript
// src/components/login-form.tsx
const parsed = loginSchema.safeParse(payload);
const response = await fetch("/api/auth/login", { method: "POST", body: JSON.stringify(parsed.data) });
router.push("/mcq");  // on 200
// FieldError shows "Invalid username or password" on 401
```

**McqStub** — placeholder + logout:

```typescript
// src/components/mcq-stub.tsx
await fetch("/api/auth/logout", { method: "POST" });
sessionStorage.removeItem("quizmaker.displayName");
router.push("/login");
```

**Landing page** (`src/app/page.tsx`): QuizMaker heading with Register/Login buttons linking to `/register` and `/login`.

**Page shells** (register/login): centered `min-h-svh` layout wrapping the form component in `max-w-sm`.

**Component test import convention:** Tests import components via `@/components/...` (not `./component`) for IDE/TS path resolution.

### Test Suite Inventory

| File | Phase | Tests |
|------|-------|-------|
| `src/lib/db/schema.test.ts` | 1 | Migration + wrangler config |
| `src/lib/services/user-service.test.ts` | 2–3 | CRUD, hashing, verifyCredentials |
| `src/lib/auth/password.test.ts` | 3 | Hash format, verify, unique salts |
| `src/lib/validation/user.test.ts` | 3 | registerSchema, loginSchema |
| `src/app/api/auth/register/route.test.ts` | 4 | 201, 400, 409, 500 |
| `src/app/api/auth/login/route.test.ts` | 4 | 200, 401, 400 |
| `src/app/api/auth/logout/route.test.ts` | 4 | 200, no Set-Cookie |
| `src/components/signup-form.test.tsx` | 5 | Fields, submit, 409 error |
| `src/components/login-form.test.tsx` | 5 | Fields, submit, 401 error |
| `src/components/mcq-stub.test.tsx` | 5 | Coming Soon, logout |
| `src/app/page.test.tsx` | 5 | Register/Login links |
| **Total** | | **45 tests** |

Harness: `vitest.config.ts` (jsdom, `vite-tsconfig-paths`, `vitest.setup.ts`). Scripts: `"test": "vitest run"`, `"test:watch": "vitest"`.

### Git History (committed work)

| Commit | Description |
|--------|-------------|
| `4aec4a6` | Phase 1: D1 database foundation and Vitest schema tests |
| `e14cd4e` | Phase 2: User Service with D1 CRUD and duplicate checks |
| `d586297` | Phase 3: Password hashing, Zod validation, credential verification |
| `23520cb` | Phase 4: Register, login, and logout API routes |
| `2678904` | Enable `workers_dev` subdomain in wrangler config |
| *(uncommitted)* | Phase 5: Frontend UI, MCQ stub, component tests, PRD updates |

### Harness Setup (before Phase 1 tests)

Install and configure per `.cursor/skills/testing/SKILL.md`:

```bash
npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/user-event jsdom vite-tsconfig-paths
```

Add `vitest.config.ts` and scripts: `"test": "vitest run"`, `"test:watch": "vitest"`.

### Red → Green Workflow

Each phase follows TDD:

1. **Red** — Write Vitest tests for the phase; run `npm test`; confirm they fail
2. **Green** — Implement only what tests require; run `npm test` until all phase tests pass
3. **Done** — Phase acceptance criteria met **and** phase test suite green

Mock D1 and `@opennextjs/cloudflare` in unit tests; never hit real DB/network in Vitest. Use `npm run preview` for manual D1 integration after Phase 1.

Colocate tests beside source files (e.g. `user-service.test.ts` next to `user-service.ts`).

---

## Implementation Phases

Status markers: **PLANNED** · **IN PROGRESS** · **COMPLETED**

| Phase | Name | Status | Delivers |
|-------|------|--------|----------|
| 1 | Database Foundation | **COMPLETED** | D1 binding, migration, `users` table |
| 2 | User Service | **COMPLETED** | D1 CRUD + duplicate checks |
| 3 | Password, Validation & Auth Logic | **COMPLETED** | `password.ts`, Zod schemas, `verifyCredentials` |
| 4 | API Routes | **COMPLETED** | Register / login / logout endpoints |
| 5 | Frontend & Integration | **COMPLETED** | Auth UI, MCQ stub, full test suite + manual verification |

Detailed code references for each phase are in the [Implementation Record](#implementation-record) section above.

---

### Phase 1: Database Foundation — COMPLETED

**Objective:** D1 configured locally; `users` migration exists and applies.

**Delivered:** See [Implementation Record — Phase 1](#phase-1--database-foundation).

#### Tests First (Red)

File: `src/lib/db/schema.test.ts`

| Test | Assertion |
|------|-----------|
| migration file exists | `migrations/*_create_users_table.sql` present |
| users table DDL | SQL contains `CREATE TABLE users` with all required columns |
| uniqueness indexes | SQL contains `idx_users_username` and `idx_users_email` |
| wrangler binding | `wrangler.jsonc` includes `d1_databases` with binding `"DB"` and `database_name` `"quizmaker-db"` |

Run `npm test` — all four fail until config and migration exist.

#### Implement (Green)

1. `npx wrangler d1 create quizmaker-db`; add `d1_databases` to `wrangler.jsonc`
2. `npm run cf-typegen`
3. Create migration SQL; `npx wrangler d1 migrations apply quizmaker-db --local`
4. Verify: `npx wrangler d1 execute quizmaker-db --local --command "SELECT name FROM sqlite_master WHERE type='table'"`

#### Phase Acceptance Criteria

- [x] All Phase 1 Vitest tests pass
- [x] `users` table exists locally with required columns and unique indexes
- [x] `env.DB` typed in generated `cloudflare-env.d.ts`

---

### Phase 2: User Service — COMPLETED

**Objective:** User Service with D1 CRUD and duplicate checks only. No password hashing, no credential verification, no Zod.

**Delivered:** See [Implementation Record — Phase 2](#phase-2--user-service). Phase 3 extended the same file with hashing and `verifyCredentials`.

#### Tests First (Red)

**`src/lib/services/user-service.test.ts`** (mock D1)

| Test | Assertion |
|------|-----------|
| createUser | Inserts row with supplied `passwordHash`; returns public user without hash |
| createUser duplicate username | Throws or rejects |
| createUser duplicate email | Throws or rejects |
| getUserById found / not found | User / `null`; no password hash in result |
| getUserByUsername | Returns row including `passwordHash` for internal use |
| getUserByEmail | Returns public user or `null` |
| updateUser | Updates names; sets `updated_at` |
| deleteUser | Removes row |

Run `npm test` — all fail until `user-service.ts` exists.

#### Implement (Green)

1. `src/lib/services/user-service.ts` — factory + CRUD methods
2. `createUser` accepts `passwordHash` (opaque string); caller hashes in Phase 3

#### Phase Acceptance Criteria

- [x] All Phase 1 + Phase 2 Vitest tests pass
- [x] User Service is sole D1 access point for user data
- [x] Public methods never return `password_hash`; no hashing or verify logic in service yet

---

### Phase 3: Password, Validation & Auth Logic — COMPLETED

**Objective:** Password hash/verify module, Zod schemas, and User Service extensions for hashing and `verifyCredentials`.

**Delivered:** See [Implementation Record — Phase 3](#phase-3--password-validation--auth-logic).

#### Tests First (Red)

**`src/lib/auth/password.test.ts`**

| Test | Assertion |
|------|-----------|
| hash returns encoded string | Output matches `pbkdf2-sha256$...` format; ≠ plain input |
| verify correct password | `verifyPassword(plain, hash)` → `true` |
| verify wrong password | → `false` |
| unique salts | Two hashes of same password differ |

**`src/lib/validation/user.test.ts`**

| Test | Assertion |
|------|-----------|
| register valid payload | `registerSchema.safeParse` → success |
| register password mismatch | → failure |
| register short username / weak password | → failure |
| login valid / missing fields | success / failure |

**`src/lib/services/user-service.test.ts`** (extend Phase 2 tests)

| Test | Assertion |
|------|-----------|
| createUser with plain password | Hashes before insert; stored value ≠ plain text |
| verifyCredentials valid | Returns public user |
| verifyCredentials wrong password / unknown user | Returns `null` |

Run `npm test` — new tests fail until password module, Zod, and service updates exist.

#### Implement (Green)

1. Add `zod` (with user approval)
2. `src/lib/auth/password.ts`
3. `src/lib/validation/user.ts`
4. Update User Service: `createUser` accepts plain `password` and hashes; add `verifyCredentials`

#### Phase Acceptance Criteria

- [x] All Phase 1–3 Vitest tests pass
- [x] Passwords hashed before insert; never returned from service methods
- [x] `verifyCredentials` compares hash securely; returns `null` on failure

---

### Phase 4: API Routes — COMPLETED

**Objective:** Register, login, logout endpoints delegate to User Service.

**Delivered:** See [Implementation Record — Phase 4](#phase-4--api-routes).

#### Tests First (Red)

Mock `getCloudflareContext` and `createUserService`. Files:

**`src/app/api/auth/register/route.test.ts`**

| Test | Assertion |
|------|-----------|
| valid body | 201 + `{ user }` without password fields |
| validation error | 400 + details |
| duplicate username / email | 409 + appropriate error |
| service error | 500 |

**`src/app/api/auth/login/route.test.ts`**

| Test | Assertion |
|------|-----------|
| valid credentials | 200 + `{ user }` |
| invalid credentials | 401 + `"Invalid username or password"` |
| validation error | 400 |
| unknown user same as wrong password | 401, identical error message |

**`src/app/api/auth/logout/route.test.ts`**

| Test | Assertion |
|------|-----------|
| POST | 200 + `{ success: true }` |
| no Set-Cookie header | Response headers lack session/token cookies |

Run `npm test` — fail until routes exist.

#### Implement (Green)

1. `src/app/api/auth/register/route.ts`
2. `src/app/api/auth/login/route.ts`
3. `src/app/api/auth/logout/route.ts`

Route handlers: parse JSON → Zod → User Service → map errors. No direct SQL in routes.

#### Phase Acceptance Criteria

- [x] All Phase 1–4 Vitest tests pass
- [x] Register returns 201; login 401 on failure; logout 200 without cookies/tokens
- [x] Manual smoke via `npm run preview` + browser/curl for happy path

---

### Phase 5: Frontend & Integration — COMPLETED

**Objective:** shadcn SignupForm / LoginForm pages, MCQ stub, API wiring, and end-to-end verification (full Vitest suite + manual matrix on `npm run preview`).

**Delivered:** See [Implementation Record — Phase 5](#phase-5--frontend--integration) above.

#### Tests First (Red)

Client components (`'use client'`). Mock `fetch` and `next/navigation`.

**`src/components/signup-form.test.tsx`**

| Test | Assertion |
|------|-----------|
| renders all fields | firstName, lastName, username, email, password, confirmPassword |
| submit success | Calls POST `/api/auth/register`; redirects to `/mcq` |
| submit 409 | Shows error message |

**`src/components/login-form.test.tsx`**

| Test | Assertion |
|------|-----------|
| renders username + password | Fields present |
| submit success | POST `/api/auth/login`; redirects to `/mcq` |
| submit 401 | Shows generic invalid-credentials message |

**`src/components/mcq-stub.test.tsx`**

| Test | Assertion |
|------|-----------|
| placeholder content | Contains "Coming Soon" (or equivalent stub copy) |
| logout action | POST `/api/auth/logout`; navigates to `/login` |

**`src/app/page.test.tsx`**

| Test | Assertion |
|------|-----------|
| auth links | Register and Login links present |

Run `npm test` — fail until components and pages exist.

#### Implement (Green)

1. `src/components/signup-form.tsx` — shadcn register UI + API wiring
2. `src/components/login-form.tsx` — shadcn login UI + API wiring
3. `src/components/mcq-stub.tsx` — placeholder + logout
4. `src/app/register/page.tsx`, `src/app/login/page.tsx`, `src/app/mcq/page.tsx`
5. Update `src/app/page.tsx` landing
6. `npm run lint` && `npm run build`
7. Run full `npm test`; manual matrix on `npm run preview`
8. Mark acceptance criteria; update PRD status

#### Manual Test Matrix

| # | Action | Expected | Verified |
|---|--------|----------|----------|
| 1 | Register valid user | 201 → `/mcq` | [x] August 31, 2026 |
| 2 | Duplicate username / email | 409 error shown | [x] |
| 3 | Login valid / invalid | 200 → `/mcq` / 401 generic | [x] |
| 4 | Logout | 200 → `/login` | [x] |
| 5 | Inspect D1 row | `password_hash` ≠ plain text | [x] |

**Verification environment:** `npm run preview` (Workers runtime with D1 binding — not `npm run dev`).

**Manual verification notes (August 31, 2026):** Navigated to local login page; successfully registered a user, logged in, and logged out. Full auth navigation flow confirmed in browser.

#### Phase Acceptance Criteria

- [x] All Phase 1–5 Vitest tests pass (45 tests)
- [x] Register/login redirect to `/mcq` on success
- [x] `/mcq` is stub only (no MCQ CRUD)
- [x] Logout returns to `/login`
- [x] `npm run lint` and `npm run build` succeed
- [x] Manual matrix passes on `npm run preview`
- [x] Global acceptance criteria (below) all checked

---

## Global Acceptance Criteria

- [x] D1 `quizmaker-db` bound as `DB`; migration applied locally
- [x] User Service owns all user persistence; routes use service only
- [x] Passwords stored as hashes only
- [x] Register / login / logout APIs match contracts above
- [x] No cookies, JWT, or sessions introduced
- [x] Auth UI + MCQ stub complete with redirects
- [x] Full Vitest suite passes; lint and build pass

---

## Key Files

| File | Purpose |
|------|---------|
| `migrations/0001_create_users_table.sql` | User schema (Phase 1) |
| `wrangler.jsonc` | D1 binding `DB`, `workers_dev: true` |
| `cloudflare-env.d.ts` | Generated `DB: D1Database` type |
| `src/lib/db/schema.test.ts` | Migration + wrangler tests (Phase 1) |
| `src/lib/services/user-service.ts` | User CRUD + credentials (Phases 2–3) |
| `src/lib/services/user-service.test.ts` | Service unit tests |
| `src/lib/auth/password.ts` | PBKDF2 hash / verify (Phase 3) |
| `src/lib/auth/password.test.ts` | Password module tests |
| `src/lib/validation/user.ts` | Zod schemas (Phase 3) |
| `src/lib/validation/user.test.ts` | Validation tests |
| `src/lib/api/http.ts` | Shared JSON/validation HTTP helpers (Phase 4) |
| `src/app/api/auth/register/route.ts` | Register endpoint (Phase 4) |
| `src/app/api/auth/login/route.ts` | Login endpoint (Phase 4) |
| `src/app/api/auth/logout/route.ts` | Logout endpoint (Phase 4) |
| `src/app/api/auth/*/route.test.ts` | API route tests (Phase 4) |
| `src/components/signup-form.tsx` | shadcn register form (Phase 5) |
| `src/components/login-form.tsx` | shadcn login form (Phase 5) |
| `src/components/mcq-stub.tsx` | MCQ placeholder + logout (Phase 5) |
| `src/components/*.test.tsx` | Component tests (Phase 5) |
| `src/app/page.tsx` | Landing with Register/Login links (Phase 5) |
| `src/app/register/page.tsx` | Register page shell (Phase 5) |
| `src/app/login/page.tsx` | Login page shell (Phase 5) |
| `src/app/mcq/page.tsx` | MCQ stub page shell (Phase 5) |
| `src/app/page.test.tsx` | Landing page test (Phase 5) |
| `vitest.config.ts` | Vitest harness |
| `vitest.setup.ts` | jest-dom matchers for component tests |

---

## Dependencies

| Dependency | Purpose | Status |
|------------|---------|--------|
| Cloudflare D1 | User persistence | Configured |
| Web Crypto | PBKDF2 hashing (Phase 3) | Implemented in `password.ts` |
| `zod` | Server + client validation (Phase 3) | Installed |
| Vitest + Testing Library | TDD (Phases 1–5) | 45 tests passing |
| `@testing-library/jest-dom` | DOM matchers in component tests | Installed; `vitest.setup.ts` |

No env vars for this phase. Apply migrations locally only (`--local`, never `--remote`).

---

## Assumptions & Limitations

- Wrangler authenticated locally; login uses username (not email)
- **No persistent login** — `/mcq` is public; refresh loses client-only display state
- No password reset or email verification
- `npm run dev` lacks D1 bindings; use `npm run preview` for integration

---

## Future Enhancements

Sessions/cookies or JWT · auth middleware · password reset · email verification · rate limiting · OAuth · profile UI · RBAC

---

## Notes for AI Agents

1. **TDD order:** Write phase tests → confirm Red → implement → confirm Green → check phase acceptance criteria
2. **Phase 2 boundary:** User Service CRUD only — no Zod, no password hashing, no `verifyCredentials`
3. Do not add sessions, JWT, cookies, or MCQ features
4. All D1 access through User Service
5. Propose `zod` before Phase 3 install; set up Vitest before Phase 1 tests
6. Verify: `npm test`, `npm run lint`, `npm run build`, `npm run preview` (manual matrix in Phase 5)
7. Update phase status and checkboxes as work progresses

---

## Current Status

**Last Updated:** August 31, 2026  
**Current Phase:** All phases complete (1–5)  
**Status:** **COMPLETE** — automated and manual verification passed  
**Branch:** `feature/register-login-logout` (Phase 5 uncommitted)  
**Next Steps:** Commit/push Phase 5 when directed; future work: sessions, MCQ features, route protection
