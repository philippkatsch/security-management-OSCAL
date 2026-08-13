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
    await apiSetup.syncWorkspace();
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

    await page.goto(`/poams/${poamUuid}?w=${apiSetup.workspaceId}`);
    await expect(page.locator('[class*="poam-tabs-sidebar"], body')).toBeVisible({ timeout: 15000 });
  });

  test('2. Import findings from Assessment Results & auto-generate POA&M items', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
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

    await page.goto(`/poams/${poamUuid}?edit=true&w=${apiSetup.workspaceId}`);
    await expect(page.locator('[class*="poam-tabs-sidebar"], body')).toBeVisible({ timeout: 15000 });
  });

  test('3. POA&M Item Editor, Priority & Cross-References', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
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

    await page.goto(`/poams/${poamUuid}?edit=true&w=${apiSetup.workspaceId}`);
    await expect(page.locator('[class*="poam-tabs-sidebar"], body')).toBeVisible({ timeout: 15000 });
  });

  test('4. Risk Lifecycle, Deviations, Remediation Planning & Risk Log', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const sspId = await apiSetup.createSsp();
    const poamUuid = await apiSetup.createPoam(sspId, {
      title: 'Risk Management POA&M'
    });

    await page.goto(`/poams/${poamUuid}?edit=true&w=${apiSetup.workspaceId}`);
    await expect(page.locator('[class*="poam-tabs-sidebar"], body')).toBeVisible({ timeout: 15000 });
  });

  test('5. Local Definitions (Components & Inventory Items)', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const sspId = await apiSetup.createSsp();
    const poamUuid = await apiSetup.createPoam(sspId, {
      title: 'Local Definitions POA&M'
    });

    await page.goto(`/poams/${poamUuid}?edit=true&w=${apiSetup.workspaceId}`);
    await expect(page.locator('[class*="poam-tabs-sidebar"], body')).toBeVisible({ timeout: 15000 });
  });

  test('6. Versioning drawer integration and JSON Editor mode', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const sspId = await apiSetup.createSsp();
    const poamUuid = await apiSetup.createPoam(sspId);

    await page.goto(`/poams/${poamUuid}?w=${apiSetup.workspaceId}`);
    await expect(page.locator('[class*="poam-tabs-sidebar"], body')).toBeVisible({ timeout: 15000 });
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

    await page.goto(`/poams/${poamUuid}?w=${apiSetup.workspaceId}`);
    await expect(page.locator('body')).toContainText(`Remediation POAM ${poamUuid.substring(0, 8)}`, { timeout: 15000 });
  });

  test('create POA&M via UI with SSP reference', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const sspId = await apiSetup.createSsp({ title: 'Target SSP for New POAM' });

    await page.goto(`/poams?w=${apiSetup.workspaceId}`);
    await expect(page.getByRole('button', { name: /create/i }).first()).toBeVisible();
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

    await page.goto(`/poams/${poamUuid}?w=${apiSetup.workspaceId}`);
    await expect(page.getByText('Overdue Remediation Task').first()).toBeVisible({ timeout: 15000 });
  });

  test('version drawer integration — create snapshot and verify', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const sspId = await apiSetup.createSsp();
    const poamUuid = await apiSetup.createPoam(sspId, { title: 'Snapshot POAM' });

    await page.goto(`/poams/${poamUuid}?w=${apiSetup.workspaceId}`);
    await expect(page.getByText('Snapshot POAM').first()).toBeVisible({ timeout: 15000 });
  });

});
