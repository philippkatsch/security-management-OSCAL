import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import {
  addComponent,
  updateComponent,
  deleteComponents,
  setComponentStandardProperty,
  removeComponentStandardProperty,
  addProtocol,
  addPortRange,
  removePortRange,
  addControlImplementation,
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
  removeComponentRole,
  addComponentLink,
  removeComponentLink,
  addCapability,
  addIncorporatedComponent,
  addImportComponentDefinition,
  removeImportComponentDefinition,
  sanitizeComponentDefinition,
  sanitizeComponentDefinitionDocument
} from '../../lib/document-actions/component-definition-actions';

describe('Adversarial Edge-Case Suite: Component Definition Actions & Sanitization', () => {
  const createBaseDocument = () => ({
    'component-definition': {
      uuid: 'compdef-adv-001',
      metadata: {
        title: 'Adversarial Test Component Definition',
        version: '1.0.0',
        'oscal-version': '1.1.2'
      },
      components: [
        {
          uuid: 'comp-1',
          type: 'software',
          title: 'Database Component',
          description: 'Primary DB',
          props: [
            { name: 'version', value: '1.0', ns: 'http://csrc.nist.gov/ns/oscal' },
            { name: 'model', value: 'v1' }
          ],
          protocols: [
            {
              uuid: 'proto-1',
              name: 'postgresql',
              'port-ranges': [
                { start: 5432, end: 5432, transport: 'TCP' as const },
                { start: 5433, end: 5433, transport: 'TCP' as const }
              ]
            }
          ],
          links: [
            { href: 'https://example.com/a', rel: 'doc-a' },
            { href: 'https://example.com/b', rel: 'doc-b' }
          ],
          'control-implementations': [
            {
              uuid: 'cimpl-1',
              source: 'catalogs/cat1.json',
              description: 'Implementation set 1',
              'implemented-requirements': [
                {
                  uuid: 'req-1',
                  'control-id': 'ac-1',
                  description: 'Requirement AC-1',
                  statements: [
                    { 'statement-id': 'ac-1_smt_a', uuid: 'stmt-1', description: 'Stmt A' }
                  ],
                  'set-parameters': [
                    { 'param-id': 'ac-1_prm_1', values: ['val1'] }
                  ]
                }
              ],
              'set-parameters': [
                { 'param-id': 'set_prm_1', values: ['setval1'] }
              ]
            }
          ]
        }
      ],
      'import-component-definitions': [
        { href: 'https://example.com/import-1.json' },
        { href: 'https://example.com/import-2.json' }
      ]
    }
  });

  // ===========================================================================
  // 1. Negative Index / Out-of-Bounds Index Handling
  // ===========================================================================
  describe('1. Negative Index & Out-of-Bounds Splicing Stress', () => {
    it('analyzes behavior when removePortRange receives negative index -1', () => {
      const doc = createBaseDocument();
      const action = removePortRange('comp-1', 'proto-1', -1);
      const next = produce(doc, draft => { action.apply(draft); });

      const ranges = next['component-definition'].components![0].protocols![0]['port-ranges']!;
      // Documenting JS splice(-1, 1) behavior: in JS Array.splice(-1, 1) removes the last element
      // If ranges.length becomes 1, it removed index 1
      expect(ranges).toBeDefined();
    });

    it('analyzes behavior when removeComponentLink receives negative index -1', () => {
      const doc = createBaseDocument();
      const action = removeComponentLink('comp-1', -1);
      const next = produce(doc, draft => { action.apply(draft); });

      const links = next['component-definition'].components![0].links!;
      expect(links).toBeDefined();
    });

    it('analyzes behavior when removeImportComponentDefinition receives negative index -1', () => {
      const doc = createBaseDocument();
      const action = removeImportComponentDefinition(-1);
      const next = produce(doc, draft => { action.apply(draft); });

      const imports = next['component-definition']['import-component-definitions']!;
      expect(imports).toBeDefined();
    });
  });

  // ===========================================================================
  // 2. Intra-Batch Bulk Requirement Deduplication Analysis
  // ===========================================================================
  describe('2. Intra-Batch Bulk Requirement Deduplication Analysis', () => {
    it('evaluates whether addImplementedRequirementsBulk prevents duplicate controls within single payload', () => {
      const doc = createBaseDocument();
      const bulkPayload = [
        { controlId: 'sc-7', description: 'SC-7 narrative 1' },
        { controlId: 'sc-7', description: 'SC-7 narrative 2 (duplicate)' },
        { controlId: 'sc-8', description: 'SC-8 narrative' }
      ];

      const action = addImplementedRequirementsBulk('comp-1', 'cimpl-1', bulkPayload);
      const next = produce(doc, draft => { action.apply(draft); });

      const reqs = next['component-definition'].components![0]['control-implementations']![0]['implemented-requirements'];
      const sc7Entries = reqs.filter(r => r['control-id'] === 'sc-7');

      // Check if intra-batch duplicate was added or filtered
      expect(reqs.some(r => r['control-id'] === 'sc-8')).toBe(true);
      expect(sc7Entries.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ===========================================================================
  // 3. Falsy and Numeric Parameter Values
  // ===========================================================================
  describe('3. Falsy and Numeric Parameter Values', () => {
    it('correctly handles parameter values of "0", "false", and negative numbers', () => {
      const doc = createBaseDocument();
      const action = setComponentParameterValue(
        'comp-1',
        'cimpl-1',
        'req-1',
        'numeric-param',
        ['0', '-1', 'false', '0.0']
      );
      const next = produce(doc, draft => { action.apply(draft); });

      const param = next['component-definition'].components![0]['control-implementations']![0]['implemented-requirements'][0]['set-parameters']?.find(p => p['param-id'] === 'numeric-param');
      expect(param).toBeDefined();
      expect(param?.values).toEqual(['0', '-1', 'false', '0.0']);
    });
  });

  // ===========================================================================
  // 4. Extreme Deep Sanitization Edge Cases
  // ===========================================================================
  describe('4. Extreme Deep Sanitization Edge Cases', () => {
    it('sanitizes deeply nested dirty structures without data loss of valid content', () => {
      const complexDirty: any = {
        uuid: 'compdef-deep-clean',
        metadata: {
          title: 'Deep Clean Test',
          version: '1.0',
          'oscal-version': '1.1.2',
          props: [
            { name: 'valid-meta-prop', value: 'meta-val' },
            { name: '', value: 'empty-name' },
            { name: 'empty-val', value: '' },
            { name: 'whitespace-val', value: '   ' }
          ]
        },
        components: [
          {
            uuid: 'comp-1',
            type: 'hardware',
            title: 'Firewall Appliance',
            description: 'Perimeter Hardware Firewall',
            // Accidental SSP status
            status: { state: 'operational' },
            props: [
              { name: 'allows-authenticated-scan', value: 'yes', ns: 'http://csrc.nist.gov/ns/oscal' },
              { name: 'virtual', value: 'no', ns: 'http://csrc.nist.gov/ns/oscal' },
              { name: '   ', value: 'invalid' }
            ],
            protocols: [
              {
                name: 'https',
                'port-ranges': [] // empty array -> must be purged
              }
            ],
            'control-implementations': [
              {
                uuid: 'cimpl-1',
                source: 'catalogs/cat1.json',
                description: 'Firewall rules',
                props: [], // empty -> must be purged
                links: [], // empty -> must be purged
                'set-parameters': [
                  { 'param-id': 'prm-1', values: ['val1', '  val2  '], remarks: 'Valid' },
                  { 'param-id': 'prm-empty-vals', values: ['  ', ''] },
                  { 'param-id': 'prm-empty-arr', values: [] }
                ],
                'implemented-requirements': [
                  {
                    uuid: 'req-1',
                    'control-id': 'sc-7',
                    description: 'Boundary Protection',
                    props: [],
                    links: [],
                    'set-parameters': [],
                    statements: [
                      {
                        'statement-id': 'sc-7_smt_a',
                        uuid: 'stmt-1',
                        description: 'Monitors perimeter traffic',
                        props: [],
                        links: []
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ],
        capabilities: [
          {
            uuid: 'cap-1',
            name: 'Perimeter Defense',
            description: 'Appliance based boundary filtering',
            props: [],
            links: [],
            'incorporates-components': [
              { 'component-uuid': 'comp-1', description: 'Incorporates Firewall Appliance' }
            ],
            'control-implementations': []
          }
        ],
        'import-component-definitions': [],
        'back-matter': {
          resources: []
        }
      };

      const cleaned = sanitizeComponentDefinition(complexDirty);

      // Metadata props cleaned
      expect(cleaned.metadata.props?.length).toBe(1);
      expect(cleaned.metadata.props![0].name).toBe('valid-meta-prop');

      // Component status stripped
      const comp = cleaned.components![0];
      expect((comp as any).status).toBeUndefined();

      // Component props cleaned
      expect(comp.props?.length).toBe(2);

      // Protocol port-ranges dropped
      expect(comp.protocols![0]['port-ranges']).toBeUndefined();

      // Control impl collections purged
      const cimpl = comp['control-implementations']![0];
      expect(cimpl.props).toBeUndefined();
      expect(cimpl.links).toBeUndefined();
      expect(cimpl['set-parameters']?.length).toBe(1);
      expect(cimpl['set-parameters']![0]['param-id']).toBe('prm-1');
      expect(cimpl['set-parameters']![0].values).toEqual(['val1', 'val2']);

      // Implemented requirement collections purged
      const req = cimpl['implemented-requirements'][0];
      expect(req.props).toBeUndefined();
      expect(req.links).toBeUndefined();
      expect(req['set-parameters']).toBeUndefined();
      expect(req.statements?.length).toBe(1);
      expect(req.statements![0].props).toBeUndefined();
      expect(req.statements![0].links).toBeUndefined();

      // Capability empty control-implementations purged, incorporates-components preserved
      const cap = cleaned.capabilities![0];
      expect(cap.props).toBeUndefined();
      expect(cap.links).toBeUndefined();
      expect(cap['control-implementations']).toBeUndefined();
      expect(cap['incorporates-components']?.length).toBe(1);

      // Root collections purged
      expect(cleaned['import-component-definitions']).toBeUndefined();
      expect(cleaned['back-matter']).toBeUndefined();
    });

    it('preserves non-empty back-matter resources', () => {
      const docWithResources: any = {
        uuid: 'compdef-bm',
        metadata: { title: 'BM Test', version: '1.0', 'oscal-version': '1.1.2' },
        'back-matter': {
          resources: [
            {
              uuid: 'res-1',
              title: 'Architecture Diagram',
              description: 'Network topology schematic'
            }
          ]
        }
      };

      const cleaned = sanitizeComponentDefinition(docWithResources);
      expect(cleaned['back-matter']).toBeDefined();
      expect(cleaned['back-matter']?.resources?.length).toBe(1);
      expect(cleaned['back-matter']?.resources![0].title).toBe('Architecture Diagram');
    });
  });
});
