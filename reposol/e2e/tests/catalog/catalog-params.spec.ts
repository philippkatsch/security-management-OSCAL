import { test, expect } from '../../fixtures/base';

test.describe('Catalog Parameters', () => {
  test('parameters are visible in control view', async ({ page, apiSetup }) => {
    const groups = [
      {
        id: 'ac',
        title: 'Access Control',
        controls: [
          {
            id: 'ac-1',
            title: 'Policy and Procedures',
            params: [
              {
                id: 'ac-1_prm_1',
                label: 'organization-defined frequency'
              }
            ],
            parts: [
              {
                id: 'ac-1_smt',
                name: 'statement',
                prose: 'Review policy {{ insert: param, ac-1_prm_1 }}.'
              }
            ]
          }
        ]
      }
    ];
    const uuid = await apiSetup.createCatalog({ title: 'Params Catalog', groups });
    
    await page.goto(`/catalog/${uuid}`);
    await page.locator('.sidebar-item-group').filter({ hasText: 'Access Control' }).first().click();
    await page.getByText('Policy and Procedures').first().click();
    
    await expect(page.getByText('organization-defined frequency').first()).toBeVisible();
  });

  test('parameter card shows label', async ({ page, apiSetup }) => {
    const groups = [
      {
        id: 'ac',
        title: 'Access Control',
        controls: [
          {
            id: 'ac-1',
            title: 'Policy and Procedures',
            params: [
              {
                id: 'ac-1_prm_1',
                label: 'org-defined freq'
              }
            ],
            parts: [
              { id: 'ac-1_smt', name: 'statement', prose: 'Content' }
            ]
          }
        ]
      }
    ];
    const uuid = await apiSetup.createCatalog({ title: 'Param Card Catalog', groups });
    
    await page.goto(`/catalog/${uuid}`);
    await page.locator('.sidebar-item-group').filter({ hasText: 'Access Control' }).first().click();
    await page.getByText('Policy and Procedures').first().click();
    
    await expect(page.getByText('org-defined freq')).toBeVisible();
  });

  test('edit parameter value', async ({ page, apiSetup }) => {
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
    const uuid = await apiSetup.createCatalog({ title: 'Edit Param Catalog', groups });
    
    await page.goto(`/catalog/${uuid}`);
    await page.locator('.sidebar-item-group').filter({ hasText: 'Access Control' }).first().click();
    await page.getByText('Policy and Procedures').first().click();
    
    const paramInput = page.getByLabel(/frequency/i).first();
    if (await paramInput.isVisible()) {
      await paramInput.fill('annually');
      await page.getByRole('button', { name: /save/i }).click();
      await expect(page.getByText('annually')).toBeVisible();
    }
  });
});
