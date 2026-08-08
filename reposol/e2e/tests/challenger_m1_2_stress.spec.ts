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

    await page.goto(`/catalog/${catalogUuid}?edit=true`);
    await expect(page.getByTestId('mode-edit-btn')).toBeVisible({ timeout: 20000 });

    // Select withdrawn control ac-2
    const control2Item = page.locator('[data-dnd-id="ac-2"]');
    await expect(control2Item).toBeVisible({ timeout: 20000 });
    await control2Item.click();

    // Verify withdrawal banner is present
    const withdrawalBanner = page.getByText(/Control Withdrawn: This control is deprecated./i);
    await expect(withdrawalBanner).toBeVisible({ timeout: 20000 });

    // Click the replacement link "ac-1" inside the withdrawal banner
    const replacementLink = withdrawalBanner.locator('strong', { hasText: 'ac-1' });
    await expect(replacementLink).toBeVisible({ timeout: 20000 });
    await replacementLink.click();

    // EMPIRICAL VERIFICATION:
    // When ac-1 replacement link is clicked, the UI must navigate to Control ac-1 Detail View!
    // It must NOT switch to Document Overview or display null selection.
    // Check that control header or breadcrumb displays control ac-1 title explicitly.
    const controlHeader = page.locator('.control-detail-view .header-card');
    await expect(controlHeader).toBeVisible({ timeout: 10000 });
    await expect(controlHeader).toContainText('Access Control Policy and Procedures');
    await expect(controlHeader).toContainText('ac-1');
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

    await page.goto(`/catalog/${catalogUuid}?edit=true`);
    await expect(page.getByTestId('mode-edit-btn')).toBeVisible({ timeout: 20000 });

    const control2Item = page.locator('[data-dnd-id="ac-2"]');
    await expect(control2Item).toBeVisible({ timeout: 20000 });
    await control2Item.click();

    const withdrawalBanner = page.getByText(/Control Withdrawn/i);
    await expect(withdrawalBanner).toBeVisible({ timeout: 20000 });

    const brokenLink = withdrawalBanner.locator('strong', { hasText: 'ac-non-existent-999' });
    await expect(brokenLink).toBeVisible({ timeout: 20000 });
    await brokenLink.click();

    // Verify UI does not crash or throw uncaught React exception
    await expect(page.locator('.catalog-viewer')).toBeVisible({ timeout: 10000 });
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

    await page.goto(`/catalog/${catalogUuid}?edit=true`);
    await expect(page.getByTestId('mode-edit-btn')).toBeVisible({ timeout: 20000 });

    const control2Item = page.locator('[data-dnd-id="ac-2"]');
    await expect(control2Item).toBeVisible({ timeout: 20000 });
    await control2Item.click();

    // Register dialog listener for restore confirmation
    page.on('dialog', async (dialog) => {
      await dialog.accept();
    });

    const restoreBtn = page.getByRole('button', { name: /Restore Control/i });
    await expect(restoreBtn).toBeVisible({ timeout: 20000 });
    await restoreBtn.click();

    // Verify withdrawal banner is removed
    await expect(page.getByText(/Control Withdrawn: This control is deprecated./i)).toHaveCount(0, { timeout: 15000 });

    // Verify "Withdraw Control" button returns to original state
    await expect(page.getByRole('button', { name: /Withdraw Control/i })).toBeVisible({ timeout: 15000 });
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

    await page.goto('/catalogs');
    await expect(page.locator('.documents-table')).toBeVisible({ timeout: 20000 });
    await expect(page.getByText(catTitle)).toBeVisible({ timeout: 20000 });

    let dialogCount = 0;
    const dialogTexts: string[] = [];

    page.on('dialog', async (dialog) => {
      dialogCount++;
      dialogTexts.push(dialog.message());
      if (dialogCount === 1) {
        await dialog.accept();
      } else {
        await dialog.dismiss();
      }
    });

    const catRow = page.locator('.documents-table tr', { hasText: catTitle });
    const deleteBtn = catRow.locator('.btn-delete');
    await expect(deleteBtn).toBeVisible({ timeout: 20000 });
    await deleteBtn.click();

    await expect.poll(() => dialogCount, { timeout: 20000 }).toBe(2);
    expect(dialogTexts[0]).toContain('Delete this document?');
    expect(dialogTexts[1]).toContain('force delete');

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

    await page.goto('/catalogs');
    await expect(page.locator('.documents-table')).toBeVisible({ timeout: 20000 });
    await expect(page.getByText(catTitle)).toBeVisible({ timeout: 20000 });

    let dialogCount = 0;
    const dialogTexts: string[] = [];

    page.on('dialog', async (dialog) => {
      dialogCount++;
      dialogTexts.push(dialog.message());
      await dialog.accept();
    });

    const catRow = page.locator('.documents-table tr', { hasText: catTitle });
    const deleteBtn = catRow.locator('.btn-delete');
    await expect(deleteBtn).toBeVisible({ timeout: 20000 });
    await deleteBtn.click();

    await expect.poll(() => dialogCount, { timeout: 20000 }).toBe(2);

    // Verify 409 error dialog detail mentions the referencing profile
    expect(dialogTexts[1]).toContain(`DependentProfile-${profUuid.substring(0, 8)}`);

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
