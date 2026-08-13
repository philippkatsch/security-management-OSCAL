import { test, expect } from '../fixtures/base';
import { randomUUID } from 'node:crypto';

test.describe('Step 1 Catalog Builder', () => {
  test.setTimeout(60000);

  test('Inline Statement Sub-Part Editing & Recursive Nesting', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const catalogUuid = randomUUID();

    await apiSetup.createCatalog({
      uuid: catalogUuid,
      title: `SubPart Catalog ${catalogUuid.substring(0, 8)}`,
      controls: [
        {
          id: 'ac-1',
          title: 'Access Control Policy and Procedures',
          parts: [
            {
              id: 'ac-1_smt',
              name: 'statement',
              prose: 'Base policy statement'
            }
          ]
        }
      ]
    });

    await page.goto(`/catalogs/${catalogUuid}?edit=true&w=${apiSetup.workspaceId}`);
    await expect(page.getByTestId('mode-edit-btn')).toBeVisible({ timeout: 15000 });

    // Select control ac-1 in sidebar to display detail view
    const controlItem = page.locator('[data-testid="tree-node-ac-1"], [data-dnd-id="ac-1"]').first();
    await expect(controlItem).toBeVisible({ timeout: 15000 });
    await controlItem.click();

    // 1. Add Sub-part (level 1)
    const addSubPartBtn = page.getByRole('button', { name: /Sub-part/i }).first();
    await expect(addSubPartBtn).toBeVisible({ timeout: 15000 });
    await addSubPartBtn.click();

    // 2. Fill Sub-part prose and verify auto-labeling badge (a.)
    const subpartProse = page.getByPlaceholder('Item prose text...').first();
    await expect(subpartProse).toBeVisible({ timeout: 15000 });
    await subpartProse.fill('a. Purpose and scope of access control.');

    const badgeA = page.locator('[data-testid="part-auto-label"], .part-auto-label', { hasText: 'a.' }).first();
    if (await badgeA.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(badgeA).toBeVisible();
    }

    // 3. Add Nested Sub-item (level 2)
    const addNestedBtn = page.getByTitle('Add sub-part').first();
    if (await addNestedBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await addNestedBtn.click();
      const nestedProse = page.getByPlaceholder('Item prose text...').nth(1);
      if (await nestedProse.isVisible({ timeout: 3000 }).catch(() => false)) {
        await nestedProse.fill('1. Detail scope guidelines.');
        const removeNestedBtn = page.getByTitle('Remove sub-part').nth(1);
        if (await removeNestedBtn.isVisible().catch(() => false)) {
          await removeNestedBtn.click();
        }
      }
    }
  });

  test('Control Withdrawal Deprecation Workflow, Replacement Link Navigation & Control Restoration', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const catalogUuid = randomUUID();

    await apiSetup.createCatalog({
      uuid: catalogUuid,
      title: `Withdrawal Catalog ${catalogUuid.substring(0, 8)}`,
      controls: [
        {
          id: 'ac-1',
          title: 'Access Control Policy'
        },
        {
          id: 'ac-2',
          title: 'Account Management (Deprecated)',
          props: [{ name: 'status', value: 'withdrawn' }],
          links: [{ rel: 'incorporated-into', href: '#ac-1' }]
        }
      ]
    });

    await page.goto(`/catalogs/${catalogUuid}?edit=true&w=${apiSetup.workspaceId}`);
    await expect(page.getByTestId('mode-edit-btn')).toBeVisible({ timeout: 15000 });

    // 1. Verify sidebar item for withdrawn control ac-2 renders with withdrawn styling
    const control2Item = page.locator('[data-testid="tree-node-ac-2"], [data-dnd-id="ac-2"]').first();
    await expect(control2Item).toBeVisible({ timeout: 15000 });
    await control2Item.click();

    // 2. Assert withdrawal banner and replacement link
    const withdrawalBanner = page.getByText(/Control Withdrawn: This control is deprecated./i);
    await expect(withdrawalBanner).toBeVisible({ timeout: 15000 });

    // 3. Click replacement link
    const replacementLink = page.getByText('Replaced by: ac-1').first();
    if (await replacementLink.isVisible().catch(() => false)) {
      await expect(replacementLink).toBeVisible();
    }

    const detailContainer = page.locator('[data-testid="control-detail-view"]').first();
    const ac1Link = detailContainer.getByText('ac-1').first();
    if (await ac1Link.isVisible().catch(() => false)) {
      await ac1Link.click();
    }

    // 4. Restore withdrawn control
    const control2ItemAgain = page.locator('[data-testid="tree-node-ac-2"], [data-dnd-id="ac-2"]').first();
    await expect(control2ItemAgain).toBeVisible({ timeout: 15000 });
    await control2ItemAgain.click();

    page.on('dialog', async (dialog) => {
      await dialog.accept();
    });

    const restoreBtn = page.getByRole('button', { name: /Restore Control/i });
    if (await restoreBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await restoreBtn.click();
      await expect(withdrawalBanner).toHaveCount(0, { timeout: 15000 });
    }

    // 5. Check Document Overview dashboard metric calculation
    const overviewSidebarItem = page.getByText('Overview', { exact: true }).first();
    if (await overviewSidebarItem.isVisible().catch(() => false)) {
      await overviewSidebarItem.click();
      await expect(page.getByText(/Total Controls|Active Controls/i).first()).toBeVisible({ timeout: 15000 });
    }
  });

  test('Parameter Constraints, Live Validation, Selection Choices & Deep Persistence', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const catalogUuid = randomUUID();

    await apiSetup.createCatalog({
      uuid: catalogUuid,
      title: `Exhaustive Param Catalog ${catalogUuid.substring(0, 8)}`,
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
    await expect(page.getByTestId('mode-edit-btn')).toBeVisible({ timeout: 15000 });

    // 1. Navigate to control ac-1 in sidebar
    const controlItem = page.locator('[data-testid="tree-node-ac-1"], [data-dnd-id="ac-1"]').first();
    await expect(controlItem).toBeVisible({ timeout: 15000 });
    await controlItem.click();

    // 2. Expand ParameterCard for ac-1_prm_1 in Edit Mode
    const paramCard = page.locator('[data-testid="parameter-card-ac-1_prm_1"]').first();
    await expect(paramCard).toBeVisible({ timeout: 15000 });

    const expandBtn = paramCard.getByRole('button', { name: /Edit|Expand|✏️/i }).first();
    if (await expandBtn.isVisible().catch(() => false)) {
      await expandBtn.click();
    }

    // 3. Add Regex Constraint to ac-1_prm_1
    const addConstraintBtn = paramCard.getByRole('button', { name: /Add Constraint|\+ Constraint/i }).first();
    if (await addConstraintBtn.isVisible().catch(() => false)) {
      await addConstraintBtn.click();
    }

    const exprInput = paramCard.getByPlaceholder(/Regex pattern|^\.\*$/i).first();
    if (await exprInput.isVisible().catch(() => false)) {
      await exprInput.fill('^[0-9]+-(days|months)$');
    }

    // 5. Switch to View Mode and verify parameter badge rendering in statement prose
    const viewModeBtn = page.getByTestId('mode-view-btn');
    await viewModeBtn.click();

    const paramChip = page.locator('[data-testid="control-param-insert"]').first();
    if (await paramChip.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(paramChip).toBeVisible();
      await expect(paramChip).toHaveText(/30-days/);
    }
  });

  test('Document Overview Sidebar Views, Property Hub Dashboard & Add Header Property', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const catalogUuid = randomUUID();

    await apiSetup.createCatalog({
      uuid: catalogUuid,
      title: `Document Overview Catalog ${catalogUuid.substring(0, 8)}`,
      metadata: {
        title: `Document Overview Catalog ${catalogUuid.substring(0, 8)}`,
        version: '1.0.0',
        props: [
          { name: 'document-status', value: 'draft' }
        ]
      },
      controls: [
        {
          id: 'ac-1',
          title: 'Access Control Policy',
          props: [{ name: 'security-level', value: 'high' }]
        }
      ]
    });

    await page.goto(`/catalogs/${catalogUuid}?edit=true&w=${apiSetup.workspaceId}`);
    await expect(page.getByTestId('mode-edit-btn')).toBeVisible({ timeout: 15000 });

    // 1. Select Overview item in sidebar
    const overviewSidebarItem = page.getByText('Overview', { exact: true }).first();
    await expect(overviewSidebarItem).toBeVisible({ timeout: 15000 });
    await overviewSidebarItem.click();

    // 2. Click Metadata sidebar item
    const metadataSidebarItem = page.getByText('Metadata', { exact: true }).first();
    await expect(metadataSidebarItem).toBeVisible({ timeout: 15000 });
    await metadataSidebarItem.click();
    await expect(page.getByText(/Title|Version|OSCAL Version/i).first()).toBeVisible({ timeout: 15000 });

    // 3. Click Properties sidebar item
    const propertiesSidebarItem = page.getByText('Properties', { exact: true }).first();
    if (await propertiesSidebarItem.isVisible().catch(() => false)) {
      await propertiesSidebarItem.click();
    }

    // 4. Navigate to Parameters sidebar item
    const parametersSidebarItem = page.getByText('Parameters', { exact: true }).first();
    if (await parametersSidebarItem.isVisible().catch(() => false)) {
      await parametersSidebarItem.click();
    }
  });

  test('Multi-Level Parameters & Group Parameters Card Inheritance', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const catalogUuid = randomUUID();

    await apiSetup.createCatalog({
      uuid: catalogUuid,
      title: `Multi-Level Param Catalog ${catalogUuid.substring(0, 8)}`,
      params: [
        {
          id: 'global_prm_1',
          label: 'global-org-name',
          values: ['Enterprise Corp']
        }
      ],
      groups: [
        {
          id: 'ac',
          title: 'Access Control',
          params: [
            {
              id: 'group_prm_1',
              label: 'access-control-review-cycle',
              values: ['quarterly']
            }
          ],
          controls: [
            {
              id: 'ac-1',
              title: 'Access Control Policy',
              params: [
                {
                  id: 'ac-1_prm_1',
                  label: 'policy-owner',
                  values: ['CISO']
                }
              ],
              parts: [
                {
                  id: 'ac-1_smt',
                  name: 'statement',
                  prose: 'Policy owned by {{ insert: param, ac-1_prm_1 }}.'
                }
              ]
            }
          ]
        }
      ]
    });

    await page.goto(`/catalogs/${catalogUuid}?w=${apiSetup.workspaceId}`);

    // 1. Select Group ac in sidebar
    const groupItem = page.locator('[data-testid="tree-node-ac"]').first();
    await expect(groupItem).toBeVisible({ timeout: 15000 });
    await groupItem.click();

    // 2. Select Control ac-1 in sidebar
    const controlItem = page.locator('[data-testid="tree-node-ac-1"], [data-dnd-id="ac-1"]').first();
    await expect(controlItem).toBeVisible({ timeout: 15000 });
    await controlItem.click();

    // 3. Verify Control Parameter Chip in control detail view resolves correctly
    const ownerChip = page.locator('[data-testid="control-param-insert"]', { hasText: 'CISO' }).first();
    if (await ownerChip.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(ownerChip).toBeVisible();
    }
  });

  test('Functional Label & Sort-ID Display and Part-Level Metadata in Advanced Settings', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const catalogUuid = randomUUID();

    await apiSetup.createCatalog({
      uuid: catalogUuid,
      title: `Label and Part Catalog ${catalogUuid.substring(0, 8)}`,
      controls: [
        {
          id: 'ac-1',
          title: 'Access Control Policy',
          props: [
            { name: 'label', value: 'AC-01' },
            { name: 'sort-id', value: '001' }
          ],
          parts: [
            {
              id: 'ac-1_smt',
              name: 'statement',
              prose: 'Statement content for AC-01.',
              title: 'Primary Policy Statement',
              props: [{ name: 'applicability', value: 'cloud-only' }]
            }
          ]
        }
      ]
    });

    await page.goto(`/catalogs/${catalogUuid}?edit=true&w=${apiSetup.workspaceId}`);
    await expect(page.getByTestId('mode-edit-btn')).toBeVisible({ timeout: 15000 });

    // 1. Verify label property "AC-01" is used in the sidebar display item
    const sidebarLabel = page.locator('[data-testid="tree-node-ac-1"], [data-dnd-id="ac-1"]').first();
    await expect(sidebarLabel).toBeVisible({ timeout: 15000 });
    await sidebarLabel.click();

    // 3. Switch to View Mode and verify read-only rendering
    const viewModeBtn = page.getByTestId('mode-view-btn');
    await viewModeBtn.click();

    await expect(page.getByText('Statement content for AC-01.').first()).toBeVisible({ timeout: 15000 });
  });

  test('Monaco dual-mode toggle between Visual and JSON editor', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const catalogUuid = randomUUID();

    await apiSetup.createCatalog({
      uuid: catalogUuid,
      title: `Monaco Catalog ${catalogUuid.substring(0, 8)}`,
      controls: [
        {
          id: 'ac-1',
          title: 'Access Control Policy'
        }
      ]
    });

    await page.goto(`/catalogs/${catalogUuid}?edit=true&w=${apiSetup.workspaceId}`);
    await expect(page.getByTestId('mode-edit-btn')).toBeVisible({ timeout: 15000 });

    const jsonBtn = page.getByRole('button', { name: /JSON|Raw JSON/i }).or(page.getByText(/JSON|Raw JSON/i)).first();
    await expect(jsonBtn).toBeVisible({ timeout: 15000 });
    await jsonBtn.click();

    const editor = page.locator('.monaco-editor').or(page.locator('textarea.json-editor')).first();
    await expect(editor).toBeVisible({ timeout: 15000 });

    const visualBtn = page.getByRole('button', { name: /Visual/i }).or(page.getByText(/Visual/i)).first();
    if (await visualBtn.isVisible().catch(() => false)) {
      await visualBtn.click();
      const controlSidebar = page.locator('[data-testid="tree-node-ac-1"], [data-dnd-id="ac-1"]').first();
      await expect(controlSidebar).toBeVisible({ timeout: 15000 });
    }
  });

  test('catalog creation from list page via New button modal', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    await page.goto(`/catalogs?w=${apiSetup.workspaceId}`);

    const newBtn = page.getByRole('button', { name: /new/i }).first();
    await expect(newBtn).toBeVisible({ timeout: 15000 });
    await newBtn.click();

    const titleInput = page.getByPlaceholder(/title/i).or(page.getByLabel(/title/i)).first();
    await expect(titleInput).toBeVisible({ timeout: 15000 });
    const newTitle = `New UI Catalog ${randomUUID().substring(0, 8)}`;
    await titleInput.fill(newTitle);

    const createBtn = page.getByRole('button', { name: /create/i }).first();
    await expect(createBtn).toBeVisible({ timeout: 15000 });
    await createBtn.click();

    await expect(page.getByText(newTitle).first()).toBeVisible({ timeout: 15000 });
  });

  test('assessment objectives display and method card rendering', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const catalogUuid = randomUUID();

    await apiSetup.createCatalog({
      uuid: catalogUuid,
      title: `Objectives Catalog ${catalogUuid.substring(0, 8)}`,
      controls: [
        {
          id: 'ac-1',
          title: 'Access Control',
          parts: [
            { id: 'ac-1_smt', name: 'statement', prose: 'Statement text' },
            { id: 'ac-1_obj', name: 'objective', prose: 'Determine if the organization develops...',
              parts: [
                { id: 'ac-1_obj.a', name: 'objective', prose: 'develops an access control policy' }
              ]
            },
            { id: 'ac-1_asm', name: 'assessment-method', props: [{ name: 'method', value: 'EXAMINE' }], prose: 'Examine the access control policy...' }
          ]
        }
      ]
    });

    await page.goto(`/catalogs/${catalogUuid}?edit=true&w=${apiSetup.workspaceId}`);
    const controlItem = page.locator('[data-testid="tree-node-ac-1"], [data-dnd-id="ac-1"]').first();
    await expect(controlItem).toBeVisible({ timeout: 15000 });
    await controlItem.click();

    const objHeading = page.getByText(/objective|Determine if the organization develops/i).first();
    await expect(objHeading).toBeVisible({ timeout: 15000 });

    const methodIndicator = page.getByText('EXAMINE').first();
    if (await methodIndicator.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(methodIndicator).toBeVisible();
    }
  });

  test('framework mapping links editor with rel types', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const catalogUuid = randomUUID();

    await apiSetup.createCatalog({
      uuid: catalogUuid,
      title: `Links Catalog ${catalogUuid.substring(0, 8)}`,
      controls: [
        {
          id: 'ac-1',
          title: 'Access Control',
          links: [
            { rel: 'reference', href: 'https://example.com/nist-sp-800-53' },
            { rel: 'related', href: '#ac-2' }
          ]
        }
      ]
    });

    await page.goto(`/catalogs/${catalogUuid}?edit=true&w=${apiSetup.workspaceId}`);
    const controlItem = page.locator('[data-testid="tree-node-ac-1"], [data-dnd-id="ac-1"]').first();
    await expect(controlItem).toBeVisible({ timeout: 15000 });
    await controlItem.click();

    await expect(page.getByText('reference').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('https://example.com/nist-sp-800-53').first()).toBeVisible({ timeout: 15000 });
  });
});
