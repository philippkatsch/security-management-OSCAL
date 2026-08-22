import { test, expect } from '../fixtures/base';
import { randomUUID } from 'node:crypto';

test.describe('Step 5 Assessment Plan — Deterministic UI Verification', () => {
  test.setTimeout(60000);

  test('UC-5.4 & UC-5.5: Assessment Activities & Procedural Steps', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const apId = await apiSetup.createAssessmentPlan({
      localDefinitions: {
        activities: [
          {
            uuid: randomUUID(),
            title: 'Review Access Control Policy',
            description: 'Review the documented AC policy.',
            props: [{ name: 'method', value: 'EXAMINE' }],
            steps: [{ uuid: randomUUID(), title: 'Check policy approvals', description: 'Ensure signed approvals exist.' }]
          }
        ]
      }
    });

    await page.goto(`/assessment-plans/${apId}?edit=true&w=${apiSetup.workspaceId}`);
    await expect(page.getByTestId('mode-edit-btn')).toBeVisible({ timeout: 20000 });

    // 1. Navigate to Activity Tasks tab
    await page.locator('[class*="document-tabs"] button', { hasText: 'Activity Tasks' }).click();

    // 2. Verify seeded activity is in the table
    await expect(page.getByText('Review Access Control Policy').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('EXAMINE').first()).toBeVisible({ timeout: 15000 });

    // 3. Click activity row to open ActivityEditor slide-out
    await page.locator('table tr', { hasText: 'Review Access Control Policy' }).click();
    const activityPanel = page.locator('.custom-detail-panel, [class*="custom-detail-panel"]');
    await expect(activityPanel).toBeVisible({ timeout: 15000 });

    // 4. Edit Method
    const methodSelect = activityPanel.locator('select').first();
    await methodSelect.selectOption('TEST');

    // 5. Add Step
    await activityPanel.getByRole('button', { name: '+ Add Step' }).click();

    // 6. Close panel via close button, save & toggle view mode to verify persistence
    await activityPanel.locator('button[class*="btn-close"], button:has-text("×")').first().click();
    await expect(activityPanel).toBeHidden({ timeout: 10000 });

    await page.getByTestId('mode-view-btn').click();
    await page.locator('[class*="document-tabs"] button', { hasText: 'Activity Tasks' }).click();
    await expect(page.getByText('Review Access Control Policy').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('TEST').first()).toBeVisible({ timeout: 15000 });
  });

  test('UC-5.6: Reviewed Controls & Selection Rendering', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const apId = await apiSetup.createAssessmentPlan({
      reviewedControls: {
        'control-selections': [
          {
            'include-controls': [{ 'control-id': 'ac-1' }, { 'control-id': 'ac-2' }]
          }
        ]
      }
    });

    await page.goto(`/assessment-plans/${apId}?w=${apiSetup.workspaceId}`);

    // 1. Navigate to Reviewed Controls tab
    await page.locator('[class*="document-tabs"] button', { hasText: 'Reviewed Controls' }).click();

    // 2. Verify controls ac-1 and ac-2 are displayed
    await expect(page.locator('span[class*="control-tag"]', { hasText: 'ac-1' }).first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('span[class*="control-tag"]', { hasText: 'ac-2' }).first()).toBeVisible({ timeout: 15000 });
  });

  test('UC-5.7: Control Objective Selections', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const apId = await apiSetup.createAssessmentPlan({
      reviewedControls: {
        'control-selections': [
          {
            'include-all': {}
          }
        ],
        'control-objective-selections': [
          {
            'include-objectives': [{ 'objective-id': 'ac-1_obj' }, { 'objective-id': 'ac-2_obj' }]
          }
        ]
      }
    });

    await page.goto(`/assessment-plans/${apId}?w=${apiSetup.workspaceId}`);

    // 1. Navigate to Reviewed Controls tab
    await page.locator('[class*="document-tabs"] button', { hasText: 'Reviewed Controls' }).click();

    // 2. Verify control objective tags are displayed
    await expect(page.locator('span[class*="control-tag"]', { hasText: 'ac-1_obj' }).first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('span[class*="control-tag"]', { hasText: 'ac-2_obj' }).first()).toBeVisible({ timeout: 15000 });
  });

  test('UC-5.8: Assessment Subjects & Scope', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const apId = await apiSetup.createAssessmentPlan({
      assessmentSubjects: [
        {
          type: 'component',
          description: 'Web Server Subject Component',
          'include-all': {}
        }
      ]
    });

    await page.goto(`/assessment-plans/${apId}?w=${apiSetup.workspaceId}`);

    // 1. Navigate to Subjects Scope tab
    await page.locator('[class*="document-tabs"] button', { hasText: 'Subjects Scope' }).click();

    // 2. Verify subject is listed with All scope
    await expect(page.getByText('Web Server Subject Component').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('All').first()).toBeVisible({ timeout: 15000 });

    // 3. Click subject row to open EntityDetailPanel
    await page.locator('table tr', { hasText: 'Web Server Subject Component' }).click();
    await expect(page.locator('.entity-panel-slide-out')).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('heading', { name: 'Subject Details' })).toBeVisible({ timeout: 15000 });
  });

  test('UC-5.9: Assessment Assets & Platforms', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const apId = await apiSetup.createAssessmentPlan({
      assessmentAssets: {
        'assessment-platforms': [
          {
            uuid: randomUUID(),
            title: 'AWS Production Cloud',
            'uses-components': [{ 'component-uuid': randomUUID() }]
          }
        ]
      }
    });

    await page.goto(`/assessment-plans/${apId}?w=${apiSetup.workspaceId}`);

    // 1. Navigate to Assessment Assets tab
    await page.locator('[class*="document-tabs"] button', { hasText: 'Assessment Assets' }).click();

    // 2. Verify platform is listed
    await expect(page.getByText('AWS Production Cloud').first()).toBeVisible({ timeout: 15000 });

    // 3. Click platform row to open EntityDetailPanel
    await page.locator('table tr', { hasText: 'AWS Production Cloud' }).click();
    await expect(page.locator('.entity-panel-slide-out')).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('heading', { name: 'Assessment Platform Details' })).toBeVisible({ timeout: 15000 });
  });

  test('UC-5.10: Task Scheduling & Timing Display', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const apId = await apiSetup.createAssessmentPlan({
      tasks: [
        {
          uuid: randomUUID(),
          title: 'Kickoff Audit Meeting',
          type: 'milestone',
          timing: {
            'on-date': {
              date: '2025-06-01T09:00:00Z'
            }
          }
        }
      ]
    });

    await page.goto(`/assessment-plans/${apId}?edit=true&w=${apiSetup.workspaceId}`);
    await expect(page.getByTestId('mode-edit-btn')).toBeVisible({ timeout: 20000 });

    // 1. Navigate to Activity Tasks tab
    await page.locator('[class*="document-tabs"] button', { hasText: 'Activity Tasks' }).click();

    // 2. Verify task title, type, and timing are rendered in table
    await expect(page.getByText('Kickoff Audit Meeting').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('milestone').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('2025-06-01').first()).toBeVisible({ timeout: 15000 });

    // 3. Click task row to open TaskEditor
    await page.locator('table tr', { hasText: 'Kickoff Audit Meeting' }).click();
    const taskPanel = page.locator('.custom-detail-panel, [class*="custom-detail-panel"]');
    await expect(taskPanel).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('heading', { name: 'Task Details' })).toBeVisible({ timeout: 15000 });
  });
});
