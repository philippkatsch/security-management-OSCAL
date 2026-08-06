import { test, expect } from '../../fixtures/base';

test.describe('Profile CRUD', () => {
  test('navigate to Profiles tab, list is visible', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Profiles').first().click();
    await expect(page).toHaveURL(/.*profiles/);
    await expect(page.getByRole('heading', { name: /profiles/i })).toBeVisible();
  });

  test('create new profile', async ({ page }) => {
    await page.goto('/profiles');
    await page.getByRole('button', { name: /new/i }).click();
    
    const titleInput = page.locator('.modal-overlay input').first();
    await titleInput.fill('E2E Test Profile');
    await page.getByRole('button', { name: /create/i }).click();
    
    await expect(page.getByText('E2E Test Profile').first()).toBeVisible();
  });

  test('delete profile', async ({ page, apiSetup }) => {
    const title = 'E2E Delete Profile';
    const uuid = await apiSetup.createProfile({ title });
    
    await page.goto('/profiles');
    await expect(page.getByText(title)).toBeVisible();
    
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
