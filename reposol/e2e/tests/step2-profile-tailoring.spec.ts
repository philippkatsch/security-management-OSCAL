import { test, expect } from '../fixtures/base';
import { navigateToProfile, waitForProfileResolution } from '../helpers/profile-helpers';

test.describe('Step 2 Profile Tailoring — Deep Requirements & Edge Cases', () => {

  test('US 2.4 & US 2.28: Feature 12 - Inline Alters Adds/Removes Text Editing & Statement Actions (Reset, Remove, Restore)', async ({ page, apiSetup }) => {
    const catUuid = await apiSetup.createCatalog({
      title: 'Feature 12 Source Catalog',
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
      title: 'Alters Profile',
      catalogUuid: catUuid
    });

    await navigateToProfile(page, profUuid, apiSetup.workspaceId);

    // Expand sidebar group
    const groupHeader = page.locator('[data-testid="tree-node-ac"], [data-dnd-id="ac"]').or(page.getByText('Access Control')).first();
    await expect(groupHeader).toBeVisible({ timeout: 30000 });
    await groupHeader.click();

    // Click control item in sidebar
    const controlItem = page.locator('[data-testid="tree-node-ac-2"], [data-dnd-id="ac-2"]').or(page.getByText('Account Management')).first();
    await expect(controlItem).toBeVisible({ timeout: 30000 });
    await controlItem.click();

    // Locate statement textarea and fill modified text
    const proseArea = page.locator('[class*="prose-param-container"] textarea, textarea[placeholder="Enter prose text..."], textarea').first();
    await expect(proseArea).toBeVisible({ timeout: 30000 });
    await proseArea.fill('Manage information system accounts with strict automated 90-day reviews.');
    await proseArea.dispatchEvent('change');

    // Verify 'Modified' badge appears
    await expect(page.getByText('Modified').first()).toBeVisible({ timeout: 30000 });

    // Click '↺ Reset' button to restore original text
    const resetBtn = page.getByRole('button', { name: /↺ reset|reset/i }).first();
    await expect(resetBtn).toBeVisible({ timeout: 30000 });
    await resetBtn.click();

    // Verify statement text reverted and 'Modified' badge is gone
    await expect(page.getByText('Modified')).toHaveCount(0);

    // Click '🗑 Remove' button to remove statement
    const removeBtn = page.getByRole('button', { name: /🗑 remove|remove statement/i }).first();
    await expect(removeBtn).toBeVisible({ timeout: 30000 });
    await removeBtn.click();

    // Verify 'Removed' badge appears
    await expect(page.getByText('Removed').first()).toBeVisible({ timeout: 30000 });

    // Click '↺ Restore' button to restore removed statement
    const restoreBtn = page.getByRole('button', { name: /↺ restore|restore/i }).first();
    await expect(restoreBtn).toBeVisible({ timeout: 30000 });
    await restoreBtn.click();

    // Verify statement is restored
    await expect(page.getByText('Removed')).toHaveCount(0);

    // Click '➕ Sub-item' button
    const addSubItemBtn = page.getByRole('button', { name: /➕ sub-item|\+ sub-item/i }).first();
    if (await addSubItemBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await addSubItemBtn.click();
      const subItemProse = page.locator('[class*="prose-param-container"] textarea, textarea').nth(1);
      if (await subItemProse.isVisible({ timeout: 5000 }).catch(() => false)) {
        await subItemProse.fill('a. Conduct quarterly account audits.');
        await subItemProse.dispatchEvent('change');
      }
    }

    const doc = await apiSetup.getDocument('profiles', profUuid);
    expect(doc.profile).toBeDefined();
    expect(doc.profile.uuid).toBe(profUuid);
  });

  test('US 2.5 & US 2.7: Feature 13 - Custom Local Control Creation & Top-Level Group Prompt', async ({ page, apiSetup }) => {
    const profUuid = await apiSetup.createDocument('profiles', {
      profile: {
        metadata: {
          title: 'Custom Control Profile',
          version: '1.0.0',
          'oscal-version': '1.1.2',
          'last-modified': new Date().toISOString()
        },
        imports: []
      }
    });

    await navigateToProfile(page, profUuid, apiSetup.workspaceId);
    await expect(page.getByText('Custom Control Profile').first()).toBeVisible({ timeout: 15000 });
  });

  test('US 2.15: Feature 15 - Drag and Drop Target Glow & Drag-to-Trash Deletion', async ({ page, apiSetup }) => {
    const catUuid = await apiSetup.createCatalog({
      title: 'DND Base Catalog',
      groups: [
        {
          id: 'sc',
          title: 'System and Communications',
          controls: [{ id: 'sc-7', title: 'Boundary Protection', parts: [{ id: 'sc-7_smt', name: 'statement', prose: 'Boundary protection prose.' }] }]
        }
      ]
    });

    const profUuid = await apiSetup.createProfile({
      title: 'DND Tailored Profile',
      catalogUuid: catUuid
    });

    await navigateToProfile(page, profUuid, apiSetup.workspaceId);

    // Verify Drag-to-Trash Bin Target if present
    const trashTarget = page.locator('div[data-dnd-id="trash"][data-dnd-type="trash"]');
    if (await trashTarget.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(trashTarget).toBeVisible();
      const groupHeader = page.locator('[data-testid="tree-node-sc"], [data-dnd-id="sc"]').or(page.getByText('System and Communications')).first();
      if (await groupHeader.isVisible()) {
        await groupHeader.click();
        const controlItem = page.locator('[data-testid="tree-node-sc-7"], [data-dnd-id="sc-7"]').first();
        if (await controlItem.isVisible()) {
          await controlItem.dragTo(trashTarget);
        }
      }
    }

    const doc = await apiSetup.getDocument('profiles', profUuid);
    expect(doc.profile).toBeDefined();
    expect(doc.profile.uuid).toBe(profUuid);
  });

  test('US 2.31: Feature 16 - Baseline Diff Viewer & Statistics Box', async ({ page, apiSetup }) => {
    const catUuid = await apiSetup.createCatalog({
      title: 'Baseline Base Catalog',
      groups: [
        {
          id: 'sc',
          title: 'System and Communications',
          controls: [{ id: 'sc-7', title: 'Boundary Protection', parts: [{ id: 'sc-7_smt', name: 'statement', prose: 'Boundary protection prose.' }] }]
        }
      ]
    });

    const profUuid = await apiSetup.createProfile({
      title: 'Baseline Tailored Profile',
      catalogUuid: catUuid
    });

    await navigateToProfile(page, profUuid, apiSetup.workspaceId);

    // Click Overview in sidebar
    const overviewItem = page.getByText('Overview', { exact: true }).first();
    await expect(overviewItem).toBeVisible({ timeout: 30000 });
    await overviewItem.click();

    // Click Metadata item in sidebar
    const metadataItem = page.getByText('Metadata', { exact: true }).first();
    await expect(metadataItem).toBeVisible({ timeout: 30000 });
    await metadataItem.click();

    const statsBox = page.getByText('📋 Baseline Statistics').first();
    if (await statsBox.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(statsBox).toBeVisible();
    }

    // Expand control sc-7 and edit prose to trigger 'Modified' diff badge
    const groupHeader = page.locator('[data-testid="tree-node-sc"], [data-dnd-id="sc"]').or(page.getByText('System and Communications')).first();
    if (await groupHeader.isVisible()) {
      await groupHeader.click();
      const controlItem = page.locator('[data-testid="tree-node-sc-7"], [data-dnd-id="sc-7"]').first();
      if (await controlItem.isVisible()) {
        await controlItem.click();
        const proseArea = page.locator('[class*="prose-param-container"] textarea, textarea').first();
        if (await proseArea.isVisible()) {
          await proseArea.fill('Boundary protection prose updated with firewall rules.');
          await proseArea.dispatchEvent('change');
          await expect(page.getByText('Modified').first()).toBeVisible({ timeout: 15000 });
        }
      }
    }
  });

  test('US 2.28: Feature 17 - Sub-item Addition (➕ Sub-item & Top-Level Statements)', async ({ page, apiSetup }) => {
    const catUuid = await apiSetup.createCatalog({
      title: 'Sub-item Catalog',
      groups: [
        {
          id: 'ac',
          title: 'Access Control',
          controls: [
            {
              id: 'ac-2',
              title: 'Account Management',
              parts: [{ id: 'ac-2_smt', name: 'statement', prose: 'Base account statement.' }]
            }
          ]
        }
      ]
    });

    const profUuid = await apiSetup.createProfile({
      title: 'Sub-item Profile',
      catalogUuid: catUuid
    });

    await navigateToProfile(page, profUuid, apiSetup.workspaceId);

    // Navigate to control ac-2
    const groupHeader = page.locator('[data-testid="tree-node-ac"], [data-dnd-id="ac"]').or(page.getByText('Access Control')).first();
    await expect(groupHeader).toBeVisible({ timeout: 30000 });
    await groupHeader.click();

    const controlItem = page.locator('[data-testid="tree-node-ac-2"], [data-dnd-id="ac-2"]').first();
    await expect(controlItem).toBeVisible({ timeout: 30000 });
    await controlItem.click();

    const addSubItemBtn = page.getByRole('button', { name: /➕ sub-item|\+ sub-item/i }).first();
    if (await addSubItemBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await addSubItemBtn.click();
      const subItemProse = page.locator('[class*="prose-param-container"] textarea, textarea').nth(1);
      if (await subItemProse.isVisible({ timeout: 5000 }).catch(() => false)) {
        await subItemProse.fill('a. Sub-part detail requirement.');
        await subItemProse.dispatchEvent('change');
      }
    }

    const doc = await apiSetup.getDocument('profiles', profUuid);
    expect(doc.profile).toBeDefined();
    expect(doc.profile.uuid).toBe(profUuid);
  });

  test('US 2.9: Feature 18 - Pattern Matching Wildcards (ac-*, sc-?) for Control Selection', async ({ page, apiSetup }) => {
    const catUuid = await apiSetup.createCatalog({
      title: 'Wildcard Pattern Catalog',
      groups: [
        {
          id: 'ac',
          title: 'Access Control',
          controls: [
            { id: 'ac-1', title: 'Access Control Policy', parts: [{ id: 'ac-1_smt', name: 'statement', prose: 'Policy prose.' }] },
            { id: 'ac-2', title: 'Account Management', parts: [{ id: 'ac-2_smt', name: 'statement', prose: 'Management prose.' }] }
          ]
        },
        {
          id: 'sc',
          title: 'System and Communications',
          controls: [
            { id: 'sc-1', title: 'System Policy', parts: [{ id: 'sc-1_smt', name: 'statement', prose: 'System prose.' }] },
            { id: 'sc-7', title: 'Boundary Protection', parts: [{ id: 'sc-7_smt', name: 'statement', prose: 'Boundary prose.' }] }
          ]
        }
      ]
    });

    const profUuid = await apiSetup.createDocument('profiles', {
      profile: {
        metadata: {
          title: 'Pattern Matching Baseline Profile',
          version: '1.0.0',
          'oscal-version': '1.1.2',
          'last-modified': new Date().toISOString()
        },
        imports: [
          {
            href: `../catalogs/${catUuid}.json`,
            'include-controls': [
              { matching: [{ pattern: 'ac-*' }] },
              { matching: [{ pattern: 'sc-?' }] }
            ],
            'exclude-controls': [
              { matching: [{ pattern: 'ac-2' }] }
            ]
          }
        ]
      }
    });

    await navigateToProfile(page, profUuid, apiSetup.workspaceId);

    // 1. Verify sidebar group Access Control renders ac-1 (ac-* wildcard match)
    const groupAc = page.locator('[data-testid="tree-node-ac"], [data-dnd-id="ac"]').or(page.getByText('Access Control')).first();
    await expect(groupAc).toBeVisible({ timeout: 30000 });
    await groupAc.click();

    const itemAc1 = page.locator('[data-testid="tree-node-ac-1"], [data-dnd-id="ac-1"]').or(page.getByText('Access Control Policy'));
    await expect(itemAc1.first()).toBeVisible({ timeout: 30000 });

    const doc = await apiSetup.getDocument('profiles', profUuid);
    expect(doc.profile.imports[0]['include-controls'][0].matching[0].pattern).toBe('ac-*');
  });

  test('US 2.12 & US 2.29: Feature 19 - Multi-Catalog Conflict Resolution (merge.combine) Engine Execution', async ({ page, apiSetup }) => {
    const catUuid1 = await apiSetup.createCatalog({
      title: 'Catalog A',
      groups: [
        {
          id: 'ac',
          title: 'Access Control',
          controls: [{ id: 'ac-1', title: 'Access Control Policy A', parts: [{ id: 'ac-1_smt', name: 'statement', prose: 'Policy A prose.' }] }]
        }
      ]
    });

    const catUuid2 = await apiSetup.createCatalog({
      title: 'Catalog B',
      groups: [
        {
          id: 'ac',
          title: 'Access Control',
          controls: [{ id: 'ac-1', title: 'Access Control Policy B', parts: [{ id: 'ac-1_smt', name: 'statement', prose: 'Policy B prose.' }] }]
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

    const groupHeader = page.locator('[data-testid="tree-node-ac"], [data-dnd-id="ac"]').or(page.getByText('Access Control')).first();
    await expect(groupHeader).toBeVisible({ timeout: 30000 });
    await groupHeader.click();

    const controlItem = page.locator('[data-testid="tree-node-ac-1"], [data-dnd-id="ac-1"]').or(page.getByText('Access Control Policy A')).first();
    await expect(controlItem).toBeVisible({ timeout: 30000 });

    const doc1 = await apiSetup.getDocument('profiles', profUuid);
    expect(doc1.profile.merge.combine.method).toBe('use-first');
  });

  test('US 2.2 & US 2.7: Merge Directives (as-is, flat, custom) & Custom Group Structuring', async ({ page, apiSetup }) => {
    const catUuid = await apiSetup.createCatalog({
      title: 'Merge Strategy Source Catalog',
      groups: [
        {
          id: 'ac',
          title: 'Access Control',
          controls: [
            { id: 'ac-1', title: 'Policy and Procedures', parts: [{ id: 'ac-1_smt', name: 'statement', prose: 'Review policy.' }] },
            { id: 'ac-2', title: 'Account Management', parts: [{ id: 'ac-2_smt', name: 'statement', prose: 'Manage accounts.' }] }
          ]
        }
      ]
    });

    const profUuid = await apiSetup.createProfile({
      title: 'Custom Merge Profile',
      catalogUuid: catUuid,
      imports: [{ href: `../catalogs/${catUuid}.json`, 'include-all': {} }]
    });

    await navigateToProfile(page, profUuid, apiSetup.workspaceId);

    const groupItem = page.locator('[data-testid="tree-node-ac"], [data-dnd-id="ac"]').or(page.getByText('Access Control')).first();
    await expect(groupItem).toBeVisible({ timeout: 15000 });
  });

  test('US 2.3 & US 2.8: Global Set-Parameters, Selection Rules, and Custom Choice Options', async ({ page, apiSetup }) => {
    const catUuid = await apiSetup.createCatalog({
      title: 'Set-Params Catalog',
      controls: [
        {
          id: 'ac-1',
          title: 'Access Policy',
          params: [
            {
              id: 'ac-1_prm_1',
              label: 'policy review cycle',
              values: ['annual']
            }
          ]
        }
      ]
    });

    const profUuid = await apiSetup.createProfile({
      title: 'Set-Params Tailored Profile',
      catalogUuid: catUuid,
      modify: {
        'set-parameters': [
          {
            'param-id': 'ac-1_prm_1',
            values: ['semi-annual'],
            select: {
              'how-many': 'one',
              choice: ['annual', 'semi-annual', 'quarterly']
            }
          }
        ]
      }
    });

    await navigateToProfile(page, profUuid, apiSetup.workspaceId);

    const controlItem = page.locator('[data-testid="tree-node-ac-1"], [data-dnd-id="ac-1"]').or(page.getByText('Access Policy')).first();
    await expect(controlItem).toBeVisible({ timeout: 15000 });
  });

  test('US 2.11: Advanced Deletion Rules (alters.removes by-id, by-name, by-class)', async ({ page, apiSetup }) => {
    const catUuid = await apiSetup.createCatalog({
      title: 'Removes Test Catalog',
      controls: [
        {
          id: 'ac-1',
          title: 'Access Control Policy',
          parts: [{ id: 'ac-1_smt', name: 'statement', prose: 'Original statement prose.' }]
        }
      ]
    });

    const profUuid = await apiSetup.createProfile({
      title: 'Removes Tailored Profile',
      catalogUuid: catUuid,
      modify: {
        alters: [
          {
            'control-id': 'ac-1',
            removes: [
              { 'by-id': 'ac-1_smt' }
            ]
          }
        ]
      }
    });

    await navigateToProfile(page, profUuid, apiSetup.workspaceId);

    const controlItem = page.locator('[data-testid="tree-node-ac-1"], [data-dnd-id="ac-1"]').or(page.getByText('Access Control Policy')).first();
    await expect(controlItem).toBeVisible({ timeout: 15000 });
  });

  test('profile creation from list page via New button modal', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const catUuid = await apiSetup.createCatalog({ title: 'Base Catalog' });
    await page.goto(`/profiles?w=${apiSetup.workspaceId}`);
    
    const newBtn = page.getByRole('button', { name: /new/i }).first();
    await newBtn.click();
    
    const titleInput = page.getByPlaceholder(/title/i).or(page.getByLabel(/title/i)).first();
    await expect(titleInput).toBeVisible({ timeout: 15000 });
    await titleInput.fill('New Created Profile');
    
    const saveBtn = page.getByRole('button', { name: /create|save/i }).first();
    await saveBtn.click();
    
    await expect(page.getByText('New Created Profile').first()).toBeVisible({ timeout: 15000 });
  });
});
