import { test, expect } from '@playwright/test';

test.describe('Smoke Tests', () => {
  test('application loads and shows dashboard', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/OSCAL|Reposol/i);
    // Dashboard should show welcome content
    await expect(page.getByText(/dashboard|welcome|overview/i).first()).toBeVisible();
  });

  test('navigation sidebar shows all document types', async ({ page }) => {
    await page.goto('/');
    // Check that key nav items are present
    await expect(page.getByText('Catalogs').first()).toBeVisible();
    await expect(page.getByText('Profiles').first()).toBeVisible();
  });

  test('health status indicator shows online', async ({ page }) => {
    await page.goto('/');
    // Wait for health check to complete
    await expect(page.getByText(/online/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('backend API is reachable', async ({ page }) => {
    const response = await page.request.get('/health');
    expect(response.ok()).toBeTruthy();
  });
});
