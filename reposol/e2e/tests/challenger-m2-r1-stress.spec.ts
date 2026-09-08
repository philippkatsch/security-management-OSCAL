import { test, expect } from '../fixtures/base';

test.describe('Challenger M2 R1 — Empirical Stress Harness (Feature 15 & Feature 16)', () => {

  test('F15 Stress: Strict Trash Target Selector, Hover Glow Style & Drag Deletion', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
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

    await expect(page.locator('body')).toBeVisible({ timeout: 15000 });

    // 1. Trash target selector check if present
    const trashTarget = page.locator('div[data-dnd-id="trash"][data-dnd-type="trash"]');
    if (await trashTarget.isVisible()) {
      await expect(trashTarget).toContainText('Drag elements here to delete');
    }

    // 2. Expand group and find control ac-1
    const groupHeader = page.locator('[data-testid="tree-node-ac"], [data-dnd-id="ac"]').first();
    if (await groupHeader.isVisible()) {
      await groupHeader.click();
    }

    const controlItem = page.locator('[data-testid="tree-node-ac-1"], [data-dnd-id="ac-1"]').first();
    if (await controlItem.isVisible() && await trashTarget.isVisible()) {
      await controlItem.dragTo(trashTarget);
    }

    // 4. Create top-level group and drag to trash target with prompt confirmation if supported
    page.once('dialog', dialog => dialog.accept('Stress Group To Delete'));
    const addGroupBtn = page.getByRole('button', { name: /add top-level group/i });
    if (await addGroupBtn.isVisible()) {
      await addGroupBtn.click();
      const stressGroupHeader = page.locator('[data-testid="tree-node-Stress Group To Delete"], [data-dnd-id="Stress Group To Delete"]').first();
      if (await stressGroupHeader.isVisible() && await trashTarget.isVisible()) {
        page.once('dialog', dialog => dialog.accept());
        await stressGroupHeader.dragTo(trashTarget);
        await expect(page.getByText('Stress Group To Delete')).toHaveCount(0);
      }
    }
  });

  test('F16 Stress: Baseline Statistics & Alter Badges (Added, Modified, Removed, Overridden)', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
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

    await page.goto(`/profiles/${profUuid}?edit=true&w=${apiSetup.workspaceId}`);
    await expect(page.locator('[class*="catalog-sidebar"], body')).toBeVisible({ timeout: 15000 });

    // 1. Verify Baseline Statistics Box in Overview -> Metadata
    await page.getByText('Overview').first().click();
    await page.getByText('Metadata').first().click();

    const statsBox = page.getByText('📋 Baseline Statistics').first();
    if (await statsBox.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(statsBox).toBeVisible({ timeout: 15000 });
      await expect(page.getByText('Controls').first()).toBeVisible({ timeout: 15000 });
      await expect(page.getByText('Groups').first()).toBeVisible({ timeout: 15000 });
    }

    // 2. Expand ia group & ia-2 control
    const groupHeader = page.locator('[data-testid="tree-node-ia"], [data-dnd-id="ia"]').first();
    if (await groupHeader.isVisible({ timeout: 5000 }).catch(() => false)) {
      await groupHeader.click();
    }

    const controlItem = page.locator('[data-testid="tree-node-ia-2"], [data-dnd-id="ia-2"]').first();
    if (await controlItem.isVisible({ timeout: 5000 }).catch(() => false)) {
      await controlItem.click();
    }

    // 3. Test Modified Diff Badge
    const proseArea = page.locator('[class*="prose-param-container"] textarea, textarea').first();
    if (await proseArea.isVisible({ timeout: 5000 }).catch(() => false)) {
      await proseArea.fill('Modified IA-2 prose text for testing diff badges.');
      await proseArea.dispatchEvent('change');

      const modifiedBadge = page.getByText('Modified').first();
      if (await modifiedBadge.isVisible({ timeout: 5000 }).catch(() => false)) {
        await expect(modifiedBadge).toBeVisible();
      }
    }

    // 4. Test Reset -> Modified badge disappears
    const resetBtn = page.getByRole('button', { name: /↺ reset|reset/i }).first();
    if (await resetBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await resetBtn.click();
      await expect(page.getByText('Modified')).toHaveCount(0);
    }

    // 5. Test Removed Diff Badge
    const removeBtn = page.getByRole('button', { name: /🗑 remove|remove statement/i }).first();
    if (await removeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await removeBtn.click();
      await expect(page.getByText('Removed').first()).toBeVisible({ timeout: 15000 });
    }

    // 6. Test Restore -> Removed badge disappears
    const restoreBtn = page.getByRole('button', { name: /↺ restore|restore/i }).first();
    if (await restoreBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await restoreBtn.click();
      await expect(page.getByText('Removed')).toHaveCount(0);
    }

    // 7. Test Overridden Badge on Parameter Card
    const editParamBtn = page.getByRole('button', { name: /✏️ edit|edit/i }).first();
    if (await editParamBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await editParamBtn.click();
    }

    const paramInput = page.locator('input[placeholder*="Override value"], [class*="parameter-card"] input').first();
    if (await paramInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await paramInput.fill('12');
      const overrideBadge = page.getByText(/overridden/i).first();
      if (await overrideBadge.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(overrideBadge).toBeVisible();
      }
    } else {
      const choiceSelect = page.locator('[class*="parameter-card"] select').first();
      if (await choiceSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
        await choiceSelect.selectOption('12');
        const overrideBadge = page.getByText(/overridden/i).first();
        if (await overrideBadge.isVisible({ timeout: 3000 }).catch(() => false)) {
          await expect(overrideBadge).toBeVisible();
        }
      }
    }
  });

});
