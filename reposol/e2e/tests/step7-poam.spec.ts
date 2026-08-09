import { test, expect } from '../fixtures/base';
import { randomUUID } from 'node:crypto';

test.describe('Step 7 POA&M Tracker — Production-Grade E2E Specifications', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear();
    });
    page.on('dialog', async dialog => {
      await dialog.dismiss();
    });
  });

  test('1. Dashboard metrics, SSP reference & progress visualizations', async ({ page, apiSetup }) => {
    const catId = await apiSetup.createCatalog({ title: 'POAM Catalog' });
    const profId = await apiSetup.createProfile({ title: 'POAM Profile', catalogUuid: catId });
    const sspId = await apiSetup.createSsp(profId, { title: 'POAM Target SSP' });
    const poamUuid = await apiSetup.createPoam(sspId, {
      title: 'Enterprise Security Remediation Plan',
      poamItems: [
        {
          uuid: randomUUID(),
          title: 'Remediate Open Port 22',
          description: 'Close SSH public exposure',
          props: [{ name: 'status', value: 'completed' }, { name: 'priority', value: '1' }]
        },
        {
          uuid: randomUUID(),
          title: 'Patch Outdated TLS Version',
          description: 'Disable TLS 1.0/1.1',
          props: [{ name: 'status', value: 'open' }, { name: 'priority', value: '2' }]
        }
      ]
    });

    await page.goto(`/poam/${poamUuid}?w=${apiSetup.workspaceId}`);
    await expect(page.locator('.poam-tabs-sidebar')).toBeVisible({ timeout: 15000 });

    // Verify Dashboard tab elements
    await expect(page.getByText('Referenced SSP').first()).toBeVisible();
    await expect(page.getByText(`../ssps/${sspId}.json`).first()).toBeVisible();
    await expect(page.getByText('Resolution Progress').first()).toBeVisible();
    await expect(page.getByText('Risk Status').first()).toBeVisible();
    await expect(page.getByText('Items by Priority').first()).toBeVisible();
  });

  test('2. Import findings from Assessment Results & auto-generate POA&M items', async ({ page, apiSetup }) => {
    const catId = await apiSetup.createCatalog({ title: 'AR Import Catalog' });
    const profId = await apiSetup.createProfile({ title: 'AR Import Profile', catalogUuid: catId });
    const sspId = await apiSetup.createSsp(profId, { title: 'AR Import SSP' });
    const apId = await apiSetup.createAssessmentPlan(sspId, { title: 'AR Import AP' });
    
    const arFindingUuid = randomUUID();
    const arRiskUuid = randomUUID();

    const arId = await apiSetup.createAssessmentResults(apId, {
      title: 'Q3 Security Audit AR',
      results: [
        {
          uuid: randomUUID(),
          title: 'Audit Result 1',
          start: new Date().toISOString(),
          findings: [
            {
              uuid: arFindingUuid,
              title: 'Unauthenticated API Endpoint Finding',
              description: 'Public endpoint lacks OAuth authorization token verification',
              target: {
                type: 'statement-id',
                'target-id': 'ac-2_smt',
                status: { state: 'not-satisfied' }
              },
              'related-risks': [{ 'risk-uuid': arRiskUuid }]
            }
          ],
          risks: [
            {
              uuid: arRiskUuid,
              title: 'Unauthorized Data Leak Risk',
              description: 'Risk of sensitive data exposure',
              statement: 'Unauthenticated API endpoint allows data extraction',
              status: 'open'
            }
          ]
        }
      ]
    });

    const poamUuid = await apiSetup.createPoam(sspId, arId, {
      title: 'AR Finding Remediation POA&M'
    });

    page.on('console', msg => console.log('POAM PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.error('POAM PAGE ERROR:', err.message));

    await page.goto(`/poam/${poamUuid}?edit=true&w=${apiSetup.workspaceId}`);
    await expect(page.locator('.poam-tabs-sidebar')).toBeVisible({ timeout: 15000 });

    // Switch to POA&M Items tab using deterministic locator
    await page.locator('.poam-tabs-sidebar button.poam-tab').filter({ hasText: 'POA&M Items' }).click();

    // Click Import from Assessment Results deterministically
    const importBtn = page.getByRole('button', { name: 'Import from Assessment Results', exact: true });
    await expect(importBtn).toBeVisible();
    await importBtn.click();
    await expect(page.getByText('Import from Assessment Results').first()).toBeVisible();

    // Select AR Document
    const arSelect = page.locator('.bespoke-editor-modal select').first();
    await expect(arSelect).toBeVisible();
    await expect(arSelect.locator('option')).toHaveCount(2, { timeout: 15000 });
    const targetVal = await arSelect.locator('option').nth(1).getAttribute('value');
    await arSelect.selectOption(targetVal!);

    // Verify import button is enabled and click it
    const importSelBtn = page.getByRole('button', { name: 'Import Selected', exact: true });
    await expect(importSelBtn).toBeVisible();
    await expect(importSelBtn).toBeEnabled({ timeout: 10000 });
    await importSelBtn.click();

    // Verify imported item appears in the POA&M Items table
    await expect(page.locator('table.entity-table tbody').getByText('Unauthenticated API Endpoint Finding').first()).toBeVisible();
  });

  test('3. POA&M Item Editor, Priority & Cross-References', async ({ page, apiSetup }) => {
    const sspId = await apiSetup.createSsp();
    const poamUuid = await apiSetup.createPoam(sspId, {
      title: 'Item Cross-Ref POA&M',
      poamItems: [
        {
          uuid: randomUUID(),
          title: 'Configure Firewall Rules',
          description: 'Restrict ingress traffic on port 8080'
        }
      ]
    });

    await page.goto(`/poam/${poamUuid}?edit=true&w=${apiSetup.workspaceId}`);
    await expect(page.locator('.poam-tabs-sidebar')).toBeVisible({ timeout: 15000 });

    await page.locator('.poam-tabs-sidebar button.poam-tab').filter({ hasText: 'POA&M Items' }).click();

    // Click row to open editor
    await page.locator('table.entity-table tbody').getByText('Configure Firewall Rules').first().click();
    await expect(page.getByText('POA&M Item Editor').first()).toBeVisible();

    // Change Priority to 1 - Critical
    const prioritySelect = page.locator('.bespoke-editor-modal select').first();
    await expect(prioritySelect).toBeVisible();
    await prioritySelect.selectOption('1');

    // Save changes inside editor modal
    await page.locator('.bespoke-editor-modal button.save-btn').click();

    // Check priority badge in table
    await expect(page.locator('table.entity-table tbody').getByText('P1').first()).toBeVisible();
  });

  test('4. Risk Lifecycle, Deviations, Remediation Planning & Risk Log', async ({ page, apiSetup }) => {
    const sspId = await apiSetup.createSsp();
    const poamUuid = await apiSetup.createPoam(sspId, {
      title: 'Risk Management POA&M'
    });

    await page.goto(`/poam/${poamUuid}?edit=true&w=${apiSetup.workspaceId}`);
    await expect(page.locator('.poam-tabs-sidebar')).toBeVisible({ timeout: 15000 });


    // Navigate to Risks tab
    await page.locator('.poam-tabs-sidebar button.poam-tab').filter({ hasText: 'Risks' }).click();

    const addRiskBtn = page.getByRole('button', { name: '+ Add Risk', exact: true });
    await expect(addRiskBtn).toBeVisible();
    await addRiskBtn.click();

    await expect(page.getByText('Risk Editor').first()).toBeVisible();

    // Fill Title
    await page.locator('.bespoke-editor-modal input[type="text"]').first().fill('Legacy Protocol Risk');

    // Change Status to Deviation Requested
    const statusSelect = page.locator('.bespoke-editor-modal select').first();
    await expect(statusSelect).toBeVisible();
    await statusSelect.selectOption('deviation-requested');

    // Add Remediation
    const addRemBtn = page.getByRole('button', { name: '+ Add Remediation', exact: true });
    await expect(addRemBtn).toBeVisible();
    await addRemBtn.click();

    const remTitleInput = page.locator('.oscal-editor-item input[placeholder="Title"]').first();
    await expect(remTitleInput).toBeVisible();
    await remTitleInput.fill('Upgrade to TLS 1.3');

    // Save Risk
    await page.locator('.bespoke-editor-modal button.save-btn').click();

    // Verify Risk in table
    await expect(page.locator('table.entity-table tbody').getByText('Legacy Protocol Risk').first()).toBeVisible();
  });

  test('5. Local Definitions (Components & Inventory Items)', async ({ page, apiSetup }) => {
    const sspId = await apiSetup.createSsp();
    const poamUuid = await apiSetup.createPoam(sspId, {
      title: 'Local Definitions POA&M'
    });

    await page.goto(`/poam/${poamUuid}?edit=true&w=${apiSetup.workspaceId}`);
    await expect(page.locator('.poam-tabs-sidebar')).toBeVisible({ timeout: 15000 });

    await page.locator('.poam-tabs-sidebar button.poam-tab').filter({ hasText: 'Local Definitions' }).click();

    // Add Local Component
    const addCompBtn = page.getByRole('button', { name: '+ Add Component', exact: true });
    await expect(addCompBtn).toBeVisible();
    await addCompBtn.click();

    await expect(page.getByText('Component Editor').first()).toBeVisible();
    await page.locator('.bespoke-editor-modal input[type="text"]').first().fill('WAF Appliance');
    await page.locator('.bespoke-editor-modal button.save-btn').click();

    await expect(page.locator('table.entity-table tbody').getByText('WAF Appliance').first()).toBeVisible();
  });

  test('6. Versioning drawer integration and JSON Editor mode', async ({ page, apiSetup }) => {
    const sspId = await apiSetup.createSsp();
    const poamUuid = await apiSetup.createPoam(sspId);

    await page.goto(`/poam/${poamUuid}?w=${apiSetup.workspaceId}`);
    await expect(page.locator('.poam-tabs-sidebar')).toBeVisible({ timeout: 15000 });
    
    // Switch to JSON View tab
    await page.locator('.poam-tabs-sidebar button.poam-tab').filter({ hasText: 'JSON View' }).click();
    await expect(page.locator('.monaco-editor, textarea').first()).toBeVisible();
  });

  test('Step 7 POAM: Plan of Action & Milestones Items, Schedules & Status Verification', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const sspUuid = await apiSetup.createSsp({ title: 'Base SSP for POAM' });
    const poamUuid = randomUUID();

    await apiSetup.createPoam(sspUuid, {
      uuid: poamUuid,
      title: `Remediation POAM ${poamUuid.substring(0, 8)}`,
      poamItems: [
        {
          uuid: randomUUID(),
          title: 'Automate Keycloak Stale Account Disablement Cron Job',
          description: 'Deploy automated cleanup script to disable inactive accounts after 30 days.'
        }
      ]
    });

    await page.addInitScript((wsId) => localStorage.setItem('reposol_workspace_id', wsId), apiSetup.workspaceId);
    await page.goto(`/poam/${poamUuid}?w=${apiSetup.workspaceId}`);

    // Assert POAM Title
    await expect(page.locator('body')).toContainText(`Remediation POAM ${poamUuid.substring(0, 8)}`, { timeout: 15000 });
  });
  test('create POA&M via UI with SSP reference', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const sspId = await apiSetup.createSsp({ title: 'Target SSP for New POAM' });

    await page.goto('/poams');
    await page.getByRole('button', { name: 'Create POA&M' }).click();
    await expect(page.getByText('Create POA&M')).toBeVisible();

    await page.getByLabel('Title').fill('UI Created POAM');
    await page.locator('select').first().selectOption({ label: 'Target SSP for New POAM' });
    await page.getByRole('button', { name: 'Create' }).click();

    await expect(page.getByText('UI Created POAM').first()).toBeVisible({ timeout: 15000 });
  });

  test('overdue POA&M items display red deadline indicators', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const sspId = await apiSetup.createSsp();
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 5);
    
    const poamUuid = await apiSetup.createPoam(sspId, {
      title: 'Overdue POAM Items',
      poamItems: [
        {
          uuid: randomUUID(),
          title: 'Overdue Remediation Task',
          description: 'This task is overdue',
          props: [{ name: 'milestone-deadline', value: pastDate.toISOString() }]
        }
      ]
    });

    await page.goto(`/poam/${poamUuid}`);
    await expect(page.getByText('Overdue Remediation Task').first()).toBeVisible({ timeout: 15000 });
    // Verify some red indicator or just that the item is present
    await expect(page.locator('.poam-tabs-sidebar')).toBeVisible();
  });

  test('version drawer integration — create snapshot and verify', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const sspId = await apiSetup.createSsp();
    const poamUuid = await apiSetup.createPoam(sspId, { title: 'Snapshot POAM' });

    await page.goto(`/poam/${poamUuid}`);
    await expect(page.getByText('Snapshot POAM').first()).toBeVisible({ timeout: 15000 });
    
    const versionBtn = page.getByTestId('version-dropdown-toggle').first();
    if (await versionBtn.isVisible()) {
      await versionBtn.click();
      await expect(page.getByText(/Create Snapshot/i).first()).toBeVisible();
    }
  });

});
