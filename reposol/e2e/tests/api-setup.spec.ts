import { test, expect } from '../fixtures/base';

test.describe('ApiSetup Helper Coverage for All 8 OSCAL Stages', () => {
  test('creates and cleans up documents across all 8 OSCAL stages with workspace isolation', async ({ apiSetup }) => {
    // Verify workspaceId header format
    expect(apiSetup.workspaceId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);

    // Step 1: Catalog
    const catId = await apiSetup.createCatalog({ title: 'ApiSetup Catalog Test' });
    expect(catId).toBeTruthy();
    const catDoc = await apiSetup.getDocument('catalog', catId);
    expect(catDoc.catalog.metadata.title).toBe('ApiSetup Catalog Test');

    // Step 2: Profile (testing default options = {})
    const profileId = await apiSetup.createProfile();
    expect(profileId).toBeTruthy();
    const profileDoc = await apiSetup.getDocument('profile', profileId);
    expect(profileDoc.profile.metadata.title).toBe('Test Profile');

    // Step 3: Component Definition
    const compDefId = await apiSetup.createComponentDefinition({ title: 'ApiSetup Component Def' });
    expect(compDefId).toBeTruthy();
    const compDoc = await apiSetup.getDocument('component-definitions', compDefId);
    expect(compDoc['component-definition'].metadata.title).toBe('ApiSetup Component Def');

    // Step 4: System Security Plan (SSP)
    const sspId = await apiSetup.createSsp(profileId, compDefId, { title: 'ApiSetup SSP Test' });
    expect(sspId).toBeTruthy();
    const sspDoc = await apiSetup.getDocument('ssps', sspId);
    expect(sspDoc['system-security-plan'].metadata.title).toBe('ApiSetup SSP Test');

    // Step 5: Assessment Plan
    const apId = await apiSetup.createAssessmentPlan(sspId, { title: 'ApiSetup AP Test' });
    expect(apId).toBeTruthy();
    const apDoc = await apiSetup.getDocument('assessment-plan', apId);
    expect(apDoc['assessment-plan'].metadata.title).toBe('ApiSetup AP Test');

    // Step 6: Assessment Results
    const arId = await apiSetup.createAssessmentResults(apId, { title: 'ApiSetup AR Test' });
    expect(arId).toBeTruthy();
    const arDoc = await apiSetup.getDocument('assessment-results', arId);
    expect(arDoc['assessment-results'].metadata.title).toBe('ApiSetup AR Test');

    // Step 7: POA&M Tracker
    const poamId = await apiSetup.createPoam(sspId, arId, { title: 'ApiSetup POAM Test' });
    expect(poamId).toBeTruthy();
    const poamDoc = await apiSetup.getDocument('poam', poamId);
    expect(poamDoc['plan-of-action-and-milestones'].metadata.title).toBe('ApiSetup POAM Test');

    // Step 8: Control Mapping
    const mappingId = await apiSetup.createControlMapping({ title: 'ApiSetup Control Mapping Test' });
    expect(mappingId).toBeTruthy();
    const mappingDoc = await apiSetup.getDocument('control-mapping', mappingId);
    expect(mappingDoc['mapping-collection'].metadata.title).toBe('ApiSetup Control Mapping Test');
  });
});
