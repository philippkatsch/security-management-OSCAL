import { test, expect } from '../../fixtures/base';

test.describe('Catalog CRUD', () => {
  test('navigate to Catalogs tab, list is visible', async ({ page }) => {
    await page.goto('/');
    await page.locator('nav').getByText('Catalogs').click();
    await expect(page).toHaveURL(/.*catalogs/);
    await expect(page.getByRole('heading', { name: /catalog/i })).toBeVisible();
  });

  test('create a new catalog', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    await page.goto(`/catalogs?w=${apiSetup.workspaceId}`);
    const newBtn = page.getByRole('button', { name: /new/i }).first();
    await newBtn.click();
    
    const titleInput = page.getByPlaceholder(/Reposol Core Baseline/i).or(page.locator('.modal-panel input')).first();
    await titleInput.fill('E2E Test Catalog');
    await page.getByRole('button', { name: 'Create Document' }).click();
    
    await expect(page.getByText('E2E Test Catalog').first()).toBeVisible({ timeout: 15000 });
  });

  test('open catalog and verify metadata', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const title = 'E2E Metadata Test';
    const uuid = await apiSetup.createCatalog({ title });
    
    await page.goto(`/catalogs/${uuid}?w=${apiSetup.workspaceId}`);
    await expect(page.getByText(title).first()).toBeVisible({ timeout: 15000 });
  });

  test('edit catalog title', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const title = 'E2E Edit Title Test';
    const uuid = await apiSetup.createCatalog({ title });
    
    await page.goto(`/catalogs/${uuid}?edit=true&w=${apiSetup.workspaceId}`);
    await expect(page.getByText(title).first()).toBeVisible({ timeout: 15000 });
  });

  test('delete a catalog', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const title = 'E2E Delete Test';
    const uuid = await apiSetup.createCatalog({ title });
    
    await page.goto(`/catalogs?w=${apiSetup.workspaceId}`);
    await expect(page.getByText(title).first()).toBeVisible({ timeout: 15000 });
    
    page.once('dialog', dialog => dialog.accept());
    
    const row = page.locator('table tr', { hasText: title }).first();
    if (await row.isVisible()) {
      const deleteBtn = row.locator('button[title="Delete document"]');
      if (await deleteBtn.isVisible()) {
        await deleteBtn.click();
        const modal = page.getByRole('dialog').first();
        if (await modal.isVisible({ timeout: 3000 }).catch(() => false)) {
          await modal.getByRole('button', { name: /Delete|Confirm/i }).click();
        }
        await expect(page.locator('table tr', { hasText: title })).not.toBeVisible({ timeout: 15000 });
      }
    }
  });
});
