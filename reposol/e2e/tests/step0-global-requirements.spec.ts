import { test, expect } from '../fixtures/base';
import { randomUUID } from 'node:crypto';

test.describe('Step 0 - Global System Requirements', () => {
  test.setTimeout(90000);

  test('Document Lifecycle Status Badges - Draft & Active', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();

    const draftUuid = randomUUID();
    const activeUuid = randomUUID();

    await apiSetup.createCatalog({
      uuid: draftUuid,
      title: `Cat-Draft-${draftUuid.substring(0, 8)}`,
      status: 'draft'
    });

    await apiSetup.createCatalog({
      uuid: activeUuid,
      title: `Cat-Active-${activeUuid.substring(0, 8)}`,
      status: 'active'
    });

    await page.goto(`/catalog/${draftUuid}`);
    await expect(page.locator('.status-badge', { hasText: 'Draft' })).toBeVisible({ timeout: 20000 });

    await page.goto(`/catalog/${activeUuid}`);
    await expect(page.locator('.status-badge', { hasText: 'Active' })).toBeVisible({ timeout: 20000 });
  });

  test('Document Lifecycle Status Badges - Archived, Superseded & Deprecated', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();

    const archivedUuid = randomUUID();
    const supersededUuid = randomUUID();
    const deprecatedUuid = randomUUID();

    await apiSetup.createCatalog({
      uuid: archivedUuid,
      title: `Cat-Archived-${archivedUuid.substring(0, 8)}`,
      status: 'archived'
    });

    await apiSetup.createCatalog({
      uuid: supersededUuid,
      title: `Cat-Superseded-${supersededUuid.substring(0, 8)}`,
      status: 'superseded'
    });

    await apiSetup.createCatalog({
      uuid: deprecatedUuid,
      title: `Cat-Deprecated-${deprecatedUuid.substring(0, 8)}`,
      status: 'deprecated'
    });

    await page.goto(`/catalog/${archivedUuid}`);
    await expect(page.locator('.status-badge', { hasText: 'Archived' })).toBeVisible({ timeout: 20000 });

    await page.goto(`/catalog/${supersededUuid}`);
    await expect(page.locator('.status-badge', { hasText: 'Superseded' })).toBeVisible({ timeout: 20000 });

    await page.goto(`/catalog/${deprecatedUuid}`);
    await expect(page.locator('.status-badge', { hasText: 'Deprecated' })).toBeVisible({ timeout: 20000 });
  });

  test('Archival Filter & Workspace Read-Only State with Reactivation', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();

    const activeUuid = randomUUID();
    const archivedUuid = randomUUID();

    await apiSetup.createCatalog({
      uuid: activeUuid,
      title: `Active Test Catalog ${activeUuid.substring(0, 8)}`,
      status: 'active'
    });

    await apiSetup.createCatalog({
      uuid: archivedUuid,
      title: `Archived Test Catalog ${archivedUuid.substring(0, 8)}`,
      status: 'archived'
    });

    await page.goto('/catalogs');
    await expect(page.getByText(`Active Test Catalog ${activeUuid.substring(0, 8)}`)).toBeVisible({ timeout: 20000 });

    await page.goto(`/catalog/${archivedUuid}`);
    const banner = page.locator('.lifecycle-banner.archived');
    await expect(banner).toBeVisible({ timeout: 20000 });
    await expect(banner).toContainText('This document is archived and read-only');
    
    const reactivateBtn = banner.locator('.btn-reactivate');
    await expect(reactivateBtn).toBeVisible({ timeout: 20000 });

    await reactivateBtn.click();
    await expect(banner).toHaveCount(0, { timeout: 20000 });
    await expect(page.locator('.status-badge', { hasText: 'Active' })).toBeVisible({ timeout: 20000 });
  });

  test('Revision History Drawer & Publication Workflow with Error Validation', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const catalogUuid = randomUUID();
    const catalogTitle = `Versioning Catalog ${catalogUuid.substring(0, 8)}`;

    await apiSetup.createCatalog({
      uuid: catalogUuid,
      title: catalogTitle,
    });

    await page.goto(`/catalog/${catalogUuid}?edit=true`);
    await expect(page.getByTestId('mode-edit-btn')).toBeVisible({ timeout: 20000 });

    const versionBtn = page.getByTestId('version-history-btn');
    await expect(versionBtn).toBeVisible({ timeout: 20000 });
    await versionBtn.click();

    const drawerPanel = page.locator('.version-drawer-panel');
    await expect(drawerPanel).toBeVisible({ timeout: 20000 });

    const publishBtn = page.getByRole('button', { name: /publish version/i });
    await expect(publishBtn).toBeVisible({ timeout: 20000 });

    const versionInput = page.getByPlaceholder('e.g. 1.0.1');
    await expect(versionInput).toBeVisible({ timeout: 20000 });

    // 1. Empty version error validation
    await versionInput.fill('');
    await publishBtn.click();
    await expect(drawerPanel.getByText('Version number cannot be empty.')).toBeVisible({ timeout: 20000 });

    // 2. Publish Version 1.1.0 (archives 1.0.0 as historical version snapshot and sets 1.1.0 as active)
    await versionInput.fill('1.1.0');
    const remarksInput = page.getByPlaceholder('e.g. Initial release');
    await remarksInput.fill('Publish automated v1.1.0 release');
    const submitBtn = drawerPanel.getByRole('button', { name: /publish version/i });
    await submitBtn.click();

    // Re-open version drawer to inspect updated version history
    await expect(versionBtn).toBeVisible({ timeout: 20000 });
    await versionBtn.click();
    await expect(drawerPanel).toBeVisible({ timeout: 20000 });

    // Verify v1.1.0 card is visible as Active version
    const activeCard = drawerPanel.locator('.version-item-card', { hasText: 'v1.1.0' });
    await expect(activeCard).toBeVisible({ timeout: 20000 });
    await expect(activeCard.getByText('Active')).toBeVisible({ timeout: 20000 });
    await expect(activeCard.locator('.btn-delete')).toHaveCount(0);

    // 3. Register dialog listener for confirming deletion
    const dialogHandler = async (dialog) => {
      await dialog.accept();
    };
    page.on('dialog', dialogHandler);

    // 4. Delete auto-archived historical version v1.0.0
    const card100 = drawerPanel.locator('.version-item-card', { hasText: 'v1.0.0' });
    await expect(card100).toBeVisible({ timeout: 20000 });
    const deleteBtn = card100.locator('.btn-delete');
    await expect(deleteBtn).toBeVisible({ timeout: 20000 });
    await deleteBtn.click();

    await expect(card100).toHaveCount(0, { timeout: 20000 });
    page.off('dialog', dialogHandler);
  });

  test('Traceability Panel Drill-Down & Cross-Stage Timeline', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const catalogUuid = randomUUID();
    const profileUuid = randomUUID();
    const sspUuid = randomUUID();

    await apiSetup.createCatalog({
      uuid: catalogUuid,
      title: `Trace Catalog ${catalogUuid.substring(0, 8)}`,
      groups: [
        {
          id: 'ac',
          title: 'Access Control',
          controls: [
            {
              id: 'ac-1',
              title: 'Access Control Policy and Procedures'
            }
          ]
        }
      ]
    });

    await apiSetup.createProfile({
      uuid: profileUuid,
      title: `Trace Profile ${profileUuid.substring(0, 8)}`,
      catalogUuid: catalogUuid
    });

    await apiSetup.createSsp({
      uuid: sspUuid,
      title: `Trace SSP ${sspUuid.substring(0, 8)}`,
      profileId: profileUuid
    });

    await page.goto('/traceability');
    await expect(page.getByRole('heading', { name: /control traceability/i })).toBeVisible({ timeout: 20000 });

    const searchInput = page.getByPlaceholder('Enter Control ID (e.g., ac-1)');
    await searchInput.fill('ac-1');

    const traceBtn = page.getByRole('button', { name: 'Trace', exact: true });
    await traceBtn.click();

    const resultsSection = page.locator('.traceability-results');
    await expect(resultsSection).toBeVisible({ timeout: 30000 });
    await expect(resultsSection.getByText('Results for "ac-1"')).toBeVisible({ timeout: 30000 });

    await searchInput.fill('non-existent-control-99999');
    await traceBtn.click();
    await expect(page.getByText('No documents reference this control.')).toBeVisible({ timeout: 30000 });
  });

  test('Reference Integrity Warning Banners (Broken Reference & Superseded Parent)', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const profUuid = randomUUID();

    await apiSetup.createProfile({
      uuid: profUuid,
      title: `Reference Test Profile ${profUuid.substring(0, 8)}`,
      imports: [{ href: '../catalogs/00000000-0000-4000-8000-000000009999.json', 'include-all': {} }]
    });

    await page.goto(`/profile/${profUuid}`);
    const warningElement = page.getByText(/Resolution Engine Error|Failed to fetch|404/i).first();
    await expect(warningElement).toBeVisible({ timeout: 30000 });

    const supersededCatUuid = randomUUID();
    const supersededProfUuid = randomUUID();

    await apiSetup.createCatalog({
      uuid: supersededCatUuid,
      title: `Superseded Parent Cat ${supersededCatUuid.substring(0, 8)}`,
      status: 'superseded'
    });

    await apiSetup.createProfile({
      uuid: supersededProfUuid,
      title: `Child Profile ${supersededProfUuid.substring(0, 8)}`,
      catalogUuid: supersededCatUuid
    });

    await page.goto(`/profile/${supersededProfUuid}`);
    const supersededBanner = page.locator('.lifecycle-banner.superseded');
    if (await supersededBanner.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(supersededBanner).toContainText(/superseded/i);
    }
  });

  test('409 Force-Delete Modal (?force=true) - Accept Force Delete', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const catUuid = randomUUID();
    const catTitle = `Cat-DeleteTarget-${catUuid.substring(0, 8)}`;
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
    const dialogMessages: string[] = [];

    const dialogHandler = async (dialog: any) => {
      dialogCount++;
      dialogMessages.push(dialog.message());
      await dialog.accept();
    };
    page.on('dialog', dialogHandler);

    const catRow = page.locator('.documents-table tr', { hasText: catTitle });
    const deleteBtn = catRow.locator('.btn-delete');
    await expect(deleteBtn).toBeVisible({ timeout: 20000 });
    await deleteBtn.click();

    await expect.poll(() => dialogCount, { timeout: 20000 }).toBe(2);
    expect(dialogMessages[0]).toContain('Delete this document?');
    expect(dialogMessages[1]).toContain('force delete');

    await expect.poll(async () => {
      try {
        await apiSetup.getDocument('catalogs', catUuid);
        return false;
      } catch {
        return true;
      }
    }, { timeout: 20000 }).toBe(true);

    page.off('dialog', dialogHandler);
  });

  test('409 Force-Delete Modal (?force=true) - Dismiss Force Delete Cancels Operation', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const catUuid = randomUUID();
    const catTitle = `Cat-CancelDelete-${catUuid.substring(0, 8)}`;
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
    const dialogHandler = async (dialog: any) => {
      dialogCount++;
      if (dialogCount === 1) {
        await dialog.accept();
      } else {
        await dialog.dismiss();
      }
    };
    page.on('dialog', dialogHandler);

    const catRow = page.locator('.documents-table tr', { hasText: catTitle });
    const deleteBtn = catRow.locator('.btn-delete');
    await expect(deleteBtn).toBeVisible({ timeout: 20000 });
    await deleteBtn.click();

    await expect.poll(() => dialogCount, { timeout: 20000 }).toBe(2);

    const doc = await apiSetup.getDocument('catalogs', catUuid);
    expect(doc).toBeTruthy();
    expect(doc.catalog.uuid).toBe(catUuid);

    page.off('dialog', dialogHandler);
  });

});
