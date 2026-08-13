import { test, expect } from '../fixtures/base';
import { ApiSetup } from '../helpers/api-setup';
import { randomUUID } from 'node:crypto';

test.describe('Challenger M3 Gate 10 Empirical Challenge Suite', () => {

  // ---------------------------------------------------------------------------
  // CHALLENGE 1: Fallback Profile Resolution & Reference Cascades
  // ---------------------------------------------------------------------------
  test('Challenge 1.1: ApiSetup auto-creates missing explicit profile/ssp/ap/ar referenced documents', async ({ page }) => {
    const apiSetup = new ApiSetup(page);
    await apiSetup.syncWorkspace();

    const explicitProfId = randomUUID();
    const explicitCompDefId = randomUUID();
    const explicitSspId = randomUUID();
    const explicitApId = randomUUID();
    const explicitArId = randomUUID();

    // 1. Create SSP referencing non-existent explicit profile & compDef
    const sspId = await apiSetup.createSsp(explicitProfId, explicitCompDefId);
    expect(sspId).toBeTruthy();

    // Verify profile and compDef were auto-created in database & workspace
    const profDoc = await apiSetup.getDocument('profile', explicitProfId);
    expect(profDoc.profile.uuid).toBe(explicitProfId);

    const compDoc = await apiSetup.getDocument('component-definitions', explicitCompDefId);
    expect(compDoc['component-definition'].uuid).toBe(explicitCompDefId);

    // 2. Create AP referencing non-existent explicit SSP
    const apId = await apiSetup.createAssessmentPlan(explicitSspId);
    const sspDoc = await apiSetup.getDocument('ssps', explicitSspId);
    expect(sspDoc['system-security-plan'].uuid).toBe(explicitSspId);

    // 3. Create AR referencing non-existent explicit AP
    const arId = await apiSetup.createAssessmentResults(explicitApId);
    const apDoc = await apiSetup.getDocument('assessment-plan', explicitApId);
    expect(apDoc['assessment-plan'].uuid).toBe(explicitApId);

    // 4. Create POA&M referencing non-existent explicit SSP & AR
    const explicitSspId2 = randomUUID();
    const explicitArId2 = randomUUID();
    const poamId = await apiSetup.createPoam(explicitSspId2, explicitArId2);
    expect(poamId).toBeTruthy();

    const ssp2Doc = await apiSetup.getDocument('ssps', explicitSspId2);
    expect(ssp2Doc['system-security-plan'].uuid).toBe(explicitSspId2);

    const ar2Doc = await apiSetup.getDocument('assessment-results', explicitArId2);
    expect(ar2Doc['assessment-results'].uuid).toBe(explicitArId2);

    await apiSetup.cleanup();
  });

  test('Challenge 1.2: Calling createSsp/createAp with already-existing profile/ssp IDs reuses existing documents without duplicate creation errors', async ({ page }) => {
    const apiSetup = new ApiSetup(page);
    await apiSetup.syncWorkspace();

    const existingProfId = await apiSetup.createProfile({ title: 'Pre-existing Profile' });
    const sspId1 = await apiSetup.createSsp(existingProfId);
    const sspId2 = await apiSetup.createSsp(existingProfId);

    expect(sspId1).toBeTruthy();
    expect(sspId2).toBeTruthy();

    const ssp1Doc = await apiSetup.getDocument('ssps', sspId1);
    const ssp2Doc = await apiSetup.getDocument('ssps', sspId2);

    expect(ssp1Doc['system-security-plan']['import-profile'].href).toBe(`../profiles/${existingProfId}.json`);
    expect(ssp2Doc['system-security-plan']['import-profile'].href).toBe(`../profiles/${existingProfId}.json`);

    await apiSetup.cleanup();
  });

  // ---------------------------------------------------------------------------
  // CHALLENGE 2: Ungrouped Controls Tree Locators in UI
  // ---------------------------------------------------------------------------
  test('Challenge 2.1: Ungrouped / standalone root-level controls exhibit both data-testid and data-dnd-id attributes', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const catalogUuid = randomUUID();

    await apiSetup.createCatalog({
      uuid: catalogUuid,
      title: `Ungrouped Controls Catalog ${catalogUuid.substring(0, 8)}`,
      groups: [
        {
          id: 'g1',
          title: 'Group 1',
          controls: [
            { id: 'ac-1.1', title: 'Grouped Control 1.1' }
          ]
        }
      ],
      controls: [
        { id: 'ac-1', title: 'Root Ungrouped Control 1' },
        { id: 'ac-2', title: 'Root Ungrouped Control 2' }
      ]
    });

    await page.goto(`/catalogs/${catalogUuid}?edit=true&w=${apiSetup.workspaceId}`);
    await expect(page.getByTestId('mode-edit-btn')).toBeVisible({ timeout: 20000 });

    // Verify root ungrouped control ac-1 has BOTH data-testid and data-dnd-id
    const rootControl1TestId = page.locator('[data-testid="tree-node-ac-1"]');
    const rootControl1DndId = page.locator('[data-dnd-id="ac-1"]');

    await expect(rootControl1TestId).toBeVisible({ timeout: 10000 });
    await expect(rootControl1DndId).toBeVisible({ timeout: 10000 });
    expect(await rootControl1TestId.getAttribute('data-dnd-id')).toBe('ac-1');

    // Verify root ungrouped control ac-2 has BOTH data-testid and data-dnd-id
    const rootControl2TestId = page.locator('[data-testid="tree-node-ac-2"]');
    const rootControl2DndId = page.locator('[data-dnd-id="ac-2"]');

    await expect(rootControl2TestId).toBeVisible({ timeout: 10000 });
    await expect(rootControl2DndId).toBeVisible({ timeout: 10000 });
    expect(await rootControl2TestId.getAttribute('data-dnd-id')).toBe('ac-2');

    // Verify grouped control ac-1.1 also has BOTH attributes
    const group1Node = page.locator('[data-testid="tree-node-g1"], [data-dnd-id="g1"]').first();
    await expect(group1Node).toBeVisible({ timeout: 10000 });
    await group1Node.click();

    const groupedControlTestId = page.locator('[data-testid="tree-node-ac-1.1"]');
    await expect(groupedControlTestId).toBeVisible({ timeout: 10000 });
    expect(await groupedControlTestId.getAttribute('data-dnd-id')).toBe('ac-1.1');
  });

  // ---------------------------------------------------------------------------
  // CHALLENGE 3: Dialog Counting & Deterministic 409 Confirm Handling
  // ---------------------------------------------------------------------------
  test('Challenge 3.1: Confirm vs Alert dialog filtering prevents dialog count inflation during 409 deletion', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const catUuid = randomUUID();
    const catTitle = `CatDialogTest-${catUuid.substring(0, 8)}`;
    const profUuid = randomUUID();

    await apiSetup.createCatalog({
      uuid: catUuid,
      title: catTitle
    });

    await apiSetup.createProfile({
      uuid: profUuid,
      title: `ReferencingProf-${profUuid.substring(0, 8)}`,
      catalogUuid: catUuid
    });

    await page.goto(`/catalogs?w=${apiSetup.workspaceId}`);
    await expect(page.locator('table')).toBeVisible({ timeout: 20000 });
    await expect(page.getByText(catTitle)).toBeVisible({ timeout: 20000 });

    let confirmCount = 0;
    let alertCount = 0;

    page.on('dialog', async (dialog) => {
      if (dialog.type() === 'confirm') {
        confirmCount++;
      } else {
        alertCount++;
      }
      await dialog.accept();
    });

    const catRow = page.locator('table tr', { hasText: catTitle });
    const deleteBtn = catRow.locator('button[title="Delete document"]');
    await expect(deleteBtn).toBeVisible({ timeout: 20000 });
    await deleteBtn.click();

    // Confirm dialog count must reach exactly 2 regardless of how many alert dialogs fire
    await expect.poll(() => confirmCount, { timeout: 20000 }).toBe(2);

    // Document should be deleted
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
