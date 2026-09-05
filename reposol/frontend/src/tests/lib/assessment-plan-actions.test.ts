import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import {
  setImportSSP,
  setAssessmentPlanMetadata,
  setAPTitle,
  setAPVersion,
  setAPRemarks,
  addAPRole,
  removeAPRole,
  addAPParty,
  removeAPParty,
  addAPResponsibleParty,
  removeAPResponsibleParty,
  setAPProp,
  removeAPProp,
  setReviewedControlsDescription,
  addControlSelection,
  removeControlSelection,
  setControlSelections,
  setIncludeAllControls,
  addIncludeControl,
  removeIncludeControl,
  addExcludeControl,
  removeExcludeControl,
  toggleIncludeControl,
  toggleExcludeControl,
  setStatementIDs,
  setControlObjectiveSelections,
  addControlObjectiveSelection,
  removeControlObjectiveSelection,
  populateControlsFromSSP,
  addAssessmentSubject,
  updateAssessmentSubject,
  removeAssessmentSubject,
  addSubjectReference,
  removeSubjectReference,
  addAssessmentSubjectPlaceholder,
  removeAssessmentSubjectPlaceholder,
  addAssetComponent,
  updateAssetComponent,
  removeAssetComponent,
  addAssessmentPlatform,
  updateAssessmentPlatform,
  removeAssessmentPlatform,
  addPlatformComponent,
  removePlatformComponent,
  addLocalComponent,
  updateLocalComponent,
  removeLocalComponent,
  addLocalInventoryItem,
  updateLocalInventoryItem,
  removeLocalInventoryItem,
  addLocalUser,
  updateLocalUser,
  removeLocalUser,
  addLocalObjective,
  updateLocalObjective,
  removeLocalObjective,
  addLocalActivity,
  updateLocalActivity,
  removeLocalActivity,
  addActivityStep,
  updateActivityStep,
  removeActivityStep,
  reorderActivitySteps,
  addTask,
  updateTask,
  removeTask,
  setTaskTiming,
  addTaskDependency,
  removeTaskDependency,
  addTaskActivity,
  removeTaskActivity,
  addTaskSubject,
  removeTaskSubject,
  addTermsPart,
  updateTermsPart,
  removeTermsPart,
  addResourceAttachment,
  updateResourceAttachment,
  removeResourceAttachment,
  cleanAPEmptyArrays,
  purgeAPEmptyArrays,
  updateAPField,
  updateAPListItem,
  replaceAssessmentPlan,
  assessmentPlanReducer,
  hasTaskCycle
} from '../../lib/document-actions/assessment-plan-actions';
import { AssessmentPlan } from '../../lib/types/oscal';

function createSampleAP(): { 'assessment-plan': AssessmentPlan } {
  return {
    'assessment-plan': {
      uuid: 'ap-0000-1111-2222-3333',
      metadata: {
        title: 'Sample Core Platform Security Assessment Plan',
        version: '1.0.0',
        'oscal-version': '1.2.2',
        'last-modified': '2026-09-02T10:00:00Z',
        roles: [
          { id: 'lead-assessor', title: 'Lead Security Assessor' },
          { id: 'security-auditor', title: 'Technical Security Auditor' }
        ],
        parties: [
          {
            uuid: 'party-001',
            type: 'person',
            name: 'Bob Assessor',
            'email-addresses': ['bob@example.com']
          }
        ],
        'responsible-parties': [
          {
            'role-id': 'lead-assessor',
            'party-uuids': ['party-001']
          }
        ]
      },
      'import-ssp': {
        href: '../system-security-plans/ssp-0000-1111-2222-3333.json',
        remarks: 'Authoritative audit baseline from production SSP'
      },
      'reviewed-controls': {
        description: 'Baseline security controls for annual assessment',
        'control-selections': [
          {
            'include-controls': [
              { 'control-id': 'ac-1' },
              { 'control-id': 'ac-2', 'statement-ids': ['ac-2_smt_a', 'ac-2_smt_b'] }
            ]
          }
        ]
      },
      'assessment-subjects': [
        {
          type: 'component',
          description: 'Production web application and database components',
          'include-subjects': [
            { 'subject-uuid': 'comp-web-01', type: 'component' }
          ]
        }
      ],
      'assessment-assets': {
        components: [
          {
            uuid: 'tool-nessus-01',
            type: 'software',
            title: 'Nessus Professional Scanner',
            description: 'Vulnerability scanner',
            status: { state: 'operational' }
          }
        ],
        'assessment-platforms': [
          {
            uuid: 'plat-sec-ops-01',
            title: 'Security Operations Assessment Platform',
            'uses-components': [
              {
                'component-uuid': 'tool-nessus-01'
              }
            ]
          }
        ]
      },
      'local-definitions': {
        components: [
          {
            uuid: 'local-comp-test-env',
            type: 'software',
            title: 'Staging Test Environment',
            description: 'Temporary testing sandbox',
            status: { state: 'operational' }
          }
        ],
        users: [
          {
            uuid: 'local-user-auditor',
            title: 'Audit Test Account',
            'short-name': 'auditor_test',
            'role-ids': ['security-auditor']
          }
        ],
        'objectives-and-methods': [
          {
            'control-id': 'ac-2',
            description: 'Assessment objective for account management',
            parts: [
              {
                name: 'assessment-objective',
                prose: 'Determine if user accounts are properly tracked and authorized.',
                props: [{ name: 'method-id', value: 'method-examine-ac2' }]
              },
              {
                name: 'assessment-method',
                props: [{ name: 'method', value: 'EXAMINE' }],
                parts: [
                  {
                    name: 'assessment-objects',
                    prose: 'Active Directory user logs and account requests.'
                  }
                ]
              }
            ]
          }
        ],
        activities: [
          {
            uuid: 'act-audit-accounts',
            title: 'Audit User Accounts & Roles',
            description: 'Examine active directory and interview administrators',
            steps: [
              {
                uuid: 'step-act-1',
                title: 'Step 1: Extract Active Users',
                description: 'Export user list from IAM system'
              }
            ]
          }
        ]
      },
      tasks: [
        {
          uuid: 'task-kickoff-01',
          type: 'milestone',
          title: 'Assessment Kickoff Meeting',
          description: 'Formal kickoff and scoping sign-off',
          timing: {
            'on-date': {
              date: '2026-10-01T09:00:00Z'
            }
          }
        },
        {
          uuid: 'task-scan-02',
          type: 'action',
          title: 'Vulnerability Scanning Phase',
          description: 'Execute Nessus network vulnerability scans',
          dependencies: [
            { 'task-uuid': 'task-kickoff-01' }
          ],
          timing: {
            'within-date-range': {
              start: '2026-10-02T08:00:00Z',
              end: '2026-10-05T18:00:00Z'
            }
          }
        }
      ],
      'terms-and-conditions': {
        parts: [
          {
            uuid: 'term-roe-01',
            name: 'rules-of-engagement',
            title: 'Rules of Engagement',
            prose: 'Testing must occur between 08:00 and 18:00 UTC without disrupting live operations.'
          }
        ]
      },
      'back-matter': {
        resources: [
          {
            uuid: 'res-roe-pdf-01',
            title: 'Signed Rules of Engagement.pdf',
            rlinks: [{ href: '#res-roe-pdf-01', 'media-type': 'application/pdf' }],
            base64: {
              filename: 'Signed_RoE.pdf',
              'media-type': 'application/pdf',
              value: 'JVBERi0xLjQKJeLjz9MK...'
            }
          }
        ]
      }
    }
  };
}

describe('Assessment Plan Document Actions (DD-029 & DD-037)', () => {
  // ==========================================================================
  // 1. Overview & Metadata Actions
  // ==========================================================================
  describe('Overview & Metadata Actions', () => {
    it('updates target SSP reference and remarks', () => {
      const state = createSampleAP();
      const action = setImportSSP('../system-security-plans/new-ssp-999.json', 'Updated mandate');
      const next = produce(state, action.apply);

      expect(next['assessment-plan']['import-ssp'].href).toBe('../system-security-plans/new-ssp-999.json');
      expect(next['assessment-plan']['import-ssp'].remarks).toBe('Updated mandate');
    });

    it('removes remarks if empty string passed to setImportSSP', () => {
      const state = createSampleAP();
      const action = setImportSSP('../system-security-plans/new-ssp-999.json', '');
      const next = produce(state, action.apply);

      expect(next['assessment-plan']['import-ssp'].href).toBe('../system-security-plans/new-ssp-999.json');
      expect(next['assessment-plan']['import-ssp'].remarks).toBeUndefined();
    });

    it('updates assessment plan title, version, and remarks', () => {
      const state = createSampleAP();
      const next1 = produce(state, setAPTitle('Updated Assessment Plan Title').apply);
      expect(next1['assessment-plan'].metadata.title).toBe('Updated Assessment Plan Title');
      expect(next1['assessment-plan'].metadata['last-modified']).toBeDefined();

      const next2 = produce(next1, setAPVersion('2.0.0').apply);
      expect(next2['assessment-plan'].metadata.version).toBe('2.0.0');

      const next3 = produce(next2, setAPRemarks('Annual audit plan notes').apply);
      expect(next3['assessment-plan'].metadata.remarks).toBe('Annual audit plan notes');
    });

    it('updates general metadata via setAssessmentPlanMetadata', () => {
      const state = createSampleAP();
      const action = setAssessmentPlanMetadata({ title: 'New Meta Title', version: '3.1.0' });
      const next = produce(state, action.apply);

      expect(next['assessment-plan'].metadata.title).toBe('New Meta Title');
      expect(next['assessment-plan'].metadata.version).toBe('3.1.0');
    });

    it('adds, updates, and removes roles', () => {
      const state = createSampleAP();
      const addAction = addAPRole({ id: 'pen-tester', title: 'Penetration Tester', description: 'Performs technical exploits' });
      const next1 = produce(state, addAction.apply);
      expect(next1['assessment-plan'].metadata.roles?.some(r => r.id === 'pen-tester')).toBe(true);

      const updateAction = addAPRole({ id: 'pen-tester', title: 'Senior Penetration Tester' });
      const next2 = produce(next1, updateAction.apply);
      expect(next2['assessment-plan'].metadata.roles?.find(r => r.id === 'pen-tester')?.title).toBe('Senior Penetration Tester');

      const removeAction = removeAPRole('pen-tester');
      const next3 = produce(next2, removeAction.apply);
      expect(next3['assessment-plan'].metadata.roles?.some(r => r.id === 'pen-tester')).toBe(false);
    });

    it('adds and removes parties', () => {
      const state = createSampleAP();
      const addAction = addAPParty({
        uuid: 'party-alice-01',
        type: 'person',
        name: 'Alice Auditor',
        'email-addresses': ['alice@audit.com']
      });
      const next1 = produce(state, addAction.apply);
      expect(next1['assessment-plan'].metadata.parties?.some(p => p.uuid === 'party-alice-01')).toBe(true);

      const removeAction = removeAPParty('party-alice-01');
      const next2 = produce(next1, removeAction.apply);
      expect(next2['assessment-plan'].metadata.parties?.some(p => p.uuid === 'party-alice-01')).toBe(false);
    });

    it('assigns and removes responsible parties', () => {
      const state = createSampleAP();
      const addResp = addAPResponsibleParty('lead-assessor', ['party-alice-01']);
      const next1 = produce(state, addResp.apply);
      const rp = next1['assessment-plan'].metadata['responsible-parties']?.find(r => r['role-id'] === 'lead-assessor');
      expect(rp?.['party-uuids']).toContain('party-001');
      expect(rp?.['party-uuids']).toContain('party-alice-01');

      const removeResp = removeAPResponsibleParty('lead-assessor');
      const next2 = produce(next1, removeResp.apply);
      expect(next2['assessment-plan'].metadata['responsible-parties']?.some(r => r['role-id'] === 'lead-assessor')).toBe(false);
    });

    it('sets and removes metadata custom properties', () => {
      const state = createSampleAP();
      const setProp = setAPProp('classification', 'CUI', 'https://example.com/ns');
      const next1 = produce(state, setProp.apply);
      const prop = next1['assessment-plan'].metadata.props?.find(p => p.name === 'classification');
      expect(prop?.value).toBe('CUI');
      expect(prop?.ns).toBe('https://example.com/ns');

      const removePropAction = removeAPProp('classification');
      const next2 = produce(next1, removePropAction.apply);
      expect(next2['assessment-plan'].metadata.props?.some(p => p.name === 'classification')).toBe(false);
    });
  });

  // ==========================================================================
  // 2. Reviewed Controls & Scope Actions
  // ==========================================================================
  describe('Reviewed Controls & Scope Actions', () => {
    it('sets reviewed controls description', () => {
      const state = createSampleAP();
      const action = setReviewedControlsDescription('Updated scoping methodology description');
      const next = produce(state, action.apply);
      expect(next['assessment-plan']['reviewed-controls'].description).toBe('Updated scoping methodology description');
    });

    it('adds, removes, and overwrites control selections', () => {
      const state = createSampleAP();
      const addAction = addControlSelection({ 'include-all': {} });
      const next1 = produce(state, addAction.apply);
      expect(next1['assessment-plan']['reviewed-controls']['control-selections'].length).toBe(2);

      const removeAction = removeControlSelection(1);
      const next2 = produce(next1, removeAction.apply);
      expect(next2['assessment-plan']['reviewed-controls']['control-selections'].length).toBe(1);

      const setAction = setControlSelections([{ 'include-controls': [{ 'control-id': 'ia-2' }] }]);
      const next3 = produce(next2, setAction.apply);
      expect(next3['assessment-plan']['reviewed-controls']['control-selections'][0]['include-controls']?.[0]['control-id']).toBe('ia-2');
    });

    it('sets include-all controls on a selection block', () => {
      const state = createSampleAP();
      const action = setIncludeAllControls(0);
      const next = produce(state, action.apply);
      expect(next['assessment-plan']['reviewed-controls']['control-selections'][0]['include-all']).toBeDefined();
      expect(next['assessment-plan']['reviewed-controls']['control-selections'][0]['include-controls']).toBeUndefined();
    });

    it('adds and removes included controls with statement IDs', () => {
      const state = createSampleAP();
      const addAction = addIncludeControl('si-2', 0, ['si-2_smt_a', 'si-2_smt_c']);
      const next1 = produce(state, addAction.apply);
      const ctrl = next1['assessment-plan']['reviewed-controls']['control-selections'][0]['include-controls']?.find(c => c['control-id'] === 'si-2');
      expect(ctrl).toBeDefined();
      expect(ctrl?.['statement-ids']).toEqual(['si-2_smt_a', 'si-2_smt_c']);

      const removeAction = removeIncludeControl('si-2', 0);
      const next2 = produce(next1, removeAction.apply);
      expect(next2['assessment-plan']['reviewed-controls']['control-selections'][0]['include-controls']?.some(c => c['control-id'] === 'si-2')).toBe(false);
    });

    it('adds and removes excluded controls', () => {
      const state = createSampleAP();
      const addAction = addExcludeControl('sc-7', 0, ['sc-7_smt_1']);
      const next1 = produce(state, addAction.apply);
      const excl = next1['assessment-plan']['reviewed-controls']['control-selections'][0]['exclude-controls']?.find(c => c['control-id'] === 'sc-7');
      expect(excl).toBeDefined();
      expect(excl?.['statement-ids']).toEqual(['sc-7_smt_1']);

      const removeAction = removeExcludeControl('sc-7', 0);
      const next2 = produce(next1, removeAction.apply);
      expect(next2['assessment-plan']['reviewed-controls']['control-selections'][0]['exclude-controls']?.some(c => c['control-id'] === 'sc-7')).toBe(false);
    });

    it('toggles included and excluded controls', () => {
      const state = createSampleAP();
      // Toggle ON
      const next1 = produce(state, toggleIncludeControl('cm-8', 0).apply);
      expect(next1['assessment-plan']['reviewed-controls']['control-selections'][0]['include-controls']?.some(c => c['control-id'] === 'cm-8')).toBe(true);

      // Toggle OFF
      const next2 = produce(next1, toggleIncludeControl('cm-8', 0).apply);
      expect(next2['assessment-plan']['reviewed-controls']['control-selections'][0]['include-controls']?.some(c => c['control-id'] === 'cm-8')).toBe(false);

      // Exclude toggle ON
      const next3 = produce(next2, toggleExcludeControl('cm-8', 0).apply);
      expect(next3['assessment-plan']['reviewed-controls']['control-selections'][0]['exclude-controls']?.some(c => c['control-id'] === 'cm-8')).toBe(true);

      // Exclude toggle OFF
      const next4 = produce(next3, toggleExcludeControl('cm-8', 0).apply);
      expect(next4['assessment-plan']['reviewed-controls']['control-selections'][0]['exclude-controls']?.some(c => c['control-id'] === 'cm-8')).toBe(false);
    });

    it('updates statement-ids on a control via setStatementIDs', () => {
      const state = createSampleAP();
      const action = setStatementIDs('ac-2', ['ac-2_smt_a', 'ac-2_smt_d'], 0);
      const next = produce(state, action.apply);
      const ctrl = next['assessment-plan']['reviewed-controls']['control-selections'][0]['include-controls']?.find(c => c['control-id'] === 'ac-2');
      expect(ctrl?.['statement-ids']).toEqual(['ac-2_smt_a', 'ac-2_smt_d']);
    });

    it('manages control objective selections', () => {
      const state = createSampleAP();
      const addObj = addControlObjectiveSelection({
        'include-objectives': [{ 'objective-id': 'ac-2_obj_1' }]
      });
      const next1 = produce(state, addObj.apply);
      expect(next1['assessment-plan']['reviewed-controls']['control-objective-selections']?.length).toBe(1);

      const removeObj = removeControlObjectiveSelection(0);
      const next2 = produce(next1, removeObj.apply);
      expect(next2['assessment-plan']['reviewed-controls']['control-objective-selections']?.length).toBe(0);
    });

    it('auto-populates candidate controls from target SSP', () => {
      const state = createSampleAP();
      const action = populateControlsFromSSP(['ac-1', 'ac-2', 'au-1', 'ia-2', 'sc-7']);
      const next = produce(state, action.apply);

      const list = next['assessment-plan']['reviewed-controls']['control-selections'][0]['include-controls'];
      expect(list).toHaveLength(5);
      expect(list?.map(c => c['control-id'])).toEqual(['ac-1', 'ac-2', 'au-1', 'ia-2', 'sc-7']);
    });
  });

  // ==========================================================================
  // 3. Assessment Subjects Actions
  // ==========================================================================
  describe('Assessment Subjects Actions', () => {
    it('adds, updates, and removes assessment subjects', () => {
      const state = createSampleAP();
      const addAction = addAssessmentSubject({
        type: 'location',
        description: 'Primary Data Center Facility',
        includeAll: true
      });
      const next1 = produce(state, addAction.apply);
      expect(next1['assessment-plan']['assessment-subjects']).toHaveLength(2);
      expect(next1['assessment-plan']['assessment-subjects']?.[1].type).toBe('location');

      const updateAction = updateAssessmentSubject(1, { description: 'Secondary DR Facility' });
      const next2 = produce(next1, updateAction.apply);
      expect(next2['assessment-plan']['assessment-subjects']?.[1].description).toBe('Secondary DR Facility');

      const removeAction = removeAssessmentSubject(1);
      const next3 = produce(next2, removeAction.apply);
      expect(next3['assessment-plan']['assessment-subjects']).toHaveLength(1);
    });

    it('adds and removes subject references within a subject group', () => {
      const state = createSampleAP();
      const addRef = addSubjectReference(0, { 'subject-uuid': 'comp-db-02', type: 'component' });
      const next1 = produce(state, addRef.apply);
      const subjs = next1['assessment-plan']['assessment-subjects']?.[0]['include-subjects'];
      expect(subjs?.some(s => s['subject-uuid'] === 'comp-db-02')).toBe(true);

      const removeRef = removeSubjectReference(0, 'comp-db-02');
      const next2 = produce(next1, removeRef.apply);
      expect(next2['assessment-plan']['assessment-subjects']?.[0]['include-subjects']?.some(s => s['subject-uuid'] === 'comp-db-02')).toBe(false);
    });

    it('adds and removes assessment subject placeholders', () => {
      const state = createSampleAP();
      const addPH = addAssessmentSubjectPlaceholder({
        uuid: 'ph-dynamic-servers-01',
        description: 'Auto-scaled servers identified during test'
      });
      const next1 = produce(state, addPH.apply);
      const subjects = next1['assessment-plan']['assessment-subjects'];
      expect(subjects?.some(s => s.props?.some(p => p.value === 'ph-dynamic-servers-01'))).toBe(true);

      const removePH = removeAssessmentSubjectPlaceholder('ph-dynamic-servers-01');
      const next2 = produce(next1, removePH.apply);
      expect(next2['assessment-plan']['assessment-subjects']?.some(s => s.props?.some(p => p.value === 'ph-dynamic-servers-01'))).toBe(false);
    });
  });

  // ==========================================================================
  // 4. Assessment Assets & Platforms Actions
  // ==========================================================================
  describe('Assessment Assets & Platforms Actions', () => {
    it('adds, updates, and removes asset components (scanning tools)', () => {
      const state = createSampleAP();
      const addAction = addAssetComponent({
        uuid: 'tool-burp-01',
        type: 'software',
        title: 'Burp Suite Pro',
        description: 'Web application DAST scanner'
      });
      const next1 = produce(state, addAction.apply);
      expect(next1['assessment-plan']['assessment-assets']?.components?.some(c => c.uuid === 'tool-burp-01')).toBe(true);

      const updateAction = updateAssetComponent('tool-burp-01', { title: 'Burp Suite Enterprise v2026' });
      const next2 = produce(next1, updateAction.apply);
      expect(next2['assessment-plan']['assessment-assets']?.components?.find(c => c.uuid === 'tool-burp-01')?.title).toBe('Burp Suite Enterprise v2026');

      const removeAction = removeAssetComponent('tool-burp-01');
      const next3 = produce(next2, removeAction.apply);
      expect(next3['assessment-plan']['assessment-assets']?.components?.some(c => c.uuid === 'tool-burp-01')).toBe(false);
    });

    it('adds, updates, and removes assessment platforms', () => {
      const state = createSampleAP();
      const addAction = addAssessmentPlatform({
        uuid: 'plat-dast-01',
        title: 'DAST Scanning Platform'
      });
      const next1 = produce(state, addAction.apply);
      expect(next1['assessment-plan']['assessment-assets']?.['assessment-platforms']?.some(p => p.uuid === 'plat-dast-01')).toBe(true);

      const updateAction = updateAssessmentPlatform('plat-dast-01', { title: 'Cloud DAST Platform' });
      const next2 = produce(next1, updateAction.apply);
      expect(next2['assessment-plan']['assessment-assets']?.['assessment-platforms']?.find(p => p.uuid === 'plat-dast-01')?.title).toBe('Cloud DAST Platform');

      const removeAction = removeAssessmentPlatform('plat-dast-01');
      const next3 = produce(next2, removeAction.apply);
      expect(next3['assessment-plan']['assessment-assets']?.['assessment-platforms']?.some(p => p.uuid === 'plat-dast-01')).toBe(false);
    });

    it('adds and removes component usages in assessment platforms', () => {
      const state = createSampleAP();
      const addCompAction = addPlatformComponent('plat-sec-ops-01', 'tool-burp-01', [
        { 'role-id': 'security-auditor', 'party-uuids': ['party-001'] }
      ]);
      const next1 = produce(state, addCompAction.apply);
      const plat = next1['assessment-plan']['assessment-assets']?.['assessment-platforms']?.find(p => p.uuid === 'plat-sec-ops-01');
      expect(plat?.['uses-components']?.some(u => u['component-uuid'] === 'tool-burp-01')).toBe(true);

      const removeCompAction = removePlatformComponent('plat-sec-ops-01', 'tool-burp-01');
      const next2 = produce(next1, removeCompAction.apply);
      const plat2 = next2['assessment-plan']['assessment-assets']?.['assessment-platforms']?.find(p => p.uuid === 'plat-sec-ops-01');
      expect(plat2?.['uses-components']?.some(u => u['component-uuid'] === 'tool-burp-01')).toBe(false);
    });
  });

  // ==========================================================================
  // 5. Local Definitions Actions
  // ==========================================================================
  describe('Local Definitions Actions', () => {
    it('adds, updates, and removes local components', () => {
      const state = createSampleAP();
      const addComp = addLocalComponent({
        uuid: 'local-bastion-01',
        type: 'hardware',
        title: 'Auditor Bastion Host'
      });
      const next1 = produce(state, addComp.apply);
      expect(next1['assessment-plan']['local-definitions']?.components?.some(c => c.uuid === 'local-bastion-01')).toBe(true);

      const updateComp = updateLocalComponent('local-bastion-01', { title: 'Auditor Jump Box' });
      const next2 = produce(next1, updateComp.apply);
      expect(next2['assessment-plan']['local-definitions']?.components?.find(c => c.uuid === 'local-bastion-01')?.title).toBe('Auditor Jump Box');

      const removeComp = removeLocalComponent('local-bastion-01');
      const next3 = produce(next2, removeComp.apply);
      expect(next3['assessment-plan']['local-definitions']?.components?.some(c => c.uuid === 'local-bastion-01')).toBe(false);
    });

    it('adds, updates, and removes local inventory items', () => {
      const state = createSampleAP();
      const addItem = addLocalInventoryItem({
        uuid: 'inv-sandbox-vm-01',
        description: 'Staging Sandbox VM'
      });
      const next1 = produce(state, addItem.apply);
      expect(next1['assessment-plan']['local-definitions']?.['inventory-items']?.some(i => i.uuid === 'inv-sandbox-vm-01')).toBe(true);

      const updateItem = updateLocalInventoryItem('inv-sandbox-vm-01', { description: 'Updated Staging Sandbox VM' });
      const next2 = produce(next1, updateItem.apply);
      expect(next2['assessment-plan']['local-definitions']?.['inventory-items']?.find(i => i.uuid === 'inv-sandbox-vm-01')?.description).toBe('Updated Staging Sandbox VM');

      const removeItem = removeLocalInventoryItem('inv-sandbox-vm-01');
      const next3 = produce(next2, removeItem.apply);
      expect(next3['assessment-plan']['local-definitions']?.['inventory-items']?.some(i => i.uuid === 'inv-sandbox-vm-01')).toBe(false);
    });

    it('adds, updates, and removes local users', () => {
      const state = createSampleAP();
      const addUser = addLocalUser({
        uuid: 'user-temp-pentester',
        title: 'Contract Pentester Account',
        'short-name': 'pentest_guest'
      });
      const next1 = produce(state, addUser.apply);
      expect(next1['assessment-plan']['local-definitions']?.users?.some(u => u.uuid === 'user-temp-pentester')).toBe(true);

      const updateUserAction = updateLocalUser('user-temp-pentester', { title: 'Lead Contract Pentester' });
      const next2 = produce(next1, updateUserAction.apply);
      expect(next2['assessment-plan']['local-definitions']?.users?.find(u => u.uuid === 'user-temp-pentester')?.title).toBe('Lead Contract Pentester');

      const removeUserAction = removeLocalUser('user-temp-pentester');
      const next3 = produce(next2, removeUserAction.apply);
      expect(next3['assessment-plan']['local-definitions']?.users?.some(u => u.uuid === 'user-temp-pentester')).toBe(false);
    });

    it('adds, updates, and removes local objectives with NIST SP 800-53A method enums', () => {
      const state = createSampleAP();
      const addObj = addLocalObjective({
        'control-id': 'ia-2',
        description: 'Multi-factor authentication assessment objective',
        parts: [
          {
            name: 'assessment-objective',
            prose: 'Verify MFA is enforced on privileged accounts.',
            props: [{ name: 'method-id', value: 'method-test-ia2' }]
          },
          {
            name: 'assessment-method',
            props: [{ name: 'method', value: 'TEST' }],
            parts: [{ name: 'assessment-objects', prose: 'SSO portal authentication challenge.' }]
          }
        ]
      });
      const next1 = produce(state, addObj.apply);
      const obj = next1['assessment-plan']['local-definitions']?.['objectives-and-methods']?.find(o => o['control-id'] === 'ia-2');
      expect(obj).toBeDefined();
      expect(obj?.description).toContain('Multi-factor');

      const updateObj = updateLocalObjective('ia-2', { description: 'Updated MFA evaluation criteria' });
      const next2 = produce(next1, updateObj.apply);
      expect(next2['assessment-plan']['local-definitions']?.['objectives-and-methods']?.find(o => o['control-id'] === 'ia-2')?.description).toBe('Updated MFA evaluation criteria');

      const removeObj = removeLocalObjective('ia-2');
      const next3 = produce(next2, removeObj.apply);
      expect(next3['assessment-plan']['local-definitions']?.['objectives-and-methods']?.some(o => o['control-id'] === 'ia-2')).toBe(false);
    });

    it('adds, updates, removes local activities and manages step sequences and reordering', () => {
      const state = createSampleAP();
      const addAct = addLocalActivity({
        uuid: 'act-api-fuzzing',
        title: 'API Fuzzing Assessment',
        description: 'Automated fuzz testing on REST endpoints'
      });
      const next1 = produce(state, addAct.apply);
      expect(next1['assessment-plan']['local-definitions']?.activities?.some(a => a.uuid === 'act-api-fuzzing')).toBe(true);

      const addStep1 = addActivityStep('act-api-fuzzing', {
        uuid: 'step-fuzz-1',
        title: 'Generate Payloads',
        description: 'Create malformed JSON payloads'
      });
      const next2 = produce(next1, addStep1.apply);

      const addStep2 = addActivityStep('act-api-fuzzing', {
        uuid: 'step-fuzz-2',
        title: 'Send Payloads',
        description: 'Send payloads to API endpoints'
      });
      const next3 = produce(next2, addStep2.apply);

      const addStep3 = addActivityStep('act-api-fuzzing', {
        uuid: 'step-fuzz-3',
        title: 'Analyze Responses',
        description: 'Check for 500 error leakages'
      });
      const next4 = produce(next3, addStep3.apply);

      const act = next4['assessment-plan']['local-definitions']?.activities?.find(a => a.uuid === 'act-api-fuzzing');
      expect(act?.steps).toHaveLength(3);
      expect(act?.steps?.[0].uuid).toBe('step-fuzz-1');

      // Reorder step 0 to step 2
      const reorderAction = reorderActivitySteps('act-api-fuzzing', 0, 2);
      const next5 = produce(next4, reorderAction.apply);
      const reorderedAct = next5['assessment-plan']['local-definitions']?.activities?.find(a => a.uuid === 'act-api-fuzzing');
      expect(reorderedAct?.steps?.[0].uuid).toBe('step-fuzz-2');
      expect(reorderedAct?.steps?.[2].uuid).toBe('step-fuzz-1');

      // Remove step
      const removeStepAction = removeActivityStep('act-api-fuzzing', 'step-fuzz-2');
      const next6 = produce(next5, removeStepAction.apply);
      const actAfterStepRemove = next6['assessment-plan']['local-definitions']?.activities?.find(a => a.uuid === 'act-api-fuzzing');
      expect(actAfterStepRemove?.steps).toHaveLength(2);

      // Remove entire activity
      const removeActAction = removeLocalActivity('act-api-fuzzing');
      const next7 = produce(next6, removeActAction.apply);
      expect(next7['assessment-plan']['local-definitions']?.activities?.some(a => a.uuid === 'act-api-fuzzing')).toBe(false);
    });
  });

  // ==========================================================================
  // 6. Tasks & Timeline Actions & DAG Cycle Detection
  // ==========================================================================
  describe('Tasks & Timeline Actions', () => {
    it('adds, updates, and removes tasks', () => {
      const state = createSampleAP();
      const addTaskAction = addTask({
        uuid: 'task-review-03',
        type: 'action',
        title: 'Source Code Review',
        description: 'Manual and static code review'
      });
      const next1 = produce(state, addTaskAction.apply);
      expect(next1['assessment-plan'].tasks?.some(t => t.uuid === 'task-review-03')).toBe(true);

      const updateTaskAction = updateTask('task-review-03', { title: 'Static Application Security Testing (SAST)' });
      const next2 = produce(next1, updateTaskAction.apply);
      expect(next2['assessment-plan'].tasks?.find(t => t.uuid === 'task-review-03')?.title).toBe('Static Application Security Testing (SAST)');

      const removeTaskAction = removeTask('task-review-03');
      const next3 = produce(next2, removeTaskAction.apply);
      expect(next3['assessment-plan'].tasks?.some(t => t.uuid === 'task-review-03')).toBe(false);
    });

    it('sets all 3 timing variants (on-date, within-date-range, at-frequency)', () => {
      const state = createSampleAP();

      // Variant 1: on-date
      const next1 = produce(state, setTaskTiming('task-kickoff-01', {
        'on-date': { date: '2026-11-01T10:00:00Z' }
      }).apply);
      expect(next1['assessment-plan'].tasks?.[0].timing).toEqual({
        'on-date': { date: '2026-11-01T10:00:00Z' }
      });

      // Variant 2: within-date-range
      const next2 = produce(state, setTaskTiming('task-scan-02', {
        'within-date-range': { start: '2026-11-05T08:00:00Z', end: '2026-11-10T18:00:00Z' }
      }).apply);
      expect(next2['assessment-plan'].tasks?.[1].timing).toEqual({
        'within-date-range': { start: '2026-11-05T08:00:00Z', end: '2026-11-10T18:00:00Z' }
      });

      // Variant 3: at-frequency
      const next3 = produce(state, setTaskTiming('task-scan-02', {
        'at-frequency': { period: 30, unit: 'days' }
      }).apply);
      expect(next3['assessment-plan'].tasks?.[1].timing).toEqual({
        'at-frequency': { period: 30, unit: 'days' }
      });
    });

    it('adds and removes valid task dependencies', () => {
      const state = createSampleAP();
      // Add a third task
      const next1 = produce(state, addTask({
        uuid: 'task-report-03',
        type: 'milestone',
        title: 'Draft Findings Delivery'
      }).apply);

      // Add dependency: task-report-03 depends on task-scan-02
      const addDep = addTaskDependency('task-report-03', 'task-scan-02', 'Requires scan completion');
      const next2 = produce(next1, addDep.apply);
      const reportTask = next2['assessment-plan'].tasks?.find(t => t.uuid === 'task-report-03');
      expect(reportTask?.dependencies?.some(d => d['task-uuid'] === 'task-scan-02')).toBe(true);

      // Remove dependency
      const removeDep = removeTaskDependency('task-report-03', 'task-scan-02');
      const next3 = produce(next2, removeDep.apply);
      const reportTask2 = next3['assessment-plan'].tasks?.find(t => t.uuid === 'task-report-03');
      expect(reportTask2?.dependencies?.some(d => d['task-uuid'] === 'task-scan-02')).toBe(false);
    });

    it('detects and rejects circular dependencies (DAG cycle detection)', () => {
      const state = createSampleAP();
      // Current DAG: task-scan-02 depends on task-kickoff-01

      // 1. Self dependency must throw
      expect(() => {
        produce(state, addTaskDependency('task-kickoff-01', 'task-kickoff-01').apply);
      }).toThrow(/cannot depend on itself/i);

      // 2. Direct cycle (task-kickoff-01 depends on task-scan-02) must throw
      expect(() => {
        produce(state, addTaskDependency('task-kickoff-01', 'task-scan-02').apply);
      }).toThrow(/circular dependency detected/i);

      // 3. Transitive cycle: add Task C depending on Task B (task-scan-02), then attempt Task A depending on Task C
      const next1 = produce(state, addTask({
        uuid: 'task-c',
        type: 'action',
        title: 'Task C',
        dependencies: [{ 'task-uuid': 'task-scan-02' }]
      }).apply);

      expect(() => {
        produce(next1, addTaskDependency('task-kickoff-01', 'task-c').apply);
      }).toThrow(/circular dependency detected/i);
    });

    it('links and removes associated activities on tasks', () => {
      const state = createSampleAP();
      const linkAction = addTaskActivity('task-scan-02', 'act-audit-accounts', [
        { type: 'component', 'include-all': {} }
      ]);
      const next1 = produce(state, linkAction.apply);
      const task = next1['assessment-plan'].tasks?.find(t => t.uuid === 'task-scan-02');
      expect(task?.['associated-activities']?.some(a => a['activity-uuid'] === 'act-audit-accounts')).toBe(true);

      const unlinkAction = removeTaskActivity('task-scan-02', 'act-audit-accounts');
      const next2 = produce(next1, unlinkAction.apply);
      const task2 = next2['assessment-plan'].tasks?.find(t => t.uuid === 'task-scan-02');
      expect(task2?.['associated-activities']?.some(a => a['activity-uuid'] === 'act-audit-accounts')).toBe(false);
    });

    it('cleans up broken dependencies when a task is removed', () => {
      const state = createSampleAP();
      // task-scan-02 depends on task-kickoff-01
      const action = removeTask('task-kickoff-01');
      const next = produce(state, action.apply);

      const scanTask = next['assessment-plan'].tasks?.find(t => t.uuid === 'task-scan-02');
      expect(scanTask?.dependencies?.some(d => d['task-uuid'] === 'task-kickoff-01')).toBe(false);
    });
  });

  // ==========================================================================
  // 7. Terms & Conditions Actions
  // ==========================================================================
  describe('Terms & Conditions Actions', () => {
    it('adds, updates, and removes canonical terms parts (7 types)', () => {
      const state = createSampleAP();

      // Add methodology part
      const addMethodology = addTermsPart({
        uuid: 'term-method-02',
        name: 'methodology',
        title: 'Assessment Methodology',
        prose: 'Assessment follows NIST SP 800-53A Rev 5 assessment procedures.'
      });
      const next1 = produce(state, addMethodology.apply);
      expect(next1['assessment-plan']['terms-and-conditions']?.parts).toHaveLength(2);
      expect(next1['assessment-plan']['terms-and-conditions']?.parts[1].name).toBe('methodology');

      // Add assessment-exclusions part
      const addExclusions = addTermsPart({
        uuid: 'term-excl-03',
        name: 'assessment-exclusions',
        title: 'Testing Exclusions',
        prose: 'Denial of service testing and production data alteration are strictly prohibited.'
      });
      const next2 = produce(next1, addExclusions.apply);
      expect(next2['assessment-plan']['terms-and-conditions']?.parts).toHaveLength(3);

      // Update part by uuid
      const updateAction = updateTermsPart('term-method-02', { prose: 'Updated methodology guidelines.' });
      const next3 = produce(next2, updateAction.apply);
      expect(next3['assessment-plan']['terms-and-conditions']?.parts.find(p => p.uuid === 'term-method-02')?.prose).toBe('Updated methodology guidelines.');

      // Remove part by index
      const removeAction = removeTermsPart(0);
      const next4 = produce(next3, removeAction.apply);
      expect(next4['assessment-plan']['terms-and-conditions']?.parts).toHaveLength(2);
    });
  });

  // ==========================================================================
  // 8. Back-Matter Resource Actions
  // ==========================================================================
  describe('Back-Matter Resource Attachments Actions', () => {
    it('adds, updates, and removes Base64 resource attachments', () => {
      const state = createSampleAP();
      const addResource = addResourceAttachment({
        uuid: 'res-config-yaml-02',
        title: 'Scanner Configuration Profile.yaml',
        rlinks: [{ href: '#res-config-yaml-02', 'media-type': 'application/x-yaml' }],
        base64: {
          filename: 'nessus_profile.yaml',
          'media-type': 'application/x-yaml',
          value: 'cGx1Z2luczogYWxsCnRocmVhZHM6IDQK'
        }
      });
      const next1 = produce(state, addResource.apply);
      expect(next1['assessment-plan']['back-matter']?.resources?.some(r => r.uuid === 'res-config-yaml-02')).toBe(true);

      const updateResource = updateResourceAttachment('res-config-yaml-02', { title: 'Updated Scanner Profile.yaml' });
      const next2 = produce(next1, updateResource.apply);
      expect(next2['assessment-plan']['back-matter']?.resources?.find(r => r.uuid === 'res-config-yaml-02')?.title).toBe('Updated Scanner Profile.yaml');

      const removeResource = removeResourceAttachment('res-config-yaml-02');
      const next3 = produce(next2, removeResource.apply);
      expect(next3['assessment-plan']['back-matter']?.resources?.some(r => r.uuid === 'res-config-yaml-02')).toBe(false);
    });
  });

  // ==========================================================================
  // 9. DD-014 Empty Array Purging & Reducer State Transitions
  // ==========================================================================
  describe('DD-014 Empty Array Purging & Reducer', () => {
    it('cleanAPEmptyArrays cleans empty arrays while preserving defined arrays', () => {
      const testDoc = {
        'assessment-plan': {
          uuid: 'test-123',
          metadata: {
            title: 'Test',
            roles: [],
            parties: [{ uuid: 'p1', name: 'Party 1' }]
          },
          tasks: [],
          'reviewed-controls': {
            'control-selections': []
          }
        }
      };

      const cleaned = cleanAPEmptyArrays(testDoc) as any;
      expect(cleaned['assessment-plan'].metadata.roles).toBeUndefined();
      expect(cleaned['assessment-plan'].metadata.parties).toHaveLength(1);
      expect(cleaned['assessment-plan'].tasks).toBeUndefined();
    });

    it('purgeAPEmptyArrays purges in-place on draft', () => {
      const draft = {
        'assessment-plan': {
          uuid: 'test-456',
          metadata: {
            title: 'Test Draft',
            roles: [],
            props: []
          }
        }
      };

      purgeAPEmptyArrays(draft);
      expect(draft['assessment-plan'].metadata.roles).toBeUndefined();
      expect(draft['assessment-plan'].metadata.props).toBeUndefined();
    });

    it('assessmentPlanReducer performs immutable transitions', () => {
      const initialAP: AssessmentPlan = createSampleAP()['assessment-plan'];
      const action = setAPTitle('Reducer Updated Title');

      const nextAP = assessmentPlanReducer(initialAP, action);

      // Verify immutability
      expect(initialAP.metadata.title).toBe('Sample Core Platform Security Assessment Plan');
      expect(nextAP.metadata.title).toBe('Reducer Updated Title');
      expect(nextAP).not.toBe(initialAP);
    });

    it('updates general field and list items via utility actions', () => {
      const state = createSampleAP();
      const updateFieldAction = updateAPField(['metadata', 'remarks'], 'Direct field update');
      const next1 = produce(state, updateFieldAction.apply);
      expect(next1['assessment-plan'].metadata.remarks).toBe('Direct field update');

      const updateListItemAction = updateAPListItem(['tasks'], 'task-kickoff-01', { description: 'Updated Kickoff Note' });
      const next2 = produce(next1, updateListItemAction.apply);
      expect(next2['assessment-plan'].tasks?.[0].description).toBe('Updated Kickoff Note');
    });
  });
});
