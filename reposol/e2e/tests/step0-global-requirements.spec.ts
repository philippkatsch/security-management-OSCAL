import { test, expect } from '../fixtures/base';
import { randomUUID } from 'node:crypto';

test.describe('Step 0 - Global System Requirements', () => {

  test('Document Lifecycle Status Badges render correctly across status configurations', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();

    const draftUuid = randomUUID();
    const activeUuid = randomUUID();
    const archivedUuid = randomUUID();
    const supersededUuid = randomUUID();

    // 1. Create documents with explicit lifecycle statuses
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

    // 2. Open Draft Catalog and assert status indicator badge
    await page.goto(`/catalog/${draftUuid}`);
    await expect(page.locator('.status-badge', { hasText: 'Draft' })).toBeVisible();

    // 3. Open Active Catalog and assert status indicator badge
    await page.goto(`/catalog/${activeUuid}`);
    await expect(page.locator('.status-badge', { hasText: 'Active' })).toBeVisible();

    // 4. Open Archived Catalog and assert status indicator badge
    await page.goto(`/catalog/${archivedUuid}`);
    await expect(page.locator('.status-badge', { hasText: 'Archived' })).toBeVisible();

    // 5. Open Superseded Catalog and assert status indicator badge
    await page.goto(`/catalog/${supersededUuid}`);
    await expect(page.locator('.status-badge', { hasText: 'Superseded' })).toBeVisible();
  });

  test('Archival Filter & Workspace Read-Only State', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();

    const activeUuid = randomUUID();
    const archivedUuid = randomUUID();

    // 1. Create active catalog and archived catalog
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

    // 2. Navigate to Catalogs table
    await page.goto('/catalogs');
    await expect(page.getByText(`Active Test Catalog ${activeUuid.substring(0, 8)}`)).toBeVisible();

    // 3. Navigate directly to archived document view and verify read-only banner
    await page.goto(`/catalog/${archivedUuid}`);
    const banner = page.locator('.lifecycle-banner.archived');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('This document is archived and read-only');
    await expect(banner.locator('.btn-reactivate')).toBeVisible();
  });

  test('Revision History Drawer & Publication Workflow', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const catalogUuid = randomUUID();
    const catalogTitle = `Versioning Catalog ${catalogUuid.substring(0, 8)}`;

    await apiSetup.createCatalog({
      uuid: catalogUuid,
      title: catalogTitle,
    });

    // 1. Open catalog in edit mode
    await page.goto(`/catalog/${catalogUuid}?edit=true`);
    await expect(page.getByTestId('mode-edit-btn')).toBeVisible({ timeout: 15000 });

    // 2. Open Version History drawer
    const versionBtn = page.getByTestId('version-history-btn');
    await expect(versionBtn).toBeVisible({ timeout: 15000 });
    await versionBtn.click();

    // 3. Assert drawer overlay panel is visible
    const drawerPanel = page.locator('.version-drawer-panel');
    await expect(drawerPanel).toBeVisible({ timeout: 15000 });

    // 4. Fill in version number and remarks
    const versionInput = page.getByPlaceholder('e.g. 1.0.1');
    await expect(versionInput).toBeVisible({ timeout: 15000 });
    await versionInput.fill('1.1.0');

    const remarksInput = page.getByPlaceholder('e.g. Initial release');
    await remarksInput.fill('Initial automated E2E release remarks');

    // 5. Submit publish version
    const publishBtn = page.getByRole('button', { name: /publish version/i });
    await publishBtn.click();

    // 6. Re-open Version History drawer
    await expect(versionBtn).toBeVisible({ timeout: 15000 });
    await versionBtn.click();
    await expect(drawerPanel).toBeVisible({ timeout: 15000 });

    // 7. Assert new version item card appears with v1.1.0 and Active badge
    await expect(drawerPanel.getByText('v1.1.0')).toBeVisible({ timeout: 15000 });
    await expect(drawerPanel.getByText('Active')).toBeVisible({ timeout: 15000 });

    // 8. Verify active version card does NOT have a delete button
    const activeCard = drawerPanel.locator('.version-item-card', { hasText: 'Active' });
    await expect(activeCard.locator('.btn-delete')).toHaveCount(0);

    // 9. Setup dialog listener to accept deletion confirmation for historical version 1.0.0
    page.on('dialog', async (dialog) => {
      await dialog.accept();
    });

    // 10. Delete historical version 1.0.0 card (unconditional assertion)
    const card100 = drawerPanel.locator('.version-item-card', { hasText: 'v1.0.0' });
    await expect(card100).toBeVisible({ timeout: 15000 });
    const deleteBtn = card100.locator('.btn-delete');
    await expect(deleteBtn).toBeVisible({ timeout: 15000 });
    await deleteBtn.click();
    await expect.poll(async () => await card100.count(), { timeout: 15000 }).toBe(0);
  });

  test('Traceability Panel Drill-Down & Cross-Stage Timeline', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const catalogUuid = randomUUID();
    const catalogTitle = `Traceability Catalog ${catalogUuid.substring(0, 8)}`;

    await apiSetup.createCatalog({
      uuid: catalogUuid,
      title: catalogTitle,
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

    // 1. Navigate to Traceability page
    await page.goto('/traceability');
    await expect(page.getByRole('heading', { name: /control traceability/i })).toBeVisible({ timeout: 15000 });

    // 2. Search for control ID "ac-1"
    const searchInput = page.getByPlaceholder('Enter Control ID (e.g., ac-1)');
    await searchInput.fill('ac-1');

    const traceBtn = page.getByRole('button', { name: 'Trace', exact: true });
    await traceBtn.click();

    // 3. Assert results section appears
    const resultsSection = page.locator('.traceability-results');
    await expect(resultsSection).toBeVisible({ timeout: 15000 });
    await expect(resultsSection.getByText('Results for "ac-1"')).toBeVisible({ timeout: 15000 });

    // 4. Test search for non-existent control ID
    await searchInput.fill('non-existent-control-99999');
    await traceBtn.click();
    await expect(page.getByText('No documents reference this control.')).toBeVisible({ timeout: 15000 });
  });

  test('Reference Integrity Warning Banners', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const profUuid = randomUUID();

    // Create a profile referencing a non-existent catalog UUID (broken import reference)
    await apiSetup.createProfile({
      uuid: profUuid,
      title: `Reference Test Profile ${profUuid.substring(0, 8)}`,
      imports: [{ href: '../catalogs/00000000-0000-4000-8000-000000009999.json', 'include-all': {} }]
    });

    // 1. Open profile page
    await page.goto(`/profile/${profUuid}`);

    // 2. Assert resolution error / reference warning banner is visible
    const warningElement = page.getByText(/Resolution Engine Error|Failed to fetch/i);
    await expect(warningElement).toBeVisible({ timeout: 20000 });
  });

  test('409 Force-Delete Modal (?force=true)', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const catUuid = randomUUID();
    const catTitle = `Cat-DeleteTarget-${catUuid.substring(0, 8)}`;
    const profUuid = randomUUID();

    // Step 1: Create base Catalog X
    await apiSetup.createCatalog({
      uuid: catUuid,
      title: catTitle
    });

    // Step 2: Create Profile Y referencing Catalog X (creating dependency)
    await apiSetup.createProfile({
      uuid: profUuid,
      title: `Prof-Dependent-${profUuid.substring(0, 8)}`,
      catalogUuid: catUuid
    });

    // Step 3: Navigate to Catalogs table
    await page.goto('/catalogs');
    await expect(page.locator('.documents-table')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(catTitle)).toBeVisible({ timeout: 15000 });

    // Step 4: Intercept dialogs for two-stage delete (1: initial confirm, 2: 409 force delete prompt)
    let dialogCount = 0;
    const dialogMessages: string[] = [];

    page.on('dialog', async (dialog) => {
      dialogCount++;
      dialogMessages.push(dialog.message());
      await dialog.accept();
    });

    // Step 5: Click delete button on Catalog X row
    const catRow = page.locator('.documents-table tr', { hasText: catTitle });
    const deleteBtn = catRow.locator('.btn-delete');
    await expect(deleteBtn).toBeVisible({ timeout: 15000 });
    await deleteBtn.click();

    // Step 6: Verify two dialogs were intercepted
    await expect.poll(() => dialogCount, { timeout: 15000 }).toBe(2);
    expect(dialogMessages[0]).toContain('Delete this document?');
    expect(dialogMessages[1]).toContain('force delete');

    // Step 7: Verify backend returns 404 for deleted catalog via API
    await expect.poll(async () => {
      try {
        await apiSetup.getDocument('catalogs', catUuid);
        return false;
      } catch {
        return true;
      }
    }, { timeout: 15000 }).toBe(true);
  });

});
