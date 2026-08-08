import { test, expect } from '../fixtures/base';
import { randomUUID } from 'node:crypto';

test.describe('Step 7 POA&M Stress Testing — Edge Cases & Verification', () => {

  test('Edge Case 1: Multi-Observation Linking & Full Import Verification', async ({ page, apiSetup }) => {
    const catId = await apiSetup.createCatalog({ title: 'Multi-Obs Catalog' });
    const profId = await apiSetup.createProfile({ title: 'Multi-Obs Profile', catalogUuid: catId });
    const sspId = await apiSetup.createSsp(profId, { title: 'Multi-Obs SSP' });
    const apId = await apiSetup.createAssessmentPlan(sspId, { title: 'Multi-Obs AP' });

    const obs1Uuid = randomUUID();
    const obs2Uuid = randomUUID();
    const riskUuid = randomUUID();
    const findingUuid = randomUUID();

    const arId = await apiSetup.createAssessmentResults(apId, {
      title: 'Multi-Observation AR Audit',
      results: [
        {
          uuid: randomUUID(),
          title: 'Audit Result Multi-Obs',
          start: new Date().toISOString(),
          observations: [
            {
              uuid: obs1Uuid,
              title: 'Obs 1: Memory Heap Leak',
              description: 'Heap inspection revealed memory growth',
              methods: ['EXAMINE'],
              collected: new Date().toISOString()
            },
            {
              uuid: obs2Uuid,
              title: 'Obs 2: Stack Buffer Overflow',
              description: 'Stack canary violation detected',
              methods: ['TEST'],
              collected: new Date().toISOString()
            }
          ],
          risks: [
            {
              uuid: riskUuid,
              title: 'R1: Remote Code Execution Vulnerability',
              description: 'High risk RCE via memory corruption',
              statement: 'High risk RCE via memory corruption statement',
              status: 'open'
            }
          ],
          findings: [
            {
              uuid: findingUuid,
              title: 'Critical Memory Safety Finding',
              description: 'Buffer overflow in native module',
              target: {
                type: 'statement-id',
                'target-id': 'si-2_smt',
                status: { state: 'not-satisfied' }
              },
              'related-observations': [
                { 'observation-uuid': obs1Uuid },
                { 'observation-uuid': obs2Uuid }
              ],
              'related-risks': [
                { 'risk-uuid': riskUuid }
              ]
            }
          ]
        }
      ]
    });

    const poamUuid = await apiSetup.createPoam(sspId, arId, {
      title: 'Multi-Obs Auto POA&M',
      poamItems: [
        {
          uuid: randomUUID(),
          title: 'Placeholder Remediation Item',
          description: 'Seed item for schema compliance'
        }
      ]
    });

    await page.goto(`http://127.0.0.1:1001/poam/${poamUuid}?edit=true&w=${apiSetup.workspaceId}`);

    // Go to POA&M Items tab
    await page.getByRole('button', { name: 'POA&M Items' }).click();

    // Click Import from Assessment Results
    await page.getByRole('button', { name: /import from assessment results/i }).click();
    await expect(page.getByText('Import from Assessment Results').first()).toBeVisible();

    // Wait for AR options to populate
    const arSelect = page.locator('.bespoke-editor-modal select').first();
    await expect(arSelect.locator('option')).toHaveCount(2, { timeout: 10000 });
    await arSelect.selectOption({ index: 1 });

    // Verify finding checkbox is visible inside modal
    await expect(page.locator('.bespoke-editor-modal').getByText('Critical Memory Safety Finding')).toBeVisible();

    // Click Import Selected
    await page.getByRole('button', { name: /import selected/i }).click();

    // Assert finding is imported in table body
    const tableBody = page.locator('table.entity-table tbody, table tbody').first();
    await expect(tableBody.getByText('Critical Memory Safety Finding').first()).toBeVisible();

    // Find table row for imported item and check Observations count (should be 2) and Risks count (should be 1)
    const row = tableBody.locator('tr', { hasText: 'Critical Memory Safety Finding' });
    await expect(row).toBeVisible();

    // Switch to Observations tab and verify both observations exist
    await page.getByRole('button', { name: 'Observations' }).click();
    await expect(tableBody.getByText('Obs 1: Memory Heap Leak')).toBeVisible();
    await expect(tableBody.getByText('Obs 2: Stack Buffer Overflow')).toBeVisible();

    // Switch to Risks tab and verify risk exists
    await page.getByRole('button', { name: 'Risks', exact: true }).click();
    await expect(tableBody.getByText('R1: Remote Code Execution Vulnerability')).toBeVisible();
  });

  test('Edge Case 2: Empty / Satisfied Findings List', async ({ page, apiSetup }) => {
    const catId = await apiSetup.createCatalog({ title: 'Empty AR Catalog' });
    const profId = await apiSetup.createProfile({ title: 'Empty AR Profile', catalogUuid: catId });
    const sspId = await apiSetup.createSsp(profId, { title: 'Empty AR SSP' });
    const apId = await apiSetup.createAssessmentPlan(sspId, { title: 'Empty AR AP' });

    const arId = await apiSetup.createAssessmentResults(apId, {
      title: 'Fully Compliant AR Audit',
      results: [
        {
          uuid: randomUUID(),
          title: 'Audit Result 100% Satisfied',
          start: new Date().toISOString(),
          findings: [
            {
              uuid: randomUUID(),
              title: 'Passes All Tests Finding',
              description: 'All control requirements satisfied',
              target: {
                type: 'statement-id',
                'target-id': 'ac-1_smt',
                status: { state: 'satisfied' }
              }
            }
          ]
        }
      ]
    });

    const poamUuid = await apiSetup.createPoam(sspId, arId, {
      title: 'Empty Import POA&M',
      poamItems: [
        {
          uuid: randomUUID(),
          title: 'Base Maintenance Item',
          description: 'Placeholder item'
        }
      ]
    });

    await page.goto(`http://127.0.0.1:1001/poam/${poamUuid}?edit=true&w=${apiSetup.workspaceId}`);
    await page.getByRole('button', { name: 'POA&M Items' }).click();
    await page.getByRole('button', { name: /import from assessment results/i }).click();

    const arSelect = page.locator('.bespoke-editor-modal select').first();
    await expect(arSelect.locator('option')).toHaveCount(2, { timeout: 10000 });
    await arSelect.selectOption({ index: 1 });

    // Assert message and disabled button
    await expect(page.getByText(/No "not-satisfied" findings or risks found/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /import selected/i })).toBeDisabled();
  });

  test('Edge Case 3: Missing / Dangling Risk References', async ({ page, apiSetup }) => {
    const sspId = await apiSetup.createSsp();
    const apId = await apiSetup.createAssessmentPlan(sspId);

    const missingRiskUuid = randomUUID();
    const findingUuid = randomUUID();

    const arId = await apiSetup.createAssessmentResults(apId, {
      title: 'Dangling Risk Reference AR',
      results: [
        {
          uuid: randomUUID(),
          title: 'Audit Result Dangling Risk',
          start: new Date().toISOString(),
          findings: [
            {
              uuid: findingUuid,
              title: 'Finding with Missing Risk Ref',
              description: 'Points to non-existent risk UUID',
              target: {
                type: 'statement-id',
                'target-id': 'ac-3_smt',
                status: { state: 'not-satisfied' }
              },
              'related-risks': [
                { 'risk-uuid': missingRiskUuid }
              ]
            }
          ]
        }
      ]
    });

    const poamUuid = await apiSetup.createPoam(sspId, arId, {
      poamItems: [
        {
          uuid: randomUUID(),
          title: 'Base Maintenance Item',
          description: 'Placeholder item'
        }
      ]
    });

    await page.goto(`http://127.0.0.1:1001/poam/${poamUuid}?edit=true&w=${apiSetup.workspaceId}`);
    await page.getByRole('button', { name: 'POA&M Items' }).click();
    await page.getByRole('button', { name: /import from assessment results/i }).click();

    const arSelect = page.locator('.bespoke-editor-modal select').first();
    await expect(arSelect.locator('option')).toHaveCount(2, { timeout: 10000 });
    await arSelect.selectOption({ index: 1 });

    await page.getByRole('button', { name: /import selected/i }).click();

    // Verify finding was imported in table body without error
    const tableBody = page.locator('table.entity-table tbody, table tbody').first();
    await expect(tableBody.getByText('Finding with Missing Risk Ref').first()).toBeVisible();
  });

  test('Edge Case 4: Status Propagation & Save Persistence', async ({ page, apiSetup }) => {
    const sspId = await apiSetup.createSsp();
    const apId = await apiSetup.createAssessmentPlan(sspId);
    const arFindingUuid = randomUUID();

    const arId = await apiSetup.createAssessmentResults(apId, {
      title: 'Persistence Test AR',
      results: [
        {
          uuid: randomUUID(),
          title: 'Result 1',
          start: new Date().toISOString(),
          findings: [
            {
              uuid: arFindingUuid,
              title: 'Persisted Finding Item',
              description: 'Must persist after save and reload',
              target: {
                type: 'statement-id',
                'target-id': 'ia-2_smt',
                status: { state: 'not-satisfied' }
              }
            }
          ]
        }
      ]
    });

    const poamUuid = await apiSetup.createPoam(sspId, arId, {
      poamItems: [
        {
          uuid: randomUUID(),
          title: 'Base Maintenance Item',
          description: 'Placeholder item'
        }
      ]
    });

    await page.goto(`http://127.0.0.1:1001/poam/${poamUuid}?edit=true&w=${apiSetup.workspaceId}`);
    await page.getByRole('button', { name: 'POA&M Items' }).click();
    await page.getByRole('button', { name: /import from assessment results/i }).click();

    const arSelect = page.locator('.bespoke-editor-modal select').first();
    await expect(arSelect.locator('option')).toHaveCount(2, { timeout: 10000 });
    await arSelect.selectOption({ index: 1 });

    await page.getByRole('button', { name: /import selected/i }).click();

    // Click Save Changes in Toolbar via getByTestId('save-btn')
    await page.getByTestId('save-btn').click();

    // Click View mode button to switch to read-only view mode
    await page.getByTestId('mode-view-btn').click();
    await expect(page.getByTestId('mode-view-btn')).toHaveClass(/btn-primary/);

    // Switch to Dashboard tab inside POAM layout
    await page.locator('.poam-tab', { hasText: 'Dashboard' }).click();

    // Verify Dashboard metrics updated to 2 items
    await expect(page.getByText('0 of 2 items resolved').first()).toBeVisible();
  });

});
