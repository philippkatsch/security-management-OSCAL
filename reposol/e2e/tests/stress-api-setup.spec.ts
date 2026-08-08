import { test, expect } from '../fixtures/base';
import { ApiSetup } from '../helpers/api-setup';
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

test.describe('Empirical Stress Testing of ApiSetup across All 8 OSCAL Stages', () => {

  test('Suite 1: Sequential creation of 10 full 8-stage document chains (80 docs) with verification & cleanup', async ({ page }) => {
    const apiSetup = new ApiSetup(page);
    const createdDocIds: { stage: string; id: string }[] = [];

    // Create 10 full chains sequentially
    for (let i = 0; i < 10; i++) {
      const catId = await apiSetup.createCatalog({ title: `Stress Catalog ${i}` });
      const profId = await apiSetup.createProfile({ catalogUuid: catId, title: `Stress Profile ${i}` });
      const compId = await apiSetup.createComponentDefinition({ title: `Stress CompDef ${i}` });
      const sspId = await apiSetup.createSsp(profId, compId, { title: `Stress SSP ${i}` });
      const apId = await apiSetup.createAssessmentPlan(sspId, { title: `Stress AP ${i}` });
      const arId = await apiSetup.createAssessmentResults(apId, { title: `Stress AR ${i}` });
      const poamId = await apiSetup.createPoam(sspId, arId, { title: `Stress POAM ${i}` });
      const mapId = await apiSetup.createControlMapping({ title: `Stress Mapping ${i}` });

      createdDocIds.push(
        { stage: 'catalog', id: catId },
        { stage: 'profile', id: profId },
        { stage: 'component-definitions', id: compId },
        { stage: 'ssps', id: sspId },
        { stage: 'assessment-plan', id: apId },
        { stage: 'assessment-results', id: arId },
        { stage: 'poam', id: poamId },
        { stage: 'control-mapping', id: mapId }
      );
    }

    expect(createdDocIds.length).toBe(80);

    // Verify all 80 documents can be fetched
    for (const doc of createdDocIds) {
      const retrieved = await apiSetup.getDocument(doc.stage, doc.id);
      expect(retrieved).toBeTruthy();
    }

    // Run cleanup
    await apiSetup.cleanup();

    // Verify all 80 documents return 404 after cleanup
    for (const doc of createdDocIds) {
      await expect(apiSetup.getDocument(doc.stage, doc.id)).rejects.toThrow();
    }
  });

  test('Suite 2: Parallel document creation across all 8 stages on single and multiple workspace instances', async ({ page }) => {
    // Single instance parallel creation (24 docs simultaneously via Promise.all)
    const singleSetup = new ApiSetup(page);

    const parallelPromises = [
      singleSetup.createCatalog({ title: 'Parallel Cat 1' }),
      singleSetup.createCatalog({ title: 'Parallel Cat 2' }),
      singleSetup.createCatalog({ title: 'Parallel Cat 3' }),
      singleSetup.createProfile({ title: 'Parallel Prof 1' }),
      singleSetup.createProfile({ title: 'Parallel Prof 2' }),
      singleSetup.createProfile({ title: 'Parallel Prof 3' }),
      singleSetup.createComponentDefinition({ title: 'Parallel Comp 1' }),
      singleSetup.createComponentDefinition({ title: 'Parallel Comp 2' }),
      singleSetup.createComponentDefinition({ title: 'Parallel Comp 3' }),
      singleSetup.createSsp({ title: 'Parallel SSP 1' }),
      singleSetup.createSsp({ title: 'Parallel SSP 2' }),
      singleSetup.createSsp({ title: 'Parallel SSP 3' }),
      singleSetup.createAssessmentPlan({ title: 'Parallel AP 1' }),
      singleSetup.createAssessmentPlan({ title: 'Parallel AP 2' }),
      singleSetup.createAssessmentPlan({ title: 'Parallel AP 3' }),
      singleSetup.createAssessmentResults({ title: 'Parallel AR 1' }),
      singleSetup.createAssessmentResults({ title: 'Parallel AR 2' }),
      singleSetup.createAssessmentResults({ title: 'Parallel AR 3' }),
      singleSetup.createPoam({ title: 'Parallel POAM 1' }),
      singleSetup.createPoam({ title: 'Parallel POAM 2' }),
      singleSetup.createPoam({ title: 'Parallel POAM 3' }),
      singleSetup.createControlMapping({ title: 'Parallel Map 1' }),
      singleSetup.createControlMapping({ title: 'Parallel Map 2' }),
      singleSetup.createControlMapping({ title: 'Parallel Map 3' })
    ];

    const results = await Promise.all(parallelPromises);
    expect(results.length).toBe(24);
    results.forEach(id => expect(id).toBeTruthy());

    await singleSetup.cleanup();

    // Verify multi-workspace parallel execution (5 workspaces in parallel)
    const multiSetupPromises = Array.from({ length: 5 }, async (_, index) => {
      const setup = new ApiSetup(page, `stress-ws-${index}-${randomUUID()}`);
      const cat = await setup.createCatalog({ title: `WS ${index} Catalog` });
      const prof = await setup.createProfile({ catalogUuid: cat, title: `WS ${index} Profile` });
      const comp = await setup.createComponentDefinition({ title: `WS ${index} Comp` });
      const ssp = await setup.createSsp(prof, comp, { title: `WS ${index} SSP` });
      const ap = await setup.createAssessmentPlan(ssp, { title: `WS ${index} AP` });
      const ar = await setup.createAssessmentResults(ap, { title: `WS ${index} AR` });
      const poam = await setup.createPoam(ssp, ar, { title: `WS ${index} POAM` });
      const map = await setup.createControlMapping({ title: `WS ${index} Map` });
      return { setup, ids: [cat, prof, comp, ssp, ap, ar, poam, map] };
    });

    const multiResults = await Promise.all(multiSetupPromises);
    expect(multiResults.length).toBe(5);

    for (const res of multiResults) {
      await res.setup.cleanup();
    }
  });

  test('Suite 3: Positional vs Options signature variations and custom UUIDs across all 8 stages', async ({ page }) => {
    const apiSetup = new ApiSetup(page);

    const customCatUuid = randomUUID();
    const customProfUuid = randomUUID();
    const customCompUuid = randomUUID();
    const customSspUuid = randomUUID();
    const customApUuid = randomUUID();
    const customArUuid = randomUUID();
    const customPoamUuid = randomUUID();
    const customMapUuid = randomUUID();

    // 1. Catalog with custom UUID
    const catId = await apiSetup.createCatalog({ uuid: customCatUuid, title: 'Custom Cat' });
    expect(catId).toBe(customCatUuid);

    // 2. Profile with options-only signature
    const profId = await apiSetup.createProfile({ uuid: customProfUuid, catalogUuid: catId, title: 'Custom Prof' });
    expect(profId).toBe(customProfUuid);

    // 3. Component Definition with custom UUID
    const compId = await apiSetup.createComponentDefinition({ uuid: customCompUuid, title: 'Custom Comp' });
    expect(compId).toBe(customCompUuid);

    // 4. SSP with object options signature (opts.profileId, opts.componentDefId)
    const sspIdObj = await apiSetup.createSsp({ uuid: customSspUuid, profileId: profId, componentDefId: compId, title: 'Custom SSP Obj' });
    expect(sspIdObj).toBe(customSspUuid);

    // 5. AP with object options signature (opts.sspId)
    const apIdObj = await apiSetup.createAssessmentPlan({ uuid: customApUuid, sspId: sspIdObj, title: 'Custom AP Obj' });
    expect(apIdObj).toBe(customApUuid);

    // 6. AR with object options signature (opts.apId)
    const arIdObj = await apiSetup.createAssessmentResults({ uuid: customArUuid, apId: apIdObj, title: 'Custom AR Obj' });
    expect(arIdObj).toBe(customArUuid);

    // 7. POAM with object options signature (opts.sspId, opts.arId)
    const poamIdObj = await apiSetup.createPoam({ uuid: customPoamUuid, sspId: sspIdObj, arId: arIdObj, title: 'Custom POAM Obj' });
    expect(poamIdObj).toBe(customPoamUuid);

    // 8. Control mapping with custom UUID
    const mapId = await apiSetup.createControlMapping({ uuid: customMapUuid, title: 'Custom Map' });
    expect(mapId).toBe(customMapUuid);

    // Also test createDocument generic helper across all stages
    const genericCatUuid = randomUUID();
    const genericCatId = await apiSetup.createDocument('catalog', {
      catalog: {
        uuid: genericCatUuid,
        metadata: { title: 'Generic Cat', version: '1.0', 'oscal-version': '1.1.2', 'last-modified': new Date().toISOString() }
      }
    });
    expect(genericCatId).toBe(genericCatUuid);

    await apiSetup.cleanup();
  });

  test('Suite 4: Idempotency, pre-deletion, and partial creation failure handling', async ({ page }) => {
    const apiSetup = new ApiSetup(page);

    // 1. Partial failure scenario
    const catId = await apiSetup.createCatalog({ title: 'Partial Cat' });
    const profId = await apiSetup.createProfile({ catalogUuid: catId, title: 'Partial Prof' });

    // Force failure on 3rd doc by providing invalid payload to createDocument
    await expect(apiSetup.createDocument('catalog', { invalid: {} })).rejects.toThrow();

    // Verify cleanup still succeeds and removes the 2 created docs
    await apiSetup.cleanup();

    await expect(apiSetup.getDocument('catalog', catId)).rejects.toThrow();
    await expect(apiSetup.getDocument('profile', profId)).rejects.toThrow();

    // 2. Double cleanup idempotency check
    const setup2 = new ApiSetup(page);
    const docId = await setup2.createCatalog({ title: 'Double Cleanup Cat' });
    await setup2.cleanup();
    // Second call to cleanup should not throw
    await expect(setup2.cleanup()).resolves.not.toThrow();

    // 3. Pre-deleted document before cleanup
    const setup3 = new ApiSetup(page);
    const preDelCatId = await setup3.createCatalog({ title: 'Pre Deleted Cat' });
    await setup3.deleteDocument('catalog', preDelCatId);
    // cleanup() should handle already deleted document gracefully
    await expect(setup3.cleanup()).resolves.not.toThrow();
  });

  test('Suite 5: Backend Disk File Inspection for Complete Cleanup', async ({ page }) => {
    const wsId = `disk-audit-${randomUUID()}`;
    const apiSetup = new ApiSetup(page, wsId);

    const catId = await apiSetup.createCatalog({ title: 'Disk Audit Catalog' });
    const profId = await apiSetup.createProfile({ catalogUuid: catId, title: 'Disk Audit Profile' });
    const compId = await apiSetup.createComponentDefinition({ title: 'Disk Audit CompDef' });
    const sspId = await apiSetup.createSsp(profId, compId, { title: 'Disk Audit SSP' });
    const apId = await apiSetup.createAssessmentPlan(sspId, { title: 'Disk Audit AP' });
    const arId = await apiSetup.createAssessmentResults(apId, { title: 'Disk Audit AR' });
    const poamId = await apiSetup.createPoam(sspId, arId, { title: 'Disk Audit POAM' });
    const mapId = await apiSetup.createControlMapping({ title: 'Disk Audit Mapping' });

    // Disk path check before cleanup
    const baseDir = path.resolve('../data/workspaces', wsId);
    const expectedFiles = [
      path.join(baseDir, 'catalogs', `${catId}.json`),
      path.join(baseDir, 'profiles', `${profId}.json`),
      path.join(baseDir, 'component-definitions', `${compId}.json`),
      path.join(baseDir, 'ssps', `${sspId}.json`),
      path.join(baseDir, 'assessment-plans', `${apId}.json`),
      path.join(baseDir, 'assessment-results', `${arId}.json`),
      path.join(baseDir, 'poams', `${poamId}.json`),
      path.join(baseDir, 'control-mappings', `${mapId}.json`)
    ];

    // Verify all 8 document files exist on backend disk
    for (const filePath of expectedFiles) {
      expect(fs.existsSync(filePath)).toBe(true);
    }

    // Perform cleanup
    await apiSetup.cleanup();

    // Verify all 8 created document files are deleted from disk
    const remainingCreatedFiles = expectedFiles.filter(fp => fs.existsSync(fp));
    expect(remainingCreatedFiles).toEqual([]);
  });

});
