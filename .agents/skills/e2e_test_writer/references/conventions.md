# Playwright Test Conventions for Reposol

## File Organization

```
reposol/e2e/tests/
├── smoke.spec.ts                          # Quick health check (always runs first)
├── <document-type>/                       # One directory per OSCAL type
│   ├── <type>-crud.spec.ts                # Create, Read, Update, Delete
│   ├── <type>-<feature>.spec.ts           # Specific feature tests
│   └── <type>-export.spec.ts              # Export/serialization tests
├── import-wizard/                         # Import wizard (cross-cutting)
├── dashboard/                             # Dashboard/overview
└── cross-document/                        # Multi-document workflows
```

## Template: Basic Test File

```typescript
import { test, expect } from '../../fixtures/base';

test.describe('Feature Name', () => {
  test('user can perform action', async ({ page, apiSetup }) => {
    // 1. ARRANGE: Create test data via API
    const { id } = await apiSetup.createCatalog({
      title: 'Test Catalog',
      withControls: true,
      withParams: true,
    });

    // 2. ACT: Navigate and interact
    await page.goto(`/catalog/${id}`);
    await page.getByRole('button', { name: /edit/i }).click();
    await page.getByLabel('Title').fill('Updated Title');
    await page.getByRole('button', { name: /save/i }).click();

    // 3. ASSERT: Verify the result
    await expect(page.getByText('Updated Title')).toBeVisible();
  });
});
```

## Template: CRUD Test File

```typescript
import { test, expect } from '../../fixtures/base';

test.describe('<Type> CRUD Operations', () => {
  test('navigate to list view shows document list', async ({ page }) => {
    await page.goto('/<type-plural>');
    await expect(page.getByRole('heading', { name: /<Type>/i })).toBeVisible();
  });

  test('create new document via UI', async ({ page }) => {
    await page.goto('/<type-plural>');
    await page.getByRole('button', { name: /new/i }).click();
    // Fill required fields...
    await page.getByRole('button', { name: /save|create/i }).click();
    // Verify creation...
  });

  test('open existing document shows detail view', async ({ page, apiSetup }) => {
    const { id } = await apiSetup.create<Type>({ title: 'Test Doc' });
    await page.goto('/<type>/' + id);
    await expect(page.getByText('Test Doc')).toBeVisible();
  });

  test('delete document removes it from list', async ({ page, apiSetup }) => {
    const { id } = await apiSetup.create<Type>({ title: 'To Delete' });
    await page.goto('/<type-plural>');
    // Find and delete...
    await expect(page.getByText('To Delete')).not.toBeVisible();
  });
});
```

## ApiSetup Helper Methods

Available methods in `apiSetup` (from `fixtures/base.ts`):

```typescript
// Create a catalog (optionally with groups, controls, parameters)
const { id, document } = await apiSetup.createCatalog({
  title: 'My Catalog',
  withControls: true,
  withParams: true,
  withGroups: true,
});

// Create a profile importing a catalog
const { id, document } = await apiSetup.createProfile({
  title: 'My Profile',
  catalogId: catalogId,
  includeControls: ['ac-1', 'ac-2'],
});

// Get a document
const doc = await apiSetup.getDocument('catalog', id);

// Delete a document
await apiSetup.deleteDocument('catalog', id);

// Cleanup is automatic after each test
```

## Anti-Patterns to Avoid

| ❌ Don't | ✅ Do |
|---|---|
| `page.waitForTimeout(2000)` | `await expect(locator).toBeVisible()` |
| `page.locator('.css-class')` | `page.getByRole('button', { name: 'Save' })` |
| `page.locator('#my-id')` | `page.getByTestId('my-id')` |
| Shared state between tests | Each test creates its own data |
| UI clicks for test data setup | `apiSetup.createCatalog()` in beforeEach |
| Hardcoded UUIDs | `randomUUID()` or API-generated IDs |
| `expect(value).toBe(...)` for DOM | `expect(locator).toHaveText(...)` |
| Sequential test dependencies | Independent, parallelizable tests |

## Running Tests

```powershell
# From reposol/e2e/ directory:

# Run all tests
npm test

# Run specific test file
npx playwright test tests/catalog/catalog-crud.spec.ts

# Run with browser visible
npm run test:headed

# Run with Playwright UI (interactive)
npm run test:ui

# Generate tests by recording browser actions
npm run test:codegen

# Debug a failing test
npm run test:debug

# View HTML test report
npm run test:report
```
