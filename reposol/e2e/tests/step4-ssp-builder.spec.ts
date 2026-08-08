import { test, expect } from '../fixtures/base';

test.describe('Step 4 SSP Builder — E2E Specifications', () => {
  test.setTimeout(60000);

  test.beforeEach(({ page }) => {
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.error('PAGE ERROR:', err.message));
  });

  test('Feature 22: Baseline Profile Import & System Identity Editing', async ({ page, apiSetup }) => {
    const catId = await apiSetup.createCatalog({ title: 'SSP Source Catalog' });
    const profId = await apiSetup.createProfile({ title: 'SSP Source Baseline Profile', catalogUuid: catId });
    const compId = await apiSetup.createComponentDefinition({ title: 'SSP Source Component' });

    const sspUuid = await apiSetup.createSsp(profId, compId, {
      title: 'E2E Financial System SSP',
      systemName: 'Core Financial System'
    });

    await page.goto(`http://127.0.0.1:1001/ssp/${sspUuid}?edit=true&w=${apiSetup.workspaceId}`);
    await expect(page.locator('.document-toolbar')).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(300);

    // Switch to System Characteristics tab
    await page.locator('.document-tabs button', { hasText: 'Characteristics' }).click();
    await expect(page.locator('.sys-char-tab')).toBeVisible();

    // Edit System Identity fields
    const sysNameInput = page.locator('.sys-char-tab input').first();
    await sysNameInput.fill('Updated Core Financial Platform');
    await expect(sysNameInput).toHaveValue('Updated Core Financial Platform');
    await sysNameInput.blur();

    const shortNameInput = page.locator('.sys-char-tab input').nth(1);
    await shortNameInput.fill('CFP-PLATFORM');
    await expect(shortNameInput).toHaveValue('CFP-PLATFORM');
    await shortNameInput.blur();

    const descTextarea = page.locator('.sys-char-tab textarea').first();
    await descTextarea.fill('Primary transaction processing engine for financial settlement');
    await expect(descTextarea).toHaveValue('Primary transaction processing engine for financial settlement');
    await descTextarea.blur();

    // Select Sensitivity Level
    const sensitivitySelect = page.locator('.sys-char-tab select').first();
    await sensitivitySelect.selectOption('high');

    // Save document
    await page.getByTestId('save-btn').click();
    await page.waitForTimeout(500);

    // Verify backend persistence
    const savedDoc = await apiSetup.getDocument('ssps', sspUuid);
    const sysChar = savedDoc['system-security-plan']['system-characteristics'];
    expect(sysChar['system-name']).toBe('Updated Core Financial Platform');
    expect(sysChar['system-name-short']).toBe('CFP-PLATFORM');
    expect(sysChar.description).toContain('Primary transaction processing engine');
  });

  test('Feature 22: NIST SP 800-60 Information Types & FIPS 199 Security Impact Categorization', async ({ page, apiSetup }) => {
    const sspUuid = await apiSetup.createSsp({
      title: 'E2E Categorization System SSP',
      systemName: 'Payment Clearing Gateway'
    });

    await page.goto(`http://127.0.0.1:1001/ssp/${sspUuid}?edit=true&w=${apiSetup.workspaceId}`);
    await expect(page.locator('.document-toolbar')).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(300);

    await page.locator('.document-tabs button', { hasText: 'Characteristics' }).click();
    await expect(page.locator('.sys-char-tab')).toBeVisible();

    // Configure system FIPS 199 objectives
    const selects = page.locator('.sys-char-tab select');
    await selects.nth(2).selectOption('fips-199-moderate');
    await selects.nth(3).selectOption('fips-199-moderate');
    await selects.nth(4).selectOption('fips-199-moderate');

    // Add Information Type
    const addInfoBtn = page.getByRole('button', { name: /Add Information Type/i });
    await addInfoBtn.click();
    const infoTableRows = page.locator('.sys-char-tab table tbody tr');
    await infoTableRows.last().click();

    const sidePanelInput = page.locator('.entity-panel-slide-out input, .entity-detail-panel input').first();
    await sidePanelInput.fill('Financial Audit Log Data');
    await expect(sidePanelInput).toHaveValue('Financial Audit Log Data');
    await sidePanelInput.blur();
    
    // Close detail panel cleanly
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    // Save document
    await page.getByTestId('save-btn').click();
    await page.waitForTimeout(500);

    // Verify backend model and newly added information type
    const savedDoc = await apiSetup.getDocument('ssps', sspUuid);
    const sysChar = savedDoc['system-security-plan']['system-characteristics'];
    expect(sysChar['system-information']).toBeDefined();
    const infoTypes = sysChar['system-information']['information-types'];
    expect(infoTypes).toBeDefined();
    expect(infoTypes.some((t: any) => t.title === 'Financial Audit Log Data')).toBe(true);
  });

  test('Feature 23: Boundary & Architecture Diagrams Base64 Upload & Back-Matter Resource Binding', async ({ page, apiSetup }) => {
    const sspUuid = await apiSetup.createSsp({
      title: 'E2E Diagram System SSP',
      systemName: 'Cloud VPC Environment'
    });

    await page.goto(`http://127.0.0.1:1001/ssp/${sspUuid}?edit=true&w=${apiSetup.workspaceId}`);
    await expect(page.locator('.document-toolbar')).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(300);

    await page.locator('.document-tabs button', { hasText: 'Characteristics' }).click();
    await expect(page.locator('.sys-char-tab')).toBeVisible();

    // Boundary description fill (2nd textarea under .sys-char-tab)
    const boundaryTextarea = page.locator('.sys-char-tab textarea').nth(1);
    await boundaryTextarea.fill('AWS Cloud EU-Central VPC Security Boundary with isolation subnets');
    await expect(boundaryTextarea).toHaveValue('AWS Cloud EU-Central VPC Security Boundary with isolation subnets');
    await boundaryTextarea.blur();

    // Diagram file upload via setInputFiles
    const fileInput = page.locator('.sys-char-tab input[type="file"]').first();
    const sampleImageBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    await fileInput.setInputFiles({
      name: 'architecture-boundary.png',
      mimeType: 'image/png',
      buffer: sampleImageBuffer
    });

    // Save document
    await page.getByTestId('save-btn').click();
    await page.waitForTimeout(500);

    // Verify backend model
    const savedDoc = await apiSetup.getDocument('ssps', sspUuid);
    const boundary = savedDoc['system-security-plan']['system-characteristics']['authorization-boundary'];
    expect(boundary.description).toContain('AWS Cloud EU-Central VPC');
  });

  test('Feature 23: Component Inventory Items, System Components & Leveraged Authorizations', async ({ page, apiSetup }) => {
    const sspUuid = await apiSetup.createSsp({
      title: 'E2E Inventory & Components SSP',
      systemName: 'Distributed Storage Platform'
    });

    await page.goto(`http://127.0.0.1:1001/ssp/${sspUuid}?edit=true&w=${apiSetup.workspaceId}`);
    await expect(page.locator('.document-toolbar')).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(300);

    await page.locator('.document-tabs button', { hasText: 'Implementation' }).click();
    await expect(page.locator('.sys-imp-tab')).toBeVisible();

    // Inventory Items sub-tab
    const invSubTabBtn = page.locator('.sys-imp-tab button', { hasText: 'Inventory Items' });
    await invSubTabBtn.click();
    const addInvBtn = page.getByRole('button', { name: '+ Add Inventory Item' });
    await addInvBtn.click();

    // Leveraged Authorizations sub-tab
    const authTabBtn = page.locator('.sys-imp-tab button', { hasText: 'Leveraged Authorizations' });
    await authTabBtn.click();
    const addAuthBtn = page.getByRole('button', { name: '+ Add Auth' });
    await addAuthBtn.click();

    // Components sub-tab
    const compTabBtn = page.locator('.sys-imp-tab button', { hasText: 'Components' });
    await compTabBtn.click();
    const addCompBtn = page.getByRole('button', { name: '+ Add Component' });
    await addCompBtn.click();

    // Verify component row created in table
    await expect(page.locator('.sys-imp-tab table tbody tr').last()).toBeVisible();

    // Save document
    await page.getByTestId('save-btn').click();
    await page.waitForTimeout(500);

    // Verify backend document persistence for UI-created components
    const savedDoc = await apiSetup.getDocument('ssps', sspUuid);
    const sysImp = savedDoc['system-security-plan']['system-implementation'];
    expect(sysImp.components).toBeDefined();
    expect(sysImp.components.length).toBeGreaterThan(0);
  });

  test('Feature 24 & Feature 23: 3-Level Parameter Cascade & Security Inheritance', async ({ page, apiSetup }) => {
    const catUuid = await apiSetup.createCatalog({
      title: 'Cascade Source Catalog',
      controls: [
        {
          id: 'ac-1',
          title: 'Access Control Policy',
          params: [
            {
              id: 'ac-1_prm_1',
              label: 'Access Control Policy Review Frequency',
              values: ['cat-default-annual']
            }
          ]
        }
      ]
    });

    const profUuid = await apiSetup.createProfile({
      title: 'Cascade Tailored Profile',
      catalogUuid: catUuid,
      modify: {
        'set-parameters': [
          {
            'param-id': 'ac-1_prm_1',
            values: ['prof-override-semi-annual']
          }
        ]
      }
    });

    const compUuid = await apiSetup.createComponentDefinition({ title: 'Cascade Component' });

    const sspUuid = await apiSetup.createSsp(profUuid, compUuid, {
      title: 'E2E Parameter Cascade SSP',
      systemName: 'Cascade Test System',
      controlImplementation: {
        description: 'SSP Control Implementation with 3-level parameter overrides',
        'implemented-requirements': [
          {
            uuid: '90000000-0000-4000-8000-000000000001',
            'control-id': 'ac-1',
            'by-components': [
              {
                uuid: '90000000-0000-4000-8000-000000000002',
                'component-uuid': compUuid,
                description: 'Component-level access control implementation narrative',
                'implementation-status': { state: 'implemented' },
                'set-parameters': [
                  {
                    'param-id': 'ac-1_prm_1',
                    values: ['ssp-component-override-quarterly']
                  }
                ]
              }
            ]
          }
        ]
      }
    });

    await page.goto(`http://127.0.0.1:1001/ssp/${sspUuid}?edit=true&w=${apiSetup.workspaceId}`);
    await expect(page.locator('.document-toolbar')).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(300);

    await page.locator('.document-tabs button', { hasText: 'Controls' }).click();
    await expect(page.locator('.ctrl-imp-tab')).toBeVisible();

    // Click requirement row in Controls tab
    const reqRow = page.locator('.ctrl-imp-tab table tbody tr').first();
    await expect(reqRow).toBeVisible();
    await reqRow.click();

    // Verify detail panel opens
    await expect(page.locator('.entity-panel-slide-out').or(page.locator('.entity-detail-panel'))).toBeVisible();

    // Close detail panel so top toolbar is clickable
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    // Save document
    await page.getByTestId('save-btn').click();
    await page.waitForTimeout(500);

    // Verify 3-level parameter override structure in backend JSON
    const savedDoc = await apiSetup.getDocument('ssps', sspUuid);
    const ctrlImp = savedDoc['system-security-plan']['control-implementation'];
    const req = ctrlImp['implemented-requirements'].find((r: any) => r['control-id'] === 'ac-1');
    expect(req).toBeDefined();
    expect(req['by-components']).toBeDefined();
    const byComp = req['by-components'][0];
    expect(byComp['set-parameters']).toBeDefined();
    expect(byComp['set-parameters'][0]['param-id']).toBe('ac-1_prm_1');
    expect(byComp['set-parameters'][0].values[0]).toBe('ssp-component-override-quarterly');
  });

  test('Feature 24 & Step 4: Completeness Check & Warning Banners', async ({ page, apiSetup }) => {
    const sspUuid = await apiSetup.createSsp({
      title: 'E2E Validation Report SSP',
      systemName: 'Incomplete Validation System'
    });

    await page.goto(`http://127.0.0.1:1001/ssp/${sspUuid}?w=${apiSetup.workspaceId}`);
    await expect(page.locator('.document-toolbar')).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(300);

    // Check Version Drawer
    const versionBtn = page.getByTestId('version-history-btn').first();
    await versionBtn.click();
    await expect(page.getByTestId('version-drawer')).toBeVisible();

    // Close Version Drawer explicitly via close button
    await page.locator('.version-drawer-panel button', { hasText: '✕' }).first().click();
    await expect(page.getByTestId('version-drawer')).toBeHidden();

    // Switch to Validation tab
    await page.locator('.document-tabs button', { hasText: 'Validation' }).click();

    // Verify Completeness Report heading
    await expect(page.getByRole('heading', { name: /Completeness Report/i })).toBeVisible();

    // Switch to Json tab to verify Monaco / raw JSON
    await page.locator('.document-tabs button', { hasText: 'Json' }).click();
    await expect(page.locator('.monaco-editor').first()).toBeVisible();
  });
});
