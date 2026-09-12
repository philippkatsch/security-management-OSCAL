import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import {
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
import { ComponentDefinition } from '../../lib/types/oscal';

describe('Milestone 1 Component Definition Actions & Sanitization Stress Suite', () => {
  const createBaseDocument = () => ({
    'component-definition': {
      uuid: '11111111-1111-4111-8111-111111111111',
      metadata: {
        title: 'Enterprise Component Definition',
        'last-modified': '2026-08-31T18:00:00Z',
        version: '1.0.0',
        'oscal-version': '1.1.2'
      },
      components: [],
      capabilities: [],
      'import-component-definitions': []
    } as ComponentDefinition
  });

  describe('DefinedComponent CRUD & Cascade Deletions', () => {
    it('creates components across standard and custom types', () => {
      let doc = createBaseDocument();

      // Add standard software component
      doc = produce(doc, addComponent({
        uuid: 'comp-software-1',
        type: 'software',
        title: 'PostgreSQL Database Engine',
        description: 'Relational database service'
      }).apply);

      // Add custom AI model component
      doc = produce(doc, addComponent({
        uuid: 'comp-custom-1',
        type: 'ai-reasoning-agent',
        title: 'Enterprise LLM Agent',
        description: 'Autonomous LLM agent'
      }).apply);

      const comps = doc['component-definition']!.components!;
      expect(comps).toHaveLength(2);
      expect(comps[0].type).toBe('software');
      expect(comps[1].type).toBe('ai-reasoning-agent');
    });

    it('updates component fields cleanly', () => {
      let doc = createBaseDocument();
      doc = produce(doc, addComponent({
        uuid: 'comp-1',
        type: 'hardware',
        title: 'Core Switch',
        description: 'Old description'
      }).apply);

      doc = produce(doc, updateComponent('comp-1', {
        title: 'Core L3 Switch',
        purpose: 'Network core routing'
      }).apply);

      const comp = doc['component-definition']!.components![0];
      expect(comp.title).toBe('Core L3 Switch');
      expect(comp.purpose).toBe('Network core routing');
      expect(comp.description).toBe('Old description');
    });

    it('deletes components and cascades to capability incorporates-components', () => {
      let doc = createBaseDocument();
      doc = produce(doc, addComponent({ uuid: 'comp-1', type: 'software', title: 'C1', description: 'D1' }).apply);
      doc = produce(doc, addComponent({ uuid: 'comp-2', type: 'service', title: 'C2', description: 'D2' }).apply);
      doc = produce(doc, addCapability({ uuid: 'cap-1', name: 'IAM', description: 'IAM Capability' }).apply);

      doc = produce(doc, addIncorporatedComponent('cap-1', 'comp-1', 'Incorporates C1').apply);
      doc = produce(doc, addIncorporatedComponent('cap-1', 'comp-2', 'Incorporates C2').apply);

      expect(doc['component-definition']!.capabilities![0]['incorporates-components']).toHaveLength(2);

      // Delete comp-1
      doc = produce(doc, deleteComponents(['comp-1']).apply);

      expect(doc['component-definition']!.components).toHaveLength(1);
      expect(doc['component-definition']!.components![0].uuid).toBe('comp-2');

      // Capability incorporates-components must have purged comp-1
      const capIncorp = doc['component-definition']!.capabilities![0]['incorporates-components']!;
      expect(capIncorp).toHaveLength(1);
      expect(capIncorp[0]['component-uuid']).toBe('comp-2');
    });
  });

  describe('Standard Property Palette Mutators', () => {
    it('sets, updates, and removes standard properties with oscal namespace', () => {
      let doc = createBaseDocument();
      doc = produce(doc, addComponent({ uuid: 'comp-1', type: 'software', title: 'C1', description: 'D1' }).apply);

      // Add standard property
      doc = produce(doc, setComponentStandardProperty('comp-1', 'version', '2.5.0').apply);
      doc = produce(doc, setComponentStandardProperty('comp-1', 'implementation-point', 'internal').apply);

      let props = doc['component-definition']!.components![0].props!;
      expect(props).toHaveLength(2);
      expect(props[0]).toEqual({ name: 'version', value: '2.5.0', ns: 'http://csrc.nist.gov/ns/oscal' });
      expect(props[1]).toEqual({ name: 'implementation-point', value: 'internal', ns: 'http://csrc.nist.gov/ns/oscal' });

      // Update existing property
      doc = produce(doc, setComponentStandardProperty('comp-1', 'version', '2.6.0').apply);
      props = doc['component-definition']!.components![0].props!;
      expect(props).toHaveLength(2);
      expect(props.find(p => p.name === 'version')?.value).toBe('2.6.0');

      // Remove property by empty value or remove mutator
      doc = produce(doc, removeComponentStandardProperty('comp-1', 'version').apply);
      props = doc['component-definition']!.components![0].props!;
      expect(props).toHaveLength(1);
      expect(props.find(p => p.name === 'version')).toBeUndefined();
    });
  });

  describe('Protocols and Port Ranges', () => {
    it('applies protocol templates and modifies port ranges', () => {
      let doc = createBaseDocument();
      doc = produce(doc, addComponent({ uuid: 'comp-1', type: 'service', title: 'Web App', description: 'Web' }).apply);

      // Apply MongoDB template
      doc = produce(doc, applyProtocolTemplate('comp-1', {
        name: 'mongodb',
        title: 'MongoDB Database Protocol',
        start: 27017,
        end: 27017,
        transport: 'TCP'
      }).apply);

      const proto = doc['component-definition']!.components![0].protocols![0];
      expect(proto.name).toBe('mongodb');
      expect(proto['port-ranges']).toHaveLength(1);
      expect(proto['port-ranges']![0]).toEqual({ start: 27017, end: 27017, transport: 'TCP' });

      // Add secondary port range
      doc = produce(doc, addPortRange('comp-1', proto.uuid!, { start: 27018, end: 27019, transport: 'TCP' }).apply);
      expect(doc['component-definition']!.components![0].protocols![0]['port-ranges']).toHaveLength(2);

      // Update port range
      doc = produce(doc, updatePortRange('comp-1', proto.uuid!, 1, { end: 27020 }).apply);
      expect(doc['component-definition']!.components![0].protocols![0]['port-ranges']![1].end).toBe(27020);

      // Remove port range
      doc = produce(doc, removePortRange('comp-1', proto.uuid!, 0).apply);
      expect(doc['component-definition']!.components![0].protocols![0]['port-ranges']).toHaveLength(1);
      expect(doc['component-definition']!.components![0].protocols![0]['port-ranges']![0].start).toBe(27018);
    });
  });

  describe('Control Implementations, Requirements, Statements, and Parameters', () => {
    it('supports full hierarchical lifecycle from implementation set to statement-level override', () => {
      let doc = createBaseDocument();
      doc = produce(doc, addComponent({ uuid: 'comp-1', type: 'software', title: 'IAM', description: 'IAM' }).apply);

      // Add control implementation set
      doc = produce(doc, addControlImplementation('comp-1', {
        uuid: 'impl-1',
        source: 'https://example.com/catalog.json',
        description: 'NIST 800-53 Rev 5 Impl'
      }).apply);

      // Bulk add implemented requirements
      doc = produce(doc, addImplementedRequirementsBulk('comp-1', 'impl-1', [
        { controlId: 'ac-1', description: 'Access control policy' },
        { controlId: 'ac-2', description: 'Account management' }
      ]).apply);

      let reqs = doc['component-definition']!.components![0]['control-implementations']![0]['implemented-requirements'];
      expect(reqs).toHaveLength(2);
      expect(reqs[0]['control-id']).toBe('ac-1');
      expect(reqs[1]['control-id']).toBe('ac-2');

      const ac1Uuid = reqs[0].uuid;

      // Add statement to AC-1
      doc = produce(doc, addStatement('comp-1', 'impl-1', ac1Uuid, {
        'statement-id': 'ac-1_smt_a',
        description: 'Detailed statement narrative'
      }).apply);

      let stmts = doc['component-definition']!.components![0]['control-implementations']![0]['implemented-requirements'][0].statements!;
      expect(stmts).toHaveLength(1);
      expect(stmts[0]['statement-id']).toBe('ac-1_smt_a');

      // Set parameter at requirement level
      doc = produce(doc, setComponentParameterValue('comp-1', 'impl-1', ac1Uuid, 'ac-1_prm_1', ['30 days'], 'Quarterly review').apply);
      let setParams = doc['component-definition']!.components![0]['control-implementations']![0]['implemented-requirements'][0]['set-parameters']!;
      expect(setParams).toHaveLength(1);
      expect(setParams[0]).toEqual({
        'param-id': 'ac-1_prm_1',
        values: ['30 days'],
        remarks: 'Quarterly review'
      });

      // Set parameter at control implementation set level (reqUuid = null)
      doc = produce(doc, setComponentParameterValue('comp-1', 'impl-1', null, 'global_prm_1', ['org-wide']).apply);
      let globalParams = doc['component-definition']!.components![0]['control-implementations']![0]['set-parameters']!;
      expect(globalParams).toHaveLength(1);
      expect(globalParams[0]['param-id']).toBe('global_prm_1');

      // Purge parameter by setting empty values
      doc = produce(doc, setComponentParameterValue('comp-1', 'impl-1', ac1Uuid, 'ac-1_prm_1', []).apply);
      setParams = doc['component-definition']!.components![0]['control-implementations']![0]['implemented-requirements'][0]['set-parameters']!;
      expect(setParams).toHaveLength(0);
    });
  });

  describe('Sanitization Pipeline (DD-014 Empty Array Purging & Schema Defense)', () => {
    it('purges empty arrays, strips status, and normalizes props & parameters', () => {
      const dirtyDoc: any = {
        uuid: '11111111-1111-4111-8111-111111111111',
        metadata: {
          title: 'Dirty Doc',
          'last-modified': '2026-08-31T18:00:00Z',
          version: '1.0.0',
          'oscal-version': '1.1.2',
          props: [] // empty array
        },
        components: [
          {
            uuid: 'comp-1',
            type: 'software',
            title: 'Cleaned Component',
            description: 'Description',
            status: 'operational', // FORBIDDEN SSP FIELD
            props: [
              { name: 'valid-prop', value: 'yes' },
              { name: 'empty-val-prop', value: '   ' },
              { name: '   ', value: 'no-name' }
            ],
            links: [], // empty array
            'responsible-roles': [], // empty array
            protocols: [], // empty array
            'control-implementations': [
              {
                uuid: 'impl-1',
                source: 'https://example.com/catalog.json',
                description: 'Impl description',
                'set-parameters': [
                  { 'param-id': 'p1', values: ['   ', 'val1', ''] },
                  { 'param-id': 'p2', values: ['', '   '] }, // empty after cleaning -> must be purged
                  { 'param-id': '', values: ['val3'] } // missing param-id -> must be purged
                ],
                'implemented-requirements': [
                  {
                    uuid: 'req-1',
                    'control-id': 'ac-1',
                    description: 'Req description',
                    statements: [], // empty array
                    'set-parameters': [] // empty array
                  }
                ]
              }
            ]
          }
        ],
        'back-matter': {} // empty object -> must be purged
      };

      const cleaned = sanitizeComponentDefinition(dirtyDoc);

      // Status must be stripped
      expect(cleaned.components![0]).not.toHaveProperty('status');

      // Empty arrays must be pruned
      expect(cleaned.components![0]).not.toHaveProperty('links');
      expect(cleaned.components![0]).not.toHaveProperty('responsible-roles');
      expect(cleaned.components![0]).not.toHaveProperty('protocols');
      expect(cleaned.metadata).not.toHaveProperty('props');
      expect(cleaned).not.toHaveProperty('back-matter');

      // Props must contain only valid entries
      expect(cleaned.components![0].props).toHaveLength(1);
      expect(cleaned.components![0].props![0]).toEqual({ name: 'valid-prop', value: 'yes' });

      // Set-parameters must contain only p1 with cleaned values
      const cleanedParams = cleaned.components![0]['control-implementations']![0]['set-parameters']!;
      expect(cleanedParams).toHaveLength(1);
      expect(cleanedParams[0]).toEqual({ 'param-id': 'p1', values: ['val1'] });

      // Implemented requirement empty statements and set-parameters pruned
      const req = cleaned.components![0]['control-implementations']![0]['implemented-requirements'][0];
      expect(req).not.toHaveProperty('statements');
      expect(req).not.toHaveProperty('set-parameters');
    });

    it('sanitizes document wrapper with sanitizeComponentDefinitionDocument', () => {
      const fullDoc = {
        'component-definition': {
          uuid: '11111111-1111-4111-8111-111111111111',
          metadata: {
            title: 'Doc',
            'last-modified': '2026-08-31T18:00:00Z',
            version: '1.0.0',
            'oscal-version': '1.1.2'
          },
          components: [
            {
              uuid: 'comp-1',
              type: 'software',
              title: 'C1',
              description: 'D1',
              status: 'under-development'
            } as any
          ]
        }
      };

      const sanitized = sanitizeComponentDefinitionDocument(fullDoc);
      expect(sanitized['component-definition'].components[0]).not.toHaveProperty('status');
    });

    it('prunes control-implementation sets lacking implemented-requirements to prevent schema crashes', () => {
      const docWithEmptyImpls = {
        uuid: '11111111-1111-4111-8111-111111111111',
        metadata: {
          title: 'Doc with empty impls',
          'last-modified': '2026-08-31T18:00:00Z',
          version: '1.0.0',
          'oscal-version': '1.1.2'
        },
        components: [
          {
            uuid: 'comp-1',
            type: 'software',
            title: 'Comp 1',
            description: 'Desc 1',
            'control-implementations': [
              {
                uuid: 'ci-empty',
                source: 'https://example.com/cat',
                description: 'Empty set',
                'implemented-requirements': [] // empty requirements -> must prune this CI
              },
              {
                uuid: 'ci-valid',
                source: '',
                description: '',
                'implemented-requirements': [
                  {
                    uuid: 'req-1',
                    'control-id': 'ac-1',
                    description: 'Valid req'
                  }
                ]
              }
            ]
          } as any
        ],
        capabilities: [
          {
            uuid: 'cap-1',
            name: 'Cap 1',
            description: 'Cap desc',
            'control-implementations': [
              {
                uuid: 'ci-cap-empty',
                source: 'https://example.com',
                description: 'No reqs',
                'implemented-requirements': []
              }
            ]
          } as any
        ]
      };

      const cleaned = sanitizeComponentDefinition(docWithEmptyImpls as any);

      // In comp-1, ci-empty was pruned; ci-valid was kept and ensured with source & description fallbacks
      expect(cleaned.components![0]['control-implementations']).toHaveLength(1);
      expect(cleaned.components![0]['control-implementations']![0].uuid).toBe('ci-valid');
      expect(cleaned.components![0]['control-implementations']![0].source).toBeTruthy();
      expect(cleaned.components![0]['control-implementations']![0].description).toBeTruthy();

      // In cap-1, ci-cap-empty was pruned, so control-implementations was completely removed (optional array)
      expect(cleaned.capabilities![0]).not.toHaveProperty('control-implementations');
    });

    it('ensures incorporates-components descriptions and prunes invalid/empty entries', () => {
      const docWithIncorp = {
        uuid: '11111111-1111-4111-8111-111111111111',
        metadata: {
          title: 'Doc with incorp',
          'last-modified': '2026-08-31T18:00:00Z',
          version: '1.0.0',
          'oscal-version': '1.1.2'
        },
        capabilities: [
          {
            uuid: 'cap-incorp',
            name: 'Incorp Cap',
            description: 'Capability',
            'incorporates-components': [
              {
                'component-uuid': 'comp-1',
                description: '   ' // whitespace -> must receive default description
              },
              {
                'component-uuid': 'comp-2' // missing description -> must receive default description
              },
              {
                description: 'no uuid' // missing component-uuid -> must be pruned
              }
            ],
            links: [
              { href: 'https://example.com' },
              { href: '   ' } // empty href -> must be pruned
            ]
          } as any
        ]
      };

      const cleaned = sanitizeComponentDefinition(docWithIncorp as any);

      const cap = cleaned.capabilities![0];
      expect(cap['incorporates-components']).toHaveLength(2);
      expect(cap['incorporates-components']![0]['component-uuid']).toBe('comp-1');
      expect(cap['incorporates-components']![0].description).toBe('Component role in capability.');
      expect(cap['incorporates-components']![1]['component-uuid']).toBe('comp-2');
      expect(cap['incorporates-components']![1].description).toBe('Component role in capability.');

      expect(cap.links).toHaveLength(1);
      expect(cap.links![0].href).toBe('https://example.com');
    });
  });
});
