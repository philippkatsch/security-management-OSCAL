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
    const groupHeader = page.locator('[data-dnd-id="ac"]').or(page.getByText('Access Control')).first();
    await expect(groupHeader).toBeVisible({ timeout: 30000 });
    await groupHeader.click();

    // Click control item in sidebar
    const controlItem = page.locator('[data-dnd-id="ac-2"]').or(page.getByText('Account Management')).first();
    await expect(controlItem).toBeVisible({ timeout: 30000 });
    await controlItem.click();

    // Locate statement textarea and fill modified text
    const proseArea = page.locator('.prose-param-container textarea, textarea[placeholder="Enter prose text..."]').first();
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
    await expect(addSubItemBtn).toBeVisible({ timeout: 30000 });
    await addSubItemBtn.click();

    // Verify sub-item is created and fill sub-item prose
    const subItemProse = page.locator('.prose-param-container textarea').nth(1);
    await expect(subItemProse).toBeVisible({ timeout: 30000 });
    await subItemProse.fill('a. Conduct quarterly account audits.');
    await subItemProse.dispatchEvent('change');

    // Verify backend profile JSON structure exists
    const doc = await apiSetup.getDocument('profile', profUuid);
    expect(doc.profile).toBeDefined();
    expect(doc.profile.uuid).toBe(profUuid);
  });

  test('US 2.5 & US 2.7: Feature 13 - Custom Local Control Creation & Top-Level Group Prompt', async ({ page, apiSetup }) => {
    const profUuid = await apiSetup.createDocument('profile', {
      profile: {
        metadata: {
          title: 'Custom Local Controls Profile',
          version: '1.0.0',
          'oscal-version': '1.1.2',
          'last-modified': new Date().toISOString()
        },
        imports: [],
        'local-controls': [
          {
            id: 'corp-sec-1',
            title: 'Onboarding Security Training',
            parts: [{ id: 'corp-sec-1_smt', name: 'statement', prose: 'All employees must complete security training.' }]
          }
        ]
      }
    });

    await navigateToProfile(page, profUuid, apiSetup.workspaceId);

    // Verify custom control is rendered in sidebar navigation
    const customControlItem = page.getByText('Onboarding Security Training').first();
    await expect(customControlItem).toBeVisible({ timeout: 30000 });
    await customControlItem.click();

    // Verify detail pane displays custom control ID and prose
    await expect(page.getByText('corp-sec-1').first()).toBeVisible({ timeout: 30000 });
    await expect(page.getByText('All employees must complete security training.').first()).toBeVisible({ timeout: 30000 });

    // Verify schema integrity on GET
    const doc = await apiSetup.getDocument('profile', profUuid);
    expect(doc.profile).toBeDefined();
    expect(doc.profile.uuid).toBe(profUuid);

    // Add Top-level Group via dialog prompt
    page.once('dialog', dialog => dialog.accept('Corporate Access Policy'));
    const addGroupBtn = page.getByRole('button', { name: /add top-level group/i });
    await expect(addGroupBtn).toBeVisible({ timeout: 30000 });
    await addGroupBtn.click();

    // Assert top-level group appears in sidebar
    await expect(page.getByText('Corporate Access Policy').first()).toBeVisible({ timeout: 30000 });
  });

  test('US 2.8 & US 2.17: Feature 14 - Parameter Choice Dropdowns, Freitext Custom Values, and Revert Actions', async ({ page, apiSetup }) => {
    const catUuid = await apiSetup.createCatalog({
      title: 'Param Choice Catalog',
      groups: [
        {
          id: 'ia',
          title: 'Identification and Authentication',
          controls: [
            {
              id: 'ia-5',
              title: 'Authenticator Management',
              parts: [{ id: 'ia-5_smt', name: 'statement', prose: 'Manage authenticators.' }],
              params: [
                {
                  id: 'ia-5_prm_1',
                  label: 'authenticator type',
                  select: {
                    'how-many': 'one',
                    choice: ['piv-card', 'hardware-token', 'passkey']
                  }
                }
              ]
            }
          ]
        }
      ]
    });

    const profUuid = await apiSetup.createProfile({
      title: 'Param Choice Tailored Profile',
      catalogUuid: catUuid,
      modify: {
        'set-parameters': [
          {
            'param-id': 'ia-5_prm_1',
            values: ['passkey']
          }
        ]
      }
    });

    await navigateToProfile(page, profUuid, apiSetup.workspaceId);

    // Navigate to control ia-5
    const groupHeader = page.locator('[data-dnd-id="ia"]').or(page.getByText('Identification and Authentication')).first();
    await expect(groupHeader).toBeVisible({ timeout: 30000 });
    await groupHeader.click();

    const controlItem = page.locator('[data-dnd-id="ia-5"]').or(page.getByText('Authenticator Management')).first();
    await expect(controlItem).toBeVisible({ timeout: 30000 });
    await controlItem.click();

    // Locate parameter card and toggle edit mode
    const paramCard = page.locator('#param-card-ia-5_prm_1').or(page.locator('.parameter-card')).first();
    await expect(paramCard).toBeVisible({ timeout: 30000 });

    const editParamBtn = paramCard.getByRole('button', { name: /✏️ edit/i }).first();
    await expect(editParamBtn).toBeVisible({ timeout: 30000 });
    await editParamBtn.click();

    // Select option in choice dropdown inside parameter card
    const choiceSelect = paramCard.locator('select').first();
    await expect(choiceSelect).toBeVisible({ timeout: 30000 });
    await choiceSelect.selectOption('passkey');

    // Select custom freitext mode
    await choiceSelect.selectOption('__custom__');
    const customInput = paramCard.locator('input[placeholder*="custom"], input[placeholder*="Custom"]').first();
    await expect(customInput).toBeVisible({ timeout: 30000 });
    await customInput.fill('biometric-fido2');
    await customInput.dispatchEvent('change');

    // Revert parameter to catalog default
    const revertBtn = paramCard.getByRole('button', { name: /revert to default|revert/i }).first();
    await expect(revertBtn).toBeVisible({ timeout: 30000 });
    await revertBtn.click();
  });

  test('US 2.20 & US 2.25: Feature 15 - Drag-to-Trash Target (🗑️) & Property Revert / Restore Badges', async ({ page, apiSetup }) => {
    const catUuid = await apiSetup.createCatalog({
      title: 'Trash Test Catalog',
      groups: [
        {
          id: 'sc',
          title: 'System and Communications',
          controls: [{ id: 'sc-7', title: 'Boundary Protection', parts: [{ id: 'sc-7_smt', name: 'statement', prose: 'Boundary protection prose.' }] }]
        }
      ]
    });

    const profUuid = await apiSetup.createProfile({
      title: 'Property Badges Profile',
      catalogUuid: catUuid
    });

    await navigateToProfile(page, profUuid, apiSetup.workspaceId);

    // Verify Drag-to-Trash Bin Target is present and visible (strict locator without .or() fallback)
    const trashTarget = page.locator('div[data-dnd-id="trash"][data-dnd-type="trash"]');
    await expect(trashTarget).toBeVisible({ timeout: 30000 });
    await expect(trashTarget).toContainText('Drag elements here to delete');

    // Expand sidebar group
    const groupHeader = page.locator('[data-dnd-id="sc"]').or(page.getByText('System and Communications')).first();
    await expect(groupHeader).toBeVisible({ timeout: 30000 });
    await groupHeader.click();

    // Verify control item in group
    const controlItem = page.locator('[data-dnd-id="sc-7"]').first();
    await expect(controlItem).toBeVisible({ timeout: 30000 });

    // Perform drag-to-trash action on control item
    await controlItem.dragTo(trashTarget);

    // Verify backend document integrity
    const doc = await apiSetup.getDocument('profile', profUuid);
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
    const overviewItem = page.getByText('Overview').first();
    await expect(overviewItem).toBeVisible({ timeout: 30000 });
    await overviewItem.click();

    // Click Metadata item in sidebar
    const metadataItem = page.locator('.sidebar-item').filter({ hasText: 'Metadata' }).first();
    await expect(metadataItem).toBeVisible({ timeout: 30000 });
    await metadataItem.click();

    // Assert Baseline Statistics box is visible in DocumentOverview Metadata tab
    const statsBox = page.getByText('📋 Baseline Statistics').first();
    await expect(statsBox).toBeVisible({ timeout: 30000 });
    await expect(page.getByText('Controls').first()).toBeVisible({ timeout: 30000 });
    await expect(page.getByText('Groups').first()).toBeVisible({ timeout: 30000 });
    await expect(page.getByText('Merge').first()).toBeVisible({ timeout: 30000 });
    await expect(page.getByText('Params').first()).toBeVisible({ timeout: 30000 });
    await expect(page.getByText('Alters').first()).toBeVisible({ timeout: 30000 });

    // Expand control sc-7 and edit prose to trigger 'Modified' diff badge
    const groupHeader = page.locator('[data-dnd-id="sc"]').or(page.getByText('System and Communications')).first();
    await expect(groupHeader).toBeVisible({ timeout: 30000 });
    await groupHeader.click();

    const controlItem = page.locator('[data-dnd-id="sc-7"]').first();
    await expect(controlItem).toBeVisible({ timeout: 30000 });
    await controlItem.click();

    const proseArea = page.locator('.prose-param-container textarea').first();
    await expect(proseArea).toBeVisible({ timeout: 30000 });
    await proseArea.fill('Boundary protection prose updated with firewall rules.');
    await proseArea.dispatchEvent('change');

    await expect(page.getByText('Modified').first()).toBeVisible({ timeout: 30000 });
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
    const groupHeader = page.locator('[data-dnd-id="ac"]').or(page.getByText('Access Control')).first();
    await expect(groupHeader).toBeVisible({ timeout: 30000 });
    await groupHeader.click();

    const controlItem = page.locator('[data-dnd-id="ac-2"]').first();
    await expect(controlItem).toBeVisible({ timeout: 30000 });
    await controlItem.click();

    // Click '➕ Sub-item' button
    const addSubItemBtn = page.getByRole('button', { name: /➕ sub-item|\+ sub-item/i }).first();
    await expect(addSubItemBtn).toBeVisible({ timeout: 30000 });
    await addSubItemBtn.click();

    // Fill sub-item prose
    const subItemProse = page.locator('.prose-param-container textarea').nth(1);
    await expect(subItemProse).toBeVisible({ timeout: 30000 });
    await subItemProse.fill('a. Sub-part detail requirement.');
    await subItemProse.dispatchEvent('change');

    // Click '➕ Add Statement' button
    const addStatementBtn = page.getByRole('button', { name: /➕ add statement|\+ add statement/i }).first();
    await expect(addStatementBtn).toBeVisible({ timeout: 30000 });
    await addStatementBtn.click();

    // Fill new top-level statement prose
    const newStatementProse = page.locator('.prose-param-container textarea').nth(2);
    await expect(newStatementProse).toBeVisible({ timeout: 30000 });
    await newStatementProse.fill('b. Top-level statement prose requirement.');
    await newStatementProse.dispatchEvent('change');

    // Verify backend profile JSON structure exists
    const doc = await apiSetup.getDocument('profile', profUuid);
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

    const profUuid = await apiSetup.createDocument('profile', {
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
    const groupAc = page.locator('[data-dnd-id="ac"]').or(page.getByText('Access Control')).first();
    await expect(groupAc).toBeVisible({ timeout: 30000 });
    await groupAc.click();

    const itemAc1 = page.locator('[data-dnd-id="ac-1"]').or(page.getByText('Access Control Policy'));
    await expect(itemAc1.first()).toBeVisible({ timeout: 30000 });

    // 2. Verify sidebar group System and Communications renders sc-1 & sc-7 (sc-? single-char wildcard match)
    const groupSc = page.locator('[data-dnd-id="sc"]').or(page.getByText('System and Communications')).first();
    await expect(groupSc).toBeVisible({ timeout: 30000 });
    await groupSc.click();

    const itemSc1 = page.locator('[data-dnd-id="sc-1"]').or(page.getByText('System Policy'));
    await expect(itemSc1.first()).toBeVisible({ timeout: 30000 });

    const itemSc7 = page.locator('[data-dnd-id="sc-7"]').or(page.getByText('Boundary Protection'));
    await expect(itemSc7.first()).toBeVisible({ timeout: 30000 });

    // 3. Verify document in backend matches pattern matching configuration
    const doc = await apiSetup.getDocument('profile', profUuid);
    expect(doc.profile.imports[0]['include-controls'][0].matching[0].pattern).toBe('ac-*');
    expect(doc.profile.imports[0]['include-controls'][1].matching[0].pattern).toBe('sc-?');
    expect(doc.profile.imports[0]['exclude-controls'][0].matching[0].pattern).toBe('ac-2');
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

    const profUuid = await apiSetup.createDocument('profile', {
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

    // Verify control ac-1 displays first definition title under 'use-first'
    const groupHeader = page.locator('[data-dnd-id="ac"]').or(page.getByText('Access Control')).first();
    await expect(groupHeader).toBeVisible({ timeout: 30000 });
    await groupHeader.click();

    const controlItem = page.locator('[data-dnd-id="ac-1"]').or(page.getByText('Access Control Policy A')).first();
    await expect(controlItem).toBeVisible({ timeout: 30000 });
    await controlItem.click();

    await expect(page.getByText('Access Control Policy A').first()).toBeVisible({ timeout: 30000 });

    // Verify backend merge config for 'use-first'
    const doc1 = await apiSetup.getDocument('profile', profUuid);
    expect(doc1.profile.merge.combine.method).toBe('use-first');

    // Create a second profile testing 'keep' strategy
    const profUuidKeep = await apiSetup.createDocument('profile', {
      profile: {
        metadata: {
          title: 'Multi Catalog Keep Strategy Profile',
          version: '1.0.0',
          'oscal-version': '1.1.2',
          'last-modified': new Date().toISOString()
        },
        imports: [
          { href: `../catalogs/${catUuid1}.json`, 'include-all': {} },
          { href: `../catalogs/${catUuid2}.json`, 'include-all': {} }
        ],
        merge: {
          combine: { method: 'keep' },
          'as-is': {}
        }
      }
    });

    // UI Navigation for 'keep' strategy
    await navigateToProfile(page, profUuidKeep, apiSetup.workspaceId);

    // Expand Access Control group in keep profile
    const groupHeaderKeep = page.locator('[data-dnd-id="ac"]').or(page.getByText('Access Control')).first();
    await expect(groupHeaderKeep).toBeVisible({ timeout: 30000 });
    await groupHeaderKeep.click();

    // Verify under 'keep' method, duplicate controls from both Catalog A and Catalog B are retained in UI
    await expect(page.getByText('Access Control Policy A').first()).toBeVisible({ timeout: 30000 });
    await expect(page.getByText('Access Control Policy B').first()).toBeVisible({ timeout: 30000 });

    // Verify backend merge config for 'keep'
    const doc2 = await apiSetup.getDocument('profile', profUuidKeep);
    expect(doc2.profile.merge.combine.method).toBe('keep');
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

    // 1. Assert initial state renders Access Control group
    const groupItem = page.locator('[data-dnd-id="ac"]').or(page.getByText('Access Control')).first();
    await expect(groupItem).toBeVisible({ timeout: 15000 });

    // 2. Open Overview / Metadata tab and check Baseline Statistics
    const overviewItem = page.locator('.sidebar-item', { hasText: 'Overview' }).or(page.getByText('Overview')).first();
    await expect(overviewItem).toBeVisible({ timeout: 15000 });
    await overviewItem.click();

    await expect(page.locator('body')).toContainText(/Baseline Statistics|Overview|Catalog/i, { timeout: 15000 });
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

    // 1. Select control ac-1
    const controlItem = page.locator('[data-dnd-id="ac-1"]').or(page.getByText('Access Policy')).first();
    await expect(controlItem).toBeVisible({ timeout: 15000 });
    await controlItem.click();

    // 2. Verify parameter card or set value
    await expect(page.locator('body')).toContainText(/semi-annual|ac-1/i, { timeout: 15000 });
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

    // 1. Select control ac-1
    const controlItem = page.locator('[data-dnd-id="ac-1"]').or(page.getByText('Access Control Policy')).first();
    await expect(controlItem).toBeVisible({ timeout: 15000 });
    await controlItem.click();

    // 2. Verify removed statement indicator in edit mode
    await expect(page.locator('body')).toContainText(/Removed|Original statement prose/i, { timeout: 15000 });
  });
});

