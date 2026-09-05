import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import {
  setImportAP,
  setAssessmentResultsMetadata,
  setARTitle,
  setARVersion,
  setARRemarks,
  addARParty,
  removeARParty,
  addARRole,
  removeARRole,
  setARProp,
  removeARProp,
  addBackMatterResource,
  removeBackMatterResource,
  addResultSet,
  updateResultSet,
  removeResultSet,
  setResultReviewedControlsDescription,
  setResultControlSelections,
  addResultControlSelection,
  removeResultControlSelection,
  toggleResultIncludeAllControls,
  addResultIncludeControl,
  removeResultIncludeControl,
  addResultExcludeControl,
  removeResultExcludeControl,
  populateResultControlsFromAP,
  addObservation,
  updateObservation,
  removeObservation,
  toggleObservationMethod,
  setObservationMethods,
  setObservationTypes,
  addObservationRelevantEvidence,
  removeObservationRelevantEvidence,
  addObservationSubject,
  removeObservationSubject,
  addFinding,
  updateFinding,
  removeFinding,
  setFindingTarget,
  updateFindingTarget,
  linkFindingObservation,
  unlinkFindingObservation,
  linkFindingRisk,
  unlinkFindingRisk,
  addRisk,
  updateRisk,
  removeRisk,
  setRiskStatus,
  setRiskStatement,
  addRiskCharacterizationFacet,
  removeRiskCharacterizationFacet,
  addRiskThreatID,
  removeRiskThreatID,
  addRiskMitigatingFactor,
  removeRiskMitigatingFactor,
  addRiskRemediation,
  updateRiskRemediation,
  removeRiskRemediation,
  addRiskRemediationAsset,
  addRiskRemediationTask,
  addRiskLogEntry,
  removeRiskLogEntry,
  addAssessmentLogEntry,
  updateAssessmentLogEntry,
  removeAssessmentLogEntry,
  addAttestation,
  updateAttestation,
  removeAttestation,
  addAttestationPart,
  removeAttestationPart,
  addRootLocalObjective,
  removeRootLocalObjective,
  addRootLocalActivity,
  removeRootLocalActivity,
  addResultLocalComponent,
  updateResultLocalComponent,
  removeResultLocalComponent,
  addResultLocalUser,
  updateResultLocalUser,
  removeResultLocalUser,
  addResultLocalTask,
  updateResultLocalTask,
  removeResultLocalTask,
  replaceAssessmentResults,
  cleanAREmptyArrays,
  purgeAREmptyArrays,
  assessmentResultsReducer
} from '../../lib/document-actions/assessment-results-actions';
import { AssessmentResults, AssessmentResultsDocument } from '../../lib/types/oscal';

function createSampleAR(): AssessmentResultsDocument {
  return {
    'assessment-results': {
      uuid: 'ar-0000-1111-2222-3333',
      metadata: {
        title: 'Sample Security Assessment Results',
        version: '1.0.0',
        'oscal-version': '1.2.2',
        'last-modified': '2026-09-04T10:00:00Z',
        roles: [
          { id: 'lead-assessor', title: 'Lead Security Assessor' }
        ],
        parties: [
          {
            uuid: 'party-001',
            type: 'person',
            name: 'Alice Auditor',
            'email-addresses': ['alice@example.com']
          }
        ]
      },
      'import-ap': {
        href: '../assessment-plans/ap-0000-1111-2222-3333.json',
        remarks: 'Governing assessment plan for Q3 audit'
      },
      results: [
        {
          uuid: 'res-set-01',
          title: 'Initial Execution Phase',
          description: 'Automated vulnerability scanning and control evaluation',
          start: '2026-09-01T09:00:00Z',
          'reviewed-controls': {
            description: 'Core reviewed controls evaluated during testing',
            'control-selections': [
              {
                'include-controls': [
                  { 'control-id': 'ac-1' },
                  { 'control-id': 'ac-2', 'statement-ids': ['ac-2_smt_a'] }
                ]
              }
            ]
          },
          observations: [
            {
              uuid: 'obs-001',
              title: 'Open SSH Port 22 Exposed',
              description: 'Network scan detected SSH listener open to public subnet.',
              methods: ['TEST', 'EXAMINE'],
              types: ['finding', 'ssp-statement-issue'],
              collected: '2026-09-02T10:00:00Z'
            }
          ],
          risks: [
            {
              uuid: 'risk-001',
              title: 'Unauthorized Remote Shell Access',
              description: 'Exposed port allows brute-force attacks against administrative credentials.',
              statement: 'Failure to restrict SSH access exposes server instances to credential stuffing.',
              status: 'open'
            }
          ],
          findings: [
            {
              uuid: 'find-001',
              title: 'AC-1 Policy Violation - Network Exposure',
              description: 'Access control baseline policy requires bastion-only SSH access.',
              target: {
                type: 'statement-id',
                'target-id': 'ac-1_smt',
                status: {
                  state: 'not-satisfied',
                  reason: 'fail'
                }
              },
              'related-observations': [
                { 'observation-uuid': 'obs-001' }
              ],
              'related-risks': [
                { 'risk-uuid': 'risk-001' }
              ]
            }
          ]
        }
      ]
    }
  };
}

describe('Assessment Results Document Actions Suite (DD-029 & DD-038)', () => {
  // ==========================================================================
  // 1. Root Document & Metadata Actions
  // ==========================================================================
  describe('1. Root Document & Metadata Actions', () => {
    it('sets import-ap href and remarks', () => {
      const state = createSampleAR();
      const action = setImportAP('https://example.com/ap.json', 'Updated remote AP');
      const next = produce(state, action.apply);

      expect(next['assessment-results']['import-ap']?.href).toBe('https://example.com/ap.json');
      expect(next['assessment-results']['import-ap']?.remarks).toBe('Updated remote AP');
    });

    it('updates metadata fields and timestamps', () => {
      const state = createSampleAR();
      const action = setAssessmentResultsMetadata({ version: '1.1.0' });
      const next = produce(state, action.apply);

      expect(next['assessment-results'].metadata.version).toBe('1.1.0');
      expect(next['assessment-results'].metadata['last-modified']).toBeDefined();
    });

    it('sets document title and version', () => {
      const state = createSampleAR();
      const titleAction = setARTitle('Updated Annual SAR');
      const versionAction = setARVersion('2.0.0');

      const next1 = produce(state, titleAction.apply);
      const next2 = produce(next1, versionAction.apply);

      expect(next2['assessment-results'].metadata.title).toBe('Updated Annual SAR');
      expect(next2['assessment-results'].metadata.version).toBe('2.0.0');
    });

    it('sets and removes metadata remarks', () => {
      const state = createSampleAR();
      const setRemarkAction = setARRemarks('Final audit sign-off');
      const next1 = produce(state, setRemarkAction.apply);
      expect(next1['assessment-results'].metadata.remarks).toBe('Final audit sign-off');

      const clearRemarkAction = setARRemarks('');
      const next2 = produce(next1, clearRemarkAction.apply);
      expect(next2['assessment-results'].metadata.remarks).toBeUndefined();
    });

    it('adds, updates, and removes parties', () => {
      const state = createSampleAR();
      const addAction = addARParty({
        uuid: 'party-002',
        type: 'person',
        name: 'Bob Assessor',
        'email-addresses': ['bob@example.com']
      });
      const next1 = produce(state, addAction.apply);
      expect(next1['assessment-results'].metadata.parties).toHaveLength(2);

      const updateAction = addARParty({
        uuid: 'party-002',
        name: 'Robert Assessor'
      });
      const next2 = produce(next1, updateAction.apply);
      expect(next2['assessment-results'].metadata.parties?.find(p => p.uuid === 'party-002')?.name).toBe('Robert Assessor');

      const removeAction = removeARParty('party-002');
      const next3 = produce(next2, removeAction.apply);
      expect(next3['assessment-results'].metadata.parties).toHaveLength(1);
    });

    it('adds and removes roles', () => {
      const state = createSampleAR();
      const addRoleAction = addARRole({ id: 'qa-reviewer', title: 'QA Reviewer' });
      const next1 = produce(state, addRoleAction.apply);
      expect(next1['assessment-results'].metadata.roles?.some(r => r.id === 'qa-reviewer')).toBe(true);

      const removeRoleAction = removeARRole('qa-reviewer');
      const next2 = produce(next1, removeRoleAction.apply);
      expect(next2['assessment-results'].metadata.roles?.some(r => r.id === 'qa-reviewer')).toBe(false);
    });

    it('sets and removes document properties', () => {
      const state = createSampleAR();
      const setPropAction = setARProp('classification', 'restricted', 'https://example.com/ns');
      const next1 = produce(state, setPropAction.apply);
      expect(next1['assessment-results'].metadata.props?.find(p => p.name === 'classification')?.value).toBe('restricted');

      const removePropAction = removeARProp('classification');
      const next2 = produce(next1, removePropAction.apply);
      expect(next2['assessment-results'].metadata.props?.find(p => p.name === 'classification')).toBeUndefined();
    });

    it('adds and removes back-matter attachments', () => {
      const state = createSampleAR();
      const addResAction = addBackMatterResource({
        uuid: 'res-evidence-pcap',
        title: 'Network Packet Capture Evidence',
        description: 'PCAP file containing evidence of cleartext communication'
      });
      const next1 = produce(state, addResAction.apply);
      expect(next1['assessment-results']['back-matter']?.resources?.some(r => r.uuid === 'res-evidence-pcap')).toBe(true);

      const removeResAction = removeBackMatterResource('res-evidence-pcap');
      const next2 = produce(next1, removeResAction.apply);
      expect(next2['assessment-results']['back-matter']?.resources?.some(r => r.uuid === 'res-evidence-pcap')).toBe(false);
    });
  });

  // ==========================================================================
  // 2. Result Set Actions
  // ==========================================================================
  describe('2. Result Set Actions', () => {
    it('adds a new result set with default assemblies', () => {
      const state = createSampleAR();
      const action = addResultSet({
        title: 'Phase 2 Penetration Testing',
        description: 'Simulated adversary exploitation phase'
      });
      const next = produce(state, action.apply);

      expect(next['assessment-results'].results).toHaveLength(2);
      const newRS = next['assessment-results'].results[1];
      expect(newRS.title).toBe('Phase 2 Penetration Testing');
      expect(newRS.start).toBeDefined();
      expect(newRS['reviewed-controls']).toBeDefined();
      expect(newRS.observations).toEqual([]);
      expect(newRS.findings).toEqual([]);
      expect(newRS.risks).toEqual([]);
    });

    it('updates and removes a result set', () => {
      const state = createSampleAR();
      const updateAction = updateResultSet(0, { title: 'Updated Phase 1 Results' });
      const next1 = produce(state, updateAction.apply);
      expect(next1['assessment-results'].results[0].title).toBe('Updated Phase 1 Results');

      const removeAction = removeResultSet(0);
      const next2 = produce(next1, removeAction.apply);
      expect(next2['assessment-results'].results).toHaveLength(0);
    });

    it('configures reviewed-controls selections and include-all toggle', () => {
      const state = createSampleAR();
      const setDescAction = setResultReviewedControlsDescription(0, 'Comprehensive evaluated scope');
      const next1 = produce(state, setDescAction.apply);
      expect(next1['assessment-results'].results[0]['reviewed-controls'].description).toBe('Comprehensive evaluated scope');

      // Add a selection with include-all
      const addSelAction = addResultControlSelection(0, { description: 'Secondary selection' });
      const next2 = produce(next1, addSelAction.apply);
      expect(next2['assessment-results'].results[0]['reviewed-controls']['control-selections']).toHaveLength(2);

      // Toggle include-all on second selection
      const toggleAction = toggleResultIncludeAllControls(0, 1, false);
      const next3 = produce(next2, toggleAction.apply);
      expect(next3['assessment-results'].results[0]['reviewed-controls']['control-selections'][1]['include-all']).toBeUndefined();
      expect(next3['assessment-results'].results[0]['reviewed-controls']['control-selections'][1]['include-controls']).toEqual([]);

      // Add include control
      const addIncAction = addResultIncludeControl(0, 1, 'ia-2', ['ia-2_smt']);
      const next4 = produce(next3, addIncAction.apply);
      expect(next4['assessment-results'].results[0]['reviewed-controls']['control-selections'][1]['include-controls']?.[0]['control-id']).toBe('ia-2');

      // Remove include control
      const removeIncAction = removeResultIncludeControl(0, 1, 'ia-2');
      const next5 = produce(next4, removeIncAction.apply);
      expect(next5['assessment-results'].results[0]['reviewed-controls']['control-selections'][1]['include-controls']).toHaveLength(0);

      // Add and remove exclude control
      const addExcAction = addResultExcludeControl(0, 1, 'sc-7');
      const next6 = produce(next5, addExcAction.apply);
      expect(next6['assessment-results'].results[0]['reviewed-controls']['control-selections'][1]['exclude-controls']?.[0]['control-id']).toBe('sc-7');

      const removeExcAction = removeResultExcludeControl(0, 1, 'sc-7');
      const next7 = produce(next6, removeExcAction.apply);
      expect(next7['assessment-results'].results[0]['reviewed-controls']['control-selections'][1]['exclude-controls']).toHaveLength(0);

      // Remove the second selection
      const removeSelAction = removeResultControlSelection(0, 1);
      const next8 = produce(next7, removeSelAction.apply);
      expect(next8['assessment-results'].results[0]['reviewed-controls']['control-selections']).toHaveLength(1);
    });

    it('populates reviewed-controls from AP planned controls', () => {
      const state = createSampleAR();
      const apControls = [
        { controlId: 'ac-1', statementIds: ['ac-1_smt'] },
        { controlId: 'ac-2' },
        { controlId: 'ia-2', statementIds: ['ia-2_smt_a', 'ia-2_smt_b'] }
      ];
      const action = populateResultControlsFromAP(0, apControls);
      const next = produce(state, action.apply);

      const selections = next['assessment-results'].results[0]['reviewed-controls']['control-selections'];
      expect(selections).toHaveLength(1);
      expect(selections[0]['include-controls']).toHaveLength(3);
      expect(selections[0]['include-controls']?.[0]['control-id']).toBe('ac-1');
      expect(selections[0]['include-controls']?.[2]['statement-ids']).toEqual(['ia-2_smt_a', 'ia-2_smt_b']);
    });
  });

  // ==========================================================================
  // 3. Observation Actions
  // ==========================================================================
  describe('3. Observation Actions', () => {
    it('adds, updates, and removes an observation with methods', () => {
      const state = createSampleAR();
      const addObsAction = addObservation(0, {
        uuid: 'obs-002',
        title: 'Unencrypted HTTP endpoint',
        description: 'Port 80 redirect is not enforced',
        methods: ['TEST']
      });
      const next1 = produce(state, addObsAction.apply);
      expect(next1['assessment-results'].results[0].observations).toHaveLength(2);
      expect(next1['assessment-results'].results[0].observations?.[1].methods).toEqual(['TEST']);

      const updateObsAction = updateObservation(0, 1, { title: 'Plaintext HTTP Active' });
      const next2 = produce(next1, updateObsAction.apply);
      expect(next2['assessment-results'].results[0].observations?.[1].title).toBe('Plaintext HTTP Active');

      const removeObsAction = removeObservation(0, 1);
      const next3 = produce(next2, removeObsAction.apply);
      expect(next3['assessment-results'].results[0].observations).toHaveLength(1);
    });

    it('cascades unlinking when an observation is deleted', () => {
      const state = createSampleAR();
      // obs-001 is linked in find-001.related-observations
      expect(state['assessment-results'].results[0].findings?.[0]['related-observations']?.[0]['observation-uuid']).toBe('obs-001');

      const removeAction = removeObservation(0, 0);
      const next = produce(state, action => removeAction.apply(action));

      expect(next['assessment-results'].results[0].observations).toHaveLength(0);
      // Finding should have observation unlinked
      expect(next['assessment-results'].results[0].findings?.[0]['related-observations']).toHaveLength(0);
    });

    it('toggles observation methods while preserving minItems: 1', () => {
      const state = createSampleAR();
      // obs-001 has methods: ['TEST', 'EXAMINE']
      const toggleOffTest = toggleObservationMethod(0, 0, 'TEST');
      const next1 = produce(state, toggleOffTest.apply);
      expect(next1['assessment-results'].results[0].observations?.[0].methods).toEqual(['EXAMINE']);

      // Attempt to toggle off the last remaining method: should NOT remove (protects minItems: 1)
      const toggleOffExamine = toggleObservationMethod(0, 0, 'EXAMINE');
      const next2 = produce(next1, toggleOffExamine.apply);
      expect(next2['assessment-results'].results[0].observations?.[0].methods).toEqual(['EXAMINE']);

      // Toggle on INTERVIEW
      const toggleOnInterview = toggleObservationMethod(0, 0, 'INTERVIEW');
      const next3 = produce(next2, toggleOnInterview.apply);
      expect(next3['assessment-results'].results[0].observations?.[0].methods).toEqual(['EXAMINE', 'INTERVIEW']);
    });

    it('manages relevant evidence links and subjects', () => {
      const state = createSampleAR();
      const addEvidenceAction = addObservationRelevantEvidence(0, 0, {
        description: 'Wireshark packet capture analysis',
        href: '#res-evidence-pcap'
      });
      const next1 = produce(state, addEvidenceAction.apply);
      expect(next1['assessment-results'].results[0].observations?.[0]['relevant-evidence']).toHaveLength(1);

      const removeEvidenceAction = removeObservationRelevantEvidence(0, 0, 0);
      const next2 = produce(next1, removeEvidenceAction.apply);
      expect(next2['assessment-results'].results[0].observations?.[0]['relevant-evidence']).toHaveLength(0);

      const addSubjectAction = addObservationSubject(0, 0, {
        'subject-uuid': 'comp-web-01',
        type: 'component',
        title: 'Production Web App'
      });
      const next3 = produce(next2, addSubjectAction.apply);
      expect(next3['assessment-results'].results[0].observations?.[0].subjects).toHaveLength(1);

      const removeSubjectAction = removeObservationSubject(0, 0, 0);
      const next4 = produce(next3, removeSubjectAction.apply);
      expect(next4['assessment-results'].results[0].observations?.[0].subjects).toHaveLength(0);
    });
  });

  // ==========================================================================
  // 4. Finding Actions
  // ==========================================================================
  describe('4. Finding Actions', () => {
    it('adds, updates, and removes findings', () => {
      const state = createSampleAR();
      const addAction = addFinding(0, {
        uuid: 'find-002',
        title: 'AC-2 Account Lifecycle Deficiency',
        description: 'Inactive user accounts were not disabled within 90 days',
        target: {
          type: 'statement-id',
          'target-id': 'ac-2_smt_a',
          status: { state: 'not-satisfied', reason: 'fail' }
        }
      });
      const next1 = produce(state, addAction.apply);
      expect(next1['assessment-results'].results[0].findings).toHaveLength(2);

      const updateAction = updateFinding(0, 1, { title: 'AC-2 Account Inactivity Violation' });
      const next2 = produce(next1, updateAction.apply);
      expect(next2['assessment-results'].results[0].findings?.[1].title).toBe('AC-2 Account Inactivity Violation');

      const removeAction = removeFinding(0, 1);
      const next3 = produce(next2, removeAction.apply);
      expect(next3['assessment-results'].results[0].findings).toHaveLength(1);
    });

    it('sets and updates finding target assembly', () => {
      const state = createSampleAR();
      const setTargetAction = setFindingTarget(0, 0, {
        type: 'objective-id',
        'target-id': 'ac-1_obj_1',
        status: { state: 'satisfied', reason: 'pass' }
      });
      const next1 = produce(state, setTargetAction.apply);
      expect(next1['assessment-results'].results[0].findings?.[0].target.type).toBe('objective-id');
      expect(next1['assessment-results'].results[0].findings?.[0].target['target-id']).toBe('ac-1_obj_1');
      expect(next1['assessment-results'].results[0].findings?.[0].target.status.state).toBe('satisfied');

      const updateTargetAction = updateFindingTarget(0, 0, {
        'implementation-status': { state: 'implemented', remarks: 'Policy enforced by automated script' }
      });
      const next2 = produce(next1, updateTargetAction.apply);
      expect(next2['assessment-results'].results[0].findings?.[0].target['implementation-status']?.state).toBe('implemented');
    });

    it('links and unlinks observations and risks with deduplication', () => {
      const state = createSampleAR();
      // Link a new observation to find-001
      const linkObs = linkFindingObservation(0, 0, 'obs-new-99', 'Corroborating evidence');
      const next1 = produce(state, linkObs.apply);
      expect(next1['assessment-results'].results[0].findings?.[0]['related-observations']).toHaveLength(2);

      // Attempting to link the same observation again does not duplicate
      const next2 = produce(next1, linkObs.apply);
      expect(next2['assessment-results'].results[0].findings?.[0]['related-observations']).toHaveLength(2);

      // Unlink observation
      const unlinkObs = unlinkFindingObservation(0, 0, 'obs-new-99');
      const next3 = produce(next2, unlinkObs.apply);
      expect(next3['assessment-results'].results[0].findings?.[0]['related-observations']).toHaveLength(1);

      // Link a new risk
      const linkRisk = linkFindingRisk(0, 0, 'risk-new-99', 'Impact analysis');
      const next4 = produce(next3, linkRisk.apply);
      expect(next4['assessment-results'].results[0].findings?.[0]['related-risks']).toHaveLength(2);

      // Unlink risk
      const unlinkRisk = unlinkFindingRisk(0, 0, 'risk-new-99');
      const next5 = produce(next4, unlinkRisk.apply);
      expect(next5['assessment-results'].results[0].findings?.[0]['related-risks']).toHaveLength(1);
    });
  });

  // ==========================================================================
  // 5. Risk Actions
  // ==========================================================================
  describe('5. Risk Actions', () => {
    it('adds, updates, and removes a risk', () => {
      const state = createSampleAR();
      const addAction = addRisk(0, {
        uuid: 'risk-002',
        title: 'Weak TLS Cipher Suites Enabled',
        description: 'Legacy 3DES ciphers are active',
        statement: 'Permitting weak ciphers exposes traffic to eavesdropping attacks.',
        status: 'open'
      });
      const next1 = produce(state, addAction.apply);
      expect(next1['assessment-results'].results[0].risks).toHaveLength(2);
      expect(next1['assessment-results'].results[0].risks?.[1].statement).toBeDefined();

      const updateAction = updateRisk(0, 1, { title: 'Deprecate TLS 1.0/1.1' });
      const next2 = produce(next1, updateAction.apply);
      expect(next2['assessment-results'].results[0].risks?.[1].title).toBe('Deprecate TLS 1.0/1.1');

      const removeAction = removeRisk(0, 1);
      const next3 = produce(next2, removeAction.apply);
      expect(next3['assessment-results'].results[0].risks).toHaveLength(1);
    });

    it('cascades unlinking when a risk is removed', () => {
      const state = createSampleAR();
      // risk-001 is linked in find-001.related-risks
      expect(state['assessment-results'].results[0].findings?.[0]['related-risks']?.[0]['risk-uuid']).toBe('risk-001');

      const removeAction = removeRisk(0, 0);
      const next = produce(state, removeAction.apply);

      expect(next['assessment-results'].results[0].risks).toHaveLength(0);
      expect(next['assessment-results'].results[0].findings?.[0]['related-risks']).toHaveLength(0);
    });

    it('updates risk status and automatically appends to risk-log (DD-038 Decision 4.B)', () => {
      const state = createSampleAR();
      const action = setRiskStatus(
        0,
        0,
        'investigating',
        'party-001',
        'lead-assessor',
        'Assigned to DevSecOps team for triage'
      );
      const next = produce(state, action.apply);

      const updatedRisk = next['assessment-results'].results[0].risks?.[0];
      expect(updatedRisk?.status).toBe('investigating');
      expect(updatedRisk?.['risk-log']?.entries).toHaveLength(1);

      const logEntry = updatedRisk?.['risk-log']?.entries[0];
      expect(logEntry?.['status-change']).toBe('investigating');
      expect(logEntry?.description).toBe('Assigned to DevSecOps team for triage');
      expect(logEntry?.['logged-by']?.[0]['party-uuid']).toBe('party-001');
      expect(logEntry?.['logged-by']?.[0]['role-id']).toBe('lead-assessor');
      expect(logEntry?.start).toBeDefined();
    });

    it('manages risk characterization facets (CVSS / FedRAMP)', () => {
      const state = createSampleAR();
      const addFacet = addRiskCharacterizationFacet(0, 0, {
        name: 'score',
        system: 'http://www.first.org/cvss/v3.1',
        value: '8.8'
      });
      const next1 = produce(state, addFacet.apply);
      const facets = next1['assessment-results'].results[0].risks?.[0].characterizations?.[0].facets;
      expect(facets).toHaveLength(1);
      expect(facets?.[0].value).toBe('8.8');

      const removeFacet = removeRiskCharacterizationFacet(0, 0, 0);
      const next2 = produce(next1, removeFacet.apply);
      expect(next2['assessment-results'].results[0].risks?.[0].characterizations?.[0].facets).toHaveLength(0);
    });

    it('manages risk threat IDs, mitigating factors, and remediations', () => {
      const state = createSampleAR();
      // Threat ID
      const addThreat = addRiskThreatID(0, 0, {
        system: 'http://cve.mitre.org',
        id: 'CVE-2024-12345',
        href: 'https://nvd.nist.gov/vuln/detail/CVE-2024-12345'
      });
      const next1 = produce(state, addThreat.apply);
      expect(next1['assessment-results'].results[0].risks?.[0]['threat-ids']).toHaveLength(1);

      const removeThreat = removeRiskThreatID(0, 0, 0);
      const next2 = produce(next1, removeThreat.apply);
      expect(next2['assessment-results'].results[0].risks?.[0]['threat-ids']).toHaveLength(0);

      // Mitigating factor
      const addFactor = addRiskMitigatingFactor(0, 0, {
        description: 'Compensating network firewall rule blocks incoming connections outside VPN'
      });
      const next3 = produce(next2, addFactor.apply);
      expect(next3['assessment-results'].results[0].risks?.[0]['mitigating-factors']).toHaveLength(1);

      const removeFactor = removeRiskMitigatingFactor(0, 0, 0);
      const next4 = produce(next3, removeFactor.apply);
      expect(next4['assessment-results'].results[0].risks?.[0]['mitigating-factors']).toHaveLength(0);

      // Remediation (Response)
      const addRem = addRiskRemediation(0, 0, {
        lifecycle: 'planned',
        title: 'Disable Port 22 and Enforce Session Manager',
        description: 'Replace SSH with AWS Systems Manager Session Manager'
      });
      const next5 = produce(next4, addRem.apply);
      expect(next5['assessment-results'].results[0].risks?.[0].remediations).toHaveLength(1);

      // Add remediation asset and task
      const addAsset = addRiskRemediationAsset(0, 0, 0, { description: 'AWS SSM Agent' });
      const next6 = produce(next5, addAsset.apply);
      expect(next6['assessment-results'].results[0].risks?.[0].remediations?.[0]['required-assets']).toHaveLength(1);

      const addTask = addRiskRemediationTask(0, 0, 0, {
        title: 'Deploy SSM Agent via Ansible playbook'
      });
      const next7 = produce(next6, addTask.apply);
      expect(next7['assessment-results'].results[0].risks?.[0].remediations?.[0].tasks).toHaveLength(1);

      const removeRem = removeRiskRemediation(0, 0, 0);
      const next8 = produce(next7, removeRem.apply);
      expect(next8['assessment-results'].results[0].risks?.[0].remediations).toHaveLength(0);
    });
  });

  // ==========================================================================
  // 6. Assessment Log & Attestation Actions
  // ==========================================================================
  describe('6. Assessment Log & Attestation Actions', () => {
    it('manages assessment log entries', () => {
      const state = createSampleAR();
      const addLog = addAssessmentLogEntry(0, {
        title: 'Kickoff meeting completed',
        description: 'Scoping meeting with system owner finalized'
      });
      const next1 = produce(state, addLog.apply);
      expect(next1['assessment-results'].results[0]['assessment-log']?.entries).toHaveLength(1);

      const updateLog = updateAssessmentLogEntry(0, 0, { description: 'Scoping sign-off signed' });
      const next2 = produce(next1, updateLog.apply);
      expect(next2['assessment-results'].results[0]['assessment-log']?.entries[0].description).toBe('Scoping sign-off signed');

      const removeLog = removeAssessmentLogEntry(0, 0);
      const next3 = produce(next2, removeLog.apply);
      expect(next3['assessment-results'].results[0]['assessment-log']?.entries).toHaveLength(0);
    });

    it('manages attestations and assessment statement parts', () => {
      const state = createSampleAR();
      const addAttest = addAttestation(0, {
        parts: [
          {
            name: 'assessment-statement',
            title: 'Lead Assessor Final Attestation',
            prose: 'I certify that these assessment results represent true findings.'
          }
        ]
      });
      const next1 = produce(state, addAttest.apply);
      expect(next1['assessment-results'].results[0].attestations).toHaveLength(1);

      const addPart = addAttestationPart(0, 0, {
        name: 'co-sign-statement',
        title: 'Technical Reviewer Attestation',
        prose: 'Technical evidence verified independently.'
      });
      const next2 = produce(next1, addPart.apply);
      expect(next2['assessment-results'].results[0].attestations?.[0].parts).toHaveLength(2);

      const removePart = removeAttestationPart(0, 0, 1);
      const next3 = produce(next2, removePart.apply);
      expect(next3['assessment-results'].results[0].attestations?.[0].parts).toHaveLength(1);

      const removeAttest = removeAttestation(0, 0);
      const next4 = produce(next3, removeAttest.apply);
      expect(next4['assessment-results'].results[0].attestations).toHaveLength(0);
    });
  });

  // ==========================================================================
  // 7. Local Definitions Actions (Two-Tier Separation)
  // ==========================================================================
  describe('7. Local Definitions Actions (Root vs Result)', () => {
    it('manages root local definitions (objectives and activities)', () => {
      const state = createSampleAR();
      const addObj = addRootLocalObjective({
        'control-id': 'ac-2',
        description: 'Verify account disabling automation'
      });
      const next1 = produce(state, addObj.apply);
      expect(next1['assessment-results']['local-definitions']?.['objectives-and-methods']).toHaveLength(1);

      const removeObj = removeRootLocalObjective('ac-2');
      const next2 = produce(next1, removeObj.apply);
      expect(next2['assessment-results']['local-definitions']?.['objectives-and-methods']).toHaveLength(0);

      const addAct = addRootLocalActivity({
        uuid: 'act-001',
        title: 'Automated Vulnerability Scan Execution'
      });
      const next3 = produce(next2, addAct.apply);
      expect(next3['assessment-results']['local-definitions']?.activities).toHaveLength(1);

      const removeAct = removeRootLocalActivity('act-001');
      const next4 = produce(next3, removeAct.apply);
      expect(next4['assessment-results']['local-definitions']?.activities).toHaveLength(0);
    });

    it('manages result local definitions (components, users, tasks)', () => {
      const state = createSampleAR();
      // Local component
      const addComp = addResultLocalComponent(0, {
        uuid: 'comp-local-scanner',
        title: 'OpenVAS Local Scanner Instance'
      });
      const next1 = produce(state, addComp.apply);
      expect(next1['assessment-results'].results[0]['local-definitions']?.components).toHaveLength(1);

      const updateComp = updateResultLocalComponent(0, 'comp-local-scanner', { title: 'OpenVAS Scanner' });
      const next2 = produce(next1, updateComp.apply);
      expect(next2['assessment-results'].results[0]['local-definitions']?.components?.[0].title).toBe('OpenVAS Scanner');

      const removeComp = removeResultLocalComponent(0, 'comp-local-scanner');
      const next3 = produce(next2, removeComp.apply);
      expect(next3['assessment-results'].results[0]['local-definitions']?.components).toHaveLength(0);

      // Local user
      const addUser = addResultLocalUser(0, {
        uuid: 'user-local-assessor',
        title: 'Testing Lead Account'
      });
      const next4 = produce(next3, addUser.apply);
      expect(next4['assessment-results'].results[0]['local-definitions']?.users).toHaveLength(1);

      const removeUser = removeResultLocalUser(0, 'user-local-assessor');
      const next5 = produce(next4, removeUser.apply);
      expect(next5['assessment-results'].results[0]['local-definitions']?.users).toHaveLength(0);

      // Local task
      const addTask = addResultLocalTask(0, {
        uuid: 'task-local-verify',
        title: 'Verify remediation deployment'
      });
      const next6 = produce(next5, addTask.apply);
      expect(next6['assessment-results'].results[0]['local-definitions']?.tasks).toHaveLength(1);

      const removeTask = removeResultLocalTask(0, 'task-local-verify');
      const next7 = produce(next6, removeTask.apply);
      expect(next7['assessment-results'].results[0]['local-definitions']?.tasks).toHaveLength(0);
    });
  });

  // ==========================================================================
  // 8. Whole Document Replacement, Empty Array Purging & Reducer Immutability
  // ==========================================================================
  describe('8. Whole Document Replacement, Empty Array Purging & Reducer Immutability', () => {
    it('replaces entire assessment results document', () => {
      const state = createSampleAR();
      const replacementAR: AssessmentResults = {
        uuid: 'ar-brand-new',
        metadata: {
          title: 'Replaced Assessment Results',
          version: '3.0.0',
          'oscal-version': '1.2.2'
        },
        'import-ap': { href: 'ap-new.json' },
        results: []
      };
      const action = replaceAssessmentResults(replacementAR);
      const next = produce(state, action.apply);

      expect(next['assessment-results'].uuid).toBe('ar-brand-new');
      expect(next['assessment-results'].metadata.title).toBe('Replaced Assessment Results');
      expect(next['assessment-results'].results).toHaveLength(0);
    });

    it('cleanAREmptyArrays purges empty arrays from serialized tree (DD-014)', () => {
      const dirtyObj = {
        'assessment-results': {
          uuid: 'test-uuid',
          metadata: {
            title: 'Test Clean',
            roles: [],
            parties: [{ uuid: 'p1' }]
          },
          results: [
            {
              uuid: 'r1',
              observations: [],
              findings: [{ uuid: 'f1', 'related-observations': [] }],
              risks: []
            }
          ]
        }
      };

      const cleaned = cleanAREmptyArrays(dirtyObj) as any;
      expect(cleaned['assessment-results'].metadata.roles).toBeUndefined();
      expect(cleaned['assessment-results'].metadata.parties).toHaveLength(1);
      expect(cleaned['assessment-results'].results[0].observations).toBeUndefined();
      expect(cleaned['assessment-results'].results[0].findings[0]['related-observations']).toBeUndefined();
    });

    it('purgeAREmptyArrays cleans in-place on draft', () => {
      const draft = {
        'assessment-results': {
          uuid: 'test-draft',
          metadata: {
            title: 'Draft',
            roles: []
          },
          results: [
            {
              uuid: 'r1',
              risks: []
            }
          ]
        }
      };

      purgeAREmptyArrays(draft);
      expect(draft['assessment-results'].metadata.roles).toBeUndefined();
      expect(draft['assessment-results'].results[0].risks).toBeUndefined();
    });

    it('assessmentResultsReducer produces immutable state transitions and supports undo/redo history', () => {
      const initialDoc: AssessmentResults = createSampleAR()['assessment-results'];
      const history: AssessmentResults[] = [initialDoc];

      // Dispatch 1: Set Title
      const action1 = setARTitle('Step 1 Title');
      const state1 = assessmentResultsReducer(history[history.length - 1], action1);
      history.push(state1);

      // Dispatch 2: Set Version
      const action2 = setARVersion('1.0.1');
      const state2 = assessmentResultsReducer(history[history.length - 1], action2);
      history.push(state2);

      // Verify state progression
      expect(history).toHaveLength(3);
      expect(history[0].metadata.title).toBe('Sample Security Assessment Results');
      expect(history[1].metadata.title).toBe('Step 1 Title');
      expect(history[1].metadata.version).toBe('1.0.0');
      expect(history[2].metadata.title).toBe('Step 1 Title');
      expect(history[2].metadata.version).toBe('1.0.1');

      // Verify strict immutability (references are distinct)
      expect(history[0]).not.toBe(history[1]);
      expect(history[1]).not.toBe(history[2]);

      // Simulate Undo: pop last state
      history.pop();
      const currentAfterUndo = history[history.length - 1];
      expect(currentAfterUndo.metadata.version).toBe('1.0.0');
      expect(currentAfterUndo.metadata.title).toBe('Step 1 Title');
    });
  });
});
