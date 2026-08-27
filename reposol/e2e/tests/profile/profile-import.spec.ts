import { test, expect } from '../../fixtures/base';
import { navigateToProfile } from '../../helpers/profile-helpers';

test.describe('Profile Import', () => {
  test('import catalog into profile shows resolved controls in tree', async ({ page, apiSetup }) => {
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
    const catUuid = await apiSetup.createCatalog({ title: 'Import Catalog', groups });
    
    const profUuid = await apiSetup.createProfile({
      title: 'Import Profile',
      catalogUuid: catUuid
    });
    
    await navigateToProfile(page, profUuid, apiSetup.workspaceId);
    
    // 1. Expand Access Control family
    const groupNode = page.locator('[data-testid="tree-node-ac"], [data-dnd-id="ac"]').or(page.getByText('Access Control')).first();
    await expect(groupNode).toBeVisible({ timeout: 15000 });
    await groupNode.click();
    
    // 2. Control item is visible
    const controlItem = page.locator('[data-testid="tree-node-ac-1"], [data-dnd-id="ac-1"]').or(page.getByText('Policy and Procedures')).first();
    await expect(controlItem).toBeVisible({ timeout: 15000 });
    await controlItem.click();
    
    // 3. Prose statement is displayed
    await expect(page.getByText('Review policy.').first()).toBeVisible({ timeout: 15000 });
    
    // 4. F5 Reload Persistence
    await page.reload();
    await navigateToProfile(page, profUuid, apiSetup.workspaceId);
    await groupNode.click();
    await expect(controlItem).toBeVisible({ timeout: 15000 });
  });
});
