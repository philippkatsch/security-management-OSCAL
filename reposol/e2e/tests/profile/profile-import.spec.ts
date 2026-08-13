import { test, expect } from '../../fixtures/base';

test.describe('Profile Import', () => {
  test('import catalog into profile shows controls', async ({ page, apiSetup }) => {
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
    
    await page.goto(`/profiles/${profUuid}?w=${apiSetup.workspaceId}`);
    
    const groupNode = page.locator('[data-testid="tree-node-ac"], [data-testid^="tree-node-"]').first();
    await expect(groupNode).toBeVisible({ timeout: 15000 });
    await groupNode.click();
    const controlItem = page.getByText('Policy and Procedures').first();
    if (!await controlItem.isVisible()) {
      await groupNode.locator('span').first().click();
    }
    await expect(controlItem).toBeVisible({ timeout: 15000 });
  });
});
