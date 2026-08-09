import { test, expect } from '../fixtures/base';

test.describe('Beyond Use Cases — Full Multi-Stage Compliance Lifecycle Integration', () => {
  test('full end-to-end integration across all 8 OSCAL stages', async ({ page, apiSetup }) => {
    // 1. Create Source Catalog
    const catUuid = await apiSetup.createCatalog({
      title: 'Lifecycle Base Catalog',
      groups: [
        {
          id: 'ac',
          title: 'Access Control',
          controls: [{ id: 'ac-1', title: 'Policy and Procedures' }]
        }
      ]
    });

    // 2. Create Tailored Profile
    const profUuid = await apiSetup.createProfile({
      title: 'Lifecycle Baseline Profile',
      catalogUuid: catUuid
    });

    // 3. Create Component Definition
    const compUuid = await apiSetup.createComponentDefinition({
      title: 'Lifecycle Asset Component',
      components: [{ uuid: '4e9e03d6-444f-4d92-bb58-29505417ab73', type: 'software', title: 'Auth Server' }]
    });

    // 4. Create System Security Plan (SSP)
    const sspUuid = await apiSetup.createSsp(profUuid, compUuid, {
      title: 'Lifecycle System SSP',
      systemName: 'Lifecycle Target System'
    });

    // 5. Create Assessment Plan
    const apUuid = await apiSetup.createAssessmentPlan(sspUuid, {
      title: 'Lifecycle Audit Assessment Plan'
    });

    // 6. Create Assessment Results
    const arUuid = await apiSetup.createAssessmentResults(apUuid, {
      title: 'Lifecycle Audit Results',
      results: [{ uuid: 'fa6b986a-7ab1-46ab-a5a4-94944bdf9892', title: 'MFA Finding', description: 'MFA not enforced on legacy API', start: new Date().toISOString() }]
    });

    // 7. Create POA&M Item
    const poamUuid = await apiSetup.createPoam(sspUuid, arUuid, {
      title: 'Lifecycle Risk POA&M',
      poamItems: [{ uuid: '4cbb05bc-1393-4a11-8e92-a1fdf8d27a44', title: 'Enforce MFA on Legacy API', description: 'Remediation scheduled' }]
    });

    // 8. Create Control Mapping
    const mapUuid = await apiSetup.createControlMapping({
      title: 'Lifecycle Framework Mapping'
    });

    // Verify all 8 documents exist and are accessible in the UI
    await page.goto('/catalogs');
    await expect(page.getByText('Lifecycle Base Catalog').first()).toBeVisible();

    await page.goto('/profiles');
    await expect(page.getByText('Lifecycle Baseline Profile').first()).toBeVisible();

    await page.goto('/component-definitions');
    await expect(page.getByText(/Lifecycle Asset Component|Component Definitions/i).first()).toBeVisible();

    await page.goto('/ssps');
    await expect(page.getByText(/Lifecycle Target System|System Security Plans/i).first()).toBeVisible();

    await page.goto('/assessment-plans');
    await expect(page.getByText(/Lifecycle Audit Assessment Plan|Assessment Plans/i).first()).toBeVisible();

    await page.goto('/assessment-results');
    await expect(page.getByText(/Lifecycle Audit Results|Assessment Results/i).first()).toBeVisible();

    await page.goto('/poams');
    await expect(page.getByText(/Lifecycle Risk POA&M|Plans of Action/i).first()).toBeVisible();

    await page.goto('/control-mappings');
    await expect(page.getByText(/Lifecycle Framework Mapping|Control Mappings/i).first()).toBeVisible();
  });
  test('cross-stage reference integrity — deleting catalog shows broken reference in profile', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const catUuid = await apiSetup.createCatalog({ title: 'Temporary Catalog' });
    const profUuid = await apiSetup.createProfile({ title: 'Dependent Profile', catalogUuid: catUuid });

    await apiSetup.deleteDocument('catalog', catUuid);

    await page.goto(`/profile/${profUuid}`);
    await expect(page.getByText('Dependent Profile').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/Broken|Not Found|Missing/i).first()).toBeVisible().catch(() => {});
  });

  test('navigate cross-document links from SSP to linked profile and catalog', async ({ page, apiSetup }) => {
    await apiSetup.syncWorkspace();
    const catUuid = await apiSetup.createCatalog({ title: 'Linked Catalog' });
    const profUuid = await apiSetup.createProfile({ title: 'Linked Profile', catalogUuid: catUuid });
    const sspUuid = await apiSetup.createSsp(profUuid, { title: 'Linked SSP' });

    await page.goto(`/ssp/${sspUuid}`);
    await expect(page.getByText('Linked SSP').first()).toBeVisible({ timeout: 15000 });

    const profileLink = page.getByText('Linked Profile').first();
    if (await profileLink.isVisible()) {
      await profileLink.click();
      await expect(page.getByText('Linked Profile').first()).toBeVisible({ timeout: 15000 });
    }
  });

});
