import { test, expect } from '../../fixtures/base';

test.describe('Profile Import', () => {
  test('import catalog into profile shows controls', async ({ page, apiSetup }) => {
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
    
    await page.goto(`/profile/${profUuid}`);
    
    await page.getByText('Access Control').first().click();
    await expect(page.getByText('Policy and Procedures').first()).toBeVisible();
  });
});
