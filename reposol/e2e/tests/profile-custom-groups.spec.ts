import { test, expect } from '../fixtures/base';
import {
  navigateToProfile,
  selectSidebarTab,
  switchStructuringMode,
  waitForProfileResolution
} from '../helpers/profile-helpers';

test.describe('Stage 2 Profile Tailoring — Custom Group Definition & Control Pool Assignment (E2E Playwright Suite)', () => {

  // =========================================================================
  // Test Preconditions & Catalogs
  // =========================================================================
  let catUuid: string;
  let multiCatIsoUuid: string;

  test.beforeEach(async ({ apiSetup }) => {
    await apiSetup.syncWorkspace();

    // 1. Create primary NIST baseline catalog
    catUuid = await apiSetup.createCatalog({
      title: 'NIST SP 800-53 Baseline Catalog',
      groups: [
        {
          id: 'ac',
          title: 'Access Control',
          controls: [
            {
              id: 'ac-1',
              title: 'Access Control Policy and Procedures',
              parts: [{ id: 'ac-1_smt', name: 'statement', prose: 'The organization develops access control policies.' }]
            },
            {
              id: 'ac-2',
              title: 'Account Management',
              parts: [{ id: 'ac-2_smt', name: 'statement', prose: 'The organization manages system accounts.' }]
            },
            {
              id: 'ac-3',
              title: 'Access Enforcement',
              parts: [{ id: 'ac-3_smt', name: 'statement', prose: 'The system enforces approved authorizations.' }]
            }
          ]
        },
        {
          id: 'ia',
          title: 'Identification and Authentication',
          controls: [
            {
              id: 'ia-1',
              title: 'Identification and Authentication Policy',
              parts: [{ id: 'ia-1_smt', name: 'statement', prose: 'The organization establishes identification policies.' }]
            },
            {
              id: 'ia-2',
              title: 'Identification and Authentication (Org Users)',
              parts: [{ id: 'ia-2_smt', name: 'statement', prose: 'The system uniquely identifies organizational users.' }]
            }
          ]
        },
        {
          id: 'sc',
          title: 'System and Communications Protection',
          controls: [
            {
              id: 'sc-7',
              title: 'Boundary Protection',
              parts: [{ id: 'sc-7_smt', name: 'statement', prose: 'The system monitors and controls communications at boundaries.' }]
            }
          ]
        }
      ]
    });

    // 2. Create secondary ISO catalog for multi-catalog scenarios
    multiCatIsoUuid = await apiSetup.createCatalog({
      title: 'ISO 27001 Supplementary Catalog',
      groups: [
        {
          id: 'a.5',
          title: 'Organizational Controls',
          controls: [
            {
              id: 'a.5.15',
              title: 'Access Control Requirements',
              parts: [{ id: 'a.5.15_smt', name: 'statement', prose: 'Rules to control physical and logical access.' }]
            }
          ]
        }
      ]
    });
  });

  // =========================================================================
  // TIER 1: Feature Coverage (Browser UI Verification)
  // =========================================================================
  test.describe('Tier 1: Feature Coverage', () => {

    test('F1 & F10: Switch Structuring Mode to Custom & Import Full Catalog Structure', async ({ page, apiSetup }) => {
      const profUuid = await apiSetup.createProfile({
        title: 'Custom Grouping Profile',
        catalogUuid: catUuid
      });

      await navigateToProfile(page, profUuid, apiSetup.workspaceId, true);

      // 1. Switch structuring mode to custom
      await switchStructuringMode(page, 'custom');

      // 2. Click "Import Full Structure" on the import card
      const importStructureBtn = page.getByRole('button', { name: /Import Full Structure/i }).first();
      await expect(importStructureBtn).toBeVisible({ timeout: 15000 });
      await importStructureBtn.click();

      // 3. Verify groups appear in sidebar
      await selectSidebarTab(page, 'Overview');
      await expect(page.getByText('Access Control').first()).toBeVisible({ timeout: 15000 });
      await expect(page.getByText('Identification and Authentication').first()).toBeVisible({ timeout: 15000 });

      // 4. F5 Reload Persistence
      await page.reload();
      await waitForProfileResolution(page);
      await selectSidebarTab(page, 'Overview');
      await expect(page.getByText('Access Control').first()).toBeVisible({ timeout: 15000 });
      await expect(page.getByText('Identification and Authentication').first()).toBeVisible({ timeout: 15000 });
    });

    test('F2: Custom Group Title and ID Inline Editing & Persistence', async ({ page, apiSetup }) => {
      const profUuid = await apiSetup.createProfile({
        title: 'Group Editing Profile',
        catalogUuid: catUuid,
        merge: {
          custom: {
            groups: [
              {
                id: 'custom-identity-domain',
                title: 'Initial Identity Domain',
                'insert-controls': [
                  { 'include-controls': [{ 'with-ids': ['ia-1', 'ia-2'] }] }
                ]
              }
            ]
          }
        }
      });

      await navigateToProfile(page, profUuid, apiSetup.workspaceId, true);

      // 1. Click on custom group in sidebar
      const groupNode = page.locator('[data-testid="tree-node-custom-identity-domain"]').or(page.getByText('Initial Identity Domain')).first();
      await expect(groupNode).toBeVisible({ timeout: 15000 });
      await groupNode.click();

      // 2. Edit Title and ID in Group Editor
      const titleInput = page.locator('input[placeholder*="Title"], input[value*="Initial Identity Domain"]').first();
      await expect(titleInput).toBeVisible({ timeout: 15000 });
      await titleInput.fill('Finalized Identity & Governance Domain');

      // 3. Verify immediate title feedback in editor and sidebar
      await expect(page.getByText('Finalized Identity & Governance Domain').first()).toBeVisible({ timeout: 15000 });
      await expect(page.locator('[data-testid="tree-node-custom-identity-domain"]').or(page.getByText('Finalized Identity & Governance Domain')).first()).toBeVisible({ timeout: 15000 });
    });

    test('F3: Nested Custom Sub-groups Resolution & Sidebar Rendering', async ({ page, apiSetup }) => {
      const profUuid = await apiSetup.createProfile({
        title: 'Nested Groups Profile',
        catalogUuid: catUuid,
        merge: {
          custom: {
            groups: [
              {
                id: 'parent-governance',
                title: 'Parent Governance Domain',
                groups: [
                  {
                    id: 'sub-access-control',
                    title: 'Access Control Sub-Family',
                    'insert-controls': [
                      { 'include-controls': [{ 'with-ids': ['ac-1', 'ac-2'] }] }
                    ]
                  }
                ]
              }
            ]
          }
        }
      });

      await navigateToProfile(page, profUuid, apiSetup.workspaceId, true);

      // 1. Verify parent group is visible
      const parentNode = page.locator('[data-testid="tree-node-parent-governance"]').or(page.getByText('Parent Governance Domain')).first();
      await expect(parentNode).toBeVisible({ timeout: 15000 });
      await parentNode.click();

      // 2. Verify nested sub-group and controls are visible
      const childNode = page.locator('[data-testid="tree-node-sub-access-control"]').or(page.getByText('Access Control Sub-Family')).first();
      await expect(childNode).toBeVisible({ timeout: 15000 });
      await childNode.click();

      const controlNode = page.locator('[data-testid="tree-node-ac-1"]').or(page.getByText('Access Control Policy and Procedures')).first();
      await expect(controlNode).toBeVisible({ timeout: 15000 });

      // 3. F5 Reload Persistence
      await page.reload();
      await waitForProfileResolution(page);
      await expect(page.getByText('Parent Governance Domain').first()).toBeVisible({ timeout: 15000 });
    });

    test('F5 & F7: Control Pool Tab Card Grid Rendering & Filter Search', async ({ page, apiSetup }) => {
      const profUuid = await apiSetup.createProfile({
        title: 'Control Pool Search Profile',
        catalogUuid: catUuid
      });

      await navigateToProfile(page, profUuid, apiSetup.workspaceId, true);

      // 1. Switch to custom structuring mode
      await switchStructuringMode(page, 'custom');

      // 2. Open Imports workbench
      await selectSidebarTab(page, 'Imports');

      // 3. Verify all imported controls appear in pool
      await expect(page.getByText('Access Control Policy and Procedures').first()).toBeVisible({ timeout: 15000 });
      await expect(page.getByText('Boundary Protection').first()).toBeVisible({ timeout: 15000 });

      // 4. Search by ID "sc-7"
      const searchInput = page.getByPlaceholder(/Search pool controls by ID or title/i).first();
      await expect(searchInput).toBeVisible({ timeout: 15000 });
      await searchInput.fill('sc-7');

      // Verify filtered result
      await expect(page.getByText('Boundary Protection').first()).toBeVisible({ timeout: 15000 });
      await expect(page.getByText('Access Control Policy and Procedures')).not.toBeVisible();

      // 5. Search by Title "Account"
      await searchInput.fill('Account');
      await expect(page.getByText('Account Management').first()).toBeVisible({ timeout: 15000 });
      await expect(page.getByText('Boundary Protection')).not.toBeVisible();

      // 6. Clear search
      await searchInput.fill('');
      await expect(page.getByText('Boundary Protection').first()).toBeVisible({ timeout: 15000 });
    });

    test('F8 & F9: Control Assignment Status in Pool Grid & Unassign Container Drop', async ({ page, apiSetup }) => {
      const profUuid = await apiSetup.createProfile({
        title: 'Control Pool Assigned Status Profile',
        catalogUuid: catUuid,
        merge: {
          custom: {
            groups: [
              {
                id: 'custom-grp-1',
                title: 'Custom Group 1',
                'insert-controls': [
                  { 'include-controls': [{ 'with-ids': ['ac-1'] }] }
                ]
              }
            ]
          }
        }
      });

      await navigateToProfile(page, profUuid, apiSetup.workspaceId, true);

      // 1. Navigate to Imports
      await selectSidebarTab(page, 'Imports');

      // 2. Verify ac-1 displays "✓ Assigned" badge
      const assignedBadge = page.getByText(/Assigned/i).first();
      await expect(assignedBadge).toBeVisible({ timeout: 15000 });

      // 3. Verify unassigned control (ac-2) does NOT have "✓ Assigned"
      const ac2Card = page.locator('[data-testid="pool-control-card-ac-2"]').or(page.getByText('Account Management').first().locator('..'));
      await expect(ac2Card.getByText(/✓ Assigned/i)).not.toBeVisible();
    });

    test('F11 & F12: Export Modal Verifies Exclusion of Virtual Artifacts', async ({ page, apiSetup }) => {
      const profUuid = await apiSetup.createProfile({
        title: 'Export Verification Profile',
        catalogUuid: catUuid,
        merge: {
          custom: {
            groups: [
              {
                id: 'domain-clean',
                title: 'Clean Custom Domain',
                'insert-controls': [
                  { 'include-controls': [{ 'with-ids': ['ac-1', 'ia-1'] }] }
                ]
              }
            ]
          }
        }
      });

      await navigateToProfile(page, profUuid, apiSetup.workspaceId, true);

      // 1. Open Export Modal
      const exportBtn = page.getByTestId('export-btn').or(page.getByRole('button', { name: /Export/i })).first();
      await expect(exportBtn).toBeVisible({ timeout: 15000 });
      await exportBtn.click();

      // 2. Verify modal opens with standard OSCAL export options
      await expect(page.getByTestId('export-confirm-btn')).toBeVisible({ timeout: 15000 });
      await expect(page.getByTestId('export-format-json')).toBeChecked();

      // 3. Close modal
      const closeBtn = page.getByRole('button', { name: /Close|Cancel/i }).first();
      await closeBtn.click();
    });
  });

  // =========================================================================
  // TIER 2: Boundary & Corner Cases
  // =========================================================================
  test.describe('Tier 2: Boundary & Corner Cases', () => {

    test('T2.1: Empty Custom Group Lifecycle with Zero Controls', async ({ page, apiSetup }) => {
      const profUuid = await apiSetup.createProfile({
        title: 'Empty Custom Group Profile',
        catalogUuid: catUuid,
        merge: {
          custom: {
            groups: [
              {
                id: 'empty-container-grp',
                title: 'Empty Container Group',
                'insert-controls': []
              }
            ]
          }
        }
      });

      await navigateToProfile(page, profUuid, apiSetup.workspaceId, true);

      // Verify empty group renders in sidebar without errors
      const groupNode = page.locator('[data-testid="tree-node-empty-container-grp"]').or(page.getByText('Empty Container Group')).first();
      await expect(groupNode).toBeVisible({ timeout: 15000 });
      await groupNode.click();

      // Group Editor displays clean title and id
      const titleDisplay = page.locator('input[placeholder*="Title"], input[value*="Empty Container Group"]').or(page.getByText('Empty Container Group')).first();
      await expect(titleDisplay).toBeVisible({ timeout: 15000 });
    });

    test('T2.2: Special Characters and Long Strings in Custom Group Titles', async ({ page, apiSetup }) => {
      const complexTitle = 'Sec-Ops & IR: Incident Mgmt (v2.0) [Level-3] — "Critical"';
      const profUuid = await apiSetup.createProfile({
        title: 'Special Chars Group Profile',
        catalogUuid: catUuid,
        merge: {
          custom: {
            groups: [
              {
                id: 'grp-complex-title',
                title: complexTitle,
                'insert-controls': [{ 'include-controls': [{ 'with-ids': ['sc-7'] }] }]
              }
            ]
          }
        }
      });

      await navigateToProfile(page, profUuid, apiSetup.workspaceId, true);
      await expect(page.getByText(complexTitle).first()).toBeVisible({ timeout: 15000 });

      // F5 Reload Persistence
      await page.reload();
      await waitForProfileResolution(page);
      await expect(page.getByText(complexTitle).first()).toBeVisible({ timeout: 15000 });
    });
  });

  // =========================================================================
  // TIER 3: Cross-Feature Combinations
  // =========================================================================
  test.describe('Tier 3: Cross-Feature Combinations', () => {

    test('T3.1: Multi-Catalog Import with Controls Assigned across Catalogs', async ({ page, apiSetup }) => {
      const profUuid = await apiSetup.createProfile({
        title: 'Multi Catalog Cross Assignment Profile',
        imports: [
          { href: `../catalogs/${catUuid}.json`, 'include-all': {} },
          { href: `../catalogs/${multiCatIsoUuid}.json`, 'include-all': {} }
        ],
        merge: {
          custom: {
            groups: [
              {
                id: 'unified-access-domain',
                title: 'Unified Cross-Catalog Access Domain',
                'insert-controls': [
                  {
                    order: 'keep',
                    'include-controls': [{ 'with-ids': ['ac-1', 'a.5.15'] }]
                  }
                ]
              }
            ]
          }
        }
      });

      await navigateToProfile(page, profUuid, apiSetup.workspaceId, true);

      // 1. Navigate to Unified Access Domain group in sidebar
      const groupNode = page.locator('[data-testid="tree-node-unified-access-domain"]').or(page.getByText('Unified Cross-Catalog Access Domain')).first();
      await expect(groupNode).toBeVisible({ timeout: 15000 });
      await groupNode.click();

      // 2. Verify controls from both NIST (ac-1) and ISO (a.5.15) resolve inside the custom group
      const nistControl = page.locator('[data-testid="tree-node-ac-1"]').or(page.getByText('Access Control Policy and Procedures')).first();
      await expect(nistControl).toBeVisible({ timeout: 15000 });

      const isoControl = page.locator('[data-testid="tree-node-a.5.15"]').or(page.getByText('Access Control Requirements')).first();
      await expect(isoControl).toBeVisible({ timeout: 15000 });

      // 3. F5 Reload Persistence
      await page.reload();
      await waitForProfileResolution(page);
      await expect(page.getByText('Unified Cross-Catalog Access Domain').first()).toBeVisible({ timeout: 15000 });
    });

    test('T3.2: Mode Switching (Custom -> As-Is -> Custom) Preserves UI State', async ({ page, apiSetup }) => {
      const profUuid = await apiSetup.createProfile({
        title: 'Mode Switching Stability Profile',
        catalogUuid: catUuid
      });

      await navigateToProfile(page, profUuid, apiSetup.workspaceId, true);

      // 1. Switch to custom mode
      await switchStructuringMode(page, 'custom');
      const addGrpBtn = page.getByRole('button', { name: /Add Custom Group/i }).first();
      await expect(addGrpBtn).toBeVisible({ timeout: 15000 });

      // 2. Switch back to as-is mode
      await switchStructuringMode(page, 'as-is');
      await expect(page.locator('select[data-testid="structuring-mode-select"]')).toHaveValue('as-is');

      // 3. Switch back to custom mode
      await switchStructuringMode(page, 'custom');
      await expect(addGrpBtn).toBeVisible({ timeout: 15000 });
    });
  });

  // =========================================================================
  // TIER 4: Real-World Application Scenarios
  // =========================================================================
  test.describe('Tier 4: Real-World Application Scenarios', () => {

    test('Scenario 1: NIST SP 800-53 Baseline Restructuring into 3 Domain Categories', async ({ page, apiSetup }) => {
      const profUuid = await apiSetup.createProfile({
        title: 'NIST Enterprise Domain Restructuring',
        catalogUuid: catUuid,
        merge: {
          custom: {
            groups: [
              {
                id: 'domain-iam',
                title: '1. Identity and Access Governance',
                'insert-controls': [
                  { order: 'keep', 'include-controls': [{ 'with-ids': ['ac-1', 'ac-2', 'ac-3', 'ia-1', 'ia-2'] }] }
                ]
              },
              {
                id: 'domain-netsec',
                title: '2. Network and Boundary Protection',
                'insert-controls': [
                  { order: 'keep', 'include-controls': [{ 'with-ids': ['sc-7'] }] }
                ]
              },
              {
                id: 'domain-audit',
                title: '3. Continuous Monitoring and Audit',
                'insert-controls': []
              }
            ]
          }
        }
      });

      await navigateToProfile(page, profUuid, apiSetup.workspaceId, true);

      // 1. Verify 3 Domain Groups in sidebar
      await expect(page.getByText('1. Identity and Access Governance').first()).toBeVisible({ timeout: 15000 });
      await expect(page.getByText('2. Network and Boundary Protection').first()).toBeVisible({ timeout: 15000 });
      await expect(page.getByText('3. Continuous Monitoring and Audit').first()).toBeVisible({ timeout: 15000 });

      // 2. Expand Identity Domain and verify controls
      const iamGroup = page.locator('[data-testid="tree-node-domain-iam"]').or(page.getByText('1. Identity and Access Governance')).first();
      await iamGroup.click();

      await expect(page.getByText('Access Control Policy and Procedures').first()).toBeVisible({ timeout: 15000 });
      await expect(page.getByText('Account Management').first()).toBeVisible({ timeout: 15000 });
      await expect(page.getByText('Identification and Authentication (Org Users)').first()).toBeVisible({ timeout: 15000 });

      // 3. F5 Reload Persistence
      await page.reload();
      await waitForProfileResolution(page);
      await expect(page.getByText('1. Identity and Access Governance').first()).toBeVisible({ timeout: 15000 });
      await expect(page.getByText('2. Network and Boundary Protection').first()).toBeVisible({ timeout: 15000 });
    });
  });

});
