import { test, expect } from '../../fixtures/base';

test.describe('Catalog Controls', () => {
  test('catalog controls are visible in control tree', async ({ page, apiSetup }) => {
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
    const uuid = await apiSetup.createCatalog({ title: 'Controls Catalog', groups });
    
    await page.goto(`/catalog/${uuid}`);
    
    await page.locator('.sidebar-item-group').filter({ hasText: 'Access Control' }).first().click();
    await expect(page.getByText('Policy and Procedures').first()).toBeVisible();
  });

  test('control detail view shows title and statement', async ({ page, apiSetup }) => {
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
    const uuid = await apiSetup.createCatalog({ title: 'Controls Detail Catalog', groups });
    
    await page.goto(`/catalog/${uuid}`);
    await page.locator('.sidebar-item-group').filter({ hasText: 'Access Control' }).first().click();
    await page.getByText('Policy and Procedures').first().click();
    
    await expect(page.getByRole('heading', { name: /Policy and Procedures/i }).first()).toBeVisible();
    await expect(page.getByText('Review policy.')).toBeVisible();
  });

  test('control enhancements are shown in accordion', async ({ page, apiSetup }) => {
    const groups = [
      {
        id: 'ac',
        title: 'Access Control',
        controls: [
          {
            id: 'ac-1',
            title: 'Policy and Procedures',
            parts: [{ id: 'ac-1_smt', name: 'statement', prose: 'Review policy.' }],
            controls: [
              {
                id: 'ac-1.1',
                title: 'Enhancement 1',
                parts: [{ id: 'ac-1.1_smt', name: 'statement', prose: 'Enhancement detail.' }]
              }
            ]
          }
        ]
      }
    ];
    const uuid = await apiSetup.createCatalog({ title: 'Controls Enhancements Catalog', groups });
    
    await page.goto(`/catalog/${uuid}`);
    await page.locator('.sidebar-item-group').filter({ hasText: 'Access Control' }).first().click();
    await page.getByText('Policy and Procedures').first().click();
    
    // Should see enhancement
    const enhancementText = page.getByText('Enhancement 1');
    await expect(enhancementText).toBeVisible();
  });
});
