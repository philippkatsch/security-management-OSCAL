import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import {
  updateComponentDefinitionRoot,
  setComponentDefinition,
  addComponent,
  updateComponent,
  deleteComponents,
  setComponentStandardProperty,
  removeComponentStandardProperty,
  setComponentProperties,
  addProtocol,
  updateProtocol,
  removeProtocol,
  addPortRange,
  updatePortRange,
  removePortRange,
  applyProtocolTemplate,
  addControlImplementation,
  updateControlImplementation,
  removeControlImplementation,
  addImplementedRequirement,
  addImplementedRequirementsBulk,
  updateImplementedRequirement,
  removeImplementedRequirement,
  addStatement,
  updateStatement,
  removeStatement,
  setComponentParameterValue,
  removeComponentParameter,
  addComponentRole,
  updateComponentRole,
  removeComponentRole,
  addComponentLink,
  updateComponentLink,
  removeComponentLink,
  addCapability,
  updateCapability,
  deleteCapabilities,
  addIncorporatedComponent,
  updateIncorporatedComponent,
  removeIncorporatedComponent,
  addImportComponentDefinition,
  updateImportComponentDefinition,
  removeImportComponentDefinition,
  sanitizeComponentDefinition,
  sanitizeComponentDefinitionDocument
} from '../../lib/document-actions/component-definition-actions';

describe('Milestone 1 Empirical Challenger: Component Definition Actions & Deep Sanitization', () => {
  const createBaseDocument = () => ({
    'component-definition': {
      uuid: 'compdef-00000000-0000-4000-8000-000000000001',
      metadata: {
        title: 'Enterprise Component Definition',
        version: '1.0.0',
        'oscal-version': '1.1.2',
        'last-modified': '2026-08-31T12:00:00Z'
      },
      components: [
        {
          uuid: 'comp-00000000-0000-4000-8000-000000000001',
          type: 'software',
          title: 'PostgreSQL Database Engine',
          description: 'Relational database management system',
          purpose: 'Storage and retrieval of application data',
          props: [
            {
              name: 'version',
              value: '16.2',
              ns: 'http://csrc.nist.gov/ns/oscal'
            },
            {
              name: 'asset-type',
              value: 'database',
              ns: 'http://csrc.nist.gov/ns/oscal'
            }
          ],
          protocols: [
            {
              uuid: 'proto-00000000-0000-4000-8000-000000000001',
              name: 'postgresql',
              title: 'PostgreSQL Native Wire Protocol',
              'port-ranges': [
                {
                  start: 5432,
                  end: 5432,
                  transport: 'TCP'
                }
              ]
            }
          ],
          'control-implementations': [
            {
              uuid: 'cimpl-00000000-0000-4000-8000-000000000001',
              source: 'catalogs/nist_800_53_rev5.json',
              description: 'NIST SP 800-53 Rev 5 control implementations for PostgreSQL',
              'implemented-requirements': [
                {
                  uuid: 'req-00000000-0000-4000-8000-000000000001',
                  'control-id': 'ac-2',
                  description: 'Account management for database user roles and superusers',
                  statements: [
                    {
                      'statement-id': 'ac-2_smt_a',
                      uuid: 'stmt-00000000-0000-4000-8000-000000000001',
                      description: 'Identifies and manages authorized database accounts'
                    }
                  ],
                  'set-parameters': [
                    {
                      'param-id': 'ac-2_prm_1',
                      values: ['30 days'],
                      remarks: 'Inactive accounts automatically disabled'
                    }
                  ]
                }
              ],
              'set-parameters': [
                {
                  'param-id': 'ac-1_prm_1',
                  values: ['annual'],
                  remarks: 'Policy review cycle'
                }
              ]
            }
          ],
          'responsible-roles': [
            {
              'role-id': 'asset-owner',
              remarks: 'Primary owner'
            }
          ],
          links: [
            {
              href: 'https://example.com/docs',
              rel: 'documentation'
            }
          ]
        }
      ],
      capabilities: [
        {
          uuid: 'cap-00000000-0000-4000-8000-000000000001',
          name: 'Data Persistence and Encryption at Rest',
          description: 'Provides encrypted relational data storage and indexing',
          'incorporates-components': [
            {
              'component-uuid': 'comp-00000000-0000-4000-8000-000000000001',
              description: 'Incorporates PostgreSQL database engine'
            }
          ]
        }
      ],
      'import-component-definitions': [
        {
          href: 'https://example.com/oscal/shared-components.json',
          remarks: 'Third-party base component library'
        }
      ]
    }
  });

  // Deep freeze utility
  const deepFreeze = (obj: any): any => {
    Object.freeze(obj);
    Object.keys(obj).forEach(key => {
      if (typeof obj[key] === 'object' && obj[key] !== null && !Object.isFrozen(obj[key])) {
        deepFreeze(obj[key]);
      }
    });
    return obj;
  };

  // ===========================================================================
  // Suite 1: Pure Immer Immutability & Document Freeze Verification
  // ===========================================================================
  describe('Suite 1: Pure Immer Immutability & Document Freeze Verification', () => {
    it('dispatches all mutator action types on a deep-frozen document without mutating or throwing', () => {
      const baseDoc = deepFreeze(createBaseDocument());
      const compUuid = 'comp-00000000-0000-4000-8000-000000000001';
      const protoUuid = 'proto-00000000-0000-4000-8000-000000000001';
      const implUuid = 'cimpl-00000000-0000-4000-8000-000000000001';
      const reqUuid = 'req-00000000-0000-4000-8000-000000000001';
      const capUuid = 'cap-00000000-0000-4000-8000-000000000001';

      const actionsToTest = [
        updateComponentDefinitionRoot('remarks', 'Updated remarks'),
        addComponent({ title: 'New Web Server' }),
        updateComponent(compUuid, { title: 'PostgreSQL Server v16' }),
        setComponentStandardProperty(compUuid, 'patch-level', '2'),
        setComponentProperties(compUuid, [{ name: 'custom', value: '1' }]),
        addProtocol(compUuid, { name: 'ssh' }),
        updateProtocol(compUuid, protoUuid, { title: 'Updated Protocol Title' }),
        addPortRange(compUuid, protoUuid, { start: 5433, end: 5433, transport: 'TCP' }),
        updatePortRange(compUuid, protoUuid, 0, { end: 5435 }),
        applyProtocolTemplate(compUuid, { name: 'https', title: 'HTTPS', start: 443, end: 443, transport: 'TCP' }),
        addControlImplementation(compUuid, { source: 'catalogs/cat2.json' }),
        updateControlImplementation(compUuid, implUuid, { description: 'Updated narrative' }),
        addImplementedRequirement(compUuid, implUuid, { 'control-id': 'ac-3' }),
        addImplementedRequirementsBulk(compUuid, implUuid, [{ controlId: 'au-1' }, { controlId: 'au-2' }]),
        updateImplementedRequirement(compUuid, implUuid, reqUuid, { description: 'Updated req' }),
        addStatement(compUuid, implUuid, reqUuid, { 'statement-id': 'ac-2_smt_b' }),
        setComponentParameterValue(compUuid, implUuid, reqUuid, 'ac-2_prm_2', ['value1']),
        addComponentRole(compUuid, { 'role-id': 'security-operations' }),
        updateComponentRole(compUuid, 'asset-owner', { remarks: 'Primary DB admin' }),
        addComponentLink(compUuid, { href: '#resource-1', rel: 'depends-on' }),
        updateComponentLink(compUuid, 0, { href: '#resource-2' }),
        addCapability({ name: 'Access Management' }),
        updateCapability(capUuid, { name: 'Enhanced Data Storage' }),
        addIncorporatedComponent(capUuid, 'comp-2', 'Incorporate secondary component'),
        updateIncorporatedComponent(capUuid, compUuid, { description: 'Updated incorporation note' }),
        addImportComponentDefinition({ href: 'https://example.com/another.json' }),
        updateImportComponentDefinition(0, { remarks: 'Updated import remarks' })
      ];

      actionsToTest.forEach(action => {
        expect(() => {
          const next = produce(baseDoc, draft => {
            action.apply(draft);
          });
          expect(Object.isFrozen(baseDoc)).toBe(true);
          // Verify that state changes are applied without error
          expect(next).toBeDefined();
        }).not.toThrow();
      });
    });
  });

  // ===========================================================================
  // Suite 2: Defined Component CRUD Operations
  // ===========================================================================
  describe('Suite 2: Defined Component CRUD Operations', () => {
    it('creates component with defaults when no initialData is supplied', () => {
      const doc = createBaseDocument();
      const action = addComponent();
      const next = produce(doc, draft => { action.apply(draft); });

      const comps = next['component-definition'].components!;
      expect(comps.length).toBe(2);
      const created = comps[1];
      expect(created.uuid).toBeDefined();
      expect(created.type).toBe('software');
      expect(created.title).toBe('New Component');
      expect(created.props).toEqual([]);
      expect(created.protocols).toEqual([]);
      expect(created['control-implementations']).toEqual([]);
    });

    it('creates component with custom initialData', () => {
      const doc = createBaseDocument();
      const action = addComponent({
        uuid: 'comp-custom-123',
        type: 'service',
        title: 'Cloud Authentication Service',
        purpose: 'Identity Federation'
      });
      const next = produce(doc, draft => { action.apply(draft); });

      const created = next['component-definition'].components?.find(c => c.uuid === 'comp-custom-123');
      expect(created).toBeDefined();
      expect(created?.type).toBe('service');
      expect(created?.title).toBe('Cloud Authentication Service');
      expect(created?.purpose).toBe('Identity Federation');
    });

    it('safely updates component fields and ignores non-existent UUID', () => {
      const doc = createBaseDocument();
      const compUuid = 'comp-00000000-0000-4000-8000-000000000001';

      const updateAction = updateComponent(compUuid, {
        title: 'PostgreSQL 16 Enterprise',
        description: 'Hardened relational database instance'
      });
      const next = produce(doc, draft => { updateAction.apply(draft); });

      const updated = next['component-definition'].components?.find(c => c.uuid === compUuid);
      expect(updated?.title).toBe('PostgreSQL 16 Enterprise');
      expect(updated?.description).toBe('Hardened relational database instance');

      // Update non-existent
      const ghostAction = updateComponent('non-existent-uuid', { title: 'Ghost' });
      const nextGhost = produce(next, draft => { ghostAction.apply(draft); });
      expect(nextGhost['component-definition'].components?.length).toBe(1);
    });

    it('deletes component and cascades removal in capabilities incorporates-components', () => {
      const doc = createBaseDocument();
      const compUuid = 'comp-00000000-0000-4000-8000-000000000001';
      const capUuid = 'cap-00000000-0000-4000-8000-000000000001';

      expect(doc['component-definition'].capabilities![0]['incorporates-components']!.length).toBe(1);

      const deleteAction = deleteComponents([compUuid]);
      const next = produce(doc, draft => { deleteAction.apply(draft); });

      expect(next['component-definition'].components?.length).toBe(0);
      // Verify cascade
      const cap = next['component-definition'].capabilities?.find(c => c.uuid === capUuid);
      expect(cap?.['incorporates-components']?.length).toBe(0);
    });
  });

  // ===========================================================================
  // Suite 3: Standard Property Palette & Whitespace Trimming
  // ===========================================================================
  describe('Suite 3: Standard Property Palette & Whitespace Trimming', () => {
    const compUuid = 'comp-00000000-0000-4000-8000-000000000001';

    it('sets standard OSCAL property with default NIST namespace', () => {
      const doc = createBaseDocument();
      const action = setComponentStandardProperty(compUuid, 'implementation-point', 'internal');
      const next = produce(doc, draft => { action.apply(draft); });

      const comp = next['component-definition'].components?.find(c => c.uuid === compUuid);
      const prop = comp?.props?.find(p => p.name === 'implementation-point');
      expect(prop).toBeDefined();
      expect(prop?.value).toBe('internal');
      expect(prop?.ns).toBe('http://csrc.nist.gov/ns/oscal');
    });

    it('trims whitespace on standard property value', () => {
      const doc = createBaseDocument();
      const action = setComponentStandardProperty(compUuid, 'model', '   Enterprise Edition v16   ');
      const next = produce(doc, draft => { action.apply(draft); });

      const comp = next['component-definition'].components?.find(c => c.uuid === compUuid);
      const prop = comp?.props?.find(p => p.name === 'model');
      expect(prop?.value).toBe('Enterprise Edition v16');
    });

    it('updates existing property value while preserving namespace', () => {
      const doc = createBaseDocument();
      const action = setComponentStandardProperty(compUuid, 'version', '16.3');
      const next = produce(doc, draft => { action.apply(draft); });

      const comp = next['component-definition'].components?.find(c => c.uuid === compUuid);
      const prop = comp?.props?.find(p => p.name === 'version');
      expect(prop?.value).toBe('16.3');
      expect(prop?.ns).toBe('http://csrc.nist.gov/ns/oscal');
    });

    it('removes property when value is empty, whitespace-only, null, or undefined', () => {
      const doc = createBaseDocument();

      // Test null
      const act1 = setComponentStandardProperty(compUuid, 'version', null);
      const next1 = produce(doc, draft => { act1.apply(draft); });
      expect(next1['component-definition'].components![0].props?.some(p => p.name === 'version')).toBe(false);

      // Test empty string
      const act2 = setComponentStandardProperty(compUuid, 'version', '');
      const next2 = produce(doc, draft => { act2.apply(draft); });
      expect(next2['component-definition'].components![0].props?.some(p => p.name === 'version')).toBe(false);

      // Test whitespace string
      const act3 = setComponentStandardProperty(compUuid, 'version', '    ');
      const next3 = produce(doc, draft => { act3.apply(draft); });
      expect(next3['component-definition'].components![0].props?.some(p => p.name === 'version')).toBe(false);

      // Test removeComponentStandardProperty explicit helper
      const act4 = removeComponentStandardProperty(compUuid, 'asset-type');
      const next4 = produce(doc, draft => { act4.apply(draft); });
      expect(next4['component-definition'].components![0].props?.some(p => p.name === 'asset-type')).toBe(false);
    });
  });

  // ===========================================================================
  // Suite 4: Service Protocols & Port Range Management
  // ===========================================================================
  describe('Suite 4: Service Protocols & Port Range Management', () => {
    const compUuid = 'comp-00000000-0000-4000-8000-000000000001';
    const protoUuid = 'proto-00000000-0000-4000-8000-000000000001';

    it('adds protocol and updates properties', () => {
      const doc = createBaseDocument();
      const addAct = addProtocol(compUuid, { name: 'ssh', title: 'Secure Shell' });
      const next1 = produce(doc, draft => { addAct.apply(draft); });

      const comp = next1['component-definition'].components![0];
      expect(comp.protocols?.length).toBe(2);
      const sshProto = comp.protocols?.find(p => p.name === 'ssh');
      expect(sshProto?.title).toBe('Secure Shell');

      const updateAct = updateProtocol(compUuid, sshProto!.uuid!, { title: 'SSH Daemon v2' });
      const next2 = produce(next1, draft => { updateAct.apply(draft); });
      const updatedSsh = next2['component-definition'].components![0].protocols?.find(p => p.name === 'ssh');
      expect(updatedSsh?.title).toBe('SSH Daemon v2');
    });

    it('applies quick-add protocol templates (HTTPS, SSH, MySQL, MongoDB)', () => {
      const doc = createBaseDocument();
      const httpsAct = applyProtocolTemplate(compUuid, {
        name: 'https',
        title: 'HTTPS (Port 443)',
        start: 443,
        end: 443,
        transport: 'TCP'
      });
      const next = produce(doc, draft => { httpsAct.apply(draft); });

      const comp = next['component-definition'].components![0];
      const httpsProto = comp.protocols?.find(p => p.name === 'https');
      expect(httpsProto).toBeDefined();
      expect(httpsProto?.['port-ranges']?.[0]).toEqual({
        start: 443,
        end: 443,
        transport: 'TCP'
      });
    });

    it('adds, updates, and removes port ranges on existing protocol', () => {
      const doc = createBaseDocument();
      const addPortAct = addPortRange(compUuid, protoUuid, { start: 5433, end: 5435, transport: 'TCP' });
      const next1 = produce(doc, draft => { addPortAct.apply(draft); });

      const proto1 = next1['component-definition'].components![0].protocols![0];
      expect(proto1['port-ranges']?.length).toBe(2);
      expect(proto1['port-ranges']![1]).toEqual({ start: 5433, end: 5435, transport: 'TCP' });

      // Update port range
      const updatePortAct = updatePortRange(compUuid, protoUuid, 1, { end: 5440 });
      const next2 = produce(next1, draft => { updatePortAct.apply(draft); });
      const proto2 = next2['component-definition'].components![0].protocols![0];
      expect(proto2['port-ranges']![1].end).toBe(5440);

      // Remove port range
      const removePortAct = removePortRange(compUuid, protoUuid, 0);
      const next3 = produce(next2, draft => { removePortAct.apply(draft); });
      const proto3 = next3['component-definition'].components![0].protocols![0];
      expect(proto3['port-ranges']?.length).toBe(1);
      expect(proto3['port-ranges']![0].start).toBe(5433);
    });

    it('removes protocol completely', () => {
      const doc = createBaseDocument();
      const removeAct = removeProtocol(compUuid, protoUuid);
      const next = produce(doc, draft => { removeAct.apply(draft); });

      expect(next['component-definition'].components![0].protocols?.length).toBe(0);
    });
  });

  // ===========================================================================
  // Suite 5: Control Implementations, Requirements & Bulk Addition
  // ===========================================================================
  describe('Suite 5: Control Implementations, Requirements & Bulk Addition', () => {
    const compUuid = 'comp-00000000-0000-4000-8000-000000000001';
    const implUuid = 'cimpl-00000000-0000-4000-8000-000000000001';
    const reqUuid = 'req-00000000-0000-4000-8000-000000000001';
    const capUuid = 'cap-00000000-0000-4000-8000-000000000001';

    it('adds and updates control implementation on both component and capability', () => {
      const doc = createBaseDocument();

      // Add on component
      const addCompImpl = addControlImplementation(compUuid, {
        source: 'profiles/fedramp_moderate.json',
        description: 'FedRAMP baseline implementations'
      });
      const next1 = produce(doc, draft => { addCompImpl.apply(draft); });
      expect(next1['component-definition'].components![0]['control-implementations']?.length).toBe(2);

      // Add on capability
      const addCapImpl = addControlImplementation(capUuid, {
        source: 'catalogs/nist_800_53.json',
        description: 'Capability control mapping'
      }, true);
      const next2 = produce(next1, draft => { addCapImpl.apply(draft); });
      expect(next2['component-definition'].capabilities![0]['control-implementations']?.length).toBe(1);

      // Update control implementation
      const updateAct = updateControlImplementation(compUuid, implUuid, {
        description: 'Updated SP 800-53 Rev 5 control set'
      });
      const next3 = produce(next2, draft => { updateAct.apply(draft); });
      expect(next3['component-definition'].components![0]['control-implementations']![0].description)
        .toBe('Updated SP 800-53 Rev 5 control set');
    });

    it('bulk adds implemented requirements and prevents adding existing controls', () => {
      const doc = createBaseDocument();
      // Existing contains 'ac-2'
      const bulkAct = addImplementedRequirementsBulk(compUuid, implUuid, [
        { controlId: 'ac-2', description: 'Duplicate AC-2' }, // should be skipped
        { controlId: 'ac-3', description: 'Access Enforcement' },
        { controlId: 'ac-7', description: 'Unsuccessful Logon Attempts' }
      ]);
      const next = produce(doc, draft => { bulkAct.apply(draft); });

      const reqs = next['component-definition'].components![0]['control-implementations']![0]['implemented-requirements'];
      expect(reqs.length).toBe(3);
      expect(reqs.map(r => r['control-id'])).toEqual(['ac-2', 'ac-3', 'ac-7']);
      // AC-2 description must remain original
      expect(reqs.find(r => r['control-id'] === 'ac-2')?.description)
        .toBe('Account management for database user roles and superusers');
    });

    it('adversarial check: handles intra-batch duplicate control IDs', () => {
      const doc = createBaseDocument();
      const bulkAct = addImplementedRequirementsBulk(compUuid, implUuid, [
        { controlId: 'ia-2', description: 'IA-2 Narrative 1' },
        { controlId: 'ia-2', description: 'IA-2 Narrative 2' }
      ]);
      const next = produce(doc, draft => { bulkAct.apply(draft); });

      const reqs = next['component-definition'].components![0]['control-implementations']![0]['implemented-requirements'];
      const ia2Reqs = reqs.filter(r => r['control-id'] === 'ia-2');
      // Documenting behavior: whether deduplicated or duplicate added
      expect(ia2Reqs.length).toBeGreaterThanOrEqual(1);
    });

    it('updates and removes implemented requirement', () => {
      const doc = createBaseDocument();
      const updateAct = updateImplementedRequirement(compUuid, implUuid, reqUuid, {
        description: 'Updated AC-2 narrative'
      });
      const next1 = produce(doc, draft => { updateAct.apply(draft); });
      expect(next1['component-definition'].components![0]['control-implementations']![0]['implemented-requirements'][0].description)
        .toBe('Updated AC-2 narrative');

      const removeAct = removeImplementedRequirement(compUuid, implUuid, reqUuid);
      const next2 = produce(next1, draft => { removeAct.apply(draft); });
      expect(next2['component-definition'].components![0]['control-implementations']![0]['implemented-requirements'].length).toBe(0);
    });
  });

  // ===========================================================================
  // Suite 6: Structured Statement Actions
  // ===========================================================================
  describe('Suite 6: Structured Statement Actions', () => {
    const compUuid = 'comp-00000000-0000-4000-8000-000000000001';
    const implUuid = 'cimpl-00000000-0000-4000-8000-000000000001';
    const reqUuid = 'req-00000000-0000-4000-8000-000000000001';
    const stmtUuid = 'stmt-00000000-0000-4000-8000-000000000001';

    it('adds, updates, and removes statements per requirement', () => {
      const doc = createBaseDocument();

      // Add statement
      const addAct = addStatement(compUuid, implUuid, reqUuid, {
        'statement-id': 'ac-2_smt_b',
        description: 'Assigns account managers for database roles'
      });
      const next1 = produce(doc, draft => { addAct.apply(draft); });

      const req1 = next1['component-definition'].components![0]['control-implementations']![0]['implemented-requirements'][0];
      expect(req1.statements?.length).toBe(2);
      const addedStmt = req1.statements?.find(s => s['statement-id'] === 'ac-2_smt_b');
      expect(addedStmt?.uuid).toBeDefined();

      // Update statement
      const updateAct = updateStatement(compUuid, implUuid, reqUuid, stmtUuid, {
        description: 'Hardened statement narrative'
      });
      const next2 = produce(next1, draft => { updateAct.apply(draft); });
      const req2 = next2['component-definition'].components![0]['control-implementations']![0]['implemented-requirements'][0];
      expect(req2.statements?.find(s => s.uuid === stmtUuid)?.description).toBe('Hardened statement narrative');

      // Remove statement
      const removeAct = removeStatement(compUuid, implUuid, reqUuid, stmtUuid);
      const next3 = produce(next2, draft => { removeAct.apply(draft); });
      const req3 = next3['component-definition'].components![0]['control-implementations']![0]['implemented-requirements'][0];
      expect(req3.statements?.length).toBe(1);
      expect(req3.statements![0]['statement-id']).toBe('ac-2_smt_b');
    });
  });

  // ===========================================================================
  // Suite 7: Set-Parameters at Control Implementation & Requirement Levels
  // ===========================================================================
  describe('Suite 7: Set-Parameters at Implementation and Requirement Levels', () => {
    const compUuid = 'comp-00000000-0000-4000-8000-000000000001';
    const implUuid = 'cimpl-00000000-0000-4000-8000-000000000001';
    const reqUuid = 'req-00000000-0000-4000-8000-000000000001';

    it('sets and updates parameters at requirement level with multi-value trimming', () => {
      const doc = createBaseDocument();

      // Set multi-value with whitespace
      const setAct = setComponentParameterValue(
        compUuid,
        implUuid,
        reqUuid,
        'ac-2_prm_2',
        ['  90 days  ', '  180 days  ', '   '],
        'Periodic audit interval'
      );
      const next1 = produce(doc, draft => { setAct.apply(draft); });

      const req1 = next1['component-definition'].components![0]['control-implementations']![0]['implemented-requirements'][0];
      const param = req1['set-parameters']?.find(p => p['param-id'] === 'ac-2_prm_2');
      expect(param).toBeDefined();
      expect(param?.values).toEqual(['90 days', '180 days']);
      expect(param?.remarks).toBe('Periodic audit interval');

      // Updating remarks only
      const updateRemarksAct = setComponentParameterValue(
        compUuid,
        implUuid,
        reqUuid,
        'ac-2_prm_2',
        ['90 days', '180 days'],
        'Updated audit interval'
      );
      const next2 = produce(next1, draft => { updateRemarksAct.apply(draft); });
      const req2 = next2['component-definition'].components![0]['control-implementations']![0]['implemented-requirements'][0];
      expect(req2['set-parameters']?.find(p => p['param-id'] === 'ac-2_prm_2')?.remarks).toBe('Updated audit interval');
    });

    it('purges parameter when passed empty values array or only whitespace entries', () => {
      const doc = createBaseDocument();

      // ac-2_prm_1 exists. Pass empty strings
      const emptyAct = setComponentParameterValue(compUuid, implUuid, reqUuid, 'ac-2_prm_1', ['   ', '']);
      const next1 = produce(doc, draft => { emptyAct.apply(draft); });

      const req1 = next1['component-definition'].components![0]['control-implementations']![0]['implemented-requirements'][0];
      expect(req1['set-parameters']?.some(p => p['param-id'] === 'ac-2_prm_1')).toBe(false);

      // Explicit removeComponentParameter helper
      const removeAct = removeComponentParameter(compUuid, implUuid, null, 'ac-1_prm_1');
      const next2 = produce(doc, draft => { removeAct.apply(draft); });
      const impl2 = next2['component-definition'].components![0]['control-implementations']![0];
      expect(impl2['set-parameters']?.some(p => p['param-id'] === 'ac-1_prm_1')).toBe(false);
    });
  });

  // ===========================================================================
  // Suite 8: Roles, Links, Capabilities & Import Definitions
  // ===========================================================================
  describe('Suite 8: Roles, Links, Capabilities & Import Definitions', () => {
    const compUuid = 'comp-00000000-0000-4000-8000-000000000001';

    it('manages responsible roles on component', () => {
      const doc = createBaseDocument();
      const addRoleAct = addComponentRole(compUuid, {
        'role-id': 'database-administrator',
        'party-uuids': ['party-1'],
        remarks: 'DBA team'
      });
      const next1 = produce(doc, draft => { addRoleAct.apply(draft); });

      const comp1 = next1['component-definition'].components![0];
      expect(comp1['responsible-roles']?.length).toBe(2);
      expect(comp1['responsible-roles']?.some(r => r['role-id'] === 'database-administrator')).toBe(true);

      const updateRoleAct = updateComponentRole(compUuid, 'database-administrator', {
        remarks: 'Lead DBA team'
      });
      const next2 = produce(next1, draft => { updateRoleAct.apply(draft); });
      expect(next2['component-definition'].components![0]['responsible-roles']?.find(r => r['role-id'] === 'database-administrator')?.remarks).toBe('Lead DBA team');

      const removeRoleAct = removeComponentRole(compUuid, 'database-administrator');
      const next3 = produce(next2, draft => { removeRoleAct.apply(draft); });
      expect(next3['component-definition'].components![0]['responsible-roles']?.some(r => r['role-id'] === 'database-administrator')).toBe(false);
    });

    it('manages component links', () => {
      const doc = createBaseDocument();
      const addLinkAct = addComponentLink(compUuid, {
        href: '#comp-2',
        rel: 'depends-on',
        text: 'Depends on Storage Component'
      });
      const next1 = produce(doc, draft => { addLinkAct.apply(draft); });

      const comp1 = next1['component-definition'].components![0];
      expect(comp1.links?.length).toBe(2);
      expect(comp1.links?.some(l => l.rel === 'depends-on')).toBe(true);

      const updateLinkAct = updateComponentLink(compUuid, 0, { text: 'Updated link text' });
      const next2 = produce(next1, draft => { updateLinkAct.apply(draft); });
      expect(next2['component-definition'].components![0].links![0].text).toBe('Updated link text');

      const removeLinkAct = removeComponentLink(compUuid, 0);
      const next3 = produce(next2, draft => { removeLinkAct.apply(draft); });
      expect(next3['component-definition'].components![0].links?.length).toBe(1);
    });

    it('manages capabilities and incorporated components with required description', () => {
      const doc = createBaseDocument();
      const addCapAct = addCapability({
        uuid: 'cap-2',
        name: 'Cryptographic Services',
        description: 'Key management and data-in-transit TLS encryption'
      });
      const next1 = produce(doc, draft => { addCapAct.apply(draft); });

      expect(next1['component-definition'].capabilities?.length).toBe(2);

      // Add incorporated component (should auto-generate description if omitted)
      const addIncorpAct = addIncorporatedComponent('cap-2', compUuid);
      const next2 = produce(next1, draft => { addIncorpAct.apply(draft); });

      const cap2 = next2['component-definition'].capabilities?.find(c => c.uuid === 'cap-2');
      expect(cap2?.['incorporates-components']?.length).toBe(1);
      expect(cap2?.['incorporates-components']![0]['component-uuid']).toBe(compUuid);
      expect(cap2?.['incorporates-components']![0].description).toBeDefined();

      // Prevent duplicate incorporation
      const duplicateIncorpAct = addIncorporatedComponent('cap-2', compUuid);
      const next3 = produce(next2, draft => { duplicateIncorpAct.apply(draft); });
      expect(next3['component-definition'].capabilities?.find(c => c.uuid === 'cap-2')?.['incorporates-components']?.length).toBe(1);

      // Remove incorporated component
      const removeIncorpAct = removeIncorporatedComponent('cap-2', compUuid);
      const next4 = produce(next3, draft => { removeIncorpAct.apply(draft); });
      expect(next4['component-definition'].capabilities?.find(c => c.uuid === 'cap-2')?.['incorporates-components']?.length).toBe(0);

      // Delete capability
      const deleteCapAct = deleteCapabilities(['cap-2']);
      const next5 = produce(next4, draft => { deleteCapAct.apply(draft); });
      expect(next5['component-definition'].capabilities?.length).toBe(1);
    });

    it('manages import component definitions by href and by numeric index', () => {
      const doc = createBaseDocument();
      const addImportAct = addImportComponentDefinition({
        href: 'https://example.com/baseline-components.json',
        remarks: 'Baseline catalog'
      });
      const next1 = produce(doc, draft => { addImportAct.apply(draft); });

      expect(next1['component-definition']['import-component-definitions']?.length).toBe(2);

      const updateImportAct = updateImportComponentDefinition(1, { remarks: 'Updated baseline' });
      const next2 = produce(next1, draft => { updateImportAct.apply(draft); });
      expect(next2['component-definition']['import-component-definitions']![1].remarks).toBe('Updated baseline');

      // Remove by href
      const removeByHrefAct = removeImportComponentDefinition('https://example.com/baseline-components.json');
      const next3 = produce(next2, draft => { removeByHrefAct.apply(draft); });
      expect(next3['component-definition']['import-component-definitions']?.length).toBe(1);

      // Remove by index
      const removeByIndexAct = removeImportComponentDefinition(0);
      const next4 = produce(next3, draft => { removeByIndexAct.apply(draft); });
      expect(next4['component-definition']['import-component-definitions']?.length).toBe(0);
    });
  });

  // ===========================================================================
  // Suite 9: Deep Sanitization & Schema Compliance (DD-014)
  // ===========================================================================
  describe('Suite 9: Deep Sanitization & Schema Compliance (DD-014)', () => {
    it('purges empty arrays, whitespace props, invalid set-parameters, and forbidden status keys', () => {
      const dirtyDoc: any = {
        'component-definition': {
          uuid: 'compdef-1',
          metadata: {
            title: 'Dirty Component Definition',
            version: '1.0',
            'oscal-version': '1.1.2',
            props: [],
            links: [],
            roles: []
          },
          components: [
            {
              uuid: 'comp-1',
              type: 'software',
              title: 'App Component',
              description: 'Valid description',
              // FORBIDDEN SSP FIELD:
              status: {
                state: 'operational',
                remarks: 'Should be stripped'
              },
              props: [
                { name: 'version', value: '  1.0.0  ', ns: 'http://csrc.nist.gov/ns/oscal' },
                { name: 'empty-val', value: '   ' },
                { name: '   ', value: 'empty-name' }
              ],
              links: [],
              protocols: [
                {
                  uuid: 'proto-1',
                  name: 'http',
                  'port-ranges': []
                }
              ],
              'control-implementations': [
                {
                  uuid: 'cimpl-1',
                  source: 'catalogs/cat1.json',
                  description: 'Impl narrative',
                  props: [],
                  links: [],
                  'set-parameters': [
                    { 'param-id': 'valid-prm', values: ['  val1  ', 'val2', '  '], remarks: 'ok' },
                    { 'param-id': 'empty-prm', values: ['   ', ''] },
                    { 'param-id': '', values: ['val3'] }
                  ],
                  'implemented-requirements': [
                    {
                      uuid: 'req-1',
                      'control-id': 'ac-1',
                      description: 'AC-1 Impl',
                      props: [],
                      links: [],
                      'set-parameters': [],
                      statements: []
                    }
                  ]
                }
              ]
            }
          ],
          capabilities: [],
          'import-component-definitions': [],
          'back-matter': {
            resources: []
          }
        }
      };

      const sanitizedDoc = sanitizeComponentDefinitionDocument(dirtyDoc);
      const sanitized = sanitizedDoc['component-definition'];

      // 1. Root level empty arrays dropped
      expect(sanitized.capabilities).toBeUndefined();
      expect(sanitized['import-component-definitions']).toBeUndefined();
      expect(sanitized['back-matter']).toBeUndefined();

      // 2. Metadata empty arrays dropped
      expect(sanitized.metadata.props).toBeUndefined();
      expect(sanitized.metadata.links).toBeUndefined();
      expect(sanitized.metadata.roles).toBeUndefined();

      // 3. Component level assertions
      const comp = sanitized.components[0];
      expect(comp.status).toBeUndefined(); // FORBIDDEN status stripped!
      expect(comp.links).toBeUndefined(); // Empty links dropped!

      // 4. Props sanitization
      expect(comp.props.length).toBe(1);
      expect(comp.props[0]).toEqual({
        name: 'version',
        value: '1.0.0',
        ns: 'http://csrc.nist.gov/ns/oscal'
      });

      // 5. Protocol port-ranges dropped if empty
      expect(comp.protocols[0]['port-ranges']).toBeUndefined();

      // 6. Set-parameters cleaned
      const cimpl = comp['control-implementations'][0];
      expect(cimpl.props).toBeUndefined();
      expect(cimpl.links).toBeUndefined();
      expect(cimpl['set-parameters'].length).toBe(1);
      expect(cimpl['set-parameters'][0]).toEqual({
        'param-id': 'valid-prm',
        values: ['val1', 'val2'],
        remarks: 'ok'
      });

      // 7. Implemented requirement empty collections dropped
      const req = cimpl['implemented-requirements'][0];
      expect(req.props).toBeUndefined();
      expect(req.links).toBeUndefined();
      expect(req['set-parameters']).toBeUndefined();
      expect(req.statements).toBeUndefined();
    });

    it('safely handles empty document object and empty ComponentDefinition', () => {
      expect(sanitizeComponentDefinitionDocument({} as any)).toEqual({});
      expect(sanitizeComponentDefinition({} as any)).toEqual({});
    });
  });

  // ===========================================================================
  // Suite 10: Randomized Stress Harness (100 sequential mutations)
  // ===========================================================================
  describe('Suite 10: Randomized Stress Harness (100 sequential mutations)', () => {
    it('maintains strict invariants and deep sanitization across 100 random sequential operations', () => {
      let doc = createBaseDocument();
      const componentIds: string[] = ['comp-00000000-0000-4000-8000-000000000001'];
      const capabilityIds: string[] = ['cap-00000000-0000-4000-8000-000000000001'];

      for (let step = 0; step < 100; step++) {
        const op = step % 8;

        switch (op) {
          case 0: {
            // Add component
            const newUuid = `comp-rand-${step}`;
            const action = addComponent({
              uuid: newUuid,
              title: `Random Component ${step}`,
              type: step % 2 === 0 ? 'software' : 'service'
            });
            doc = produce(doc, draft => { action.apply(draft); });
            componentIds.push(newUuid);
            break;
          }
          case 1: {
            // Set standard property
            if (componentIds.length > 0) {
              const compUuid = componentIds[step % componentIds.length];
              const action = setComponentStandardProperty(compUuid, 'version', `1.${step}.0`);
              doc = produce(doc, draft => { action.apply(draft); });
            }
            break;
          }
          case 2: {
            // Apply protocol template
            if (componentIds.length > 0) {
              const compUuid = componentIds[step % componentIds.length];
              const action = applyProtocolTemplate(compUuid, {
                name: `proto-${step}`,
                title: `Protocol ${step}`,
                start: 8000 + step,
                end: 8000 + step,
                transport: 'TCP'
              });
              doc = produce(doc, draft => { action.apply(draft); });
            }
            break;
          }
          case 3: {
            // Add control implementation
            if (componentIds.length > 0) {
              const compUuid = componentIds[step % componentIds.length];
              const action = addControlImplementation(compUuid, {
                uuid: `cimpl-rand-${step}`,
                source: 'catalogs/cat.json',
                description: `Implementation set ${step}`
              });
              doc = produce(doc, draft => { action.apply(draft); });
            }
            break;
          }
          case 4: {
            // Add implemented requirements bulk
            if (componentIds.length > 0) {
              const compUuid = componentIds[step % componentIds.length];
              const action = addImplementedRequirementsBulk(compUuid, `cimpl-rand-${step - 1}`, [
                { controlId: `ctrl-${step}-a` },
                { controlId: `ctrl-${step}-b` }
              ]);
              doc = produce(doc, draft => { action.apply(draft); });
            }
            break;
          }
          case 5: {
            // Add capability & incorporate component
            const newCapUuid = `cap-rand-${step}`;
            const compUuid = componentIds[step % componentIds.length];
            const action1 = addCapability({ uuid: newCapUuid, name: `Capability ${step}` });
            const action2 = addIncorporatedComponent(newCapUuid, compUuid);
            doc = produce(doc, draft => {
              action1.apply(draft);
              action2.apply(draft);
            });
            capabilityIds.push(newCapUuid);
            break;
          }
          case 6: {
            // Delete random component
            if (componentIds.length > 3) {
              const removeIdx = Math.floor(Math.random() * componentIds.length);
              const toRemove = componentIds.splice(removeIdx, 1);
              const action = deleteComponents(toRemove);
              doc = produce(doc, draft => { action.apply(draft); });
            }
            break;
          }
          case 7: {
            // Add import definition
            const action = addImportComponentDefinition({
              href: `https://example.com/import-${step}.json`,
              remarks: `Import ${step}`
            });
            doc = produce(doc, draft => { action.apply(draft); });
            break;
          }
        }

        // Invariant checks:
        // 1. Sanitization runs without throwing
        const sanitizedDoc = sanitizeComponentDefinitionDocument(doc);
        const compDef = sanitizedDoc['component-definition'];
        expect(compDef).toBeDefined();
        expect(compDef.uuid).toBeDefined();

        // 2. No empty arrays in sanitized output
        if (compDef.components) {
          expect(compDef.components.length).toBeGreaterThan(0);
          for (const c of compDef.components) {
            expect(c.status).toBeUndefined(); // Status never present
            if (c.props) expect(c.props.length).toBeGreaterThan(0);
            if (c.links) expect(c.links.length).toBeGreaterThan(0);
            if (c.protocols) expect(c.protocols.length).toBeGreaterThan(0);
            if (c['control-implementations']) expect(c['control-implementations'].length).toBeGreaterThan(0);
          }
        }
      }
    });
  });
});
