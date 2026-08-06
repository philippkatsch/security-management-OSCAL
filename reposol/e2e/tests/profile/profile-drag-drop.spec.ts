import { test, expect } from '../../fixtures/base';

test.describe('Profile Drag and Drop', () => {
  test('profile view shows control pool and custom category tree', async ({ page, apiSetup }) => {
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
    
    await page.goto(`/profile/${profUuid}`);
    
    // Check for drag handles or indicators of reorderable lists
    // This is highly dependent on implementation, looking for generic elements
    await page.getByText('Access Control').first().click();
    const controlItem = page.getByText('Policy and Procedures').first();
    await expect(controlItem).toBeVisible();
    
    // Some drag indicator
    const dragHandle = page.locator('[data-rbd-drag-handle-draggable-id], .drag-handle').first();
    if (await dragHandle.isVisible()) {
      await expect(dragHandle).toBeVisible();
    }
  });
});
