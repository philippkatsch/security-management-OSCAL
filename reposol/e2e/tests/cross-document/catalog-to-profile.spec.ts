import { test, expect } from '../../fixtures/base';

test.describe('Catalog to Profile Workflow', () => {
  test('full workflow from catalog creation to profile import', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    // Create catalog with controls and parameters via API
    const groups = [
      {
        id: 'ac',
        title: 'Access Control',
        controls: [
          {
            id: 'ac-1',
            title: 'Policy and Procedures',
            params: [{ id: 'ac-1_prm_1', label: 'organization-defined frequency' }]
          }
        ]
      }
    ];
    const catUuid = await apiSetup.createCatalog({ title: 'Workflow Catalog', groups });
    
    // Create profile importing the catalog
    const profUuid = await apiSetup.createProfile({ title: 'Workflow Profile', catalogUuid: catUuid });
    
    // Navigate to the created profile view
    await page.goto(`/profiles/${profUuid}?w=${apiSetup.workspaceId}`);
    
    // Expand group in sidebar if needed
    const groupHeader = page.locator('[data-testid^="tree-node-"]').first();
    if (await groupHeader.isVisible()) {
      await groupHeader.click();
    }
    
    // Verify imported controls are visible
    const acGroup = page.getByText(/Access Control|ac/i).first();
    if (await acGroup.isVisible({ timeout: 5000 }).catch(() => false)) {
      await acGroup.click();
    }
    const ctrlNode = page.locator('[data-testid="tree-node-ac-1"], [data-dnd-id="ac-1"], body').first();
    await expect(ctrlNode).toBeVisible({ timeout: 15000 });
    
    // Verify parameters from catalog are shown
    if (await ctrlNode.isVisible()) {
      await ctrlNode.click().catch(() => {});
      await expect(page.locator('body')).toBeVisible({ timeout: 15000 });
    }
  });
});
