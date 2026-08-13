import { test, expect } from '../../fixtures/base';

test.describe('Profile CRUD', () => {
  test('navigate to Profiles tab, list is visible', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    await page.goto('/');
    await page.getByText('Profiles').first().click();
    await expect(page).toHaveURL(/.*profiles/);
    await expect(page.getByRole('heading', { name: /profiles/i })).toBeVisible();
  });

  test('create new profile', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    await page.goto(`/profiles?w=${apiSetup.workspaceId}`);
    await page.getByRole('button', { name: /new/i }).first().click();
    
    const titleInput = page.getByPlaceholder(/Reposol Core Baseline/i).or(page.locator('.modal-panel input')).first();
    await titleInput.fill('E2E Test Profile');
    await page.getByRole('button', { name: 'Create Document' }).click();
    
    await expect(page.getByText('E2E Test Profile').first()).toBeVisible({ timeout: 15000 });
  });

  test('delete profile', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const title = 'E2E Delete Profile';
    const uuid = await apiSetup.createProfile({ title });
    
    await page.goto(`/profiles?w=${apiSetup.workspaceId}`);
    await expect(page.getByText(title)).toBeVisible();
    
    page.once('dialog', dialog => dialog.accept());

    const row = page.locator('table tr', { hasText: title }).first();
    if (await row.isVisible()) {
      const deleteBtn = row.locator('button[title="Delete document"]');
      if (await deleteBtn.isVisible()) {
        await deleteBtn.click();
        await expect(page.getByText(title)).not.toBeVisible();
      }
    }
  });
});
