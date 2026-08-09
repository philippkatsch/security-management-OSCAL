import { test, expect } from '../fixtures/base';
import { randomUUID } from 'crypto';

test.describe('Unified VersionDropdown & Single Active Draft Lifecycle', () => {
  let catalogUuid: string;
  let catalogTitle: string;

  test.beforeEach(async ({ apiSetup }) => {
    await apiSetup.syncWorkspace();
    catalogUuid = randomUUID();
    catalogTitle = `E2E Draft Test Catalog ${catalogUuid.substring(0, 8)}`;

    await apiSetup.createCatalog({
      uuid: catalogUuid,
      title: catalogTitle,
      version: '1.0.0',
    });
  });

  test('1. Edit Mode locks VersionDropdown to Draft (editing)', async ({ page }) => {
    await page.goto(`/catalog/${catalogUuid}?edit=true`);
    await expect(page.getByTestId('mode-edit-btn')).toBeVisible({ timeout: 20000 });

    const toggle = page.getByTestId('version-dropdown-toggle');
    await expect(toggle).toBeVisible({ timeout: 15000 });
    await expect(toggle).toContainText('Draft (editing)');

    // Attempt to click locked dropdown — menu should remain hidden
    await toggle.click({ force: true });
    await expect(page.locator('.version-dropdown-menu')).toBeHidden();
  });

  test('2. Back button in Edit Mode prompts confirmation and handles draft save vs discard', async ({ page }) => {
    // A. Test OK choice (Save draft & exit)
    await page.goto(`/catalog/${catalogUuid}?edit=true`);
    await expect(page.getByTestId('mode-edit-btn')).toBeVisible({ timeout: 20000 });

    // Set dialog handler to accept (click OK = save draft)
    const saveDialogHandler = async (dialog: any) => {
      expect(dialog.message()).toContain('You have unsaved changes');
      await dialog.accept();
    };
    page.once('dialog', saveDialogHandler);

    await page.getByTestId('back-btn').click();
    // Navigates away to catalog list view
    await expect(page.locator('.stage-header')).toBeVisible({ timeout: 20000 });

    // Re-open catalog in View mode: draft exists on server
    await page.goto(`/catalog/${catalogUuid}`);
    const toggle = page.getByTestId('version-dropdown-toggle');
    await expect(toggle).toBeVisible({ timeout: 15000 });
    await expect(toggle).toContainText('Draft');

    // B. Test Cancel choice (Discard draft & exit)
    await page.goto(`/catalog/${catalogUuid}?edit=true`);
    await expect(page.getByTestId('mode-edit-btn')).toBeVisible({ timeout: 20000 });

    // Set dialog handler to dismiss (click Cancel = discard draft)
    const discardDialogHandler = async (dialog: any) => {
      expect(dialog.message()).toContain('You have unsaved changes');
      await dialog.dismiss();
    };
    page.once('dialog', discardDialogHandler);

    await page.getByTestId('back-btn').click();
    await expect(page.locator('.stage-header')).toBeVisible({ timeout: 20000 });

    // Re-open catalog in View mode: draft was discarded, shows v1.0.0
    await page.goto(`/catalog/${catalogUuid}`);
    await expect(page.getByTestId('version-dropdown-toggle')).toContainText('v1.0.0');
  });

  test('3. Delete Draft removes draft file and hides Publish button', async ({ page }) => {
    // Enter edit mode to create a draft, then switch to view mode
    await page.goto(`/catalog/${catalogUuid}?edit=true`);
    await expect(page.getByTestId('mode-edit-btn')).toBeVisible({ timeout: 20000 });

    await page.getByTestId('mode-view-btn').click();
    await expect(page.getByTestId('version-dropdown-toggle')).toContainText('Draft');

    // Open VersionDropdown in View mode
    const toggle = page.getByTestId('version-dropdown-toggle');
    await toggle.click();
    const dropdownMenu = page.locator('.version-dropdown-menu');
    await expect(dropdownMenu).toBeVisible();

    // Verify Draft item & Publish New Version button are visible
    await expect(dropdownMenu.locator('.version-dropdown-item--draft')).toBeVisible();
    const publishBtn = page.getByRole('button', { name: /Publish New Version/i });
    await expect(publishBtn).toBeVisible();

    // Setup dialog listener for Delete Draft confirmation
    const deleteDialogHandler = async (dialog: any) => {
      expect(dialog.message()).toContain('delete the active draft');
      await dialog.accept();
    };
    page.once('dialog', deleteDialogHandler);

    // Click Delete Draft
    await page.getByRole('button', { name: /Delete Draft/i }).click();

    // Revert to v1.0.0
    await expect(page.getByTestId('version-dropdown-toggle')).toContainText('v1.0.0');

    // Re-open dropdown: Draft item and Publish button should be gone
    await page.getByTestId('version-dropdown-toggle').click();
    await expect(dropdownMenu.locator('.version-dropdown-item--draft')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Publish New Version/i })).toHaveCount(0);
  });

  test('4. Publishing a new version transforms draft into permanent release v1.1.0', async ({ page }) => {
    // Create draft
    await page.goto(`/catalog/${catalogUuid}?edit=true`);
    await expect(page.getByTestId('mode-edit-btn')).toBeVisible({ timeout: 20000 });
    await page.getByTestId('mode-view-btn').click();

    // Open dropdown and click Publish New Version
    await page.getByTestId('version-dropdown-toggle').click();
    await page.getByRole('button', { name: /Publish New Version/i }).click();

    // VersionDrawer modal opens
    const versionInput = page.getByPlaceholder('e.g. 1.0.1');
    await expect(versionInput).toBeVisible({ timeout: 15000 });
    await versionInput.fill('1.1.0');

    const remarksInput = page.getByPlaceholder('e.g. Initial release');
    await remarksInput.fill('E2E Published Version 1.1.0');

    await page.locator('.version-drawer-panel').getByRole('button', { name: /Publish Version/i }).click();

    // Verify active version is now v1.1.0
    await expect(page.getByTestId('version-dropdown-toggle')).toContainText('v1.1.0');
  });
});
