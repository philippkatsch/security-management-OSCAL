import { test, expect } from '../../fixtures/base';

test.describe('Catalog to Profile Workflow', () => {
  test('full workflow from catalog creation to profile import', async ({ page, apiSetup }) => {
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
    await page.goto(`/profile/${profUuid}`);
    
    // Expand group in sidebar if needed
    const groupHeader = page.locator('.sidebar-item-group').first();
    if (await groupHeader.isVisible()) {
      await groupHeader.click();
    }
    
    // Verify imported controls are visible
    const acGroup = page.getByText('Access Control').first();
    await expect(acGroup).toBeVisible();
    await acGroup.click();
    await expect(page.getByText('Policy and Procedures').first()).toBeVisible();
    
    // Verify parameters from catalog are shown
    await page.getByText('Policy and Procedures').first().click();
    await expect(page.getByText('organization-defined frequency').first()).toBeVisible();
  });
});
