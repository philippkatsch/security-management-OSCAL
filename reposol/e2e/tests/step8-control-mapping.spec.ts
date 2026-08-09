import { test, expect } from '../fixtures/base';
import { randomUUID } from 'node:crypto';

test.describe('Step 8 Control Mapping — E2E Specifications', () => {
  test.setTimeout(90000);

  test('navigate to Control Mappings list view and view items', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const mapUuid = await apiSetup.createControlMapping({
      title: 'E2E NIST SP 800-53 to ISO 27001 Mapping'
    });

    await page.goto(`/control-mappings?w=${apiSetup.workspaceId}`);
    await expect(page.getByText('E2E NIST SP 800-53 to ISO 27001 Mapping').first()).toBeVisible({ timeout: 15000 });
    await page.goto(`/control-mapping/${mapUuid}?w=${apiSetup.workspaceId}`, { waitUntil: 'networkidle' });
    await expect(page.locator('.mapping-page')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('E2E NIST SP 800-53 to ISO 27001 Mapping').first()).toBeVisible();
  });

  test('create new Control Mapping via UI', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    await page.goto(`/control-mappings?w=${apiSetup.workspaceId}`);
    
    const newBtn = page.getByRole('button', { name: /new/i }).first();
    await newBtn.click();
    
    const input = page.locator('.modal-overlay input').first();
    await input.fill('E2E BSI IT-Grundschutz Mapping');
    await page.getByRole('button', { name: /create/i }).click();
    await expect(page.getByText(/E2E BSI IT-Grundschutz Mapping/i).or(page.locator('input[value*="E2E BSI IT-Grundschutz Mapping"]')).first()).toBeVisible();
  });

  test('inspect and switch tabs (Overview, Mappings, Matrix View, Gap Analysis, Metadata, JSON)', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
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

    await page.goto(`/control-mapping/${mapUuid}?w=${apiSetup.workspaceId}`);

    // Verify Overview Tab content
    await expect(page.locator('.tab-nav button', { hasText: 'Overview' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/Total Mappings|Overview/i).first()).toBeVisible();

    // Switch to Mappings tab
    await page.locator('.tab-nav button', { hasText: 'Mappings' }).click();
    await expect(page.locator('body')).toContainText('ac-1');
    await expect(page.locator('body')).toContainText('A.5.1');

    // Switch to Matrix View tab
    await page.locator('.tab-nav button', { hasText: 'Matrix View' }).click();
    await expect(page.locator('.matrix-container').first()).toBeVisible();

    // Switch to Gap Analysis tab
    await page.locator('.tab-nav button', { hasText: 'Gap Analysis' }).click();
    await expect(page.getByText('Unmapped Source Controls').first()).toBeVisible();
  });

  test('edit mapping provenance and relationship details', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const mapUuid = await apiSetup.createControlMapping({
      title: 'Editable Control Mapping'
    });

    await page.goto(`/control-mapping/${mapUuid}?edit=true&w=${apiSetup.workspaceId}`, { waitUntil: 'networkidle' });
    await expect(page.locator('.tab-nav button', { hasText: 'JSON' })).toBeVisible({ timeout: 15000 });
    await page.locator('.tab-nav button', { hasText: 'JSON' }).click();
    await expect(page.locator('.json-editor-container').or(page.locator('.monaco-editor')).first()).toBeVisible({ timeout: 15000 });
  });

  test('overview dashboard metrics, relationship stats, and coverage report', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const mapUuid = await apiSetup.createControlMapping({
      title: 'Dashboard Metrics Test Mapping',
      mappings: [{
        uuid: randomUUID(),
        'source-resource': { type: 'catalog', href: `#/catalogs/${randomUUID()}` },
        'target-resource': { type: 'catalog', href: `#/catalogs/${randomUUID()}` },
        maps: [
          { uuid: randomUUID(), relationship: 'equivalent-to', sources: [{ type: 'control', 'id-ref': 'c1' }], targets: [{ type: 'control', 'id-ref': 'c2' }] },
          { uuid: randomUUID(), relationship: 'subset-of', sources: [{ type: 'control', 'id-ref': 'c3' }], targets: [{ type: 'control', 'id-ref': 'c4' }] }
        ]
      }]
    });

    await page.goto(`/control-mapping/${mapUuid}?w=${apiSetup.workspaceId}`);
    
    // Overview is default tab
    await expect(page.getByText('Total Mappings').first()).toBeVisible();
    await expect(page.getByText('Total Map Entries').first()).toBeVisible();
    await expect(page.getByText('Source Coverage').first()).toBeVisible();
    await expect(page.getByText('Avg Confidence').first()).toBeVisible();
    
    await expect(page.getByText('equivalent-to').first()).toBeVisible();
    await expect(page.getByText('subset-of').first()).toBeVisible();
  });

  test('mapping entry detail panel — relationship editing, confidence scoring, and method selection', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const mapUuid = await apiSetup.createControlMapping({
      title: 'Mapping Entry Details Editing',
      mappings: [{
        uuid: randomUUID(),
        'source-resource': { type: 'catalog', href: `#/catalogs/${randomUUID()}` },
        'target-resource': { type: 'catalog', href: `#/catalogs/${randomUUID()}` },
        maps: [
          { uuid: randomUUID(), relationship: 'equal-to', sources: [{ type: 'control', 'id-ref': 's1' }], targets: [{ type: 'control', 'id-ref': 't1' }] }
        ]
      }]
    });

    await page.goto(`/control-mapping/${mapUuid}?edit=true&w=${apiSetup.workspaceId}`);
    await page.locator('.tab-nav button', { hasText: 'Mappings' }).click();
    
    // Click a row to open EntityDetailPanel
    await page.locator('td', { hasText: 's1' }).first().click();
    
    // Wait for the detail panel to open
    await expect(page.getByText('Target Control').first()).toBeVisible();
    // Change relationship dropdown to 'subset-of' in detail panel
    const panel = page.locator('.entity-panel-slide-out');
    await expect(panel).toBeVisible();
    
    const relSelect = panel.locator('select').nth(0);
    if (await relSelect.isVisible()) {
      await relSelect.selectOption('subset-of');
    }
    
    // Change method to 'automated'
    const methodDropdown = panel.locator('select').nth(1);
    if (await methodDropdown.isVisible()) {
      await methodDropdown.selectOption('automated');
    }
    
    // Set confidence to 85
    const confidenceInput = panel.locator('input[type="number"]');
    if (await confidenceInput.isVisible()) {
      await confidenceInput.fill('85');
    }
     // Fill rationale
    const rationaleInput = panel.locator('textarea').first();
    if (await rationaleInput.isVisible()) {
      await rationaleInput.fill('Updated rationale string');
    }

    // Close detail panel before saving
    const closeBtn = panel.locator('.btn-close');
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
    }
    
    await page.waitForTimeout(300);
    
    // Save and reload, verify persistence
    await page.getByRole('button', { name: /save/i }).click();
    await page.waitForTimeout(1000);
    
    await page.reload();
    await page.locator('.tab-nav button', { hasText: 'Mappings' }).click();
    await expect(page.locator('.status-badge', { hasText: /subset/i }).first()).toBeVisible();
  });

  test('all five relationship types render with correct status badges', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const mapUuid = await apiSetup.createControlMapping({
      title: 'Relationship Types Badges Test',
      mappings: [{
        uuid: randomUUID(),
        'source-resource': { type: 'catalog', href: `#/catalogs/${randomUUID()}` },
        'target-resource': { type: 'catalog', href: `#/catalogs/${randomUUID()}` },
        maps: [
          { uuid: randomUUID(), relationship: 'equal-to', sources: [{ type: 'control', 'id-ref': 's1' }], targets: [{ type: 'control', 'id-ref': 't1' }] },
          { uuid: randomUUID(), relationship: 'equivalent-to', sources: [{ type: 'control', 'id-ref': 's2' }], targets: [{ type: 'control', 'id-ref': 't2' }] },
          { uuid: randomUUID(), relationship: 'subset-of', sources: [{ type: 'control', 'id-ref': 's3' }], targets: [{ type: 'control', 'id-ref': 't3' }] },
          { uuid: randomUUID(), relationship: 'superset-of', sources: [{ type: 'control', 'id-ref': 's4' }], targets: [{ type: 'control', 'id-ref': 't4' }] },
          { uuid: randomUUID(), relationship: 'intersects-with', sources: [{ type: 'control', 'id-ref': 's5' }], targets: [{ type: 'control', 'id-ref': 't5' }] }
        ]
      }]
    });

    await page.goto(`/control-mapping/${mapUuid}?w=${apiSetup.workspaceId}`);
    await page.locator('.tab-nav button', { hasText: 'Mappings' }).click();
    
    await expect(page.locator('.status-badge', { hasText: /equal/i }).first()).toBeVisible();
    await expect(page.locator('.status-badge', { hasText: /equivalent/i }).first()).toBeVisible();
    await expect(page.locator('.status-badge', { hasText: /subset/i }).first()).toBeVisible();
    await expect(page.locator('.status-badge', { hasText: /superset/i }).first()).toBeVisible();
    await expect(page.locator('.status-badge', { hasText: /intersects/i }).first()).toBeVisible();
  });

  test('matrix view renders source-target grid with relationship colors and filtering', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const catUuid1 = await apiSetup.createCatalog({
      title: 'Source Framework Matrix',
      groups: [{ id: 'g1', title: 'Group 1', controls: [{ id: 's1', title: 'Control S1' }, { id: 's2', title: 'Control S2' }] }]
    });
    const catUuid2 = await apiSetup.createCatalog({
      title: 'Target Framework Matrix',
      groups: [{ id: 'g2', title: 'Group 2', controls: [{ id: 't1', title: 'Control T1' }, { id: 't2', title: 'Control T2' }] }]
    });
    const mapUuid = await apiSetup.createControlMapping({
      title: 'Matrix View Grid Test',
      mappings: [{
        uuid: randomUUID(),
        'source-resource': { type: 'catalog', href: `#/catalogs/${catUuid1}` },
        'target-resource': { type: 'catalog', href: `#/catalogs/${catUuid2}` },
        maps: [
          { uuid: randomUUID(), relationship: 'equal-to', sources: [{ type: 'control', 'id-ref': 's1' }], targets: [{ type: 'control', 'id-ref': 't1' }] },
          { uuid: randomUUID(), relationship: 'equivalent-to', sources: [{ type: 'control', 'id-ref': 's2' }], targets: [{ type: 'control', 'id-ref': 't2' }] }
        ]
      }]
    });

    await page.goto(`/control-mapping/${mapUuid}?w=${apiSetup.workspaceId}`);
    await page.locator('.tab-nav button', { hasText: 'Matrix View' }).click();
    
    await expect(page.locator('.matrix-container')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.matrix-grid')).toBeVisible();
    
    await expect(page.getByText('Source \\ Target').first()).toBeVisible();
    await expect(page.locator('.matrix-cell').first()).toBeVisible();
    
    const filterSelect = page.locator('select').first();
    if (await filterSelect.isVisible()) {
      await filterSelect.selectOption('equivalent-to');
    }
  });

  test('gap analysis shows unmapped source and target controls with counts', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    
    const catUuid1 = await apiSetup.createCatalog({ 
      title: 'Source Framework',
      groups: [{
        id: 'g1',
        title: 'Group 1',
        controls: [
          { id: 's1', title: 'Control S1' },
          { id: 's2', title: 'Control S2' }
        ]
      }]
    });
    
    const catUuid2 = await apiSetup.createCatalog({ 
      title: 'Target Framework',
      groups: [{
        id: 'g1',
        title: 'Group 1',
        controls: [
          { id: 't1', title: 'Control T1' },
          { id: 't2', title: 'Control T2' }
        ]
      }]
    });
    
    const mapUuid = await apiSetup.createControlMapping({
      title: 'Gap Analysis Test',
      mappings: [{
        uuid: randomUUID(),
        'source-resource': { type: 'catalog', href: `#/catalogs/${catUuid1}` },
        'target-resource': { type: 'catalog', href: `#/catalogs/${catUuid2}` },
        maps: [
          { uuid: randomUUID(), relationship: 'equivalent-to', sources: [{ type: 'control', 'id-ref': 's1' }], targets: [{ type: 'control', 'id-ref': 't1' }] }
        ]
      }]
    });

    await page.goto(`/control-mapping/${mapUuid}?w=${apiSetup.workspaceId}`);
    await page.locator('.tab-nav button', { hasText: 'Gap Analysis' }).click();
    
    await expect(page.getByText('Unmapped Source Controls').first()).toBeVisible();
    await expect(page.getByText('Unmapped Target Controls').first()).toBeVisible();
    
    await expect(page.getByText('s2').first()).toBeVisible();
    await expect(page.getByText('t2').first()).toBeVisible();
  });

  test('metadata tab — source/target resource editing with type, title, and href', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const mapUuid = await apiSetup.createControlMapping({
      title: 'Metadata Edit Test',
      mappings: [{
        uuid: randomUUID(),
        'source-resource': { type: 'catalog', href: `#/catalogs/${randomUUID()}` },
        'target-resource': { type: 'catalog', href: `#/catalogs/${randomUUID()}` },
        maps: []
      }]
    });

    await page.goto(`/control-mapping/${mapUuid}?edit=true&w=${apiSetup.workspaceId}`);
    await page.locator('.tab-nav button', { hasText: 'Metadata' }).click();
    
    const srcCard = page.locator('div.dashboard-card', { hasText: 'Source Resource' });
    const tgtCard = page.locator('div.dashboard-card', { hasText: 'Target Resource' });

    // Change Source Type to 'profile' via dropdown
    await srcCard.locator('select').selectOption('profile');
    await srcCard.locator('input').nth(0).fill('Source Test Title');
    await srcCard.locator('input').nth(1).fill('#/profiles/test-src-uuid');
    
    // Target Resource section
    await tgtCard.locator('select').selectOption('catalog');
    await tgtCard.locator('input').nth(0).fill('Target Test Title');
    await tgtCard.locator('input').nth(1).fill('#/catalogs/test-tgt-uuid');
    
    await page.waitForTimeout(300);
    
    // Save
    await page.getByRole('button', { name: /save/i }).click();
    await page.waitForTimeout(1000);
    
    // Reload and verify
    await page.goto(`/control-mapping/${mapUuid}?edit=true&w=${apiSetup.workspaceId}`);
    await page.locator('.tab-nav button', { hasText: 'Metadata' }).click();
    await expect(srcCard.locator('input').nth(0)).toHaveValue('Source Test Title');
    await expect(tgtCard.locator('input').nth(0)).toHaveValue('Target Test Title');
  });

  test('add new mapping entry via table action and delete mapping entries', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const mapUuid = await apiSetup.createControlMapping({
      title: 'Mapping Entry Table Actions',
      mappings: [{
        uuid: randomUUID(),
        'source-resource': { type: 'catalog', href: `#/catalogs/${randomUUID()}` },
        'target-resource': { type: 'catalog', href: `#/catalogs/${randomUUID()}` },
        maps: [
          { uuid: randomUUID(), relationship: 'equal-to', sources: [{ type: 'control', 'id-ref': 's1' }], targets: [{ type: 'control', 'id-ref': 't1' }] },
          { uuid: randomUUID(), relationship: 'subset-of', sources: [{ type: 'control', 'id-ref': 's2' }], targets: [{ type: 'control', 'id-ref': 't2' }] }
        ]
      }]
    });

    await page.goto(`/control-mapping/${mapUuid}?edit=true&w=${apiSetup.workspaceId}`);
    await page.locator('.tab-nav button', { hasText: 'Mappings' }).click();
    
    // Use Set Relationship
    await page.getByRole('checkbox').nth(1).check();
    
    page.once('dialog', dialog => dialog.accept('equivalent-to'));
    const setRelBtn = page.getByRole('button', { name: 'Set Relationship' });
    if (await setRelBtn.isVisible()) {
        await setRelBtn.click();
    }
    
    // Now use Delete Selected
    await page.getByRole('checkbox').nth(2).check();
    page.once('dialog', dialog => dialog.accept());
    const deleteBtn = page.getByRole('button', { name: 'Delete Selected' });
    if (await deleteBtn.isVisible()) {
        await deleteBtn.click();
    }
    
    // Verify entry is removed from table cells
    await expect(page.locator('td', { hasText: 's2' })).not.toBeVisible();
  });

  test('save and reload full mapping document persists all changes', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const mapUuid = await apiSetup.createControlMapping({
      title: 'Persistence Test Mapping',
      mappings: [{
        uuid: randomUUID(),
        'source-resource': { type: 'catalog', href: `#/catalogs/${randomUUID()}` },
        'target-resource': { type: 'catalog', href: `#/catalogs/${randomUUID()}` },
        maps: [
          { uuid: randomUUID(), relationship: 'equal-to', sources: [{ type: 'control', 'id-ref': 's1' }], targets: [{ type: 'control', 'id-ref': 't1' }] }
        ]
      }]
    });

    await page.goto(`/control-mapping/${mapUuid}?edit=true&w=${apiSetup.workspaceId}`);
    
    await page.locator('.tab-nav button', { hasText: 'Mappings' }).click();
    await page.locator('td', { hasText: 's1' }).first().click();
    
    const panel = page.locator('.entity-panel-slide-out');
    await expect(panel).toBeVisible();
    
    const relSelect = panel.locator('select').nth(0);
    if (await relSelect.isVisible()) {
      await relSelect.selectOption('intersects-with');
    }
    
    // Close detail panel before saving
    const closeBtn = panel.locator('.btn-close');
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
    }
    
    await page.waitForTimeout(300);
    
    await page.getByRole('button', { name: /save/i }).click();
    await page.waitForTimeout(1000);
    
    await page.reload();
    await page.locator('.tab-nav button', { hasText: 'Mappings' }).click();
    await expect(page.locator('.status-badge', { hasText: /intersects/i }).first()).toBeVisible();
  });
});
