---
name: e2e_test_writer
description: >
  AI-assisted Playwright E2E test generation for the Reposol OSCAL Management application.
  Uses Chrome DevTools MCP to explore the running UI, identify selectors and page structure,
  then generates deterministic Playwright test files (.spec.ts) that follow project conventions,
  ensuring 100% field-level verification and complete use-case coverage based on user stories.
  Triggers on: write E2E test, extend E2E tests, add E2E coverage, test end-to-end,
  generate playwright test, e2e test for, browser test for.
---

# E2E Test Writer Skill

This skill generates **deterministic, high-coverage Playwright E2E tests** for the Reposol OSCAL Security Management application.
It uses Chrome DevTools MCP for **UI exploration only** — the output is always a standard Playwright `.spec.ts` file that runs cleanly in CI/CD without any AI dependency.

> [!IMPORTANT]
> **Primary Objective**: Tests are not just surface-level "smoke checks". They must exhaustively verify **every field, form validation, edge case, and state persistence** defined in the [User Stories](file:///c:/Users/phili/Desktop/Projects/Security-Management-OSCAL/documentation/user_stories/) (`step0` through `step8`) to actively surface bugs and regressions.

---

## When This Skill Applies

Trigger this skill when you are asked to:
- Write an E2E test for a feature, form, or user story
- Extend existing E2E tests with new test cases or edge cases
- Add comprehensive browser-based test coverage for a UI flow
- Generate Playwright tests from acceptance criteria in `documentation/user_stories/`
- Verify bug fixes or end-to-end user journeys in the browser

This skill does **NOT** apply to:
- Backend unit/integration tests (use Pytest directly)
- Frontend unit/component tests (use Vitest directly)
- Running existing tests without modification (use `npm test` or `npx playwright test`)
- Non-testing tasks

---

## Prerequisites

The E2E test infrastructure is located at:
- **E2E directory**: `reposol/e2e/`
- **Test specs**: `reposol/e2e/tests/` (organized by step/feature, e.g., `step1-catalog-builder.spec.ts`, `catalog/`, `profile/`)
- **Fixtures**: `reposol/e2e/fixtures/base.ts`
- **API helpers**: `reposol/e2e/helpers/api-setup.ts`
- **Config**: `reposol/e2e/playwright.config.ts`
- **User Stories**: `documentation/user_stories/step0_global_requirements.md` through `step8_control_mapping.md`

The application must be running for exploration:
- Backend: Port 1000 (FastAPI, `darkspell` conda environment)
- Frontend: Port 5173 (Vite dev server)

---

## Standard Workflow (6 Phases)

### Phase 1: Input & User Story Analysis 📋

1. **Read the target User Story**: Open the relevant story in `documentation/user_stories/` (e.g. `step1_catalog_builder.md`, `step2_profile_tailoring.md`, etc.).
2. **Extract ALL testable acceptance criteria & fields**:
   - List every input field, dropdown, toggle, modal, and action button specified.
   - Note required fields, format rules, default values, and error conditions.
3. **Determine the test location & mapping**:
   - Match existing specs in `reposol/e2e/tests/` (e.g., `step1-catalog-builder.spec.ts` or subdirectories like `tests/catalog/`).
   - Group tests by feature and user story section.

### Phase 2: UI Exploration via MCP 🔍

Use Chrome DevTools MCP to explore the live application:

1. **Navigate to the page**:
   ```
   Use navigate_page to go to http://localhost:5173
   ```
2. **Take DOM / Accessibility snapshots**:
   ```
   Use take_snapshot to inspect the actual ARIA tree and form elements
   ```
3. **Identify stable, accessible locators** in priority order:
   - `getByRole('button', { name: 'Save' })`
   - `getByLabel('Title')`
   - `getByText('Access Control')`
   - `getByPlaceholder('Search...')`
   - `getByTestId('control-tree')` (fallback)
4. **Map out complete user interaction flows**:
   - Triggers for modal popups, step transitions, dynamic field renders.
   - Validation triggers (onBlur, onSubmit, input changes).
   - Server response handling and toast/alert feedback elements.

### Phase 3: Infrastructure & Helper Verification 📚

1. **Check existing test specs** in `reposol/e2e/tests/` to prevent duplicate coverage and align style.
2. **Inspect fixtures** in `reposol/e2e/fixtures/base.ts`.
3. **Inspect API setup helper** in `reposol/e2e/helpers/api-setup.ts`:
   - Use `apiSetup` methods (`createCatalog()`, `createProfile()`, etc.) to quickly seed preconditions.
   - If testing a new document type or state, **extend `api-setup.ts` first** with clean helper methods.

### Phase 4: Test Generation (Exhaustive Quality Standard) ✍️

Write or extend the Playwright test file following these strict coverage rules:

#### Mandatory Coverage Standard:
1. **Full Form Field Verification**:
   - Test **EVERY** field in a form (inputs, textareas, selects, checkboxes, switches, datepickers).
   - Test initial default values/state.
   - Modify each field and submit/save.
   - Verify UI updates immediately.
   - **Reload page / re-fetch** to confirm end-to-end persistence in database/backend.
2. **Field Validation & Error Testing**:
   - Submit empty/invalid values to test required-field validation messages.
   - Test character limits, boundary values, and invalid formats.
   - Confirm submit buttons are disabled/blocked or error alerts appear as specified in user stories.
3. **User Action & State Transitions**:
   - Test cancel/close buttons (changes discarded).
   - Test delete/archive confirmations.
   - Test step-by-step wizard progressions.
4. **API-First Preconditions**:
   - Use `apiSetup` in `test.beforeEach` to prepare document state, avoiding unnecessary UI setup clicks for unrelated prerequisites.
   - Use UI actions only for the explicit functionality being tested.

#### Code Conventions & Template

```typescript
import { test, expect } from '../../fixtures/base';

test.describe('Catalog Builder - Complete Field & Validation Verification', () => {
  let catalogId: string;

  test.beforeEach(async ({ apiSetup }) => {
    // Fast API precondition setup
    const cat = await apiSetup.createCatalog({ title: 'Test Catalog Base' });
    catalogId = cat.id;
  });

  test('user can edit all metadata fields, trigger validations, and persist changes', async ({ page }) => {
    await page.goto(`/catalog/${catalogId}`);

    // 1. Check initial defaults
    await expect(page.getByLabel('Title')).toHaveValue('Test Catalog Base');

    // 2. Test Field Validations (Negative path)
    await page.getByLabel('Title').clear();
    await page.getByRole('button', { name: /save/i }).click();
    await expect(page.getByText(/title is required/i)).toBeVisible();

    // 3. Test Full Field Updates (Positive path)
    await page.getByLabel('Title').fill('Updated Catalog Title');
    await page.getByLabel('Version').fill('2.0.0');
    await page.getByLabel('Description').fill('Detailed description covering all field requirements.');

    // 4. Save and Verify Immediate Feedback
    await page.getByRole('button', { name: /save/i }).click();
    await expect(page.getByText(/saved successfully/i)).toBeVisible();

    // 5. Reload and Verify Persistence
    await page.reload();
    await expect(page.getByLabel('Title')).toHaveValue('Updated Catalog Title');
    await expect(page.getByLabel('Version')).toHaveValue('2.0.0');
    await expect(page.getByLabel('Description')).toHaveValue('Detailed description covering all field requirements.');
  });
});
```

### Phase 5: Test Execution & Validation ✅

1. **Run in Headed Mode** from `reposol/e2e/`:
   ```powershell
   npx playwright test tests/<path>/<file>.spec.ts --headed
   ```
2. **Analyze & Fix Failures**:
   - If selectors fail, re-explore via DevTools MCP.
   - Fix flaky assertions by using auto-waiting locators (`toBeVisible`, `toHaveValue`).
   - **Never use `page.waitForTimeout()`** — always wait for explicit DOM or network conditions.
3. **Run in Headless Mode**:
   ```powershell
   npx playwright test tests/<path>/<file>.spec.ts
   ```
   Ensure 100% pass rate in headless execution.

### Phase 6: Reporting & Documentation 📄

1. Link created/modified spec files: e.g. [`step1-catalog-builder.spec.ts`](file:///c:/Users/phili/Desktop/Projects/Security-Management-OSCAL/reposol/e2e/tests/step1-catalog-builder.spec.ts).
2. Detail the exact use cases, fields, and edge cases tested.
3. Note any newly discovered application bugs or regressions found during testing.

---

## Test Quality Checklist

Before finalizing any test:
- [ ] Mapped 1:1 to acceptance criteria in `documentation/user_stories/`
- [ ] Explored UI structure using Chrome DevTools MCP
- [ ] Every form field tested (inputs, selects, toggles, textareas)
- [ ] Field validations tested (empty values, invalid formats, boundary conditions)
- [ ] Save & Reload persistence verified
- [ ] Cancellation & rollback states verified
- [ ] API setup used for preconditions (`apiSetup`), UI used for target feature
- [ ] Accessible locators used (`getByRole`, `getByLabel`, `getByText`)
- [ ] Web-first auto-waiting assertions used (no `waitForTimeout`)
- [ ] Verified green in both `--headed` and headless modes
