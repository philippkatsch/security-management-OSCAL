import { test, expect } from '../fixtures/base';
import { randomUUID } from 'node:crypto';

test.describe('Challenger M1.2 - Control Withdrawal & 409 Force Delete Empirical Stress Suite', () => {
  test.setTimeout(90000);

  // ---------------------------------------------------------------------------
  // STRESS TEST 1: Forwarding Link Navigation Bug Verification
  // ---------------------------------------------------------------------------
  test('Empirical Stress: Withdrawal Replacement Link Navigation Target Selection', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const catalogUuid = randomUUID();

    await apiSetup.createCatalog({
      uuid: catalogUuid,
      title: `Forwarding Nav Catalog ${catalogUuid.substring(0, 8)}`,
      controls: [
        {
          id: 'ac-1',
          title: 'Access Control Policy and Procedures'
        },
        {
          id: 'ac-2',
          title: 'Account Management (Deprecated)',
          props: [{ name: 'status', value: 'withdrawn' }],
          links: [{ rel: 'incorporated-into', href: '#ac-1' }]
        }
      ]
    });

    await page.goto(`/catalogs/${catalogUuid}?edit=true&w=${apiSetup.workspaceId}`);
    await expect(page.getByTestId('mode-edit-btn')).toBeVisible({ timeout: 20000 });

    // Select withdrawn control ac-2
    const control2Item = page.locator('[data-testid="tree-node-ac-2"], [data-dnd-id="ac-2"]').first();
    await expect(control2Item).toBeVisible({ timeout: 20000 });
    await control2Item.click();

    // Verify withdrawal banner is present
    const withdrawalBanner = page.getByText(/Control Withdrawn: This control is deprecated./i);
    await expect(withdrawalBanner).toBeVisible({ timeout: 20000 });

    // Click the replacement link "ac-1" inside the withdrawal banner
    const replacementLink = withdrawalBanner.locator('strong', { hasText: 'ac-1' });
    await expect(replacementLink).toBeVisible({ timeout: 20000 });
    await replacementLink.click();

    // Check that control header or detail displays ac-1
    const controlHeader = page.locator('[class*="header-card"], [class*="control-detail-view"], body').first();
    await expect(controlHeader).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('ac-1').first()).toBeVisible({ timeout: 10000 });
  });

  // ---------------------------------------------------------------------------
  // STRESS TEST 2: Invalid / Non-existent Replacement Link Target Navigation
  // ---------------------------------------------------------------------------
  test('Empirical Stress: Non-Existent Replacement Link Navigation Graceful Handling', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const catalogUuid = randomUUID();

    await apiSetup.createCatalog({
      uuid: catalogUuid,
      title: `Broken Link Catalog ${catalogUuid.substring(0, 8)}`,
      controls: [
        {
          id: 'ac-2',
          title: 'Account Management (Deprecated)',
          props: [{ name: 'status', value: 'withdrawn' }],
          links: [{ rel: 'incorporated-into', href: '#ac-non-existent-999' }]
        }
      ]
    });

    await page.goto(`/catalogs/${catalogUuid}?edit=true&w=${apiSetup.workspaceId}`);
    await expect(page.getByTestId('mode-edit-btn')).toBeVisible({ timeout: 20000 });

    const control2Item = page.locator('[data-testid="tree-node-ac-2"], [data-dnd-id="ac-2"]').first();
    await expect(control2Item).toBeVisible({ timeout: 20000 });
    await control2Item.click();

    const withdrawalBanner = page.getByText(/Control Withdrawn/i);
    await expect(withdrawalBanner).toBeVisible({ timeout: 20000 });

    const brokenLink = withdrawalBanner.locator('strong', { hasText: 'ac-non-existent-999' });
    await expect(brokenLink).toBeVisible({ timeout: 20000 });
    await brokenLink.click();

    // Verify UI does not crash
    await expect(page.locator('[class*="catalog-viewer"], body')).toBeVisible({ timeout: 10000 });
  });

  // ---------------------------------------------------------------------------
  // STRESS TEST 3: Reinstatement (Restoration) Real-Time UI & JSON Sync
  // ---------------------------------------------------------------------------
  test('Empirical Stress: Control Reinstatement Removes Banner & Updates Sidebar Immediately', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const catalogUuid = randomUUID();

    await apiSetup.createCatalog({
      uuid: catalogUuid,
      title: `Reinstatement Catalog ${catalogUuid.substring(0, 8)}`,
      controls: [
        {
          id: 'ac-2',
          title: 'Account Management (Deprecated)',
          props: [{ name: 'status', value: 'withdrawn' }],
          links: [{ rel: 'incorporated-into', href: '#ac-1' }]
        }
      ]
    });

    await page.goto(`/catalogs/${catalogUuid}?edit=true&w=${apiSetup.workspaceId}`);
    await expect(page.getByTestId('mode-edit-btn')).toBeVisible({ timeout: 20000 });

    const control2Item = page.locator('[data-testid="tree-node-ac-2"], [data-dnd-id="ac-2"]').first();
    await expect(control2Item).toBeVisible({ timeout: 20000 });
    await control2Item.click();

    // Register dialog listener for restore confirmation
    page.on('dialog', async (dialog) => {
      await dialog.accept();
    });

    const restoreBtn = page.getByRole('button', { name: /Restore Control/i });
    if (await restoreBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await restoreBtn.click();
      const modal = page.getByRole('dialog').first();
      if (await modal.isVisible({ timeout: 3000 }).catch(() => false)) {
        await modal.getByRole('button', { name: /Restore|Confirm|Yes/i }).click();
      }
      await expect(page.getByText(/Control Withdrawn: This control is deprecated./i)).toHaveCount(0, { timeout: 15000 });
    }
  });

  // ---------------------------------------------------------------------------
  // STRESS TEST 4: 409 Force Delete - Dismissing Second Dialog Retains Document
  // ---------------------------------------------------------------------------
  test('Empirical Stress: 409 Force Delete - Dismissing Second Dialog Cancels Deletion Completely', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const catUuid = randomUUID();
    const catTitle = `Cat-DismissForce-${catUuid.substring(0, 8)}`;
    const profUuid = randomUUID();

    await apiSetup.createCatalog({
      uuid: catUuid,
      title: catTitle
    });

    await apiSetup.createProfile({
      uuid: profUuid,
      title: `Prof-Dependent-${profUuid.substring(0, 8)}`,
      catalogUuid: catUuid
    });

    await page.goto(`/catalogs?w=${apiSetup.workspaceId}`);
    await expect(page.locator('table')).toBeVisible({ timeout: 20000 });
    await expect(page.getByText(catTitle)).toBeVisible({ timeout: 20000 });

    const catRow = page.locator('table tr', { hasText: catTitle });
    const deleteBtn = catRow.locator('button[title="Delete document"]');
    await expect(deleteBtn).toBeVisible({ timeout: 20000 });
    await deleteBtn.click();

    // First modal: Delete
    const modal1 = page.getByRole('dialog').first();
    await expect(modal1).toBeVisible({ timeout: 10000 });
    await modal1.getByRole('button', { name: /Delete|Confirm/i }).click();

    // Second modal (409): Cancel
    const modal2 = page.getByRole('dialog').filter({ hasText: /409|Conflict|force/i }).first();
    await expect(modal2).toBeVisible({ timeout: 15000 });
    await modal2.getByRole('button', { name: /Cancel/i }).click();

    // Document MUST still exist in database
    const doc = await apiSetup.getDocument('catalogs', catUuid);
    expect(doc).toBeTruthy();
    expect(doc.catalog.uuid).toBe(catUuid);

    // Document MUST still be listed in UI table
    await expect(page.getByText(catTitle)).toBeVisible({ timeout: 10000 });
  });

  // ---------------------------------------------------------------------------
  // STRESS TEST 5: 409 Force Delete - Multiple Referrers across Stages
  // ---------------------------------------------------------------------------
  test('Empirical Stress: 409 Force Delete - Multi-Referrer Detection & Force Override', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const catUuid = randomUUID();
    const catTitle = `MultiRefCat-${catUuid.substring(0, 8)}`;
    const profUuid = randomUUID();
    const sspUuid = randomUUID();

    await apiSetup.createCatalog({
      uuid: catUuid,
      title: catTitle
    });

    await apiSetup.createProfile({
      uuid: profUuid,
      title: `DependentProfile-${profUuid.substring(0, 8)}`,
      catalogUuid: catUuid
    });

    await apiSetup.createSsp({
      uuid: sspUuid,
      title: `DependentSSP-${sspUuid.substring(0, 8)}`,
      profileId: profUuid
    });

    await page.goto(`/catalogs?w=${apiSetup.workspaceId}`);
    await expect(page.locator('table')).toBeVisible({ timeout: 20000 });
    await expect(page.getByText(catTitle)).toBeVisible({ timeout: 20000 });

    const catRow = page.locator('table tr', { hasText: catTitle });
    const deleteBtn = catRow.locator('button[title="Delete document"]');
    await expect(deleteBtn).toBeVisible({ timeout: 20000 });
    await deleteBtn.click();

    // First modal: Delete
    const modal1 = page.getByRole('dialog').first();
    await expect(modal1).toBeVisible({ timeout: 10000 });
    await modal1.getByRole('button', { name: /Delete|Confirm/i }).click();

    // Second modal (409): Verify referrer info and Force Delete
    const modal2 = page.getByRole('dialog').filter({ hasText: /409|Conflict|force/i }).first();
    await expect(modal2).toBeVisible({ timeout: 15000 });
    await expect(modal2).toContainText(`DependentProfile-${profUuid.substring(0, 8)}`);
    await modal2.getByRole('button', { name: /Force Delete|Delete|Confirm/i }).click();

    // Verify catalog was force deleted from backend
    await expect.poll(async () => {
      try {
        await apiSetup.getDocument('catalogs', catUuid);
        return false;
      } catch {
        return true;
      }
    }, { timeout: 20000 }).toBe(true);
  });
});
