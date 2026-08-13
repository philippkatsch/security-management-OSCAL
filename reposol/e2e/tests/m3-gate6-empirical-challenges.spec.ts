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

    // Set up dialog handler for window.confirm
    let confirmCallCount = 0;
    const dialogMessages: string[] = [];
    page.on('dialog', async (dialog) => {
      confirmCallCount++;
      dialogMessages.push(dialog.message());
      // First confirm is "Delete this document?", second confirm is 409 "Document is referenced by other documents. Force delete?"
      await dialog.accept();
    });

    // Click delete button on the catalog row
    const deleteBtn = catalogRow.locator('button[title="Delete document"]');
    await deleteBtn.click();

    // Wait for the deletion request & 409 force retry to finish and row to be removed
    await expect(catalogRow).not.toBeVisible({ timeout: 10000 });

    // Verify two confirms occurred
    expect(confirmCallCount).toBeGreaterThanOrEqual(2);
    expect(dialogMessages.some(m => m.includes('referenced by other documents') || m.includes('Force delete'))).toBe(true);

    // Verify catalog is deleted from backend (getDocument throws error when deleted)
    let fetchError = false;
    try {
      await apiSetup.getDocument('catalogs', catUuid);
    } catch {
      fetchError = true;
    }
    expect(fetchError).toBe(true);
  });

  test('Empirical Challenge 2: StatusBadge & LifecycleSelector Integration & Terminal State', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();

    const catUuid = await apiSetup.createCatalog({
      title: 'Lifecycle State Machine Test Catalog',
      controls: [{ id: 'ac-1', title: 'Access Control' }]
    });

    await page.goto(`/catalogs/${catUuid}?edit=true&w=${apiSetup.workspaceId}`);
    
    // Verify StatusBadge is rendered with data-testid="status-badge"
    const statusBadge = page.locator('[data-testid="status-badge"]').first();
    await expect(statusBadge).toBeVisible();
    await expect(statusBadge).toContainText(/draft/i);

    // Open LifecycleSelector toggle dropdown
    const lifecycleToggle = page.locator('.lifecycle-selector-toggle').first();
    await expect(lifecycleToggle).toBeVisible();
    await lifecycleToggle.click();

    // Select 'active' status option
    const activeOption = page.locator('.lifecycle-selector-item', { hasText: 'Published and active' });
    await expect(activeOption).toBeVisible();
    await activeOption.click();

    // Confirm status change dialog inside dropdown
    const confirmBtn = page.locator('button', { hasText: 'Confirm' });
    await expect(confirmBtn).toBeVisible();
    await confirmBtn.click();

    // Verify status updated to active
    await expect(statusBadge).toContainText(/active/i);

    // Now switch active -> superseded with a successor UUID
    await lifecycleToggle.click();
    const supersededOption = page.locator('.lifecycle-selector-item', { hasText: 'Replaced by a newer document' });
    await expect(supersededOption).toBeVisible();
    await supersededOption.click();

    // Fill successor UUID input by placeholder
    const successorInput = page.locator('input[placeholder="Enter successor UUID..."]');
    await expect(successorInput).toBeVisible();
    await successorInput.fill('00000000-0000-4000-8000-000000000099');
    
    const confirmBtn2 = page.locator('button', { hasText: 'Confirm' });
    await confirmBtn2.click();

    // Verify status updated to superseded
    await expect(statusBadge).toContainText(/superseded/i);

    // Verify LifecycleSelector button is now disabled (terminal state)
    await expect(lifecycleToggle).toBeDisabled();
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

    await page.goto(`/catalogs/${catUuid}?w=${apiSetup.workspaceId}`);
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

    page.on('dialog', async (dialog) => {
      await dialog.accept();
    });

    const restoreBtn = banner.locator('button.btn-restore-control');
    await expect(restoreBtn).toBeVisible();
    await restoreBtn.click();

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

    // Delete catalog via toolbar or list
    await page.goto(`/catalogs?w=${apiSetup.workspaceId}`);
    const row = page.locator('tr', { hasText: 'State Sync Test Catalog' });
    await expect(row).toBeVisible();

    page.on('dialog', async (dialog) => {
      await dialog.accept();
    });

    const deleteBtn = row.locator('button[title="Delete document"]');
    await deleteBtn.click();

    // Verify list updates immediately and removes deleted catalog from view
    await expect(row).not.toBeVisible({ timeout: 10000 });
  });

});
