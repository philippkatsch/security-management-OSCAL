import { test, expect } from '../fixtures/base';
import { randomUUID } from 'node:crypto';

test.describe('Step 6 Assessment Results — Extended Coverage', () => {
  test.setTimeout(90000);

  test('UC-6.3: Result Set Declaration - Create new result set', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const arId = await apiSetup.createAssessmentResults();

    await page.goto(`/assessment-results/${arId}?edit=true&w=${apiSetup.workspaceId}`);
    
    // Go to Result Sets tab
    await page.getByRole('button', { name: /Result Sets/i }).click();

    // Create new result set
    await page.getByRole('button', { name: '+ New' }).click();
    
    // Fill result set details
    await page.getByLabel('Title').fill('New Test Result Set');
    await page.getByLabel('Start').fill('2026-08-13T10:00');
    
    // Save
    await page.getByTestId('save-btn').click();
    await expect(page.getByText('Saved successfully')).toBeVisible();

    // Verify sidebar selection
    await expect(page.getByRole('button', { name: /New Test Result Set/i })).toBeVisible();
  });

  test('UC-6.5: Assessment Log - Add log entry', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const resultSetId = randomUUID();
    const arId = await apiSetup.createAssessmentResults({
      results: [{
        uuid: resultSetId,
        title: 'Result Set 1',
        description: 'Result Set 1 Description',
        start: '2026-08-13T10:00:00Z',
      }]
    });

    await page.goto(`/assessment-results/${arId}?edit=true&w=${apiSetup.workspaceId}`);
    await page.getByRole('button', { name: /Result Sets/i }).click();
    await page.getByRole('button', { name: /Result Set 1/i }).click();
    await page.getByRole('button', { name: /Assessment Log/i }).click();

    await page.getByRole('button', { name: '+ Add Entry' }).click();
    await page.getByLabel('Timestamp').fill('2026-08-13T12:00');
    await page.getByLabel('Title').fill('New Log Entry');
    await page.getByLabel('Description').fill('Test log entry description');
    
    await page.getByTestId('save-btn').click();
    await expect(page.getByText('Saved successfully')).toBeVisible();
    await expect(page.getByText('New Log Entry')).toBeVisible();
  });

  test('UC-6.8: Risk Remediation Planning - Create remediation', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const riskId = randomUUID();
    const arId = await apiSetup.createAssessmentResults({
      results: [{
        title: 'Result Set 1',
        description: 'Result Set 1 Description',
        start: '2026-08-13T10:00:00Z',
        risks: [{
          uuid: riskId,
          title: 'Test Risk',
          description: 'Risk description',
          statement: 'Risk statement description',
          status: 'open'
        }]
      }]
    });

    await page.goto(`/assessment-results/${arId}?edit=true&w=${apiSetup.workspaceId}`);
    await page.getByRole('button', { name: /Result Sets/i }).click();
    await page.getByRole('button', { name: /Result Set 1/i }).click();
    await page.getByRole('button', { name: /Risks/i }).click();

    await page.getByText('Test Risk').click();
    
    await page.getByRole('button', { name: '+ Add Remediation' }).click();
    await page.getByLabel('Title').last().fill('Remediate this risk');
    await page.getByLabel('Lifecycle').selectOption('planned');
    await page.getByLabel('Description').last().fill('Remediation steps');
    
    await page.getByRole('button', { name: '+ Add Asset' }).click();
    await page.getByLabel('Required Assets').last().fill('Asset 1');
    
    await page.getByRole('button', { name: '+ Add Task' }).click();
    await page.getByLabel('Title').last().fill('Task 1');
    await page.getByLabel('Description').last().fill('Task description');
    
    await page.getByRole('button', { name: 'Done' }).click();
    await page.getByTestId('save-btn').click();
    await expect(page.getByText('Saved successfully')).toBeVisible();
  });

  test('UC-6.9: Risk Log & Status Tracking - Add log entries', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const riskId = randomUUID();
    const arId = await apiSetup.createAssessmentResults({
      results: [{
        title: 'Result Set 1',
        description: 'Result Set 1 Description',
        start: '2026-08-13T10:00:00Z',
        risks: [{
          uuid: riskId,
          title: 'Test Risk',
          description: 'Risk description',
          statement: 'Risk statement description',
          status: 'open'
        }]
      }]
    });

    await page.goto(`/assessment-results/${arId}?edit=true&w=${apiSetup.workspaceId}`);
    await page.getByRole('button', { name: /Result Sets/i }).click();
    await page.getByRole('button', { name: /Result Set 1/i }).click();
    await page.getByRole('button', { name: /Risks/i }).click();

    await page.getByText('Test Risk').click();
    
    await page.getByRole('button', { name: '+ Add Log Entry' }).click();
    await page.getByLabel('Title').last().fill('Status update log');
    await page.getByLabel('Status Change').selectOption('investigating');
    await page.getByLabel('Start').last().fill('2026-08-13T12:00');
    await page.getByLabel('Description').last().fill('Changing status to investigating');
    
    await page.getByRole('button', { name: 'Done' }).click();
    await page.getByTestId('save-btn').click();
    await expect(page.getByText('Saved successfully')).toBeVisible();
  });

  test('UC-6.10: Findings & Objective Status - Create finding', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const obsId = randomUUID();
    const riskId = randomUUID();
    const arId = await apiSetup.createAssessmentResults({
      results: [{
        title: 'Result Set 1',
        description: 'Result Set 1 Description',
        start: '2026-08-13T10:00:00Z',
        observations: [{
          uuid: obsId,
          title: 'Obs 1',
          description: 'Observation description',
          methods: ['EXAMINE'],
          collected: '2026-08-13T10:00:00Z'
        }],
        risks: [{
          uuid: riskId,
          title: 'Risk 1',
          description: 'Risk description',
          statement: 'Risk statement description',
          status: 'open'
        }],
        findings: []
      }]
    });

    await page.goto(`/assessment-results/${arId}?edit=true&w=${apiSetup.workspaceId}`);
    await page.getByRole('button', { name: /Result Sets/i }).click();
    await page.getByRole('button', { name: /Result Set 1/i }).click();
    await page.getByRole('button', { name: /Findings/i }).click();

    await page.getByRole('button', { name: '+ Add Finding' }).click();
    
    await page.getByLabel('Title').fill('New Finding');
    await page.getByLabel('Description').fill('Finding description');
    
    await page.getByLabel('Target Type').selectOption('objective-id');
    await page.getByLabel('Target ID').fill('obj-1');
    
    await page.getByLabel('Status State').selectOption('not-satisfied');
    await page.getByLabel('Status Reason').fill('Missing controls');
    
    await page.getByLabel('Related Observations').selectOption(obsId);
    await page.getByLabel('Related Risks').selectOption(riskId);

    await page.getByRole('button', { name: 'Done' }).click();
    await page.getByTestId('save-btn').click();
    await expect(page.getByText('Saved successfully')).toBeVisible();
  });

  test('UC-6.13: AR Table & Navigation - List view, search filter', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    await apiSetup.createAssessmentResults({ title: 'Alpha AR' });
    await apiSetup.createAssessmentResults({ title: 'Beta AR' });

    await page.goto(`/assessment-results?w=${apiSetup.workspaceId}`);
    
    await expect(page.getByText('Alpha AR')).toBeVisible();
    await expect(page.getByText('Beta AR')).toBeVisible();

    await page.getByPlaceholder(/search/i).fill('Alpha');
    await expect(page.getByText('Alpha AR')).toBeVisible();
    await expect(page.getByText('Beta AR')).not.toBeVisible();
  });

  test('UC-6.2 DEEP: AP Import - Verify AP context injection', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const apId = await apiSetup.createAssessmentPlan();
    
    const arId = await apiSetup.createAssessmentResults(apId, {
      title: 'Test AR for AP Context',
    });

    await page.goto(`/assessment-results/${arId}?w=${apiSetup.workspaceId}`);
    
    await page.getByRole('main').getByRole('button', { name: 'Overview' }).click();
    await expect(page.locator('text=' + apId)).toBeVisible();
  });
});
