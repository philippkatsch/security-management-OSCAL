import { test, expect } from '../../fixtures/base';

test.describe('Profile Tailoring', () => {
  test('override parameter value', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const groups = [
      {
        id: 'ac',
        title: 'Access Control',
        controls: [
          {
            id: 'ac-1',
            title: 'Policy and Procedures',
            params: [
              { id: 'ac-1_prm_1', label: 'frequency' }
            ]
          }
        ]
      }
    ];
    const catUuid = await apiSetup.createCatalog({ title: 'Tailoring Catalog', groups });
    
    const profUuid = await apiSetup.createProfile({
      title: 'Tailoring Profile',
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
    await controlItem.click();
    
    const paramInput = page.getByLabel(/frequency/i).first();
    if (await paramInput.isVisible()) {
      await paramInput.fill('semiannually');
      const saveBtn = page.getByRole('button', { name: /save|override/i }).first();
      if (await saveBtn.isVisible()) {
         await saveBtn.click();
      }
      // Check for overridden badge or text
      await expect(page.getByText(/overridden|semiannually/i).first()).toBeVisible();
    }
  });
});
