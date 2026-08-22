import { produce } from 'immer';
import {
  addGroup,
  addControl,
  removeControl,
  removeGroup,
  moveNode,
  withdrawControl,
  restoreControl
} from '../lib/document-actions/catalog-actions';

describe('Catalog Actions', () => {
  const createBaseCatalog = () => ({
    catalog: {
      uuid: 'cat-1',
      metadata: { title: 'Test Catalog', version: '1.0', 'oscal-version': '1.1.0' },
      groups: [
        {
          id: 'ac',
          title: 'Access Control',
          controls: [
            { id: 'ac-1', title: 'Policy and Procedures' },
            { id: 'ac-2', title: 'Account Management' }
          ],
          groups: [
            {
              id: 'ac-sub',
              title: 'Sub Group',
              controls: [{ id: 'ac-sub-1', title: 'Sub Control 1' }]
            }
          ]
        },
        {
          id: 'at',
          title: 'Awareness and Training',
          controls: [{ id: 'at-1', title: 'Training Policy' }]
        }
      ],
      controls: [
        { id: 'root-ctrl-1', title: 'Root Control' }
      ]
    }
  });

  it('adds a top-level group', () => {
    const doc = createBaseCatalog();
    const action = addGroup(null, { id: 'ia', title: 'Identification' });
    const next = produce(doc, (draft) => { action.apply(draft); });

    expect(next.catalog.groups.some((g: any) => g.id === 'ia')).toBe(true);
  });

  it('adds a nested sub-group to an existing group', () => {
    const doc = createBaseCatalog();
    const action = addGroup('ac', { id: 'ac-nested', title: 'Nested Group' });
    const next = produce(doc, (draft) => { action.apply(draft); });

    const acGroup = next.catalog.groups.find((g: any) => g.id === 'ac');
    expect(acGroup.groups.some((g: any) => g.id === 'ac-nested')).toBe(true);
  });

  it('adds a control to a group', () => {
    const doc = createBaseCatalog();
    const action = addControl('ac', { id: 'ac-3', title: 'Access Enforcement' });
    const next = produce(doc, (draft) => { action.apply(draft); });

    const acGroup = next.catalog.groups.find((g: any) => g.id === 'ac');
    expect(acGroup.controls.some((c: any) => c.id === 'ac-3')).toBe(true);
  });

  it('removes a control recursively', () => {
    const doc = createBaseCatalog();
    const action = removeControl('ac-sub-1');
    const next = produce(doc, (draft) => { action.apply(draft); });

    const acSub = next.catalog.groups[0].groups[0];
    expect(acSub.controls.some((c: any) => c.id === 'ac-sub-1')).toBe(false);
  });

  it('removes a group recursively', () => {
    const doc = createBaseCatalog();
    const action = removeGroup('ac-sub');
    const next = produce(doc, (draft) => { action.apply(draft); });

    const ac = next.catalog.groups.find((g: any) => g.id === 'ac');
    expect(ac.groups.some((g: any) => g.id === 'ac-sub')).toBe(false);
  });

  it('moves a control from one group to another', () => {
    const doc = createBaseCatalog();
    const action = moveNode('ac-2', 'at', 0);
    const next = produce(doc, (draft) => { action.apply(draft); });

    const ac = next.catalog.groups.find((g: any) => g.id === 'ac');
    const at = next.catalog.groups.find((g: any) => g.id === 'at');

    expect(ac.controls.some((c: any) => c.id === 'ac-2')).toBe(false);
    expect(at.controls[0].id).toBe('ac-2');
  });

  it('withdraws and restores a control', () => {
    const doc = createBaseCatalog();
    const withdrawAct = withdrawControl('ac-1', 'ac-2');
    const withdrawnDoc = produce(doc, (draft) => { withdrawAct.apply(draft); });

    const ac1 = withdrawnDoc.catalog.groups[0].controls[0];
    expect(ac1.props.some((p: any) => p.name === 'status' && p.value === 'withdrawn')).toBe(true);
    expect(ac1.links.some((l: any) => l.rel === 'incorporated-into' && l.href === '#ac-2')).toBe(true);

    const restoreAct = restoreControl('ac-1');
    const restoredDoc = produce(withdrawnDoc, (draft) => { restoreAct.apply(draft); });

    const ac1Restored = restoredDoc.catalog.groups[0].controls[0];
    expect(ac1Restored.props.some((p: any) => p.name === 'status' && p.value === 'withdrawn')).toBe(false);
  });
});
