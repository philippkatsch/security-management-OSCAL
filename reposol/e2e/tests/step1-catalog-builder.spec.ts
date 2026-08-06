import { test, expect } from '../fixtures/base';
import { randomUUID } from 'node:crypto';

test.describe('Step 1 Catalog Builder', () => {

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

    // 2. Fill Sub-part prose
    const subpartProse = page.getByPlaceholder('Item prose text...').first();
    await expect(subpartProse).toBeVisible({ timeout: 15000 });
    await subpartProse.fill('a. Purpose and scope of access control.');

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
    await expect(page.getByText('guidance ▼')).toBeVisible();

    // 5. Open Advanced Settings
    const wrenchBtn = page.getByTitle('Advanced Settings').first();
    await wrenchBtn.click();

    const nsInput = page.getByPlaceholder('ns-uri').first();
    await expect(nsInput).toBeVisible();
    await nsInput.fill('https://nist.gov/oscal/ns');

    const classInput = page.getByPlaceholder('class').first();
    await expect(classInput).toBeVisible();
    await classInput.fill('SP800-53-part');

    const titleInput = page.getByPlaceholder('Title').first();
    await expect(titleInput).toBeVisible();
    await titleInput.fill('Custom Part Title');

    // 6. Delete Sub-part
    const deleteBtn = page.getByTitle('Remove').first();
    await deleteBtn.click();
    await expect(subpartProse).toHaveCount(0);
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

    // 1. Assert Assessment Method Card container and headers
    const methodContainer = page.locator('.section-container').filter({ hasText: 'Assessment Method' });
    await expect(methodContainer).toBeVisible({ timeout: 15000 });

    await expect(page.getByText('AC-01-Examine').first()).toBeVisible();
    await expect(page.getByText('AC-01-Interview').first()).toBeVisible();
    await expect(page.getByText('AC-01-Test').first()).toBeVisible();

    // 2. Assert Parameter Chip resolution in prose
    const paramChip = page.locator('.control-param-insert', { hasText: 'annually' }).first();
    await expect(paramChip).toBeVisible();

    // 3. Click chip and verify scroll to parameter card
    await paramChip.click();
    const paramCard = page.locator('#param-card-ac-1_prm_1');
    await expect(paramCard).toBeVisible();
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

    // Select control ac-1 in sidebar to display detail view
    const controlItem = page.locator('[data-dnd-id="ac-1"]');
    await expect(controlItem).toBeVisible({ timeout: 15000 });
    await controlItem.click();

    // 1. Add Mapping Link
    const addLinkBtn = page.getByRole('button', { name: /Add Link/i });
    await expect(addLinkBtn).toBeVisible({ timeout: 15000 });
    await addLinkBtn.click();

    const relSelect = page.locator('.link-row-container select').first();
    await relSelect.selectOption('mapping');

    const hrefInput = page.locator('input[placeholder*="href"]').first();
    await hrefInput.fill('https://iso.org/27001#A.9.1.1');

    const textInput = page.locator('input[placeholder*="Description"]').first();
    await textInput.fill('ISO 27001 Access Policy Crosswalk');

    // 2. Add Reference Link with Resource Dropdown
    await addLinkBtn.click();
    const relSelect2 = page.locator('.link-row-container select').nth(1);
    await relSelect2.selectOption('reference');

    const resourceDropdown = page.locator('.link-row-container select').nth(2);
    await expect(resourceDropdown).toBeVisible();
    await resourceDropdown.selectOption(`#${resourceUuid}`);

    // 3. Advanced Link Settings
    const linkWrench = page.getByTitle('Advanced fields').first();
    await linkWrench.click();

    const mediaTypeInput = page.getByPlaceholder('e.g. application/pdf').first();
    await expect(mediaTypeInput).toBeVisible();
    await mediaTypeInput.fill('application/pdf');

    const fragmentInput = page.getByPlaceholder('e.g. section-1').first();
    await expect(fragmentInput).toBeVisible();
    await fragmentInput.fill('clause-9.1');

    // 4. Switch to View Mode & Assert Pill Badge
    const viewModeBtn = page.getByTestId('mode-view-btn');
    await viewModeBtn.click();

    const pillBadge = page.locator('a', { hasText: 'ISO 27001 Access Policy Crosswalk' });
    await expect(pillBadge).toBeVisible();
    await expect(pillBadge).toHaveAttribute('href', 'https://iso.org/27001#A.9.1.1');
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

    await expect(jsonContainer).toBeVisible();
    expect(dialogMessage).toContain('JSON Syntax Error: Cannot switch to visual view.');

    // 4. Restore valid JSON and switch back to Visual mode
    await page.evaluate(() => {
      const monacoEditor = (window as any).monaco?.editor?.getEditors()?.[0];
      if (monacoEditor) {
        monacoEditor.setValue(JSON.stringify({
          catalog: {
            uuid: '00000000-0000-4000-8000-000000000000',
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
    });

    await visualToggleBtn.click();
    await expect(jsonContainer).toHaveCount(0);
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

    // 1. Select withdrawn control ac-2 in sidebar
    const control2Item = page.locator('[data-dnd-id="ac-2"]');
    await expect(control2Item).toBeVisible({ timeout: 15000 });
    await control2Item.click();

    // 2. Assert withdrawal banner and replacement link
    const withdrawalBanner = page.getByText(/Control Withdrawn: This control is deprecated./i);
    await expect(withdrawalBanner).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Replaced by: ac-1')).toBeVisible();

    // 3. Click replacement link
    await page.getByText('ac-1').first().click();
    await expect(page.getByText('Access Control Policy').first()).toBeVisible();

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

    await expect(withdrawalBanner).toHaveCount(0);
  });

});
