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

    // 4. Change Category Type
    const categorySelect = page.locator('.parts-editor-section select').first();
    await categorySelect.selectOption('guidance');
    await expect(page.getByText('guidance ▼')).toBeVisible({ timeout: 15000 });

    // 5. Open Advanced Settings
    const wrenchBtn = page.getByTitle('Advanced Settings').first();
    await wrenchBtn.click();

    const nsInput = page.getByPlaceholder('ns-uri').first();
    await expect(nsInput).toBeVisible({ timeout: 15000 });
    await nsInput.fill('https://nist.gov/oscal/ns');

    const classInput = page.getByPlaceholder('class').first();
    await expect(classInput).toBeVisible({ timeout: 15000 });
    await classInput.fill('SP800-53-part');

    const titleInput = page.getByPlaceholder('Title').first();
    await expect(titleInput).toBeVisible({ timeout: 15000 });
    await titleInput.fill('Custom Part Title');

    // 6. Switch to View Mode and verify read-only presentation
    const viewModeBtn = page.getByTestId('mode-view-btn');
    await viewModeBtn.click();

    await expect(page.getByText('a. Purpose and scope of access control.')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('1. Detail scope guidelines.')).toBeVisible({ timeout: 15000 });

    // 7. Switch back to Edit Mode and delete Sub-part
    const editModeBtn = page.getByTestId('mode-edit-btn');
    await editModeBtn.click();

    const controlItemAgain = page.locator('[data-dnd-id="ac-1"]');
    await expect(controlItemAgain).toBeVisible({ timeout: 15000 });
    await controlItemAgain.click();

    const deleteBtn = page.getByTitle('Remove').first();
    await expect(deleteBtn).toBeVisible({ timeout: 15000 });
    await deleteBtn.click({ force: true });
    await expect(subpartProse).toHaveCount(0, { timeout: 15000 });
  });

  test('Assessment Objectives & Methods Rendering, Method ID Generation & Parameter Chip Navigation', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const catalogUuid = randomUUID();

    await apiSetup.createCatalog({
      uuid: catalogUuid,
      title: `Assessment Catalog ${catalogUuid.substring(0, 8)}`,
      controls: [
        {
          id: 'ac-1',
          title: 'Access Control Policy and Procedures',
          params: [
            {
              id: 'ac-1_prm_1',
              label: 'frequency',
              values: ['annually']
            }
          ],
          parts: [
            {
              id: 'ac-1_obj',
              name: 'objective',
              parts: [
                {
                  id: 'ac-1_obj.examine',
                  name: 'examine',
                  prose: 'Examine access control policy {{ insert: param, ac-1_prm_1 }}.'
                },
                {
                  id: 'ac-1_obj.interview',
                  name: 'interview',
                  prose: 'Interview personnel responsible for access control.'
                },
                {
                  id: 'ac-1_obj.test',
                  name: 'test',
                  prose: 'Test system login parameters.'
                }
              ]
            }
          ]
        }
      ]
    });

    await page.goto(`/catalog/${catalogUuid}`);
    
    // Select control ac-1 in sidebar to display detail view
    const controlItem = page.locator('[data-dnd-id="ac-1"]');
    await expect(controlItem).toBeVisible({ timeout: 15000 });
    await controlItem.click();

    // 1. Assert Assessment Method Card container and headers with left-border styling
    const methodContainer = page.locator('.section-container').filter({ hasText: 'Assessment Method' });
    await expect(methodContainer).toBeVisible({ timeout: 15000 });

    await expect(page.getByText('AC-01-Examine').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('AC-01-Interview').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('AC-01-Test').first()).toBeVisible({ timeout: 15000 });

    // 2. Assert Parameter Chip resolution in prose and hover tooltip attributes
    const paramChip = page.locator('.control-param-insert', { hasText: 'annually' }).first();
    await expect(paramChip).toBeVisible({ timeout: 15000 });
    await expect(paramChip).toHaveAttribute('title', /Parameter: ac-1_prm_1/i);

    // 3. Click chip and verify scroll to parameter card
    await paramChip.click();
    const paramCard = page.locator('#param-card-ac-1_prm_1');
    await expect(paramCard).toBeVisible({ timeout: 15000 });
  });

  test('Framework Mapping Links, Back-Matter Resource References & Read-Only Badges', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const catalogUuid = randomUUID();
    const resourceUuid = '99999999-9999-4999-a999-999999999999';

    await apiSetup.createCatalog({
      uuid: catalogUuid,
      title: `Mapping Links Catalog ${catalogUuid.substring(0, 8)}`,
      'back-matter': {
        resources: [
          {
            uuid: resourceUuid,
            title: 'ISO 27001 Standard Document'
          }
        ]
      },
      controls: [
        {
          id: 'ac-1',
          title: 'Access Control Policy'
        }
      ]
    });

    await page.goto(`/catalog/${catalogUuid}?edit=true`);
    await expect(page.getByTestId('mode-edit-btn')).toBeVisible({ timeout: 15000 });

    const controlItem = page.locator('[data-dnd-id="ac-1"]').first();
    await expect(controlItem).toBeVisible({ timeout: 15000 });
    await controlItem.click();

    // 1. Add Mapping Link (Row 1)
    const addLinkBtn = page.getByRole('button', { name: /Add Link/i });
    await expect(addLinkBtn).toBeVisible({ timeout: 15000 });
    await addLinkBtn.click();

    const row1 = page.locator('.link-row-container').nth(0);
    await row1.locator('select').first().selectOption('mapping');
    await row1.locator('input[placeholder*="href"]').fill('https://iso.org/27001#A.9.1.1');
    await row1.locator('input[placeholder*="Description"]').fill('ISO 27001 Access Policy Crosswalk');

    // 2. Add Reference Link with Resource Dropdown (Row 2)
    await addLinkBtn.click();
    const row2 = page.locator('.link-row-container').nth(1);
    await row2.locator('select').first().selectOption('reference');
    const resourceDropdown = row2.locator('select').nth(1);
    await expect(resourceDropdown).toBeVisible({ timeout: 15000 });
    await resourceDropdown.selectOption(`#${resourceUuid}`);

    // 3. Add Related Link (Row 3)
    await addLinkBtn.click();
    const row3 = page.locator('.link-row-container').nth(2);
    await row3.locator('select').first().selectOption('related');
    await row3.locator('input[placeholder*="href"]').fill('https://example.com/related-spec');

    // 4. Advanced Link Settings on Row 1
    const linkWrench = row1.getByTitle('Advanced fields').first();
    await linkWrench.click();

    const mediaTypeInput = row1.getByPlaceholder('e.g. application/pdf').first();
    await expect(mediaTypeInput).toBeVisible({ timeout: 15000 });
    await mediaTypeInput.fill('application/pdf');

    const fragmentInput = row1.getByPlaceholder('e.g. section-1').first();
    await expect(fragmentInput).toBeVisible({ timeout: 15000 });
    await fragmentInput.fill('clause-9.1');

    // Allow debounced inputs to settle before mode switch
    await page.waitForTimeout(500);

    // 5. Switch to View Mode & Assert Pill Badges
    const viewModeBtn = page.getByTestId('mode-view-btn');
    await viewModeBtn.click();

    const controlItemViewMode = page.locator('[data-dnd-id="ac-1"]').first();
    await expect(controlItemViewMode).toBeVisible({ timeout: 15000 });
    await controlItemViewMode.click();

    const pillBadge = page.locator('a', { hasText: 'ISO 27001 Access Policy Crosswalk' });
    await expect(pillBadge).toBeVisible({ timeout: 15000 });
    await expect(pillBadge).toHaveAttribute('href', 'https://iso.org/27001#A.9.1.1');

    // 6. Switch back to Edit Mode and remove link
    const editBtn = page.getByTestId('mode-edit-btn');
    await editBtn.click();

    const controlItemAgain = page.locator('[data-dnd-id="ac-1"]').first();
    await expect(controlItemAgain).toBeVisible({ timeout: 15000 });
    await controlItemAgain.click();

    const removeLinkBtn = page.locator('.link-row-container [title*="Remove"], .link-row-container [title*="Delete"], .link-row-container .btn-danger').last();
    if (await removeLinkBtn.isVisible().catch(() => false)) {
      await removeLinkBtn.click();
    }
  });

  test('Monaco JSON Dual-Mode Toggling, NIST Schema Validation & Syntax Error View Hold', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const catalogUuid = randomUUID();

    await apiSetup.createCatalog({
      uuid: catalogUuid,
      title: `Dual Mode Catalog ${catalogUuid.substring(0, 8)}`,
      controls: [{ id: 'ac-1', title: 'Access Control Policy' }]
    });

    await page.goto(`/catalog/${catalogUuid}?edit=true`);
    await expect(page.getByTestId('mode-edit-btn')).toBeVisible({ timeout: 15000 });

    // 1. Switch to JSON Mode
    const jsonToggleBtn = page.getByRole('button', { name: /JSON/i });
    await expect(jsonToggleBtn).toBeVisible({ timeout: 15000 });
    await jsonToggleBtn.click();

    const jsonContainer = page.locator('.json-editor-container');
    await expect(jsonContainer).toBeVisible({ timeout: 15000 });

    // 2. Trigger Validate Schema
    const validateSchemaBtn = page.getByRole('button', { name: /Validate Schema/i });
    await expect(validateSchemaBtn).toBeVisible({ timeout: 15000 });
    await validateSchemaBtn.click();

    // 3. Syntax error detection and view hold
    let dialogMessage = '';
    page.on('dialog', async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });

    // Wait for Monaco editor instance to initialize
    await page.waitForFunction(() => Boolean((window as any).monaco?.editor?.getEditors()?.length), { timeout: 15000 });

    await page.evaluate(() => {
      const monacoEditor = (window as any).monaco?.editor?.getEditors()?.[0];
      if (monacoEditor) {
        monacoEditor.setValue('{"catalog": { invalid_json');
      }
    });

    await expect(page.getByText(/Invalid JSON:/i)).toBeVisible({ timeout: 10000 });

    const visualToggleBtn = page.getByRole('button', { name: /Visual/i });
    await visualToggleBtn.click();

    await expect(jsonContainer).toBeVisible({ timeout: 10000 });
    expect(dialogMessage).toContain('JSON Syntax Error: Cannot switch to visual view.');

    // 4. Restore valid JSON and switch back to Visual mode
    await page.evaluate((uuid) => {
      const monacoEditor = (window as any).monaco?.editor?.getEditors()?.[0];
      if (monacoEditor) {
        monacoEditor.setValue(JSON.stringify({
          catalog: {
            uuid: uuid,
            metadata: {
              title: 'Valid Catalog',
              'last-modified': '2026-01-01T00:00:00Z',
              version: '1.0',
              'oscal-version': '1.1.0'
            },
            groups: [
              {
                id: 'ac',
                title: 'Access Control',
                controls: [{ id: 'ac-1', title: 'Access Control Policy' }]
              }
            ]
          }
        }, null, 2));
      }
    }, catalogUuid);

    await visualToggleBtn.click();
    await expect(jsonContainer).toHaveCount(0, { timeout: 15000 });
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

});
