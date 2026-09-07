import { test, expect } from '../fixtures/base';

test.describe('M3 Gate 6 — Empirical Stress & Challenge Suite', () => {

  test('Empirical Challenge 1: 409 Force Delete Handling Workflow', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();

    // Create a catalog
    const catUuid = await apiSetup.createCatalog({
      title: 'Target Catalog for 409 Delete Test',
      controls: [{ id: 'ac-1', title: 'Access Control Policy' }]
    });

    // Create a profile referencing the catalog
    const profUuid = await apiSetup.createProfile({
      title: 'Dependent Profile for 409 Test',
      catalogUuid: catUuid
    });

    // Navigate to DocumentListPage for catalogs
    await page.goto(`/catalogs?w=${apiSetup.workspaceId}`);
    await expect(page.locator('table')).toBeVisible();

    // Find the row for catUuid
    const catalogRow = page.locator('tr', { hasText: catUuid.substring(0, 8) });
    await expect(catalogRow).toBeVisible();

    // Click delete button on the catalog row
    const deleteBtn = catalogRow.locator('button[title="Delete document"]');
    await deleteBtn.click();

    // First React ConfirmModal: "Delete Document" confirmation
    const firstModal = page.getByRole('dialog').first();
    await expect(firstModal).toBeVisible({ timeout: 10000 });
    await expect(firstModal.getByRole('heading', { name: /Delete Document/i })).toBeVisible();
    await firstModal.getByRole('button', { name: 'Delete', exact: true }).click();

    // Second React ConfirmModal: "Reference Conflict (409)" with Force Delete
    const secondModal = page.getByRole('dialog').first();
    await expect(secondModal).toBeVisible({ timeout: 10000 });
    await expect(secondModal.getByText(/referenced by other documents|Force delete/i).first()).toBeVisible({ timeout: 5000 });
    await secondModal.getByRole('button', { name: /Force Delete/i }).click();

    // Wait for the deletion to complete and row to be removed
    await expect(catalogRow).not.toBeVisible({ timeout: 10000 });

    // Verify catalog is deleted from backend
    let fetchError = false;
    try {
      await apiSetup.getDocument('catalogs', catUuid);
    } catch {
      fetchError = true;
    }
    expect(fetchError).toBe(true);
  });

  test('Empirical Challenge 3: Control Withdrawal Banner & Replacement Link Navigation & Reinstatement', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();

    // Create a catalog with a withdrawn control ac-1 replaced by ac-2
    const catUuid = await apiSetup.createCatalog({
      title: 'Control Withdrawal Test Catalog',
      controls: [
        {
          id: 'ac-1',
          title: 'Deprecated Control AC-1',
          props: [{ name: 'status', value: 'withdrawn' }],
          links: [{ rel: 'incorporated-into', href: '#ac-2' }]
        },
        {
          id: 'ac-2',
          title: 'Replacement Control AC-2'
        }
      ]
    });

    await page.goto(`/catalogs/${catUuid}?edit=true&w=${apiSetup.workspaceId}`);
    await expect(page.locator('[class*="catalog-main-content"], body').first()).toBeVisible();
    
    // Select control ac-1 in tree/sidebar using data-testid
    const nodeAc1 = page.locator('[data-testid="tree-node-ac-1"]');
    await expect(nodeAc1).toBeVisible({ timeout: 10000 });
    await nodeAc1.click();

    // Verify Withdrawal Banner appears
    const banner = page.locator('[data-testid="withdrawal-banner"]');
    await expect(banner).toBeVisible({ timeout: 10000 });
    await expect(banner).toContainText('Control Withdrawn');
    await expect(banner).toContainText('ac-2');

    // Click replacement link (strong text containing ac-2)
    const replacementLink = banner.locator('strong', { hasText: 'ac-2' });
    await expect(replacementLink).toBeVisible();
    await replacementLink.click();

    // Verify tree node ac-2 is selected after clicking replacement link
    const nodeAc2 = page.locator('[data-testid="tree-node-ac-2"]');
    await expect(nodeAc2).toHaveClass(/selected/);

    // Click back to ac-1 and test Restore Control button
    await nodeAc1.click();
    await expect(banner).toBeVisible();

    // Restore uses React ConfirmProvider instead of window.confirm
    const restoreBtn = banner.locator('button.btn-restore-control');
    await expect(restoreBtn).toBeVisible();
    await restoreBtn.click();

    // Handle the confirm dialog if it appears as a React modal
    const confirmDialog = page.getByRole('dialog').first();
    if (await confirmDialog.isVisible({ timeout: 3000 }).catch(() => false)) {
      const confirmBtn = confirmDialog.getByRole('button', { name: /Confirm|Restore|Yes|OK/i }).first();
      if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmBtn.click();
      }
    }

    // Verify withdrawal banner disappears after restoration
    await expect(banner).not.toBeVisible({ timeout: 10000 });
  });

  test('Empirical Challenge 4: Cross-View State Synchronization & Invalidation', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();

    const catUuid = await apiSetup.createCatalog({
      title: 'State Sync Test Catalog',
      controls: [{ id: 'ac-1', title: 'Sync Control' }]
    });

    await page.goto(`/catalogs?w=${apiSetup.workspaceId}`);
    await expect(page.locator('tr', { hasText: 'State Sync Test Catalog' })).toBeVisible();

    // Open view in catalog editor mode
    await page.goto(`/catalogs/${catUuid}?edit=true&w=${apiSetup.workspaceId}`);
    await expect(page.locator('[class*="document-toolbar"], body').first()).toBeVisible();

    // Navigate back to list and delete via list
    await page.goto(`/catalogs?w=${apiSetup.workspaceId}`);
    const row = page.locator('tr', { hasText: 'State Sync Test Catalog' });
    await expect(row).toBeVisible();

    const deleteBtn = row.locator('button[title="Delete document"]');
    await deleteBtn.click();

    // Handle React ConfirmModal for delete
    const modal = page.getByRole('dialog').first();
    await expect(modal).toBeVisible({ timeout: 10000 });
    await modal.getByRole('button', { name: /Delete/i }).first().click();

    // Verify list updates immediately and removes deleted catalog from view
    await expect(row).not.toBeVisible({ timeout: 10000 });
  });

});
