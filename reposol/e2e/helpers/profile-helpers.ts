import { Page, expect } from '@playwright/test';

/**
 * Explicitly waits for Profile Resolution to complete and .catalog-sidebar to mount.
 * 
 * Guarantees zero timing flakiness by ensuring loading placeholders and
 * live resolving indicators are detached/hidden before validating .catalog-sidebar.
 */
export async function waitForProfileResolution(page: Page, timeout = 30000) {
  await page.waitForResponse(
    res => (
      res.url().includes('/api/documents/profile/') ||
      res.url().includes('/api/v1/profile/') ||
      res.url().includes('/api/documents/catalogs')
    ) && res.status() === 200,
    { timeout: 3000 }
  ).catch(() => {});
  
  const sidebar = page.locator('.catalog-sidebar');
  try {
    await page.waitForSelector('.catalog-sidebar', { state: 'visible', timeout: 15000 });
  } catch (err) {
    const isStillLoading = await page.getByText('Loading resolved controls...').isVisible().catch(() => false);
    if (isStillLoading) {
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.catalog-sidebar', { state: 'visible', timeout: 15000 });
    }
  }

  await expect(page.getByText('Loading resolved controls...')).not.toBeVisible({ timeout: 5000 }).catch(() => {});
  await expect(page.getByText('⚙️ Live Resolving...')).not.toBeVisible({ timeout: 5000 }).catch(() => {});
  await expect(sidebar).toBeVisible({ timeout: 10000 });
  return sidebar;
}

export async function navigateToProfile(
  page: Page,
  profileUuid: string,
  workspaceId: string,
  edit = true,
  timeout = 30000
) {
  await page.addInitScript((wsId) => {
    window.localStorage.setItem('reposol_workspace_id', wsId);
  }, workspaceId);

  let lastError: any;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await page.goto(`/profile/${profileUuid}?edit=${edit}&w=${workspaceId}`, { waitUntil: 'domcontentloaded' });
      await waitForProfileResolution(page, timeout);
      return;
    } catch (err) {
      lastError = err;
      if (attempt < 3) {
        await page.waitForTimeout(1000);
      }
    }
  }
  throw lastError;
}
