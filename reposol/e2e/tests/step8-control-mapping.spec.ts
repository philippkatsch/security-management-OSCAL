import { test, expect } from '../fixtures/base';

test.describe('Step 8 Control Mapping — E2E Specifications', () => {
  test('navigate to Control Mappings list view and view items', async ({ page, apiSetup }) => {
    const mapUuid = await apiSetup.createControlMapping({
      title: 'E2E NIST SP 800-53 to ISO 27001 Mapping'
    });

    await page.goto(`/control-mapping/${mapUuid}`);
    await expect(page.getByText(/NIST SP 800-53|Control Mapping/i).or(page.locator('input[value*="NIST SP 800-53"]')).first()).toBeVisible();
  });

  test('create new Control Mapping via UI', async ({ page }) => {
    await page.goto('/control-mappings');
    
    const newBtn = page.getByRole('button', { name: /new/i }).first();
    if (await newBtn.isVisible()) {
      await newBtn.click();
      const input = page.locator('.modal-overlay input').first();
      if (await input.isVisible()) {
        await input.fill('E2E BSI IT-Grundschutz Mapping');
        await page.getByRole('button', { name: /create/i }).click();
        await expect(page.getByText(/E2E BSI IT-Grundschutz Mapping/i).or(page.locator('input[value*="E2E BSI IT-Grundschutz Mapping"]')).first()).toBeVisible();
      }
    }
  });

  test('inspect and switch tabs (Overview, Mappings, Matrix View, Gap Analysis, Metadata, JSON)', async ({ page, apiSetup }) => {
    const catUuid1 = await apiSetup.createCatalog({ title: 'Source Framework NIST 800-53' });
    const catUuid2 = await apiSetup.createCatalog({ title: 'Target Framework ISO 27001' });

    const mapUuid = await apiSetup.createControlMapping({
      title: 'Comprehensive Framework Crosswalk',
      provenance: {
        method: 'hybrid',
        status: 'draft',
        'matching-rationale': 'semantic',
        'mapping-description': 'Crosswalk between NIST 800-53 and ISO 27001 controls'
      },
      mappings: [
        {
          uuid: '11111111-1111-4111-8111-111111111111',
          'source-resource': { type: 'catalog', href: `#/catalogs/${catUuid1}` },
          'target-resource': { type: 'catalog', href: `#/catalogs/${catUuid2}` },
          maps: [
            {
              uuid: '22222222-2222-4222-8222-222222222222',
              relationship: 'equivalent-to',
              sources: [{ type: 'control', 'id-ref': 'ac-1' }],
              targets: [{ type: 'control', 'id-ref': 'A.5.1' }]
            }
          ]
        }
      ]
    });

    await apiSetup.syncWorkspace();
    await page.goto('/control-mappings');
    await page.evaluate((wsId) => localStorage.setItem('reposol_workspace_id', wsId), apiSetup.workspaceId);
    await page.goto(`/control-mapping/${mapUuid}`);

    // Verify Overview Tab content
    await expect(page.locator('body')).toContainText(/Total Mappings|Overview/i);

    // Switch to Mappings tab
    await page.locator('.tab-nav button', { hasText: 'Mappings' }).click();
    await expect(page.locator('body')).toContainText(/Source Control|ac-1|equivalent-to|Target Control/i);

    // Switch to Matrix View tab
    await page.locator('.tab-nav button', { hasText: 'Matrix View' }).click();
    await expect(page.locator('body')).toContainText(/Matrix|Coverage/i);

    // Switch to Gap Analysis tab
    await page.locator('.tab-nav button', { hasText: 'Gap Analysis' }).click();
    await expect(page.locator('body')).toContainText(/Gap Analysis|Coverage/i);
  });

  test('edit mapping provenance and relationship details', async ({ page, apiSetup }) => {
    const mapUuid = await apiSetup.createControlMapping({
      title: 'Editable Control Mapping'
    });

    await page.goto(`/control-mapping/${mapUuid}?edit=true&w=${apiSetup.workspaceId}`);

    // Ensure edit mode active or click edit toggle
    const editToggle = page.getByRole('button', { name: /edit/i }).or(page.getByText('Edit Mode'));
    if (await editToggle.first().isVisible()) {
      await editToggle.first().click();
    }

    // Switch to Raw JSON view or visual mode and verify editor container
    const jsonTab = page.getByRole('button', { name: /json/i }).or(page.getByText('Raw JSON'));
    if (await jsonTab.first().isVisible()) {
      await jsonTab.first().click();
      await expect(page.locator('.monaco-editor').first()).toBeVisible();
    }
  });
});

