import { test, expect, request } from '@playwright/test';
import { ApiSetup } from '../helpers/api-setup';
import { randomUUID } from 'node:crypto';

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

test.describe('Challenger M0-3 Empirical Stress Test Suite', () => {

  test('Requirement 1: workspaceId generates pure RFC 4122 v4 UUID without session- prefix', async ({ page }) => {
    for (let i = 0; i < 50; i++) {
      const setup = new ApiSetup(page);
      expect(setup.workspaceId).toMatch(UUID_V4_REGEX);
      expect(setup.workspaceId).not.toContain('session-');
    }
  });

  test('Requirement 2: All 8 stage creation methods use valid RFC 4122 v4 UUID fallback HREFs and pass backend schema validation', async ({ page }) => {
    const apiSetup = new ApiSetup(page);

    // 1. Catalog
    const catId = await apiSetup.createCatalog();
    expect(catId).toMatch(UUID_V4_REGEX);
    const catDoc = await apiSetup.getDocument('catalog', catId);
    expect(catDoc.catalog.uuid).toMatch(UUID_V4_REGEX);

    // 2. Profile (default options)
    const profileId = await apiSetup.createProfile();
    expect(profileId).toMatch(UUID_V4_REGEX);
    const profileDoc = await apiSetup.getDocument('profile', profileId);
    expect(profileDoc.profile.uuid).toMatch(UUID_V4_REGEX);
    
    // Inspect Profile fallback catalog import href
    const profileImportHref = profileDoc.profile.imports?.[0]?.href || '';
    console.log('Profile Fallback Import Href:', profileImportHref);
    expect(profileImportHref).toMatch(/..\/catalogs\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.json/i);

    // 3. Component Definition
    const compDefId = await apiSetup.createComponentDefinition();
    expect(compDefId).toMatch(UUID_V4_REGEX);
    const compDoc = await apiSetup.getDocument('component-definitions', compDefId);
    expect(compDoc['component-definition'].uuid).toMatch(UUID_V4_REGEX);

    // 4. SSP
    const sspId = await apiSetup.createSsp();
    expect(sspId).toMatch(UUID_V4_REGEX);
    const sspDoc = await apiSetup.getDocument('ssps', sspId);
    expect(sspDoc['system-security-plan'].uuid).toMatch(UUID_V4_REGEX);
    const sspProfileHref = sspDoc['system-security-plan']['import-profile']?.href || '';
    console.log('SSP Fallback Profile Href:', sspProfileHref);
    expect(sspProfileHref).toMatch(/..\/profiles\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.json/i);

    // 5. Assessment Plan
    const apId = await apiSetup.createAssessmentPlan();
    expect(apId).toMatch(UUID_V4_REGEX);
    const apDoc = await apiSetup.getDocument('assessment-plan', apId);
    expect(apDoc['assessment-plan'].uuid).toMatch(UUID_V4_REGEX);
    const apSspHref = apDoc['assessment-plan']['import-ssp']?.href || '';
    console.log('AP Fallback SSP Href:', apSspHref);
    expect(apSspHref).toMatch(/..\/ssps\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.json/i);

    // 6. Assessment Results
    const arId = await apiSetup.createAssessmentResults();
    expect(arId).toMatch(UUID_V4_REGEX);
    const arDoc = await apiSetup.getDocument('assessment-results', arId);
    expect(arDoc['assessment-results'].uuid).toMatch(UUID_V4_REGEX);
    const arApHref = arDoc['assessment-results']['import-ap']?.href || '';
    console.log('AR Fallback AP Href:', arApHref);
    expect(arApHref).toMatch(/..\/assessment-plans\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.json/i);

    // 7. POA&M
    const poamId = await apiSetup.createPoam();
    expect(poamId).toMatch(UUID_V4_REGEX);
    const poamDoc = await apiSetup.getDocument('poams', poamId);
    expect(poamDoc['plan-of-action-and-milestones'].uuid).toMatch(UUID_V4_REGEX);

    // 8. Control Mapping
    const mappingId = await apiSetup.createControlMapping();
    expect(mappingId).toMatch(UUID_V4_REGEX);
    const mappingDoc = await apiSetup.getDocument('control-mappings', mappingId);
    expect(mappingDoc['mapping-collection'].uuid).toMatch(UUID_V4_REGEX);

    await apiSetup.cleanup();
  });

  test('Requirement 2 Stress Test: Explicit external UUID parameters in stage creation methods', async ({ page }) => {
    const apiSetup = new ApiSetup(page);
    
    // Explicit external UUIDs (not created via apiSetup or tracked in createdDocuments)
    const externalProfileId = randomUUID();
    const externalCompDefId = randomUUID();
    const externalSspId = randomUUID();
    const externalApId = randomUUID();
    const externalArId = randomUUID();

    // Test passing explicit profileId & componentDefId to createSsp
    const sspId = await apiSetup.createSsp(externalProfileId, externalCompDefId);
    const sspDoc = await apiSetup.getDocument('ssps', sspId);
    const sspProfileHref = sspDoc['system-security-plan']['import-profile']?.href;
    console.log('Explicit Profile ID passed:', externalProfileId);
    console.log('Actual SSP import-profile href:', sspProfileHref);
    expect(sspProfileHref).toBe(`../profiles/${externalProfileId}.json`);

    // Test passing explicit sspId to createAssessmentPlan
    const apId = await apiSetup.createAssessmentPlan(externalSspId);
    const apDoc = await apiSetup.getDocument('assessment-plan', apId);
    const apSspHref = apDoc['assessment-plan']['import-ssp']?.href;
    console.log('Explicit SSP ID passed:', externalSspId);
    console.log('Actual AP import-ssp href:', apSspHref);
    expect(apSspHref).toBe(`../ssps/${externalSspId}.json`);

    // Test passing explicit apId to createAssessmentResults
    const arId = await apiSetup.createAssessmentResults(externalApId);
    const arDoc = await apiSetup.getDocument('assessment-results', arId);
    const arApHref = arDoc['assessment-results']['import-ap']?.href;
    console.log('Explicit AP ID passed:', externalApId);
    console.log('Actual AR import-ap href:', arApHref);
    expect(arApHref).toBe(`../assessment-plans/${externalApId}.json`);

    // Test passing explicit sspId & arId to createPoam
    const poamId = await apiSetup.createPoam(externalSspId, externalArId);
    const poamDoc = await apiSetup.getDocument('poams', poamId);
    const poamSspHref = poamDoc['plan-of-action-and-milestones']['import-ssp']?.href;
    console.log('Explicit SSP ID passed to POA&M:', externalSspId);
    console.log('Actual POA&M import-ssp href:', poamSspHref);
    expect(poamSspHref).toBe(`../ssps/${externalSspId}.json`);

    await apiSetup.cleanup();
  });

  test('Requirement 3: Multi-workspace isolation is maintained', async ({ page }) => {
    const wsA = new ApiSetup(page, randomUUID());
    const wsB = new ApiSetup(page, randomUUID());

    // Create document in Workspace A
    const catA = await wsA.createCatalog({ title: 'Workspace A Catalog' });
    const profileA = await wsA.createProfile({ title: 'Workspace A Profile' });
    const compA = await wsA.createComponentDefinition({ title: 'Workspace A CompDef' });
    const sspA = await wsA.createSsp(profileA, compA, { title: 'Workspace A SSP' });

    // Try to access Workspace A documents from Workspace B (MUST FAIL with 404 error)
    await expect(wsB.getDocument('catalog', catA)).rejects.toThrow();
    await expect(wsB.getDocument('profile', profileA)).rejects.toThrow();
    await expect(wsB.getDocument('component-definitions', compA)).rejects.toThrow();
    await expect(wsB.getDocument('ssps', sspA)).rejects.toThrow();

    // Verify Workspace B document listing does NOT include Workspace A's document
    const reqB = await (wsB as any).getRequest();
    const respCatB = await reqB.get('/api/documents/catalog');
    const docsCatB = await respCatB.json();
    const containsCatA = docsCatB.some((d: any) => d.catalog?.uuid === catA);
    expect(containsCatA).toBe(false);

    const respSspB = await reqB.get('/api/documents/ssps');
    const docsSspB = await respSspB.json();
    const containsSspA = docsSspB.some((d: any) => d['system-security-plan']?.uuid === sspA);
    expect(containsSspA).toBe(false);

    await wsA.cleanup();
    await wsB.cleanup();
  });

  test('Requirement 4: cleanup() removes 100% of created documents across all 8 stage types', async ({ page }) => {
    const setup = new ApiSetup(page);

    // Get baseline document counts per stage BEFORE creating test documents
    const reqBaseline = await request.newContext({
      baseURL: 'http://127.0.0.1:1000',
      extraHTTPHeaders: { 'X-Workspace-ID': setup.workspaceId }
    });

    const stages = [
      'catalogs',
      'profiles',
      'component-definitions',
      'ssps',
      'assessment-plans',
      'assessment-results',
      'poams',
      'control-mappings'
    ];

    const baselineCounts: Record<string, number> = {};
    for (const stage of stages) {
      const res = await reqBaseline.get(`/api/documents/${stage}`);
      const docs = await res.json();
      baselineCounts[stage] = Array.isArray(docs) ? docs.length : 0;
    }
    await reqBaseline.dispose();

    // Create 1 document of each stage using ApiSetup
    const catId = await setup.createCatalog();
    const profileId = await setup.createProfile();
    const compId = await setup.createComponentDefinition();
    const sspId = await setup.createSsp();
    const apId = await setup.createAssessmentPlan();
    const arId = await setup.createAssessmentResults();
    const poamId = await setup.createPoam();
    const mappingId = await setup.createControlMapping();

    // Perform cleanup
    await setup.cleanup();

    // Query backend for document count after cleanup
    const checkReq = await request.newContext({
      baseURL: 'http://127.0.0.1:1000',
      extraHTTPHeaders: { 'X-Workspace-ID': setup.workspaceId }
    });

    const remainingCounts: Record<string, number> = {};
    for (const stage of stages) {
      const res = await checkReq.get(`/api/documents/${stage}`);
      expect(res.ok()).toBeTruthy();
      const docs = await res.json();
      remainingCounts[stage] = Array.isArray(docs) ? docs.length : 0;
    }
    await checkReq.dispose();

    console.log('Baseline counts before ApiSetup creation:', baselineCounts);
    console.log('Remaining counts after ApiSetup cleanup():', remainingCounts);

    // Verify created documents are no longer retrievable
    const checkSetup = new ApiSetup(page, setup.workspaceId);
    await expect(checkSetup.getDocument('catalog', catId)).rejects.toThrow();
    await expect(checkSetup.getDocument('profile', profileId)).rejects.toThrow();
    await expect(checkSetup.getDocument('component-definitions', compId)).rejects.toThrow();
    await expect(checkSetup.getDocument('ssps', sspId)).rejects.toThrow();
    await expect(checkSetup.getDocument('assessment-plan', apId)).rejects.toThrow();
    await expect(checkSetup.getDocument('assessment-results', arId)).rejects.toThrow();
    await expect(checkSetup.getDocument('poams', poamId)).rejects.toThrow();
    await expect(checkSetup.getDocument('control-mappings', mappingId)).rejects.toThrow();

    // Verify all stages return back to exact baseline count
    for (const stage of stages) {
      expect(remainingCounts[stage]).toBe(baselineCounts[stage]);
    }
  });
});
