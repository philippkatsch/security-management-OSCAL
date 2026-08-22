import { test, expect } from '../fixtures/base';
import { randomUUID } from 'node:crypto';

test.describe('Step 4 System Security Plan — Deterministic UI Verification', () => {
  test.setTimeout(60000);

  test('UC-4.6: System Operational Status & Identity', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const sspId = await apiSetup.createSsp();
    await page.goto(`/ssps/${sspId}?edit=true&w=${apiSetup.workspaceId}`);
    await expect(page.getByTestId('mode-edit-btn')).toBeVisible({ timeout: 20000 });

    // 1. Navigate to System Characteristics tab
    await page.locator('[class*="document-tabs"] button', { hasText: 'System Characteristics' }).click();

    // 2. Fill Operational Status
    const statusSection = page.locator('div[class*="accordion-section"]', { hasText: 'System Status' });
    const statusSelect = statusSection.locator('select').first();
    await expect(statusSelect).toBeVisible({ timeout: 15000 });
    await statusSelect.selectOption('operational');

    // 3. Fill Date Authorized
    const identitySection = page.locator('div[class*="accordion-section"]', { hasText: 'System Identity' });
    const dateInput = identitySection.locator('input[type="date"]').first();
    await dateInput.fill('2023-10-01');

    // 4. Check Privacy Sensitive
    const privacyCheckbox = identitySection.locator('input[type="checkbox"]').first();
    await privacyCheckbox.check();

    // 5. Toggle view mode to verify persistence
    await page.getByTestId('mode-view-btn').click();
    await page.locator('[class*="document-tabs"] button', { hasText: 'System Characteristics' }).click();
    await expect(page.locator('span[data-testid="status-badge"], [class*="status-badge"]').first()).toBeVisible({ timeout: 15000 });
  });

  test('UC-4.9: System Properties & Responsible Parties', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const sspId = await apiSetup.createSsp();
    await page.goto(`/ssps/${sspId}?edit=true&w=${apiSetup.workspaceId}`);
    await expect(page.getByTestId('mode-edit-btn')).toBeVisible({ timeout: 20000 });

    // 1. Navigate to System Characteristics -> Responsible Parties
    await page.locator('[class*="document-tabs"] button', { hasText: 'System Characteristics' }).click();
    await page.getByRole('button', { name: 'Expand All' }).click();
    
    const partySection = page.locator('div[class*="accordion-section"]', { hasText: 'Responsible Parties' });
    await partySection.getByRole('button', { name: /Add Responsible Party/i }).click();

    const roleInput = partySection.locator('input[placeholder*="Role"]').first();
    await roleInput.fill('system-owner');

    const partyInput = partySection.locator('input[placeholder*="Party UUID"]').first();
    const partyUuid = randomUUID();
    await partyInput.fill(partyUuid);

    // 2. Navigate to Metadata tab for Properties
    await page.locator('[class*="document-tabs"] button', { hasText: 'Metadata' }).click();
    await page.getByRole('button', { name: /Add Property/i }).first().click();

    await page.getByPlaceholder('name').first().fill('deployment-region');
    await page.getByPlaceholder('value').first().fill('us-east-1');
    await page.getByPlaceholder('value').first().blur();
    await page.waitForTimeout(400);

    // 3. Toggle view mode to verify persistence
    await page.getByTestId('mode-view-btn').click();
    await page.locator('[class*="document-tabs"] button', { hasText: 'Metadata' }).click();
    await expect(page.getByText('deployment-region').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('us-east-1').first()).toBeVisible({ timeout: 15000 });
  });

  test('UC-4.11: System Users & Implementation Entities', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const sspId = await apiSetup.createSsp();
    await page.goto(`/ssps/${sspId}?edit=true&w=${apiSetup.workspaceId}`);
    await expect(page.getByTestId('mode-edit-btn')).toBeVisible({ timeout: 20000 });

    // 1. Navigate to System Implementation tab
    await page.locator('[class*="document-tabs"] button', { hasText: 'System Implementation' }).click();

    // 2. Click Users sub-tab and Add User
    await page.locator('.sys-imp-tab button', { hasText: 'Users' }).click();
    await page.getByRole('button', { name: '+ Add User' }).click();

    // 3. Verify user is listed
    await expect(page.getByText('New User').first()).toBeVisible({ timeout: 15000 });

    // 4. Toggle view mode to verify persistence
    await page.getByTestId('mode-view-btn').click();
    await page.locator('[class*="document-tabs"] button', { hasText: 'System Implementation' }).click();
    await expect(page.getByText('New User').first()).toBeVisible({ timeout: 15000 });
  });

  test('UC-4.13: Inventory Items & Asset Tracking', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const sspId = await apiSetup.createSsp();
    await page.goto(`/ssps/${sspId}?edit=true&w=${apiSetup.workspaceId}`);
    await expect(page.getByTestId('mode-edit-btn')).toBeVisible({ timeout: 20000 });

    // 1. Navigate to System Implementation -> Inventory Items
    await page.locator('[class*="document-tabs"] button', { hasText: 'System Implementation' }).click();
    await page.locator('.sys-imp-tab button', { hasText: 'Inventory Items' }).click();

    // 2. Add Inventory Item
    await page.getByRole('button', { name: '+ Add Inventory Item' }).click();

    // 3. Verify item is listed
    await expect(page.getByText('New Inventory Item').first()).toBeVisible({ timeout: 15000 });

    // 4. Toggle view mode to verify persistence
    await page.getByTestId('mode-view-btn').click();
    await page.locator('[class*="document-tabs"] button', { hasText: 'System Implementation' }).click();
    await page.locator('.sys-imp-tab button', { hasText: 'Inventory Items' }).click();
    await expect(page.getByText('New Inventory Item').first()).toBeVisible({ timeout: 15000 });
  });

  test('UC-4.14: Leveraged Authorizations', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const sspId = await apiSetup.createSsp();
    await page.goto(`/ssps/${sspId}?edit=true&w=${apiSetup.workspaceId}`);
    await expect(page.getByTestId('mode-edit-btn')).toBeVisible({ timeout: 20000 });

    // 1. Navigate to System Implementation -> Leveraged Authorizations
    await page.locator('[class*="document-tabs"] button', { hasText: 'System Implementation' }).click();
    await page.locator('.sys-imp-tab button', { hasText: 'Leveraged Authorizations' }).click();

    // 2. Add Leveraged Authorization
    await page.getByRole('button', { name: '+ Add Auth' }).click();

    // 3. Verify authorization is listed
    await expect(page.getByText('New Auth').first()).toBeVisible({ timeout: 15000 });

    // 4. Toggle view mode to verify persistence
    await page.getByTestId('mode-view-btn').click();
    await page.locator('[class*="document-tabs"] button', { hasText: 'System Implementation' }).click();
    await page.locator('.sys-imp-tab button', { hasText: 'Leveraged Authorizations' }).click();
    await expect(page.getByText('New Auth').first()).toBeVisible({ timeout: 15000 });
  });

  test('UC-4.5: System Information Types & FIPS-199 Categorization', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const sspId = await apiSetup.createSsp();
    await page.goto(`/ssps/${sspId}?edit=true&w=${apiSetup.workspaceId}`);
    await expect(page.getByTestId('mode-edit-btn')).toBeVisible({ timeout: 20000 });

    // 1. Navigate to System Characteristics tab
    await page.locator('[class*="document-tabs"] button', { hasText: 'System Characteristics' }).click();

    // 2. Expand Information Types section
    const infoSection = page.locator('div[class*="accordion-section"]', { hasText: 'Information Types' });
    if (!await infoSection.locator('button:has-text("+ Add Custom Info Type")').isVisible().catch(() => false)) {
      await infoSection.locator('h3').click();
    }

    // 3. Add Custom Info Type
    await infoSection.getByRole('button', { name: '+ Add Custom Info Type' }).click();

    // 4. Fill Title
    const titleInput = infoSection.locator('div[class*="info-type-card"]').first().locator('input').first();
    await expect(titleInput).toBeVisible({ timeout: 15000 });
    await titleInput.fill('Financial Customer Records');

    // 5. Toggle view mode to verify persistence
    await page.getByTestId('mode-view-btn').click();
    await page.locator('[class*="document-tabs"] button', { hasText: 'System Characteristics' }).click();
    await expect(page.getByText('Financial Customer Records').first()).toBeVisible({ timeout: 15000 });
  });
});
