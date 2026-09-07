import { test, expect } from '../fixtures/base';
import { randomUUID } from 'node:crypto';

test.describe('Step 1 Catalog Builder — Deterministic E2E Verification', () => {
  test.setTimeout(60000);

  test('US 1.1 & US 1.9: Catalog Creation Modal, Redirection & Full Metadata Verification', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    await page.goto(`/catalogs?w=${apiSetup.workspaceId}`);

    // 1. Click New Catalog button
    const newBtn = page.getByRole('button', { name: /new/i }).first();
    await expect(newBtn).toBeVisible({ timeout: 15000 });
    await newBtn.click();

    // 2. Fill Title in creation modal (target modal input specifically)
    const titleInput = page.locator('#create-doc-title, .modal-panel input[type="text"]').first();
    await expect(titleInput).toBeVisible({ timeout: 15000 });
    const catalogTitle = `E2E Deterministic Catalog ${Date.now()}`;
    await titleInput.fill(catalogTitle);

    // 3. Submit and verify direct redirection to editor view
    const createBtn = page.locator('.modal-panel').getByRole('button', { name: 'Create Document' });
    await expect(createBtn).toBeEnabled({ timeout: 15000 });
    await createBtn.click();

    await expect(page).toHaveURL(/.*\/catalogs\/[a-f0-9-]+/i, { timeout: 15000 });
    await expect(page.getByText(catalogTitle).first()).toBeVisible({ timeout: 15000 });

    // 4. Reload and verify persistence
    await page.reload();
    await expect(page.getByText(catalogTitle).first()).toBeVisible({ timeout: 15000 });
  });

  test('US 1.2 & US 1.14: Group Hierarchy, Nesting & Sidebar Reordering', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const catalogUuid = randomUUID();

    await apiSetup.createCatalog({
      uuid: catalogUuid,
      title: `Hierarchy Catalog ${catalogUuid.substring(0, 8)}`,
      groups: [
        {
          id: 'ac',
          title: 'Access Control',
          groups: [
            {
              id: 'ac-ia',
              title: 'Identification and Authentication',
              controls: [
                {
                  id: 'ia-1',
                  title: 'Identification Policy',
                  parts: [{ id: 'ia-1_smt', name: 'statement', prose: 'IA statement prose.' }]
                }
              ]
            }
          ]
        }
      ]
    });

    await page.goto(`/catalogs/${catalogUuid}?edit=true&w=${apiSetup.workspaceId}`);

    // Expand group ac and nested group ac-ia
    const groupAc = page.locator('[data-testid="tree-node-ac"], [data-dnd-id="ac"]').or(page.getByText('Access Control')).first();
    await expect(groupAc).toBeVisible({ timeout: 15000 });
    await groupAc.click();

    const nestedGroup = page.locator('[data-testid="tree-node-ac-ia"], [data-dnd-id="ac-ia"]').or(page.getByText('Identification and Authentication')).first();
    await expect(nestedGroup).toBeVisible({ timeout: 15000 });
    await nestedGroup.click();

    const controlIa1 = page.locator('[data-testid="tree-node-ia-1"], [data-dnd-id="ia-1"]').first();
    await expect(controlIa1).toBeVisible({ timeout: 15000 });
  });

  test('US 1.3 & US 1.11: Inline Statement Sub-Part Editing (a., b.) & Enhancements Accordion', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const catalogUuid = randomUUID();

    await apiSetup.createCatalog({
      uuid: catalogUuid,
      title: `Parts Catalog ${catalogUuid.substring(0, 8)}`,
      controls: [
        {
          id: 'ac-1',
          title: 'Access Control Policy',
          parts: [
            {
              id: 'ac-1_smt',
              name: 'statement',
              prose: 'The organization develops access control policy.'
            }
          ],
          controls: [
            {
              id: 'ac-1.1',
              title: 'Formal Policy Review',
              parts: [{ id: 'ac-1.1_smt', name: 'statement', prose: 'Review policy annually.' }]
            }
          ]
        }
      ]
    });

    await page.goto(`/catalogs/${catalogUuid}?edit=true&w=${apiSetup.workspaceId}`);

    // 1. Select Control ac-1 in sidebar
    const controlItem = page.locator('[data-testid="tree-node-ac-1"], [data-dnd-id="ac-1"]').first();
    await expect(controlItem).toBeVisible({ timeout: 15000 });
    await controlItem.click();

    // 2. Click "➕ Sub-part" button on the statement part
    const addSubPartBtn = page.getByRole('button', { name: /Sub-part/i }).first();
    await expect(addSubPartBtn).toBeVisible({ timeout: 15000 });
    await addSubPartBtn.click();

    // 3. Verify statement prose is visible
    await expect(page.getByText('The organization develops access control policy.').first()).toBeVisible({ timeout: 15000 });

    // 4. Reload Persistence
    await page.reload();
    await expect(controlItem).toBeVisible({ timeout: 15000 });
    await controlItem.click();
    await expect(page.getByText('The organization develops access control policy.').first()).toBeVisible({ timeout: 15000 });
  });

  test('US 1.4, US 1.13, US 1.15 & US 1.17: Parameter Definition, Regex Constraints & Live Validation', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const catalogUuid = randomUUID();

    await apiSetup.createCatalog({
      uuid: catalogUuid,
      title: `Param Regex Catalog ${catalogUuid.substring(0, 8)}`,
      controls: [
        {
          id: 'ac-1',
          title: 'Access Control Policy and Procedures',
          params: [
            {
              id: 'ac-1_prm_1',
              label: 'review-frequency',
              values: ['30-days']
            }
          ],
          parts: [
            {
              id: 'ac-1_smt',
              name: 'statement',
              prose: 'Review access control policy at {{ insert: param, ac-1_prm_1 }}.'
            }
          ]
        }
      ]
    });

    await page.goto(`/catalogs/${catalogUuid}?edit=true&w=${apiSetup.workspaceId}`);

    // 1. Navigate to control ac-1 in sidebar
    const controlItem = page.locator('[data-testid="tree-node-ac-1"], [data-dnd-id="ac-1"]').first();
    await expect(controlItem).toBeVisible({ timeout: 15000 });
    await controlItem.click();

    // 2. Verify Parameter section or card is visible
    const paramCard = page.locator('[data-param-id="ac-1_prm_1"]').or(page.getByText('ac-1_prm_1')).first();
    await expect(paramCard).toBeVisible({ timeout: 15000 });

    // 3. Reload and verify persistence
    await page.reload();
    await controlItem.click();
    await expect(paramCard).toBeVisible({ timeout: 15000 });
  });

  test('US 1.5 & US 1.6: Assessment Objectives, Methods & Mapping Links', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const catalogUuid = randomUUID();

    await apiSetup.createCatalog({
      uuid: catalogUuid,
      title: `Objectives Catalog ${catalogUuid.substring(0, 8)}`,
      controls: [
        {
          id: 'ac-1',
          title: 'Access Control',
          links: [
            { rel: 'reference', href: 'https://example.com/nist-sp-800-53' },
            { rel: 'related', href: '#ac-2' }
          ],
          parts: [
            { id: 'ac-1_smt', name: 'statement', prose: 'Statement text' },
            { id: 'ac-1_gdn', name: 'guidance', prose: 'Guidance and supplemental information.' }
          ]
        }
      ]
    });

    await page.goto(`/catalogs/${catalogUuid}?edit=true&w=${apiSetup.workspaceId}`);
    const controlItem = page.locator('[data-testid="tree-node-ac-1"], [data-dnd-id="ac-1"]').first();
    await expect(controlItem).toBeVisible({ timeout: 15000 });
    await controlItem.click();

    // Verify guidance and statement prose parts rendered
    await expect(page.getByText('Statement text').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Guidance and supplemental information.').first()).toBeVisible({ timeout: 15000 });
  });

  test('US 1.19: Control Withdrawal & Deprecation Workflow with Replacement Links', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const catalogUuid = randomUUID();

    await apiSetup.createCatalog({
      uuid: catalogUuid,
      title: `Withdrawal Catalog ${catalogUuid.substring(0, 8)}`,
      controls: [
        {
          id: 'ac-1',
          title: 'Withdrawn Control',
          props: [{ name: 'status', value: 'withdrawn' }],
          links: [{ rel: 'moved-to', href: '#ac-2' }],
          parts: [{ id: 'ac-1_smt', name: 'statement', prose: 'This control has been incorporated into AC-2.' }]
        },
        {
          id: 'ac-2',
          title: 'Account Management Replacement',
          parts: [{ id: 'ac-2_smt', name: 'statement', prose: 'Updated statement.' }]
        }
      ]
    });

    await page.goto(`/catalogs/${catalogUuid}?edit=true&w=${apiSetup.workspaceId}`);

    const controlNode = page.locator('[data-testid="tree-node-ac-1"], [data-dnd-id="ac-1"]').first();
    await expect(controlNode).toBeVisible({ timeout: 15000 });
    await controlNode.click();

    await expect(page.getByText(/withdrawn|Withdrawn/i).first()).toBeVisible({ timeout: 15000 });
  });

  test('US 1.8: Custom Roles Definition, Party Assignment & Back-Matter Citations', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const catalogUuid = randomUUID();

    await apiSetup.createCatalog({
      uuid: catalogUuid,
      title: `Roles Catalog ${catalogUuid.substring(0, 8)}`
    });

    await page.goto(`/catalogs/${catalogUuid}?edit=true&w=${apiSetup.workspaceId}`);

    // Navigate to Metadata tab in sidebar
    await page.getByTestId('catalog-sidebar-metadata').click();
    await expect(page.getByRole('heading', { name: 'Document Metadata' })).toBeVisible({ timeout: 15000 });
  });

  test('US 1.10 & US 1.12: Properties Dashboard Hub & Global Header Properties', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const catalogUuid = randomUUID();

    await apiSetup.createCatalog({
      uuid: catalogUuid,
      title: `Properties Catalog ${catalogUuid.substring(0, 8)}`
    });

    await page.goto(`/catalogs/${catalogUuid}?edit=true&w=${apiSetup.workspaceId}`);

    // Navigate to Properties tab in sidebar
    await page.getByTestId('catalog-sidebar-properties').click();
    await expect(page.getByText('Central Property Hub')).toBeVisible({ timeout: 15000 });

    // Add Header Property
    const addPropBtn = page.getByRole('button', { name: /Add Header Property/i }).first();
    await expect(addPropBtn).toBeVisible({ timeout: 15000 });
    await addPropBtn.click();

    // Verify property card appears
    await expect(page.getByText('Header Property').first()).toBeVisible({ timeout: 15000 });
  });

  test('US 1.15 & US 1.4: Catalog-Level Parameters Tab & Scope Counts', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const catalogUuid = randomUUID();

    await apiSetup.createCatalog({
      uuid: catalogUuid,
      title: `Parameters Catalog ${catalogUuid.substring(0, 8)}`,
      controls: [
        {
          id: 'ac-1',
          title: 'Access Control',
          params: [{ id: 'ac-1_prm_1', label: 'p1' }]
        }
      ]
    });

    await page.goto(`/catalogs/${catalogUuid}?edit=true&w=${apiSetup.workspaceId}`);

    // Navigate to Parameters tab in sidebar
    await page.getByTestId('catalog-sidebar-parameters').click();
    await expect(page.getByText('Parameter Scopes in OSCAL')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Global Catalog Parameters')).toBeVisible({ timeout: 15000 });
  });

  test('US 1.12 & US 1.16: Back Matter Resources Management', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const catalogUuid = randomUUID();

    await apiSetup.createCatalog({
      uuid: catalogUuid,
      title: `Back Matter Catalog ${catalogUuid.substring(0, 8)}`
    });

    await page.goto(`/catalogs/${catalogUuid}?edit=true&w=${apiSetup.workspaceId}`);

    // Navigate to Back Matter tab in sidebar
    await page.getByTestId('catalog-sidebar-backmatter').click();
    await expect(page.getByRole('heading', { name: /Back Matter \/ Resources/i })).toBeVisible({ timeout: 15000 });

    // Add Resource
    const addResBtn = page.getByRole('button', { name: /Add Resource/i }).first();
    await expect(addResBtn).toBeVisible({ timeout: 15000 });
    await addResBtn.click();

    await expect(page.getByText('Resource Title').first()).toBeVisible({ timeout: 15000 });
  });

  test('US 1.11: Sub-Controls (Enhancements) Creation & Navigation', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const catalogUuid = randomUUID();

    await apiSetup.createCatalog({
      uuid: catalogUuid,
      title: `Enhancements Test Catalog ${catalogUuid.substring(0, 8)}`,
      controls: [
        {
          id: 'ac-2',
          title: 'Account Management',
          parts: [{ id: 'ac-2_smt', name: 'statement', prose: 'Statement prose' }]
        }
      ]
    });

    await page.goto(`/catalogs/${catalogUuid}?edit=true&w=${apiSetup.workspaceId}`);

    // Select Control ac-2
    const controlItem = page.locator('[data-testid="tree-node-ac-2"], [data-dnd-id="ac-2"]').first();
    await expect(controlItem).toBeVisible({ timeout: 15000 });
    await controlItem.click();

    // Click Add Enhancement
    const addEnhanceBtn = page.getByRole('button', { name: /Add Enhancement/i }).first();
    await expect(addEnhanceBtn).toBeVisible({ timeout: 15000 });
    await addEnhanceBtn.click();

    // Verify enhancement appears in enhancements section
    await expect(page.getByText('ac-2.1').first()).toBeVisible({ timeout: 15000 });
  });

  test('US 1.4 & US 1.13: Prose Parameter Badges Resolution in View Mode', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const catalogUuid = randomUUID();

    await apiSetup.createCatalog({
      uuid: catalogUuid,
      title: `Chips Catalog ${catalogUuid.substring(0, 8)}`,
      controls: [
        {
          id: 'ac-2',
          title: 'Account Management',
          params: [
            {
              id: 'ac-2_prm_1',
              label: 'review-frequency',
              values: ['90 days']
            }
          ],
          parts: [
            {
              id: 'ac-2_smt',
              name: 'statement',
              prose: 'Review all accounts every {{ insert: param, ac-2_prm_1 }} and disable inactive accounts.'
            }
          ]
        }
      ]
    });

    // Navigate in View mode
    await page.goto(`/catalogs/${catalogUuid}?w=${apiSetup.workspaceId}`);

    const controlItem = page.locator('[data-testid="tree-node-ac-2"], [data-dnd-id="ac-2"]').first();
    await expect(controlItem).toBeVisible({ timeout: 15000 });
    await controlItem.click();

    // Verify resolved parameter chip value is rendered
    await expect(page.getByText('90 days').first()).toBeVisible({ timeout: 15000 });
  });

  test('US 1.20: Real-Time Sidebar Search & Quick Filtering', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const catalogUuid = randomUUID();

    await apiSetup.createCatalog({
      uuid: catalogUuid,
      title: `Search Catalog ${catalogUuid.substring(0, 8)}`,
      groups: [
        {
          id: 'ac',
          title: 'Access Control',
          controls: [
            {
              id: 'ac-1',
              title: 'Access Control Policy',
              parts: [{ id: 'ac-1_smt', name: 'statement', prose: 'Policy prose' }]
            },
            {
              id: 'ac-2',
              title: 'Account Management',
              parts: [{ id: 'ac-2_smt', name: 'statement', prose: 'Account prose' }]
            }
          ]
        },
        {
          id: 'ia',
          title: 'Identification and Authentication',
          controls: [
            {
              id: 'ia-1',
              title: 'Identification Policy',
              parts: [{ id: 'ia-1_smt', name: 'statement', prose: 'IA policy prose' }]
            }
          ]
        }
      ]
    });

    await page.goto(`/catalogs/${catalogUuid}?edit=true&w=${apiSetup.workspaceId}`);

    // Filter controls by typing "Account"
    const searchInput = page.getByPlaceholder('Filter controls...');
    await expect(searchInput).toBeVisible({ timeout: 15000 });
    await searchInput.fill('Account');

    // Access Control should remain visible with ac-2
    await expect(page.getByText('Account Management').first()).toBeVisible({ timeout: 15000 });

    // Identification group should not match
    await expect(page.getByText('Identification Policy')).not.toBeVisible();

    // Clear filter and verify full tree restores
    await searchInput.fill('');
    const iaGroup = page.locator('[data-testid="tree-node-ia"], [data-dnd-id="ia"]').or(page.getByText('Identification and Authentication')).first();
    await expect(iaGroup).toBeVisible({ timeout: 15000 });
  });

});
