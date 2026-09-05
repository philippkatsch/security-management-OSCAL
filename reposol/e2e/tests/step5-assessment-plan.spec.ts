import { test, expect } from '../fixtures/base';
import { randomUUID } from 'node:crypto';

async function selectTab(page: any, tabName: string) {
  const tabBtn = page.locator('[class*="document-tabs"] button', { hasText: tabName });
  await expect(tabBtn).toBeVisible({ timeout: 15000 });
  await tabBtn.click();
}

test.describe('Step 5 Assessment Plan — Comprehensive UI Verification (Tiers 1-4)', () => {
  test.setTimeout(90000);

  // =========================================================================
  // TIER 1: FEATURE COVERAGE
  // =========================================================================

  test('Tier 1: AP Document Creation from Document List', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    await apiSetup.createSsp({ systemName: 'Production Target System' });

    await page.goto(`/assessment-plans?w=${apiSetup.workspaceId}`);

    const newBtn = page.getByRole('button', { name: /\+ New Assessment Plan/i }).first();
    await expect(newBtn).toBeVisible({ timeout: 20000 });
    await newBtn.click();

    const titleInput = page.locator('#create-doc-title');
    await expect(titleInput).toBeVisible({ timeout: 10000 });
    await titleInput.fill('E2E Audit Assessment Plan');

    await page.getByRole('button', { name: 'Create Document' }).click();

    await expect(page.getByTestId('mode-edit-btn')).toBeVisible({ timeout: 20000 });
    const planTitleInput = page.getByPlaceholder('e.g. Enterprise Cloud Security Assessment Plan');
    await expect(planTitleInput).toHaveValue('E2E Audit Assessment Plan');

    // F5 Reload Persistence
    await page.reload();
    await expect(page.getByTestId('mode-edit-btn')).toBeVisible({ timeout: 20000 });
    await expect(page.getByPlaceholder('e.g. Enterprise Cloud Security Assessment Plan')).toHaveValue('E2E Audit Assessment Plan');
  });

  test('Tier 1: Tab 1 Overview & Metadata — Title, Version, Roles, Parties, Inline SSP Browser & Summary', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const sspId = await apiSetup.createSsp({
      title: 'Core E-Commerce Platform SSP',
      systemName: 'Core E-Commerce Platform'
    });
    const apId = await apiSetup.createAssessmentPlan({
      title: 'Initial AP Title',
      sspHref: `../system-security-plans/${sspId}.json`
    });

    await page.goto(`/assessment-plans/${apId}?edit=true&w=${apiSetup.workspaceId}`);
    await expect(page.getByTestId('mode-edit-btn')).toBeVisible({ timeout: 20000 });

    // 1. Edit Title and Version
    const titleInput = page.getByPlaceholder('e.g. Enterprise Cloud Security Assessment Plan');
    await titleInput.fill('Updated Audit Scope 2026');
    const versionInput = page.getByPlaceholder('1.0.0');
    await versionInput.fill('1.5.0');

    // 2. Add Roles: preset and custom
    await page.getByRole('button', { name: '+ Lead Assessor' }).click();
    await expect(page.getByText('Lead Assessor', { exact: true })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('(lead-assessor)')).toBeVisible({ timeout: 10000 });

    await page.getByPlaceholder('Role ID (e.g. pen-tester)').fill('security-evaluator');
    await page.getByPlaceholder('Title (e.g. Penetration Tester)').fill('Security Evaluator');
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(page.getByText('Security Evaluator', { exact: true })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('(security-evaluator)')).toBeVisible({ timeout: 10000 });

    // 3. Add Party
    await page.getByPlaceholder('Party Name *').fill('Alice Audit Corp');
    await page.getByPlaceholder('Email Address (optional)').fill('alice@auditcorp.com');
    await page.getByRole('button', { name: 'Add Party' }).click();
    await expect(page.getByText('Alice Audit Corp', { exact: true })).toBeVisible({ timeout: 10000 });

    // 4. Live SSP metadata summary card
    await expect(page.getByText('Resolved Target System Summary')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Core E-Commerce Platform').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Implemented Controls')).toBeVisible();

    // 5. Open SSP Browser modal
    await page.getByRole('button', { name: /Browse Workspace SSPs/i }).click();
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 10000 });
    await expect(modal.getByRole('heading', { name: /Select Target System Security Plan/i })).toBeVisible();
    await expect(modal.getByRole('button', { name: /Workspace SSPs/i })).toBeVisible({ timeout: 10000 });
    await expect(modal.getByRole('button', { name: 'Link Target SSP' })).toBeVisible({ timeout: 10000 });
    await modal.getByRole('button', { name: 'Cancel' }).click();
    await expect(modal).toBeHidden({ timeout: 10000 });

    // 6. Toggle view mode to save draft & reload to verify persistence
    await page.getByTestId('mode-view-btn').click();
    await page.reload();
    await expect(page.getByText('Updated Audit Scope 2026').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Lead Assessor').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Alice Audit Corp', { exact: true })).toBeVisible({ timeout: 15000 });
  });

  test('Tier 1: Tab 2 Reviewed Controls & Scope — Coverage Matrix, Auto-Populate, Search, Statement Tailoring, Objectives', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const sspId = await apiSetup.createSsp({
      systemName: 'Banking Gateway',
      controlImplementation: {
        description: 'Baseline implementation',
        'implemented-requirements': [
          { uuid: randomUUID(), 'control-id': 'ac-1' },
          { uuid: randomUUID(), 'control-id': 'ac-2' },
          { uuid: randomUUID(), 'control-id': 'ia-2' }
        ]
      }
    });
    const apId = await apiSetup.createAssessmentPlan({
      sspHref: `../system-security-plans/${sspId}.json`
    });

    await page.goto(`/assessment-plans/${apId}?edit=true&w=${apiSetup.workspaceId}`);
    await expect(page.getByTestId('mode-edit-btn')).toBeVisible({ timeout: 20000 });

    // Navigate to Reviewed Controls & Scope tab
    await selectTab(page, 'Reviewed Controls & Scope');

    // 1. Verify live scoping summary banner
    await expect(page.getByText('Assessment Scoping & Coverage Matrix')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Candidate Baseline', { exact: true })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('In-Scope Controls', { exact: true })).toBeVisible({ timeout: 10000 });

    // 2. Click Auto-Populate from SSP
    await page.getByRole('button', { name: /Auto-Populate from SSP/i }).click();

    // 3. Filter controls by search input
    const filterInput = page.getByPlaceholder('Filter by ID (ac-2) or title...');
    await filterInput.fill('ac-2');
    await expect(page.getByText('Control AC-2')).toBeVisible({ timeout: 10000 });

    // 4. Statement part tailoring
    const tailorBtn = page.getByRole('button', { name: /Statement Tailoring/i }).first();
    await tailorBtn.click();
    const stmtBtn = page.getByRole('button', { name: /ac-2_smt_a/i });
    await expect(stmtBtn).toBeVisible({ timeout: 10000 });
    await stmtBtn.click();
    await expect(page.getByText('1 statement parts tailored')).toBeVisible({ timeout: 10000 });

    // 5. Control Objective Selections
    await page.getByRole('button', { name: '+ Add Objective Selection' }).click();
    await expect(page.getByText('Objective Selection 1')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Includes all standard control objectives')).toBeVisible({ timeout: 10000 });

    // 6. Save & verify persistence
    await page.getByTestId('mode-view-btn').click();
    await page.reload();
    await selectTab(page, 'Reviewed Controls & Scope');
    await expect(page.getByText('1 statement parts tailored')).toBeVisible({ timeout: 15000 });
  });

  test('Tier 1: Tab 3 Assessment Subjects & Assets — Auto-Populate, Custom Subject, Tools & Platforms', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const sspId = await apiSetup.createSsp({
      systemImplementation: {
        users: [{ uuid: randomUUID(), 'role-ids': ['admin'] }],
        components: [{
          uuid: randomUUID(),
          type: 'software',
          title: 'Payment Processing Microservice',
          description: 'Payment Processing Microservice component description',
          status: { state: 'operational' }
        }]
      }
    });
    const apId = await apiSetup.createAssessmentPlan({
      sspHref: `../system-security-plans/${sspId}.json`
    });

    await page.goto(`/assessment-plans/${apId}?edit=true&w=${apiSetup.workspaceId}`);
    await expect(page.getByTestId('mode-edit-btn')).toBeVisible({ timeout: 20000 });

    // Navigate to Assessment Subjects & Assets tab
    await selectTab(page, 'Assessment Subjects & Assets');

    // 1. Auto-Populate Subjects from SSP
    await page.getByRole('button', { name: /Auto-Populate Subjects from SSP/i }).click();
    await expect(page.getByText('All Target SSP System Components').first()).toBeVisible({ timeout: 15000 });

    // 2. Add custom subject scope
    await page.locator('select').first().selectOption('location');
    await page.getByPlaceholder('e.g. Production Database Cluster Nodes').fill('Frankfurt Datacenter Facility');
    await page.getByRole('button', { name: '+ Add Subject Scope' }).click();
    await expect(page.getByText('Frankfurt Datacenter Facility')).toBeVisible({ timeout: 10000 });

    // 3. Open Subject Details modal
    await page.getByText('Frankfurt Datacenter Facility').click();
    await expect(page.getByRole('heading', { name: /Subject Details/i })).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: 'Close', exact: true }).click();

    // 4. Switch to Assessment Assets & Platforms section
    await page.getByRole('button', { name: /Assessment Assets & Platforms/i }).click();

    // 5. Add Assessment Tool
    await page.getByPlaceholder('Tool Title (e.g. Nessus Scanner)').fill('SonarQube Security Scanner');
    await page.getByPlaceholder('Description / Purpose').fill('Static source code security scanner');
    await page.getByRole('button', { name: '+ Add Tool' }).click();
    await expect(page.getByText('SonarQube Security Scanner')).toBeVisible({ timeout: 10000 });

    // 6. Add Platform and Link Tool
    await page.getByPlaceholder('Platform Title (e.g. Automated Scanning Platform Alpha)').fill('CI/CD Audit Pipeline');
    await page.getByRole('button', { name: '+ Add Platform' }).click();
    await expect(page.getByText('CI/CD Audit Pipeline')).toBeVisible({ timeout: 10000 });

    const linkToolBtn = page.getByRole('button', { name: /SonarQube Security Scanner \+/i });
    await expect(linkToolBtn).toBeVisible({ timeout: 10000 });
    await linkToolBtn.click();
    await expect(page.getByText('SonarQube Security Scanner ✓')).toBeVisible({ timeout: 10000 });

    // 7. Save & verify persistence
    await page.getByTestId('mode-view-btn').click();
    await page.reload();
    await selectTab(page, 'Assessment Subjects & Assets');
    await expect(page.getByText('Frankfurt Datacenter Facility')).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: /Assessment Assets & Platforms/i }).click();
    await expect(page.getByText('CI/CD Audit Pipeline')).toBeVisible({ timeout: 15000 });
  });

  test('Tier 1: Tab 4 Local Definitions & Methods — Objectives with Method Enums, Procedural Activities, Local Components', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const apId = await apiSetup.createAssessmentPlan();

    await page.goto(`/assessment-plans/${apId}?edit=true&w=${apiSetup.workspaceId}`);
    await expect(page.getByTestId('mode-edit-btn')).toBeVisible({ timeout: 20000 });

    // Navigate to Local Definitions & Methods tab
    await selectTab(page, 'Local Definitions & Methods');

    // 1. Objectives & Methods subtab
    await page.getByPlaceholder('ac-2').fill('ac-2');
    await page.locator('select', { hasText: 'EXAMINE' }).first().selectOption('TEST');
    await page.getByPlaceholder('System docs, SIEM logs...').fill('Active Directory audit logs');
    await page.getByPlaceholder('Verify that account management procedures enforce least privilege...').fill('Verify lockout policy after 5 failed login attempts.');
    await page.getByRole('button', { name: '+ Add Objective & Method' }).click();

    await expect(page.getByText('ac-2').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Method: TEST')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Active Directory audit logs')).toBeVisible({ timeout: 10000 });

    // 2. Procedural Activities subtab
    await page.getByRole('button', { name: /Procedural Activities/i }).click();
    await page.getByRole('button', { name: '+ New Activity' }).click();

    const activityModal = page.locator('[role="dialog"]');
    await expect(activityModal).toBeVisible({ timeout: 10000 });
    await activityModal.getByPlaceholder('e.g. Database Authentication & Audit Log Review').fill('Firewall Ruleset Examination');
    await activityModal.locator('select').first().selectOption('EXAMINE');
    await activityModal.getByPlaceholder('Detailed description of the procedural evaluation methodology...').fill('Inspect all perimeter ingress/egress rules.');

    // Append Step 1
    await activityModal.getByPlaceholder('Step Title (optional)').fill('Extract rules');
    await activityModal.getByPlaceholder('Step Description *').fill('Dump active iptables from gateway host.');
    await activityModal.getByRole('button', { name: '+ Append Step' }).click();

    // Append Step 2
    await activityModal.getByPlaceholder('Step Title (optional)').fill('Analyze listeners');
    await activityModal.getByPlaceholder('Step Description *').fill('Check against approved service port matrix.');
    await activityModal.getByRole('button', { name: '+ Append Step' }).click();

    await activityModal.getByRole('button', { name: 'Save Activity' }).click();
    await expect(activityModal).toBeHidden({ timeout: 10000 });

    await expect(page.getByText('Firewall Ruleset Examination')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('2 Steps')).toBeVisible({ timeout: 10000 });

    // 3. Local Components & Users subtab
    await page.getByRole('button', { name: /Local Components & Users/i }).click();
    await page.getByPlaceholder('Component Title').fill('Dedicated Audit Bastion');
    await page.getByRole('button', { name: 'Add Component' }).click();
    await expect(page.getByText('Dedicated Audit Bastion')).toBeVisible({ timeout: 10000 });
  });

  test('Tier 1: Tab 5 Tasks & Timeline — Scheduling Modes, Dependencies, Timeline View', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const apId = await apiSetup.createAssessmentPlan();

    await page.goto(`/assessment-plans/${apId}?edit=true&w=${apiSetup.workspaceId}`);
    await expect(page.getByTestId('mode-edit-btn')).toBeVisible({ timeout: 20000 });

    // Navigate to Tasks & Timeline tab
    await selectTab(page, 'Tasks & Timeline');

    // Task 1: Single Date
    await page.getByRole('button', { name: '+ New Task' }).click();
    let taskModal = page.locator('[role="dialog"]');
    await expect(taskModal).toBeVisible({ timeout: 10000 });
    await taskModal.getByPlaceholder('e.g. Vulnerability Scan & Static Code Analysis').fill('Audit Kickoff Meeting');
    await taskModal.getByRole('button', { name: 'Single Date' }).click();
    await taskModal.locator('input[type="date"]').fill('2026-10-01');
    await taskModal.getByRole('button', { name: 'Save Task' }).click();
    await expect(taskModal).toBeHidden({ timeout: 10000 });

    await expect(page.getByText('Audit Kickoff Meeting')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Date: 2026-10-01')).toBeVisible({ timeout: 10000 });

    // Task 2: Date Range with dependency on Task 1
    await page.getByRole('button', { name: '+ New Task' }).click();
    taskModal = page.locator('[role="dialog"]');
    await expect(taskModal).toBeVisible({ timeout: 10000 });
    await taskModal.getByPlaceholder('e.g. Vulnerability Scan & Static Code Analysis').fill('Technical Pen Test');
    await taskModal.getByRole('button', { name: 'Date Range' }).click();
    const dateInputs = taskModal.locator('input[type="date"]');
    await dateInputs.nth(0).fill('2026-10-02');
    await dateInputs.nth(1).fill('2026-10-05');
    await taskModal.locator('label', { hasText: 'Audit Kickoff Meeting' }).locator('input[type="checkbox"]').check();
    await taskModal.getByRole('button', { name: 'Save Task' }).click();
    await expect(taskModal).toBeHidden({ timeout: 10000 });

    await expect(page.getByText('Technical Pen Test')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Depends on:')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('1 Task', { exact: true })).toBeVisible({ timeout: 10000 });

    // Task 3: Recurring Frequency Milestone
    await page.getByRole('button', { name: '+ New Task' }).click();
    taskModal = page.locator('[role="dialog"]');
    await expect(taskModal).toBeVisible({ timeout: 10000 });
    await taskModal.getByPlaceholder('e.g. Vulnerability Scan & Static Code Analysis').fill('Weekly Assessment Sync');
    await taskModal.locator('select').first().selectOption('milestone');
    await taskModal.getByRole('button', { name: 'Recurring' }).click();
    await taskModal.locator('input[type="number"]').fill('7');
    await taskModal.getByRole('button', { name: 'Save Task' }).click();
    await expect(taskModal).toBeHidden({ timeout: 10000 });

    await expect(page.getByText('Weekly Assessment Sync')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Every 7 days')).toBeVisible({ timeout: 10000 });

    // Gantt Timeline View
    await page.getByRole('button', { name: /Interactive Gantt Timeline/i }).click();
    await expect(page.getByText('Visual Gantt / Timeline Sequence')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Audit Kickoff Meeting').first()).toBeVisible({ timeout: 10000 });

    // Switch back to Cards
    await page.getByRole('button', { name: /Cards \/ List/i }).click();
    await expect(page.getByText('Technical Pen Test')).toBeVisible({ timeout: 10000 });
  });

  test('Tier 1: Tab 6 Terms & Conditions & Attachments — Canonical Terms Parts, Base64 Resource Upload', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const apId = await apiSetup.createAssessmentPlan();

    await page.goto(`/assessment-plans/${apId}?edit=true&w=${apiSetup.workspaceId}`);
    await expect(page.getByTestId('mode-edit-btn')).toBeVisible({ timeout: 20000 });

    // Navigate to Terms & Conditions tab
    await selectTab(page, 'Terms & Conditions');

    // 1. Add canonical part: rules-of-engagement
    await page.getByPlaceholder('Rules of Engagement').fill('Audit Operational Boundaries');
    await page.getByPlaceholder('Enter clause provisions, operational boundaries, or rules...').fill('Testing permitted only between 08:00 and 18:00 CEST.');
    await page.getByRole('button', { name: '+ Add Terms Clause' }).click();

    await expect(page.getByText('rules-of-engagement', { exact: true })).toBeVisible({ timeout: 10000 });
    await expect(page.locator('input[value="Audit Operational Boundaries"]').first()).toBeVisible({ timeout: 10000 });

    // 2. Add canonical part: assessment-exclusions
    await page.locator('select').first().selectOption('assessment-exclusions');
    await page.getByPlaceholder('Assessment Exclusions').fill('Strict Exclusions');
    await page.getByPlaceholder('Enter clause provisions, operational boundaries, or rules...').fill('Denial of service and physical intrusion are prohibited.');
    await page.getByRole('button', { name: '+ Add Terms Clause' }).click();

    await expect(page.getByText('assessment-exclusions', { exact: true })).toBeVisible({ timeout: 10000 });
    await expect(page.locator('input[value="Strict Exclusions"]').first()).toBeVisible({ timeout: 10000 });

    // 3. Switch to Back-Matter Evidence & Attachments section
    await page.getByRole('button', { name: /Back-Matter Evidence & Attachments/i }).click();

    // 4. Upload file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'signed_rules_of_engagement.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 test document content')
    });

    await expect(page.getByText('signed_rules_of_engagement.pdf').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: /Download/i })).toBeVisible({ timeout: 15000 });

    // 5. Save & verify persistence
    await page.getByTestId('mode-view-btn').click();
    await page.reload();
    await selectTab(page, 'Terms & Conditions');
    await expect(page.getByText('Audit Operational Boundaries')).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: /Back-Matter Evidence & Attachments/i }).click();
    await expect(page.getByText('signed_rules_of_engagement.pdf').first()).toBeVisible({ timeout: 15000 });
  });

  // =========================================================================
  // TIER 2: BOUNDARY & CORNER CASES
  // =========================================================================

  test('Tier 2: Task DAG Cycle Detection & Prevention', async ({ page, apiSetup }) => {
    const task1Uuid = randomUUID();
    const task2Uuid = randomUUID();

    await apiSetup.syncWorkspace();
    const apId = await apiSetup.createAssessmentPlan({
      tasks: [
        {
          uuid: task1Uuid,
          title: 'Task Alpha',
          type: 'action',
          dependencies: [{ 'task-uuid': task2Uuid }]
        },
        {
          uuid: task2Uuid,
          title: 'Task Beta',
          type: 'action'
        }
      ]
    });

    await page.goto(`/assessment-plans/${apId}?edit=true&w=${apiSetup.workspaceId}`);
    await expect(page.getByTestId('mode-edit-btn')).toBeVisible({ timeout: 20000 });

    await selectTab(page, 'Tasks & Timeline');
    await expect(page.getByText('Task Alpha')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Task Beta')).toBeVisible({ timeout: 15000 });

    // Open Task Beta editor by clicking title to attempt circular dependency on Task Alpha
    await page.getByText('Task Beta').click();

    const taskModal = page.locator('[role="dialog"]');
    await expect(taskModal).toBeVisible({ timeout: 10000 });

    // Click Task Alpha checkbox under Prerequisite Dependencies (must use .click() since cycle detection prevents check state change)
    await taskModal.locator('label', { hasText: 'Task Alpha' }).locator('input[type="checkbox"]').click();

    // Verify cycle error displayed
    await expect(taskModal.getByText(/Circular dependency detected/i)).toBeVisible({ timeout: 10000 });

    // Close modal without saving
    await taskModal.getByRole('button', { name: 'Cancel' }).click();
    await expect(taskModal).toBeHidden({ timeout: 10000 });
  });

  test('Tier 2: View-Mode vs Edit-Mode Form Interactivity & Disabled Controls', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const apId = await apiSetup.createAssessmentPlan({
      title: 'Mode Toggle Verification Plan'
    });

    // Start in View mode
    await page.goto(`/assessment-plans/${apId}?w=${apiSetup.workspaceId}`);
    await expect(page.getByTestId('mode-view-btn')).toBeVisible({ timeout: 20000 });

    const titleInput = page.getByPlaceholder('e.g. Enterprise Cloud Security Assessment Plan');
    await expect(titleInput).toBeDisabled();

    // Switch to Edit Mode
    await page.getByTestId('mode-edit-btn').click();
    await expect(titleInput).toBeEnabled({ timeout: 10000 });

    // Edit title
    await titleInput.fill('Active Edit Mode Plan');

    // Switch back to View Mode (auto-saves draft)
    await page.getByTestId('mode-view-btn').click();
    await expect(titleInput).toBeDisabled({ timeout: 10000 });

    // Verify title retained
    await expect(titleInput).toHaveValue('Active Edit Mode Plan');
  });

  // =========================================================================
  // TIER 3: CROSS-FEATURE COMBINATIONS
  // =========================================================================

  test('Tier 3: Multi-Tab Navigation State Preservation & In-Memory Draft Integrity', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const apId = await apiSetup.createAssessmentPlan({
      title: 'Initial MultiTab Plan'
    });

    await page.goto(`/assessment-plans/${apId}?edit=true&w=${apiSetup.workspaceId}`);
    await expect(page.getByTestId('mode-edit-btn')).toBeVisible({ timeout: 20000 });

    // 1. Tab 1: Edit Title
    const titleInput = page.getByPlaceholder('e.g. Enterprise Cloud Security Assessment Plan');
    await titleInput.fill('Multi-Tab Persistent Plan');

    // 2. Tab 4: Add Objective
    await selectTab(page, 'Local Definitions & Methods');
    await page.getByPlaceholder('ac-2').fill('cm-2');
    await page.getByPlaceholder('Verify that account management procedures enforce least privilege...').fill('Verify configuration baselines.');
    await page.getByRole('button', { name: '+ Add Objective & Method' }).click();
    await expect(page.getByText('cm-2').first()).toBeVisible({ timeout: 10000 });

    // 3. Tab 6: Add Terms Clause
    await selectTab(page, 'Terms & Conditions');
    await page.getByPlaceholder('Rules of Engagement').fill('Cross-Tab Clause');
    await page.getByPlaceholder('Enter clause provisions, operational boundaries, or rules...').fill('Cross-tab test clause text.');
    await page.getByRole('button', { name: '+ Add Terms Clause' }).click();
    await expect(page.locator('input[value="Cross-Tab Clause"]').first()).toBeVisible({ timeout: 10000 });

    // 4. Return to Tab 1: verify title is intact
    await selectTab(page, 'Overview & Metadata');
    await expect(titleInput).toHaveValue('Multi-Tab Persistent Plan');

    // 5. Return to Tab 4: verify objective is intact
    await selectTab(page, 'Local Definitions & Methods');
    await expect(page.getByText('cm-2').first()).toBeVisible({ timeout: 10000 });

    // 6. Return to Tab 6: verify clause is intact
    await selectTab(page, 'Terms & Conditions');
    await expect(page.locator('input[value="Cross-Tab Clause"]').first()).toBeVisible({ timeout: 10000 });
  });

  test('Tier 3: Undo / Redo State Restoration', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const apId = await apiSetup.createAssessmentPlan({
      title: 'Original Title Before Edit'
    });

    await page.goto(`/assessment-plans/${apId}?edit=true&w=${apiSetup.workspaceId}`);
    await expect(page.getByTestId('mode-edit-btn')).toBeVisible({ timeout: 20000 });

    // Add role to create an undoable action in history
    await page.getByRole('button', { name: '+ Lead Assessor' }).click();
    await expect(page.getByText('Lead Assessor', { exact: true })).toBeVisible({ timeout: 10000 });

    // Press Ctrl+Z to undo
    await page.keyboard.press('Control+z');

    // Verify role was undone
    await expect(page.getByText('Lead Assessor', { exact: true })).toBeHidden({ timeout: 10000 });

    // Press Ctrl+Y to redo
    await page.keyboard.press('Control+y');

    // Verify role was re-applied
    await expect(page.getByText('Lead Assessor', { exact: true })).toBeVisible({ timeout: 10000 });
  });

  test('Tier 3: Version Drawer & Formal Document Version Publishing', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const apId = await apiSetup.createAssessmentPlan({
      title: 'Plan For Version Publishing'
    });

    await page.goto(`/assessment-plans/${apId}?edit=true&w=${apiSetup.workspaceId}`);
    await expect(page.getByTestId('mode-edit-btn')).toBeVisible({ timeout: 20000 });

    // Edit title
    const titleInput = page.getByPlaceholder('e.g. Enterprise Cloud Security Assessment Plan');
    await titleInput.fill('Published Version 2.0.0 Plan');

    // Click Save button in toolbar to open Version Drawer
    await page.getByTestId('save-btn').click();
    const drawer = page.getByTestId('version-drawer');
    await expect(drawer).toBeVisible({ timeout: 10000 });

    // Fill version and remarks
    const verInput = drawer.locator('input[placeholder="e.g. 1.0.1"]');
    await verInput.fill('2.0.0');
    const remarksInput = drawer.locator('input[placeholder="What changed in this version?"]');
    await remarksInput.fill('Major compliance milestone release');

    await drawer.getByRole('button', { name: 'Publish Version' }).click();
    await expect(drawer).toBeHidden({ timeout: 15000 });

    // Reload page and verify published version persists
    await page.reload();
    await expect(page.getByText('Published Version 2.0.0 Plan').first()).toBeVisible({ timeout: 15000 });
  });

  // =========================================================================
  // TIER 4: REAL-WORLD APPLICATION SCENARIOS
  // =========================================================================

  test('Tier 4: Full End-to-End Assessment Plan Workflow & Clean JSON Export', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();

    // 1. Create target SSP
    const sspId = await apiSetup.createSsp({
      title: 'Enterprise Payment Service SSP',
      systemName: 'Enterprise Payment Service',
      controlImplementation: {
        description: 'Baseline implementation',
        'implemented-requirements': [
          { uuid: randomUUID(), 'control-id': 'ac-1' },
          { uuid: randomUUID(), 'control-id': 'ac-2' },
          { uuid: randomUUID(), 'control-id': 'si-2' }
        ]
      },
      systemImplementation: {
        components: [
          {
            uuid: randomUUID(),
            type: 'software',
            title: 'Payment API Gateway',
            description: 'Payment API Gateway core component',
            status: { state: 'operational' }
          }
        ]
      }
    });

    // 2. Create Assessment Plan referencing target SSP
    const apId = await apiSetup.createAssessmentPlan({
      title: 'Annual FedRAMP Security Assessment Plan',
      sspHref: `../system-security-plans/${sspId}.json`
    });

    await page.goto(`/assessment-plans/${apId}?edit=true&w=${apiSetup.workspaceId}`);
    await expect(page.getByTestId('mode-edit-btn')).toBeVisible({ timeout: 20000 });

    // 3. Tab 1: Overview & Metadata configuration
    await page.getByRole('button', { name: '+ Lead Assessor' }).click();
    await expect(page.getByText('Lead Assessor', { exact: true })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Enterprise Payment Service').first()).toBeVisible({ timeout: 15000 });

    // 4. Tab 2: Configure Scoped Controls & Objectives
    await selectTab(page, 'Reviewed Controls & Scope');
    await page.getByRole('button', { name: /Auto-Populate from SSP/i }).click();
    await expect(page.getByText('In-Scope Controls', { exact: true })).toBeVisible({ timeout: 10000 });

    // 5. Tab 3: Configure Assessment Subjects & Tools
    await selectTab(page, 'Assessment Subjects & Assets');
    await page.getByRole('button', { name: /Auto-Populate Subjects from SSP/i }).click();
    await expect(page.getByText('All Target SSP System Components').first()).toBeVisible({ timeout: 15000 });

    await page.getByRole('button', { name: /Assessment Assets & Platforms/i }).click();
    await page.getByPlaceholder('Tool Title (e.g. Nessus Scanner)').fill('OWASP ZAP Scanner');
    await page.getByRole('button', { name: '+ Add Tool' }).click();
    await expect(page.getByText('OWASP ZAP Scanner')).toBeVisible({ timeout: 10000 });

    // 6. Tab 4: Local Objectives & Procedural Activities
    await selectTab(page, 'Local Definitions & Methods');
    await page.getByPlaceholder('ac-2').fill('ac-2');
    await page.locator('select', { hasText: 'EXAMINE' }).first().selectOption('TEST');
    await page.getByPlaceholder('Verify that account management procedures enforce least privilege...').fill('Verify MFA enforcement for all privileged accounts.');
    await page.getByRole('button', { name: '+ Add Objective & Method' }).click();
    await expect(page.getByText('Method: TEST')).toBeVisible({ timeout: 10000 });

    // 7. Tab 5: Schedule Assessment Tasks
    await selectTab(page, 'Tasks & Timeline');
    await page.getByRole('button', { name: '+ New Task' }).click();
    const taskModal = page.locator('[role="dialog"]');
    await expect(taskModal).toBeVisible({ timeout: 10000 });
    await taskModal.getByPlaceholder('e.g. Vulnerability Scan & Static Code Analysis').fill('Dynamic API Penetration Testing');
    await taskModal.getByRole('button', { name: 'Single Date' }).click();
    await taskModal.locator('input[type="date"]').fill('2026-11-01');
    await taskModal.getByRole('button', { name: 'Save Task' }).click();
    await expect(taskModal).toBeHidden({ timeout: 10000 });
    await expect(page.getByText('Dynamic API Penetration Testing')).toBeVisible({ timeout: 10000 });

    // 8. Tab 6: Rules of Engagement
    await selectTab(page, 'Terms & Conditions');
    await page.getByPlaceholder('Rules of Engagement').fill('Rules of Engagement 2026');
    await page.getByPlaceholder('Enter clause provisions, operational boundaries, or rules...').fill('Production tests restricted to off-peak hours.');
    await page.getByRole('button', { name: '+ Add Terms Clause' }).click();
    await expect(page.locator('input[value="Rules of Engagement 2026"]').first()).toBeVisible({ timeout: 10000 });

    // 9. Export document as JSON
    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('export-btn').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename().toLowerCase()).toContain('.json');

    // 10. Backend document verification
    const fetchedDoc = await apiSetup.getDocument('assessment-plan', apId);
    const apData = fetchedDoc['assessment-plan'] || fetchedDoc;
    expect(apData.metadata.title).toBe('Annual FedRAMP Security Assessment Plan');
    expect(apData['import-ssp'].href).toContain(sspId);
  });
});
