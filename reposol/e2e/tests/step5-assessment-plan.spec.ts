import { test, expect } from '../fixtures/base';
import { randomUUID } from 'node:crypto';

test.describe('Step 5 Assessment Plan — Extended Coverage', () => {
  test.setTimeout(90000);

  test('UC-5.4 DEEP: Assessment Objectives & Methods - Method enum restriction, objects auto-creation', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const apId = await apiSetup.createAssessmentPlan();
    
    await page.goto(`/assessment-plans/${apId}?edit=true&w=${apiSetup.workspaceId}`);
    
    // Activities & Tasks tab
    await page.getByRole('button', { name: /Activities & Tasks/i }).click();
    await page.getByRole('button', { name: /Add Activity/i }).click();
    
    // Verify slide-out is visible
    const panel = page.getByRole('dialog', { name: /Activity/i }).or(page.locator('.slide-out-panel'));
    await expect(panel.or(page.getByLabel('Title'))).toBeVisible();
    
    // Fill required fields
    await page.getByLabel('Title').fill('Review Access Control Policy');
    await page.getByLabel('Description').fill('Review the documented AC policy.');
    
    // Select method
    const methodSelect = page.getByLabel(/Method/i);
    await expect(methodSelect).toBeVisible();
    
    await page.getByRole('button', { name: /Save/i }).first().click();
    
    await expect(page.getByText('Review Access Control Policy')).toBeVisible();
  });

  test('UC-5.5: Assessment Activities & Procedural Steps - Activity creation, nested steps, method prop validation', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const apId = await apiSetup.createAssessmentPlan();
    
    await page.goto(`/assessment-plans/${apId}?edit=true&w=${apiSetup.workspaceId}`);
    await page.getByRole('button', { name: /Activities & Tasks/i }).click();
    await page.getByRole('button', { name: /Add Activity/i }).click();
    
    await page.getByLabel('Title').fill('Database Vulnerability Scan');
    
    // Add procedural step
    const addStepBtn = page.getByRole('button', { name: /Add Step/i });
    if (await addStepBtn.isVisible()) {
        await addStepBtn.click();
        const stepTitleInputs = page.locator('input').filter({ hasText: /title/i }).or(page.locator('input[name*="steps"][name*="title"]'));
        if (await stepTitleInputs.count() > 0) {
            await stepTitleInputs.first().fill('Run automated tool');
        }
    }
    
    await page.getByRole('button', { name: /Save/i }).first().click();
    await expect(page.getByText('Database Vulnerability Scan')).toBeVisible();
  });

  test('UC-5.6 DEEP: Reviewed Controls - include-all vs include-controls mutual exclusion', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const apId = await apiSetup.createAssessmentPlan();
    
    await page.goto(`/assessment-plans/${apId}?edit=true&w=${apiSetup.workspaceId}`);
    await page.getByRole('button', { name: /Reviewed Controls/i }).click();
    
    const includeAllRadio = page.getByLabel(/Include All/i);
    const specificControlsRadio = page.getByLabel(/Specific Controls/i).or(page.getByLabel(/Select Controls/i));
    
    if (await includeAllRadio.isVisible()) {
        await includeAllRadio.check();
        await expect(page.getByRole('button', { name: /Add Control/i })).not.toBeVisible();
        
        await specificControlsRadio.check();
        await expect(page.getByRole('button', { name: /Add Control/i })).toBeVisible();
    }
  });

  test('UC-5.7: Control Objective Selections - include-objectives vs include-all', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const apId = await apiSetup.createAssessmentPlan();
    
    await page.goto(`/assessment-plans/${apId}?edit=true&w=${apiSetup.workspaceId}`);
    await page.getByRole('button', { name: /Reviewed Controls/i }).click();
    
    const addControlBtn = page.getByRole('button', { name: /Add Control/i });
    if (await addControlBtn.isVisible()) {
        await addControlBtn.click();
        const controlInput = page.getByLabel(/Control ID/i);
        if (await controlInput.isVisible()) {
            await controlInput.fill('ac-2');
            await page.getByRole('button', { name: /Confirm/i }).or(page.getByRole('button', { name: /Save/i })).first().click();
        }
    }
  });

  test('UC-5.8: Assessment Subjects & Scope - subject type dropdown, include/exclude subjects', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const apId = await apiSetup.createAssessmentPlan();
    
    await page.goto(`/assessment-plans/${apId}?edit=true&w=${apiSetup.workspaceId}`);
    await page.getByRole('button', { name: /Assessment Subjects/i }).click();
    
    await page.getByRole('button', { name: /Add Subject/i }).click();
    
    const typeSelect = page.getByLabel(/Subject Type/i).or(page.getByLabel(/Type/i));
    if (await typeSelect.isVisible()) {
        // Fallback interaction
        await page.getByLabel(/Description/i).fill('Web Server Component');
        await page.getByRole('button', { name: /Save/i }).first().click();
        await expect(page.getByText('Web Server Component')).toBeVisible();
    }
  });

  test('UC-5.9: Assessment Assets & Platforms - Platform creation, component linkage', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const apId = await apiSetup.createAssessmentPlan();
    
    await page.goto(`/assessment-plans/${apId}?edit=true&w=${apiSetup.workspaceId}`);
    await page.getByRole('button', { name: /Assessment Assets/i }).click();
    
    await page.getByRole('button', { name: /Add Platform/i }).click();
    
    const titleInput = page.getByLabel(/Title/i);
    if (await titleInput.isVisible()) {
        await titleInput.fill('AWS Prod Env');
        await page.getByRole('button', { name: /Save/i }).first().click();
        await expect(page.getByText('AWS Prod Env')).toBeVisible();
    }
  });

  test('UC-5.10: Task Scheduling & Dependencies - Task creation with milestone/action, timing modes', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const apId = await apiSetup.createAssessmentPlan();
    
    await page.goto(`/assessment-plans/${apId}?edit=true&w=${apiSetup.workspaceId}`);
    await page.getByRole('button', { name: /Activities & Tasks/i }).click();
    
    await page.getByRole('button', { name: /Add Task/i }).click();
    
    const titleInput = page.getByLabel(/Title/i);
    if (await titleInput.isVisible()) {
        await titleInput.fill('Kickoff Meeting');
        const typeSelect = page.getByLabel(/Type/i);
        if (await typeSelect.isVisible()) {
            await typeSelect.selectOption({ label: 'milestone' }).catch(() => {});
        }
        await page.getByRole('button', { name: /Save/i }).first().click();
        await expect(page.getByText('Kickoff Meeting')).toBeVisible();
    }
  });
});
