---
name: e2e_test_writer
description: >
  AI-assisted Playwright E2E test generation for the Reposol OSCAL Management application.
  Uses Chrome DevTools MCP to explore the running UI, identify selectors and page structure,
  then generates deterministic Playwright test files (.spec.ts) that follow project conventions.
  Triggers on: write E2E test, extend E2E tests, add E2E coverage, test end-to-end,
  generate playwright test, e2e test for, browser test for.
---

# E2E Test Writer Skill

This skill generates **deterministic Playwright E2E tests** for the Reposol OSCAL Security Management application. It uses Chrome DevTools MCP for **UI exploration only** — the output is always a standard Playwright `.spec.ts` file that runs without any AI dependency.

---

## When This Skill Applies

Trigger this skill when you are asked to:
- Write an E2E test for a feature or user story
- Extend existing E2E tests with new test cases
- Add browser-based test coverage for a UI flow
- Generate Playwright tests from acceptance criteria
- Test a feature end-to-end in the browser

This skill does **NOT** apply to:
- Backend unit/integration tests (use Pytest directly)
- Frontend component tests (use Vitest directly)
- Running existing tests (just use `npm test` or `npx playwright test`)
- Non-testing tasks

---

## Prerequisites

The E2E test infrastructure is located at:
- **E2E directory**: `reposol/e2e/`
- **Test specs**: `reposol/e2e/tests/`
- **Fixtures**: `reposol/e2e/fixtures/base.ts`
- **API helpers**: `reposol/e2e/helpers/api-setup.ts`
- **Config**: `reposol/e2e/playwright.config.ts`

The application must be running for exploration:
- Backend: Port 1000 (FastAPI, `darkspell` conda environment)
- Frontend: Port 5173 (Vite dev server)

---

## Workflow (6 Phases)

### Phase 1: Input Analysis 📋

1. **Read the feature request or user story** to understand what needs testing.
2. **Extract testable acceptance criteria** — each criterion maps to one `test()` block.
3. **Identify the OSCAL document type(s)** involved (catalog, profile, SSP, etc.).
4. **Determine the test category**:
   - `tests/catalog/` — Catalog features
   - `tests/profile/` — Profile features
   - `tests/import-wizard/` — Import wizard
   - `tests/dashboard/` — Dashboard features
   - `tests/cross-document/` — Multi-document workflows
   - Create a new subdirectory for new OSCAL types (e.g., `tests/ssp/`, `tests/poam/`)

### Phase 2: UI Exploration 🔍

Use Chrome DevTools MCP to explore the running application:

1. **Navigate to the relevant page**:
   ```
   Use navigate_page to go to http://localhost:5173
   ```

2. **Take a snapshot** to understand the current DOM structure:
   ```
   Use take_snapshot to get the accessibility tree
   ```

3. **Identify stable selectors** by examining the page:
   - Prefer ARIA roles: `getByRole('button', { name: 'Save' })`
   - Prefer visible text: `getByText('Access Control')`
   - Prefer labels: `getByLabel('Title')`
   - Use test IDs only as fallback: `getByTestId('control-tree')`

4. **Navigate through the feature flow** to understand:
   - What elements appear and in what order
   - What user interactions are needed (clicks, typing, selecting)
   - What success/error states look like
   - How long operations take (for timeout configuration)

5. **Document the selectors and flow** before writing the test.

### Phase 3: Existing Test Analysis 📚

Before writing new tests:

1. **Scan existing test files** in `reposol/e2e/tests/` to avoid duplication:
   ```
   Use grep_search or list_dir to find related tests
   ```

2. **Read the fixtures** at `reposol/e2e/fixtures/base.ts` to understand available helpers.

3. **Read the API setup helper** at `reposol/e2e/helpers/api-setup.ts` to understand what data creation methods exist.

4. **Check if the `ApiSetup` class needs extending** — if the test requires a document type not yet supported (e.g., SSP, Component Definition), add a new method to `api-setup.ts` first.

### Phase 4: Test Generation ✍️

Write the Playwright test file following these conventions:

#### File Structure
```typescript
import { test, expect } from '../../fixtures/base';
// OR for tests that don't need apiSetup:
// import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  // Setup: Create test data via API (fast, no UI clicking)
  test.beforeEach(async ({ apiSetup }) => {
    // Pre-create documents needed for tests
  });

  test('user can perform action and see result', async ({ page, apiSetup }) => {
    // 1. Navigate
    await page.goto('/catalogs');

    // 2. Interact
    await page.getByRole('button', { name: /new/i }).click();
    await page.getByLabel('Title').fill('My Catalog');

    // 3. Assert
    await expect(page.getByText('My Catalog')).toBeVisible();
  });
});
```

#### Naming Conventions
- **File name**: `<feature>-<aspect>.spec.ts` (e.g., `catalog-crud.spec.ts`)
- **Describe block**: Feature name matching the file (e.g., `'Catalog CRUD Operations'`)
- **Test name**: User-perspective description starting with a verb (e.g., `'user can create a new catalog with title and metadata'`)

#### Test Data Strategy
- **API-first setup**: Use `apiSetup.createCatalog()` / `apiSetup.createProfile()` in `beforeEach`
- **UI creation only when testing the creation flow itself**
- **Each test is independent** — no shared state between tests
- **Cleanup is automatic** via the `apiSetup` fixture

#### Selector Priority
1. `getByRole('button', { name: '...' })` — ARIA roles (preferred)
2. `getByText('...')` — visible text
3. `getByLabel('...')` — form labels
4. `getByPlaceholder('...')` — placeholder text
5. `getByTestId('...')` — `data-testid` (fallback)
6. `locator('.class')` — CSS (last resort)

#### Assertions
- Use **web-first assertions** that auto-wait:
  - `await expect(locator).toBeVisible()`
  - `await expect(locator).toHaveText('...')`
  - `await expect(locator).toHaveCount(n)`
  - `await expect(locator).toBeEnabled()`
- **Never use `page.waitForTimeout()`** — always wait for specific conditions

### Phase 5: Test Validation ✅

After writing the test file:

1. **Run only the new test file**:
   ```powershell
   npx playwright test tests/<path>/<file>.spec.ts --headed
   ```
   Run from `reposol/e2e/` directory.

2. **If the test fails**, analyze the error:
   - **Element not found**: Update the selector (re-explore with MCP if needed)
   - **Timeout**: Increase timeout or add more specific wait conditions
   - **Wrong assertion**: Fix the expected value
   - **API setup failure**: Check the OSCAL document structure

3. **Iterate until the test passes** — fix the test, not the application.

4. **Run in headless mode** to verify it also works without a visible browser:
   ```powershell
   npx playwright test tests/<path>/<file>.spec.ts
   ```

### Phase 6: Output & Report 📄

After the test is green:

1. **Report which file was created/modified** with a link.
2. **List the test cases** written with their names.
3. **Note any new methods added to `api-setup.ts`** if the helper was extended.
4. **Suggest related tests** that could be written next.

---

## Reference: Project Structure

```
reposol/e2e/
├── package.json              # Scripts: test, test:headed, test:ui, test:codegen
├── playwright.config.ts      # Chromium, webServer for backend + frontend
├── tsconfig.json
├── fixtures/
│   └── base.ts               # Custom test fixture with apiSetup
├── helpers/
│   └── api-setup.ts          # ApiSetup class: createCatalog, createProfile, cleanup
└── tests/
    ├── smoke.spec.ts
    ├── catalog/               # Catalog feature tests
    ├── profile/               # Profile feature tests
    ├── import-wizard/         # Import wizard tests
    ├── dashboard/             # Dashboard tests
    └── cross-document/        # Multi-document workflow tests
```

## Reference: API Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/health` | Health check |
| `GET` | `/api/documents/{stage}` | List documents |
| `GET` | `/api/documents/{stage}/{id}` | Get document |
| `POST` | `/api/documents/{stage}` | Create document (201) |
| `DELETE` | `/api/documents/{stage}/{id}?force=true` | Delete document |
| `POST` | `/api/validate/{stage}` | Validate document |
| `GET` | `/api/export/{stage}/{id}?format=json` | Export document |
| `GET` | `/api/recent-documents` | Recent documents |

## Reference: OSCAL Stages

| Stage | URL Path | Description |
|---|---|---|
| `catalog` | `/catalogs`, `/catalog/:id` | Security control catalogs |
| `profile` | `/profiles`, `/profile/:id` | Baseline profiles (tailoring) |
| `ssp` | `/ssps`, `/ssp/:id` | System Security Plans |
| `component-definition` | `/component-definitions` | Component inventories |
| `assessment-plan` | `/assessment-plans` | Assessment plans |
| `assessment-result` | `/assessment-results` | Assessment results |
| `poam` | `/poams` | Plans of Action & Milestones |
| `control-mapping` | `/control-mappings` | Control framework mappings |

---

## Checklist (for self-verification)

Before considering a test complete:

- [ ] I read the feature/user story and extracted acceptance criteria
- [ ] I explored the UI with Chrome DevTools MCP to identify selectors
- [ ] I checked existing tests for overlap
- [ ] I read the fixtures and helpers to reuse existing infrastructure
- [ ] I created/extended the ApiSetup class if a new document type was needed
- [ ] I wrote the test file in the correct subdirectory with proper naming
- [ ] I used API-first data setup (not UI clicking) for test data
- [ ] I used accessible locators (getByRole, getByText, getByLabel)
- [ ] I used web-first assertions (toBeVisible, toHaveText)
- [ ] I ran the test in headed mode and verified it passes
- [ ] I ran the test in headless mode and verified it passes
- [ ] I reported the result with file links and test case names
