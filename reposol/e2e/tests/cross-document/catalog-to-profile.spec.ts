import { test, expect } from '../../fixtures/base';
import { navigateToProfile } from '../../helpers/profile-helpers';

test.describe('Catalog to Profile Workflow', () => {
  test('full workflow from catalog creation to profile import and parameter inspection', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    
    // 1. Create catalog with controls and parameters via API
    const groups = [
      {
        id: 'ac',
        title: 'Access Control',
        controls: [
          {
            id: 'ac-1',
            title: 'Policy and Procedures',
            params: [{ id: 'ac-1_prm_1', label: 'organization-defined frequency', values: ['monthly'] }],
            parts: [{ id: 'ac-1_smt', name: 'statement', prose: 'Review access frequency at {{ insert: param, ac-1_prm_1 }}.' }]
          }
        ]
      }
    ];
    const catUuid = await apiSetup.createCatalog({ title: 'Workflow Catalog', groups });
    
    // 2. Create profile importing the catalog
    const profUuid = await apiSetup.createProfile({ title: 'Workflow Profile', catalogUuid: catUuid });
    
    // 3. Navigate to profile view
    await navigateToProfile(page, profUuid, apiSetup.workspaceId);
    await expect(page.getByText('Workflow Profile').first()).toBeVisible({ timeout: 15000 });
    
    // 4. Expand group and verify control
    const groupHeader = page.locator('[data-testid="tree-node-ac"], [data-dnd-id="ac"]').or(page.getByText('Access Control')).first();
    await expect(groupHeader).toBeVisible({ timeout: 15000 });
    await groupHeader.click();
    
    const ctrlNode = page.locator('[data-testid="tree-node-ac-1"], [data-dnd-id="ac-1"]').or(page.getByText('Policy and Procedures')).first();
    await expect(ctrlNode).toBeVisible({ timeout: 15000 });
    await ctrlNode.click();
    
    // 5. Verify statement prose and parameter chip are rendered
    await expect(page.getByText('Review access frequency at').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('monthly').first()).toBeVisible({ timeout: 15000 });
    
    // 6. F5 Reload Persistence
    await page.reload();
    await navigateToProfile(page, profUuid, apiSetup.workspaceId);
    await groupHeader.click();
    await ctrlNode.click();
    await expect(page.getByText('monthly').first()).toBeVisible({ timeout: 15000 });
  });
});
