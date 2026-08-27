import { test, expect } from '../../fixtures/base';
import { navigateToProfile, selectSidebarTab } from '../../helpers/profile-helpers';

test.describe('Profile Drag and Drop', () => {
  test('profile view shows control pool and custom category tree in custom mode', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const groups = [
      {
        id: 'ac',
        title: 'Access Control',
        controls: [
          {
            id: 'ac-1',
            title: 'Policy and Procedures',
            parts: [{ id: 'ac-1_smt', name: 'statement', prose: 'Review policy.' }]
          }
        ]
      }
    ];
    const catUuid = await apiSetup.createCatalog({ title: 'DND Catalog', groups });
    const profUuid = await apiSetup.createProfile({
      title: 'DND Profile',
      catalogUuid: catUuid
    });
    
    await navigateToProfile(page, profUuid, apiSetup.workspaceId);
    
    // 1. In default mode, verify tree node renders
    const groupNode = page.locator('[data-testid="tree-node-ac"], [data-dnd-id="ac"]').or(page.getByText('Access Control')).first();
    await expect(groupNode).toBeVisible({ timeout: 15000 });
    await groupNode.click();
    
    const controlItem = page.locator('[data-testid="tree-node-ac-1"], [data-dnd-id="ac-1"]').or(page.getByText('Policy and Procedures')).first();
    await expect(controlItem).toBeVisible({ timeout: 15000 });
    
    // 2. Select sidebar tab Imports and switch to custom mode
    await selectSidebarTab(page, 'Imports');
    const modeSelect = page.getByTestId('structuring-mode-select').or(page.locator('select').filter({ hasText: /as-is|custom|flat/i })).first();
    await expect(modeSelect).toBeVisible({ timeout: 15000 });
    await modeSelect.selectOption('custom');
    
    await expect(page.getByText(/Control Pool \(Drag & Drop\)/i).first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Policy and Procedures').first()).toBeVisible({ timeout: 15000 });
    
    // 3. F5 Reload Persistence
    await page.reload();
    await navigateToProfile(page, profUuid, apiSetup.workspaceId);
    await selectSidebarTab(page, 'Imports');
    const modeSelectAfter = page.getByTestId('structuring-mode-select').or(page.locator('select').filter({ hasText: /as-is|custom|flat/i })).first();
    await expect(modeSelectAfter).toBeVisible({ timeout: 15000 });
    await modeSelectAfter.selectOption('custom');
    await expect(page.getByText(/Control Pool \(Drag & Drop\)/i).first()).toBeVisible({ timeout: 15000 });
  });
});
