---
name: e2e_test_writer
description: >
  AI-assisted Playwright E2E test generation, repair, and execution for the Reposol OSCAL Management application.
  Operates in 3 modes: 'generate' (write new tests using MCP UI exploration), 'repair' (fix broken selectors),
  and 'verify' (run existing tests). Tests verify UI behavior only — no backend schema checks.
  Triggers on: write E2E test, extend E2E tests, add E2E coverage, test end-to-end,
  generate playwright test, e2e test for, browser test for, repair E2E, fix E2E tests,
  run E2E tests, verify E2E, check E2E.
---

# E2E Test Writer Skill

This skill manages **deterministic Playwright E2E tests** for the Reposol OSCAL Security Management application.
It operates in **3 distinct modes** depending on what the user needs.

> [!IMPORTANT]
> **E2E tests verify the browser UI only.** Whether the backend OSCAL JSON schema is correct is tested by Pytest backend tests (`reposol/backend/tests/`). E2E tests must NOT duplicate that — they test what the user sees and clicks.

---

## Automatic Step Detection via Git Diff

When the user does NOT specify which Step/Feature to target, **automatically detect affected steps** by analyzing recent code changes:

```powershell
# Run this to identify which frontend components changed:
git diff --name-only HEAD~1 -- reposol/frontend/src/
```

Map changed files to affected E2E test files:

| Changed path contains... | Affected test file |
|---|---|
| `components/catalog/` or `pages/Catalog` | `step1-catalog-builder.spec.ts` |
| `components/profile/` or `pages/Profile` | `step2-profile-tailoring.spec.ts` |
| `components/component-definition/` | `step3-component-inventory.spec.ts` |
| `components/ssp/` or `pages/Ssp` | `step4-ssp-builder.spec.ts` |
| `components/assessment-plan/` | `step5-assessment-plan.spec.ts` |
| `components/assessment-results/` | `step6-assessment-results.spec.ts` |
| `components/poam/` | `step7-poam.spec.ts` |
| `components/mapping/` | `step8-control-mapping.spec.ts` |
| `components/shared/` or `components/document/` | **All step files** (shared components affect everything) |
| `components/dashboard/` | `smoke.spec.ts` + dashboard tests |

If the user says *"run E2E tests"* or *"repair E2E tests"* without specifying a step, use this mapping to determine which tests to run/repair. If shared components changed, run all tests.

---

## Mode Detection

Determine the correct mode from the user's request:

| User says... | Mode | What happens |
|---|---|---|
| "Write E2E tests for Step 3" | **generate** | Read user story, explore UI via MCP, write new test cases |
| "Add E2E coverage for the export feature" | **generate** | Same as above, scoped to a specific feature |
| "Step 2 tests are failing, fix them" | **repair** | Read error output, explore UI via MCP, fix broken selectors |
| "Repair the catalog E2E tests" | **repair** | Same as above |
| "Run the E2E tests for profiles" | **verify** | Execute `npx playwright test` and report results |
| "Check if E2E tests pass" | **verify** | Same as above |
| "Run E2E tests" (no step specified) | **verify** | Auto-detect affected steps via git diff, then run those |

---

## Infrastructure Reference

```
reposol/e2e/
├── playwright.config.ts          ← Auto-starts Backend (:1000) + Frontend (:1001)
├── fixtures/base.ts              ← Provides `apiSetup` fixture (test data via API + auto-cleanup)
├── helpers/
│   ├── api-setup.ts              ← Creates Catalogs, Profiles, SSPs, etc. via API
│   ├── profile-helpers.ts        ← Navigation, tab selection, structuring mode helpers
│   └── dnd-helper.ts             ← HTML5 Drag-and-Drop simulation
└── tests/
    ├── step1-catalog-builder.spec.ts
    ├── step2-profile-tailoring.spec.ts
    ├── step3-component-inventory.spec.ts
    ├── step4-ssp-builder.spec.ts
    ├── step5-assessment-plan.spec.ts
    ├── step6-assessment-results.spec.ts
    ├── step7-poam.spec.ts
    ├── step8-control-mapping.spec.ts
    └── smoke.spec.ts
```

User Stories: `documentation/user_stories/step0_global_requirements.md` through `step8_control_mapping.md`

Environment: Always use `darkspell` conda environment.

---

## Mode 1: `generate` — Write New Tests

**When:** User built a new feature and needs tests for it.

### Workflow

#### Step 1: Scope — What needs new tests?

1. Read the user's request to identify the target Step/Feature (e.g., "Step 2 Profile Tailoring" or "the new Export button").
2. Read the relevant **User Story** in `documentation/user_stories/`.
3. Check the **existing test file** (e.g., `tests/step2-profile-tailoring.spec.ts`):
   - What test cases already exist? **Do not rewrite or duplicate them.**
   - What acceptance criteria from the user story are NOT yet covered?
4. List the **new test cases** to write.

#### Step 2: Explore — What does the real UI look like?

Use Chrome DevTools MCP to inspect the **running application**:

1. Navigate to the relevant page via `navigate_page`.
2. **Primary: Accessibility Tree snapshot** via `take_snapshot` — fast, cheap, gives exact element roles/labels/IDs.
3. **Secondary: Screenshot analysis** via `take_screenshot` — use when you need to verify visual layout, check if elements are positioned correctly, or when the Accessibility Tree alone is ambiguous (e.g., complex drag-and-drop areas, overlapping modals).
4. **Interactive exploration** via `click`, `fill`, `hover` — click through the real UI to understand dynamic flows (modals that open, dropdowns that populate, tabs that reveal content).
5. Identify stable locators in priority order:
   - `getByRole('button', { name: 'Save' })`
   - `getByLabel('Title')`
   - `getByText('Access Control')`
   - `getByPlaceholder('Search...')`
   - `locator('[data-testid="..."]')` (fallback)
   - `locator('[data-param-id="..."]')` or `locator('[data-dnd-id="..."]')` (for specific OSCAL elements)
6. Map out the interaction flow: What to click, what to fill, what appears.

#### Step 3: Write — Add new test cases

Write new `test(...)` blocks into the existing spec file (or create a new file if no spec exists for this Step).

**Rules:**
- Import from `'../fixtures/base'` (provides `test`, `expect`, `apiSetup`)
- Use `apiSetup` in `test.beforeEach` for precondition data (fast, no UI clicks for setup)
- Use **UI actions** only for the feature being tested
- **ZERO `if (await ...)` conditionals** — assert everything strictly
- **Always F5-reload** after saves: `await page.reload()` + re-assert values
- **Never change production code** to make a test pass

**Template:**

```typescript
import { test, expect } from '../fixtures/base';

test.describe('Feature Name - UI Verification', () => {

  test('user can do X, see feedback, and persist after reload', async ({ page, apiSetup }) => {
    // ARRANGE: Create test data via API
    const catUuid = await apiSetup.createCatalog({ title: 'Test Catalog' });

    // ACT: Navigate and interact via UI
    await page.goto(`/catalogs/${catUuid}?edit=true&w=${apiSetup.workspaceId}`);
    await page.getByLabel('Title').fill('Updated Title');
    await page.getByRole('button', { name: /save/i }).click();

    // ASSERT: Immediate UI feedback
    await expect(page.getByText('Updated Title')).toBeVisible();

    // ASSERT: F5 Reload Persistence
    await page.reload();
    await expect(page.getByLabel('Title')).toHaveValue('Updated Title');
  });
});
```

#### Step 4: Run & Fix

1. Run tests in headless mode:
   ```powershell
   conda run -n darkspell npx playwright test tests/<file>.spec.ts
   ```
2. If a selector fails → re-explore via MCP `take_snapshot` → fix the **test selector** (not the production code).
3. Repeat until 100% green.
4. Run once more to confirm stability.

#### Step 5: Report

- List new test cases written
- Confirm pass/fail results
- Note any application bugs discovered during exploration

---

## Mode 2: `repair` — Fix Broken Tests

**When:** Tests are failing after a UI refactoring (changed labels, moved elements, new DOM structure).

### Workflow

#### Step 1: Diagnose — What exactly is broken?

1. Run the failing tests:
   ```powershell
   conda run -n darkspell npx playwright test tests/<file>.spec.ts
   ```
2. Read the error output. For each failure, note:
   - Which test case failed
   - Which line number
   - Which selector couldn't find the element
   - The error screenshot (in `test-results/`)

#### Step 2: Explore — What does the UI look like now?

1. Navigate to the affected page via `navigate_page`.
2. Take an Accessibility Tree snapshot via `take_snapshot`.
3. Find the **correct new selector** for each broken locator.

#### Step 3: Fix — Update only the broken selectors

- **Do NOT rewrite the entire test file.**
- **Do NOT change production code.**
- Change only the specific locator strings that no longer match the DOM.

Example:
```diff
- const titleInput = page.getByLabel('Document Title');
+ const titleInput = page.locator('#create-doc-title');
```

#### Step 4: Re-run & Confirm

1. Run the tests again.
2. Confirm all previously failing tests now pass.
3. Confirm no other tests broke.

---

## Mode 3: `verify` — Run Existing Tests

**When:** User wants to check if tests pass after a code change. No test writing needed.

### Workflow

1. **If no specific step is mentioned**, auto-detect affected steps via git diff (see "Automatic Step Detection" above).

2. Run tests **headless** (default — no browser window):
   ```powershell
   # Auto-detected steps or all tests
   conda run -n darkspell npx playwright test

   # Specific step
   conda run -n darkspell npx playwright test tests/step2-profile-tailoring.spec.ts

   # Only if user explicitly asks for headed:
   conda run -n darkspell npx playwright test tests/step2-profile-tailoring.spec.ts --headed
   ```

3. Report the results:
   - Number of passed/failed tests
   - For failures: Which test, which line, which selector, and the error screenshot path

4. **Do NOT automatically fix tests.** Ask the user whether they want to switch to `repair` mode.

---

## 2 Strict Rules (All Modes)

### Rule 1: No `if`-Conditionals

```typescript
// ❌ FORBIDDEN — hides bugs silently:
if (await button.isVisible()) {
  await button.click();
}

// ✅ CORRECT — surfaces bugs immediately:
await expect(button).toBeVisible();
await button.click();
```

### Rule 2: Always F5-Reload Persistence

```typescript
// After every save/modification:
await page.reload();
await expect(page.getByLabel('Title')).toHaveValue('Updated Title');
```

### Additional: Never Change Production Code

If a test fails because a selector doesn't match, fix the **test**, not the component.
Explore the real UI via `take_snapshot` to find the correct selector.

---

## Test Quality Checklist

Before finalizing any test (applies to `generate` and `repair` modes):

- [ ] Mapped 1:1 to acceptance criteria in `documentation/user_stories/`
- [ ] Explored UI structure using Chrome DevTools MCP (`take_snapshot`)
- [ ] **ZERO `if (await ...)` conditionals** in test assertions
- [ ] Every form field, dropdown, and toggle from the user story tested
- [ ] Immediate UI feedback verified (badges, toasts, error highlights)
- [ ] `await page.reload()` persistence verified for every saved value
- [ ] API setup used for preconditions (`apiSetup`), UI used for target feature
- [ ] Accessible locators used (`getByRole`, `getByLabel`, `getByText`)
- [ ] Web-first auto-waiting assertions used (no `waitForTimeout`)
- [ ] **No production code changes** made to accommodate tests
- [ ] Verified green in headless mode
