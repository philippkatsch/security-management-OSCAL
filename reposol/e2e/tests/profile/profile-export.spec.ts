import { test, expect } from '../../fixtures/base';
import { navigateToProfile } from '../../helpers/profile-helpers';

test.describe('Profile Export', () => {
  test('export profile opens modal and selects format options', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const groups = [
      {
        id: 'ac',
        title: 'Access Control',
        controls: [
          {
            id: 'ac-1',
            title: 'Policy and Procedures',
            params: [{ id: 'ac-1_prm_1', label: 'frequency' }]
          }
        ]
      }
    ];
    const catUuid = await apiSetup.createCatalog({ title: 'Export Catalog', groups });
    
    const modify = {
      'set-parameters': [
        { 'param-id': 'ac-1_prm_1', values: ['annually'] }
      ]
    };
    
    const profUuid = await apiSetup.createProfile({
      title: 'Export Profile',
      catalogUuid: catUuid,
      modify
    });
    
    await navigateToProfile(page, profUuid, apiSetup.workspaceId);
    await expect(page.getByText('Export Profile').first()).toBeVisible({ timeout: 15000 });
    
    // 1. Click Export action button in top bar
    const exportBtn = page.getByRole('button', { name: /export/i }).first();
    await expect(exportBtn).toBeVisible({ timeout: 15000 });
    await exportBtn.click();
    
    // 2. Export modal renders with format selectors
    const modal = page.locator('dialog[data-testid="export-modal"], dialog').first();
    await expect(modal).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('export-format-json')).toBeChecked();
    await expect(page.getByTestId('export-confirm-btn')).toBeVisible({ timeout: 15000 });
    
    // 3. Switch to YAML format and verify selection
    await page.getByTestId('export-format-yaml').click();
    await expect(page.getByTestId('export-format-yaml')).toBeChecked();
    
    // 4. Close modal
    await modal.getByRole('button', { name: /cancel/i }).or(modal.locator('button[aria-label="Close"]')).first().click();
    await expect(modal).not.toBeVisible({ timeout: 15000 });
  });
});
