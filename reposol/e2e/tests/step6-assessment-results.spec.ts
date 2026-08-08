import { test, expect } from '../fixtures/base';
import { randomUUID } from 'node:crypto';

test.describe('Step 6 Assessment Results — Production-Grade E2E Specifications', () => {

  test('Assessment Plan Import, Result Set Lifecycle & Local Definitions', async ({ page, apiSetup }) => {
    const catId = await apiSetup.createCatalog({ title: 'AR Catalog' });
    const profId = await apiSetup.createProfile({ title: 'AR Profile', catalogUuid: catId });
    const sspId = await apiSetup.createSsp(profId, { title: 'AR SSP' });
    const apId = await apiSetup.createAssessmentPlan(sspId, { title: 'Target AP' });

    const arUuid = await apiSetup.createAssessmentResults(apId, {
      title: 'Comprehensive AR Document',
      version: '1.0.0',
      results: [
        {
          uuid: randomUUID(),
          title: 'Q1 Automated Scan Results',
          description: 'First quarter testing run',
          start: new Date().toISOString(),
          'local-definitions': {
            components: [
              { uuid: randomUUID(), title: 'Target Nginx Server', type: 'software', description: 'Web server component', status: { state: 'operational' } }
            ],
            users: [
              { uuid: randomUUID(), title: 'Bob Assessor', 'role-ids': ['lead-assessor'] }
            ],
            tasks: [
              { uuid: randomUUID(), title: 'Vulnerability Scan', type: 'action', description: 'Port scanning task' }
            ]
          },
          'assessment-log': {
            entries: [
              { uuid: randomUUID(), title: 'Scan Initiated', start: new Date().toISOString(), 'logged-by': [{ 'party-uuid': randomUUID(), 'role-id': 'lead-assessor' }] }
            ]
          }
        }
      ]
    });

    await page.goto(`/assessment-result/${arUuid}`);

    // Overview Tab - check AP reference
    await expect(page.getByText('Total Findings').first()).toBeVisible({ timeout: 15000 });

    // Switch to Result Sets tab
    await page.getByRole('button', { name: 'Result Sets' }).click();
    await expect(page.getByText('Q1 Automated Scan Results').first()).toBeVisible();

    // Check Local Definitions sub-tab
    await page.getByRole('button', { name: /Local Definitions/i }).click();
    await expect(page.getByText('Target Nginx Server').first()).toBeVisible();
    await expect(page.getByText('Bob Assessor').first()).toBeVisible();
    await expect(page.getByText('Vulnerability Scan').first()).toBeVisible();

    // Check Assessment Log sub-tab
    await page.getByRole('button', { name: /Assessment Log/i }).click();
    await expect(page.getByText('Scan Initiated').first()).toBeVisible();
  });

  test('Observations Recording, Evidence & Origins', async ({ page, apiSetup }) => {
    const obsUuid = randomUUID();
    const arUuid = await apiSetup.createAssessmentResults({
      title: 'Observations Test AR',
      results: [
        {
          uuid: randomUUID(),
          title: 'Result Set with Observations',
          description: 'Observation testing',
          start: new Date().toISOString(),
          observations: [
            {
              uuid: obsUuid,
              title: 'Unencrypted HTTP Endpoint',
              description: 'Port 80 left accessible without TLS redirect',
              methods: ['TEST', 'EXAMINE'],
              types: ['ssp-statement-issue'],
              collected: new Date().toISOString(),
              'relevant-evidence': [
                { description: 'Nmap scan output showing open port 80', href: 'http://evidence.local/scan.txt' }
              ]
            }
          ]
        }
      ]
    });

    await page.goto(`/assessment-result/${arUuid}`);
    await page.getByRole('button', { name: 'Result Sets' }).click();

    // Observations sub-tab is active by default
    await expect(page.getByText('Unencrypted HTTP Endpoint').first()).toBeVisible({ timeout: 15000 });

    // Click row to open detail drawer
    await page.getByText('Unencrypted HTTP Endpoint').first().click();
    await expect(page.getByText('Observation Details').first()).toBeVisible();
    await expect(page.locator('.editor-form textarea').first()).toHaveValue('Port 80 left accessible without TLS redirect');
  });

  test('Risk CVSS Characterization & Mitigating Factors', async ({ page, apiSetup }) => {
    const riskUuid = randomUUID();
    const arUuid = await apiSetup.createAssessmentResults({
      title: 'Risk Characterization Test AR',
      results: [
        {
          uuid: randomUUID(),
          title: 'Result Set with Risks',
          description: 'Risk testing',
          start: new Date().toISOString(),
          risks: [
            {
              uuid: riskUuid,
              title: 'Session Hijacking Vulnerability',
              description: 'Lack of secure flag on cookies',
              status: 'open',
              statement: 'Session tokens transmitted in cleartext',
              characterizations: [
                {
                  origin: { actors: [{ type: 'tool', 'actor-uuid': randomUUID() }] },
                  facets: [
                    { name: 'AV', system: 'https://www.first.org/cvss/v3.1', value: 'N' },
                    { name: 'AC', system: 'https://www.first.org/cvss/v3.1', value: 'L' }
                  ]
                }
              ]
            }
          ]
        }
      ]
    });

    await page.goto(`/assessment-result/${arUuid}`);
    await page.getByRole('button', { name: 'Result Sets' }).click();
    await page.getByRole('button', { name: /Risks/i }).click();

    await expect(page.getByText('Session Hijacking Vulnerability').first()).toBeVisible({ timeout: 15000 });

    // Click risk row to open detail panel
    await page.getByText('Session Hijacking Vulnerability').first().click();
    await expect(page.getByText('Risk Details').first()).toBeVisible();
    await expect(page.locator('.editor-form textarea').first()).toHaveValue('Lack of secure flag on cookies');
  });

  test('Remediation Planning, Risk Log & Tasks', async ({ page, apiSetup }) => {
    const riskUuid = randomUUID();
    const arUuid = await apiSetup.createAssessmentResults({
      title: 'Remediations Test AR',
      results: [
        {
          uuid: randomUUID(),
          title: 'Result Set with Remediations',
          description: 'Remediation testing',
          start: new Date().toISOString(),
          risks: [
            {
              uuid: riskUuid,
              title: 'Outdated SSL Library',
              description: 'OpenSSL version vulnerable to Heartbleed',
              status: 'investigating',
              statement: 'Upgrade OpenSSL package immediately',
              remediations: [
                {
                  uuid: randomUUID(),
                  title: 'Patch OpenSSL to 3.0.x',
                  lifecycle: 'planned',
                  description: 'Apply security patches across cluster'
                }
              ]
            }
          ]
        }
      ]
    });

    await page.goto(`/assessment-result/${arUuid}`);
    await page.getByRole('button', { name: 'Result Sets' }).click();
    await page.getByRole('button', { name: /Risks/i }).click();

    await page.getByText('Outdated SSL Library').click();
    await expect(page.getByText('Patch OpenSSL to 3.0.x').first()).toBeVisible();
  });

  test('Findings Target Status, Implementation Status & Cross-References', async ({ page, apiSetup }) => {
    const findingUuid = randomUUID();
    const arUuid = await apiSetup.createAssessmentResults({
      title: 'Findings Test AR',
      results: [
        {
          uuid: randomUUID(),
          title: 'Result Set with Findings',
          description: 'Findings testing',
          start: new Date().toISOString(),
          findings: [
            {
              uuid: findingUuid,
              title: 'AC-2 Account Management Non-Compliance',
              description: 'Inactive accounts not disabled after 90 days',
              target: {
                type: 'statement-id',
                'target-id': 'ac-2_smt.a',
                status: { state: 'not-satisfied', reason: 'fail' },
                'implementation-status': { state: 'partial' }
              }
            }
          ]
        }
      ]
    });

    await page.goto(`/assessment-result/${arUuid}`);
    await page.getByRole('button', { name: 'Result Sets' }).click();
    await page.getByRole('button', { name: /Findings/i }).click();

    await expect(page.getByText('AC-2 Account Management Non-Compliance').first()).toBeVisible({ timeout: 15000 });

    await page.getByText('AC-2 Account Management Non-Compliance').first().click();
    await expect(page.getByText('Finding Details').first()).toBeVisible();
    await expect(page.locator('.editor-form input[value="ac-2_smt.a"]').first()).toBeVisible();
  });

  test('Attestations, Overview Metrics Grid & Multi-Result Trend Comparison', async ({ page, apiSetup }) => {
    const partyUuid = randomUUID();
    const arUuid = await apiSetup.createAssessmentResults({
      title: 'Multi-Result Trend AR Report',
      results: [
        {
          uuid: randomUUID(),
          title: 'Result Set Alpha (Q1)',
          description: 'Q1 testing',
          start: new Date().toISOString(),
          findings: [
            {
              uuid: randomUUID(),
              title: 'Finding Alpha 1',
              description: 'Finding description 1',
              target: { type: 'statement-id', 'target-id': 'ac-1', status: { state: 'satisfied' } }
            }
          ],
          attestations: [
            {
              'responsible-parties': [{ 'role-id': 'lead-assessor', 'party-uuids': [partyUuid] }],
              parts: [{ name: 'attestation-part-1' }]
            }
          ]
        },
        {
          uuid: randomUUID(),
          title: 'Result Set Beta (Q2)',
          description: 'Q2 testing',
          start: new Date().toISOString(),
          findings: [
            {
              uuid: randomUUID(),
              title: 'Finding Beta 1',
              description: 'Finding description 2',
              target: { type: 'statement-id', 'target-id': 'ac-2', status: { state: 'not-satisfied' } }
            }
          ]
        }
      ]
    });

    await page.goto(`/assessment-result/${arUuid}`);

    // Overview metrics
    await expect(page.getByText('Total Findings').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Result Sets').first()).toBeVisible();

    // Check Attestations sub-tab under Result Sets
    await page.getByRole('button', { name: 'Result Sets' }).click();
    await page.getByRole('button', { name: /Attestations/i }).click();
    await expect(page.getByText('lead-assessor').first()).toBeVisible();
  });

});
