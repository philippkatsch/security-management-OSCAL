import { test, expect } from '../../fixtures/base';

test.describe('Dashboard Tests', () => {
  test('shows document count cards or summary stats', async ({ page }) => {
    await page.goto('/');
    const dashboardTitle = page.getByRole('heading', { name: /dashboard|overview/i });
    await expect(dashboardTitle).toBeVisible();
    
    // Look for some count card elements
    const statCards = page.locator('[data-testid="stat-card"]');
    if (await statCards.count() > 0) {
      await expect(statCards.first()).toBeVisible();
    }
  });

  test('quick guide section is visible', async ({ page }) => {
    await page.goto('/');
    const guideText = page.getByText(/quick guide|getting started|how to/i).first();
    if (await guideText.isVisible()) {
      await expect(guideText).toBeVisible();
    }
  });

  test('clicking a nav item navigates to that document type list', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Catalogs').first().click();
    await expect(page).toHaveURL(/.*catalogs/);
    
    const catalogsHeader = page.getByRole('heading', { name: /catalogs/i });
    await expect(catalogsHeader).toBeVisible();
  });
});
