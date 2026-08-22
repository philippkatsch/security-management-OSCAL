import { Page, expect } from '@playwright/test';

/**
 * Explicitly waits for Profile Resolution to complete and catalog sidebar to mount.
 */
export async function waitForProfileResolution(page: Page, timeout = 30000) {
  await page.waitForResponse(
    res => (
      res.url().includes('/api/documents/profiles') ||
      res.url().includes('/api/v1/profiles') ||
      res.url().includes('/api/documents/catalogs')
    ) && res.status() === 200,
    { timeout: 3000 }
  ).catch(() => {});
  
  const sidebar = page.locator('[class*="catalog-sidebar"], body').first();
  try {
    await page.waitForSelector('[class*="catalog-sidebar"]', { state: 'visible', timeout: 15000 });
  } catch (err) {
    const isStillLoading = await page.getByText('Loading resolved controls...').isVisible().catch(() => false);
    if (isStillLoading) {
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForSelector('[class*="catalog-sidebar"]', { state: 'visible', timeout: 15000 }).catch(() => {});
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
      await page.goto(`/profiles/${profileUuid}?edit=${edit}&w=${workspaceId}`, { waitUntil: 'domcontentloaded' });
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

export async function selectSidebarTab(page: Page, tabName: 'Overview' | 'Metadata' | 'Properties' | 'Parameters' | 'Imports' | 'Baseline Diff' | 'Back Matter') {
  const testIdMap: Record<string, string> = {
    'Overview': 'profile-sidebar-overview',
    'Metadata': 'profile-sidebar-metadata',
    'Properties': 'profile-sidebar-properties',
    'Parameters': 'profile-sidebar-parameters',
    'Imports': 'profile-sidebar-imports',
    'Baseline Diff': 'profile-sidebar-diff',
    'Back Matter': 'profile-sidebar-backmatter'
  };

  const testId = testIdMap[tabName];
  const tabLocator = testId 
    ? page.getByTestId(testId).or(page.locator('[class*="sidebar-item"]').filter({ hasText: tabName })).first()
    : page.locator('[class*="sidebar-item"]').filter({ hasText: tabName }).first();

  await expect(tabLocator).toBeVisible({ timeout: 15000 });
  await tabLocator.click();
}

export async function switchStructuringMode(page: Page, mode: 'as-is' | 'custom' | 'flat') {
  await selectSidebarTab(page, 'Imports');
  
  // Ensure edit mode is enabled if currently in view mode
  const editBtn = page.getByTestId('mode-edit-btn');
  if (await editBtn.isVisible().catch(() => false)) {
    const isEditActive = await editBtn.evaluate(el => el.classList.contains('_btn-primary_1m2w8_3') || el.style.fontWeight === 'bold' || window.getComputedStyle(el).fontWeight === '700').catch(() => false);
    if (!isEditActive) {
      await editBtn.click().catch(() => {});
    }
  }

  const modeSelect = page.locator('select').filter({ hasText: /as-is|custom|flat/i }).first();
  await expect(modeSelect).toBeVisible({ timeout: 15000 });
  await modeSelect.selectOption(mode);
}
