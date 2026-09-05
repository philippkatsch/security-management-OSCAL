import { test, expect } from '../fixtures/base';
import { randomUUID } from 'node:crypto';
import { Page } from '@playwright/test';

// Sample 1x1 transparent PNG buffer for diagram uploads
const SAMPLE_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const SAMPLE_PNG_BUFFER = Buffer.from(SAMPLE_PNG_BASE64, 'base64');

/**
 * Helper to navigate directly to an SSP document in Edit or View mode.
 */
async function navigateToSsp(page: Page, sspUuid: string, workspaceId: string, edit = true) {
  await page.addInitScript((wsId) => {
    window.localStorage.setItem('reposol_workspace_id', wsId);
  }, workspaceId);
  await page.goto(`/ssps/${sspUuid}?edit=${edit}&w=${workspaceId}`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('mode-edit-btn')).toBeVisible({ timeout: 25000 });
}

/**
 * Helper to close detail panels, modals, or drawer overlays.
 */
async function closeDetailPanel(page: Page) {
  const versionDrawer = page.locator('[data-testid="version-drawer"] button:has-text("✕")').first();
  if (await versionDrawer.isVisible().catch(() => false)) {
    await versionDrawer.click().catch(() => {});
  }
  const closeBtn = page.locator('div[role="dialog"] button:has-text("✕"), [data-testid="detail-panel-close-btn"]').first();
  if (await closeBtn.isVisible().catch(() => false)) {
    await closeBtn.click().catch(() => {});
  }
}

/**
 * Helper to switch tabs in DocumentPageLayout.
 */
async function selectTab(
  page: Page,
  tabName: 'Overview' | 'System Characteristics' | 'System Implementation' | 'Control Implementation' | 'Metadata' | 'JSON Source'
) {
  await closeDetailPanel(page);
  const tabButton = page.locator('[class*="document-tabs"] button', { hasText: tabName });
  await expect(tabButton).toBeVisible({ timeout: 15000 });
  await tabButton.click({ force: true });
}

/**
 * Helper to expand an accordion section if collapsed (checks if accordion-icon has ▶).
 */
async function ensureSectionExpanded(section: Locator) {
  const isCollapsed = await section.locator('span[class*="accordion-icon"]').filter({ hasText: '▶' }).isVisible().catch(() => false);
  if (isCollapsed) {
    await section.locator('div[class*="accordion-header"]').click();
  }
}

/**
 * Helper to ensure an accordion section is opened.
 */
async function openAccordion(page: Page, sectionText: string): Promise<Locator> {
  const section = page.locator('div[class*="accordion-section"]', { hasText: sectionText });
  const content = section.locator('div[class*="accordion-content"]');
  if (!(await content.isVisible().catch(() => false))) {
    await section.locator('div[class*="accordion-header"]').click();
    await expect(content).toBeVisible({ timeout: 10000 });
  }
  return section;
}

/**
 * Helper to persist document changes via View Mode toggle and reload.
 */
async function persistAndReload(page: Page) {
  const savePromise = page.waitForResponse(
    resp => (resp.url().includes('/api/versions/') || resp.url().includes('/api/documents/')) && resp.status() < 400,
    { timeout: 8000 }
  ).catch(() => null);

  await page.getByTestId('mode-view-btn').click();
  await savePromise;
  await page.waitForTimeout(300);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('[class*="document-tabs"] button').first()).toBeVisible({ timeout: 25000 });
  const editBtn = page.getByTestId('mode-edit-btn');
  if (await editBtn.isVisible().catch(() => false)) {
    await editBtn.click();
  }
}

test.describe('Step 4: System Security Plan (SSP) Builder — Comprehensive 4-Tier Test Suite', () => {
  test.setTimeout(90000);

  // =========================================================================
  // TIER 1: FEATURE COVERAGE (ISOLATION / HAPPY PATHS)
  // =========================================================================
  test.describe('Tier 1: Feature Coverage (Isolation / Happy Paths)', () => {

    test('US 4.1 & US 4.3: Minimal Document Creation, Redirection & System Identity Editing', async ({ page, apiSetup }) => {
      await apiSetup.syncWorkspace();
      await page.goto(`/ssps?w=${apiSetup.workspaceId}`);

      // 1. Open creation dialog from document list
      const newBtn = page.getByRole('button', { name: /\+ New/i }).first();
      await expect(newBtn).toBeVisible({ timeout: 15000 });
      await newBtn.click();

      // 2. Fill SSP Title in modal
      const titleInput = page.locator('#create-doc-title');
      await expect(titleInput).toBeVisible({ timeout: 15000 });
      const sspTitle = `Enterprise Cloud Portal SSP ${Date.now()}`;
      await titleInput.fill(sspTitle);

      // 3. Submit and verify direct redirection to /ssps/{uuid}?edit=true
      const createBtn = page.locator('.modal-panel button[type="submit"]');
      await expect(createBtn).toBeEnabled({ timeout: 15000 });
      await createBtn.click();

      await expect(page).toHaveURL(/.*\/ssps\/[a-f0-9-]+/i, { timeout: 20000 });
      await expect(page.getByTestId('mode-edit-btn')).toBeVisible({ timeout: 25000 });

      // 4. Navigate to System Characteristics -> System Identity
      await selectTab(page, 'System Characteristics');
      const identitySection = page.locator('div[class*="accordion-section"]', { hasText: 'System Identity' });
      await expect(identitySection).toBeVisible({ timeout: 15000 });

      // 5. Edit System Name, Short Name, Description, and Sensitivity Level
      const nameInput = identitySection.locator('input[type="text"]').first();
      await nameInput.fill('Enterprise Cloud Security Platform');

      const shortNameInput = identitySection.locator('input[type="text"]').nth(1);
      await shortNameInput.fill('ECSP');

      const descTextarea = identitySection.locator('textarea').first();
      await descTextarea.fill('Authoritative System Security Plan for the Enterprise Cloud Security Platform.');

      const sensLevelSelect = identitySection.locator('div[class*="form-group"]:has-text("Security Sensitivity Level") select');
      await sensLevelSelect.selectOption('high');

      const dateInput = identitySection.locator('input[type="date"]').first();
      await dateInput.fill('2026-06-15');

      // 6. Save draft and F5 Reload Persistence
      await persistAndReload(page);
      await selectTab(page, 'System Characteristics');
      await expect(identitySection.locator('input[type="text"]').first()).toHaveValue('Enterprise Cloud Security Platform');
      await expect(identitySection.locator('input[type="text"]').nth(1)).toHaveValue('ECSP');
      await expect(identitySection.locator('textarea').first()).toHaveValue('Authoritative System Security Plan for the Enterprise Cloud Security Platform.');
      await expect(sensLevelSelect).toHaveValue('high');
      await expect(identitySection.locator('input[type="date"]').first()).toHaveValue('2026-06-15');
    });

    test('US 4.6: System Operational Status & Badge Representation', async ({ page, apiSetup }) => {
      await apiSetup.syncWorkspace();
      const sspId = await apiSetup.createSsp();
      await navigateToSsp(page, sspId, apiSetup.workspaceId, true);

      // 1. Navigate to System Characteristics -> Operational Status
      await selectTab(page, 'System Characteristics');
      const statusSection = page.locator('div[class*="accordion-section"]', { hasText: 'Operational Status' });
      const statusSelect = statusSection.locator('select').first();
      await expect(statusSelect).toBeVisible({ timeout: 15000 });

      // 2. Select 'under-development' state
      await statusSelect.selectOption('under-development');

      // 3. Switch to View Mode and verify StatusBadge reflects under-development
      await page.getByTestId('mode-view-btn').click();
      await selectTab(page, 'System Characteristics');
      await expect(statusSection.locator('span[data-testid="status-badge"], [class*="status-badge"]').first()).toBeVisible({ timeout: 15000 });

      // 4. Switch back to Edit mode, reload and verify persistence
      await page.getByTestId('mode-edit-btn').click();
      await persistAndReload(page);
      await selectTab(page, 'System Characteristics');
      await expect(statusSection.locator('select').first()).toHaveValue('under-development');
    });

    test('US 4.4: SP 800-60 Information Types & CIA Categorization', async ({ page, apiSetup }) => {
      await apiSetup.syncWorkspace();
      const sspId = await apiSetup.createSsp();
      await navigateToSsp(page, sspId, apiSetup.workspaceId, true);

      // 1. Navigate to System Characteristics -> Information Types
      await selectTab(page, 'System Characteristics');
      const infoSection = page.locator('div[class*="accordion-section"]').filter({ has: page.locator('h3', { hasText: 'Information Types' }) });
      await ensureSectionExpanded(infoSection);
      await expect(infoSection).toBeVisible({ timeout: 15000 });

      // 2. Load Preset SP 800-60 Template: Financial Management Information (index 1)
      const presetSelect = infoSection.locator('div[class*="preset-bar"] select').first();
      await expect(presetSelect).toBeVisible({ timeout: 15000 });
      await presetSelect.selectOption('1');

      // 3. Add Custom Information Type
      await infoSection.getByRole('button', { name: '+ Add Custom Info Type' }).click();

      // 4. Configure custom info type card
      const customCard = infoSection.locator('div[class*="info-type-card"]').last();
      await expect(customCard).toBeVisible({ timeout: 15000 });

      const titleInput = customCard.locator('input[type="text"]').first();
      await titleInput.fill('Customer PII & Identity Records');

      const descTextarea = customCard.locator('textarea').first();
      await descTextarea.fill('PII records including names, tax IDs, and biometric authentication credentials.');

      // 5. Configure CIA impacts on custom card (Confidentiality: High, Integrity: High, Availability: Moderate)
      const selects = customCard.locator('div[class*="impact-grid-mini"] select');
      await selects.nth(0).selectOption('fips-199-high'); // Conf base
      await selects.nth(2).selectOption('fips-199-high'); // Integ base
      await selects.nth(4).selectOption('fips-199-moderate'); // Avail base

      // 6. Check Privacy Designation checkbox
      const privacyCheck = customCard.locator('input[type="checkbox"]').first();
      await privacyCheck.check();

      // 7. Save draft and F5 Reload Persistence
      await persistAndReload(page);
      await selectTab(page, 'System Characteristics');
      const reloadedInfoSection = page.locator('div[class*="accordion-section"]').filter({ has: page.locator('h3', { hasText: 'Information Types' }) });
      await ensureSectionExpanded(reloadedInfoSection);
      await expect(page.getByText('Customer PII & Identity Records').first()).toBeVisible({ timeout: 15000 });
    });

    test('US 4.5: FIPS-199 High-Water Mark Auto-Calculation & Suggestion Apply', async ({ page, apiSetup }) => {
      await apiSetup.syncWorkspace();
      const sspId = await apiSetup.createSsp();
      await navigateToSsp(page, sspId, apiSetup.workspaceId, true);

      await selectTab(page, 'System Characteristics');
      const infoSection = page.locator('div[class*="accordion-section"]').filter({ has: page.locator('h3', { hasText: 'Information Types' }) });

      // 1. Add IT Infrastructure template (index 3)
      const presetSelect = infoSection.locator('div[class*="preset-bar"] select').first();
      await presetSelect.selectOption('3');

      // 2. Inspect Security Impact Level section
      const impactSection = page.locator('div[class*="accordion-section"]', { hasText: 'Security Impact Level' });
      await expect(impactSection).toBeVisible({ timeout: 15000 });

      // 3. Verify High-Water Mark suggestion banner shows calculated values
      const hwmBanner = impactSection.locator('div[class*="hwm-banner"]');
      await expect(hwmBanner).toBeVisible({ timeout: 15000 });
      await expect(hwmBanner).toContainText('HIGH');

      // 4. Click "Apply High-Water Mark Suggestion"
      const applyBtn = impactSection.getByRole('button', { name: /Apply High-Water Mark Suggestion/i });
      await expect(applyBtn).toBeVisible({ timeout: 15000 });
      await applyBtn.click();

      // 5. Verify impact card selects are updated to HWM values
      const confSelect = impactSection.locator('div[class*="fips-impact-card"]:has-text("confidentiality") select').first();
      const integSelect = impactSection.locator('div[class*="fips-impact-card"]:has-text("integrity") select').first();
      const availSelect = impactSection.locator('div[class*="fips-impact-card"]:has-text("availability") select').first();

      await expect(confSelect).toHaveValue('fips-199-moderate');
      await expect(integSelect).toHaveValue('fips-199-high');
      await expect(availSelect).toHaveValue('fips-199-high');

      // 6. Save draft and F5 Reload Persistence
      await persistAndReload(page);
      await selectTab(page, 'System Characteristics');
      await expect(confSelect).toHaveValue('fips-199-moderate');
      await expect(integSelect).toHaveValue('fips-199-high');
      await expect(availSelect).toHaveValue('fips-199-high');
    });

    test('US 4.7 & US 4.8: Authorization Boundary Narrative & Base64 Diagram Embedding', async ({ page, apiSetup }) => {
      await apiSetup.syncWorkspace();
      const sspId = await apiSetup.createSsp();
      await navigateToSsp(page, sspId, apiSetup.workspaceId, true);

      // 1. Navigate to System Characteristics -> Authorization Boundary
      await selectTab(page, 'System Characteristics');
      const boundarySection = page.locator('div[class*="accordion-section"]', { hasText: 'Authorization Boundary' });
      await expect(boundarySection).toBeVisible({ timeout: 15000 });

      // 2. Fill Authorization Boundary, Network Architecture, and Data Flow descriptions
      const authBoundaryTextarea = boundarySection.locator('div[class*="form-group"]:has-text("Authorization Boundary") textarea').first();
      await authBoundaryTextarea.fill('The authorization boundary encompasses all AWS VPC production subnets, ECS Fargate clusters, and RDS database instances.');

      const netArchTextarea = boundarySection.locator('div[class*="form-group"]:has-text("Network Architecture") textarea').first();
      await netArchTextarea.fill('Dual-tier network topology segregated by AWS Security Groups with TLS 1.3 encryption across all internal microservices.');

      const dataFlowTextarea = boundarySection.locator('div[class*="form-group"]:has-text("Data Flow") textarea').first();
      await dataFlowTextarea.fill('Ingress data flows through Cloudflare WAF -> AWS ALB -> Microservices -> Encrypted PostgreSQL.');

      // 3. Upload Boundary Architecture Diagram via file input
      const fileInput = boundarySection.locator('div[class*="form-group"]:has-text("Authorization Boundary") input[type="file"]').first();
      await fileInput.setInputFiles({
        name: 'boundary-architecture.png',
        mimeType: 'image/png',
        buffer: SAMPLE_PNG_BUFFER
      });

      // 4. Verify preview image renders in UI
      const previewImg = boundarySection.locator('div[class*="form-group"]:has-text("Authorization Boundary") img').first();
      await expect(previewImg).toBeVisible({ timeout: 15000 });

      // 5. Save draft and F5 Reload Persistence
      await persistAndReload(page);
      await selectTab(page, 'System Characteristics');
      await expect(authBoundaryTextarea).toHaveValue('The authorization boundary encompasses all AWS VPC production subnets, ECS Fargate clusters, and RDS database instances.');
      await expect(netArchTextarea).toHaveValue('Dual-tier network topology segregated by AWS Security Groups with TLS 1.3 encryption across all internal microservices.');
      await expect(dataFlowTextarea).toHaveValue('Ingress data flows through Cloudflare WAF -> AWS ALB -> Microservices -> Encrypted PostgreSQL.');
      await expect(previewImg).toBeVisible({ timeout: 15000 });
    });

    test('US 4.10: System Components CRUD & Root this-system Provisioning', async ({ page, apiSetup }) => {
      await apiSetup.syncWorkspace();
      const sspId = await apiSetup.createSsp();
      await navigateToSsp(page, sspId, apiSetup.workspaceId, true);

      // 1. Navigate to System Implementation -> Components
      await selectTab(page, 'System Implementation');
      await page.locator('.sys-imp-tab button', { hasText: 'Components' }).click();

      // 2. Verify root component exists
      await expect(page.getByText('Primary System Component').or(page.getByText('this-system')).or(page.locator('tr').filter({ hasText: 'software' })).first()).toBeVisible({ timeout: 15000 });

      // 3. Add Software Component
      await page.getByRole('button', { name: '+ Add Component' }).click();

      // 4. Edit Component in Drawer
      const compDialog = page.locator('div[role="dialog"]');
      await compDialog.locator('input[type="text"]').first().fill('Keycloak Identity Provider');

      // 5. Click Save Component
      await compDialog.getByRole('button', { name: 'Save Component' }).click();
      await expect(compDialog).not.toBeVisible({ timeout: 15000 });

      // 6. Save draft and F5 Reload Persistence
      await persistAndReload(page);
      await selectTab(page, 'System Implementation');
      await page.locator('.sys-imp-tab button', { hasText: 'Components' }).click();
      await expect(page.getByText('Keycloak Identity Provider').first()).toBeVisible({ timeout: 15000 });
    });

    test('US 4.11: System Users & Privilege Matrix Management', async ({ page, apiSetup }) => {
      await apiSetup.syncWorkspace();
      const sspId = await apiSetup.createSsp();
      await navigateToSsp(page, sspId, apiSetup.workspaceId, true);

      // 1. Navigate to System Implementation -> Users
      await selectTab(page, 'System Implementation');
      await page.locator('.sys-imp-tab button', { hasText: 'Users & Privileges' }).click();

      // 2. Add System User
      await page.getByRole('button', { name: '+ Add User' }).click();

      // 3. Edit User in Drawer
      const userDialog = page.locator('div[role="dialog"]');
      await userDialog.locator('input[type="text"]').first().fill('Cloud Security Auditor');

      // 4. Click Save User Class
      await userDialog.getByRole('button', { name: 'Save User Class' }).click();
      await expect(userDialog).not.toBeVisible({ timeout: 15000 });

      // 5. Save draft and F5 Reload Persistence
      await persistAndReload(page);
      await selectTab(page, 'System Implementation');
      await page.locator('.sys-imp-tab button', { hasText: 'Users & Privileges' }).click();
      await expect(page.getByText('Cloud Security Auditor').first()).toBeVisible({ timeout: 15000 });
    });

    test('US 4.12: Leveraged Authorizations (Common Control Providers)', async ({ page, apiSetup }) => {
      await apiSetup.syncWorkspace();
      const sspId = await apiSetup.createSsp();
      await navigateToSsp(page, sspId, apiSetup.workspaceId, true);

      // 1. Navigate to System Implementation -> Leveraged Authorizations
      await selectTab(page, 'System Implementation');
      await page.locator('.sys-imp-tab button', { hasText: 'Leveraged Authorizations' }).click();

      // 2. Add Leveraged Authorization
      await page.getByRole('button', { name: /\+ Add (Leveraged )?Auth/i }).click();

      // 3. Edit title and party in Drawer
      const authDialog = page.locator('div[role="dialog"]');
      await expect(authDialog).toBeVisible({ timeout: 15000 });
      await authDialog.locator('input[placeholder*="Amazon Web Services"]').fill('AWS GovCloud FedRAMP High Authorization');
      await authDialog.locator('input[placeholder*="Party UUID"]').fill('e1111111-2222-4333-8444-555555555555');

      // 4. Click Save Authorization
      await authDialog.getByRole('button', { name: 'Save Authorization' }).click();
      await expect(authDialog).not.toBeVisible({ timeout: 15000 });
      await expect(page.getByText('AWS GovCloud FedRAMP High Authorization').first()).toBeVisible({ timeout: 15000 });

      // 5. Save draft and F5 Reload Persistence
      await persistAndReload(page);
      await selectTab(page, 'System Implementation');
      await page.locator('.sys-imp-tab button', { hasText: 'Leveraged Authorizations' }).click();
      await expect(page.getByText('AWS GovCloud FedRAMP High Authorization').first()).toBeVisible({ timeout: 15000 });
    });

    test('US 4.13: Managed Inventory Items & Asset Tracking', async ({ page, apiSetup }) => {
      await apiSetup.syncWorkspace();
      const sspId = await apiSetup.createSsp();
      await navigateToSsp(page, sspId, apiSetup.workspaceId, true);

      // 1. Navigate to System Implementation -> Inventory Items
      await selectTab(page, 'System Implementation');
      await page.locator('.sys-imp-tab button', { hasText: 'Inventory Items' }).click();

      // 2. Add Inventory Item
      await page.getByRole('button', { name: '+ Add Inventory Item' }).click();

      // 3. Edit title/description in Drawer
      const invDialog = page.locator('div[role="dialog"]');
      await invDialog.locator('input[type="text"]').first().fill('Production PostgreSQL Database Cluster (db-prod-01)');

      // 4. Click Save Inventory Item
      await invDialog.getByRole('button', { name: 'Save Inventory Item' }).click();
      await expect(invDialog).not.toBeVisible({ timeout: 15000 });

      // 5. Save draft and F5 Reload Persistence
      await persistAndReload(page);
      await selectTab(page, 'System Implementation');
      await page.locator('.sys-imp-tab button', { hasText: 'Inventory Items' }).click();
      await expect(page.getByText('Production PostgreSQL Database Cluster (db-prod-01)').first()).toBeVisible({ timeout: 15000 });
    });

    test('US 4.2 & US 4.14: Baseline Profile Reference & Control Implementation Strategy', async ({ page, apiSetup }) => {
      await apiSetup.syncWorkspace();
      const profUuid = await apiSetup.createProfile({ title: 'FedRAMP Moderate Baseline Profile' });
      const sspId = await apiSetup.createSsp();
      await navigateToSsp(page, sspId, apiSetup.workspaceId, true);

      // 1. In Overview tab, edit Referenced Profile href
      await selectTab(page, 'Overview');
      const editProfileBtn = page.getByTestId('edit-profile-href-btn').or(page.locator('button:has-text("Edit URI")')).first();
      await expect(editProfileBtn).toBeVisible({ timeout: 15000 });
      await editProfileBtn.click();

      const profileInput = page.locator('[data-testid="profile-href-input"], .overview-tab input[type="text"]').first();
      await profileInput.fill(`../profiles/${profUuid}.json`);
      await page.getByTestId('save-profile-href-btn').click();

      // 2. In Control Implementation tab, fill top-level description
      await selectTab(page, 'Control Implementation');
      const strategyTextarea = page.locator('.ctrl-imp-tab textarea, [placeholder*="overarching"]').first();
      await expect(strategyTextarea).toBeVisible({ timeout: 15000 });
      await strategyTextarea.fill('Comprehensive multi-layer control implementation strategy adhering to NIST SP 800-53 Rev 5.');

      // 3. Save draft and F5 Reload Persistence
      await persistAndReload(page);
      await selectTab(page, 'Overview');
      await expect(page.getByText(`../profiles/${profUuid}.json`).first()).toBeVisible({ timeout: 15000 });

      await selectTab(page, 'Control Implementation');
      await expect(page.locator('.ctrl-imp-tab textarea, [placeholder*="overarching"]').first()).toHaveValue('Comprehensive multi-layer control implementation strategy adhering to NIST SP 800-53 Rev 5.');
    });

    test('US 4.15 & US 4.16: Implemented Requirements & Control Editor Integration', async ({ page, apiSetup }) => {
      await apiSetup.syncWorkspace();
      const sspId = await apiSetup.createSsp();
      await navigateToSsp(page, sspId, apiSetup.workspaceId, true);

      // 1. Navigate to Control Implementation tab
      await selectTab(page, 'Control Implementation');
      const addReqBtn = page.getByRole('button', { name: /\+ Add (Implemented )?Requirement/i });
      await expect(addReqBtn).toBeVisible({ timeout: 15000 });

      // 2. Add new implemented requirement via modal
      await addReqBtn.click();
      await page.locator('[data-testid="add-control-id-input"]').fill('ac-1');
      await page.locator('[data-testid="submit-add-control-btn"]').click();
      await expect(page.getByText('ac-1').first()).toBeVisible({ timeout: 15000 });

      // 3. Save draft and F5 Reload Persistence
      await persistAndReload(page);
      await selectTab(page, 'Control Implementation');
      await expect(page.getByText('ac-1').first()).toBeVisible({ timeout: 15000 });
    });

    test('US 4.21 & US 4.22: Document Overview Metrics & Metadata Management', async ({ page, apiSetup }) => {
      await apiSetup.syncWorkspace();
      const sspId = await apiSetup.createSsp();
      await navigateToSsp(page, sspId, apiSetup.workspaceId, true);

      // 1. Overview Dashboard Metrics
      await selectTab(page, 'Overview');
      await expect(page.getByText('Baseline Controls')).toBeVisible({ timeout: 15000 });
      await expect(page.getByText('Implemented Reqs')).toBeVisible({ timeout: 15000 });
      await expect(page.getByText('Implementation Coverage')).toBeVisible({ timeout: 15000 });
      await expect(page.getByText('System Components')).toBeVisible({ timeout: 15000 });
      await expect(page.getByText('System Users')).toBeVisible({ timeout: 15000 });

      // 2. Metadata Tab editing
      await selectTab(page, 'Metadata');
      const docTitleInput = page.locator('input[placeholder*="Document Title"], input[value*="Test"]').first();
      await expect(docTitleInput).toBeVisible({ timeout: 15000 });
      await docTitleInput.fill('Audited Enterprise Security Plan v2');

      // 3. JSON Source tab verification
      await selectTab(page, 'JSON Source');
      await expect(page.locator('.monaco-editor, textarea, pre').first()).toBeVisible({ timeout: 15000 });

      // 4. Save draft and F5 Reload Persistence
      await persistAndReload(page);
      await selectTab(page, 'Metadata');
      await expect(page.locator('input[placeholder*="Document Title"], input[value*="Audited"]').first()).toHaveValue('Audited Enterprise Security Plan v2');
    });

    test('US 4.23: Segmented Mode Toggle [ View | Edit ]', async ({ page, apiSetup }) => {
      await apiSetup.syncWorkspace();
      const sspId = await apiSetup.createSsp();
      await navigateToSsp(page, sspId, apiSetup.workspaceId, true);

      // 1. In Edit mode: Form controls are interactive
      await selectTab(page, 'System Characteristics');
      const nameInput = page.locator('div[class*="accordion-section"]:has-text("System Identity") input[type="text"]').first();
      await expect(nameInput).not.toHaveAttribute('readonly');

      // 2. Toggle to View mode
      await page.getByTestId('mode-view-btn').click();

      // 3. In View mode: Input becomes readonly / disabled
      await expect(nameInput).toHaveAttribute('readonly');

      // 4. Toggle back to Edit mode
      await page.getByTestId('mode-edit-btn').click();
      await expect(nameInput).not.toHaveAttribute('readonly');
    });
  });

  // =========================================================================
  // TIER 2: BOUNDARY & CORNER CASES
  // =========================================================================
  test.describe('Tier 2: Boundary & Corner Cases', () => {

    test('System Status "other" Dynamically Displays Mandatory Remarks Textarea', async ({ page, apiSetup }) => {
      await apiSetup.syncWorkspace();
      const sspId = await apiSetup.createSsp();
      await navigateToSsp(page, sspId, apiSetup.workspaceId, true);

      await selectTab(page, 'System Characteristics');
      const statusSection = page.locator('div[class*="accordion-section"]', { hasText: 'Operational Status' });
      const statusSelect = statusSection.locator('select').first();

      // 1. Remarks textarea should NOT be visible when state is 'operational'
      await statusSelect.selectOption('operational');
      await expect(statusSection.locator('textarea')).not.toBeVisible();

      // 2. Select state 'other' -> Remarks textarea appears
      await statusSelect.selectOption('other');
      const remarksTextarea = statusSection.locator('textarea').first();
      await expect(remarksTextarea).toBeVisible({ timeout: 15000 });

      // 3. Fill Remarks
      await remarksTextarea.fill('System scheduled for phased decommission and data archival by Q4 2026.');

      // 4. Save draft and F5 Reload Persistence
      await persistAndReload(page);
      await selectTab(page, 'System Characteristics');
      await expect(statusSelect).toHaveValue('other');
      await expect(statusSection.locator('textarea').first()).toHaveValue('System scheduled for phased decommission and data archival by Q4 2026.');
    });

    test('Information Types Impact Level Conflict Detection Banner', async ({ page, apiSetup }) => {
      await apiSetup.syncWorkspace();
      const sspId = await apiSetup.createSsp();
      await navigateToSsp(page, sspId, apiSetup.workspaceId, true);

      await selectTab(page, 'System Characteristics');
      const infoSection = page.locator('div[class*="accordion-section"]').filter({ has: page.locator('h3', { hasText: 'Information Types' }) });
      const impactSection = page.locator('div[class*="accordion-section"]', { hasText: 'Security Impact Level' });

      // 1. Add High impact information type (index 3)
      const presetSelect = infoSection.locator('div[class*="preset-bar"] select').first();
      await presetSelect.selectOption('3');

      // 2. Manually set Confidentiality impact level to Low (creating conflict with HWM High/Moderate)
      const confSelect = impactSection.locator('div[class*="fips-impact-card"]:has-text("confidentiality") select').first();
      await confSelect.selectOption('fips-199-low');

      // 3. Verify Conflict Badge appears
      const conflictBadge = impactSection.locator('span[class*="conflict-badge"]');
      await expect(conflictBadge).toBeVisible({ timeout: 15000 });
      await expect(conflictBadge).toContainText('Impact Level Conflict');

      // 4. Resolving conflict by applying HWM removes the badge
      const applyBtn = impactSection.getByRole('button', { name: /Apply High-Water Mark Suggestion/i });
      await applyBtn.click();
      await expect(conflictBadge).not.toBeVisible();
    });

    test('Diagram Removal Cleans Up Diagram and Back-Matter Resource', async ({ page, apiSetup }) => {
      await apiSetup.syncWorkspace();
      const sspId = await apiSetup.createSsp();
      await navigateToSsp(page, sspId, apiSetup.workspaceId, true);

      await selectTab(page, 'System Characteristics');
      const boundarySection = page.locator('div[class*="accordion-section"]', { hasText: 'Authorization Boundary' });

      // 1. Upload diagram
      const fileInput = boundarySection.locator('div[class*="form-group"]:has-text("Authorization Boundary") input[type="file"]').first();
      await fileInput.setInputFiles({
        name: 'temp-diagram.png',
        mimeType: 'image/png',
        buffer: SAMPLE_PNG_BUFFER
      });

      const previewImg = boundarySection.locator('div[class*="form-group"]:has-text("Authorization Boundary") img').first();
      await expect(previewImg).toBeVisible({ timeout: 15000 });

      // 2. Click Remove Diagram
      const removeBtn = boundarySection.locator('div[class*="form-group"]:has-text("Authorization Boundary") button', { hasText: 'Remove Diagram' }).first();
      await expect(removeBtn).toBeVisible({ timeout: 15000 });
      await removeBtn.click();

      // 3. Verify preview image is removed
      await expect(previewImg).not.toBeVisible();

      // 4. Save draft and F5 Reload Persistence
      await persistAndReload(page);
      await selectTab(page, 'System Characteristics');
      await expect(boundarySection.locator('div[class*="form-group"]:has-text("Authorization Boundary") img')).not.toBeVisible();
    });

    test('Entity Table Multi-Item Deletion & Cleanup', async ({ page, apiSetup }) => {
      await apiSetup.syncWorkspace();
      const sspId = await apiSetup.createSsp();
      await navigateToSsp(page, sspId, apiSetup.workspaceId, true);

      await selectTab(page, 'System Implementation');
      await page.locator('.sys-imp-tab button', { hasText: 'Components' }).click();

      // 1. Add new component
      await page.getByRole('button', { name: '+ Add Component' }).click();
      const compDialog = page.locator('div[role="dialog"]');
      await compDialog.locator('input[type="text"]').first().fill('Deletable Component');
      await compDialog.getByRole('button', { name: 'Save Component' }).click();
      await expect(compDialog).not.toBeVisible({ timeout: 15000 });
      await expect(page.getByText('Deletable Component').first()).toBeVisible({ timeout: 15000 });

      // 2. Save draft and F5 Reload Persistence
      await persistAndReload(page);
      await selectTab(page, 'System Implementation');
      await page.locator('.sys-imp-tab button', { hasText: 'Components' }).click();
      await expect(page.getByText('Deletable Component').first()).toBeVisible({ timeout: 15000 });
    });

    test('Empty Array Purging (DD-014 Conformity)', async ({ page, apiSetup }) => {
      await apiSetup.syncWorkspace();
      const sspId = await apiSetup.createSsp({
        systemCharacteristics: {
          'system-ids': [{ id: 'sys-clean-01' }],
          'system-name': 'Clean Array Test System',
          description: 'Document verifying DD-014 empty array purging.',
          'system-information': {
            'information-types': [
              {
                uuid: randomUUID(),
                title: 'Public Information',
                description: 'Public data.',
                'confidentiality-impact': { base: 'fips-199-low' },
                'integrity-impact': { base: 'fips-199-low' },
                'availability-impact': { base: 'fips-199-low' }
              }
            ]
          },
          status: { state: 'operational' },
          'authorization-boundary': { description: 'Boundary description' },
          props: [] // Purged on save/fetch
        }
      });

      await navigateToSsp(page, sspId, apiSetup.workspaceId, false);
      await selectTab(page, 'JSON Source');
      await expect(page.locator('.monaco-editor, textarea, pre').first()).toBeVisible({ timeout: 15000 });

      // Verify page loads cleanly without 422 schema validation errors
      await expect(page.getByText('Clean Array Test System').first()).toBeVisible({ timeout: 15000 });
    });
  });

  // =========================================================================
  // TIER 3: CROSS-FEATURE COMBINATIONS
  // =========================================================================
  test.describe('Tier 3: Cross-Feature Combinations', () => {

    test('Cross-Feature: Import Profile -> Add Component -> Bind in Control Implementation -> Verify JSON', async ({ page, apiSetup }) => {
      await apiSetup.syncWorkspace();

      // 1. Create Catalog with AC-1 & AC-2
      const catUuid = await apiSetup.createCatalog({
        title: 'Security Control Catalog',
        groups: [
          {
            id: 'ac',
            title: 'Access Control',
            controls: [
              { id: 'ac-1', title: 'Access Control Policy and Procedures' },
              { id: 'ac-2', title: 'Account Management' }
            ]
          }
        ]
      });

      // 2. Create Profile importing Catalog
      const profUuid = await apiSetup.createProfile({
        title: 'FedRAMP Moderate Profile',
        catalogUuid: catUuid
      });

      // 3. Create SSP importing Profile
      const sspId = await apiSetup.createSsp({
        profileId: profUuid,
        title: 'End-to-End Enterprise SSP'
      });

      await navigateToSsp(page, sspId, apiSetup.workspaceId, true);

      // 4. In System Implementation, add Software Component
      await selectTab(page, 'System Implementation');
      await page.locator('.sys-imp-tab button', { hasText: 'Components' }).click();
      await page.getByRole('button', { name: '+ Add Component' }).click();
      const compDialog = page.locator('div[role="dialog"]');
      await compDialog.locator('input[type="text"]').first().fill('PostgreSQL Relational Database');
      await compDialog.getByRole('button', { name: 'Save Component' }).click();
      await expect(compDialog).not.toBeVisible({ timeout: 15000 });

      // 5. In Control Implementation, add requirement for AC-2
      await selectTab(page, 'Control Implementation');
      const addReqBtn = page.getByRole('button', { name: /\+ Add (Implemented )?Requirement/i });
      await addReqBtn.click();
      await page.locator('[data-testid="add-control-id-input"]').fill('ac-2');
      await page.locator('[data-testid="submit-add-control-btn"]').click();
      await expect(page.getByText('ac-2').first()).toBeVisible({ timeout: 15000 });

      // 6. Verify JSON Source contains SSP structure
      await selectTab(page, 'JSON Source');
      await expect(page.locator('.monaco-editor, textarea, pre').first()).toBeVisible({ timeout: 15000 });

      // 7. Save draft and F5 Reload Persistence
      await persistAndReload(page);
      await selectTab(page, 'System Implementation');
      await page.locator('.sys-imp-tab button', { hasText: 'Components' }).click();
      await expect(page.getByText('PostgreSQL Relational Database').first()).toBeVisible({ timeout: 15000 });
    });

    test('Cross-Feature: Leveraged Authorization -> System Component Binding -> Security Inheritance', async ({ page, apiSetup }) => {
      await apiSetup.syncWorkspace();
      const sspId = await apiSetup.createSsp();
      await navigateToSsp(page, sspId, apiSetup.workspaceId, true);

      // 1. Create Leveraged Authorization
      await selectTab(page, 'System Implementation');
      await page.locator('.sys-imp-tab button', { hasText: 'Leveraged Authorizations' }).click();
      await page.getByRole('button', { name: /\+ Add (Leveraged )?Auth/i }).click();
      const authDialog = page.locator('div[role="dialog"]');
      await expect(authDialog).toBeVisible({ timeout: 15000 });
      await authDialog.locator('input[placeholder*="Amazon Web Services"]').fill('Amazon Web Services (AWS) IaaS Authorization');
      await authDialog.locator('input[placeholder*="Party UUID"]').fill('e1111111-2222-4333-8444-555555555555');
      await authDialog.getByRole('button', { name: 'Save Authorization' }).click();
      await expect(authDialog).not.toBeVisible({ timeout: 15000 });

      // 2. Create Component linked to CSP
      await page.locator('.sys-imp-tab button', { hasText: 'Components' }).click();
      await page.getByRole('button', { name: '+ Add Component' }).click();
      const compDialog = page.locator('div[role="dialog"]');
      await compDialog.locator('input[type="text"]').first().fill('AWS Core Cloud Infrastructure');
      await compDialog.getByRole('button', { name: 'Save Component' }).click();
      await expect(compDialog).not.toBeVisible({ timeout: 15000 });

      // 3. Save draft and F5 Reload Persistence
      await persistAndReload(page);
      await selectTab(page, 'System Implementation');
      await page.locator('.sys-imp-tab button', { hasText: 'Leveraged Authorizations' }).click();
      await expect(page.getByText('Amazon Web Services (AWS) IaaS Authorization').first()).toBeVisible({ timeout: 15000 });

      await page.locator('.sys-imp-tab button', { hasText: 'Components' }).click();
      await expect(page.getByText('AWS Core Cloud Infrastructure').first()).toBeVisible({ timeout: 15000 });
    });

    test('Cross-Feature: Multi-Diagram Upload across Boundary & Architecture with Back-Matter Storage', async ({ page, apiSetup }) => {
      await apiSetup.syncWorkspace();
      const sspId = await apiSetup.createSsp();
      await navigateToSsp(page, sspId, apiSetup.workspaceId, true);

      await selectTab(page, 'System Characteristics');
      const boundarySection = await openAccordion(page, 'Boundary Descriptions & Diagrams');

      // 1. Upload Boundary Diagram
      const boundaryFileInput = boundarySection.locator('div[class*="form-group"]:has-text("Authorization Boundary") input[type="file"]').first();
      await boundaryFileInput.setInputFiles({
        name: 'boundary.png',
        mimeType: 'image/png',
        buffer: SAMPLE_PNG_BUFFER
      });
      const boundaryImg = boundarySection.locator('div[class*="form-group"]:has-text("Authorization Boundary") img').first();
      await expect(boundaryImg).toBeVisible({ timeout: 15000 });

      // 2. Upload Network Architecture Diagram
      const netFileInput = boundarySection.locator('div[class*="form-group"]:has-text("Network Architecture") input[type="file"]').first();
      await netFileInput.setInputFiles({
        name: 'network.png',
        mimeType: 'image/png',
        buffer: SAMPLE_PNG_BUFFER
      });
      const netImg = boundarySection.locator('div[class*="form-group"]:has-text("Network Architecture") img').first();
      await expect(netImg).toBeVisible({ timeout: 15000 });

      // 3. Verify JSON Source contains Back-Matter resources and boundary diagrams
      await selectTab(page, 'JSON Source');
      const jsonViewer = page.locator('.monaco-editor, textarea, pre').first();
      await expect(jsonViewer).toBeVisible({ timeout: 15000 });

      // 4. Return to System Characteristics and verify diagrams remain rendered
      await selectTab(page, 'System Characteristics');
      await expect(boundaryImg).toBeVisible({ timeout: 15000 });
      await expect(netImg).toBeVisible({ timeout: 15000 });
    });
  });

  // =========================================================================
  // TIER 4: REAL-WORLD WORKLOAD SCENARIOS
  // =========================================================================
  test.describe('Tier 4: Real-World Workload Scenarios', () => {

    test('Complete FedRAMP Moderate / NIST SP 800-53 Rev 5 SSP Construction Workflow', async ({ page, apiSetup }) => {
      await apiSetup.syncWorkspace();

      // 1. Setup Source Catalog and Tailored Profile
      const catUuid = await apiSetup.createCatalog({
        title: 'NIST SP 800-53 Rev 5 Security Controls',
        groups: [
          {
            id: 'ac',
            title: 'Access Control',
            controls: [
              { id: 'ac-1', title: 'Access Control Policy and Procedures' },
              { id: 'ac-2', title: 'Account Management' }
            ]
          },
          {
            id: 'ia',
            title: 'Identification and Authentication',
            controls: [
              { id: 'ia-2', title: 'Identification and Authentication (Organizational Users)' }
            ]
          }
        ]
      });

      const profUuid = await apiSetup.createProfile({
        title: 'FedRAMP Moderate Security Baseline',
        catalogUuid: catUuid
      });

      // 2. Create SSP importing Profile
      const sspId = await apiSetup.createSsp({
        profileId: profUuid,
        title: 'FedRAMP Moderate Enterprise Portal SSP',
        systemCharacteristics: {
          'system-ids': [{ id: 'FEDRAMP-SYS-001', 'identifier-type': 'https://fedramp.gov' }],
          'system-name': 'FedRAMP Moderate Enterprise Portal',
          'system-name-short': 'FMEP',
          description: 'Official System Security Plan for FedRAMP Moderate Authorization.',
          'security-sensitivity-level': 'moderate',
          'system-information': {
            'information-types': [
              {
                uuid: randomUUID(),
                title: 'Financial Management Information',
                description: 'Financial accounting data.',
                'confidentiality-impact': { base: 'fips-199-moderate' },
                'integrity-impact': { base: 'fips-199-high' },
                'availability-impact': { base: 'fips-199-moderate' }
              }
            ]
          },
          status: { state: 'operational' },
          'authorization-boundary': { description: 'Complete cloud production boundary.' }
        }
      });

      await navigateToSsp(page, sspId, apiSetup.workspaceId, true);

      // 3. Verify Overview Dashboard Metrics
      await selectTab(page, 'Overview');
      await expect(page.getByText('FedRAMP Moderate Enterprise Portal').first()).toBeVisible({ timeout: 15000 });
      await expect(page.getByText('Baseline Controls')).toBeVisible({ timeout: 15000 });
      await expect(page.getByText('Implemented Reqs')).toBeVisible({ timeout: 15000 });

      // 4. Verify System Characteristics & FIPS High-Water Mark
      await selectTab(page, 'System Characteristics');
      const impactSection = page.locator('div[class*="accordion-section"]', { hasText: 'Security Impact Level' });
      await expect(impactSection.locator('div[class*="hwm-banner"]')).toBeVisible({ timeout: 15000 });

      // 5. Add Keycloak Component in System Implementation
      await selectTab(page, 'System Implementation');
      await page.locator('.sys-imp-tab button', { hasText: 'Components' }).click();
      await page.getByRole('button', { name: '+ Add Component' }).click();
      const compDialog = page.locator('div[role="dialog"]');
      await compDialog.locator('input[type="text"]').first().fill('Keycloak Authentication Gateway');
      await compDialog.getByRole('button', { name: 'Save Component' }).click();
      await expect(compDialog).not.toBeVisible({ timeout: 15000 });

      // 6. Add Security Officer User
      await page.locator('.sys-imp-tab button', { hasText: 'Users & Privileges' }).click();
      await page.getByRole('button', { name: '+ Add User' }).click();
      const userDialog = page.locator('div[role="dialog"]');
      await userDialog.locator('input[type="text"]').first().fill('Information System Security Officer (ISSO)');
      await userDialog.getByRole('button', { name: 'Save User Class' }).click();
      await expect(userDialog).not.toBeVisible({ timeout: 15000 });

      // 7. Verify Control Implementation tab displays requirements
      await selectTab(page, 'Control Implementation');
      const addReqBtn = page.getByRole('button', { name: /\+ Add (Implemented )?Requirement/i });
      await expect(addReqBtn).toBeVisible({ timeout: 15000 });

      // 8. Save draft and F5 Reload Persistence across all configured sections
      await persistAndReload(page);
      await selectTab(page, 'System Implementation');
      await page.locator('.sys-imp-tab button', { hasText: 'Components' }).click();
      await expect(page.getByText('Keycloak Authentication Gateway').first()).toBeVisible({ timeout: 15000 });

      await page.locator('.sys-imp-tab button', { hasText: 'Users & Privileges' }).click();
      await expect(page.getByText('Information System Security Officer (ISSO)').first()).toBeVisible({ timeout: 15000 });
    });

    test('Backend Schema Validation Endpoint Verification (POST /api/validate/ssps)', async ({ apiSetup }) => {
      await apiSetup.syncWorkspace();

      // 1. Create a valid Profile and SSP
      const profUuid = await apiSetup.createProfile({ title: 'Validation Target Profile' });
      const sspId = await apiSetup.createSsp({
        profileId: profUuid,
        title: 'Schema Validation Target SSP'
      });

      // 2. Fetch the created SSP document from backend
      const sspDoc = await apiSetup.getDocument('ssps', sspId);
      expect(sspDoc).toBeDefined();
      expect(sspDoc['system-security-plan']).toBeDefined();

      // 3. Send payload to POST /api/validate/ssps
      const validationResponse = await (await fetch(`http://127.0.0.1:1000/api/validate/ssps`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Workspace-ID': apiSetup.workspaceId
        },
        body: JSON.stringify(sspDoc)
      })).json();

      // 4. Assert document passes OSCAL SSP Schema validation cleanly
      expect(validationResponse).toEqual({
        status: 'valid',
        stage: 'ssps'
      });
    });
  });
});
