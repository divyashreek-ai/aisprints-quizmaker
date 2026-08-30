Date created: August 30, 2026
Date last modified: August 30, 2026

# Register, Login, Logout - Technical PRD

## Overview/Problem

The Greenfield Quizmaker application will eventually let multiple teachers collaborate on a shared MCQ test bank. Before quiz content or collaboration can exist, the app needs secure user registration, login, and logout with persisted credentials. The starter has no database, user model, or auth flow.

This phase establishes that foundation with a stateless model: no sessions, cookies, JWT, or route protection. After register/login, the client redirects to an MCQ placeholder stub only.

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
Browser → POST /api/auth/* → Route handlers → User Service → D1
                                    ↓
                            password.ts (hash/verify)
                            validation/user.ts (Zod)
```

| Layer | Location | Role |
|-------|----------|------|
| UI | `src/app/{register,login,mcq}/` | Forms, fetch API, redirects |
| API | `src/app/api/auth/*/route.ts` | Validate, delegate, map HTTP errors |
| User Service | `src/lib/services/user-service.ts` | CRUD, duplicate checks (Phase 2); credential verify added Phase 3 |
| Password | `src/lib/auth/password.ts` | `hashPassword`, `verifyPassword` (Phase 3) |
| Validation | `src/lib/validation/user.ts` | `registerSchema`, `loginSchema` (Phase 3) |

**Stateless auth:** Register/login verify credentials and return JSON; client redirects to `/mcq`. Logout returns `{ success: true }`; client clears optional `sessionStorage` and navigates to `/login`. No persistent server auth state.

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
| `/register` | Full registration form → 201 → redirect `/mcq` |
| `/login` | Username + password → 200 → redirect `/mcq` |
| `/mcq` | Stub: "MCQ Test Bank (Coming Soon)"; logout → `/login` |

Use shadcn `field`, `input`, `button`, `card`. Theme tokens from `globals.css`.

### Security

- Never persist, log, or return plain-text passwords
- Parameterized SQL only; generic login failure message
- TLS in production (Cloudflare)

---

## Test-Driven Development (Vitest)

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

| Phase | Name | Delivers |
|-------|------|----------|
| 1 | Database Foundation | D1 binding, migration, `users` table |
| 2 | User Service | D1 CRUD + duplicate checks (no hashing/Zod) |
| 3 | Password, Validation & Auth Logic | `password.ts`, Zod schemas, `verifyCredentials` |
| 4 | API Routes | Register / login / logout endpoints |
| 5 | Frontend & Integration | Auth UI, MCQ stub, full test suite + manual verification |

---

### Phase 1: Database Foundation — COMPLETED

**Objective:** D1 configured locally; `users` migration exists and applies.

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

### Phase 3: Password, Validation & Auth Logic — PLANNED

**Objective:** Password hash/verify module, Zod schemas, and User Service extensions for hashing and `verifyCredentials`.

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

- [ ] All Phase 1–3 Vitest tests pass
- [ ] Passwords hashed before insert; never returned from service methods
- [ ] `verifyCredentials` compares hash securely; returns `null` on failure

---

### Phase 4: API Routes — PLANNED

**Objective:** Register, login, logout endpoints delegate to User Service.

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

- [ ] All Phase 1–4 Vitest tests pass
- [ ] Register returns 201; login 401 on failure; logout 200 without cookies/tokens
- [ ] Manual smoke via `npm run preview` + curl for happy path

---

### Phase 5: Frontend & Integration — PLANNED

**Objective:** Auth pages, MCQ stub, redirects, error display, and end-to-end verification (full Vitest suite + manual matrix on `npm run preview`).

#### Tests First (Red)

Client components only (`'use client'` where needed). Mock `fetch` and `next/navigation`.

**`src/app/register/register-form.test.tsx`**

| Test | Assertion |
|------|-----------|
| renders all fields | firstName, lastName, username, email, password, confirmPassword |
| submit success | Calls POST `/api/auth/register`; redirects to `/mcq` |
| submit 409 | Shows error message |

**`src/app/login/login-form.test.tsx`**

| Test | Assertion |
|------|-----------|
| renders username + password | Fields present |
| submit success | POST `/api/auth/login`; redirects to `/mcq` |
| submit 401 | Shows generic invalid-credentials message |

**`src/app/mcq/mcq-stub.test.tsx`**

| Test | Assertion |
|------|-----------|
| placeholder content | Contains "Coming Soon" (or equivalent stub copy) |
| logout action | POST `/api/auth/logout`; navigates to `/login` |

**`src/app/page.test.tsx`**

| Test | Assertion |
|------|-----------|
| auth links | Register and Login links present |

**`src/lib/auth/auth-flow.integration.test.ts`** (optional)

| Test | Assertion |
|------|-----------|
| no password in API responses | Register/login route tests assert JSON has no `password` or `passwordHash` keys |

Run `npm test` — fail until pages exist.

#### Implement (Green)

1. Update `src/app/page.tsx`
2. `src/app/register/page.tsx` (+ form component)
3. `src/app/login/page.tsx` (+ form component)
4. `src/app/mcq/page.tsx`
5. `npm run lint` && `npm run build`
6. Run full `npm test`; manual matrix on `npm run preview` (below)
7. Mark global acceptance criteria; update PRD status

#### Manual Test Matrix

| # | Action | Expected |
|---|--------|----------|
| 1 | Register valid user | 201 → `/mcq` |
| 2 | Duplicate username / email | 409 |
| 3 | Login valid / invalid | 200 → `/mcq` / 401 generic |
| 4 | Logout | 200 → `/login` |
| 5 | Inspect D1 row | `password_hash` ≠ plain text |

#### Phase Acceptance Criteria

- [ ] All Phase 1–5 Vitest tests pass
- [ ] Register/login redirect to `/mcq` on success
- [ ] `/mcq` is stub only (no MCQ CRUD)
- [ ] Logout returns to `/login`
- [ ] `npm run lint` and `npm run build` succeed
- [ ] Manual matrix passes on `npm run preview`
- [ ] Global acceptance criteria (below) all checked

---

## Global Acceptance Criteria

- [ ] D1 `quizmaker-db` bound as `DB`; migration applied locally
- [ ] User Service owns all user persistence; routes use service only
- [ ] Passwords stored as hashes only
- [ ] Register / login / logout APIs match contracts above
- [ ] No cookies, JWT, or sessions introduced
- [ ] Auth UI + MCQ stub complete with redirects
- [ ] Full Vitest suite passes; lint and build pass

---

## Key Files

| File | Purpose |
|------|---------|
| `migrations/*_create_users_table.sql` | User schema (Phase 1) |
| `src/lib/services/user-service.ts` | User CRUD (Phase 2); hashing + credentials (Phase 3) |
| `src/lib/auth/password.ts` | Hash / verify (Phase 3) |
| `src/lib/validation/user.ts` | Zod schemas (Phase 3) |
| `src/app/api/auth/{register,login,logout}/route.ts` | API endpoints (Phase 4) |
| `src/app/{register,login,mcq}/` | UI pages + integration (Phase 5) |
| `vitest.config.ts` | Test harness |

---

## Dependencies

| Dependency | Purpose | Approval |
|------------|---------|----------|
| Cloudflare D1 | User persistence | — |
| Web Crypto | PBKDF2 hashing (Phase 3) | — |
| `zod` | Validation (Phase 3) | Required before Phase 3 |
| Vitest + Testing Library | TDD | Required |

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

**Last Updated:** August 30, 2026  
**Current Phase:** Phase 3 — Password, Validation & Auth Logic  
**Status:** PLANNED (Phase 2 complete — awaiting review)  
**Next Steps:** Review Phase 2; on approval, commit/push when directed; then begin Phase 3 TDD
