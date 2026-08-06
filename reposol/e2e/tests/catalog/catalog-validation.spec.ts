import { test, expect } from '../../fixtures/base';

test.describe('Catalog Validation', () => {
  test('validate a valid catalog shows success', async ({ page, apiSetup }) => {
    const uuid = await apiSetup.createCatalog({ title: 'Valid Catalog' });
    
    await page.goto(`/catalog/${uuid}`);
    
    const validateBtn = page.getByRole('button', { name: /validate/i });
    if (await validateBtn.isVisible()) {
      await validateBtn.click();
      await expect(page.getByText(/valid|success/i).first()).toBeVisible();
    }
  });

  test('validate via API with missing required fields', async ({ page, request }) => {
    // Attempt to validate invalid data directly via API
    const invalidPayload = {
      catalog: {
        // missing uuid, metadata
        groups: []
      }
    };
    
    const response = await request.post('/api/validate/catalog', { data: invalidPayload });
    // Assuming backend returns 400 or a specific validation error payload
    expect(response.ok()).toBeFalsy();
    const errorBody = await response.json();
    expect(errorBody).toBeDefined();
  });
});
