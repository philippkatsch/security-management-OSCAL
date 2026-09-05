import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import {
  setSystemName,
  setSystemShortName,
  setSystemDescription,
  setSystemIds,
  addSystemId,
  removeSystemId,
  setSystemStatus,
  setSecuritySensitivityLevel,
  setDateAuthorized,
  setSecurityImpactLevel,
  addInformationType,
  updateInformationType,
  removeInformationType,
  setAuthorizationBoundary,
  addDiagram,
  addDiagramWithResource,
  removeDiagram,
  removeDiagramWithResource,
  setNetworkArchitecture,
  setDataFlow,
  setResponsibleParties,
  addResponsibleParty,
  removeResponsibleParty,
  initializeSSPComponents,
  addSystemComponent,
  updateSystemComponent,
  removeSystemComponent,
  addSystemUser,
  updateSystemUser,
  removeSystemUser,
  addInventoryItem,
  updateInventoryItem,
  removeInventoryItem,
  addLeveragedAuthorization,
  updateLeveragedAuthorization,
  removeLeveragedAuthorization,
  setImportProfile,
  setControlImplementationDescription,
  upsertImplementedRequirement,
  removeImplementedRequirement,
  addByComponent,
  updateByComponent,
  removeByComponent,
  addStatementByComponent,
  updateStatementByComponent,
  removeStatementByComponent,
  setSSPParameterValue,
  setSecurityInheritance,
  purgeSSPEmptyArrays,
  cleanSSPEmptyArrays,
  updateSSPField,
  updateSSPListItem,
  replaceSSP
} from '../../lib/document-actions/ssp-actions';
import { SystemSecurityPlan } from '../../lib/types/oscal';

function createSampleSSP(): { 'system-security-plan': SystemSecurityPlan } {
  return {
    'system-security-plan': {
      uuid: 'ssp-0000-1111-2222-3333',
      metadata: {
        title: 'Sample Enterprise System Security Plan',
        version: '1.0.0',
        'oscal-version': '1.1.2'
      },
      'import-profile': {
        href: '../profiles/nist_800_53_rev5_moderate.json'
      },
      'system-characteristics': {
        'system-ids': [
          { id: 'SYS-001', 'identifier-type': 'https://fedramp.gov' }
        ],
        'system-name': 'Sample Core Platform',
        'system-name-short': 'SCP',
        description: 'Core cloud enterprise management platform',
        'security-sensitivity-level': 'moderate',
        'date-authorized': '2026-01-15',
        status: {
          state: 'operational'
        },
        'system-information': {
          'information-types': [
            {
              uuid: 'inf-001',
              title: 'Customer Data',
              description: 'Customer records and transaction logs',
              categorizations: [
                {
                  system: 'http://doi.org/10.6028/NIST.SP.800-60v2r1',
                  'information-type-ids': ['C.3.5.8']
                }
              ],
              'confidentiality-impact': { base: 'fips-199-moderate' },
              'integrity-impact': { base: 'fips-199-moderate' },
              'availability-impact': { base: 'fips-199-low' }
            }
          ]
        },
        'security-impact-level': {
          'security-objective-confidentiality': 'fips-199-moderate',
          'security-objective-integrity': 'fips-199-moderate',
          'security-objective-availability': 'fips-199-low'
        },
        'authorization-boundary': {
          description: 'Production AWS VPC boundary with dual ingress proxies',
          diagrams: [
            {
              uuid: 'diag-001',
              caption: 'Logical Boundary Diagram',
              description: 'High-level network boundary'
            }
          ]
        }
      },
      'system-implementation': {
        users: [
          {
            uuid: 'user-001',
            title: 'System Administrator',
            'short-name': 'SysAdmin',
            'role-ids': ['admin'],
            'authorized-privileges': [
              {
                title: 'Full Infrastructure Access',
                'functions-performed': ['Deploy services', 'Manage credentials']
              }
            ]
          }
        ],
        components: [
          {
            uuid: 'comp-this-sys',
            type: 'this-system',
            title: 'Sample Core Platform',
            description: 'The complete system entity',
            status: { state: 'operational' }
          },
          {
            uuid: 'comp-db-001',
            type: 'software',
            title: 'PostgreSQL Database Engine',
            description: 'Primary relational data store',
            status: { state: 'operational' }
          }
        ],
        'inventory-items': [
          {
            uuid: 'inv-001',
            description: 'Primary Production DB Instance',
            'implemented-components': [
              { 'component-uuid': 'comp-db-001' }
            ]
          }
        ],
        'leveraged-authorizations': [
          {
            uuid: 'lev-001',
            title: 'AWS GovCloud IaaS',
            'party-uuid': 'party-aws-001',
            'date-authorized': '2025-06-01'
          }
        ]
      },
      'control-implementation': {
        description: 'Implementation documentation for Moderate Baseline',
        'set-parameters': [
          {
            'param-id': 'ac-1_prm_1',
            values: ['annually']
          }
        ],
        'implemented-requirements': [
          {
            uuid: 'req-ac-1',
            'control-id': 'ac-1',
            'by-components': [
              {
                uuid: 'bc-ac-1-sys',
                'component-uuid': 'comp-this-sys',
                description: 'Access control policy is reviewed and updated annually by the ISSO.',
                'implementation-status': {
                  state: 'implemented'
                }
              }
            ]
          },
          {
            uuid: 'req-ac-2',
            'control-id': 'ac-2',
            'set-parameters': [
              {
                'param-id': 'ac-2_prm_1',
                values: ['monthly']
              }
            ],
            statements: [
              {
                uuid: 'stmt-ac-2-a',
                'statement-id': 'ac-2_smt_a',
                'by-components': [
                  {
                    uuid: 'bc-ac-2-a-db',
                    'component-uuid': 'comp-db-001',
                    description: 'Database administrator accounts are provisioned via IAM RBAC.',
                    'implementation-status': {
                      state: 'implemented'
                    }
                  }
                ]
              }
            ],
            'by-components': [
              {
                uuid: 'bc-ac-2-sys',
                'component-uuid': 'comp-this-sys',
                description: 'General system account management procedure.',
                'implementation-status': {
                  state: 'implemented'
                }
              }
            ]
          }
        ]
      }
    }
  };
}

describe('OSCAL SSP Document Actions Suite (FE-SSP-02)', () => {
  describe('State Immutability', () => {
    it('produces deep-frozen mutated drafts without mutating original state', () => {
      const original = createSampleSSP();
      const action = setSystemName('Updated Platform Name');
      const next = produce(original, draft => {
        action.apply(draft);
      });

      expect(original['system-security-plan']['system-characteristics']['system-name']).toBe('Sample Core Platform');
      expect(next['system-security-plan']['system-characteristics']['system-name']).toBe('Updated Platform Name');
      expect(next).not.toBe(original);
    });
  });

  describe('1. System Characteristics Actions', () => {
    it('updates system name, short name, and description', () => {
      const state = createSampleSSP();
      const next1 = produce(state, draft => {
        setSystemName('NextGen Secure Core').apply(draft);
        setSystemShortName('NGSC').apply(draft);
        setSystemDescription('Next generation microservices mesh.').apply(draft);
      });

      const sysChar = next1['system-security-plan']['system-characteristics'];
      expect(sysChar['system-name']).toBe('NextGen Secure Core');
      expect(sysChar['system-name-short']).toBe('NGSC');
      expect(sysChar.description).toBe('Next generation microservices mesh.');
    });

    it('removes short name when given empty string', () => {
      const state = createSampleSSP();
      const next = produce(state, draft => {
        setSystemShortName('').apply(draft);
      });

      expect(next['system-security-plan']['system-characteristics']['system-name-short']).toBeUndefined();
    });

    it('sets, adds, and removes system IDs', () => {
      const state = createSampleSSP();

      // Add ID
      const next1 = produce(state, draft => {
        addSystemId({ id: 'SYS-002', 'identifier-type': 'https://ietf.org/rfc/rfc4122' }).apply(draft);
      });
      expect(next1['system-security-plan']['system-characteristics']['system-ids']).toHaveLength(2);
      expect(next1['system-security-plan']['system-characteristics']['system-ids'][1].id).toBe('SYS-002');

      // Remove ID
      const next2 = produce(next1, draft => {
        removeSystemId('SYS-001').apply(draft);
      });
      expect(next2['system-security-plan']['system-characteristics']['system-ids']).toHaveLength(1);
      expect(next2['system-security-plan']['system-characteristics']['system-ids'][0].id).toBe('SYS-002');

      // Overwrite all IDs
      const next3 = produce(next2, draft => {
        setSystemIds([{ id: 'SYS-REPLACE' }]).apply(draft);
      });
      expect(next3['system-security-plan']['system-characteristics']['system-ids']).toEqual([{ id: 'SYS-REPLACE' }]);
    });

    it('sets system operational status and remarks', () => {
      const state = createSampleSSP();
      const next1 = produce(state, draft => {
        setSystemStatus('under-major-modification', 'Migrating to Kubernetes cluster').apply(draft);
      });

      const status = next1['system-security-plan']['system-characteristics'].status;
      expect(status.state).toBe('under-major-modification');
      expect(status.remarks).toBe('Migrating to Kubernetes cluster');

      // Object format
      const next2 = produce(state, draft => {
        setSystemStatus({ state: 'disposition', remarks: 'Decommissioning planned for Q4' }).apply(draft);
      });
      expect(next2['system-security-plan']['system-characteristics'].status.state).toBe('disposition');
      expect(next2['system-security-plan']['system-characteristics'].status.remarks).toBe('Decommissioning planned for Q4');
    });

    it('sets security sensitivity level, date authorized, and security impact levels', () => {
      const state = createSampleSSP();
      const next = produce(state, draft => {
        setSecuritySensitivityLevel('high').apply(draft);
        setDateAuthorized('2026-08-30').apply(draft);
        setSecurityImpactLevel({
          'security-objective-confidentiality': 'fips-199-high',
          'security-objective-integrity': 'fips-199-high',
          'security-objective-availability': 'fips-199-moderate'
        }).apply(draft);
      });

      const sysChar = next['system-security-plan']['system-characteristics'];
      expect(sysChar['security-sensitivity-level']).toBe('high');
      expect(sysChar['date-authorized']).toBe('2026-08-30');
      expect(sysChar['security-impact-level']?.['security-objective-confidentiality']).toBe('fips-199-high');
      expect(sysChar['security-impact-level']?.['security-objective-integrity']).toBe('fips-199-high');
      expect(sysChar['security-impact-level']?.['security-objective-availability']).toBe('fips-199-moderate');
    });

    it('performs CRUD operations on information types', () => {
      const state = createSampleSSP();

      // Add information type
      const next1 = produce(state, draft => {
        addInformationType({
          uuid: 'inf-002',
          title: 'Financial Records',
          description: 'Billing and invoicing information',
          categorizations: [
            { system: 'http://doi.org/10.6028/NIST.SP.800-60v2r1', 'information-type-ids': ['C.3.5.1'] }
          ],
          'confidentiality-impact': { base: 'fips-199-high' },
          'integrity-impact': { base: 'fips-199-high' },
          'availability-impact': { base: 'fips-199-moderate' }
        }).apply(draft);
      });

      const infoTypes1 = next1['system-security-plan']['system-characteristics']['system-information']['information-types'];
      expect(infoTypes1).toHaveLength(2);
      expect(infoTypes1[1].title).toBe('Financial Records');

      // Update by UUID
      const next2 = produce(next1, draft => {
        updateInformationType('inf-002', { title: 'Audited Financial Records' }).apply(draft);
      });
      expect(next2['system-security-plan']['system-characteristics']['system-information']['information-types'][1].title).toBe('Audited Financial Records');

      // Update by index
      const next3 = produce(next2, draft => {
        updateInformationType(0, { description: 'Updated customer description' }).apply(draft);
      });
      expect(next3['system-security-plan']['system-characteristics']['system-information']['information-types'][0].description).toBe('Updated customer description');

      // Remove by UUID
      const next4 = produce(next3, draft => {
        removeInformationType('inf-001').apply(draft);
      });
      expect(next4['system-security-plan']['system-characteristics']['system-information']['information-types']).toHaveLength(1);
      expect(next4['system-security-plan']['system-characteristics']['system-information']['information-types'][0].uuid).toBe('inf-002');

      // Remove by index
      const next5 = produce(next4, draft => {
        removeInformationType(0).apply(draft);
      });
      expect(next5['system-security-plan']['system-characteristics']['system-information']['information-types']).toHaveLength(0);
    });

    it('sets authorization boundary, network architecture, and data flow narratives & diagrams', () => {
      const state = createSampleSSP();
      const next1 = produce(state, draft => {
        setAuthorizationBoundary('Updated boundary description').apply(draft);
        setNetworkArchitecture('Three-tier DMZ with private subnets').apply(draft);
        setDataFlow('TLS 1.3 encrypted REST and gRPC flows').apply(draft);
      });

      const sysChar = next1['system-security-plan']['system-characteristics'];
      expect(sysChar['authorization-boundary'].description).toBe('Updated boundary description');
      expect(sysChar['network-architecture']?.description).toBe('Three-tier DMZ with private subnets');
      expect(sysChar['data-flow']?.description).toBe('TLS 1.3 encrypted REST and gRPC flows');

      // Add and remove diagrams across containers
      const next2 = produce(next1, draft => {
        addDiagram('network-architecture', {
          uuid: 'diag-net-001',
          caption: 'Network Topology',
          description: 'VPC topology diagram'
        }).apply(draft);
        addDiagram('data-flow', {
          uuid: 'diag-df-001',
          caption: 'Data Flow Diagram',
          description: 'Customer PII data pipeline'
        }).apply(draft);
      });

      expect(next2['system-security-plan']['system-characteristics']['network-architecture']?.diagrams).toHaveLength(1);
      expect(next2['system-security-plan']['system-characteristics']['data-flow']?.diagrams).toHaveLength(1);

      const next3 = produce(next2, draft => {
        removeDiagram('network-architecture', 'diag-net-001').apply(draft);
        removeDiagram('authorization-boundary', 'diag-001').apply(draft);
      });

      expect(next3['system-security-plan']['system-characteristics']['network-architecture']?.diagrams).toHaveLength(0);
      expect(next3['system-security-plan']['system-characteristics']['authorization-boundary'].diagrams).toHaveLength(0);

      // Atomic add and remove diagram with back-matter resource
      const next4 = produce(next3, draft => {
        addDiagramWithResource(
          'authorization-boundary',
          {
            uuid: 'diag-auth-002',
            caption: 'Atomic Boundary Diagram',
            links: [{ rel: 'diagram', href: '#res-002' }]
          },
          {
            uuid: 'res-002',
            title: 'atomic-diagram.png',
            rlinks: [{ href: 'data:image/png;base64,sample' }]
          }
        ).apply(draft);
      });

      expect(next4['system-security-plan']['system-characteristics']['authorization-boundary'].diagrams).toHaveLength(1);
      expect(next4['system-security-plan']['back-matter']?.resources).toHaveLength(1);
      expect(next4['system-security-plan']['back-matter']?.resources?.[0].uuid).toBe('res-002');

      const next5 = produce(next4, draft => {
        removeDiagramWithResource('authorization-boundary', 'diag-auth-002', 'res-002').apply(draft);
      });

      expect(next5['system-security-plan']['system-characteristics']['authorization-boundary'].diagrams).toHaveLength(0);
      expect(next5['system-security-plan']['back-matter']?.resources).toHaveLength(0);
    });

    it('manages responsible parties', () => {
      const state = createSampleSSP();
      const next1 = produce(state, draft => {
        setResponsibleParties([
          { 'role-id': 'system-owner', 'party-uuids': ['party-owner-01'] }
        ]).apply(draft);
      });

      expect(next1['system-security-plan']['system-characteristics']['responsible-parties']).toHaveLength(1);

      // Add / update party
      const next2 = produce(next1, draft => {
        addResponsibleParty({
          'role-id': 'isso',
          'party-uuids': ['party-isso-01', 'party-isso-02']
        }).apply(draft);
      });
      expect(next2['system-security-plan']['system-characteristics']['responsible-parties']).toHaveLength(2);

      // Update existing role-id
      const next3 = produce(next2, draft => {
        addResponsibleParty({
          'role-id': 'system-owner',
          'party-uuids': ['party-owner-02']
        }).apply(draft);
      });
      expect(next3['system-security-plan']['system-characteristics']['responsible-parties']).toHaveLength(2);
      expect(next3['system-security-plan']['system-characteristics']['responsible-parties']?.find(p => p['role-id'] === 'system-owner')?.['party-uuids']).toEqual(['party-owner-02']);

      // Remove party
      const next4 = produce(next3, draft => {
        removeResponsibleParty('isso').apply(draft);
      });
      expect(next4['system-security-plan']['system-characteristics']['responsible-parties']).toHaveLength(1);
      expect(next4['system-security-plan']['system-characteristics']['responsible-parties']?.[0]['role-id']).toBe('system-owner');
    });
  });

  describe('2. System Implementation Actions', () => {
    it('initializes default this-system component if none exists', () => {
      const state: any = {
        'system-security-plan': {
          'system-implementation': {
            components: []
          }
        }
      };

      const next = produce(state, draft => {
        initializeSSPComponents('Enterprise Security Hub').apply(draft);
      });

      const comps = next['system-security-plan']['system-implementation'].components;
      expect(comps).toHaveLength(1);
      expect(comps[0].type).toBe('this-system');
      expect(comps[0].title).toBe('Enterprise Security Hub');
      expect(comps[0].status.state).toBe('operational');
    });

    it('does not duplicate this-system component if already present', () => {
      const state = createSampleSSP();
      const next = produce(state, draft => {
        initializeSSPComponents('Another Name').apply(draft);
      });

      const comps = next['system-security-plan']['system-implementation'].components;
      expect(comps.filter(c => c.type === 'this-system')).toHaveLength(1);
    });

    it('performs CRUD operations on system components', () => {
      const state = createSampleSSP();

      // Add Component
      const next1 = produce(state, draft => {
        addSystemComponent({
          uuid: 'comp-auth-service',
          type: 'service',
          title: 'OAuth2 Authentication Microservice',
          description: 'Handles JWT issue and validation',
          status: { state: 'operational' }
        }).apply(draft);
      });

      expect(next1['system-security-plan']['system-implementation'].components).toHaveLength(3);
      expect(next1['system-security-plan']['system-implementation'].components?.[2].uuid).toBe('comp-auth-service');

      // Update Component
      const next2 = produce(next1, draft => {
        updateSystemComponent('comp-auth-service', {
          title: 'Enhanced OAuth2 Service',
          purpose: 'Centralized identity provider gateway'
        }).apply(draft);
      });

      const updatedComp = next2['system-security-plan']['system-implementation'].components?.find(c => c.uuid === 'comp-auth-service');
      expect(updatedComp?.title).toBe('Enhanced OAuth2 Service');
      expect(updatedComp?.purpose).toBe('Centralized identity provider gateway');

      // Remove Component
      const next3 = produce(next2, draft => {
        removeSystemComponent('comp-db-001').apply(draft);
      });

      expect(next3['system-security-plan']['system-implementation'].components).toHaveLength(2);
      expect(next3['system-security-plan']['system-implementation'].components?.some(c => c.uuid === 'comp-db-001')).toBe(false);
    });

    it('performs CRUD operations on system users', () => {
      const state = createSampleSSP();

      // Add User
      const next1 = produce(state, draft => {
        addSystemUser({
          uuid: 'user-002',
          title: 'Auditor Class',
          'short-name': 'Auditor',
          'authorized-privileges': [
            {
              title: 'Read-Only Audit Logs',
              'functions-performed': ['View SIEM logs', 'Export reports']
            }
          ]
        }).apply(draft);
      });

      expect(next1['system-security-plan']['system-implementation'].users).toHaveLength(2);

      // Update User
      const next2 = produce(next1, draft => {
        updateSystemUser('user-002', { title: 'Compliance Lead Auditor' }).apply(draft);
      });
      expect(next2['system-security-plan']['system-implementation'].users?.[1].title).toBe('Compliance Lead Auditor');

      // Remove User
      const next3 = produce(next2, draft => {
        removeSystemUser('user-001').apply(draft);
      });
      expect(next3['system-security-plan']['system-implementation'].users).toHaveLength(1);
      expect(next3['system-security-plan']['system-implementation'].users?.[0].uuid).toBe('user-002');
    });

    it('performs CRUD operations on inventory items', () => {
      const state = createSampleSSP();

      // Add Inventory Item
      const next1 = produce(state, draft => {
        addInventoryItem({
          uuid: 'inv-002',
          description: 'Secondary Read-Replica DB',
          'implemented-components': [{ 'component-uuid': 'comp-db-001' }]
        }).apply(draft);
      });
      expect(next1['system-security-plan']['system-implementation']['inventory-items']).toHaveLength(2);

      // Update Inventory Item
      const next2 = produce(next1, draft => {
        updateInventoryItem('inv-002', { description: 'Disaster Recovery Replica' }).apply(draft);
      });
      expect(next2['system-security-plan']['system-implementation']['inventory-items']?.[1].description).toBe('Disaster Recovery Replica');

      // Remove Inventory Item
      const next3 = produce(next2, draft => {
        removeInventoryItem('inv-001').apply(draft);
      });
      expect(next3['system-security-plan']['system-implementation']['inventory-items']).toHaveLength(1);
      expect(next3['system-security-plan']['system-implementation']['inventory-items']?.[0].uuid).toBe('inv-002');
    });

    it('performs CRUD operations on leveraged authorizations', () => {
      const state = createSampleSSP();

      // Add Leveraged Auth
      const next1 = produce(state, draft => {
        addLeveragedAuthorization({
          uuid: 'lev-002',
          title: 'Okta Enterprise Identity Cloud',
          'party-uuid': 'party-okta-001',
          'date-authorized': '2025-09-01'
        }).apply(draft);
      });
      expect(next1['system-security-plan']['system-implementation']['leveraged-authorizations']).toHaveLength(2);

      // Update Leveraged Auth
      const next2 = produce(next1, draft => {
        updateLeveragedAuthorization('lev-002', { title: 'Okta FedRAMP High Cloud' }).apply(draft);
      });
      expect(next2['system-security-plan']['system-implementation']['leveraged-authorizations']?.[1].title).toBe('Okta FedRAMP High Cloud');

      // Remove Leveraged Auth
      const next3 = produce(next2, draft => {
        removeLeveragedAuthorization('lev-001').apply(draft);
      });
      expect(next3['system-security-plan']['system-implementation']['leveraged-authorizations']).toHaveLength(1);
      expect(next3['system-security-plan']['system-implementation']['leveraged-authorizations']?.[0].uuid).toBe('lev-002');
    });
  });

  describe('3. Control Implementation Actions', () => {
    it('sets import-profile and control implementation top-level description', () => {
      const state = createSampleSSP();
      const next = produce(state, draft => {
        setImportProfile('../profiles/custom_baseline.json', 'Tailored security profile').apply(draft);
        setControlImplementationDescription('Comprehensive control implementation matrix').apply(draft);
      });

      expect(next['system-security-plan']['import-profile'].href).toBe('../profiles/custom_baseline.json');
      expect(next['system-security-plan']['import-profile'].remarks).toBe('Tailored security profile');
      expect(next['system-security-plan']['control-implementation'].description).toBe('Comprehensive control implementation matrix');
    });

    it('upserts and removes implemented requirements', () => {
      const state = createSampleSSP();

      // Add new implemented requirement
      const next1 = produce(state, draft => {
        upsertImplementedRequirement({
          uuid: 'req-at-1',
          'control-id': 'at-1',
          'by-components': [
            {
              uuid: 'bc-at-1-sys',
              'component-uuid': 'comp-this-sys',
              description: 'Annual security awareness training is mandatory.',
              'implementation-status': { state: 'implemented' }
            }
          ]
        }).apply(draft);
      });

      expect(next1['system-security-plan']['control-implementation']['implemented-requirements']).toHaveLength(3);
      expect(next1['system-security-plan']['control-implementation']['implemented-requirements'][2]['control-id']).toBe('at-1');

      // Upsert existing implemented requirement
      const next2 = produce(next1, draft => {
        upsertImplementedRequirement({
          'control-id': 'at-1',
          remarks: 'Updated training frequency'
        }).apply(draft);
      });

      const at1 = next2['system-security-plan']['control-implementation']['implemented-requirements'].find(r => r['control-id'] === 'at-1');
      expect(at1?.remarks).toBe('Updated training frequency');
      expect(at1?.['by-components']).toHaveLength(1);

      // Remove implemented requirement by control-id
      const next3 = produce(next2, draft => {
        removeImplementedRequirement('ac-1').apply(draft);
      });
      expect(next3['system-security-plan']['control-implementation']['implemented-requirements']).toHaveLength(2);
      expect(next3['system-security-plan']['control-implementation']['implemented-requirements'].some(r => r['control-id'] === 'ac-1')).toBe(false);

      // Remove implemented requirement by UUID
      const next4 = produce(next3, draft => {
        removeImplementedRequirement('req-at-1').apply(draft);
      });
      expect(next4['system-security-plan']['control-implementation']['implemented-requirements']).toHaveLength(1);
      expect(next4['system-security-plan']['control-implementation']['implemented-requirements'][0]['control-id']).toBe('ac-2');
    });

    it('performs CRUD on by-components under requirement level', () => {
      const state = createSampleSSP();

      // Add by-component
      const next1 = produce(state, draft => {
        addByComponent('ac-1', {
          uuid: 'bc-ac-1-auth',
          'component-uuid': 'comp-db-001',
          description: 'Database engine enforces granular table-level ACLs.',
          'implementation-status': { state: 'implemented' }
        }).apply(draft);
      });

      const ac1Req = next1['system-security-plan']['control-implementation']['implemented-requirements'].find(r => r['control-id'] === 'ac-1');
      expect(ac1Req?.['by-components']).toHaveLength(2);
      expect(ac1Req?.['by-components']?.[1].uuid).toBe('bc-ac-1-auth');

      // Update by-component
      const next2 = produce(next1, draft => {
        updateByComponent('ac-1', 'bc-ac-1-auth', {
          description: 'Updated database ACL description with row-level security.'
        }).apply(draft);
      });

      const updatedBc = next2['system-security-plan']['control-implementation']['implemented-requirements']
        .find(r => r['control-id'] === 'ac-1')?.['by-components']
        ?.find(bc => bc.uuid === 'bc-ac-1-auth');
      expect(updatedBc?.description).toBe('Updated database ACL description with row-level security.');

      // Remove by-component
      const next3 = produce(next2, draft => {
        removeByComponent('ac-1', 'bc-ac-1-sys').apply(draft);
      });

      const reqAfterRemove = next3['system-security-plan']['control-implementation']['implemented-requirements'].find(r => r['control-id'] === 'ac-1');
      expect(reqAfterRemove?.['by-components']).toHaveLength(1);
      expect(reqAfterRemove?.['by-components']?.[0].uuid).toBe('bc-ac-1-auth');
    });

    it('performs CRUD on statement-level by-components', () => {
      const state = createSampleSSP();

      // Add statement by-component
      const next1 = produce(state, draft => {
        addStatementByComponent('ac-2', 'ac-2_smt_b', {
          uuid: 'bc-ac-2-b-sys',
          'component-uuid': 'comp-this-sys',
          description: 'System automatically suspends inactive accounts after 90 days.',
          'implementation-status': { state: 'implemented' }
        }).apply(draft);
      });

      const ac2Req = next1['system-security-plan']['control-implementation']['implemented-requirements'].find(r => r['control-id'] === 'ac-2');
      expect(ac2Req?.statements).toHaveLength(2);
      const stmtB = ac2Req?.statements?.find(s => s['statement-id'] === 'ac-2_smt_b');
      expect(stmtB?.['by-components']).toHaveLength(1);
      expect(stmtB?.['by-components']?.[0].uuid).toBe('bc-ac-2-b-sys');

      // Update statement by-component
      const next2 = produce(next1, draft => {
        updateStatementByComponent('ac-2', 'ac-2_smt_b', 'bc-ac-2-b-sys', {
          description: 'System automatically suspends inactive accounts after 45 days per policy.'
        }).apply(draft);
      });

      const updatedStmtBc = next2['system-security-plan']['control-implementation']['implemented-requirements']
        .find(r => r['control-id'] === 'ac-2')?.statements
        ?.find(s => s['statement-id'] === 'ac-2_smt_b')?.['by-components']?.[0];
      expect(updatedStmtBc?.description).toBe('System automatically suspends inactive accounts after 45 days per policy.');

      // Remove statement by-component
      const next3 = produce(next2, draft => {
        removeStatementByComponent('ac-2', 'ac-2_smt_b', 'bc-ac-2-b-sys').apply(draft);
      });

      const stmtBAfterRemove = next3['system-security-plan']['control-implementation']['implemented-requirements']
        .find(r => r['control-id'] === 'ac-2')?.statements
        ?.find(s => s['statement-id'] === 'ac-2_smt_b');
      expect(stmtBAfterRemove?.['by-components']).toHaveLength(0);
    });

    it('cascades parameter values across all four scoping tiers (DD-036)', () => {
      const state = createSampleSSP();

      // Tier 3: Global SSP parameter override
      const next1 = produce(state, draft => {
        setSSPParameterValue('ac-1_prm_1', ['semi-annually'], { remarks: 'Global policy override' }).apply(draft);
      });
      const globalParams = next1['system-security-plan']['control-implementation']['set-parameters'];
      expect(globalParams?.find(p => p['param-id'] === 'ac-1_prm_1')?.values).toEqual(['semi-annually']);
      expect(globalParams?.find(p => p['param-id'] === 'ac-1_prm_1')?.remarks).toBe('Global policy override');

      // Tier 2: Control level parameter override
      const next2 = produce(next1, draft => {
        setSSPParameterValue('ac-2_prm_1', ['weekly'], { controlId: 'ac-2' }).apply(draft);
      });
      const reqAc2 = next2['system-security-plan']['control-implementation']['implemented-requirements'].find(r => r['control-id'] === 'ac-2');
      expect(reqAc2?.['set-parameters']?.find(p => p['param-id'] === 'ac-2_prm_1')?.values).toEqual(['weekly']);

      // Tier 1: Component level parameter override under requirement
      const next3 = produce(next2, draft => {
        setSSPParameterValue('ac-2_prm_2', ['30 days'], { controlId: 'ac-2', byCompUuid: 'bc-ac-2-sys' }).apply(draft);
      });
      const byCompSys = next3['system-security-plan']['control-implementation']['implemented-requirements']
        .find(r => r['control-id'] === 'ac-2')?.['by-components']
        ?.find(bc => bc.uuid === 'bc-ac-2-sys');
      expect(byCompSys?.['set-parameters']?.find(p => p['param-id'] === 'ac-2_prm_2')?.values).toEqual(['30 days']);

      // Tier 1b: Statement component level parameter override
      const next4 = produce(next3, draft => {
        setSSPParameterValue('ac-2_prm_3', ['15 minutes'], {
          controlId: 'ac-2',
          statementId: 'ac-2_smt_a',
          byCompUuid: 'bc-ac-2-a-db'
        }).apply(draft);
      });
      const byCompDbStmt = next4['system-security-plan']['control-implementation']['implemented-requirements']
        .find(r => r['control-id'] === 'ac-2')?.statements
        ?.find(s => s['statement-id'] === 'ac-2_smt_a')?.['by-components']
        ?.find(bc => bc.uuid === 'bc-ac-2-a-db');
      expect(byCompDbStmt?.['set-parameters']?.find(p => p['param-id'] === 'ac-2_prm_3')?.values).toEqual(['15 minutes']);

      // Removing parameter by passing empty values array
      const next5 = produce(next4, draft => {
        setSSPParameterValue('ac-2_prm_1', [], { controlId: 'ac-2' }).apply(draft);
      });
      const reqAc2Clean = next5['system-security-plan']['control-implementation']['implemented-requirements'].find(r => r['control-id'] === 'ac-2');
      expect(reqAc2Clean?.['set-parameters']).toBeUndefined();
    });

    it('manages symmetric security inheritance (export, inherited, satisfied) per DD-036', () => {
      const state = createSampleSSP();
      const next = produce(state, draft => {
        setSecurityInheritance('ac-2', 'bc-ac-2-sys', {
          export: {
            description: 'Exported user management API capability',
            provided: [
              {
                uuid: 'prov-001',
                description: 'Single Sign-On authentication endpoint'
              }
            ],
            responsibilities: [
              {
                uuid: 'resp-001',
                'provided-uuid': 'prov-001',
                description: 'Customer application must enforce MFA on tenant login'
              }
            ]
          },
          inherited: [
            {
              uuid: 'inh-001',
              'provided-uuid': 'prov-aws-iam',
              description: 'Inherits underlying physical hardware security from AWS'
            }
          ],
          satisfied: [
            {
              uuid: 'sat-001',
              'responsibility-uuid': 'resp-aws-config',
              description: 'Satisfies AWS customer responsibility by configuring multi-region CloudTrail'
            }
          ]
        }).apply(draft);
      });

      const byComp = next['system-security-plan']['control-implementation']['implemented-requirements']
        .find(r => r['control-id'] === 'ac-2')?.['by-components']
        ?.find(bc => bc.uuid === 'bc-ac-2-sys');

      expect(byComp?.export?.provided).toHaveLength(1);
      expect(byComp?.export?.responsibilities).toHaveLength(1);
      expect(byComp?.inherited).toHaveLength(1);
      expect(byComp?.inherited?.[0]['provided-uuid']).toBe('prov-aws-iam');
      expect(byComp?.satisfied).toHaveLength(1);
      expect(byComp?.satisfied?.[0]['responsibility-uuid']).toBe('resp-aws-config');
    });
  });

  describe('4. Empty Array Purging per DD-014', () => {
    it('purges empty arrays in place via purgeSSPEmptyArrays action and cleanSSPEmptyArrays helper', () => {
      const stateWithEmptyArrays: any = {
        'system-security-plan': {
          uuid: 'ssp-test',
          metadata: {
            title: 'Test SSP',
            version: '1.0',
            'oscal-version': '1.1.2',
            props: [],
            links: []
          },
          'import-profile': { href: 'profile.json' },
          'system-characteristics': {
            'system-ids': [{ id: 'SYS-1' }],
            'system-name': 'Test Sys',
            description: 'Desc',
            'security-sensitivity-level': 'low',
            status: { state: 'operational' },
            'system-information': {
              'information-types': [
                {
                  uuid: 'it-1',
                  title: 'Public',
                  description: 'Desc',
                  props: [],
                  categorizations: []
                }
              ]
            },
            'authorization-boundary': {
              description: 'Boundary',
              diagrams: []
            }
          },
          'system-implementation': {
            users: [],
            components: [
              {
                uuid: 'comp-1',
                type: 'software',
                title: 'Comp 1',
                description: 'Desc',
                status: { state: 'operational' },
                props: [],
                links: [],
                'responsible-roles': []
              }
            ],
            'inventory-items': []
          },
          'control-implementation': {
            description: 'Impl',
            'set-parameters': [],
            'implemented-requirements': [
              {
                uuid: 'req-1',
                'control-id': 'ac-1',
                props: [],
                statements: [],
                'by-components': [
                  {
                    uuid: 'bc-1',
                    'component-uuid': 'comp-1',
                    description: 'Narrative',
                    props: [],
                    'set-parameters': [],
                    inherited: [],
                    satisfied: []
                  }
                ]
              }
            ]
          }
        }
      };

      const next = produce(stateWithEmptyArrays, draft => {
        purgeSSPEmptyArrays().apply(draft);
      });

      const ssp = next['system-security-plan'];
      expect(ssp.metadata.props).toBeUndefined();
      expect(ssp.metadata.links).toBeUndefined();
      expect(ssp['system-characteristics']['authorization-boundary'].diagrams).toBeUndefined();
      expect(ssp['system-characteristics']['system-information']['information-types'][0].props).toBeUndefined();
      expect(ssp['system-characteristics']['system-information']['information-types'][0].categorizations).toBeUndefined();
      expect(ssp['system-implementation'].components[0].props).toBeUndefined();
      expect(ssp['system-implementation'].components[0]['responsible-roles']).toBeUndefined();
      expect(ssp['system-implementation']['inventory-items']).toBeUndefined();
      expect(ssp['control-implementation']['set-parameters']).toBeUndefined();
      expect(ssp['control-implementation']['implemented-requirements'][0].props).toBeUndefined();
      expect(ssp['control-implementation']['implemented-requirements'][0].statements).toBeUndefined();
      expect(ssp['control-implementation']['implemented-requirements'][0]['by-components'][0].props).toBeUndefined();
      expect(ssp['control-implementation']['implemented-requirements'][0]['by-components'][0]['set-parameters']).toBeUndefined();
      expect(ssp['control-implementation']['implemented-requirements'][0]['by-components'][0].inherited).toBeUndefined();
      expect(ssp['control-implementation']['implemented-requirements'][0]['by-components'][0].satisfied).toBeUndefined();

      // Ensure cleanSSPEmptyArrays functional utility behaves identically
      const cleaned = cleanSSPEmptyArrays(stateWithEmptyArrays) as any;
      expect(cleaned['system-security-plan'].metadata.props).toBeUndefined();
      expect(cleaned['system-security-plan']['control-implementation']['set-parameters']).toBeUndefined();
    });
  });

  describe('5. Legacy / Helper Actions Compatibility', () => {
    it('supports updateSSPField, updateSSPListItem, and replaceSSP', () => {
      const state = createSampleSSP();

      // updateSSPField
      const next1 = produce(state, draft => {
        updateSSPField(['system-characteristics', 'system-name'], 'Replaced Name via Path').apply(draft);
      });
      expect(next1['system-security-plan']['system-characteristics']['system-name']).toBe('Replaced Name via Path');

      // updateSSPListItem
      const next2 = produce(next1, draft => {
        updateSSPListItem(['system-implementation', 'components'], 'comp-db-001', {
          title: 'PostgreSQL DB (Patched via Path)'
        }).apply(draft);
      });
      const dbComp = next2['system-security-plan']['system-implementation'].components?.find(c => c.uuid === 'comp-db-001');
      expect(dbComp?.title).toBe('PostgreSQL DB (Patched via Path)');

      // replaceSSP
      const replacementSSP = {
        uuid: 'ssp-replaced-123',
        metadata: { title: 'Entirely New SSP', version: '2.0', 'oscal-version': '1.1.2' },
        'import-profile': { href: 'new.json' },
        'system-characteristics': {
          'system-ids': [{ id: 'NEW-01' }],
          'system-name': 'New SSP',
          description: 'Desc',
          'security-sensitivity-level': 'high',
          status: { state: 'operational' },
          'system-information': { 'information-types': [] },
          'authorization-boundary': { description: 'New' }
        },
        'system-implementation': { users: [], components: [] },
        'control-implementation': { description: 'New', 'implemented-requirements': [] }
      };

      const next3 = produce(next2, draft => {
        replaceSSP(replacementSSP).apply(draft);
      });
      expect(next3['system-security-plan'].uuid).toBe('ssp-replaced-123');
      expect(next3['system-security-plan']['system-characteristics']['system-name']).toBe('New SSP');
    });
  });
});
