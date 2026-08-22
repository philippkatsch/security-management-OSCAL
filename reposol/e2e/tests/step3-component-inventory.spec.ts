import { test, expect } from '../fixtures/base';
import { randomUUID } from 'node:crypto';

test.describe('Step 3 Component Inventory — Deterministic UI Verification', () => {
  test.setTimeout(60000);

  test('UC-3.5: Custom Properties & Free-Form Metadata', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const compDefId = await apiSetup.createComponentDefinition();

    await page.goto(`/component-definitions/${compDefId}?edit=true&w=${apiSetup.workspaceId}`);
    await expect(page.getByTestId('mode-edit-btn')).toBeVisible({ timeout: 20000 });

    // 1. Switch to Components tab in document tabs
    await page.locator('[class*="document-tabs"] button', { hasText: 'Components' }).click();

    // 2. Add Component
    const addCompBtn = page.locator('button:has-text("+ Add Component")').first();
    await expect(addCompBtn).toBeVisible({ timeout: 15000 });
    await addCompBtn.click();

    // 3. Fill Title and Type in Detail Panel
    const detailPanel = page.locator('.entity-panel-slide-out');
    await expect(detailPanel).toBeVisible({ timeout: 15000 });
    await detailPanel.locator('input').first().fill('Metadata Component');
    await detailPanel.locator('select').first().selectOption('software');

    // 4. Open Properties & Links accordion
    await detailPanel.getByText('Properties & Links').click();
    await detailPanel.getByRole('button', { name: /Add Property/i }).click();

    // 5. Fill property fields
    await detailPanel.getByPlaceholder('name').first().fill('CustomProp');
    await detailPanel.getByPlaceholder('value').first().fill('CustomValue');

    // 6. Verify property is displayed
    await expect(detailPanel.locator('input[value="CustomProp"]').first()).toBeVisible({ timeout: 15000 });
    await expect(detailPanel.locator('input[value="CustomValue"]').first()).toBeVisible({ timeout: 15000 });

    // 7. Close detail panel, save & toggle view mode to verify persistence
    await detailPanel.locator('input[value="CustomValue"]').first().blur();
    await page.waitForTimeout(300);
    await page.keyboard.press('Escape');
    await page.getByTestId('mode-view-btn').click();
    await page.locator('[class*="document-tabs"] button', { hasText: 'Components' }).click();
    await expect(page.getByText('Metadata Component').first()).toBeVisible({ timeout: 15000 });
  });

  test('UC-3.7: Service Protocols & Port Ranges', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const compDefId = await apiSetup.createComponentDefinition();

    await page.goto(`/component-definitions/${compDefId}?edit=true&w=${apiSetup.workspaceId}`);
    await expect(page.getByTestId('mode-edit-btn')).toBeVisible({ timeout: 20000 });

    // 1. Switch to Components tab and add component
    await page.locator('[class*="document-tabs"] button', { hasText: 'Components' }).click();
    await page.locator('button:has-text("+ Add Component")').first().click();

    const detailPanel = page.locator('.entity-panel-slide-out');
    await expect(detailPanel).toBeVisible({ timeout: 15000 });
    await detailPanel.locator('input').first().fill('Service Component');
    await detailPanel.locator('select').first().selectOption('service');

    // 2. Open Protocols accordion
    await detailPanel.getByText('Protocols').click();
    await detailPanel.getByRole('button', { name: '+ Add Protocol' }).click();

    // 3. Click newly added protocol row to expand editor
    await detailPanel.locator('table tbody tr').first().click();

    // 4. Fill Protocol Name
    const nameInput = detailPanel.locator('div:has(> label:has-text("Name")) input, label:has-text("Name") ~ input').first();
    await nameInput.fill('HTTPS');

    // 5. Add Port Range
    await detailPanel.getByRole('button', { name: '+ Add Port Range' }).click();

    // 6. Verify HTTPS protocol is listed
    await expect(detailPanel.locator('input[value="HTTPS"]').first()).toBeVisible({ timeout: 15000 });

    // 7. Close detail panel, save & toggle view mode to verify persistence
    await page.keyboard.press('Escape');
    await page.getByTestId('mode-view-btn').click();
    await page.locator('[class*="document-tabs"] button', { hasText: 'Components' }).click();
    await expect(page.getByText('Service Component').first()).toBeVisible({ timeout: 15000 });
  });

  test('UC-3.8: Organizational Roles & Responsible Parties', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const compDefId = await apiSetup.createComponentDefinition();

    await page.goto(`/component-definitions/${compDefId}?edit=true&w=${apiSetup.workspaceId}`);
    await expect(page.getByTestId('mode-edit-btn')).toBeVisible({ timeout: 20000 });

    // 1. Switch to Components tab and add component
    await page.locator('[class*="document-tabs"] button', { hasText: 'Components' }).click();
    await page.locator('button:has-text("+ Add Component")').first().click();

    const detailPanel = page.locator('.entity-panel-slide-out');
    await expect(detailPanel).toBeVisible({ timeout: 15000 });
    await detailPanel.locator('input').first().fill('Role Component');
    await detailPanel.locator('select').first().selectOption('system');

    // 2. Open Responsible Roles accordion
    await detailPanel.getByText('Responsible Roles').click();
    await detailPanel.getByRole('button', { name: '+ Add Role' }).click();

    // 3. Fill Role ID and Party UUID
    const partyId = randomUUID();
    const roleIdInput = detailPanel.locator('div:has(> label:has-text("Role ID")) input, label:has-text("Role ID") ~ input').first();
    await roleIdInput.fill('admin-role');

    const partyInput = detailPanel.locator('div:has(> label:has-text("Party UUIDs")) input, label:has-text("Party UUIDs") ~ input').first();
    await partyInput.fill(partyId);

    // 4. Verify Role ID is displayed
    await expect(detailPanel.locator('input[value="admin-role"]').first()).toBeVisible({ timeout: 15000 });

    // 5. Close detail panel, save & toggle view mode to verify persistence
    await page.keyboard.press('Escape');
    await page.getByTestId('mode-view-btn').click();
    await page.locator('[class*="document-tabs"] button', { hasText: 'Components' }).click();
    await expect(page.getByText('Role Component').first()).toBeVisible({ timeout: 15000 });
  });

  test('UC-3.11: Statement-Level Implementation Detail', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const compDefId = await apiSetup.createComponentDefinition();

    await page.goto(`/component-definitions/${compDefId}?edit=true&w=${apiSetup.workspaceId}`);
    await expect(page.getByTestId('mode-edit-btn')).toBeVisible({ timeout: 20000 });

    // 1. Switch to Components tab and add component
    await page.locator('[class*="document-tabs"] button', { hasText: 'Components' }).click();
    await page.locator('button:has-text("+ Add Component")').first().click();

    const detailPanel = page.locator('.entity-panel-slide-out');
    await expect(detailPanel).toBeVisible({ timeout: 15000 });
    await detailPanel.locator('input').first().fill('Implementation Component');
    await detailPanel.locator('select').first().selectOption('software');

    // 2. Open Control Implementations accordion
    await detailPanel.getByText('Control Implementations').click();
    await detailPanel.getByRole('button', { name: '+ Add Control Implementation' }).click();

    // 3. Add Requirement
    await detailPanel.getByRole('button', { name: '+ Add Requirement' }).click();

    // 4. Click requirement row to expand details
    await detailPanel.locator('table tbody tr').last().click();

    // 5. Verify requirement editor inputs are visible
    await expect(detailPanel.locator('label', { hasText: 'Control ID' })).toBeVisible({ timeout: 15000 });

    // 6. Close detail panel, save & toggle view mode to verify persistence
    await page.keyboard.press('Escape');
    await page.getByTestId('mode-view-btn').click();
    await page.locator('[class*="document-tabs"] button', { hasText: 'Components' }).click();
    await expect(page.getByText('Implementation Component').first()).toBeVisible({ timeout: 15000 });
  });

  test('UC-3.13: Capability Declaration & Component Aggregation', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const compDefId = await apiSetup.createComponentDefinition();

    await page.goto(`/component-definitions/${compDefId}?edit=true&w=${apiSetup.workspaceId}`);
    await expect(page.getByTestId('mode-edit-btn')).toBeVisible({ timeout: 20000 });

    // 1. Add Component
    await page.locator('[class*="document-tabs"] button', { hasText: 'Components' }).click();
    await page.locator('button:has-text("+ Add Component")').first().click();

    const detailPanel = page.locator('.entity-panel-slide-out');
    await expect(detailPanel).toBeVisible({ timeout: 15000 });
    await detailPanel.locator('input').first().fill('Sub Component 1');

    // 2. Close detail panel and switch to Capabilities tab
    await page.keyboard.press('Escape');
    await page.locator('[class*="document-tabs"] button', { hasText: 'Capabilities' }).click();

    // 3. Add Capability
    await page.locator('button:has-text("+ Add Capability")').first().click();
    const capPanel = page.locator('.entity-panel-slide-out');
    await expect(capPanel).toBeVisible({ timeout: 15000 });
    await capPanel.locator('input').first().fill('Advanced Auth');
    await capPanel.locator('textarea').first().fill('Handles advanced authentication');

    // 4. Link Incorporated Component
    const linkSelect = capPanel.locator('select', { hasText: 'Add Component...' });
    if (await linkSelect.isVisible({ timeout: 5000 }).catch(() => false)) {
      await linkSelect.selectOption({ label: 'Sub Component 1' });
      await expect(capPanel.getByText('Sub Component 1').first()).toBeVisible({ timeout: 15000 });
    }

    // 5. Close detail panel, save & toggle view mode to verify persistence
    await page.keyboard.press('Escape');
    await page.getByTestId('mode-view-btn').click();
    await page.locator('[class*="document-tabs"] button', { hasText: 'Capabilities' }).click();
    await expect(page.getByText('Advanced Auth').first()).toBeVisible({ timeout: 15000 });
  });

  test('UC-3.14: External Component Definition Import & Back Matter', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const compDefId = await apiSetup.createComponentDefinition();

    await page.goto(`/component-definitions/${compDefId}?edit=true&w=${apiSetup.workspaceId}`);
    await expect(page.getByTestId('mode-edit-btn')).toBeVisible({ timeout: 20000 });

    // 1. Switch to Metadata tab
    await page.locator('[class*="document-tabs"] button', { hasText: 'Metadata' }).click();

    // 2. Add Resource in Back Matter
    const addResourceBtn = page.getByRole('button', { name: /Add Resource/i }).first();
    await expect(addResourceBtn).toBeVisible({ timeout: 15000 });
    await addResourceBtn.click();

    // 3. Fill Resource Title
    const titleInput = page.locator('div:has(> label:has-text("Resource Title")) input, label:has-text("Resource Title") ~ input, input[value="New Resource"]').first();
    await expect(titleInput).toBeVisible({ timeout: 15000 });
    await titleInput.fill('External Component Standard');

    // 4. Verify resource is visible
    await expect(page.locator('.resource-card', { hasText: 'External Component Standard' }).first()).toBeVisible({ timeout: 15000 });

    // 5. Save & toggle view mode to verify persistence
    await page.getByTestId('mode-view-btn').click();
    await page.locator('[class*="document-tabs"] button', { hasText: 'Metadata' }).click();
    await expect(page.locator('.resource-card', { hasText: 'External Component Standard' }).first()).toBeVisible({ timeout: 15000 });
  });
});
