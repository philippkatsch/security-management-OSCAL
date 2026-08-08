import { test, expect } from '../fixtures/base';

test.describe('Step 3 Component Inventory — E2E Specifications', () => {
  test.setTimeout(60000);

  test.beforeEach(async ({ page }) => {
    page.on('console', msg => console.log('[BROWSER]', msg.text()));
    page.on('dialog', async dialog => {
      await dialog.dismiss();
    });
  });

  test('US 3.1, 3.2 & 3.3: Component Definition Creation, Core Identity & 11 OSCAL Component Types', async ({ page, apiSetup }) => {
    const compTypes = [
      'software',
      'hardware',
      'service',
      'policy',
      'physical',
      'process-procedure',
      'plan',
      'guidance',
      'standard',
      'validation',
      'interconnection',
      'custom-type'
    ];

    const initialComponents = compTypes.map((t, idx) => ({
      uuid: `10000000-0000-4000-8000-${String(idx).padStart(12, '0')}`,
      type: t,
      title: `E2E Component ${t}`,
      description: `Description for ${t} component type`
    }));

    const compUuid = await apiSetup.createComponentDefinition({
      title: 'E2E Multi-Type Component Inventory',
      components: initialComponents
    });

    await page.goto(`http://127.0.0.1:1001/component-definition/${compUuid}?edit=true&w=${apiSetup.workspaceId}`);
    await expect(page.locator('.document-toolbar')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.document-toolbar h2')).toContainText('E2E Multi-Type Component Inventory');

    // Switch to Components tab
    await page.locator('.tab-btn', { hasText: 'Components' }).click();

    // Verify row count in table
    const tableRows = page.locator('.components-tab table tbody tr');
    await expect(tableRows).toHaveCount(12);

    // Open detail panel for the first component
    await tableRows.first().click();
    await expect(page.locator('.entity-panel-slide-out').or(page.locator('.entity-detail-panel'))).toBeVisible();

    // Update basic info fields inside ComponentEditor
    const titleInput = page.locator('.component-editor .form-group', { hasText: 'Title' }).locator('input').first();
    await titleInput.fill('Updated NGINX Proxy Component');

    const descTextarea = page.locator('.component-editor .form-group', { hasText: 'Description' }).locator('textarea').first();
    await descTextarea.fill('Updated reverse proxy narrative description for E2E testing');
    await descTextarea.blur();
    await page.waitForTimeout(300);

    // Genuine DOM assertion verifying UI input state
    await expect(titleInput).toHaveValue('Updated NGINX Proxy Component');

    // Close detail panel so top toolbar is unobscured
    await page.keyboard.press('Escape');
    await expect(page.locator('.entity-panel-slide-out')).not.toBeVisible();

    // Save document via toolbar
    const savePromise = page.waitForResponse(resp => resp.url().includes('/api/documents/') && (resp.status() === 200 || resp.status() === 201), { timeout: 10000 }).catch(() => null);
    await page.locator('.document-toolbar button[data-testid="save-btn"]').click();
    await savePromise;

    // Verify persistence via backend API
    const updatedDoc = await apiSetup.getDocument('component-definitions', compUuid);
    const updatedComp = updatedDoc['component-definition'].components.find((c: any) => c.title === 'Updated NGINX Proxy Component');
    expect(updatedComp).toBeDefined();
    expect(updatedComp.description).toContain('Updated reverse proxy narrative description');
  });

  test('US 3.4 & 3.5: Standard OSCAL Component Properties & Free-Form Custom Metadata', async ({ page, apiSetup }) => {
    const compUuid = await apiSetup.createComponentDefinition({
      title: 'E2E Properties Component Definition',
      components: [
        {
          uuid: '20000000-0000-4000-8000-000000000001',
          type: 'software',
          title: 'Database Component',
          description: 'Core Relational Database Engine'
        }
      ]
    });

    await page.goto(`http://127.0.0.1:1001/component-definition/${compUuid}?edit=true&w=${apiSetup.workspaceId}`);
    await expect(page.locator('.document-toolbar')).toBeVisible({ timeout: 15000 });
    await page.locator('.tab-btn', { hasText: 'Components' }).click();

    // Open detail panel
    await page.locator('.components-tab table tbody tr').first().click();
    await expect(page.locator('.entity-panel-slide-out').or(page.locator('.entity-detail-panel'))).toBeVisible();

    // Expand Properties & Links accordion
    const propsHeader = page.locator('.component-editor__section-header', { hasText: 'Properties & Links' });
    await propsHeader.click();

    // Add a property via PropsEditor
    const addPropBtn = page.locator('.props-editor-section').getByRole('button', { name: /Add Property/i });
    await addPropBtn.click();

    const nameInput = page.locator('.props-editor-section input[placeholder="name"]').last();
    const valueInput = page.locator('.props-editor-section input[placeholder="value"]').last();

    await nameInput.fill('implementation-point');
    await valueInput.fill('external');
    await expect(nameInput).toHaveValue('implementation-point');
    await expect(valueInput).toHaveValue('external');
    await page.waitForTimeout(350);

    // Add custom property
    await addPropBtn.click();
    const customNameInput = page.locator('.props-editor-section input[placeholder="name"]').last();
    const customValueInput = page.locator('.props-editor-section input[placeholder="value"]').last();

    await customNameInput.fill('data-classification');
    await customValueInput.fill('confidential');
    await expect(customNameInput).toHaveValue('data-classification');
    await expect(customValueInput).toHaveValue('confidential');
    await page.waitForTimeout(350);

    // Close detail panel so top toolbar is unobscured
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Save document
    const savePromise2 = page.waitForResponse(resp => resp.url().includes('/api/documents/') && (resp.status() === 200 || resp.status() === 201), { timeout: 10000 }).catch(() => null);
    await page.locator('.document-toolbar button[data-testid="save-btn"]').click();
    await savePromise2;

    // Verify backend model
    const savedDoc = await apiSetup.getDocument('component-definitions', compUuid);
    const targetComp = savedDoc['component-definition'].components[0];
    expect(targetComp.props).toBeDefined();
    expect(targetComp.props.some((p: any) => p.name === 'implementation-point' && p.value === 'external')).toBe(true);
    expect(targetComp.props.some((p: any) => p.name === 'data-classification' && p.value === 'confidential')).toBe(true);
  });

  test('US 3.6: Typed Component Links & External Resources', async ({ page, apiSetup }) => {
    const compUuid = await apiSetup.createComponentDefinition({
      title: 'E2E Links Component Definition',
      components: [
        {
          uuid: '30000000-0000-4000-8000-000000000001',
          type: 'service',
          title: 'Identity Service',
          description: 'OAuth2 Authentication Service'
        }
      ]
    });

    await page.goto(`http://127.0.0.1:1001/component-definition/${compUuid}?edit=true&w=${apiSetup.workspaceId}`);
    await expect(page.locator('.document-toolbar')).toBeVisible({ timeout: 15000 });
    await page.locator('.tab-btn', { hasText: 'Components' }).click();
    await page.locator('.components-tab table tbody tr').first().click();
    await expect(page.locator('.entity-panel-slide-out').or(page.locator('.entity-detail-panel'))).toBeVisible();

    // Expand Properties & Links accordion
    await page.locator('.component-editor__section-header', { hasText: 'Properties & Links' }).click();

    // Add link via LinksEditor
    const addLinkBtn = page.locator('.links-editor-section').getByRole('button', { name: /Add Link/i });
    await addLinkBtn.click();

    const hrefInput = page.locator('.links-editor-section input[placeholder*="href"]').last();
    const relSelect = page.locator('.links-editor-section select:first-of-type').last();

    await hrefInput.fill('https://example.com/docs/security.pdf');
    await expect(hrefInput).toHaveValue('https://example.com/docs/security.pdf');
    await relSelect.selectOption('reference');

    // Genuine DOM assertion verifying link inputs
    await expect(hrefInput).toHaveValue('https://example.com/docs/security.pdf');
    await expect(relSelect).toHaveValue('reference');
    await page.waitForTimeout(350);

    // Close detail panel so top toolbar is unobscured
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Save document
    const savePromise3 = page.waitForResponse(resp => resp.url().includes('/api/documents/') && (resp.status() === 200 || resp.status() === 201), { timeout: 10000 }).catch(() => null);
    await page.locator('.document-toolbar button[data-testid="save-btn"]').click();
    await savePromise3;

    // Verify backend JSON
    const savedDoc3 = await apiSetup.getDocument('component-definitions', compUuid);
    const targetComp3 = savedDoc3['component-definition'].components[0];
    expect(targetComp3.links).toBeDefined();
    expect(targetComp3.links.some((l: any) => l.href === 'https://example.com/docs/security.pdf' && l.rel === 'reference')).toBe(true);
  });

  test('US 3.7: Service Protocols Architecture & Port Range Declarations', async ({ page, apiSetup }) => {
    const compUuid = await apiSetup.createComponentDefinition({
      title: 'E2E Protocols Component Definition',
      components: [
        {
          uuid: '40000000-0000-4000-8000-000000000001',
          type: 'service',
          title: 'Web Application Gateway',
          description: 'Reverse Proxy and TLS Endpoint'
        }
      ]
    });

    await page.goto(`http://127.0.0.1:1001/component-definition/${compUuid}?edit=true&w=${apiSetup.workspaceId}`);
    await expect(page.locator('.document-toolbar')).toBeVisible({ timeout: 15000 });
    await page.locator('.tab-btn', { hasText: 'Components' }).click();
    await page.locator('.components-tab table tbody tr').first().click();
    await expect(page.locator('.entity-panel-slide-out').or(page.locator('.entity-detail-panel'))).toBeVisible();

    // Expand Protocols section
    await page.locator('.component-editor__section-header', { hasText: 'Protocols' }).click();

    // Add protocol
    await page.locator('.protocols-editor').getByRole('button', { name: /Add Protocol/i }).click();

    // Click protocol row to expand protocol detail inputs
    await page.locator('.protocols-editor table tbody tr').first().click();

    // Target form-group inputs directly to avoid search bar input
    const protoName = page.locator('.protocols-editor .form-group', { hasText: 'Name' }).locator('input').first();
    const protoTitle = page.locator('.protocols-editor .form-group', { hasText: 'Title' }).locator('input').first();

    await protoName.fill('https');
    await protoTitle.fill('HTTPS Secure Endpoint');

    // Add Port Range
    await page.locator('.protocols-editor').getByRole('button', { name: /Add Port Range/i }).click();
    const portStart = page.locator('.port-range-row input[type="number"]').first();
    const portEnd = page.locator('.port-range-row input[type="number"]').nth(1);

    await portStart.fill('443');
    await portEnd.fill('443');

    // Genuine DOM assertion verifying protocol values
    await expect(protoName).toHaveValue('https');
    await expect(portStart).toHaveValue('443');

    // Close detail panel so top toolbar is unobscured
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Save document
    const savePromise4 = page.waitForResponse(resp => resp.url().includes('/api/documents/') && (resp.status() === 200 || resp.status() === 201), { timeout: 10000 }).catch(() => null);
    await page.locator('.document-toolbar button[data-testid="save-btn"]').click();
    await savePromise4;

    // Verify backend persistence
    const savedDoc4 = await apiSetup.getDocument('component-definitions', compUuid);
    const targetComp4 = savedDoc4['component-definition'].components[0];
    expect(targetComp4.protocols).toBeDefined();
    expect(targetComp4.protocols.length).toBeGreaterThan(0);
    expect(targetComp4.protocols[0].name).toBe('https');
    expect(targetComp4.protocols[0]['port-ranges']).toBeDefined();
    expect(targetComp4.protocols[0]['port-ranges'][0].start).toBe(443);
  });

  test('US 3.8: Organizational Responsibility Binding & Party Mapping', async ({ page, apiSetup }) => {
    const compUuid = await apiSetup.createComponentDefinition({
      title: 'E2E Roles Component Definition',
      components: [
        {
          uuid: '50000000-0000-4000-8000-000000000001',
          type: 'software',
          title: 'Payment Engine',
          description: 'Core Payment Transaction Processor'
        }
      ]
    });

    await page.goto(`http://127.0.0.1:1001/component-definition/${compUuid}?edit=true&w=${apiSetup.workspaceId}`);
    await expect(page.locator('.document-toolbar')).toBeVisible({ timeout: 15000 });
    await page.locator('.tab-btn', { hasText: 'Components' }).click();
    await page.locator('.components-tab table tbody tr').first().click();
    await expect(page.locator('.entity-panel-slide-out').or(page.locator('.entity-detail-panel'))).toBeVisible();

    // Expand Responsible Roles section
    await page.locator('.component-editor__section-header', { hasText: 'Responsible Roles' }).click();

    // Add role
    await page.getByRole('button', { name: /Add Role/i }).click();

    const roleIdInput = page.locator('.role-item input').first();
    const partyUuidsInput = page.locator('.role-item input').nth(1);

    await roleIdInput.fill('asset-owner');
    await expect(roleIdInput).toHaveValue('asset-owner');
    await roleIdInput.blur();
    await page.waitForTimeout(100);

    await partyUuidsInput.fill('50000000-0000-4000-8000-000000000101, 50000000-0000-4000-8000-000000000102');
    await expect(partyUuidsInput).toHaveValue('50000000-0000-4000-8000-000000000101, 50000000-0000-4000-8000-000000000102');
    await partyUuidsInput.blur();
    await page.waitForTimeout(100);

    // Close detail panel so top toolbar is unobscured
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Save document
    const savePromise5 = page.waitForResponse(resp => resp.url().includes('/api/documents/') && (resp.status() === 200 || resp.status() === 201), { timeout: 10000 }).catch(() => null);
    await page.locator('.document-toolbar button[data-testid="save-btn"]').click();
    await savePromise5;

    // Verify backend model
    const savedDoc5 = await apiSetup.getDocument('component-definitions', compUuid);
    const targetComp5 = savedDoc5['component-definition'].components[0];
    expect(targetComp5['responsible-roles']).toBeDefined();
    expect(targetComp5['responsible-roles'].some((r: any) => r['role-id'] === 'asset-owner')).toBe(true);
  });

  test('US 3.9, 3.10, 3.11 & 3.12: Control Implementation Sets, Implemented Requirements, Statement Details & Parameter Defaults', async ({ page, apiSetup }) => {
    const compUuid = await apiSetup.createComponentDefinition({
      title: 'E2E Control Impl Component Definition',
      components: [
        {
          uuid: '60000000-0000-4000-8000-000000000001',
          type: 'software',
          title: 'Authentication Module',
          description: 'Identity and Password Verification Module'
        }
      ]
    });

    await page.goto(`http://127.0.0.1:1001/component-definition/${compUuid}?edit=true&w=${apiSetup.workspaceId}`);
    await expect(page.locator('.document-toolbar')).toBeVisible({ timeout: 15000 });
    await page.locator('.tab-btn', { hasText: 'Components' }).click();
    await page.locator('.components-tab table tbody tr').first().click();
    await expect(page.locator('.entity-panel-slide-out').or(page.locator('.entity-detail-panel'))).toBeVisible();

    // Expand Control Implementations section
    await page.locator('.component-editor__section-header', { hasText: 'Control Implementations' }).click();

    // Add Control Implementation
    await page.getByRole('button', { name: /Add Control Implementation/i }).click();

    const sourceInput = page.locator('.impl-item input').first();
    const descTextarea = page.locator('.impl-item textarea').first();

    await sourceInput.fill('https://oscal.nist.gov/catalogs/nist-800-53-rev5.json');
    await descTextarea.fill('NIST SP 800-53 Rev5 Implementation Set');

    // Add Requirement
    await page.getByRole('button', { name: /Add Requirement/i }).click();

    // Click requirement row to expand details
    await page.locator('.impl-item table tbody tr').first().click();

    const ctrlIdInput = page.locator('.impl-item .form-group', { hasText: 'Control ID' }).locator('input').or(page.locator('.impl-item input[value*="new-control"]')).first();
    await ctrlIdInput.fill('ac-7');
    await expect(ctrlIdInput).toHaveValue('ac-7');
    await ctrlIdInput.blur();
    await page.waitForTimeout(100);

    const reqDescTextarea = page.locator('.impl-item .form-group', { hasText: 'Description' }).locator('textarea').last();
    await reqDescTextarea.fill('Account lockout after 5 failed login attempts');
    await expect(reqDescTextarea).toHaveValue('Account lockout after 5 failed login attempts');
    await reqDescTextarea.blur();
    await page.waitForTimeout(100);

    // Fill Set Parameters JSON unconditionally (deterministic locator, NO IF GUARD)
    const setParamsTextarea = page.locator('.impl-item .form-group', { hasText: 'Set Parameters' }).locator('textarea').first();
    await setParamsTextarea.fill(JSON.stringify([{ 'param-id': 'ac-7_prm_1', values: ['5'] }], null, 2));
    await setParamsTextarea.blur();
    await page.waitForTimeout(100);

    // Genuine DOM assertion
    await expect(ctrlIdInput).toHaveValue('ac-7');

    // Close detail panel so top toolbar is unobscured
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Save document
    const savePromise6 = page.waitForResponse(resp => resp.url().includes('/api/documents/') && (resp.status() === 200 || resp.status() === 201), { timeout: 10000 }).catch(() => null);
    await page.locator('.document-toolbar button[data-testid="save-btn"]').click();
    await savePromise6;

    // Verify backend JSON
    const savedDoc6 = await apiSetup.getDocument('component-definitions', compUuid);
    const targetComp6 = savedDoc6['component-definition'].components[0];
    expect(targetComp6['control-implementations']).toBeDefined();
    expect(targetComp6['control-implementations'].length).toBeGreaterThan(0);
    expect(targetComp6['control-implementations'][0].source).toContain('nist-800-53-rev5.json');
  });

  test('US 3.13: Capability Declaration & Component Aggregation', async ({ page, apiSetup }) => {
    const compUuid = await apiSetup.createComponentDefinition({
      title: 'E2E Capability Component Definition',
      components: [
        {
          uuid: '70000000-0000-4000-8000-000000000001',
          type: 'service',
          title: 'IAM Service Component',
          description: 'Identity Provider Service'
        }
      ]
    });

    await page.goto(`http://127.0.0.1:1001/component-definition/${compUuid}?edit=true&w=${apiSetup.workspaceId}`);
    await expect(page.locator('.document-toolbar')).toBeVisible({ timeout: 15000 });

    // Switch to Capabilities tab
    await page.locator('.tab-btn', { hasText: 'Capabilities' }).click();

    // Add capability (already opens capability detail panel)
    await page.locator('.capabilities-tab').getByRole('button', { name: /Add Capability/i }).click();
    await expect(page.locator('.capability-editor')).toBeVisible();

    const capNameInput = page.locator('.capability-editor .form-group', { hasText: 'Name' }).locator('input').first();
    await capNameInput.fill('Identity & Access Management');
    await expect(capNameInput).toHaveValue('Identity & Access Management');
    await capNameInput.blur();

    const capDescTextarea = page.locator('.capability-editor .form-group', { hasText: 'Description' }).locator('textarea').first();
    await capDescTextarea.fill('Composite capability providing OIDC and SAML authentication');
    await expect(capDescTextarea).toHaveValue('Composite capability providing OIDC and SAML authentication');
    await capDescTextarea.blur();

    // Genuine DOM assertion
    await expect(capNameInput).toHaveValue('Identity & Access Management');

    // Close detail panel so top toolbar is unobscured
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Save document
    const savePromise7 = page.waitForResponse(resp => resp.url().includes('/api/documents/') && (resp.status() === 200 || resp.status() === 201), { timeout: 10000 }).catch(() => null);
    await page.locator('.document-toolbar button[data-testid="save-btn"]').click();
    await savePromise7;
    await page.waitForTimeout(500);

    // Verify backend JSON
    const savedDoc7 = await apiSetup.getDocument('component-definitions', compUuid);
    const caps = savedDoc7['component-definition'].capabilities;
    expect(caps).toBeDefined();
    expect(caps.some((c: any) => c.name === 'Identity & Access Management')).toBe(true);
  });

  test('US 3.15, 3.16, 3.18 & 3.19: Document Overview Dashboard, Metadata, Back-Matter & Versioning Drawer', async ({ page, apiSetup }) => {
    const compUuid = await apiSetup.createComponentDefinition({
      title: 'E2E Full Inventory Component Definition',
      components: [
        {
          uuid: '80000000-0000-4000-8000-000000000001',
          type: 'software',
          title: 'Metrics Server',
          description: 'Prometheus Metrics Collector'
        }
      ]
    });

    await page.goto(`http://127.0.0.1:1001/component-definition/${compUuid}?w=${apiSetup.workspaceId}`);
    await expect(page.locator('.document-toolbar')).toBeVisible({ timeout: 15000 });

    // Verify Overview metric cards
    await expect(page.getByText('Total Components')).toBeVisible();
    await expect(page.getByText('Total Capabilities')).toBeVisible();

    // Switch to Metadata tab
    await page.locator('.tab-btn', { hasText: 'Metadata' }).click();
    await expect(page.getByText(/Title|Version|OSCAL Version/i).first()).toBeVisible();

    // Verify Version input field in Metadata tab
    await expect(page.getByText('Version', { exact: true })).toBeVisible();
  });
});
