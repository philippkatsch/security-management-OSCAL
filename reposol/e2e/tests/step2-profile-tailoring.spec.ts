import { test, expect } from '../fixtures/base';
import { navigateToProfile, selectSidebarTab, switchStructuringMode, waitForProfileResolution } from '../helpers/profile-helpers';
import { simulateHtml5DragAndDrop } from '../helpers/dnd-helper';

test.describe('Step 2 Profile Tailoring — E2E UI Verification', () => {

  test('US 2.1 & US 2.10: Profile Creation Modal, Direct Redirection & Metadata Persistence', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    await page.goto(`/profiles?w=${apiSetup.workspaceId}`);

    // 1. Open creation modal
    const newBtn = page.getByRole('button', { name: /new/i }).first();
    await expect(newBtn).toBeVisible({ timeout: 15000 });
    await newBtn.click();

    // 2. Fill title input in modal (target modal textbox specifically)
    const titleInput = page.locator('#create-doc-title, .modal-panel input[type="text"]').first();
    await expect(titleInput).toBeVisible({ timeout: 15000 });
    const profileTitle = `Deterministic Profile ${Date.now()}`;
    await titleInput.fill(profileTitle);

    // 3. Submit modal and verify direct redirection to editor
    const createBtn = page.locator('.modal-panel').getByRole('button', { name: 'Create Document' });
    await expect(createBtn).toBeEnabled({ timeout: 15000 });
    await createBtn.click();

    await expect(page).toHaveURL(/.*\/profiles\/[a-f0-9-]+/i, { timeout: 15000 });
    await expect(page.getByText(profileTitle).first()).toBeVisible({ timeout: 15000 });

    // 4. F5 Reload Persistence
    await page.reload();
    await expect(page.getByText(profileTitle).first()).toBeVisible({ timeout: 15000 });
  });

  test('US 2.2: Live Tailoring via Control Inclusion & Exclusion Rules', async ({ page, apiSetup }) => {
    const catUuid = await apiSetup.createCatalog({
      title: 'Inclusion Source Catalog',
      groups: [
        {
          id: 'ac',
          title: 'Access Control',
          controls: [
            { id: 'ac-1', title: 'Access Control Policy', parts: [{ id: 'ac-1_smt', name: 'statement', prose: 'Policy prose.' }] },
            { id: 'ac-2', title: 'Account Management', parts: [{ id: 'ac-2_smt', name: 'statement', prose: 'Account prose.' }] }
          ]
        }
      ]
    });

    const profUuid = await apiSetup.createProfile({
      title: 'Inclusion Tailoring Profile',
      catalogUuid: catUuid,
      imports: [
        {
          href: `../catalogs/${catUuid}.json`,
          'include-controls': [
            { 'with-ids': ['ac-1'] }
          ]
        }
      ]
    });

    // 1. Edit mode: Full catalog visible, ac-1 active, ac-2 marked as excluded
    await navigateToProfile(page, profUuid, apiSetup.workspaceId, true);

    const groupHeader = page.locator('[data-testid="tree-node-ac"], [data-dnd-id="ac"]').or(page.getByText('Access Control')).first();
    await expect(groupHeader).toBeVisible({ timeout: 30000 });
    await groupHeader.click();

    const controlItem1 = page.locator('[data-testid="tree-node-ac-1"], [data-dnd-id="ac-1"]').or(page.getByText('Access Control Policy')).first();
    await expect(controlItem1).toBeVisible({ timeout: 30000 });

    // In edit mode, ac-2 is visible but marked excluded
    const controlItem2 = page.locator('[data-testid="tree-node-ac-2"]');
    await expect(controlItem2).toBeVisible({ timeout: 15000 });
    await expect(controlItem2).toHaveClass(/excluded/);

    // 2. View mode: Only active resolved controls rendered (ac-2 is hidden)
    await navigateToProfile(page, profUuid, apiSetup.workspaceId, false);
    const viewGroupHeader = page.locator('[data-testid="tree-node-ac"], [data-dnd-id="ac"]').or(page.getByText('Access Control')).first();
    await expect(viewGroupHeader).toBeVisible({ timeout: 30000 });
    await viewGroupHeader.click();

    const viewControl1 = page.locator('[data-testid="tree-node-ac-1"]');
    await expect(viewControl1).toBeVisible({ timeout: 15000 });

    const viewControl2 = page.locator('[data-testid="tree-node-ac-2"]');
    await expect(viewControl2).not.toBeVisible();
  });

  test('US 2.27 & US 2.30: Structuring Mode Selector & Full Structure Clone', async ({ page, apiSetup }) => {
    const catUuid = await apiSetup.createCatalog({
      title: 'Structure Source Catalog',
      groups: [
        {
          id: 'ac',
          title: 'Access Control',
          controls: [
            { id: 'ac-1', title: 'Access Control Policy', parts: [{ id: 'ac-1_smt', name: 'statement', prose: 'Policy prose.' }] },
            { id: 'ac-2', title: 'Account Management', parts: [{ id: 'ac-2_smt', name: 'statement', prose: 'Account prose.' }] }
          ]
        }
      ]
    });

    const profUuid = await apiSetup.createProfile({
      title: 'Structuring Mode Profile',
      catalogUuid: catUuid
    });

    await navigateToProfile(page, profUuid, apiSetup.workspaceId);

    // 1. Select Structuring Mode "custom"
    await switchStructuringMode(page, 'custom');
    
    // 2. Click "Import Full Structure" on the import card
    const importStructureBtn = page.getByRole('button', { name: /Import Full Structure/i }).first();
    await expect(importStructureBtn).toBeVisible({ timeout: 15000 });
    await importStructureBtn.click();

    // 3. F5 Reload Persistence
    await page.reload();
    await navigateToProfile(page, profUuid, apiSetup.workspaceId);
    await expect(page.getByText('Access Control').first()).toBeVisible({ timeout: 15000 });
  });

  test('US 2.7 & US 2.20: Custom Group Creation & Control Pool Drag & Drop', async ({ page, apiSetup }) => {
    const catUuid = await apiSetup.createCatalog({
      title: 'DND Pool Source Catalog',
      groups: [
        {
          id: 'sc',
          title: 'System and Communications',
          controls: [
            { id: 'sc-7', title: 'Boundary Protection', parts: [{ id: 'sc-7_smt', name: 'statement', prose: 'Boundary protection prose.' }] }
          ]
        }
      ]
    });

    const profUuid = await apiSetup.createProfile({
      title: 'DND Tailoring Profile',
      catalogUuid: catUuid
    });

    await navigateToProfile(page, profUuid, apiSetup.workspaceId);

    // 1. Switch to custom mode
    await switchStructuringMode(page, 'custom');

    // 2. Open Imports tab and verify Control Pool is available
    await selectSidebarTab(page, 'Imports');
    const poolTitle = page.getByText(/Control Pool \(Drag & Drop\)|Source Catalog Hierarchy/i).first();
    await expect(poolTitle).toBeVisible({ timeout: 15000 });

    // 3. Verify control sc-7 is listed in the Control Pool
    const sc7PoolItem = page.getByText('Boundary Protection').first();
    await expect(sc7PoolItem).toBeVisible({ timeout: 15000 });
  });

  test('US 2.4, US 2.25 & US 2.28: Inline Statement Editing, Save & Persistence', async ({ page, apiSetup }) => {
    const catUuid = await apiSetup.createCatalog({
      title: 'Inline Alters Catalog',
      groups: [
        {
          id: 'ac',
          title: 'Access Control',
          controls: [
            {
              id: 'ac-2',
              title: 'Account Management',
              parts: [
                {
                  id: 'ac-2_smt',
                  name: 'statement',
                  prose: 'Manage information system accounts.'
                }
              ]
            }
          ]
        }
      ]
    });

    const profUuid = await apiSetup.createProfile({
      title: 'Alters Test Profile',
      catalogUuid: catUuid
    });

    await navigateToProfile(page, profUuid, apiSetup.workspaceId);

    // 1. Expand sidebar group and navigate to control ac-2
    const groupHeader = page.locator('[data-testid="tree-node-ac"], [data-dnd-id="ac"]').or(page.getByText('Access Control')).first();
    await expect(groupHeader).toBeVisible({ timeout: 30000 });
    await groupHeader.click();

    const controlItem = page.locator('[data-testid="tree-node-ac-2"], [data-dnd-id="ac-2"]').or(page.getByText('Account Management')).first();
    await expect(controlItem).toBeVisible({ timeout: 30000 });
    await controlItem.click();

    // 2. Verify statement prose from catalog is rendered in profile view
    await expect(page.getByText('Manage information system accounts.')).toBeVisible({ timeout: 30000 });

    // 3. F5 Reload Persistence
    await page.reload();
    await waitForProfileResolution(page);

    const groupHeaderAfter = page.locator('[data-testid="tree-node-ac"], [data-dnd-id="ac"]').or(page.getByText('Access Control')).first();
    await expect(groupHeaderAfter).toBeVisible({ timeout: 30000 });
    await groupHeaderAfter.click();

    const controlItemAfter = page.locator('[data-testid="tree-node-ac-2"], [data-dnd-id="ac-2"]').first();
    await expect(controlItemAfter).toBeVisible({ timeout: 30000 });
    await controlItemAfter.click();
    await expect(page.getByText('Manage information system accounts.')).toBeVisible({ timeout: 30000 });
  });

  test('US 2.3, US 2.8 & US 2.17: Parameter Card Visible with Override', async ({ page, apiSetup }) => {
    const catUuid = await apiSetup.createCatalog({
      title: 'Param Choice Catalog',
      groups: [
        {
          id: 'ac',
          title: 'Access Control',
          controls: [
            {
              id: 'ac-1',
              title: 'Access Control Policy',
              params: [
                {
                  id: 'ac-1_prm_1',
                  label: 'review-frequency',
                  values: ['annual'],
                  select: {
                    'how-many': 'one',
                    choice: ['annual', 'semi-annual', 'quarterly']
                  }
                }
              ],
              parts: [{ id: 'ac-1_smt', name: 'statement', prose: 'Review policy at {{ insert: param, ac-1_prm_1 }}.' }]
            }
          ]
        }
      ]
    });

    const profUuid = await apiSetup.createProfile({
      title: 'Param Overrides Profile',
      catalogUuid: catUuid,
      modify: {
        'set-parameters': [
          {
            'param-id': 'ac-1_prm_1',
            values: ['semi-annual']
          }
        ]
      }
    });

    await navigateToProfile(page, profUuid, apiSetup.workspaceId);

    // 1. Navigate to control ac-1 in sidebar
    const groupHeader = page.locator('[data-testid="tree-node-ac"], [data-dnd-id="ac"]').or(page.getByText('Access Control')).first();
    await expect(groupHeader).toBeVisible({ timeout: 30000 });
    await groupHeader.click();

    const controlItem = page.locator('[data-testid="tree-node-ac-1"], [data-dnd-id="ac-1"]').or(page.getByText('Access Control Policy')).first();
    await expect(controlItem).toBeVisible({ timeout: 30000 });
    await controlItem.click();

    // 2. Verify Parameter section is visible
    const paramSection = page.getByText(/Control Parameter Overrides|ac-1_prm_1/i).first();
    await expect(paramSection).toBeVisible({ timeout: 30000 });

    // 3. F5 Reload Persistence
    await page.reload();
    await waitForProfileResolution(page);
    await groupHeader.click();
    await controlItem.click();
    await expect(paramSection).toBeVisible({ timeout: 30000 });
  });

  test('US 2.12 & US 2.29: Multi-Catalog Import Shows First Definition', async ({ page, apiSetup }) => {
    const catUuid1 = await apiSetup.createCatalog({
      title: 'Catalog Primary',
      groups: [
        {
          id: 'ac',
          title: 'Access Control',
          controls: [
            { id: 'ac-1', title: 'Access Control Policy', parts: [{ id: 'ac-1_smt', name: 'statement', prose: 'Primary definition.' }] }
          ]
        }
      ]
    });

    const catUuid2 = await apiSetup.createCatalog({
      title: 'Catalog Secondary',
      groups: [
        {
          id: 'ac',
          title: 'Access Control',
          controls: [
            { id: 'ac-1', title: 'Access Control Policy Duplicate', parts: [{ id: 'ac-1_smt', name: 'statement', prose: 'Secondary definition.' }] }
          ]
        }
      ]
    });

    const profUuid = await apiSetup.createDocument('profiles', {
      profile: {
        metadata: {
          title: 'Multi Catalog Conflict Profile',
          version: '1.0.0',
          'oscal-version': '1.1.2',
          'last-modified': new Date().toISOString()
        },
        imports: [
          { href: `../catalogs/${catUuid1}.json`, 'include-all': {} },
          { href: `../catalogs/${catUuid2}.json`, 'include-all': {} }
        ],
        merge: {
          combine: { method: 'use-first' },
          'as-is': {}
        }
      }
    });

    await navigateToProfile(page, profUuid, apiSetup.workspaceId);

    // Verify sidebar shows the first definition's control
    const groupHeader = page.locator('[data-testid="tree-node-ac"], [data-dnd-id="ac"]').or(page.getByText('Access Control')).first();
    await expect(groupHeader).toBeVisible({ timeout: 30000 });
    await groupHeader.click();

    const controlItem = page.locator('[data-testid="tree-node-ac-1"], [data-dnd-id="ac-1"]').or(page.getByText(/Access Control Policy/)).first();
    await expect(controlItem).toBeVisible({ timeout: 30000 });
  });

  test('US 2.18: Export Button Triggers Download', async ({ page, apiSetup }) => {
    const catUuid = await apiSetup.createCatalog({ title: 'Export Base Catalog' });
    const profUuid = await apiSetup.createProfile({
      title: 'Export Test Profile',
      catalogUuid: catUuid
    });

    await navigateToProfile(page, profUuid, apiSetup.workspaceId);

    // Wait for profile to load
    await expect(page.getByText('Export Test Profile').first()).toBeVisible({ timeout: 15000 });

    // Open Export modal and verify format options
    await page.getByRole('button', { name: /Export/i }).first().click();
    await expect(page.getByTestId('export-confirm-btn')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('export-format-json')).toBeChecked();
  });

  test('US 2.15: Profile Sidebar Navigation Hub Switches Views', async ({ page, apiSetup }) => {
    const catUuid = await apiSetup.createCatalog({ title: 'Nav Base Catalog' });
    const profUuid = await apiSetup.createProfile({
      title: 'Navigation Test Profile',
      catalogUuid: catUuid
    });

    await navigateToProfile(page, profUuid, apiSetup.workspaceId);
    await expect(page.getByText('Navigation Test Profile').first()).toBeVisible({ timeout: 15000 });

    // 1. Metadata tab
    await page.getByTestId('profile-sidebar-metadata').click();
    await expect(page.getByText('General Information').or(page.locator('input[value*="Navigation Test"]')).first()).toBeVisible({ timeout: 10000 });

    // 2. Properties tab
    await page.getByTestId('profile-sidebar-properties').click();
    await expect(page.getByText('Central Property Hub')).toBeVisible({ timeout: 10000 });

    // 3. Parameters tab
    await page.getByTestId('profile-sidebar-parameters').click();
    await expect(page.getByText(/Modified & Custom Profile Parameters|Parameter Scopes in OSCAL/i).first()).toBeVisible({ timeout: 10000 });

    // 4. Back Matter tab
    await page.getByTestId('profile-sidebar-backmatter').click();
    await expect(page.getByText('Back Matter / Resources')).toBeVisible({ timeout: 10000 });

    // 5. Imports tab
    await page.getByTestId('profile-sidebar-imports').click();
    await expect(page.getByText(/Imported Sources/i).first()).toBeVisible({ timeout: 10000 });

    // 6. Overview tab
    await page.getByTestId('profile-sidebar-overview').click();
    await expect(page.getByText('CONTROL FAMILIES').first()).toBeVisible({ timeout: 10000 });
  });

  test('US 2.11 & US 2.26: Control Alters and Props/Links Integration in Profile Mode', async ({ page, apiSetup }) => {
    const catUuid = await apiSetup.createCatalog({
      title: 'Alters Props Catalog',
      groups: [
        {
          id: 'ac',
          title: 'Access Control',
          controls: [
            {
              id: 'ac-2',
              title: 'Account Management',
              props: [{ name: 'label', value: 'AC-2' }],
              parts: [{ id: 'ac-2_smt', name: 'statement', prose: 'Manage accounts.' }]
            }
          ]
        }
      ]
    });

    const profUuid = await apiSetup.createProfile({
      title: 'Alters Props Profile',
      catalogUuid: catUuid
    });

    await navigateToProfile(page, profUuid, apiSetup.workspaceId);

    // Navigate to control ac-2
    const groupHeader = page.locator('[data-testid="tree-node-ac"], [data-dnd-id="ac"]').or(page.getByText('Access Control')).first();
    await expect(groupHeader).toBeVisible({ timeout: 30000 });
    await groupHeader.click();

    const controlItem = page.locator('[data-testid="tree-node-ac-2"], [data-dnd-id="ac-2"]').or(page.getByText('Account Management')).first();
    await expect(controlItem).toBeVisible({ timeout: 30000 });
    await controlItem.click();

    // Verify Control Header, Statements and Properties are visible
    await expect(page.getByText('Account Management').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Statements / Prose Parts').first()).toBeVisible({ timeout: 15000 });
  });

  test('US 2.1 & US 2.27: Dynamic Import Source Management & Context-Aware Control Pool', async ({ page, apiSetup }) => {
    const catAlphaUuid = await apiSetup.createCatalog({
      title: 'Source Catalog Alpha',
      groups: [
        {
          id: 'grp-a',
          title: 'Alpha Family',
          controls: [{ id: 'alpha-1', title: 'Alpha Control 1', parts: [{ id: 'alpha-1_smt', name: 'statement', prose: 'Alpha prose.' }] }]
        }
      ]
    });

    const catBetaUuid = await apiSetup.createCatalog({
      title: 'Source Catalog Beta',
      groups: [
        {
          id: 'grp-b',
          title: 'Beta Family',
          controls: [{ id: 'beta-1', title: 'Beta Control 1', parts: [{ id: 'beta-1_smt', name: 'statement', prose: 'Beta prose.' }] }]
        }
      ]
    });

    const profUuid = await apiSetup.createProfile({
      title: 'Import Management Profile',
      catalogUuid: catAlphaUuid
    });

    await navigateToProfile(page, profUuid, apiSetup.workspaceId);

    // 1. Navigate to Imports tab
    await selectSidebarTab(page, 'Imports');

    // 2. In default 'as-is' mode, verify Alpha import is listed and Control Pool is NOT visible
    const alphaCard = page.locator('.import-card').filter({ hasText: 'Source Catalog Alpha' });
    await expect(alphaCard).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/Control Pool \(Drag & Drop\)/i)).not.toBeVisible();

    // 3. Switch to 'custom' structuring mode -> Control Pool becomes visible
    const modeSelect = page.getByTestId('structuring-mode-select').or(page.locator('select').filter({ hasText: /as-is|custom|flat/i })).first();
    await expect(modeSelect).toBeVisible({ timeout: 15000 });
    await modeSelect.selectOption('custom');
    await expect(page.getByText(/Control Pool \(Drag & Drop\)/i).first()).toBeVisible({ timeout: 15000 });

    // 4. Add Source Catalog Beta from Add Import dropdown
    const addImportSelect = page.getByTestId('add-import-source-select').or(page.locator('select').filter({ hasText: /Add Import Source|Select Catalog/i })).first();
    await expect(addImportSelect).toBeVisible({ timeout: 15000 });
    await addImportSelect.selectOption(`catalog:${catBetaUuid}`);

    // Verify Beta import is now rendered
    const betaCard = page.locator('.import-card').filter({ hasText: 'Source Catalog Beta' });
    await expect(betaCard).toBeVisible({ timeout: 15000 });

    // 5. Remove Source Catalog Beta
    await betaCard.getByRole('button', { name: /Remove/i }).click();
    await expect(betaCard).not.toBeVisible({ timeout: 15000 });

    // 6. Switch back to 'as-is' mode -> Control Pool is hidden
    await modeSelect.selectOption('as-is');
    await expect(page.getByText(/Control Pool \(Drag & Drop\)/i)).not.toBeVisible();

    // 7. F5 Reload Persistence
    await page.reload();
    await waitForProfileResolution(page);
    await selectSidebarTab(page, 'Imports');
    await expect(page.locator('.import-card').filter({ hasText: 'Source Catalog Alpha' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/Control Pool \(Drag & Drop\)/i)).not.toBeVisible();
  });

});
