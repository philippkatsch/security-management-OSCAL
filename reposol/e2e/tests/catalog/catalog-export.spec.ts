import { test, expect } from '../../fixtures/base';

test.describe('Catalog Export', () => {
  test('export catalog as JSON', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const uuid = await apiSetup.createCatalog({ title: 'Export JSON Catalog' });
    
    await page.goto(`/catalogs/${uuid}?w=${apiSetup.workspaceId}`);
    
    const exportBtn = page.getByRole('button', { name: /export/i });
    if (await exportBtn.isVisible()) {
      await exportBtn.click();
      
      const downloadPromise = page.waitForEvent('download');
      await page.getByRole('menuitem', { name: /json/i }).click();
      const download = await downloadPromise;
      
      expect(download.suggestedFilename()).toMatch(/\.json$/i);
    }
  });

  test('export catalog as YAML', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const uuid = await apiSetup.createCatalog({ title: 'Export YAML Catalog' });
    
    await page.goto(`/catalogs/${uuid}?w=${apiSetup.workspaceId}`);
    
    const exportBtn = page.getByRole('button', { name: /export/i });
    if (await exportBtn.isVisible()) {
      await exportBtn.click();
      
      const downloadPromise = page.waitForEvent('download');
      await page.getByRole('menuitem', { name: /yaml/i }).click();
      const download = await downloadPromise;
      
      expect(download.suggestedFilename()).toMatch(/\.yaml$|\.yml$/i);
    }
  });

  test('export catalog as XML', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const uuid = await apiSetup.createCatalog({ title: 'Export XML Catalog' });
    
    await page.goto(`/catalogs/${uuid}?w=${apiSetup.workspaceId}`);
    
    const exportBtn = page.getByRole('button', { name: /export/i });
    if (await exportBtn.isVisible()) {
      await exportBtn.click();
      
      const downloadPromise = page.waitForEvent('download');
      await page.getByRole('menuitem', { name: /xml/i }).click();
      const download = await downloadPromise;
      
      expect(download.suggestedFilename()).toMatch(/\.xml$/i);
    }
  });
});
