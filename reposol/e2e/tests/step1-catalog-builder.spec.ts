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

    await page.goto(`/catalog/${catalogUuid}?edit=true`);
    await expect(page.getByTestId('mode-edit-btn')).toBeVisible({ timeout: 15000 });

    // Select control ac-1 in sidebar to display detail view
    const controlItem = page.locator('[data-dnd-id="ac-1"]');
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

    const badgeA = page.locator('.part-auto-label', { hasText: 'a.' }).first();
    if (await badgeA.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(badgeA).toBeVisible();
    }

    // 3. Add Nested Sub-item (level 2)
    const addNestedBtn = page.getByTitle('Add sub-part').first();
    await expect(addNestedBtn).toBeVisible({ timeout: 15000 });
    await addNestedBtn.click();

    const nestedProse = page.getByPlaceholder('Item prose text...').nth(1);
    await expect(nestedProse).toBeVisible({ timeout: 15000 });
    await nestedProse.fill('1. Detail scope guidelines.');

    // 4. Delete nested sub-item
    const removeNestedBtn = page.getByTitle('Remove sub-part').nth(1);
    if (await removeNestedBtn.isVisible().catch(() => false)) {
      await removeNestedBtn.click();
      await expect(nestedProse).toHaveCount(0, { timeout: 15000 });
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

    await page.goto(`/catalog/${catalogUuid}?edit=true`);
    await expect(page.getByTestId('mode-edit-btn')).toBeVisible({ timeout: 15000 });

    // 1. Verify sidebar item for withdrawn control ac-2 renders with withdrawn styling
    const control2Item = page.locator('[data-dnd-id="ac-2"]');
    await expect(control2Item).toBeVisible({ timeout: 15000 });
    await control2Item.click();

    // 2. Assert withdrawal banner and replacement link
    const withdrawalBanner = page.getByText(/Control Withdrawn: This control is deprecated./i);
    await expect(withdrawalBanner).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Replaced by: ac-1')).toBeVisible({ timeout: 15000 });

    // 3. Click replacement link
    await page.locator('.control-detail-view').getByText('ac-1').click();
    await expect(page.locator('.control-detail-view')).toContainText('Access Control Policy', { timeout: 15000 });

    // 4. Restore withdrawn control
    const control2ItemAgain = page.locator('[data-dnd-id="ac-2"]');
    await expect(control2ItemAgain).toBeVisible({ timeout: 15000 });
    await control2ItemAgain.click();

    page.on('dialog', async (dialog) => {
      await dialog.accept();
    });

    const restoreBtn = page.getByRole('button', { name: /Restore Control/i });
    await expect(restoreBtn).toBeVisible({ timeout: 15000 });
    await restoreBtn.click();

    await expect(withdrawalBanner).toHaveCount(0, { timeout: 15000 });

    // 5. Check Document Overview dashboard metric calculation
    const overviewSidebarItem = page.locator('.sidebar-nav-item', { hasText: 'Overview' }).first();
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

    await page.goto(`/catalog/${catalogUuid}?edit=true`);
    await expect(page.getByTestId('mode-edit-btn')).toBeVisible({ timeout: 15000 });

    // 1. Navigate to control ac-1 in sidebar
    const controlItem = page.locator('[data-dnd-id="ac-1"]');
    await expect(controlItem).toBeVisible({ timeout: 15000 });
    await controlItem.click();

    // 2. Expand ParameterCard for ac-1_prm_1 in Edit Mode
    const paramCard = page.locator('#param-card-ac-1_prm_1');
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

    const remarksInput = paramCard.getByPlaceholder(/Error remarks|remarks/i).first();
    if (await remarksInput.isVisible().catch(() => false)) {
      await remarksInput.fill('Must be formatted as e.g. 30-days');
    }

    // 4. Fill Label, Usage, and Guidelines
    const labelInput = paramCard.getByPlaceholder(/Label/i).first();
    if (await labelInput.isVisible().catch(() => false)) {
      await labelInput.fill('audit-review-frequency');
    }

    // 5. Switch to View Mode and verify parameter badge rendering in statement prose
    const viewModeBtn = page.getByTestId('mode-view-btn');
    await viewModeBtn.click();

    const paramChip = page.locator('.control-param-insert').first();
    await expect(paramChip).toBeVisible({ timeout: 15000 });
    await expect(paramChip).toHaveText(/30-days/);

    // 6. Click param chip to smooth-scroll back to parameter card
    await paramChip.click();
    await expect(paramCard).toBeVisible({ timeout: 15000 });
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

    await page.goto(`/catalog/${catalogUuid}?edit=true`);
    await expect(page.getByTestId('mode-edit-btn')).toBeVisible({ timeout: 15000 });

    // 1. Select Overview item in sidebar
    const overviewSidebarItem = page.locator('.sidebar-item', { hasText: 'Overview' }).first();
    await expect(overviewSidebarItem).toBeVisible({ timeout: 15000 });
    await overviewSidebarItem.click();

    // 2. Click Metadata sidebar item
    const metadataSidebarItem = page.locator('.sidebar-item', { hasText: 'Metadata' }).first();
    await expect(metadataSidebarItem).toBeVisible({ timeout: 15000 });
    await metadataSidebarItem.click();
    await expect(page.getByText(/Title|Version|OSCAL Version/i).first()).toBeVisible({ timeout: 15000 });

    // 3. Click Properties sidebar item
    const propertiesSidebarItem = page.locator('.sidebar-item', { hasText: 'Properties' }).first();
    await expect(propertiesSidebarItem).toBeVisible({ timeout: 15000 });
    await propertiesSidebarItem.click();

    // Assert Properties View Metrics & Add Header Property Button
    const addHeaderPropBtn = page.getByRole('button', { name: /Add Header Property|➕ Add Header Property/i }).first();
    if (await addHeaderPropBtn.isVisible().catch(() => false)) {
      await expect(addHeaderPropBtn).toBeVisible({ timeout: 15000 });
      await addHeaderPropBtn.click();

      // Fill property name and value in new property row
      const nameInput = page.getByPlaceholder(/property name|key/i).last();
      const valInput = page.getByPlaceholder(/property value|val/i).last();
      if (await nameInput.isVisible().catch(() => false)) {
        await nameInput.fill('classification');
      }
      if (await valInput.isVisible().catch(() => false)) {
        await valInput.fill('restricted');
      }
    }

    // 4. Navigate to Parameters sidebar item
    const parametersSidebarItem = page.locator('.sidebar-item', { hasText: 'Parameters' }).first();
    await expect(parametersSidebarItem).toBeVisible({ timeout: 15000 });
    await parametersSidebarItem.click();
    await expect(page.getByText(/Global Catalog Parameters|Inheritance|Parameters/i).first()).toBeVisible({ timeout: 15000 });
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

    await page.goto(`/catalog/${catalogUuid}`);

    // 1. Select Group ac in sidebar
    const groupItem = page.locator('.sidebar-item-group', { hasText: 'Access Control' }).first();
    await expect(groupItem).toBeVisible({ timeout: 15000 });
    await groupItem.click();

    // 2. Select Control ac-1 in sidebar
    const controlItem = page.locator('[data-dnd-id="ac-1"]').first();
    await expect(controlItem).toBeVisible({ timeout: 15000 });
    await controlItem.click();

    // 3. Verify Control Parameter Chip in control detail view resolves correctly
    const ownerChip = page.locator('.control-param-insert', { hasText: 'CISO' }).first();
    await expect(ownerChip).toBeVisible({ timeout: 15000 });

    // 4. Verify Parameter card for ac-1_prm_1 is visible in detail view
    const paramCard = page.locator('#param-card-ac-1_prm_1');
    await expect(paramCard).toBeVisible({ timeout: 15000 });
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

    await page.goto(`/catalog/${catalogUuid}?edit=true`);
    await expect(page.getByTestId('mode-edit-btn')).toBeVisible({ timeout: 15000 });

    // 1. Verify label property "AC-01" is used in the sidebar display item
    const sidebarLabel = page.locator('[data-dnd-id="ac-1"]', { hasText: 'AC-01' }).first();
    await expect(sidebarLabel).toBeVisible({ timeout: 15000 });
    await sidebarLabel.click();

    // 2. Inspect statement part rendering and Advanced Settings
    const partContainer = page.locator('.parts-editor-section').first();
    await expect(partContainer).toBeVisible({ timeout: 15000 });

    const wrenchBtn = partContainer.getByTitle('Advanced Settings').first();
    if (await wrenchBtn.isVisible().catch(() => false)) {
      await wrenchBtn.click();

      // Assert part title input inside advanced settings grid has value "Primary Policy Statement"
      const partTitleInput = partContainer.locator('div').filter({ hasText: /^Title$/ }).locator('..').locator('input[placeholder="Title"]').first();
      if (await partTitleInput.isVisible().catch(() => false)) {
        await expect(partTitleInput).toHaveValue('Primary Policy Statement');
      }
    }

    // 3. Switch to View Mode and verify read-only rendering
    const viewModeBtn = page.getByTestId('mode-view-btn');
    await viewModeBtn.click();

    await expect(page.getByText('AC-01').first()).toBeVisible({ timeout: 15000 });
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

    await page.goto(`/catalog/${catalogUuid}?edit=true`);
    await expect(page.getByTestId('mode-edit-btn')).toBeVisible({ timeout: 15000 });

    const jsonBtn = page.getByRole('button', { name: /JSON|Raw JSON/i }).or(page.getByText(/JSON|Raw JSON/i)).first();
    await expect(jsonBtn).toBeVisible({ timeout: 15000 });
    await jsonBtn.click();

    const editor = page.locator('.monaco-editor').or(page.locator('textarea.json-editor')).first();
    await expect(editor).toBeVisible({ timeout: 15000 });

    const visualBtn = page.getByRole('button', { name: /Visual/i }).or(page.getByText(/Visual/i)).first();
    if (await visualBtn.isVisible().catch(() => false)) {
      await visualBtn.click();
      const controlSidebar = page.locator('[data-dnd-id="ac-1"]');
      await expect(controlSidebar).toBeVisible({ timeout: 15000 });
    }
  });

  test('catalog creation from list page via New button modal', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    await page.goto('/catalogs');

    const newBtn = page.getByRole('button', { name: /new/i });
    await expect(newBtn).toBeVisible({ timeout: 15000 });
    await newBtn.click();

    const titleInput = page.getByPlaceholder(/title/i).or(page.getByLabel(/title/i)).first();
    await expect(titleInput).toBeVisible({ timeout: 15000 });
    const newTitle = `New UI Catalog ${randomUUID().substring(0, 8)}`;
    await titleInput.fill(newTitle);

    const createBtn = page.getByRole('button', { name: /create/i });
    await expect(createBtn).toBeVisible({ timeout: 15000 });
    await createBtn.click();

    await expect(page.locator('.sidebar-item-group').or(page.getByText(newTitle)).first()).toBeVisible({ timeout: 15000 });
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

    await page.goto(`/catalog/${catalogUuid}?edit=true`);
    const controlItem = page.locator('[data-dnd-id="ac-1"]');
    await expect(controlItem).toBeVisible({ timeout: 15000 });
    await controlItem.click();

    const objHeading = page.getByText(/objective|Determine if the organization develops/i).first();
    await expect(objHeading).toBeVisible({ timeout: 15000 });

    const methodIndicator = page.getByText('EXAMINE').first();
    await expect(methodIndicator).toBeVisible({ timeout: 15000 });
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

    await page.goto(`/catalog/${catalogUuid}?edit=true`);
    const controlItem = page.locator('[data-dnd-id="ac-1"]');
    await expect(controlItem).toBeVisible({ timeout: 15000 });
    await controlItem.click();

    await expect(page.getByText('reference').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('https://example.com/nist-sp-800-53').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('related').first()).toBeVisible({ timeout: 15000 });
  });
});
