import { test, expect } from '../fixtures/base';

test.describe('Smoke Tests', () => {
  test('application loads and shows dashboard', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    await page.goto('/');
    await expect(page).toHaveTitle(/OSCAL|Reposol/i);
    // Dashboard should show welcome content
    await expect(page.getByText(/dashboard|welcome|overview/i).first()).toBeVisible();
  });

  test('navigation sidebar shows all document types', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    await page.goto('/');
    // Check that key nav items are present
    await expect(page.getByText('Catalogs').first()).toBeVisible();
    await expect(page.getByText('Profiles').first()).toBeVisible();
    await expect(page.getByText('Components').first()).toBeVisible();
    await expect(page.getByText('SSPs').first()).toBeVisible();
    await expect(page.getByText('Assessment Plans').first()).toBeVisible();
    await expect(page.getByText('Assessment Results').first()).toBeVisible();
    await expect(page.getByText('POA&Ms').first()).toBeVisible();
    await expect(page.getByText('Control Mappings').first()).toBeVisible();
  });

  test('health status indicator shows online', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    await page.goto('/');
    // Wait for health check to complete
    await expect(page.getByText(/online/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('backend API is reachable', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const response = await page.request.get('/health');
    expect(response.ok()).toBeTruthy();
  });

  test('all primary routes are accessible', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const routes = [
      '/catalogs',
      '/profiles',
      '/component-definitions',
      '/ssps',
      '/assessment-plans',
      '/assessment-results',
      '/poams',
      '/control-mappings',
      '/traceability'
    ];
    for (const route of routes) {
      await page.goto(route);
      // Wait for page to load by checking for generic content container or title
      await expect(page.locator('body')).toBeVisible({ timeout: 10000 });
      // Verify no generic error text is displayed
      await expect(page.getByText(/unexpected error|failed to load/i)).toHaveCount(0);
    }
  });
});
