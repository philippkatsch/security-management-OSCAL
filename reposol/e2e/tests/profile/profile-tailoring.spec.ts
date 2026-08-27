import { test, expect } from '../../fixtures/base';
import { navigateToProfile, waitForProfileResolution, selectSidebarTab } from '../../helpers/profile-helpers';

test.describe('Profile Tailoring & Live Resolution — Comprehensive Suite', () => {

  test('US 2.3: Override parameter value and verify chip reflection and persistence', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const groups = [
      {
        id: 'ac',
        title: 'Access Control',
        controls: [
          {
            id: 'ac-1',
            title: 'Policy and Procedures',
            params: [
              { id: 'ac-1_prm_1', label: 'frequency', values: ['annually'] }
            ],
            parts: [
              { id: 'ac-1_smt', name: 'statement', prose: 'Review policy {{ insert: param, ac-1_prm_1 }}.' }
            ]
          }
        ]
      }
    ];
    const catUuid = await apiSetup.createCatalog({ title: 'Tailoring Catalog', groups });
    
    const profUuid = await apiSetup.createProfile({
      title: 'Tailoring Profile',
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
    const groupNode = page.locator('[data-testid="tree-node-ac"], [data-dnd-id="ac"]').or(page.getByText('Access Control')).first();
    await expect(groupNode).toBeVisible({ timeout: 15000 });
    await groupNode.click();
    
    const controlItem = page.locator('[data-testid="tree-node-ac-1"], [data-dnd-id="ac-1"]').or(page.getByText('Policy and Procedures')).first();
    await expect(controlItem).toBeVisible({ timeout: 15000 });
    await controlItem.click();
    
    // 2. Verify statement prose and parameter section reflect override
    await expect(page.getByText(/semi-annual/).first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/Control Parameter Overrides|ac-1_prm_1/i).first()).toBeVisible({ timeout: 15000 });
    
    // 3. F5 Reload Persistence
    await page.reload();
    await waitForProfileResolution(page);
    await groupNode.click();
    await controlItem.click();
    await expect(page.getByText(/semi-annual/).first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/Control Parameter Overrides|ac-1_prm_1/i).first()).toBeVisible({ timeout: 15000 });
  });

  test('US 2.2: Multi-Control Tailoring via Context Menu (Exclude and Re-Include)', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const groups = [
      {
        id: 'ac',
        title: 'Access Control',
        controls: [
          { id: 'ac-1', title: 'Policy and Procedures', parts: [{ id: 'ac-1_smt', name: 'statement', prose: 'Policy.' }] },
          { id: 'ac-2', title: 'Account Management', parts: [{ id: 'ac-2_smt', name: 'statement', prose: 'Accounts.' }] },
          { id: 'ac-3', title: 'Access Enforcement', parts: [{ id: 'ac-3_smt', name: 'statement', prose: 'Enforce.' }] }
        ]
      }
    ];
    const catUuid = await apiSetup.createCatalog({ title: 'Multi Tailor Catalog', groups });
    const profUuid = await apiSetup.createProfile({
      title: 'Multi Tailor Profile',
      catalogUuid: catUuid
    });

    await navigateToProfile(page, profUuid, apiSetup.workspaceId, true);

    const groupNode = page.locator('[data-testid="tree-node-ac"]').or(page.getByText('Access Control')).first();
    await expect(groupNode).toBeVisible({ timeout: 15000 });
    await groupNode.click();

    // 1. Exclude ac-1 via context menu trigger
    const ac1Node = page.locator('[data-testid="tree-node-ac-1"]');
    await expect(ac1Node).toBeVisible({ timeout: 15000 });
    const ac1MenuBtn = ac1Node.locator('button').filter({ hasText: '•••' }).first();
    await ac1MenuBtn.click();
    const excludeBtn = page.getByRole('button', { name: /Exclude from Profile/i });
    await expect(excludeBtn).toBeVisible({ timeout: 5000 });
    await excludeBtn.click();

    // Verify ac-1 has excluded class/indicator
    await expect(ac1Node).toHaveClass(/excluded/, { timeout: 10000 });

    // 2. Exclude ac-2 via context menu (multi-exclude)
    const ac2Node = page.locator('[data-testid="tree-node-ac-2"]');
    await expect(ac2Node).toBeVisible({ timeout: 15000 });
    const ac2MenuBtn = ac2Node.locator('button').filter({ hasText: '•••' }).first();
    await ac2MenuBtn.click();
    await page.getByRole('button', { name: /Exclude from Profile/i }).click();

    // Verify both ac-1 and ac-2 are excluded
    await expect(ac1Node).toHaveClass(/excluded/, { timeout: 10000 });
    await expect(ac2Node).toHaveClass(/excluded/, { timeout: 10000 });

    // 3. Re-include ac-1
    await ac1MenuBtn.click();
    const includeBtn = page.getByRole('button', { name: /Include in Profile/i });
    await expect(includeBtn).toBeVisible({ timeout: 5000 });
    await includeBtn.click();

    // Verify ac-1 is active again, ac-2 remains excluded
    await expect(ac1Node).not.toHaveClass(/excluded/, { timeout: 10000 });
    await expect(ac2Node).toHaveClass(/excluded/, { timeout: 10000 });
  });

  test('US 2.32 & US 2.33: Tree Visual Annotations and Live Conflict Banner for Orphaned Modifications', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const groups = [
      {
        id: 'ac',
        title: 'Access Control',
        controls: [
          { id: 'ac-1', title: 'Policy and Procedures', parts: [{ id: 'ac-1_smt', name: 'statement', prose: 'Policy prose.' }] },
          { id: 'ac-2', title: 'Account Management', parts: [{ id: 'ac-2_smt', name: 'statement', prose: 'Account prose.' }] }
        ]
      }
    ];
    const catUuid = await apiSetup.createCatalog({ title: 'Conflict Source Catalog', groups });

    // 1. Create profile with both controls and alterations on both
    const profUuid = await apiSetup.createProfile({
      title: 'Conflict Profile',
      catalogUuid: catUuid,
      modify: {
        alters: [
          {
            'control-id': 'ac-1',
            adds: [
              {
                position: 'ending',
                parts: [{ id: 'ac-1_org', name: 'statement', prose: 'Tailored alter on active control.' }]
              }
            ]
          },
          {
            'control-id': 'ac-2',
            adds: [
              {
                position: 'ending',
                parts: [{ id: 'ac-2_org', name: 'statement', prose: 'Orphaned alter on excluded control.' }]
              }
            ]
          }
        ]
      }
    });

    await navigateToProfile(page, profUuid, apiSetup.workspaceId, true);

    // 2. Expand group and exclude ac-2 via context menu to produce orphaned alter
    const groupNode = page.locator('[data-testid="tree-node-ac"]').or(page.getByText('Access Control')).first();
    await expect(groupNode).toBeVisible({ timeout: 15000 });
    await groupNode.click();

    const ac2Node = page.locator('[data-testid="tree-node-ac-2"]');
    await expect(ac2Node).toBeVisible({ timeout: 15000 });
    const ac2MenuBtn = ac2Node.locator('button').filter({ hasText: '•••' }).first();
    await ac2MenuBtn.click();
    const excludeBtn = page.getByRole('button', { name: /Exclude from Profile/i });
    await expect(excludeBtn).toBeVisible({ timeout: 5000 });
    await excludeBtn.click();

    // 3. Verify conflict banner is visible
    const conflictBanner = page.locator('[data-testid="conflict-banner"]').or(page.getByText(/orphaned modification|targets excluded controls|targeting controls/i)).first();
    await expect(conflictBanner).toBeVisible({ timeout: 15000 });

    // 4. Verify visual indicators on controls
    const ac1Node = page.locator('[data-testid="tree-node-ac-1"]');
    await expect(ac1Node).toBeVisible({ timeout: 15000 });
    await expect(ac1Node.getByText(/modified|🟡/i).or(ac1Node.locator('[title*="modified" i]'))).toBeVisible({ timeout: 5000 });

    // ac-2 is excluded and has orphaned alteration -> indicator contains "orphaned" or badge
    await expect(ac2Node).toHaveClass(/excluded/, { timeout: 10000 });
    await expect(ac2Node.getByText(/orphaned|🔶/i).or(ac2Node.locator('[title*="orphaned" i]'))).toBeVisible({ timeout: 5000 });
  });

  test('Withdrawn Controls Filtering: Catalog Withdrawn Controls Never Shown in Profile', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const groups = [
      {
        id: 'ac',
        title: 'Access Control',
        controls: [
          { id: 'ac-1', title: 'Active Policy', parts: [{ id: 'ac-1_smt', name: 'statement', prose: 'Active.' }] },
          { id: 'ac-2', title: 'Retired Control', props: [{ name: 'status', value: 'withdrawn' }], parts: [{ id: 'ac-2_smt', name: 'statement', prose: 'Withdrawn.' }] }
        ]
      }
    ];
    const catUuid = await apiSetup.createCatalog({ title: 'Catalog With Withdrawn Controls', groups });
    const profUuid = await apiSetup.createProfile({
      title: 'Clean Profile',
      catalogUuid: catUuid
    });

    await navigateToProfile(page, profUuid, apiSetup.workspaceId, true);

    const groupNode = page.locator('[data-testid="tree-node-ac"]').or(page.getByText('Access Control')).first();
    await expect(groupNode).toBeVisible({ timeout: 15000 });
    await groupNode.click();

    // Active control is visible
    const ac1Node = page.locator('[data-testid="tree-node-ac-1"]');
    await expect(ac1Node).toBeVisible({ timeout: 15000 });

    // Withdrawn control is completely absent from tree even in edit mode
    const ac2Node = page.locator('[data-testid="tree-node-ac-2"]');
    await expect(ac2Node).not.toBeVisible();
  });

});

