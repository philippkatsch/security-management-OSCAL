import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import {
  updatePOAMRoot,
  updatePOAMList,
  savePOAMItem,
  replacePOAM,
  importARFindingsAction,
  addPOAMItem,
  updatePOAMItem,
  removePOAMItem,
  deletePOAMItems,
  addPOAMFinding,
  updatePOAMFinding,
  removePOAMFinding,
  deletePOAMFindings,
  addPOAMObservation,
  updatePOAMObservation,
  removePOAMObservation,
  deletePOAMObservations,
  addPOAMRisk,
  updatePOAMRisk,
  removePOAMRisk,
  deletePOAMRisks,
  setPOAMImportSSP,
  setPOAMSystemId
} from '../../lib/document-actions/poam-actions';

describe('POA&M Document Actions (DD-029)', () => {
  const createBaseDoc = () => ({
    'plan-of-action-and-milestones': {
      uuid: 'poam-uuid-1',
      metadata: {
        title: 'System Remediation Plan',
        version: '1.0.0',
        'last-modified': '2026-09-01T00:00:00Z',
        'oscal-version': '1.2.2'
      },
      'poam-items': [
        {
          uuid: 'item-1',
          title: 'Remediate AC-2 Deficiency',
          description: 'Fix account lifecycle inactivity timers',
          props: [{ name: 'status', value: 'open' }],
          'related-findings': [{ 'finding-uuid': 'find-1' }]
        }
      ],
      findings: [
        {
          uuid: 'find-1',
          title: 'Inactivity Timer Not Configured',
          description: 'Accounts are not disabled after 90 days',
          target: {
            type: 'statement-id',
            'target-id': 'ac-2_smt_a',
            status: { state: 'not-satisfied' }
          }
        }
      ],
      observations: [
        {
          uuid: 'obs-1',
          title: 'Audit Log Observation',
          description: 'Found dormant active account',
          methods: ['EXAMINE'],
          collected: '2026-09-01T00:00:00Z'
        }
      ],
      risks: [
        {
          uuid: 'risk-1',
          title: 'Unauthorized Access Risk',
          description: 'Dormant accounts may be hijacked',
          statement: 'Risk of account compromise',
          status: 'open'
        }
      ]
    }
  });

  it('updatePOAMRoot updates document root fields', () => {
    const base = createBaseDoc();
    const action = updatePOAMRoot('remarks', 'Quarterly Review Approved');
    const next = produce(base, draft => { action.apply(draft); });
    expect(next['plan-of-action-and-milestones'].remarks).toBe('Quarterly Review Approved');
  });

  it('updatePOAMList updates designated entity arrays', () => {
    const base = createBaseDoc();
    const action = updatePOAMList('local-definitions', { components: [] } as any);
    const next = produce(base, draft => { action.apply(draft); });
    expect(next['plan-of-action-and-milestones']['local-definitions']).toBeDefined();
  });

  it('savePOAMItem creates or updates item by uuid', () => {
    const base = createBaseDoc();
    const updatedItem = {
      uuid: 'item-1',
      title: 'Remediate AC-2 Deficiency - Updated',
      description: 'Updated description'
    };
    const action = savePOAMItem('poam-items', updatedItem);
    const next = produce(base, draft => { action.apply(draft); });
    expect(next['plan-of-action-and-milestones']['poam-items'][0].title).toBe('Remediate AC-2 Deficiency - Updated');
  });

  it('replacePOAM replaces the whole document state', () => {
    const base = createBaseDoc();
    const action = replacePOAM({
      'plan-of-action-and-milestones': {
        uuid: 'fresh-poam-uuid',
        metadata: { title: 'Fresh Plan', version: '2.0.0', 'last-modified': '', 'oscal-version': '1.2.2' },
        'poam-items': []
      }
    });
    const next = produce(base, draft => { action.apply(draft); });
    expect(next['plan-of-action-and-milestones'].uuid).toBe('fresh-poam-uuid');
  });

  it('importARFindingsAction merges findings, observations, and risks preserving UUIDs', () => {
    const base = createBaseDoc();
    const action = importARFindingsAction(
      [{ uuid: 'item-2', title: 'New Item 2', description: 'Imported from AR' }],
      [{ uuid: 'obs-2', title: 'New Obs 2', methods: ['TEST'], collected: '' }],
      [{ uuid: 'risk-2', title: 'New Risk 2', statement: 'Statement', status: 'open' }]
    );
    const next = produce(base, draft => { action.apply(draft); });
    expect(next['plan-of-action-and-milestones']['poam-items']).toHaveLength(2);
    expect(next['plan-of-action-and-milestones'].observations).toHaveLength(2);
    expect(next['plan-of-action-and-milestones'].risks).toHaveLength(2);
  });

  it('addPOAMItem adds a new POAM item', () => {
    const base = createBaseDoc();
    const action = addPOAMItem({ uuid: 'item-3', title: 'Patch OpenSSL' });
    const next = produce(base, draft => { action.apply(draft); });
    expect(next['plan-of-action-and-milestones']['poam-items']).toHaveLength(2);
    expect(next['plan-of-action-and-milestones']['poam-items'][1].title).toBe('Patch OpenSSL');
  });

  it('updatePOAMItem patches existing POAM item', () => {
    const base = createBaseDoc();
    const action = updatePOAMItem('item-1', { description: 'Scheduled for Sprint 42' });
    const next = produce(base, draft => { action.apply(draft); });
    expect(next['plan-of-action-and-milestones']['poam-items'][0].description).toBe('Scheduled for Sprint 42');
  });

  it('removePOAMItem removes item by uuid', () => {
    const base = createBaseDoc();
    const action = removePOAMItem('item-1');
    const next = produce(base, draft => { action.apply(draft); });
    expect(next['plan-of-action-and-milestones']['poam-items']).toHaveLength(0);
  });

  it('deletePOAMItems deletes items in batch', () => {
    const base = createBaseDoc();
    const action = deletePOAMItems(['item-1']);
    const next = produce(base, draft => { action.apply(draft); });
    expect(next['plan-of-action-and-milestones']['poam-items']).toHaveLength(0);
  });

  it('addPOAMFinding and removePOAMFinding work as expected', () => {
    const base = createBaseDoc();
    const addAction = addPOAMFinding({ uuid: 'find-2', title: 'Weak Password Policy' });
    const added = produce(base, draft => { addAction.apply(draft); });
    expect(added['plan-of-action-and-milestones'].findings).toHaveLength(2);

    const updateAction = updatePOAMFinding('find-2', { description: 'Min length 8 instead of 16' });
    const updated = produce(added, draft => { updateAction.apply(draft); });
    expect(updated['plan-of-action-and-milestones'].findings[1].description).toBe('Min length 8 instead of 16');

    const removeAction = removePOAMFinding('find-1');
    const removed = produce(updated, draft => { removeAction.apply(draft); });
    expect(removed['plan-of-action-and-milestones'].findings).toHaveLength(1);
    expect(removed['plan-of-action-and-milestones'].findings[0].uuid).toBe('find-2');

    const batchDeleteAction = deletePOAMFindings(['find-2']);
    const emptyFindings = produce(removed, draft => { batchDeleteAction.apply(draft); });
    expect(emptyFindings['plan-of-action-and-milestones'].findings).toHaveLength(0);
  });

  it('observation actions work as expected', () => {
    const base = createBaseDoc();
    const addAction = addPOAMObservation({ uuid: 'obs-2', title: 'Config File Review' });
    const added = produce(base, draft => { addAction.apply(draft); });
    expect(added['plan-of-action-and-milestones'].observations).toHaveLength(2);

    const updateAction = updatePOAMObservation('obs-2', { description: 'Missing hardening flags' });
    const updated = produce(added, draft => { updateAction.apply(draft); });
    expect(updated['plan-of-action-and-milestones'].observations[1].description).toBe('Missing hardening flags');

    const removeAction = removePOAMObservation('obs-1');
    const removed = produce(updated, draft => { removeAction.apply(draft); });
    expect(removed['plan-of-action-and-milestones'].observations).toHaveLength(1);

    const deleteBatch = deletePOAMObservations(['obs-2']);
    const emptyObs = produce(removed, draft => { deleteBatch.apply(draft); });
    expect(emptyObs['plan-of-action-and-milestones'].observations).toHaveLength(0);
  });

  it('risk actions work as expected', () => {
    const base = createBaseDoc();
    const addAction = addPOAMRisk({ uuid: 'risk-2', title: 'Data Leakage' });
    const added = produce(base, draft => { addAction.apply(draft); });
    expect(added['plan-of-action-and-milestones'].risks).toHaveLength(2);

    const updateAction = updatePOAMRisk('risk-2', { status: 'remediating' });
    const updated = produce(added, draft => { updateAction.apply(draft); });
    expect(updated['plan-of-action-and-milestones'].risks[1].status).toBe('remediating');

    const removeAction = removePOAMRisk('risk-1');
    const removed = produce(updated, draft => { removeAction.apply(draft); });
    expect(removed['plan-of-action-and-milestones'].risks).toHaveLength(1);

    const deleteBatch = deletePOAMRisks(['risk-2']);
    const emptyRisks = produce(removed, draft => { deleteBatch.apply(draft); });
    expect(emptyRisks['plan-of-action-and-milestones'].risks).toHaveLength(0);
  });

  it('scoping actions set import-ssp and system-id', () => {
    const base = createBaseDoc();
    const sspAction = setPOAMImportSSP('../ssps/target-ssp.json', 'Target production boundary');
    const withSsp = produce(base, draft => { sspAction.apply(draft); });
    expect(withSsp['plan-of-action-and-milestones']['import-ssp']?.href).toBe('../ssps/target-ssp.json');
    expect(withSsp['plan-of-action-and-milestones']['import-ssp']?.remarks).toBe('Target production boundary');

    const sysIdAction = setPOAMSystemId('SYS-PROD-01', 'internal-asset-id');
    const withSysId = produce(withSsp, draft => { sysIdAction.apply(draft); });
    expect(withSysId['plan-of-action-and-milestones']['system-id']?.id).toBe('SYS-PROD-01');
    expect(withSysId['plan-of-action-and-milestones']['system-id']?.['identifier-type']).toBe('internal-asset-id');
  });
});
