import { test, expect } from '../../fixtures/base';

test.describe('Catalog Export', () => {
  test('export catalog as JSON', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const uuid = await apiSetup.createCatalog({ title: 'Export JSON Catalog' });
    
    await page.goto(`/catalogs/${uuid}?w=${apiSetup.workspaceId}`);
    
    const exportBtn = page.getByRole('button', { name: /export/i });
    if (await exportBtn.isVisible()) {
      const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
      await exportBtn.click();
      const download = await downloadPromise;
      
      expect(download.suggestedFilename()).toMatch(/\.json$/i);
    }
  });

  test('export catalog as YAML', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    await apiSetup.createCatalog({ title: 'Export YAML Catalog' });
    
    await page.goto(`/catalogs?w=${apiSetup.workspaceId}`);
    
    const exportBtn = page.getByRole('button', { name: /export/i }).first();
    if (await exportBtn.isVisible()) {
      await exportBtn.click();
      await expect(page.getByTestId('export-modal')).toBeVisible({ timeout: 10000 });
      await page.getByTestId('export-format-yaml').click();
      const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
      await page.getByTestId('export-confirm-btn').click();
      const download = await downloadPromise;
      
      expect(download.suggestedFilename()).toMatch(/\.yaml$|\.yml$/i);
    }
  });

  test('export catalog as XML', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    await apiSetup.createCatalog({ title: 'Export XML Catalog' });
    
    await page.goto(`/catalogs?w=${apiSetup.workspaceId}`);
    
    const exportBtn = page.getByRole('button', { name: /export/i }).first();
    if (await exportBtn.isVisible()) {
      await exportBtn.click();
      await expect(page.getByTestId('export-modal')).toBeVisible({ timeout: 10000 });
      await page.getByTestId('export-format-xml').click();
      const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
      await page.getByTestId('export-confirm-btn').click();
      const download = await downloadPromise;
      
      expect(download.suggestedFilename()).toMatch(/\.xml$/i);
    }
  });
});
