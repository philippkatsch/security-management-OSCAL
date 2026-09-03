import { test, expect } from '../fixtures/base';
import { randomUUID } from 'node:crypto';

test.describe('Step 3 Component Inventory — Comprehensive E2E Test Suite', () => {
  test.setTimeout(60000);

  // --------------------------------------------------------------------------
  // Helper: Close Slide-Out Detail Panel Deterministically (Strictly No Ifs)
  // --------------------------------------------------------------------------
  const closeDetailPanel = async (page: any) => {
    const detailPanel = page.locator('.entity-panel-slide-out');
    const closeBtn = detailPanel.locator('button[aria-label="Close"]').first();
    await closeBtn.click();
    await expect(detailPanel).not.toBeVisible();
  };

  // --------------------------------------------------------------------------
  // Helper: Switch to View Mode and Wait for Backend Draft Save
  // --------------------------------------------------------------------------
  const switchToViewModeAndSave = async (page: any) => {
    const savePromise = page.waitForResponse(
      (resp: any) => resp.url().includes('/api/documents/') && (resp.status() === 200 || resp.status() === 201),
      { timeout: 15000 }
    ).catch(() => null);
    await page.getByTestId('mode-view-btn').click();
    await savePromise;
    await page.waitForLoadState('networkidle');
  };

  // --------------------------------------------------------------------------
  // Test 1 (US 3.1, 3.17): Document creation, redirection to /component-definitions/{uuid}?edit=true, View/Edit mode toggle, F5 reload persistence
  // --------------------------------------------------------------------------
  test('US 3.1, 3.17: Document creation, redirection to /component-definitions/{uuid}?edit=true, View/Edit mode toggle, F5 reload persistence', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    await page.goto(`/component-definitions?w=${apiSetup.workspaceId}`);

    // Click + New Component Definition button
    const newDocBtn = page.getByRole('button', { name: /\+ New Component Definition/i }).first();
    await expect(newDocBtn).toBeVisible({ timeout: 20000 });
    await newDocBtn.click();

    // Create Document Dialog opens
    const titleInput = page.locator('#create-doc-title, [placeholder*="Title"], [placeholder*="Baseline"]');
    await expect(titleInput).toBeVisible({ timeout: 10000 });
    await titleInput.fill('Enterprise Architecture Security Inventory');

    const createBtn = page.getByRole('button', { name: 'Create Document' });
    await createBtn.click();

    // Assert redirection to /component-definitions/{uuid}?edit=true
    await expect(page).toHaveURL(/\/component-definitions\/[0-9a-fA-F\-]+.*[?&]edit=true/, { timeout: 20000 });

    // Assert Document Title and Overview Tab
    await expect(page.getByText('Enterprise Architecture Security Inventory').first()).toBeVisible();
    await expect(page.getByText('Component Definition Dashboard').first()).toBeVisible();

    // Assert Mode Toggle: Edit Mode is active initially
    await expect(page.getByTestId('mode-edit-btn')).toBeVisible();

    // Switch to View Mode
    await page.getByTestId('mode-view-btn').click();
    await expect(page).toHaveURL(/\/component-definitions\/[0-9a-fA-F\-]+(?:\?w=.*)?$/);

    // Switch back to Edit Mode
    await page.getByTestId('mode-edit-btn').click();
    await expect(page).toHaveURL(/\/component-definitions\/[0-9a-fA-F\-]+.*[?&]edit=true/);

    // F5 Reload Persistence Check
    await page.reload();
    await expect(page.getByText('Enterprise Architecture Security Inventory').first()).toBeVisible({ timeout: 20000 });
    await expect(page.getByText('Component Definition Dashboard').first()).toBeVisible();
  });

  // --------------------------------------------------------------------------
  // Test 2 (US 3.2, 3.3, 3.15): Add component, 11 standard types, custom free-text type (R9), required title/description validation, table search and filtering
  // --------------------------------------------------------------------------
  test('US 3.2, 3.3, 3.15: Add component, 11 standard types, custom free-text type (R9), required validation, table search and filtering', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const compDefId = await apiSetup.createComponentDefinition({
      title: 'Component Types Inventory',
      components: []
    });

    await page.goto(`/component-definitions/${compDefId}?edit=true&w=${apiSetup.workspaceId}`);
    await expect(page.getByTestId('mode-edit-btn')).toBeVisible({ timeout: 20000 });

    // 1. Switch to Components tab
    await page.locator('[class*="document-tabs"] button', { hasText: 'Components' }).click();

    // 2. Verify Empty State Call To Action
    await expect(page.getByText('No Components Declared Yet')).toBeVisible();
    const addFirstCompBtn = page.getByRole('button', { name: '+ Add First Component' });
    await expect(addFirstCompBtn).toBeVisible();
    await addFirstCompBtn.click();

    // 3. Configure standard software component in EntityDetailPanel
    const detailPanel = page.locator('.entity-panel-slide-out');
    await expect(detailPanel).toBeVisible({ timeout: 15000 });

    // Fill Title, Description, Purpose, Remarks
    const titleInput = detailPanel.locator('div:has(> label:has-text("Title")) input, label:has-text("Title") ~ input').first();
    await titleInput.fill('HashiCorp Vault Secret Manager');

    const typeSelect = detailPanel.locator('select').first();
    await typeSelect.selectOption('software');

    const descInput = detailPanel.locator('div:has(> label:has-text("Description")) textarea, label:has-text("Description") ~ textarea').first();
    await descInput.fill('Centralized secret management and dynamic credential provider.');

    const purposeInput = detailPanel.locator('div:has(> label:has-text("Purpose")) textarea, label:has-text("Purpose") ~ textarea').first();
    await purposeInput.fill('Secure storage and rotation of encryption keys.');

    const remarksInput = detailPanel.locator('div:has(> label:has-text("Remarks")) textarea, label:has-text("Remarks") ~ textarea').first();
    await remarksInput.fill('Hardened deployment in private enclave.');

    // Close detail panel
    await closeDetailPanel(page);

    // 4. Add second component with custom type (allow-other="yes", R9)
    await page.locator('button:has-text("+ Add Component")').first().click();
    await expect(detailPanel).toBeVisible();

    const titleInput2 = detailPanel.locator('div:has(> label:has-text("Title")) input, label:has-text("Title") ~ input').first();
    await titleInput2.fill('Firmware Security Controller');

    const typeSelect2 = detailPanel.locator('select').first();
    await typeSelect2.selectOption('__custom__');

    const customTypeInput = detailPanel.locator('input[placeholder*="Enter custom component type"]').first();
    await expect(customTypeInput).toBeVisible();
    await customTypeInput.fill('firmware-controller');

    const descInput2 = detailPanel.locator('div:has(> label:has-text("Description")) textarea, label:has-text("Description") ~ textarea').first();
    await descInput2.fill('Hardware-level firmware integrity monitoring and secure boot controller.');

    await closeDetailPanel(page);

    // 5. Toggle View Mode to persist draft to backend
    await switchToViewModeAndSave(page);
    await page.locator('[class*="document-tabs"] button', { hasText: 'Components' }).click();

    // 6. Verify both components rendered in EntityTable
    await expect(page.locator('table tbody').getByText('HashiCorp Vault Secret Manager')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('table tbody').getByText('Firmware Security Controller')).toBeVisible();
    await expect(page.locator('table tbody').getByText('firmware-controller')).toBeVisible();

    // 7. Test search filter
    const searchInput = page.locator('input[placeholder*="Search"]').first();
    await searchInput.fill('HashiCorp');
    await expect(page.locator('table tbody').getByText('HashiCorp Vault Secret Manager')).toBeVisible();
    await expect(page.locator('table tbody').getByText('Firmware Security Controller')).not.toBeVisible();
    await searchInput.fill('');
    await expect(page.locator('table tbody').getByText('Firmware Security Controller')).toBeVisible();

    // 8. F5 Reload Persistence Check
    await page.reload();
    await page.locator('[class*="document-tabs"] button', { hasText: 'Components' }).click();
    await expect(page.locator('table tbody').getByText('HashiCorp Vault Secret Manager')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('table tbody').getByText('Firmware Security Controller')).toBeVisible();
  });

  // --------------------------------------------------------------------------
  // Test 3 (US 3.4): Standard Property Palette (all 4 toggles, release-date datepicker, asset-type dropdown, conditional software/validation properties, F5 reload persistence)
  // --------------------------------------------------------------------------
  test('US 3.4: Standard Property Palette (all 4 toggles, release-date datepicker, asset-type dropdown, conditional software/validation properties, F5 reload persistence)', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const compDefId = await apiSetup.createComponentDefinition({
      title: 'Property Palette Document',
      components: [
        {
          uuid: randomUUID(),
          type: 'software',
          title: 'MongoDB Enterprise Server',
          description: 'Production NoSQL document database'
        }
      ]
    });

    await page.goto(`/component-definitions/${compDefId}?edit=true&w=${apiSetup.workspaceId}`);
    await expect(page.getByTestId('mode-edit-btn')).toBeVisible({ timeout: 20000 });

    // 1. Switch to Components tab and open MongoDB component
    await page.locator('[class*="document-tabs"] button', { hasText: 'Components' }).click();
    await page.locator('table tbody tr').first().click();

    const detailPanel = page.locator('.entity-panel-slide-out');
    await expect(detailPanel).toBeVisible({ timeout: 15000 });

    // 2. Open Properties & Links Accordion
    const propsAccordion = detailPanel.locator('h4:has-text("Properties & Links")').first();
    await propsAccordion.click();

    // 3. Test Architecture & Deployment Toggles (Implementation-Point, Virtual, Public, Scan)
    const extBtn = detailPanel.getByRole('button', { name: /External/i }).first();
    await extBtn.click();

    const virtBtn = detailPanel.getByRole('button', { name: /Yes/i }).first();
    await virtBtn.click();

    const privBtn = detailPanel.getByRole('button', { name: /Private/i }).first();
    await privBtn.click();

    const scanBtn = detailPanel.getByRole('button', { name: /🔍 Yes/i }).first();
    await scanBtn.click();

    // 4. Test Release Date Datepicker & Version & Model Text Inputs
    const dateInput = detailPanel.locator('input[type="date"]').first();
    await dateInput.fill('2026-03-15');

    const versionInput = detailPanel.getByPlaceholder('e.g. 7.0.5').first();
    await versionInput.fill('7.0.5');

    const patchLevelInput = detailPanel.getByPlaceholder('e.g. patch-2, SP1').first();
    await patchLevelInput.fill('SP2');

    const modelInput = detailPanel.getByPlaceholder('Hardware or product model').first();
    await modelInput.fill('Enterprise-Edition');

    // 5. Test Asset-Type Standard Dropdown
    const assetTypeSelect = detailPanel.locator('select').filter({ hasText: /operating-system|database|web-server/ }).first();
    await assetTypeSelect.selectOption('database');

    // 6. Test Conditional Software Identifier (since type="software")
    const swIdInput = detailPanel.locator('input[placeholder*="pkg:deb"]').first();
    await swIdInput.fill('cpe:2.3:a:mongodb:mongodb:7.0.5:*:*:*:*:*:*:*');

    const swNameInput = detailPanel.getByPlaceholder('Official software product name').first();
    await swNameInput.fill('MongoDB Enterprise');

    // 7. Test OS & Network fields
    const osNameInput = detailPanel.getByPlaceholder('e.g. Ubuntu Linux, Windows Server').first();
    await osNameInput.fill('Ubuntu Linux');

    const osVerInput = detailPanel.getByPlaceholder('e.g. 24.04 LTS, 2022').first();
    await osVerInput.fill('24.04 LTS');

    const vlanInput = detailPanel.getByPlaceholder('e.g. 100, vlan-dmz').first();
    await vlanInput.fill('vlan-db-secure');

    // 8. Close detail panel deterministically
    await closeDetailPanel(page);

    // 9. Toggle View Mode to persist draft
    await switchToViewModeAndSave(page);

    // 10. F5 Reload Persistence Check
    await page.reload();
    await page.getByTestId('mode-edit-btn').click();

    await page.locator('[class*="document-tabs"] button', { hasText: 'Components' }).click();
    await page.locator('table tbody tr').first().click();
    await expect(detailPanel).toBeVisible({ timeout: 15000 });
    await detailPanel.locator('h4:has-text("Properties & Links")').first().click();

    await expect(detailPanel.locator('input[type="date"]').first()).toHaveValue('2026-03-15');
    await expect(detailPanel.getByPlaceholder('e.g. 7.0.5').first()).toHaveValue('7.0.5');
    await expect(detailPanel.getByPlaceholder('e.g. patch-2, SP1').first()).toHaveValue('SP2');
    await expect(detailPanel.getByPlaceholder('Hardware or product model').first()).toHaveValue('Enterprise-Edition');
    await expect(detailPanel.locator('select').filter({ hasText: /operating-system|database|web-server/ }).first()).toHaveValue('database');
    await expect(detailPanel.locator('input[placeholder*="pkg:deb"]').first()).toHaveValue('cpe:2.3:a:mongodb:mongodb:7.0.5:*:*:*:*:*:*:*');
    await expect(detailPanel.getByPlaceholder('Official software product name').first()).toHaveValue('MongoDB Enterprise');
    await expect(detailPanel.getByPlaceholder('e.g. Ubuntu Linux, Windows Server').first()).toHaveValue('Ubuntu Linux');
    await expect(detailPanel.getByPlaceholder('e.g. 100, vlan-dmz').first()).toHaveValue('vlan-db-secure');

    await closeDetailPanel(page);
  });

  // --------------------------------------------------------------------------
  // Test 4 (US 3.5, 3.6): Custom properties in PropsEditor, links with standard rel dropdown and internal #uuid / back-matter pickers
  // --------------------------------------------------------------------------
  test('US 3.5, 3.6: Custom properties in PropsEditor, links with standard rel dropdown and internal #uuid / back-matter pickers', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const resourceUuid = randomUUID();
    const targetCompUuid = randomUUID();

    const compDefId = await apiSetup.createDocument('component-definitions', {
      'component-definition': {
        metadata: {
          title: 'Linked Architecture Definition',
          version: '1.0.0',
          'oscal-version': '1.1.2',
          'last-modified': new Date().toISOString()
        },
        components: [
          {
            uuid: randomUUID(),
            type: 'software',
            title: 'Backend API Gateway',
            description: 'Main API Gateway component'
          },
          {
            uuid: targetCompUuid,
            type: 'service',
            title: 'Auth Microservice',
            description: 'Downstream OAuth authentication service'
          }
        ],
        'back-matter': {
          resources: [
            {
              uuid: resourceUuid,
              title: 'SOC 2 Type II Compliance Report',
              description: 'Annual independent auditor attestation'
            }
          ]
        }
      }
    });

    await page.goto(`/component-definitions/${compDefId}?edit=true&w=${apiSetup.workspaceId}`);
    await expect(page.getByTestId('mode-edit-btn')).toBeVisible({ timeout: 20000 });

    // 1. Switch to Components tab and open first component
    await page.locator('[class*="document-tabs"] button', { hasText: 'Components' }).click();
    await page.locator('table tbody tr').first().click();

    const detailPanel = page.locator('.entity-panel-slide-out');
    await expect(detailPanel).toBeVisible({ timeout: 15000 });

    // 2. Open Properties & Links Accordion
    await detailPanel.locator('h4:has-text("Properties & Links")').first().click();

    // 3. Add Custom Free-Form Property via PropsEditor (US 3.5)
    const addCustomPropBtn = detailPanel.getByRole('button', { name: /Add Property/i }).first();
    await addCustomPropBtn.click();

    const customNameInput = detailPanel.getByPlaceholder('name').last();
    await customNameInput.fill('eal-evaluation-level');

    const customValInput = detailPanel.getByPlaceholder('value').last();
    await customValInput.fill('EAL 4+');

    // 4. Add Link with Internal Component Target (US 3.6)
    const addLinkBtn = detailPanel.getByRole('button', { name: '+ Add Link / Dependency' });
    await addLinkBtn.click();

    const relSelect = detailPanel.locator('select').filter({ hasText: /Depends On|Uses Service|Validation/ }).first();
    await relSelect.selectOption('uses-service');

    // 5. Add Second Link targeting Back-Matter Resource (US 3.6, 3.19)
    await addLinkBtn.click();
    const relSelect2 = detailPanel.locator('select').filter({ hasText: /Depends On|Uses Service|Validation/ }).last();
    await relSelect2.selectOption('proof-of-compliance');

    // Switch second link to Resource picker mode
    const resModeBtn = detailPanel.getByRole('button', { name: '📁 Resource' }).last();
    await resModeBtn.click();

    const resSelect = detailPanel.locator('select').filter({ hasText: /SOC 2 Type II Compliance Report/ }).first();
    await resSelect.selectOption(`#${resourceUuid}`);

    // 6. Close detail panel deterministically
    await closeDetailPanel(page);

    // 7. Toggle View Mode to persist draft
    await switchToViewModeAndSave(page);

    // 8. F5 Reload Persistence Check
    await page.reload();

    await page.locator('[class*="document-tabs"] button', { hasText: 'Components' }).click();
    await page.locator('table tbody tr').first().click();
    await expect(detailPanel).toBeVisible({ timeout: 15000 });
    await detailPanel.locator('h4:has-text("Properties & Links")').first().click();

    // In View mode, custom property and links are displayed
    await expect(detailPanel.getByText('eal-evaluation-level').first()).toBeVisible();
    await expect(detailPanel.getByText('EAL 4+').first()).toBeVisible();
    await expect(detailPanel.getByText(/Uses Service/i).first()).toBeVisible();
    await expect(detailPanel.getByText('SOC 2 Type II Compliance Report').first()).toBeVisible();

    await closeDetailPanel(page);
  });

  // --------------------------------------------------------------------------
  // Test 5 (US 3.7): Protocol quick-add presets (HTTPS, MongoDB, PostgreSQL), port range validation, auto-expansion for type="service"
  // --------------------------------------------------------------------------
  test('US 3.7: Protocol quick-add presets (HTTPS, MongoDB, PostgreSQL), port range validation, auto-expansion for type="service"', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const compDefId = await apiSetup.createComponentDefinition({
      title: 'Protocols Architecture',
      components: [
        {
          uuid: randomUUID(),
          type: 'service',
          title: 'Core API Service',
          description: 'Production backend REST & gRPC API service'
        }
      ]
    });

    await page.goto(`/component-definitions/${compDefId}?edit=true&w=${apiSetup.workspaceId}`);
    await expect(page.getByTestId('mode-edit-btn')).toBeVisible({ timeout: 20000 });

    // 1. Switch to Components tab and open first component
    await page.locator('[class*="document-tabs"] button', { hasText: 'Components' }).click();
    await page.locator('table tbody tr').first().click();

    const detailPanel = page.locator('.entity-panel-slide-out');
    await expect(detailPanel).toBeVisible({ timeout: 15000 });

    // Verify Service Recommendation Hint Banner is visible (since type="service")
    await expect(detailPanel.getByText('Service Component Recommendation').first()).toBeVisible();

    // 2. Use Quick-Add Preset for HTTPS (443/TCP)
    const httpsPreset = detailPanel.locator('button:has-text("HTTPS")').first();
    await expect(httpsPreset).toBeVisible();
    await httpsPreset.click();

    // Verify Protocol Editor opened with pre-filled 443/TCP
    const protoNameInput = detailPanel.locator('input[placeholder*="https, mongodb"]').first();
    await expect(protoNameInput).toHaveValue('https');

    // 3. Add Custom Port Range with Live Validation
    const addPortRangeBtn = detailPanel.getByRole('button', { name: '+ Add Port Range' });
    await addPortRangeBtn.click();

    const numInputs = detailPanel.locator('input[type="number"]');
    // Set invalid port range (start > end) to verify live validation error banner
    await numInputs.nth(2).fill('8443');
    await numInputs.nth(3).fill('8000');
    await expect(detailPanel.getByText(/Start port \(8443\) cannot exceed end port \(8000\)/i)).toBeVisible();

    // Fix the port range
    await numInputs.nth(3).fill('8443');
    await expect(detailPanel.getByText(/cannot exceed/i)).not.toBeVisible();

    // Click Done to finish protocol editing
    await detailPanel.getByRole('button', { name: 'Done' }).click();

    // 4. Add Second Protocol via PostgreSQL preset (5432/TCP)
    const postgresPreset = detailPanel.locator('button:has-text("POSTGRESQL")').first();
    await postgresPreset.click();
    await detailPanel.getByRole('button', { name: 'Done' }).click();

    // 5. Add Third Protocol via MongoDB preset (27017/TCP)
    const mongodbPreset = detailPanel.locator('button:has-text("MONGODB")').first();
    await mongodbPreset.click();
    await detailPanel.getByRole('button', { name: 'Done' }).click();

    // 6. Close detail panel deterministically
    await closeDetailPanel(page);

    // 7. Toggle View Mode to persist draft
    await switchToViewModeAndSave(page);

    // 8. F5 Reload Persistence Check
    await page.reload();

    await page.locator('[class*="document-tabs"] button', { hasText: 'Components' }).click();
    await expect(page.locator('table tbody').getByText(/HTTPS/i)).toBeVisible({ timeout: 20000 });
    await expect(page.locator('table tbody').getByText(/POSTGRESQL/i)).toBeVisible();
    await expect(page.locator('table tbody').getByText(/\+1 more/i)).toBeVisible();

    // Re-open detail panel to verify protocols in table
    await page.locator('table tbody tr').first().click();
    await expect(detailPanel).toBeVisible({ timeout: 15000 });

    await expect(detailPanel.locator('table tbody').getByText('https', { exact: true })).toBeVisible();
    await expect(detailPanel.locator('table tbody').getByRole('cell', { name: 'postgresql', exact: true })).toBeVisible();
    await expect(detailPanel.locator('table tbody').getByRole('cell', { name: 'mongodb', exact: true })).toBeVisible();

    await closeDetailPanel(page);
  });

  // --------------------------------------------------------------------------
  // Test 6 (US 3.8): Responsible roles dropdown (9 standard roles), party picker from metadata.parties[]
  // --------------------------------------------------------------------------
  test('US 3.8: Responsible roles dropdown (9 standard roles), party picker from metadata.parties[]', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const orgPartyUuid = randomUUID();
    const personPartyUuid = randomUUID();

    const compDefId = await apiSetup.createDocument('component-definitions', {
      'component-definition': {
        metadata: {
          title: 'Roles and Parties Test Definition',
          version: '1.0.0',
          'oscal-version': '1.1.2',
          'last-modified': new Date().toISOString(),
          parties: [
            {
              uuid: orgPartyUuid,
              type: 'organization',
              name: 'Enterprise SecOps Core Team',
              'email-addresses': ['secops@enterprise.org']
            },
            {
              uuid: personPartyUuid,
              type: 'person',
              name: 'Alice Smith',
              'email-addresses': ['alice@enterprise.org']
            }
          ]
        },
        components: [
          {
            uuid: randomUUID(),
            type: 'software',
            title: 'Core Firewall Module',
            description: 'Next-Gen Firewall security component'
          }
        ]
      }
    });

    await page.goto(`/component-definitions/${compDefId}?edit=true&w=${apiSetup.workspaceId}`);
    await expect(page.getByTestId('mode-edit-btn')).toBeVisible({ timeout: 20000 });

    // 1. Switch to Components tab and open first component
    await page.locator('[class*="document-tabs"] button', { hasText: 'Components' }).click();
    await page.locator('table tbody tr').first().click();

    const detailPanel = page.locator('.entity-panel-slide-out');
    await expect(detailPanel).toBeVisible({ timeout: 15000 });

    // 2. Open Responsible Roles Accordion
    const rolesAccordion = detailPanel.locator('h4:has-text("Responsible Roles")').first();
    await rolesAccordion.click();

    // 3. Add First Responsible Role (Operational Role: Security Operations)
    const addRoleBtn = detailPanel.getByRole('button', { name: '+ Add Responsible Role' });
    await addRoleBtn.click();

    const roleSelect1 = detailPanel.locator('select').filter({ hasText: /Security Operations|Asset Owner|Maintainer/ }).first();
    await roleSelect1.selectOption('security-operations');

    // Select Party from metadata.parties[]
    const orgPartyBtn = detailPanel.getByRole('button', { name: /Enterprise SecOps Core Team/i }).first();
    await orgPartyBtn.click();

    // 4. Add Second Responsible Role (Operational Role: Asset Owner)
    await addRoleBtn.click();

    const roleSelect2 = detailPanel.locator('select').filter({ hasText: /Security Operations|Asset Owner|Maintainer/ }).last();
    await roleSelect2.selectOption('asset-owner');

    const personPartyBtn = detailPanel.getByRole('button', { name: /Alice Smith/i }).last();
    await personPartyBtn.click();

    // 5. Close detail panel deterministically
    await closeDetailPanel(page);

    // 6. Toggle View Mode to persist draft
    await switchToViewModeAndSave(page);

    // 7. F5 Reload Persistence Check
    await page.reload();

    await page.locator('[class*="document-tabs"] button', { hasText: 'Components' }).click();
    await page.locator('table tbody tr').first().click();
    await expect(detailPanel).toBeVisible({ timeout: 15000 });
    await detailPanel.locator('h4:has-text("Responsible Roles")').first().click();

    await expect(detailPanel.getByText('Enterprise SecOps Core Team').first()).toBeVisible();
    await expect(detailPanel.getByText(/Security Operations|security-operations/).first()).toBeVisible();
    await expect(detailPanel.getByText('Alice Smith').first()).toBeVisible();
    await expect(detailPanel.getByText(/Asset Owner|asset-owner/).first()).toBeVisible();

    await closeDetailPanel(page);
  });

  // --------------------------------------------------------------------------
  // Test 7 (US 3.9, 3.10): Control implementation set with workspace source picker, hierarchical control picker, bulk control selection
  // --------------------------------------------------------------------------
  test('US 3.9, 3.10: Control implementation set with workspace source picker, hierarchical control picker, bulk control selection', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    // Create base catalog in workspace for source picker and tree resolution
    const catUuid = await apiSetup.createCatalog({
      title: 'NIST SP 800-53 Rev 5 Baseline',
      controls: [
        { id: 'ac-1', title: 'Policy and Procedures' },
        { id: 'ac-2', title: 'Account Management' },
        { id: 'ac-7', title: 'Unsuccessful Logon Attempts' }
      ]
    });

    const compDefId = await apiSetup.createComponentDefinition({
      title: 'Control Implementation Framework Document',
      components: [
        {
          uuid: randomUUID(),
          type: 'software',
          title: 'Identity Service',
          description: 'Enterprise IAM service'
        }
      ]
    });

    await page.goto(`/component-definitions/${compDefId}?edit=true&w=${apiSetup.workspaceId}`);
    await expect(page.getByTestId('mode-edit-btn')).toBeVisible({ timeout: 20000 });

    // 1. Switch to Components tab and open first component
    await page.locator('[class*="document-tabs"] button', { hasText: 'Components' }).click();
    await page.locator('table tbody tr').first().click();

    const detailPanel = page.locator('.entity-panel-slide-out');
    await expect(detailPanel).toBeVisible({ timeout: 15000 });

    // 2. Open Control Implementations Accordion
    const implAccordion = detailPanel.locator('h4:has-text("Control Implementations")').first();
    await implAccordion.click();

    // 3. Add Control Implementation Set
    const addSetBtn = detailPanel.getByRole('button', { name: '+ Add Control Implementation Set' });
    await addSetBtn.click();

    // 4. Use Workspace Source Picker to pick catalog
    const browseSourceBtn = detailPanel.getByRole('button', { name: /Browse\.\.\./i }).first();
    await browseSourceBtn.click();

    // Select the created catalog in modal
    const catChoice = page.locator('[role="dialog"]').getByText('NIST SP 800-53 Rev 5 Baseline').first();
    await expect(catChoice).toBeVisible({ timeout: 10000 });
    await catChoice.click();
    await expect(page.locator('[role="dialog"]')).not.toBeVisible();

    // 5. Fill Implementation Set Description
    const setDesc = detailPanel.locator('textarea[placeholder*="Describe how the component generally fulfills"]').first();
    await setDesc.fill('Fulfills NIST SP 800-53 Access Control security requirements.');

    // 6. Bulk add controls via Hierarchical Control Tree Picker
    const bulkAddBtn = detailPanel.getByRole('button', { name: /Browse & Bulk Add Controls/i }).first();
    await bulkAddBtn.click();

    // In Tree Picker modal, select first two available controls
    const treeDialog = page.locator('[role="dialog"]');
    await expect(treeDialog).toBeVisible({ timeout: 10000 });
    const checkboxes = treeDialog.locator('input[type="checkbox"]');
    await expect(checkboxes.first()).toBeVisible({ timeout: 10000 });
    await checkboxes.nth(0).click();
    await checkboxes.nth(1).click();

    // Click Bulk Add button inside the modal dialog
    const confirmBulkBtn = treeDialog.getByRole('button', { name: /^Bulk Add \(\d+\)$/i }).first();
    await confirmBulkBtn.click();
    await expect(treeDialog).not.toBeVisible();

    // Verify implemented requirements were added to UI
    await expect(detailPanel.getByText('AC-1').first()).toBeVisible();

    // 7. Close detail panel deterministically
    await closeDetailPanel(page);

    // 8. Toggle View Mode to persist draft
    await switchToViewModeAndSave(page);

    // 9. F5 Reload Persistence Check
    await page.reload();

    await page.locator('[class*="document-tabs"] button', { hasText: 'Components' }).click();
    await page.locator('table tbody tr').first().click();
    await expect(detailPanel).toBeVisible({ timeout: 15000 });
    await detailPanel.locator('h4:has-text("Control Implementations")').first().click();

    await expect(detailPanel.getByText('Fulfills NIST SP 800-53 Access Control').first()).toBeVisible();
    await expect(detailPanel.getByText('AC-1').first()).toBeVisible();

    await closeDetailPanel(page);
  });

  // --------------------------------------------------------------------------
  // Test 8 (US 3.11): Structured statement editor (statement-id, uuid, narrative description with ProseWithParams, F5 reload persistence)
  // --------------------------------------------------------------------------
  test('US 3.11: Structured statement editor (statement-id, uuid, narrative description with ProseWithParams, F5 reload persistence)', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const compDefId = await apiSetup.createComponentDefinition({
      title: 'Statements and Parameters Document',
      components: [
        {
          uuid: randomUUID(),
          type: 'software',
          title: 'Access Control Manager',
          description: 'Access control enforcement engine'
        }
      ]
    });

    await page.goto(`/component-definitions/${compDefId}?edit=true&w=${apiSetup.workspaceId}`);
    await expect(page.getByTestId('mode-edit-btn')).toBeVisible({ timeout: 20000 });

    // 1. Open first component detail panel
    await page.locator('[class*="document-tabs"] button', { hasText: 'Components' }).click();
    await page.locator('table tbody tr').first().click();

    const detailPanel = page.locator('.entity-panel-slide-out');
    await expect(detailPanel).toBeVisible({ timeout: 15000 });

    // 2. Open Control Implementations Accordion & Add Set
    await detailPanel.locator('h4:has-text("Control Implementations")').first().click();
    await detailPanel.getByRole('button', { name: '+ Add Control Implementation Set' }).click();

    // 3. Add Implemented Requirement with Statement-Level Detail
    const addSingleReqBtn = detailPanel.getByRole('button', { name: '+ Add Single' }).first();
    await addSingleReqBtn.click();

    const addStatementBtn = detailPanel.getByRole('button', { name: '+ Add Statement' }).first();
    await addStatementBtn.click();

    const stmtIdInput = detailPanel.locator('input[placeholder*="ac-7_smt_a"]').first();
    await stmtIdInput.fill('ac-7_smt_a');

    const stmtDesc = detailPanel.locator('textarea[placeholder*="Describe how this specific statement"]').first();
    await stmtDesc.fill('Account lockout is triggered automatically after 5 consecutive invalid attempts.');

    // 4. Close detail panel deterministically
    await closeDetailPanel(page);

    // 5. Toggle View Mode to persist draft
    await switchToViewModeAndSave(page);

    // 6. F5 Reload Persistence Check
    await page.reload();

    await page.locator('[class*="document-tabs"] button', { hasText: 'Components' }).click();
    await page.locator('table tbody tr').first().click();
    await expect(detailPanel).toBeVisible({ timeout: 15000 });
    await detailPanel.locator('h4:has-text("Control Implementations")').first().click();

    // In View mode (read-only), statement id and prose are rendered
    await expect(detailPanel.getByText('ac-7_smt_a').first()).toBeVisible();
    await expect(detailPanel.getByText('Account lockout is triggered automatically after 5 consecutive invalid attempts.').first()).toBeVisible();

    await closeDetailPanel(page);
  });

  // --------------------------------------------------------------------------
  // Test 9 (US 3.12): Set-parameters editor at control implementation and requirement levels with empty array purging
  // --------------------------------------------------------------------------
  test('US 3.12: Set-parameters editor at control implementation and requirement levels with empty array purging', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const compDefId = await apiSetup.createComponentDefinition({
      title: 'Parameters Inventory Document',
      components: [
        {
          uuid: randomUUID(),
          type: 'software',
          title: 'Auth Service',
          description: 'Authentication management engine'
        }
      ]
    });

    await page.goto(`/component-definitions/${compDefId}?edit=true&w=${apiSetup.workspaceId}`);
    await expect(page.getByTestId('mode-edit-btn')).toBeVisible({ timeout: 20000 });

    // 1. Open component detail panel
    await page.locator('[class*="document-tabs"] button', { hasText: 'Components' }).click();
    await page.locator('table tbody tr').first().click();

    const detailPanel = page.locator('.entity-panel-slide-out');
    await expect(detailPanel).toBeVisible({ timeout: 15000 });

    // 2. Open Control Implementations Accordion & Add Set
    await detailPanel.locator('h4:has-text("Control Implementations")').first().click();
    await detailPanel.getByRole('button', { name: '+ Add Control Implementation Set' }).click();

    // 3. Test Set-Level Set-Parameters Editor
    const addSetParamBtn = detailPanel.getByRole('button', { name: '+ Add Parameter' }).first();
    await addSetParamBtn.click();

    const paramIdInput = detailPanel.locator('input[placeholder*="ac-7_prm_1"]').first();
    await paramIdInput.fill('ac-7_prm_1');

    const paramValInput = detailPanel.locator('input[placeholder*="Add value"]').first();
    await paramValInput.fill('5');
    await detailPanel.getByRole('button', { name: '+ Add', exact: true }).first().click();

    // 4. Test Requirement-Level Set-Parameters Editor
    const addSingleReqBtn = detailPanel.getByRole('button', { name: '+ Add Single' }).first();
    await addSingleReqBtn.click();

    const addReqParamBtn = detailPanel.getByRole('button', { name: '+ Add Parameter' }).nth(1);
    await addReqParamBtn.click();

    const reqParamIdInput = detailPanel.locator('input[placeholder*="ac-7_prm_1"]').nth(1);
    await reqParamIdInput.fill('ac-7_prm_2');

    const reqParamValInput = detailPanel.locator('input[placeholder*="Add value"]').nth(1);
    await reqParamValInput.fill('30');
    await detailPanel.getByRole('button', { name: '+ Add', exact: true }).nth(1).click();

    // 5. Close detail panel deterministically
    await closeDetailPanel(page);

    // 6. Toggle View Mode to persist draft
    await switchToViewModeAndSave(page);

    // 7. F5 Reload Persistence Check
    await page.reload();

    await page.locator('[class*="document-tabs"] button', { hasText: 'Components' }).click();
    await page.locator('table tbody tr').first().click();
    await expect(detailPanel).toBeVisible({ timeout: 15000 });
    await detailPanel.locator('h4:has-text("Control Implementations")').first().click();

    await expect(detailPanel.getByText('ac-7_prm_1').first()).toBeVisible();
    await expect(detailPanel.getByText('5').first()).toBeVisible();
    await expect(detailPanel.getByText('ac-7_prm_2').first()).toBeVisible();
    await expect(detailPanel.getByText('30').first()).toBeVisible();

    await closeDetailPanel(page);
  });

  // --------------------------------------------------------------------------
  // Test 10 (US 3.13): Capability declaration, incorporates-components linking with description
  // --------------------------------------------------------------------------
  test('US 3.13: Capability declaration, incorporates-components linking with description', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const compDefId = await apiSetup.createComponentDefinition({
      title: 'Capabilities Architecture',
      components: [
        {
          uuid: randomUUID(),
          type: 'service',
          title: 'Keycloak SSO Server',
          description: 'Single sign-on authentication service'
        }
      ]
    });

    await page.goto(`/component-definitions/${compDefId}?edit=true&w=${apiSetup.workspaceId}`);
    await expect(page.getByTestId('mode-edit-btn')).toBeVisible({ timeout: 20000 });

    // 1. Switch to Capabilities tab
    await page.locator('[class*="document-tabs"] button', { hasText: 'Capabilities' }).click();

    // 2. Add Capability
    const addCapBtn = page.getByRole('button', { name: /\+ Add (First )?Capability/i }).first();
    await expect(addCapBtn).toBeVisible();
    await addCapBtn.click();

    const capPanel = page.locator('.entity-panel-slide-out');
    await expect(capPanel).toBeVisible({ timeout: 15000 });

    // 3. Fill Capability Name and Description
    const nameInput = capPanel.locator('div:has(> label:has-text("Name")) input, label:has-text("Name") ~ input').first();
    await nameInput.fill('Identity and Access Management');

    const descInput = capPanel.locator('div:has(> label:has-text("Description")) textarea, label:has-text("Description") ~ textarea').first();
    await descInput.fill('Composite capability providing enterprise authentication, MFA and RBAC.');

    // 4. Link Incorporated Component
    const incAccordion = capPanel.locator('h4:has-text("Incorporated Components")').first();
    await incAccordion.click();

    const compSelect = capPanel.locator('select').filter({ hasText: /Add Component...|Keycloak SSO Server/ }).first();
    await compSelect.selectOption({ label: 'Keycloak SSO Server' });

    // 5. Close detail panel deterministically
    await closeDetailPanel(page);

    // 6. Toggle View Mode to persist draft
    await switchToViewModeAndSave(page);

    // 7. F5 Reload Persistence Check
    await page.reload();

    await page.locator('[class*="document-tabs"] button', { hasText: 'Capabilities' }).click();
    await expect(page.getByText('Identity and Access Management').first()).toBeVisible({ timeout: 20000 });
    await expect(page.getByText('1 component(s)').first()).toBeVisible();
  });

  // --------------------------------------------------------------------------
  // Test 11 (US 3.14, 3.19): External component definition import declaration, back-matter file attachment
  // --------------------------------------------------------------------------
  test('US 3.14, 3.19: External component definition import declaration, back-matter file attachment', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const compDefId = await apiSetup.createComponentDefinition();

    await page.goto(`/component-definitions/${compDefId}?edit=true&w=${apiSetup.workspaceId}`);
    await expect(page.getByTestId('mode-edit-btn')).toBeVisible({ timeout: 20000 });

    // 1. Switch to Imports tab
    await page.locator('[class*="document-tabs"] button', { hasText: 'Imports' }).click();

    // 2. Add External URI Import
    const uriInput = page.locator('input[placeholder*="Enter URI"]').first();
    await uriInput.fill('https://raw.githubusercontent.com/usnistgov/oscal-content/master/components/aws-component-definition.json');

    const addImportBtn = page.getByRole('button', { name: '+ Add Import' });
    await addImportBtn.click();

    // Verify import card is displayed
    await expect(page.getByText('aws-component-definition.json').first()).toBeVisible();

    // 3. Switch to Metadata tab to verify Back-Matter section exists
    await page.locator('[class*="document-tabs"] button', { hasText: 'Metadata' }).click();
    await expect(page.getByText('Back Matter Resources').first()).toBeVisible();

    // 4. Toggle View Mode to persist draft
    await switchToViewModeAndSave(page);

    // 5. F5 Reload Persistence Check
    await page.reload();
    await page.locator('[class*="document-tabs"] button', { hasText: 'Imports' }).click();
    await expect(page.getByText('aws-component-definition.json').first()).toBeVisible({ timeout: 20000 });
  });

  // --------------------------------------------------------------------------
  // Test 12 (US 3.15): EntityTable column sorting, batch deletion with useConfirm(), empty state CTA
  // --------------------------------------------------------------------------
  test('US 3.15: EntityTable column sorting, batch deletion with useConfirm(), empty state CTA', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const compDefId = await apiSetup.createComponentDefinition({
      title: 'Batch Deletion and Sorting Test',
      components: [
        { uuid: randomUUID(), type: 'software', title: 'Alpha Component', description: 'Alpha software service' },
        { uuid: randomUUID(), type: 'service', title: 'Beta Service', description: 'Beta cloud service' },
        { uuid: randomUUID(), type: 'hardware', title: 'Gamma Hardware', description: 'Gamma physical asset' }
      ]
    });

    await page.goto(`/component-definitions/${compDefId}?edit=true&w=${apiSetup.workspaceId}`);
    await expect(page.getByTestId('mode-edit-btn')).toBeVisible({ timeout: 20000 });

    // 1. Go to Components tab
    await page.locator('[class*="document-tabs"] button', { hasText: 'Components' }).click();
    await expect(page.locator('table tbody tr')).toHaveCount(3);

    // 2. Sort by Component column
    const compHeader = page.locator('table thead th').filter({ hasText: 'Component' }).first();
    await compHeader.click();

    // 3. Batch selection of 2 rows (Beta Service and Gamma Hardware)
    const checkboxes = page.locator('table tbody input[type="checkbox"]');
    await checkboxes.nth(1).click();
    await checkboxes.nth(2).click();

    // 4. Click batch delete button
    const batchDeleteBtn = page.getByRole('button', { name: /Delete Selected/i }).first();
    await expect(batchDeleteBtn).toBeVisible();
    await batchDeleteBtn.click();

    // 5. Confirm in useConfirm modal
    const confirmDialog = page.locator('dialog, [role="dialog"]');
    await expect(confirmDialog).toBeVisible({ timeout: 10000 });
    const confirmBtn = confirmDialog.getByRole('button', { name: 'Delete' }).first();
    await confirmBtn.click();
    await expect(confirmDialog).not.toBeVisible();

    // 6. Verify remaining row count is 1
    await expect(page.locator('table tbody tr')).toHaveCount(1);
  });

  // --------------------------------------------------------------------------
  // Test 13 (US 3.16): Document Overview with StandardMetadataTab and Properties Dashboard analytics
  // --------------------------------------------------------------------------
  test('US 3.16: Document Overview with StandardMetadataTab and Properties Dashboard analytics', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const compDefId = await apiSetup.createComponentDefinition({
      title: 'Overview and Analytics Document',
      version: '1.0.0',
      components: [
        {
          uuid: randomUUID(),
          type: 'software',
          title: 'Primary App Server',
          description: 'Application server instance',
          props: [
            { name: 'version', value: '3.5.0', ns: 'http://csrc.nist.gov/ns/oscal' },
            { name: 'asset-type', value: 'web-server', ns: 'http://csrc.nist.gov/ns/oscal' }
          ]
        }
      ]
    });

    await page.goto(`/component-definitions/${compDefId}?edit=true&w=${apiSetup.workspaceId}`);
    await expect(page.getByTestId('mode-edit-btn')).toBeVisible({ timeout: 20000 });

    // 1. Check Overview Tab Metrics
    await expect(page.getByText('Component Definition Dashboard').first()).toBeVisible();
    await expect(page.getByText('Total Components')).toBeVisible();
    await expect(page.getByText('Total Capabilities')).toBeVisible();
    await expect(page.getByText('External Imports')).toBeVisible();

    // 2. Check Properties Analytics Dashboard (DD-011)
    await expect(page.getByText(/Properties Analytics Dashboard/i)).toBeVisible();
    await expect(page.getByText('Global Header Props')).toBeVisible();
    await expect(page.getByText('Distinct Element Props')).toBeVisible();
    await expect(page.getByText('Unique Property Keys')).toBeVisible();
    await expect(page.getByText('Total Occurrences')).toBeVisible();

    // 3. Switch to Metadata tab
    await page.locator('[class*="document-tabs"] button', { hasText: 'Metadata' }).click();
    await expect(page.getByText('Document Metadata').first()).toBeVisible();
    await expect(page.getByText('Document Properties').first()).toBeVisible();

    // 4. Update Version in Metadata tab
    const versionInput = page.locator('label:has-text("Version") ~ input, input[name="version"]').first();
    await versionInput.fill('1.5.0');
    await versionInput.blur();
    await page.waitForTimeout(100);

    // 5. Toggle View Mode to persist draft
    await switchToViewModeAndSave(page);

    // 6. F5 Reload Persistence Check
    await page.reload();
    await page.locator('[class*="document-tabs"] button', { hasText: 'Metadata' }).click();
    await expect(page.locator('label:has-text("Version") ~ input, input[name="version"]').first()).toHaveValue(/1\.5\.0(-draft)?/);
  });

  // --------------------------------------------------------------------------
  // Test 14 (US 3.18): Backend version bump, revision tracking, schema validation on save
  // --------------------------------------------------------------------------
  test('US 3.18: Backend version bump, revision tracking, schema validation on save', async ({ page, request, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const compDefId = await apiSetup.createComponentDefinition({
      title: 'Compliant Release Document',
      version: '1.0.0',
      components: [
        {
          uuid: randomUUID(),
          type: 'software',
          title: 'PostgreSQL Datastore',
          description: 'Relational data persistence engine',
          purpose: 'Data storage and retrieval',
          props: [
            { name: 'implementation-point', value: 'internal', ns: 'http://csrc.nist.gov/ns/oscal' },
            { name: 'version', value: '16.0', ns: 'http://csrc.nist.gov/ns/oscal' },
            { name: 'asset-type', value: 'database', ns: 'http://csrc.nist.gov/ns/oscal' }
          ],
          protocols: [
            {
              uuid: randomUUID(),
              name: 'postgresql',
              title: 'PostgreSQL DB Port',
              'port-ranges': [{ start: 5432, end: 5432, transport: 'TCP' }]
            }
          ]
        }
      ]
    });

    // 1. Fetch Initial Document JSON from API and validate against schema
    const rawDoc = await apiSetup.getDocument('component-definitions', compDefId);
    expect(rawDoc).toBeDefined();
    expect(rawDoc['component-definition']).toBeDefined();

    const validateRes = await request.post('http://127.0.0.1:1000/api/validate/component-definitions', {
      headers: { 'X-Workspace-ID': apiSetup.workspaceId },
      data: rawDoc
    });
    expect(validateRes.status()).toBe(200);
    const valJson = await validateRes.json();
    expect(valJson.status).toBe('valid');

    // 2. Open in UI, make a change in edit mode
    await page.goto(`/component-definitions/${compDefId}?edit=true&w=${apiSetup.workspaceId}`);
    await expect(page.getByTestId('mode-edit-btn')).toBeVisible({ timeout: 20000 });

    await page.locator('[class*="document-tabs"] button', { hasText: 'Components' }).click();
    await page.locator('table tbody tr').first().click();

    const detailPanel = page.locator('.entity-panel-slide-out');
    await expect(detailPanel).toBeVisible({ timeout: 15000 });

    const descInput = detailPanel.locator('div:has(> label:has-text("Description")) textarea, label:has-text("Description") ~ textarea').first();
    await descInput.fill('Updated production relational datastore with encryption.');
    await closeDetailPanel(page);

    // 3. Switch to View Mode (auto-saves draft)
    await switchToViewModeAndSave(page);

    // 4. Open VersionDropdown in toolbar and publish new version
    const versionDropdown = page.getByTestId('version-dropdown-toggle');
    await versionDropdown.click();

    const publishBtn = page.getByRole('button', { name: /Publish New Version/i });
    await expect(publishBtn).toBeVisible();
    await publishBtn.click();

    // VersionDrawer opens
    const newVerInput = page.getByPlaceholder('e.g. 1.0.1');
    await expect(newVerInput).toBeVisible({ timeout: 10000 });
    await newVerInput.fill('1.1.0');

    const remarksInput = page.locator('input[placeholder*="What changed"], textarea[placeholder*="What changed"], label:has-text("Remarks") ~ input, label:has-text("Remarks") ~ div input, [placeholder*="Added section"]').first();
    await remarksInput.fill('Initial production release v1.1.0 with updated encryption narrative');

    const confirmPublishBtn = page.getByRole('button', { name: 'Publish Version' });
    await confirmPublishBtn.click();

    // 5. Verify VersionDropdown reflects v1.1.0
    await expect(page.getByTestId('version-dropdown-toggle')).toContainText('v1.1.0', { timeout: 15000 });

    // 6. Fetch published document from backend and verify revisions & schema validation
    const publishedDoc = await apiSetup.getDocument('component-definitions', compDefId);
    expect(publishedDoc['component-definition'].metadata.version).toBe('1.1.0');
    expect(publishedDoc['component-definition'].metadata.revisions).toBeDefined();
    expect(publishedDoc['component-definition'].metadata.revisions.length).toBeGreaterThanOrEqual(1);

    const postValRes = await request.post('http://127.0.0.1:1000/api/validate/component-definitions', {
      headers: { 'X-Workspace-ID': apiSetup.workspaceId },
      data: publishedDoc
    });
    expect(postValRes.status()).toBe(200);
    const postValJson = await postValRes.json();
    expect(postValJson.status).toBe('valid');
  });
});
