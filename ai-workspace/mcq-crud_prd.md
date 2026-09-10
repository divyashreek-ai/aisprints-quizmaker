Date created: September 9, 2026
Date last modified: September 9, 2026

# MCQ CRUD - Technical PRD

## Overview/Problem

Teachers who register and log in to QuizMaker currently land on an MCQ stub page with no way to build or manage quiz content. The register/login/logout foundation is complete, but the shared test bank cannot exist until teachers can create, view, update, and delete multiple-choice questions with answer choices.

This feature replaces the stub with a working MCQ workspace: a table listing all questions, a create/edit form with configurable choices (2–6), a preview mode for trying a question, and persistence of student attempts (selected choice and correctness). The implementation follows the same layered architecture as auth — D1 migrations, MCQ Service, Zod validation, REST API routes, and shadcn/ui client components — with Vitest TDD for each phase.

### Implementation Status

| Item | Status |
|------|--------|
| **Overall** | **IN PROGRESS** — Phase 1 complete |
| **Branch** | `feature/register-login-logout` (MCQ work uncommitted) |
| **Automated tests** | 50 Vitest tests passing (45 auth + 5 MCQ schema) |
| **Current Phase** | Phase 2 — MCQ Service |

---

## Hypothesis

We believe that a full-stack MCQ CRUD flow — D1 persistence for questions, choices, and attempts, an MCQ Service layer, REST endpoints, and a shadcn table-based UI — will let teachers manage a personal test bank immediately after login without waiting for sessions, collaboration, or AI features.

---

## Scope

### In Scope

- **Three D1 tables**: `mcqs`, `mcq_choices`, `mcq_attempts` (see schema below)
- **MCQ fields**: `id`, `name`, `question`, `created_by_user_id`, `created_at`, `updated_at`
- **Choices**: 2–6 per MCQ; `choice_text`, `is_correct`, `position`; FK to `mcqs` with cascade delete
- **Attempts**: record `mcq_id`, `choice_id`, `is_correct` per submission
- **MCQ Service** (`src/lib/services/mcq-service.ts`) — sole D1 access point for MCQ data; routes never query D1 directly
- **Zod validation** for create, update, and attempt payloads
- **API routes**: list/create MCQs; get/update/delete by id; record attempt
- **UI pages**:
  - `/mcq` — table of all MCQs + **Create MCQ** button + row actions (⋮ dropdown: Edit, Preview, Delete)
  - `/mcq/new` — create form with Save / Cancel
  - `/mcq/[id]/edit` — same form, pre-filled for edit
  - `/mcq/[id]/preview` — read-only question with choices; submit records an attempt and shows result
- **shadcn/ui**: `table`, `button`, `dropdown-menu`, `dialog` (delete confirm), `field`, `input`, `textarea`, `checkbox`, `card`
- **Client identity**: extend post-login `sessionStorage` to store `quizmaker.userId` (stateless; no JWT/cookies) for `created_by_user_id`
- **Vitest TDD** per phase (Red → Green)
- **Replace `McqStub`** with real list workspace; keep logout on `/mcq`

### Out of Scope

- Route protection / server-side auth enforcement (stateless phase continues)
- Filtering, sorting, pagination, or search on the MCQ table
- Sharing MCQs between users or organization-level test banks
- Quiz assembly (grouping MCQs into a quiz), timers, scoring dashboards
- AI question generation
- E2E browser tests (Vitest unit/component + manual `npm run preview`)

### Cut

- **Server Actions for MCQ mutations** — REST API endpoints per auth PRD pattern; forms call via `fetch`
- **`description` column** — renamed to `question` per product decision; one text field for the prompt
- **Separate description column on list** — table shows `name` and truncated `question` only
- **Soft delete** — hard delete with cascade on choices and attempts
- **Attempt history UI** — attempts are persisted in D1; no admin/reporting screen in this sprint
- **Argon2 / session cookies** — unchanged from auth phase

---

## Architecture

```
Browser → GET/POST/PUT/DELETE /api/mcqs* → Route handlers → MCQ Service → D1 (binding: DB)
                ↓                              ↓
         McqList / McqForm / McqPreview   validation/mcq.ts (Zod)
         sessionStorage (userId)          lib/api/http.ts (JSON helpers)
         shadcn table, dropdown, dialog
```

| Layer | Location | Role |
|-------|----------|------|
| UI pages | `src/app/mcq/**/page.tsx` | Route shells |
| UI components | `src/components/{mcq-list,mcq-form,mcq-preview}.tsx` | Client fetch, table, forms, preview |
| shadcn/ui | `src/components/ui/{table,button,dropdown-menu,...}.tsx` | Generated UI primitives |
| API | `src/app/api/mcqs/**/route.ts` | Validate, delegate, map HTTP errors |
| HTTP helpers | `src/lib/api/http.ts` | JSON parse, validation/500 responses |
| MCQ Service | `src/lib/services/mcq-service.ts` | CRUD, choices, attempts |
| Types | `src/lib/types/mcq.ts` | Shared TS types for MCQ domain |
| Validation | `src/lib/validation/mcq.ts` | `createMcqSchema`, `updateMcqSchema`, `attemptSchema` |
| Database | `migrations/0002_create_mcq_tables.sql` | `mcqs`, `mcq_choices`, `mcq_attempts` |
| Tests | Colocated `*.test.ts(x)` | Vitest + Testing Library |

**Stateless creator identity:** After register/login, client stores `quizmaker.userId` in `sessionStorage` alongside existing `quizmaker.displayName`. Create/update requests include `createdByUserId` from storage; service verifies the user exists. No server session — same trade-off as auth phase.

---

## Technical Requirements

### Database Schema

Database: `quizmaker-db` · Binding: `DB`

```sql
-- migrations/0002_create_mcq_tables.sql

CREATE TABLE mcqs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL CHECK (length(trim(name)) >= 1),
  question TEXT NOT NULL CHECK (length(trim(question)) >= 1),
  created_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (created_by_user_id) REFERENCES users(id)
);

CREATE INDEX idx_mcqs_created_by_user_id ON mcqs(created_by_user_id);

CREATE TABLE mcq_choices (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  mcq_id TEXT NOT NULL,
  choice_text TEXT NOT NULL CHECK (length(trim(choice_text)) >= 1),
  is_correct INTEGER NOT NULL DEFAULT 0 CHECK (is_correct IN (0, 1)),
  position INTEGER NOT NULL CHECK (position >= 0 AND position <= 5),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (mcq_id) REFERENCES mcqs(id) ON DELETE CASCADE
);

CREATE INDEX idx_mcq_choices_mcq_id ON mcq_choices(mcq_id);

CREATE TABLE mcq_attempts (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  mcq_id TEXT NOT NULL,
  choice_id TEXT NOT NULL,
  is_correct INTEGER NOT NULL CHECK (is_correct IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (mcq_id) REFERENCES mcqs(id) ON DELETE CASCADE,
  FOREIGN KEY (choice_id) REFERENCES mcq_choices(id)
);

CREATE INDEX idx_mcq_attempts_mcq_id ON mcq_attempts(mcq_id);
```

**Constraints enforced in application layer (Zod + service):**

- Exactly one choice marked `is_correct` per MCQ
- 2–6 choices per MCQ
- On update, choices are replaced as a set (delete existing + insert new) inside a transaction pattern or ordered deletes

Apply locally: `npx wrangler d1 migrations apply quizmaker-db --local`

### MCQ Service Interface

```typescript
createMcqService(db: D1Database) → {
  listMcqs(): Promise<McqSummary[]>,
  getMcqById(id: string): Promise<McqWithChoices | null>,
  createMcq(input: CreateMcqInput): Promise<McqWithChoices>,
  updateMcq(id: string, input: UpdateMcqInput): Promise<McqWithChoices | null>,
  deleteMcq(id: string): Promise<boolean>,
  recordAttempt(mcqId: string, choiceId: string): Promise<AttemptResult | null>,
}
```

**Types** (`src/lib/types/mcq.ts`):

```typescript
type McqSummary = { id, name, question, createdByUserId, createdAt, updatedAt };
type McqChoice = { id, choiceText, isCorrect, position };
type McqWithChoices = McqSummary & { choices: McqChoice[] };
type AttemptResult = { id, mcqId, choiceId, isCorrect, createdAt };

type CreateMcqInput = {
  name: string;
  question: string;
  createdByUserId: string;
  choices: { choiceText: string; isCorrect: boolean }[];
};

type UpdateMcqInput = {
  name: string;
  question: string;
  choices: { choiceText: string; isCorrect: boolean }[];
};
```

**Service rules:**

- D1 numbered placeholders (`?1`, `?2`); use `all()` not `first()`
- `createMcq`: verify `createdByUserId` exists in `users`; insert MCQ + choices
- `updateMcq`: update MCQ row, replace all choices; bump `updated_at`
- `deleteMcq`: delete MCQ (cascade removes choices and attempts)
- `recordAttempt`: load MCQ + choices; verify `choiceId` belongs to `mcqId`; persist `is_correct` from choice row
- Return `null` for not-found cases; routes map to 404

**Errors:** `McqNotFoundError`, `InvalidChoiceError`, `UserNotFoundError` (optional dedicated classes or null returns — pick one pattern and use consistently)

### Validation Schemas

File: `src/lib/validation/mcq.ts`

| Schema | Rules |
|--------|-------|
| `choiceSchema` | `choiceText`: trim, 1–500 chars |
| `createMcqSchema` | `name`: 1–200; `question`: 1–2000; `createdByUserId`: non-empty; `choices`: array 2–6; exactly one `isCorrect: true` |
| `updateMcqSchema` | Same as create minus `createdByUserId` |
| `attemptSchema` | `choiceId`: non-empty string |

### API Endpoints

#### GET /api/mcqs

**Response:**

- Success (200): `{ mcqs: McqSummary[] }`
- Error (500): `{ error: "Internal server error" }`

#### POST /api/mcqs

**Request Body:**

```json
{
  "name": "Chapter 1 Review",
  "question": "What is the capital of Texas?",
  "createdByUserId": "abc123",
  "choices": [
    { "choiceText": "Austin", "isCorrect": true },
    { "choiceText": "Dallas", "isCorrect": false }
  ]
}
```

**Response:**

- Success (201): `{ mcq: McqWithChoices }`
- Error (400): Validation failed
- Error (404): `{ error: "User not found" }` when `createdByUserId` invalid
- Error (500): Internal server error

#### GET /api/mcqs/[id]

**Response:**

- Success (200): `{ mcq: McqWithChoices }`
- Error (404): `{ error: "MCQ not found" }`
- Error (500): Internal server error

#### PUT /api/mcqs/[id]

**Request Body:** same shape as create minus `createdByUserId`

**Response:**

- Success (200): `{ mcq: McqWithChoices }`
- Error (400): Validation failed
- Error (404): MCQ not found
- Error (500): Internal server error

#### DELETE /api/mcqs/[id]

**Response:**

- Success (200): `{ success: true }`
- Error (404): MCQ not found
- Error (500): Internal server error

#### POST /api/mcqs/[id]/attempts

**Request Body:**

```json
{
  "choiceId": "choice-id-here"
}
```

**Response:**

- Success (201): `{ attempt: AttemptResult }`
- Error (400): Validation failed
- Error (404): MCQ or choice not found
- Error (500): Internal server error

### User Interface Requirements

#### Page: MCQ List (`/mcq`)

- Replace `McqStub` with `McqList` component
- Header: title **MCQ Test Bank**, welcome message from `sessionStorage` display name, **Log out** button (unchanged behavior)
- **Create MCQ** button (primary) → navigates to `/mcq/new`
- shadcn **Table** columns:
  - **Name** — `mcq.name`
  - **Question** — truncated `mcq.question` (e.g. first 80 chars + ellipsis)
  - **Actions** — icon button (Lucide `MoreVertical`) opening **DropdownMenu** with:
    - **Edit** → `/mcq/[id]/edit`
    - **Preview** → `/mcq/[id]/preview`
    - **Delete** → opens **Dialog** confirm; on confirm `DELETE /api/mcqs/[id]` then refresh list
- Empty state when no MCQs: message + Create MCQ CTA
- Loading and error states for fetch failures

#### Page: Create MCQ (`/mcq/new`)

- `McqForm` in create mode
- Fields: **Name** (input), **Question** (textarea)
- **Choices** section: 2 rows by default; **Add choice** up to 6; **Remove** when > 2
- Each choice: text input + checkbox/radio **Correct answer** (exactly one required)
- **Save** — `POST /api/mcqs` → redirect `/mcq` on 201
- **Cancel** — `router.push('/mcq')` without save
- Client-side Zod validation before submit; show `FieldError` messages

#### Page: Edit MCQ (`/mcq/[id]/edit`)

- Same `McqForm` in edit mode
- Load `GET /api/mcqs/[id]` on mount; 404 → message + link back to list
- **Save** — `PUT /api/mcqs/[id]` → redirect `/mcq` on 200
- **Cancel** — back to `/mcq`

#### Page: Preview MCQ (`/mcq/[id]/preview`)

- `McqPreview` component
- Display name + question; list choices as selectable options (radio group pattern)
- **Submit answer** — `POST /api/mcqs/[id]/attempts` with selected `choiceId`
- Show result: correct / incorrect (use badge or alert styling)
- **Back to list** link/button → `/mcq`
- No edit controls on preview page

#### Auth UI tweak (minimal)

- `SignupForm` and `LoginForm`: after success, also `sessionStorage.setItem('quizmaker.userId', user.id)`

### shadcn/ui Components

| Component | Usage |
|-----------|--------|
| `table` | MCQ list |
| `button` | Create, Save, Cancel, Log out, dropdown trigger |
| `dropdown-menu` | Row actions (Edit, Preview, Delete) |
| `dialog` | Delete confirmation |
| `field`, `input`, `textarea`, `label` | Create/edit form |
| `checkbox` | Mark correct choice (only one selected at a time) |
| `card` | Optional form/preview wrapper |
| `badge` | Correct/incorrect result on preview |

---

## Implementation Phases

Status markers: **PLANNED** · **IN PROGRESS** · **COMPLETED**

| Phase | Name | Status | Delivers |
|-------|------|--------|----------|
| 1 | Database Foundation | **COMPLETED** | Migration for `mcqs`, `mcq_choices`, `mcq_attempts` |
| 2 | MCQ Service | **PLANNED** | D1 CRUD, choices, attempts |
| 3 | Validation Schemas | **PLANNED** | Zod schemas + tests |
| 4 | API Routes | **PLANNED** | REST endpoints for MCQs and attempts |
| 5 | Frontend — List & Actions | **PLANNED** | Table, dropdown, delete, replace stub |
| 6 | Frontend — Form, Preview & Integration | **PLANNED** | Create/edit form, preview, attempt flow, auth userId storage |

**Do not start a phase until the previous phase's tests pass.** Each phase follows Red → Green TDD.

---

### Phase 1: Database Foundation — COMPLETED

**Objective:** D1 migration for three MCQ tables; schema verified by tests.

#### Tests First (Red)

File: `src/lib/db/mcq-schema.test.ts`

| Test | Assertion |
|------|-----------|
| migration file exists | `migrations/0002_create_mcq_tables.sql` present |
| mcqs table DDL | `CREATE TABLE mcqs` with `name`, `question`, `created_by_user_id`, timestamps |
| mcq_choices table DDL | FK to `mcqs`, `choice_text`, `is_correct`, `position`, cascade delete |
| mcq_attempts table DDL | FK to `mcqs` and `mcq_choices`, `is_correct` |
| indexes | `idx_mcqs_created_by_user_id`, `idx_mcq_choices_mcq_id`, `idx_mcq_attempts_mcq_id` |

Run `npm test` — fail until migration exists.

#### Implement (Green)

1. `npx wrangler d1 migrations create quizmaker-db create_mcq_tables`
2. Write SQL per schema above
3. `npx wrangler d1 migrations apply quizmaker-db --local`
4. Verify tables: `npx wrangler d1 execute quizmaker-db --local --command "SELECT name FROM sqlite_master WHERE type='table'"`

#### Phase Acceptance Criteria

- [x] All Phase 1 Vitest tests pass
- [x] Three MCQ tables exist locally with FKs and indexes
- [x] `users` table unchanged

#### Delivered

| Artifact | Path |
|----------|------|
| Migration | `migrations/0002_create_mcq_tables.sql` |
| Schema tests | `src/lib/db/mcq-schema.test.ts` |

---

### Phase 2: MCQ Service — PLANNED

**Objective:** MCQ Service with list, CRUD, choice management, and attempt recording. No routes or UI yet.

#### Tests First (Red)

File: `src/lib/services/mcq-service.test.ts` (mock D1)

| Test | Assertion |
|------|-----------|
| listMcqs | Returns summaries ordered by `created_at` desc |
| getMcqById found | Returns MCQ with choices sorted by `position` |
| getMcqById not found | Returns `null` |
| createMcq | Inserts MCQ + choices; returns full object |
| createMcq invalid user | Rejects when `createdByUserId` missing from users |
| createMcq choice rules | Rejects ≠1 correct or <2 choices (if validated in service) |
| updateMcq | Updates fields; replaces choices |
| updateMcq not found | Returns `null` |
| deleteMcq | Removes MCQ; returns `true` |
| deleteMcq not found | Returns `false` |
| recordAttempt | Persists attempt with correct `is_correct` |
| recordAttempt invalid choice | Returns `null` when choice not on MCQ |

Also add: `src/lib/types/mcq.ts`

#### Implement (Green)

1. `src/lib/types/mcq.ts`
2. `src/lib/services/mcq-service.ts` — `createMcqService(db)`

#### Phase Acceptance Criteria

- [ ] All Phase 1 + 2 Vitest tests pass
- [ ] MCQ Service is sole D1 access point for MCQ data
- [ ] Choices returned in stable `position` order

---

### Phase 3: Validation Schemas — PLANNED

**Objective:** Zod schemas for create, update, and attempt payloads.

#### Tests First (Red)

File: `src/lib/validation/mcq.test.ts`

| Test | Assertion |
|------|-----------|
| createMcq valid | Success with 2–6 choices, one correct |
| createMcq too few/many choices | Failure |
| createMcq zero or multiple correct | Failure |
| createMcq empty name/question | Failure |
| updateMcq valid | Success |
| attempt valid / missing choiceId | success / failure |

#### Implement (Green)

1. `src/lib/validation/mcq.ts`

#### Phase Acceptance Criteria

- [ ] All Phase 1–3 Vitest tests pass
- [ ] Schemas exported for routes and optional client-side reuse

---

### Phase 4: API Routes — PLANNED

**Objective:** REST endpoints delegating to MCQ Service.

#### Tests First (Red)

Mock `getCloudflareContext` and `createMcqService`.

| File | Tests |
|------|-------|
| `src/app/api/mcqs/route.test.ts` | GET 200 list; POST 201 create; POST 400 validation; POST 404 user |
| `src/app/api/mcqs/[id]/route.test.ts` | GET 200/404; PUT 200/404/400; DELETE 200/404 |
| `src/app/api/mcqs/[id]/attempts/route.test.ts` | POST 201; POST 400; POST 404 |

#### Implement (Green)

1. `src/app/api/mcqs/route.ts`
2. `src/app/api/mcqs/[id]/route.ts`
3. `src/app/api/mcqs/[id]/attempts/route.ts`

Route pattern: parse JSON → Zod → MCQ Service → map errors. Reuse `src/lib/api/http.ts` helpers.

#### Phase Acceptance Criteria

- [ ] All Phase 1–4 Vitest tests pass
- [ ] Manual smoke via curl or browser against `npm run preview` for create/list/get

---

### Phase 5: Frontend — List & Actions — PLANNED

**Objective:** Replace MCQ stub with table, create button, row actions, delete confirm.

#### Tests First (Red)

File: `src/components/mcq-list.test.tsx`

| Test | Assertion |
|------|-----------|
| renders table headers | Name, Question, Actions |
| lists MCQs from API | Rows show name and truncated question |
| Create MCQ button | Links to `/mcq/new` |
| actions menu | Edit / Preview / Delete items present |
| delete confirm | Dialog opens; confirm calls DELETE |
| empty state | Message when no MCQs |
| logout | Still calls logout API and redirects |

#### Implement (Green)

1. `src/components/mcq-list.tsx`
2. Update `src/app/mcq/page.tsx` to render `McqList`
3. Remove or deprecate `mcq-stub.tsx` (update `mcq-stub.test.tsx` → `mcq-list.test.tsx`)

#### Phase Acceptance Criteria

- [ ] All Phase 1–5 Vitest tests pass
- [ ] `/mcq` shows table after seeding data via API
- [ ] Delete removes row after confirm

---

### Phase 6: Frontend — Form, Preview & Integration — PLANNED

**Objective:** Create/edit form, preview with attempt submission, store `userId` on auth.

#### Tests First (Red)

| File | Tests |
|------|-------|
| `src/components/mcq-form.test.tsx` | Default 2 choices; add/remove; exactly one correct; save POST/PUT; cancel navigates |
| `src/components/mcq-preview.test.tsx` | Renders question; submit posts attempt; shows correct/incorrect |
| `src/components/signup-form.test.tsx` | Extend: stores `quizmaker.userId` on 201 |
| `src/components/login-form.test.tsx` | Extend: stores `quizmaker.userId` on 200 |

#### Implement (Green)

1. `src/components/mcq-form.tsx`
2. `src/app/mcq/new/page.tsx`
3. `src/app/mcq/[id]/edit/page.tsx`
4. `src/components/mcq-preview.tsx`
5. `src/app/mcq/[id]/preview/page.tsx`
6. Update `signup-form.tsx` and `login-form.tsx` for `userId` storage

#### Phase Acceptance Criteria

- [ ] All Vitest tests pass (auth + MCQ)
- [ ] `npm run lint` and `npm run build` succeed
- [ ] Manual verification on `npm run preview`: full create → list → edit → preview → attempt → delete flow

---

## Technical Implementation Details

### Key Files (planned)

| Path | Purpose |
|------|---------|
| `migrations/0002_create_mcq_tables.sql` | MCQ schema |
| `src/lib/db/mcq-schema.test.ts` | Migration contract tests |
| `src/lib/types/mcq.ts` | Domain types |
| `src/lib/services/mcq-service.ts` | D1 access |
| `src/lib/validation/mcq.ts` | Zod schemas |
| `src/app/api/mcqs/route.ts` | List + create |
| `src/app/api/mcqs/[id]/route.ts` | Get + update + delete |
| `src/app/api/mcqs/[id]/attempts/route.ts` | Record attempt |
| `src/components/mcq-list.tsx` | Table + actions |
| `src/components/mcq-form.tsx` | Create/edit form |
| `src/components/mcq-preview.tsx` | Preview + attempt |

### Red → Green Workflow

1. **Red** — Write Vitest tests for the phase; `npm test` must fail
2. **Green** — Implement minimum code; `npm test` passes for all phases to date
3. **Done** — Phase acceptance criteria met

Mock D1 and `@opennextjs/cloudflare` in unit tests. Colocate tests beside source. Use `npm run preview` for manual D1 integration after Phase 1.

### Important Notes

- **No route protection:** Any client can call MCQ APIs; acceptable for this teaching sprint
- **Choice replacement on update:** Simplest approach is delete-all-then-insert for choices on update
- **Preview is not a student portal:** Same logged-in teacher can preview their own questions
- **sessionStorage userId:** Cleared on logout with display name

---

## Acceptance Criteria

- [ ] Teachers see an MCQ table at `/mcq` instead of "Coming Soon"
- [ ] Teachers can create an MCQ with 2–6 choices and exactly one correct answer
- [ ] Teachers can edit and delete MCQs from the list actions menu
- [ ] Teachers can preview a question and submit an answer; attempt is stored in `mcq_attempts`
- [ ] All MCQ data persists in D1 across preview server restarts
- [ ] `npm test`, `npm run lint`, and `npm run build` pass
- [ ] No plain-text passwords or direct SQL in route handlers

---

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| MCQ create time | < 2 minutes average | Manual timing from `/mcq/new` to save |
| CRUD API reliability | 100% happy-path pass | Vitest route + service tests green |
| Data integrity | 0 orphan choices | FK + cascade verified in migration tests |
| Teacher task completion | Full CRUD + preview in one session | Manual test script on `npm run preview` |

---

## Dependencies

### External Dependencies

- Cloudflare D1 (`quizmaker-db`, binding `DB`) — already configured
- Zod — already installed

### Internal Dependencies

- `users` table and User Service — `created_by_user_id` FK
- Auth flow + `sessionStorage` — extended for `quizmaker.userId`
- `src/lib/api/http.ts` — shared response helpers
- shadcn/ui components listed above — `dropdown-menu` already in repo

---

## Risks and Mitigation

### Technical Risks

- **Risk:** Stateless `userId` in request body can be spoofed
- **Mitigation:** Document as known limitation; sessions planned for later sprint

- **Risk:** Choice update races could leave orphan rows
- **Mitigation:** Replace-all-choices pattern in single service method; test thoroughly

- **Risk:** D1 `first()` inconsistency
- **Mitigation:** Use `all()` and read `results[0]` per project D1 rules

### User Experience Risks

- **Risk:** Teachers forget to mark exactly one correct answer
- **Mitigation:** Zod + inline `FieldError`; disable Save until valid

- **Risk:** Accidental delete
- **Mitigation:** Dialog confirmation before DELETE

---

## Troubleshooting Guide

_(Populate during implementation.)_

---

## Notes for AI Agents

When working with this PRD:

1. Read Scope (In/Out/Cut) before coding — do not build collaboration, auth gates, or attempt dashboards
2. **Execute one phase at a time.** Complete tests + acceptance criteria before starting the next phase
3. Update phase status markers and Implementation Status table as work progresses
4. Add Implementation Record section (like auth PRD) when phases complete
5. Follow existing patterns from `register-login-logout-prd.md` and `.cursor/skills/testing/SKILL.md`
6. Never apply migrations to remote D1
7. Run `npm run lint` and `npm run build` before marking Phase 6 complete

---

## Current Status

**Last Updated:** September 10, 2026  
**Current Phase:** Phase 2 — MCQ Service  
**Status:** IN PROGRESS  
**Next Steps:** Write `mcq-service.test.ts` (Red), then implement `mcq-service.ts` and `types/mcq.ts` (Green)
