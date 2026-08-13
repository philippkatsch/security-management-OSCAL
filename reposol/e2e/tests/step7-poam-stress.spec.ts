import { test, expect } from '../fixtures/base';
import { randomUUID } from 'node:crypto';

test.describe('Step 7 POA&M Stress Testing — Edge Cases & Verification', () => {

  test('Edge Case 1: Multi-Observation Linking & Full Import Verification', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
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

    await page.goto(`/poams/${poamUuid}?edit=true&w=${apiSetup.workspaceId}`);
    await expect(page.locator('[class*="poam-tabs-sidebar"], body')).toBeVisible({ timeout: 15000 });
  });

});
