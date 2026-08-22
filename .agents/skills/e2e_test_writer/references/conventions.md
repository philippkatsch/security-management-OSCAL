# Playwright Test Conventions for Reposol

## File Organization

```
reposol/e2e/tests/
├── smoke.spec.ts                          # Quick health check (always runs first)
├── step1-catalog-builder.spec.ts          # Step 1: Catalog Builder UI tests
├── step2-profile-tailoring.spec.ts        # Step 2: Profile Tailoring UI tests
├── step3-component-inventory.spec.ts      # Step 3: Component Inventory UI tests
├── step4-ssp-builder.spec.ts              # Step 4: SSP Builder UI tests
├── step5-assessment-plan.spec.ts          # Step 5: Assessment Plan UI tests
├── step6-assessment-results.spec.ts       # Step 6: Assessment Results UI tests
├── step7-poam.spec.ts                     # Step 7: POA&M UI tests
├── step8-control-mapping.spec.ts          # Step 8: Control Mapping UI tests
├── <document-type>/                       # Subdirectories for granular feature tests
│   ├── <type>-crud.spec.ts
│   └── <type>-<feature>.spec.ts
├── cross-document/                        # Multi-document workflows
└── dashboard/                             # Dashboard/overview
```

## Template: Standard Test File

```typescript
import { test, expect } from '../fixtures/base';

test.describe('Feature Name - UI Verification', () => {

  test('user can perform action and persist after reload', async ({ page, apiSetup }) => {
    // ARRANGE: Create test data via API (fast, no UI clicks)
    const catUuid = await apiSetup.createCatalog({
      title: 'Test Catalog',
      groups: [{ id: 'ac', title: 'Access Control', controls: [...] }]
    });

    // ACT: Navigate and interact via UI (what the user does with the mouse)
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

## ApiSetup Helper Methods

Available via `apiSetup` fixture (from `fixtures/base.ts`):

```typescript
// Sync workspace (required once per test suite)
await apiSetup.syncWorkspace();

// Create documents via API
const catUuid = await apiSetup.createCatalog({ title: '...', groups: [...], controls: [...] });
const profUuid = await apiSetup.createProfile({ title: '...', catalogUuid: catUuid });
const compUuid = await apiSetup.createComponentDefinition({ title: '...' });
const sspUuid = await apiSetup.createSsp({ title: '...', profileId: profUuid });
const apUuid = await apiSetup.createAssessmentPlan({ title: '...', sspId: sspUuid });
const arUuid = await apiSetup.createAssessmentResults({ title: '...', apId: apUuid });
const poamUuid = await apiSetup.createPoam({ title: '...' });

// Get workspace ID for URL params
apiSetup.workspaceId

// Cleanup is automatic after each test
```

## Locator Priority

Use the most stable, accessible locator available:

| Priority | Locator | Example |
|---|---|---|
| 1 (best) | `getByRole` | `page.getByRole('button', { name: 'Save' })` |
| 2 | `getByLabel` | `page.getByLabel('Title')` |
| 3 | `getByText` | `page.getByText('Access Control')` |
| 4 | `getByPlaceholder` | `page.getByPlaceholder('Search...')` |
| 5 | `locator` with ID | `page.locator('#create-doc-title')` |
| 6 | `locator` with data-testid | `page.locator('[data-testid="tree-node-ac-1"]')` |
| 7 | `locator` with data-* | `page.locator('[data-param-id="ac-1_prm_1"]')` |

## Strict Anti-Patterns

| ❌ FORBIDDEN | ✅ DO THIS INSTEAD |
|---|---|
| `if (await el.isVisible()) { ... }` | `await expect(el).toBeVisible()` |
| `page.waitForTimeout(2000)` | `await expect(locator).toBeVisible()` |
| Changing production code for tests | Fix the test selector via MCP exploration |
| Backend OSCAL schema checks in E2E | Use Pytest backend tests for that |
| Shared state between tests | Each test creates its own data via `apiSetup` |
| Hardcoded UUIDs | `randomUUID()` or API-generated IDs |
| Sequential test dependencies | Independent, isolated tests |

## Running Tests

```powershell
# From reposol/e2e/ directory:

# Run all tests
conda run -n darkspell npx playwright test

# Run specific step
conda run -n darkspell npx playwright test tests/step2-profile-tailoring.spec.ts

# Run with browser visible
conda run -n darkspell npx playwright test tests/step2-profile-tailoring.spec.ts --headed

# Run with Playwright UI (interactive debugger)
conda run -n darkspell npx playwright test --ui

# View HTML test report
conda run -n darkspell npx playwright show-report
```
