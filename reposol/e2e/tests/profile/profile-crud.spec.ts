import { test, expect } from '../../fixtures/base';

test.describe('Profile CRUD', () => {
  test('navigate to Profiles tab, list is visible', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    await page.goto('/');
    await page.locator('nav').getByText('Profiles').click();
    await expect(page).toHaveURL(/.*profiles/);
    await expect(page.getByRole('heading', { name: /profile/i })).toBeVisible();
  });

  test('create new profile', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    await page.goto(`/profiles?w=${apiSetup.workspaceId}`);
    
    // 1. Open creation modal
    const newBtn = page.getByRole('button', { name: /new/i }).first();
    await expect(newBtn).toBeVisible({ timeout: 15000 });
    await newBtn.click();
    
    // 2. Fill title and submit (scope to modal-panel to avoid overlay intercept)
    const modal = page.locator('.modal-panel');
    await expect(modal).toBeVisible({ timeout: 15000 });
    const titleInput = modal.locator('input').first();
    await expect(titleInput).toBeVisible({ timeout: 15000 });
    const profileTitle = `E2E Created Profile ${Date.now()}`;
    await titleInput.fill(profileTitle);
    
    const createBtn = modal.getByRole('button', { name: 'Create Document' });
    await expect(createBtn).toBeEnabled({ timeout: 15000 });
    await createBtn.click();
    
    // 3. Verify in editor and after reload
    await expect(page.getByText(profileTitle).first()).toBeVisible({ timeout: 15000 });
    await page.reload();
    await expect(page.getByText(profileTitle).first()).toBeVisible({ timeout: 15000 });
  });

  test('delete profile', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const title = `E2E Delete Profile ${Date.now()}`;
    await apiSetup.createProfile({ title });
    
    await page.goto(`/profiles?w=${apiSetup.workspaceId}`);
    const row = page.locator('table tr', { hasText: title }).first();
    await expect(row).toBeVisible({ timeout: 15000 });
    
    // 1. Click delete action button
    const deleteBtn = row.locator('button[title="Delete document"]');
    await expect(deleteBtn).toBeVisible({ timeout: 15000 });
    await deleteBtn.click();

    // 2. React ConfirmModal appears — confirm deletion
    const modal = page.getByRole('dialog').first();
    await expect(modal).toBeVisible({ timeout: 15000 });
    await expect(modal.getByRole('heading', { name: /Delete Document/i })).toBeVisible();
    
    const confirmBtn = modal.getByRole('button', { name: 'Delete', exact: true });
    await expect(confirmBtn).toBeVisible({ timeout: 15000 });
    await confirmBtn.click();

    // 3. Immediate UI removal assertion
    await expect(page.locator('table tr', { hasText: title })).not.toBeVisible({ timeout: 15000 });

    // 4. F5 Reload Persistence Verification
    await page.reload();
    await expect(page.locator('table tr', { hasText: title })).not.toBeVisible({ timeout: 15000 });
  });
});
