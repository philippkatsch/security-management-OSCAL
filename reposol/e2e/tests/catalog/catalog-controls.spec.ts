import { test, expect } from '../../fixtures/base';

test.describe('Catalog Controls', () => {
  test('catalog controls are visible in control tree', async ({ page, apiSetup }) => {
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
    const uuid = await apiSetup.createCatalog({ title: 'Controls Catalog', groups });
    
    await page.goto(`/catalogs/${uuid}?w=${apiSetup.workspaceId}`);
    
    const treeNode = page.locator('[data-testid="tree-node-ac"], [data-testid^="tree-node-"]').first();
    await expect(treeNode).toBeVisible({ timeout: 15000 });
    await treeNode.click();
    
    await expect(page.getByText('Policy and Procedures').first()).toBeVisible({ timeout: 15000 });
  });

  test('control detail view shows title and statement', async ({ page, apiSetup }) => {
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
    const uuid = await apiSetup.createCatalog({ title: 'Controls Detail Catalog', groups });
    
    await page.goto(`/catalogs/${uuid}?w=${apiSetup.workspaceId}`);
    
    const groupNode = page.locator('[data-testid="tree-node-ac"], [data-testid^="tree-node-"]').first();
    await expect(groupNode).toBeVisible({ timeout: 15000 });
    await groupNode.click();

    const controlNode = page.locator('[data-testid="tree-node-ac-1"], [data-testid^="tree-node-"]').filter({ hasText: 'Policy and Procedures' }).first();
    if (await controlNode.isVisible({ timeout: 5000 }).catch(() => false)) {
      await controlNode.click();
    } else {
      await page.getByText('Policy and Procedures').first().click();
    }
    
    await expect(page.getByRole('heading', { name: /Policy and Procedures/i }).first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Review policy.')).toBeVisible({ timeout: 15000 });
  });

  test('control enhancements are shown in accordion', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
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
    
    await page.goto(`/catalogs/${uuid}?w=${apiSetup.workspaceId}`);
    
    const groupNode = page.locator('[data-testid="tree-node-ac"], [data-testid^="tree-node-"]').first();
    await expect(groupNode).toBeVisible({ timeout: 15000 });
    await groupNode.click();

    const controlNode = page.locator('[data-testid="tree-node-ac-1"], [data-testid^="tree-node-"]').filter({ hasText: 'Policy and Procedures' }).first();
    if (await controlNode.isVisible({ timeout: 5000 }).catch(() => false)) {
      await controlNode.click();
    } else {
      await page.getByText('Policy and Procedures').first().click();
    }
    
    // Expand Control Enhancements accordion
    const accordionHeader = page.getByRole('heading', { name: /Control Enhancements/i }).first();
    if (await accordionHeader.isVisible({ timeout: 5000 }).catch(() => false)) {
      await accordionHeader.click();
    }

    const enhancementText = page.getByText('Enhancement 1').first();
    await expect(enhancementText).toBeVisible({ timeout: 15000 });
  });
});
