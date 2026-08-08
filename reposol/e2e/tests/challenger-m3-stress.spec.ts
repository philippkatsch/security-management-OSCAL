import { test, expect } from '../fixtures/base';

test.describe('Challenger M3 — Empirical Stress Harness & Edge Case Suite', () => {

  test('Challenger Stress 1: 3-Level Parameter Cascade (Catalog -> Profile -> SSP)', async ({ page, apiSetup }) => {
    const catUuid = await apiSetup.createCatalog({
      title: 'Challenger Level 1 Catalog',
      controls: [
        {
          id: 'ac-1',
          title: 'Access Control Policy',
          params: [
            { id: 'param-1', label: 'Param 1', values: ['catalog-val-1'] },
            { id: 'param-2', label: 'Param 2', values: ['catalog-val-2'] },
            { id: 'param-3', label: 'Param 3', values: ['catalog-val-3'] }
          ]
        }
      ]
    });

    const profUuid = await apiSetup.createProfile({
      title: 'Challenger Level 2 Profile',
      catalogUuid: catUuid,
      modify: {
        'set-parameters': [
          { 'param-id': 'param-1', values: ['profile-val-1'] },
          { 'param-id': 'param-2', values: ['profile-val-2'] }
        ]
      }
    });

    const compUuid = await apiSetup.createComponentDefinition({ title: 'Challenger Component' });

    const sspUuid = await apiSetup.createSsp(profUuid, compUuid, {
      title: 'Challenger Level 3 SSP Cascade Test',
      systemName: 'Cascade Stress System',
      controlImplementation: {
        description: 'SSP Control Implementation testing 3-level cascade precedence',
        'implemented-requirements': [
          {
            uuid: '80000000-0000-4000-8000-000000000001',
            'control-id': 'ac-1',
            'by-components': [
              {
                uuid: '80000000-0000-4000-8000-000000000002',
                'component-uuid': compUuid,
                description: 'Component narrative with param-1 override',
                'implementation-status': { state: 'implemented' },
                'set-parameters': [
                  { 'param-id': 'param-1', values: ['ssp-override-val-1'] }
                ]
              }
            ]
          }
        ]
      }
    });

    const doc = await apiSetup.getDocument('ssps', sspUuid);
    const sspData = doc['system-security-plan'];
    const implReq = sspData['control-implementation']['implemented-requirements'][0];
    const byComp = implReq['by-components'][0];
    
    expect(byComp['set-parameters'][0]['param-id']).toBe('param-1');
    expect(byComp['set-parameters'][0].values[0]).toBe('ssp-override-val-1');

    await page.goto(`http://127.0.0.1:1001/ssp/${sspUuid}?edit=true&w=${apiSetup.workspaceId}`);
    await expect(page.locator('.document-toolbar')).toBeVisible();
    await page.getByRole('button', { name: 'Controls' }).click();
    await expect(page.locator('.ctrl-imp-tab')).toBeVisible();

    const row = page.locator('.ctrl-imp-tab table tbody tr').first();
    await expect(row).toBeVisible();
    await expect(row).toContainText('ac-1');
  });

  test('Challenger Stress 2: validateSSPCompleteness() Edge Cases & Error/Warning Banners', async ({ page, apiSetup }) => {
    const compUuid = await apiSetup.createComponentDefinition({ title: 'Validation Target Component' });

    const sspUuid = await apiSetup.createSsp(undefined, compUuid, {
      title: '',
      systemName: 'Incomplete Validation Target System',
      controlImplementation: {
        description: 'Test Control Implementation',
        'implemented-requirements': [
          {
            uuid: '70000000-0000-4000-8000-000000000002',
            'control-id': 'ac-1',
            'by-components': [
              {
                uuid: '70000000-0000-4000-8000-000000000003',
                'component-uuid': compUuid,
                description: '',
                'set-parameters': [
                  {
                    'param-id': 'param-empty-val',
                    values: []
                  }
                ]
              }
            ]
          }
        ]
      }
    });

    await page.goto(`http://127.0.0.1:1001/ssp/${sspUuid}?w=${apiSetup.workspaceId}`);
    await expect(page.locator('.document-toolbar')).toBeVisible();
    await page.getByRole('button', { name: 'Validation' }).click();

    await expect(page.locator('.validation-tab')).toBeVisible();
    await expect(page.getByRole('heading', { name: /Completeness Report/i })).toBeVisible();

    const errorContainer = page.locator('.validation-tab').getByRole('heading', { name: /Errors/i });
    await expect(errorContainer).toBeVisible();
  });

  test('Challenger Stress 3: Security Inheritance & Leveraged Authorizations', async ({ page, apiSetup }) => {
    const compUuid = await apiSetup.createComponentDefinition({ title: 'Inheritance Cloud Component' });

    const sspUuid = await apiSetup.createSsp(undefined, compUuid, {
      title: 'Challenger Security Inheritance SSP',
      systemName: 'Leveraged Cloud Platform',
      systemImplementation: {
        users: [
          { uuid: '60000000-0000-4000-8000-000000000010', 'role-ids': ['admin'] }
        ],
        components: [
          {
            uuid: compUuid,
            type: 'service',
            title: 'Inherited Identity Service',
            description: 'Cloud IAM Component',
            status: { state: 'operational' }
          }
        ]
      },
      controlImplementation: {
        description: 'Inherited Controls Implementation',
        'implemented-requirements': [
          {
            uuid: '60000000-0000-4000-8000-000000000001',
            'control-id': 'ia-2',
            'by-components': [
              {
                uuid: '60000000-0000-4000-8000-000000000002',
                'component-uuid': compUuid,
                description: 'Inherited Multi-Factor Authentication from Cloud Provider',
                'implementation-status': { state: 'implemented' },
                'export': {
                  description: 'Exported MFA capability for downstream systems'
                },
                'inherited': [
                  {
                    uuid: '60000000-0000-4000-8000-000000000004',
                    'provided-uuid': '60000000-0000-4000-8000-000000000005',
                    description: 'Fully inherited IAM identity provider control'
                  }
                ]
              }
            ]
          }
        ]
      }
    });

    await page.goto(`http://127.0.0.1:1001/ssp/${sspUuid}?edit=true&w=${apiSetup.workspaceId}`);
    await expect(page.locator('.document-toolbar')).toBeVisible();
    await page.getByRole('button', { name: 'Implementation' }).click();

    await expect(page.locator('.sys-imp-tab')).toBeVisible();

    const doc = await apiSetup.getDocument('ssps', sspUuid);
    const byComp = doc['system-security-plan']['control-implementation']['implemented-requirements'][0]['by-components'][0];
    expect(byComp.inherited).toBeDefined();
    expect(byComp.inherited[0].description).toContain('Fully inherited IAM identity provider');
  });

  test('Challenger Stress 4: Edge Cases — Empty Array Values & Malformed Parameters', async ({ page, apiSetup }) => {
    const compUuid = await apiSetup.createComponentDefinition({ title: 'Boundary Component' });

    const sspUuid = await apiSetup.createSsp(undefined, compUuid, {
      title: 'Challenger Malformed Parameter SSP',
      systemName: 'Malformed Parameter Test',
      systemImplementation: {
        users: [{ uuid: '50000000-0000-4000-8000-000000000010', 'role-ids': ['sec-ops'] }],
        components: [{ uuid: compUuid, type: 'software', title: 'Firewall Service', description: 'Edge Firewall', status: { state: 'operational' } }]
      },
      controlImplementation: {
        description: 'Testing edge case parameter structures',
        'implemented-requirements': [
          {
            uuid: '50000000-0000-4000-8000-000000000001',
            'control-id': 'sc-7',
            'by-components': [
              {
                uuid: '50000000-0000-4000-8000-000000000002',
                'component-uuid': compUuid,
                description: 'Boundary Protection',
                'implementation-status': { state: 'implemented' },
                'set-parameters': [
                  { 'param-id': 'sc-7_prm_1', values: ['val-1'] },
                  { 'param-id': '', values: ['orphan-value'] }
                ]
              }
            ]
          }
        ]
      }
    });

    const doc = await apiSetup.getDocument('ssps', sspUuid);
    expect(doc).toBeDefined();

    await page.goto(`http://127.0.0.1:1001/ssp/${sspUuid}?edit=true&w=${apiSetup.workspaceId}`);
    await expect(page.locator('.document-toolbar')).toBeVisible();
    await page.getByRole('button', { name: 'Controls' }).click();

    await expect(page.locator('.ctrl-imp-tab')).toBeVisible();
  });

  test('Challenger Stress 5: React Rules of Hooks Clean Execution in SSPPage.jsx', async ({ page, apiSetup }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', err => pageErrors.push(err.message));

    const sspUuid = await apiSetup.createSsp({ title: 'Hooks Order Fixed Test SSP' });
    await page.goto(`http://127.0.0.1:1001/ssp/${sspUuid}?w=${apiSetup.workspaceId}`);
    await expect(page.locator('.document-toolbar')).toBeVisible({ timeout: 15000 });

    const hookError = pageErrors.find(e => e.includes('Rendered more hooks than during the previous render'));
    expect(hookError).toBeUndefined();
    expect(pageErrors).toHaveLength(0);
  });

  test('Challenger Stress 6: handleUpdate setUndoState Execution in SSPPage.jsx', async ({ page, apiSetup }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', err => pageErrors.push(err.message));

    const sspUuid = await apiSetup.createSsp({ title: 'UndoState Function Test SSP' });
    await page.goto(`http://127.0.0.1:1001/ssp/${sspUuid}?edit=true&w=${apiSetup.workspaceId}`);
    await expect(page.locator('.document-toolbar')).toBeVisible({ timeout: 15000 });

    await page.getByRole('button', { name: 'Characteristics' }).click();
    const sysNameInput = page.locator('.sys-char-tab input').first();
    await sysNameInput.fill('Triggering handleUpdate state change');

    const undoError = pageErrors.find(e => e.includes('setUndoState is not a function'));
    expect(undoError, 'SSPPage.jsx:42 destructuring bug: setUndoState is not a function').toBeDefined();
  });

});



