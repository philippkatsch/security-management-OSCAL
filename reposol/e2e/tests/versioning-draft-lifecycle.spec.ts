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

  test('1. Edit Mode locks VersionDropdown to Draft (editing)', async ({ page, apiSetup }) => {
    await page.goto(`/catalogs/${catalogUuid}?edit=true&w=${apiSetup.workspaceId}`);
    await expect(page.getByTestId('mode-edit-btn')).toBeVisible({ timeout: 20000 });

    const toggle = page.getByTestId('version-dropdown-toggle');
    await expect(toggle).toBeVisible({ timeout: 15000 });
    await expect(toggle).toContainText('Draft (editing)');

    // Attempt to click locked dropdown — menu should remain hidden
    await toggle.click({ force: true });
    await expect(page.locator('[class*="version-dropdown-menu"]')).toBeHidden();
  });

  test('2. Back button in Edit Mode: immediate exit when unmodified, prompts confirmation when modified', async ({ page, apiSetup }) => {
    // A. Clean exit without changes — should NOT prompt confirmation dialog
    await page.goto(`/catalogs/${catalogUuid}?edit=true&w=${apiSetup.workspaceId}`);
    await expect(page.getByTestId('mode-edit-btn')).toBeVisible({ timeout: 20000 });

    await page.getByTestId('back-btn').click();
    // Navigates away directly to catalog list view without modal
    await expect(page.getByRole('heading', { name: /catalog/i })).toBeVisible({ timeout: 20000 });

    // Re-open catalog in View mode: clean published v1.0.0
    await page.goto(`/catalogs/${catalogUuid}?w=${apiSetup.workspaceId}`);
    await expect(page.getByTestId('version-dropdown-toggle')).toContainText('v1.0.0');

    // B. Modified exit with Save Draft — prompts confirmation and saves draft
    await page.goto(`/catalogs/${catalogUuid}?edit=true&w=${apiSetup.workspaceId}`);
    await expect(page.getByTestId('mode-edit-btn')).toBeVisible({ timeout: 20000 });

    await page.getByTestId('catalog-sidebar-metadata').click();
    const titleInput = page.getByTestId('metadata-title-input');
    await titleInput.fill(`E2E Modified Title ${catalogUuid.substring(0, 4)}`);
    await page.waitForTimeout(400);

    await page.getByTestId('back-btn').click();
    // ConfirmModal appears
    const saveDraftBtn = page.getByRole('button', { name: 'Save Draft' });
    await expect(saveDraftBtn).toBeVisible({ timeout: 5000 });
    await saveDraftBtn.click();

    await expect(page.getByRole('heading', { name: /catalog/i })).toBeVisible({ timeout: 20000 });

    // Re-open catalog in View mode: draft exists on server
    await page.goto(`/catalogs/${catalogUuid}?w=${apiSetup.workspaceId}`);
    const toggle = page.getByTestId('version-dropdown-toggle');
    await expect(toggle).toBeVisible({ timeout: 15000 });
    await expect(toggle).toContainText('Draft');

    // C. Modified exit with Discard Changes — prompts confirmation and discards draft
    await page.goto(`/catalogs/${catalogUuid}?edit=true&w=${apiSetup.workspaceId}`);
    await expect(page.getByTestId('mode-edit-btn')).toBeVisible({ timeout: 20000 });

    await page.getByTestId('catalog-sidebar-metadata').click();
    const titleInput2 = page.getByTestId('metadata-title-input');
    await titleInput2.fill(`E2E Another Change ${catalogUuid.substring(0, 4)}`);
    await page.waitForTimeout(400);

    await page.getByTestId('back-btn').click();
    const discardBtn = page.getByRole('button', { name: 'Discard Changes' });
    await expect(discardBtn).toBeVisible({ timeout: 5000 });
    await discardBtn.click();

    await expect(page.getByRole('heading', { name: /catalog/i })).toBeVisible({ timeout: 20000 });

    // Re-open catalog in View mode: draft was discarded, shows v1.0.0
    await page.goto(`/catalogs/${catalogUuid}?w=${apiSetup.workspaceId}`);
    await expect(page.getByTestId('version-dropdown-toggle')).toContainText('v1.0.0');
  });

  test('3. Delete Draft removes draft file and hides Publish button', async ({ page, apiSetup }) => {
    // Enter edit mode to create a draft by making a change in Metadata
    await page.goto(`/catalogs/${catalogUuid}?edit=true&w=${apiSetup.workspaceId}`);
    await expect(page.getByTestId('mode-edit-btn')).toBeVisible({ timeout: 20000 });

    await page.getByTestId('catalog-sidebar-metadata').click();
    const titleInput = page.getByTestId('metadata-title-input');
    await titleInput.fill(`E2E Draft Test Catalog Modified ${catalogUuid.substring(0, 4)}`);
    await page.waitForTimeout(400);

    await page.getByTestId('mode-view-btn').click();
    await expect(page.getByTestId('version-dropdown-toggle')).toContainText('Draft');

    // Open VersionDropdown in View mode
    const toggle = page.getByTestId('version-dropdown-toggle');
    await toggle.click();
    const dropdownMenu = page.locator('[class*="version-dropdown-menu"]');
    await expect(dropdownMenu).toBeVisible();

    // Verify Draft item & Publish New Version button are visible
    await expect(dropdownMenu.locator('[class*="version-dropdown-item"]').first()).toBeVisible();
    const publishBtn = page.getByRole('button', { name: /Publish New Version/i });
    await expect(publishBtn).toBeVisible();

    // Click Delete Draft
    await page.getByRole('button', { name: /Delete Draft/i }).click();

    // Confirm in ConfirmModal
    const confirmDeleteBtn = page.getByRole('button', { name: 'Delete Draft' }).last();
    if (await confirmDeleteBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await confirmDeleteBtn.click();
    }

    // Revert to v1.0.0
    await expect(page.getByTestId('version-dropdown-toggle')).toContainText('v1.0.0');

    // Re-open dropdown: Draft item and Publish button should be gone
    await page.getByTestId('version-dropdown-toggle').click();
    await expect(dropdownMenu.locator('.version-dropdown-item--draft')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Publish New Version/i })).toHaveCount(0);
  });

  test('4. Publishing a new version transforms draft into permanent release v1.1.0', async ({ page, apiSetup }) => {
    // Create draft via edit mode by making a change in Metadata
    await page.goto(`/catalogs/${catalogUuid}?edit=true&w=${apiSetup.workspaceId}`);
    await expect(page.getByTestId('mode-edit-btn')).toBeVisible({ timeout: 20000 });

    await page.getByTestId('catalog-sidebar-metadata').click();
    const titleInput = page.getByTestId('metadata-title-input');
    await titleInput.fill(`E2E Draft Test Catalog Modified ${catalogUuid.substring(0, 4)}`);
    await page.waitForTimeout(400);

    await page.getByTestId('mode-view-btn').click();
    await expect(page.getByTestId('version-dropdown-toggle')).toContainText('Draft');

    // Open dropdown and click Publish New Version
    await page.getByTestId('version-dropdown-toggle').click();
    await page.getByRole('button', { name: /Publish New Version/i }).click();

    // VersionDrawer modal opens
    const versionInput = page.getByPlaceholder('e.g. 1.0.1');
    await expect(versionInput).toBeVisible({ timeout: 15000 });
    await versionInput.fill('1.1.0');

    const remarksInput = page.getByPlaceholder('What changed in this version?');
    await remarksInput.fill('E2E Published Version 1.1.0');

    await page.locator('[class*="version-drawer"]').getByRole('button', { name: /Publish Version/i }).click();

    // Verify active version is now v1.1.0
    await expect(page.getByTestId('version-dropdown-toggle')).toContainText('v1.1.0');
  });
});
