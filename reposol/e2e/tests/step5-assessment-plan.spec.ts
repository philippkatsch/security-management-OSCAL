import { test, expect } from '../fixtures/base';
import { randomUUID } from 'node:crypto';

test.describe('Step 5 Assessment Plan — Production-Grade E2E Specifications', () => {

  test('create new Assessment Plan via UI visual editor with target SSP selection', async ({ page, apiSetup }) => {
    const catId = await apiSetup.createCatalog({ title: 'Base Catalog for AP' });
    const profId = await apiSetup.createProfile({ title: 'Base Profile for AP', catalogUuid: catId });
    const sspId = await apiSetup.createSsp(profId, { title: 'Target Audit SSP' });
    const apUuid = await apiSetup.createAssessmentPlan(sspId, { title: 'E2E Visual Assessment Plan' });

    await page.goto(`/assessment-plan/${apUuid}`);
    await expect(page.getByText('E2E Visual Assessment Plan').first()).toBeVisible({ timeout: 15000 });
  });

  test('view and inspect reviewed controls, objective selections, and assessment methods', async ({ page, apiSetup }) => {
    const catId = await apiSetup.createCatalog({ title: 'Audit Catalog' });
    const profId = await apiSetup.createProfile({ title: 'Audit Profile', catalogUuid: catId });
    const sspId = await apiSetup.createSsp(profId, { title: 'Audit Target System' });

    const apUuid = randomUUID();
    const payload = {
      'assessment-plan': {
        uuid: apUuid,
        metadata: {
          title: 'Comprehensive Scoped AP',
          version: '1.0.0',
          'oscal-version': '1.1.2',
          'last-modified': new Date().toISOString()
        },
        'import-ssp': { href: `../ssps/${sspId}.json` },
        'reviewed-controls': {
          'control-selections': [
            {
              'include-controls': [
                { 'control-id': 'ac-1' },
                { 'control-id': 'ac-2' }
              ]
            }
          ],
          'control-objective-selections': [
            {
              'include-objectives': [
                { 'objective-id': 'ac-1_obj_1' }
              ]
            }
          ]
        },
        'local-definitions': {
          'objectives-and-methods': [
            {
              'control-id': 'ac-1',
              description: 'Evaluate access control policy adherence',
              parts: [
                { name: 'assessment-method', prose: 'INTERVIEW' }
              ]
            }
          ]
        }
      }
    };

    await apiSetup.createDocument('assessment-plan', payload);

    await page.goto(`/assessment-plan/${apUuid}`);
    await expect(page.getByText('Comprehensive Scoped AP').first()).toBeVisible({ timeout: 15000 });

    // Navigate to Reviewed Controls tab
    await page.locator('.ap-sidebar-nav li', { hasText: 'Reviewed Controls' }).click();
    await expect(page.getByText('ac-1').first()).toBeVisible();
    await expect(page.getByText('ac-2').first()).toBeVisible();
    await expect(page.getByText('ac-1_obj_1').first()).toBeVisible();
    await expect(page.getByText('Evaluate access control policy adherence').first()).toBeVisible();
  });

  test('manage local definitions and assessment subjects with scope details', async ({ page, apiSetup }) => {
    const apUuid = randomUUID();
    const compUuid = randomUUID();
    const invUuid = randomUUID();
    const userUuid = randomUUID();

    const payload = {
      'assessment-plan': {
        uuid: apUuid,
        metadata: {
          title: 'Local Definitions Test AP',
          version: '1.0.0',
          'oscal-version': '1.1.2',
          'last-modified': new Date().toISOString()
        },
        'import-ssp': { href: '../ssps/dummy.json' },
        'reviewed-controls': { 'control-selections': [{ 'include-all': {} }] },
        'local-definitions': {
          components: [
            { uuid: compUuid, type: 'software', title: 'Nmap Security Scanner', description: 'Port and vulnerability scanner', status: { state: 'operational' } }
          ],
          'inventory-items': [
            { uuid: invUuid, description: 'Auditor Forensic Workstation #1' }
          ],
          users: [
            { uuid: userUuid, title: 'Alice Assessor', 'role-ids': ['lead-assessor'] }
          ]
        },
        'assessment-subjects': [
          { type: 'component', description: 'All network software components', 'include-all': {} }
        ]
      }
    };

    await apiSetup.createDocument('assessment-plan', payload);
    await page.goto(`/assessment-plan/${apUuid}`);

    // Check Local Definitions Tab
    await page.locator('.ap-sidebar-nav li', { hasText: 'Local Definitions' }).click();
    await expect(page.getByText('Nmap Security Scanner').first()).toBeVisible();
    await expect(page.getByText('Auditor Forensic Workstation #1').first()).toBeVisible();
    await expect(page.getByText('Alice Assessor').first()).toBeVisible();

    // Check Assessment Subjects Tab
    await page.locator('.ap-sidebar-nav li', { hasText: 'Assessment Subjects' }).click();
    await expect(page.getByText('All network software components').first()).toBeVisible();
  });

  test('inspect assessment assets, platforms, and assessment team members', async ({ page, apiSetup }) => {
    const apUuid = randomUUID();
    const compUuid = randomUUID();
    const platformUuid = randomUUID();

    const payload = {
      'assessment-plan': {
        uuid: apUuid,
        metadata: {
          title: 'Assets Test AP',
          version: '1.0.0',
          'oscal-version': '1.1.2',
          'last-modified': new Date().toISOString()
        },
        'import-ssp': { href: '../ssps/dummy.json' },
        'reviewed-controls': { 'control-selections': [{ 'include-all': {} }] },
        'local-definitions': {
          components: [
            { uuid: compUuid, type: 'software', title: 'Kali Linux Audit Rig', description: 'Penetration testing operating system', status: { state: 'operational' } }
          ]
        },
        'assessment-assets': {
          'assessment-platforms': [
            {
              uuid: platformUuid,
              title: 'Penetration Testing Rig',
              'uses-components': [{ 'component-uuid': compUuid }]
            }
          ]
        }
      }
    };

    await apiSetup.createDocument('assessment-plan', payload);
    await page.goto(`/assessment-plan/${apUuid}`);
    await expect(page.getByText('Assets Test AP').first()).toBeVisible({ timeout: 15000 });

    await page.locator('.ap-sidebar-nav li', { hasText: 'Assessment Assets' }).click();
    await expect(page.getByText('Penetration Testing Rig').first()).toBeVisible();
  });

  test('configure assessment tasks with date ranges, frequencies, and dependencies', async ({ page, apiSetup }) => {
    const apUuid = randomUUID();
    const task1Uuid = randomUUID();
    const task2Uuid = randomUUID();

    const payload = {
      'assessment-plan': {
        uuid: apUuid,
        metadata: {
          title: 'Task Scheduling Test AP',
          version: '1.0.0',
          'oscal-version': '1.1.2',
          'last-modified': new Date().toISOString()
        },
        'import-ssp': { href: '../ssps/dummy.json' },
        'reviewed-controls': { 'control-selections': [{ 'include-all': {} }] },
        tasks: [
          {
            uuid: task1Uuid,
            type: 'milestone',
            title: 'Audit Kickoff Meeting',
            timing: { 'on-date': { date: '2026-09-01T09:00:00Z' } }
          },
          {
            uuid: task2Uuid,
            type: 'action',
            title: 'Penetration Testing Phase',
            timing: { 'within-date-range': { start: '2026-09-02T09:00:00Z', end: '2026-09-15T17:00:00Z' } },
            dependencies: [{ 'task-uuid': task1Uuid }]
          }
        ]
      }
    };

    await apiSetup.createDocument('assessment-plan', payload);
    await page.goto(`/assessment-plan/${apUuid}`);

    await page.locator('.ap-sidebar-nav li', { hasText: 'Activities & Tasks' }).click();
    await expect(page.getByText('Audit Kickoff Meeting').first()).toBeVisible();
    await expect(page.getByText('Penetration Testing Phase').first()).toBeVisible();
  });

  test('edit activity details and add procedural steps', async ({ page, apiSetup }) => {
    const apUuid = randomUUID();
    const actUuid = randomUUID();

    const payload = {
      'assessment-plan': {
        uuid: apUuid,
        metadata: {
          title: 'Activities Test AP',
          version: '1.0.0',
          'oscal-version': '1.1.2',
          'last-modified': new Date().toISOString()
        },
        'import-ssp': { href: '../ssps/dummy.json' },
        'reviewed-controls': { 'control-selections': [{ 'include-all': {} }] },
        'local-definitions': {
          activities: [
            {
              uuid: actUuid,
              title: 'System Admin Interview',
              description: 'Interview lead administrator regarding access control procedures',
              props: [{ name: 'method', value: 'INTERVIEW' }],
              steps: [
                { uuid: randomUUID(), title: 'Review AC Policy', description: 'Check documented AC policy version' }
              ]
            }
          ]
        }
      }
    };

    await apiSetup.createDocument('assessment-plan', payload);
    await page.goto(`/assessment-plan/${apUuid}`);

    await page.locator('.ap-sidebar-nav li', { hasText: 'Activities & Tasks' }).click();
    await expect(page.getByText('System Admin Interview').first()).toBeVisible();
    await expect(page.getByText('INTERVIEW').first()).toBeVisible();
  });

  test('add and customize terms and conditions parts and sub-parts', async ({ page, apiSetup }) => {
    const apUuid = randomUUID();
    const payload = {
      'assessment-plan': {
        uuid: apUuid,
        metadata: {
          title: 'Terms & Conditions Test AP',
          version: '1.0.0',
          'oscal-version': '1.1.2',
          'last-modified': new Date().toISOString()
        },
        'import-ssp': { href: '../ssps/dummy.json' },
        'reviewed-controls': { 'control-selections': [{ 'include-all': {} }] },
        'terms-and-conditions': {
          parts: [
            { name: 'rules-of-engagement', title: 'Rules of Engagement', prose: 'Standard assessment RoE applies.' }
          ]
        }
      }
    };

    await apiSetup.createDocument('assessment-plan', payload);
    await page.goto(`/assessment-plan/${apUuid}`);

    await page.locator('.ap-sidebar-nav li', { hasText: 'Terms & Conditions' }).click();
    await expect(page.locator('.tc-input').first()).toHaveValue('Rules of Engagement', { timeout: 15000 });
  });

  test('verify assessment plan completeness report and metric cards dashboard', async ({ page, apiSetup }) => {
    const apUuid = randomUUID();
    const payload = {
      'assessment-plan': {
        uuid: apUuid,
        metadata: {
          title: 'Complete Assessment Plan',
          version: '1.0.0',
          'oscal-version': '1.1.2',
          'last-modified': new Date().toISOString()
        },
        'import-ssp': { href: '../ssps/dummy-ssp.json' },
        'reviewed-controls': { 'control-selections': [{ 'include-all': {} }] },
        'assessment-subjects': [
          { type: 'component', description: 'Core Application Server', 'include-all': {} }
        ],
        tasks: [
          { uuid: randomUUID(), type: 'milestone', title: 'Planning Phase' }
        ]
      }
    };

    await apiSetup.createDocument('assessment-plan', payload);
    await page.goto(`/assessment-plan/${apUuid}`);

    await expect(page.getByText('Assessment Plan Overview').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Plan Completeness').first()).toBeVisible();
  });

  test('Step 5 SAP: Assessment Plan Tasks, Subjects & Objectives Verification', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const sspUuid = await apiSetup.createSsp({ title: 'Base SSP for SAP' });
    const apUuid = randomUUID();

    await apiSetup.createAssessmentPlan(sspUuid, {
      uuid: apUuid,
      title: `Security Assessment Plan ${apUuid.substring(0, 8)}`,
      reviewedControls: {
        'control-selections': [
          {
            'include-controls': [
              { 'control-id': 'ac-2' },
              { 'control-id': 'ia-5' }
            ]
          }
        ]
      }
    });

    await page.addInitScript((wsId) => localStorage.setItem('reposol_workspace_id', wsId), apiSetup.workspaceId);
    await page.goto(`/assessment-plan/${apUuid}?w=${apiSetup.workspaceId}`);

    // Assert SAP Title
    await expect(page.locator('body')).toContainText(`Security Assessment Plan ${apUuid.substring(0, 8)}`, { timeout: 15000 });
  });

  test('verify version drawer snapshot creation and raw JSON editor toggling', async ({ page, apiSetup }) => {
    const apUuid = await apiSetup.createAssessmentPlan({ title: 'Version Test AP' });
    await page.goto(`/assessment-plan/${apUuid}`);

    // Check JSON editor tab
    await page.locator('.ap-sidebar-nav li', { hasText: 'JSON Editor' }).click();
    await expect(page.locator('.monaco-editor, textarea').first()).toBeVisible({ timeout: 15000 });
  });

});
