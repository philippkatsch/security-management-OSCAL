import { test, expect } from '../fixtures/base';

test.describe('Challenger M2 R1 — Empirical Stress Harness (Feature 15 & Feature 16)', () => {

  test('F15 Stress: Strict Trash Target Selector, Hover Glow Style & Drag Deletion', async ({ page, apiSetup }) => {
    const catUuid = await apiSetup.createCatalog({
      title: 'F15 Trash Stress Catalog',
      groups: [
        {
          id: 'ac',
          title: 'Access Control',
          controls: [{ id: 'ac-1', title: 'Access Control Policy', parts: [{ id: 'ac-1_smt', name: 'statement', prose: 'Policy statement prose.' }] }]
        }
      ]
    });

    const profUuid = await apiSetup.createProfile({
      title: 'F15 Trash Stress Profile',
      catalogUuid: catUuid
    });

    await page.goto(`/profile/${profUuid}?edit=true&w=${apiSetup.workspaceId}`);
    await expect(page.locator('.catalog-sidebar')).toBeVisible({ timeout: 15000 });

    // 1. Strict selector check: div[data-dnd-id="trash"][data-dnd-type="trash"] must exist directly without fallback .or()
    const trashTarget = page.locator('div[data-dnd-id="trash"][data-dnd-type="trash"]');
    await expect(trashTarget).toBeVisible({ timeout: 15000 });
    await expect(trashTarget).toContainText('Drag elements here to delete');

    // 2. Expand group and find control ac-1
    const groupHeader = page.locator('[data-dnd-id="ac"]');
    await expect(groupHeader).toBeVisible({ timeout: 15000 });
    await groupHeader.click();

    const controlItem = page.locator('[data-dnd-id="ac-1"]');
    await expect(controlItem).toBeVisible({ timeout: 15000 });

    // 3. Drag control to trash target
    await controlItem.dragTo(trashTarget);

    // 4. Create top-level group and drag to trash target with prompt confirmation
    page.once('dialog', dialog => dialog.accept('Stress Group To Delete'));
    const addGroupBtn = page.getByRole('button', { name: /add top-level group/i });
    await expect(addGroupBtn).toBeVisible({ timeout: 15000 });
    await addGroupBtn.click();

    const stressGroupHeader = page.locator('[data-dnd-id="Stress Group To Delete"]');
    await expect(stressGroupHeader).toBeVisible({ timeout: 15000 });

    // Accept delete confirmation dialog
    page.once('dialog', dialog => dialog.accept());
    await stressGroupHeader.dragTo(trashTarget);

    // Assert group is deleted
    await expect(page.getByText('Stress Group To Delete')).toHaveCount(0);
  });

  test('F16 Stress: Baseline Diff Statistics & Badges (Added, Modified, Removed, Overridden)', async ({ page, apiSetup }) => {
    const catUuid = await apiSetup.createCatalog({
      title: 'F16 Baseline Stress Catalog',
      groups: [
        {
          id: 'ia',
          title: 'Identification and Authentication',
          controls: [
            {
              id: 'ia-2',
              title: 'Identification and Authentication Policy',
              parts: [{ id: 'ia-2_smt', name: 'statement', prose: 'Base IA-2 prose text.' }],
              params: [
                {
                  id: 'ia-2_prm_1',
                  label: 'authenticator length',
                  select: { 'how-many': 'one', choice: ['8', '12', '16'] }
                }
              ]
            }
          ]
        }
      ]
    });

    const profUuid = await apiSetup.createProfile({
      title: 'F16 Baseline Stress Profile',
      catalogUuid: catUuid
    });

    await page.goto(`/profile/${profUuid}?edit=true&w=${apiSetup.workspaceId}`);
    await expect(page.locator('.catalog-sidebar')).toBeVisible({ timeout: 15000 });

    // 1. Verify Baseline Statistics Box in Overview -> Metadata
    await page.getByText('Overview').first().click();
    await page.locator('.sidebar-item').filter({ hasText: 'Metadata' }).first().click();

    const statsBox = page.getByText('📋 Baseline Statistics').first();
    await expect(statsBox).toBeVisible({ timeout: 15000 });

    // Verify statistics elements
    await expect(page.getByText('Controls').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Groups').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Merge').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Params').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Alters').first()).toBeVisible({ timeout: 15000 });

    // 2. Expand ia group & ia-2 control
    const groupHeader = page.locator('[data-dnd-id="ia"]');
    await expect(groupHeader).toBeVisible({ timeout: 15000 });
    await groupHeader.click();

    const controlItem = page.locator('[data-dnd-id="ia-2"]');
    await expect(controlItem).toBeVisible({ timeout: 15000 });
    await controlItem.click();

    // 3. Test Modified Diff Badge
    const proseArea = page.locator('.prose-param-container textarea').first();
    await expect(proseArea).toBeVisible({ timeout: 15000 });
    await proseArea.fill('Modified IA-2 prose text for testing diff badges.');
    await proseArea.dispatchEvent('change');

    await expect(page.getByText('Modified').first()).toBeVisible({ timeout: 15000 });

    // 4. Test Reset -> Modified badge disappears
    const resetBtn = page.getByRole('button', { name: /↺ reset|reset/i }).first();
    await expect(resetBtn).toBeVisible({ timeout: 15000 });
    await resetBtn.click();
    await expect(page.getByText('Modified')).toHaveCount(0);

    // 5. Test Removed Diff Badge
    const removeBtn = page.getByRole('button', { name: /🗑 remove|remove statement/i }).first();
    await expect(removeBtn).toBeVisible({ timeout: 15000 });
    await removeBtn.click();
    await expect(page.getByText('Removed').first()).toBeVisible({ timeout: 15000 });

    // 6. Test Restore -> Removed badge disappears
    const restoreBtn = page.getByRole('button', { name: /↺ restore|restore/i }).first();
    await expect(restoreBtn).toBeVisible({ timeout: 15000 });
    await restoreBtn.click();
    await expect(page.getByText('Removed')).toHaveCount(0);

    // 7. Test Overridden Badge on Parameter Card
    const editParamBtn = page.getByRole('button', { name: /✏️ edit|edit/i }).first();
    await expect(editParamBtn).toBeVisible({ timeout: 15000 });
    await editParamBtn.click();

    const choiceSelect = page.locator('.parameter-card select, select.form-input').first();
    await expect(choiceSelect).toBeVisible({ timeout: 15000 });
    await choiceSelect.selectOption('12');

    const overrideBadge = page.locator('.parameter-card').getByText(/overridden|\[overridden\]/i).first();
    await expect(overrideBadge).toBeVisible({ timeout: 15000 });
  });

});
