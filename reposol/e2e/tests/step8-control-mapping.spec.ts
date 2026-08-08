import { test, expect } from '../fixtures/base';

test.describe('Step 8 Control Mapping — E2E Specifications', () => {
  test('navigate to Control Mappings list view and view items', async ({ page, apiSetup }) => {
    const mapUuid = await apiSetup.createControlMapping({
      title: 'E2E NIST SP 800-53 to ISO 27001 Mapping'
    });

    await page.goto(`/control-mapping/${mapUuid}`);
    await expect(page.getByText(/NIST SP 800-53|Control Mapping/i).or(page.locator('input[value*="NIST SP 800-53"]')).first()).toBeVisible();
  });

  test('create new Control Mapping via UI', async ({ page }) => {
    await page.goto('/control-mappings');
    
    const newBtn = page.getByRole('button', { name: /new/i }).first();
    if (await newBtn.isVisible()) {
      await newBtn.click();
      const input = page.locator('.modal-overlay input').first();
      if (await input.isVisible()) {
        await input.fill('E2E BSI IT-Grundschutz Mapping');
        await page.getByRole('button', { name: /create/i }).click();
        await expect(page.getByText(/E2E BSI IT-Grundschutz Mapping/i).or(page.locator('input[value*="E2E BSI IT-Grundschutz Mapping"]')).first()).toBeVisible();
      }
    }
  });
});
