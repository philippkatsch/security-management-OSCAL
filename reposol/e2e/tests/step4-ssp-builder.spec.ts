import { test, expect } from '../fixtures/base';
import { randomUUID } from 'node:crypto';

test.describe('Step 4 System Security Plan — Extended Coverage', () => {
  test.setTimeout(90000);

  test('UC-4.6: System Operational Status', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const sspId = await apiSetup.createSsp();
    await page.goto(`/ssps/${sspId}?edit=true&w=${apiSetup.workspaceId}`);

    // Navigate to System Characteristics tab
    await page.getByRole('tab', { name: /System Characteristics/i }).click();

    // Verify and fill Operational Status
    const statusSelect = page.getByLabel(/Operational State/i);
    await expect(statusSelect).toBeVisible();
    await statusSelect.selectOption('operational');
    
    await page.getByLabel(/Status Remarks/i).fill('System is fully operational in production');

    // Date Authorized
    await page.getByLabel(/Date Authorized/i).fill('2023-10-01');

    // Privacy Sensitive Checkbox
    const privacySensitive = page.getByLabel(/Privacy Sensitive System/i);
    if (await privacySensitive.isVisible()) {
      await privacySensitive.check();
    }

    // Cloud deployment & service models
    const deploymentModel = page.getByLabel(/Cloud Deployment Model/i);
    if (await deploymentModel.isVisible()) {
      await deploymentModel.selectOption('public');
    }

    const serviceModel = page.getByLabel(/Cloud Service Model/i);
    if (await serviceModel.isVisible()) {
      await serviceModel.selectOption('saas');
    }

    await page.getByRole('button', { name: /Save/i }).click();
    await expect(page.getByText(/Saved successfully/i)).toBeVisible();
  });

  test('UC-4.9: System Properties & Responsible Parties', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const sspId = await apiSetup.createSsp();
    await page.goto(`/ssps/${sspId}?edit=true&w=${apiSetup.workspaceId}`);

    // Navigate to Metadata tab
    await page.getByRole('tab', { name: /Metadata/i }).click();

    // Add responsible party
    await page.getByRole('button', { name: /Add Responsible Party/i }).click();
    await page.getByLabel(/Role ID/i).fill('system-owner');
    await page.getByLabel(/Party UUID/i).fill(randomUUID());
    await page.getByRole('button', { name: /Save Party/i }).click();

    // Verify it was added
    await expect(page.getByText('system-owner')).toBeVisible();

    // Edit System Properties
    await page.getByRole('button', { name: /Add Property/i }).click();
    await page.getByLabel(/Property Name/i).fill('deployment-region');
    await page.getByLabel(/Property Value/i).fill('us-east-1');
    await page.getByRole('button', { name: /Save Property/i }).click();

    await expect(page.getByText('deployment-region')).toBeVisible();
    await expect(page.getByText('us-east-1')).toBeVisible();

    await page.getByRole('button', { name: /Save/i }).click();
    await expect(page.getByText(/Saved successfully/i)).toBeVisible();
  });

  test('UC-4.11: System Users & Authorized Privileges', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const sspId = await apiSetup.createSsp();
    await page.goto(`/ssps/${sspId}?edit=true&w=${apiSetup.workspaceId}`);

    // Navigate to System Implementation tab
    await page.getByRole('tab', { name: /System Implementation/i }).click();
    
    // Sub-tab Users
    await page.getByRole('tab', { name: /Users/i }).click();

    await page.getByRole('button', { name: /Add User/i }).click();
    
    // Fill user details
    await page.getByLabel(/Title/i).fill('Database Administrator');
    await page.getByLabel(/Short Name/i).fill('DBA');
    
    // Functions & Privileges (this might be a specific text area or array of inputs)
    const roleIdInput = page.getByLabel(/Role ID/i);
    await roleIdInput.fill('dba-role');

    // Functions
    const functionInput = page.getByLabel(/Functions/i);
    if (await functionInput.isVisible()) {
        await functionInput.fill('Manage database schemas and backups');
    }

    await page.getByRole('button', { name: /Save User/i }).click();

    // Verify user added
    await expect(page.getByText('Database Administrator')).toBeVisible();
    await expect(page.getByText('dba-role')).toBeVisible();
    
    await page.getByRole('button', { name: /Save/i }).click();
    await expect(page.getByText(/Saved successfully/i)).toBeVisible();
  });

  test('UC-4.13: Inventory Items & Asset Tracking', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const sspId = await apiSetup.createSsp();
    await page.goto(`/ssps/${sspId}?edit=true&w=${apiSetup.workspaceId}`);

    // Navigate to System Implementation tab -> Inventory Items
    await page.getByRole('tab', { name: /System Implementation/i }).click();
    await page.getByRole('tab', { name: /Inventory Items/i }).click();

    await page.getByRole('button', { name: /Add Inventory Item/i }).click();

    await page.getByLabel(/Description/i).fill('Primary Database Server');
    
    // Asset Specifications
    const assetIdInput = page.getByLabel(/Asset ID/i);
    if (await assetIdInput.isVisible()) {
      await assetIdInput.fill('asset-db-01');
    }
    
    const typeSelect = page.getByLabel(/Asset Type/i);
    if (await typeSelect.isVisible()) {
      await typeSelect.selectOption('software');
    }

    await page.getByRole('button', { name: /Save Item/i }).click();

    await expect(page.getByText('Primary Database Server')).toBeVisible();
    
    await page.getByRole('button', { name: /Save/i }).click();
    await expect(page.getByText(/Saved successfully/i)).toBeVisible();
  });

  test('UC-4.14: Leveraged Authorizations', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const sspId = await apiSetup.createSsp();
    await page.goto(`/ssps/${sspId}?edit=true&w=${apiSetup.workspaceId}`);

    // Navigate to System Implementation tab -> Leveraged Authorizations
    await page.getByRole('tab', { name: /System Implementation/i }).click();
    await page.getByRole('tab', { name: /Leveraged Authorizations/i }).click();

    await page.getByRole('button', { name: /Add Leveraged Authorization/i }).click();

    await page.getByLabel(/Authorization Title/i).fill('AWS FedRAMP High Authorization');
    await page.getByLabel(/Date Authorized/i).fill('2022-05-10');
    
    const authBody = page.getByLabel(/Authorization Body/i);
    if (await authBody.isVisible()) {
      await authBody.fill('FedRAMP PMO');
    }

    await page.getByRole('button', { name: /Save Authorization/i }).click();

    await expect(page.getByText('AWS FedRAMP High Authorization')).toBeVisible();

    await page.getByRole('button', { name: /Save/i }).click();
    await expect(page.getByText(/Saved successfully/i)).toBeVisible();
  });

  test('UC-4.5: System Information Types & FIPS-199 Categorization', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const sspId = await apiSetup.createSsp();
    await page.goto(`/ssps/${sspId}?edit=true&w=${apiSetup.workspaceId}`);

    // Navigate to System Characteristics tab
    await page.getByRole('tab', { name: /System Characteristics/i }).click();

    // Security Impact Levels (CIA)
    const confSelect = page.getByLabel(/Confidentiality Impact/i);
    await expect(confSelect).toBeVisible();
    await confSelect.selectOption('moderate');

    const intSelect = page.getByLabel(/Integrity Impact/i);
    await expect(intSelect).toBeVisible();
    await intSelect.selectOption('moderate');

    const availSelect = page.getByLabel(/Availability Impact/i);
    await expect(availSelect).toBeVisible();
    await availSelect.selectOption('low');

    // Information Types
    const addInfoTypeBtn = page.getByRole('button', { name: /Add Information Type/i });
    if (await addInfoTypeBtn.isVisible()) {
      await addInfoTypeBtn.click();
      await page.getByLabel(/Information Type Title/i).fill('Financial Data');
      await page.getByLabel(/Description/i).fill('Customer billing information');
      await page.getByRole('button', { name: /Save Information Type/i }).click();
      await expect(page.getByText('Financial Data')).toBeVisible();
    }

    await page.getByRole('button', { name: /Save/i }).click();
    await expect(page.getByText(/Saved successfully/i)).toBeVisible();
  });
});
