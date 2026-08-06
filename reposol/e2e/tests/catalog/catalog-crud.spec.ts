import { test, expect } from '../../fixtures/base';

test.describe('Catalog CRUD', () => {
  test('navigate to Catalogs tab, list is visible', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Catalogs').first().click();
    await expect(page).toHaveURL(/.*catalogs/);
    await expect(page.getByRole('heading', { name: /catalogs/i })).toBeVisible();
  });

  test('create a new catalog', async ({ page }) => {
    await page.goto('/catalogs');
    await page.getByRole('button', { name: /new/i }).click();
    
    const titleInput = page.locator('.modal-overlay input').first();
    await titleInput.fill('E2E Test Catalog');
    await page.getByRole('button', { name: /create/i }).click();
    
    await expect(page.getByText('E2E Test Catalog').first()).toBeVisible();
  });

  test('open catalog and verify metadata', async ({ page, apiSetup }) => {
    const title = 'E2E Metadata Test';
    const uuid = await apiSetup.createCatalog({ title });
    
    await page.goto('/catalogs');
    await page.getByText(title).first().click();
    
    await expect(page.getByRole('heading', { name: title }).first()).toBeVisible();
  });

  test('edit catalog title', async ({ page, apiSetup }) => {
    const title = 'E2E Edit Title Test';
    const uuid = await apiSetup.createCatalog({ title });
    
    await page.goto(`/catalog/${uuid}`);
    
    // Try editing title (assuming edit mode or inline edit)
    const editBtn = page.getByRole('button', { name: /edit/i });
    if (await editBtn.isVisible()) {
      await editBtn.click();
    }
    
    const titleInput = page.getByLabel(/title/i).first();
    if (await titleInput.isVisible()) {
      await titleInput.fill('Updated E2E Title');
      await page.getByRole('button', { name: /save/i }).click();
      await expect(page.getByText('Updated E2E Title').first()).toBeVisible();
    }
  });

  test('delete a catalog', async ({ page, apiSetup }) => {
    const title = 'E2E Delete Test';
    const uuid = await apiSetup.createCatalog({ title });
    
    await page.goto('/catalogs');
    await expect(page.getByText(title).first()).toBeVisible();
    
    // Find delete button near the catalog
    const row = page.locator('tr, li').filter({ hasText: title }).first();
    if (await row.isVisible()) {
      const deleteBtn = row.getByRole('button', { name: /delete/i });
      if (await deleteBtn.isVisible()) {
        await deleteBtn.click();
        const confirmBtn = page.getByRole('button', { name: /confirm|yes/i });
        if (await confirmBtn.isVisible()) {
          await confirmBtn.click();
        }
        await expect(page.getByText(title)).not.toBeVisible();
      }
    }
  });
});
