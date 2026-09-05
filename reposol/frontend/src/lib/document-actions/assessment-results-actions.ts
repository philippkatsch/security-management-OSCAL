import { createAction, DocumentAction } from './types';
import {
  AssessmentResults,
  Metadata,
  ImportAP,
  Result,
  ReviewedControls,
  ControlSelection,
  Observation,
  Finding,
  FindingTarget,
  Risk,
  RiskFacet,
  RiskCharacterization,
  RiskMitigatingFactor,
  RiskThreatID,
  RiskResponse,
  RiskLogEntry,
  AssessmentLog,
  AssessmentLogEntry,
  Attestation,
  AssessmentPart,
  LocalObjective,
  LocalActivity,
  SystemComponent,
  SystemUser,
  Task,
  Resource,
  Property,
  Role,
  Party,
  SubjectReference,
  ResultLocalDefinitions,
  LocalDefinitions
} from '../types/oscal';
import { generateUUID } from '../oscal-utils';
import { produce } from 'immer';

// ============================================================================
// Internal Traversal & Ensure Helpers
// ============================================================================

export function getAR(draft: any): AssessmentResults | null {
  if (!draft) return null;
  return draft['assessment-results'] || draft;
}

export function ensureMetadata(draft: any): Metadata | null {
  const ar = getAR(draft);
  if (!ar) return null;
  if (!ar.metadata) {
    ar.metadata = {
      title: 'New Security Assessment Results',
      version: '1.0.0',
      'oscal-version': '1.2.2'
    };
  }
  return ar.metadata;
}

export function ensureImportAP(draft: any): ImportAP | null {
  const ar = getAR(draft);
  if (!ar) return null;
  if (!ar['import-ap']) {
    ar['import-ap'] = {
      href: ''
    };
  }
  return ar['import-ap'];
}

export function ensureResults(draft: any): Result[] {
  const ar = getAR(draft);
  if (!ar) return [];
  if (!ar.results) {
    ar.results = [];
  }
  return ar.results;
}

export function getResultSet(draft: any, resultIndex: number): Result | null {
  const results = ensureResults(draft);
  if (resultIndex < 0 || resultIndex >= results.length) {
    return null;
  }
  return results[resultIndex];
}

export function ensureReviewedControls(result: Result): ReviewedControls {
  if (!result['reviewed-controls']) {
    result['reviewed-controls'] = {
      'control-selections': [
        {
          'include-all': {}
        }
      ]
    };
  }
  if (!result['reviewed-controls']['control-selections']) {
    result['reviewed-controls']['control-selections'] = [];
  }
  return result['reviewed-controls'];
}

export function ensureObservations(result: Result): Observation[] {
  if (!result.observations) {
    result.observations = [];
  }
  return result.observations;
}

export function ensureFindings(result: Result): Finding[] {
  if (!result.findings) {
    result.findings = [];
  }
  return result.findings;
}

export function ensureRisks(result: Result): Risk[] {
  if (!result.risks) {
    result.risks = [];
  }
  return result.risks;
}

export function ensureAssessmentLog(result: Result): AssessmentLog {
  if (!result['assessment-log']) {
    result['assessment-log'] = { entries: [] };
  }
  if (!result['assessment-log'].entries) {
    result['assessment-log'].entries = [];
  }
  return result['assessment-log'];
}

export function ensureAttestations(result: Result): Attestation[] {
  if (!result.attestations) {
    result.attestations = [];
  }
  return result.attestations;
}

export function ensureResultLocalDefinitions(result: Result): ResultLocalDefinitions {
  if (!result['local-definitions']) {
    result['local-definitions'] = {};
  }
  return result['local-definitions'];
}

export function ensureRootLocalDefinitions(draft: any): LocalDefinitions | null {
  const ar = getAR(draft);
  if (!ar) return null;
  if (!ar['local-definitions']) {
    ar['local-definitions'] = {};
  }
  return ar['local-definitions'];
}

export function ensureBackMatter(draft: any): { resources?: Resource[] } | null {
  const ar = getAR(draft);
  if (!ar) return null;
  if (!ar['back-matter']) {
    ar['back-matter'] = {
      resources: []
    };
  }
  if (!ar['back-matter'].resources) {
    ar['back-matter'].resources = [];
  }
  return ar['back-matter'];
}

// ============================================================================
// 1. Root Document & Metadata Actions
// ============================================================================

export function setImportAP(href: string, remarks?: string): DocumentAction {
  return createAction('assessment-results', 'SET_IMPORT_AP', `Set target Assessment Plan to "${href}"`, (draft: any) => {
    const importAp = ensureImportAP(draft);
    if (!importAp) return;
    importAp.href = href;
    if (remarks !== undefined) {
      if (remarks) {
        importAp.remarks = remarks;
      } else {
        delete importAp.remarks;
      }
    }
  });
}

export function setAssessmentResultsMetadata(updates: Partial<Metadata>): DocumentAction {
  return createAction('assessment-results', 'SET_METADATA', 'Update Assessment Results metadata', (draft: any) => {
    const meta = ensureMetadata(draft);
    if (!meta) return;
    Object.assign(meta, updates);
    meta['last-modified'] = new Date().toISOString();
  });
}

export function setARTitle(title: string): DocumentAction {
  return createAction('assessment-results', 'SET_TITLE', `Set Assessment Results title to "${title}"`, (draft: any) => {
    const meta = ensureMetadata(draft);
    if (!meta) return;
    meta.title = title;
    meta['last-modified'] = new Date().toISOString();
  });
}

export function setARVersion(version: string): DocumentAction {
  return createAction('assessment-results', 'SET_VERSION', `Set Assessment Results version to "${version}"`, (draft: any) => {
    const meta = ensureMetadata(draft);
    if (!meta) return;
    meta.version = version;
    meta['last-modified'] = new Date().toISOString();
  });
}

export function setARRemarks(remarks: string): DocumentAction {
  return createAction('assessment-results', 'SET_REMARKS', 'Set Assessment Results remarks', (draft: any) => {
    const meta = ensureMetadata(draft);
    if (!meta) return;
    if (remarks) {
      meta.remarks = remarks;
    } else {
      delete meta.remarks;
    }
    meta['last-modified'] = new Date().toISOString();
  });
}

export function addARParty(party: Partial<Party>): DocumentAction {
  return createAction('assessment-results', 'ADD_PARTY', `Add party "${party.name || party.uuid || 'new'}"`, (draft: any) => {
    const meta = ensureMetadata(draft);
    if (!meta) return;
    if (!meta.parties) meta.parties = [];
    const targetUuid = party.uuid || generateUUID();
    const fullParty: Party = {
      uuid: targetUuid,
      type: party.type || 'organization',
      name: party.name,
      ...party
    };
    const idx = meta.parties.findIndex((p: any) => p.uuid === targetUuid);
    if (idx >= 0) {
      meta.parties[idx] = { ...meta.parties[idx], ...fullParty };
    } else {
      meta.parties.push(fullParty);
    }
    meta['last-modified'] = new Date().toISOString();
  });
}

export function removeARParty(partyUuid: string): DocumentAction {
  return createAction('assessment-results', 'REMOVE_PARTY', `Remove party "${partyUuid}"`, (draft: any) => {
    const meta = ensureMetadata(draft);
    if (!meta || !meta.parties) return;
    meta.parties = meta.parties.filter((p: any) => p.uuid !== partyUuid);
    meta['last-modified'] = new Date().toISOString();
  });
}

export function addARRole(role: Partial<Role>): DocumentAction {
  return createAction('assessment-results', 'ADD_ROLE', `Add role "${role.id || 'new'}"`, (draft: any) => {
    const meta = ensureMetadata(draft);
    if (!meta) return;
    if (!meta.roles) meta.roles = [];
    const roleId = role.id || generateUUID();
    const fullRole: Role = {
      id: roleId,
      title: role.title || roleId,
      ...role
    };
    const idx = meta.roles.findIndex((r: any) => r.id === roleId);
    if (idx >= 0) {
      meta.roles[idx] = { ...meta.roles[idx], ...fullRole };
    } else {
      meta.roles.push(fullRole);
    }
    meta['last-modified'] = new Date().toISOString();
  });
}

export function removeARRole(roleId: string): DocumentAction {
  return createAction('assessment-results', 'REMOVE_ROLE', `Remove role "${roleId}"`, (draft: any) => {
    const meta = ensureMetadata(draft);
    if (!meta || !meta.roles) return;
    meta.roles = meta.roles.filter((r: any) => r.id !== roleId);
    meta['last-modified'] = new Date().toISOString();
  });
}

export function setARProp(name: string, value: string, ns?: string): DocumentAction {
  return createAction('assessment-results', 'SET_PROP', `Set property "${name}"`, (draft: any) => {
    const meta = ensureMetadata(draft);
    if (!meta) return;
    if (!meta.props) meta.props = [];
    const existing = meta.props.find((p: any) => p.name === name);
    if (existing) {
      existing.value = value;
      if (ns) existing.ns = ns;
    } else {
      const newProp: Property = { name, value };
      if (ns) newProp.ns = ns;
      meta.props.push(newProp);
    }
    meta['last-modified'] = new Date().toISOString();
  });
}

export function removeARProp(name: string): DocumentAction {
  return createAction('assessment-results', 'REMOVE_PROP', `Remove property "${name}"`, (draft: any) => {
    const meta = ensureMetadata(draft);
    if (!meta || !meta.props) return;
    meta.props = meta.props.filter((p: any) => p.name !== name);
    meta['last-modified'] = new Date().toISOString();
  });
}

export function addBackMatterResource(resource: Partial<Resource>): DocumentAction {
  return createAction('assessment-results', 'ADD_BACK_MATTER_RESOURCE', `Add attachment "${resource.title || resource.uuid || 'new'}"`, (draft: any) => {
    const bm = ensureBackMatter(draft);
    if (!bm) return;
    if (!bm.resources) bm.resources = [];
    const resourceUuid = resource.uuid || generateUUID();
    const fullResource: Resource = {
      uuid: resourceUuid,
      title: resource.title || 'Attached Resource',
      ...resource
    };
    const idx = bm.resources.findIndex((r: any) => r.uuid === resourceUuid);
    if (idx >= 0) {
      bm.resources[idx] = { ...bm.resources[idx], ...fullResource };
    } else {
      bm.resources.push(fullResource);
    }
  });
}

export function removeBackMatterResource(resourceUuid: string): DocumentAction {
  return createAction('assessment-results', 'REMOVE_BACK_MATTER_RESOURCE', `Remove attachment "${resourceUuid}"`, (draft: any) => {
    const bm = ensureBackMatter(draft);
    if (!bm || !bm.resources) return;
    bm.resources = bm.resources.filter((r: any) => r.uuid !== resourceUuid);
  });
}

// ============================================================================
// 2. Result Set Actions
// ============================================================================

export function addResultSet(result?: Partial<Result>): DocumentAction {
  return createAction('assessment-results', 'ADD_RESULT_SET', `Add result set "${result?.title || 'New Result Set'}"`, (draft: any) => {
    const results = ensureResults(draft);
    const newResult: Result = {
      uuid: result?.uuid || generateUUID(),
      title: result?.title || 'New Result Set',
      description: result?.description || 'Assessment execution results',
      start: result?.start || new Date().toISOString(),
      ...(result?.end ? { end: result.end } : {}),
      'reviewed-controls': result?.['reviewed-controls'] || {
        'control-selections': [
          {
            'include-all': {}
          }
        ]
      },
      observations: result?.observations || [],
      findings: result?.findings || [],
      risks: result?.risks || [],
      ...result
    };
    results.push(newResult);
  });
}

export function updateResultSet(resultIndex: number, updates: Partial<Result>): DocumentAction {
  return createAction('assessment-results', 'UPDATE_RESULT_SET', `Update result set #${resultIndex + 1}`, (draft: any) => {
    const rs = getResultSet(draft, resultIndex);
    if (!rs) return;
    Object.assign(rs, updates);
  });
}

export function removeResultSet(resultIndex: number): DocumentAction {
  return createAction('assessment-results', 'REMOVE_RESULT_SET', `Remove result set #${resultIndex + 1}`, (draft: any) => {
    const results = ensureResults(draft);
    if (resultIndex >= 0 && resultIndex < results.length) {
      results.splice(resultIndex, 1);
    }
  });
}

export function setResultReviewedControlsDescription(resultIndex: number, description: string): DocumentAction {
  return createAction('assessment-results', 'SET_RESULT_REVIEWED_CONTROLS_DESC', `Set reviewed controls description for result set #${resultIndex + 1}`, (draft: any) => {
    const rs = getResultSet(draft, resultIndex);
    if (!rs) return;
    const rc = ensureReviewedControls(rs);
    rc.description = description;
  });
}

export function setResultControlSelections(resultIndex: number, selections: ControlSelection[]): DocumentAction {
  return createAction('assessment-results', 'SET_RESULT_CONTROL_SELECTIONS', `Set control selections for result set #${resultIndex + 1}`, (draft: any) => {
    const rs = getResultSet(draft, resultIndex);
    if (!rs) return;
    const rc = ensureReviewedControls(rs);
    rc['control-selections'] = selections;
  });
}

export function addResultControlSelection(resultIndex: number, selection?: Partial<ControlSelection>): DocumentAction {
  return createAction('assessment-results', 'ADD_RESULT_CONTROL_SELECTION', `Add control selection to result set #${resultIndex + 1}`, (draft: any) => {
    const rs = getResultSet(draft, resultIndex);
    if (!rs) return;
    const rc = ensureReviewedControls(rs);
    const newSel: ControlSelection = {
      'include-all': {},
      ...selection
    };
    rc['control-selections'].push(newSel);
  });
}

export function removeResultControlSelection(resultIndex: number, selectionIndex: number): DocumentAction {
  return createAction('assessment-results', 'REMOVE_RESULT_CONTROL_SELECTION', `Remove control selection #${selectionIndex + 1} from result set #${resultIndex + 1}`, (draft: any) => {
    const rs = getResultSet(draft, resultIndex);
    if (!rs) return;
    const rc = ensureReviewedControls(rs);
    if (selectionIndex >= 0 && selectionIndex < rc['control-selections'].length) {
      rc['control-selections'].splice(selectionIndex, 1);
    }
  });
}

export function toggleResultIncludeAllControls(resultIndex: number, selectionIndex: number = 0, includeAll?: boolean): DocumentAction {
  return createAction('assessment-results', 'TOGGLE_RESULT_INCLUDE_ALL_CONTROLS', `Toggle include-all for selection #${selectionIndex + 1} in result set #${resultIndex + 1}`, (draft: any) => {
    const rs = getResultSet(draft, resultIndex);
    if (!rs) return;
    const rc = ensureReviewedControls(rs);
    if (!rc['control-selections'][selectionIndex]) {
      rc['control-selections'][selectionIndex] = { 'include-all': {} };
    }
    const sel = rc['control-selections'][selectionIndex];
    const shouldInclude = includeAll !== undefined ? includeAll : !sel['include-all'];
    if (shouldInclude) {
      sel['include-all'] = {};
      delete sel['include-controls'];
    } else {
      delete sel['include-all'];
      if (!sel['include-controls']) {
        sel['include-controls'] = [];
      }
    }
  });
}

export function addResultIncludeControl(
  resultIndex: number,
  selectionIndex: number,
  controlId: string,
  statementIds?: string[]
): DocumentAction {
  return createAction('assessment-results', 'ADD_RESULT_INCLUDE_CONTROL', `Include control "${controlId}" in result set #${resultIndex + 1}`, (draft: any) => {
    const rs = getResultSet(draft, resultIndex);
    if (!rs) return;
    const rc = ensureReviewedControls(rs);
    if (!rc['control-selections'][selectionIndex]) {
      rc['control-selections'][selectionIndex] = {};
    }
    const sel = rc['control-selections'][selectionIndex];
    delete sel['include-all'];
    if (!sel['include-controls']) {
      sel['include-controls'] = [];
    }
    const existing = sel['include-controls'].find((c: any) => c['control-id'] === controlId);
    if (existing) {
      if (statementIds) {
        existing['statement-ids'] = statementIds;
      }
    } else {
      sel['include-controls'].push({
        'control-id': controlId,
        ...(statementIds && statementIds.length > 0 ? { 'statement-ids': statementIds } : {})
      });
    }
  });
}

export function removeResultIncludeControl(
  resultIndex: number,
  selectionIndex: number,
  controlId: string
): DocumentAction {
  return createAction('assessment-results', 'REMOVE_RESULT_INCLUDE_CONTROL', `Remove included control "${controlId}" from result set #${resultIndex + 1}`, (draft: any) => {
    const rs = getResultSet(draft, resultIndex);
    if (!rs) return;
    const rc = ensureReviewedControls(rs);
    const sel = rc['control-selections']?.[selectionIndex];
    if (!sel || !sel['include-controls']) return;
    sel['include-controls'] = sel['include-controls'].filter((c: any) => c['control-id'] !== controlId);
  });
}

export function addResultExcludeControl(
  resultIndex: number,
  selectionIndex: number,
  controlId: string,
  statementIds?: string[]
): DocumentAction {
  return createAction('assessment-results', 'ADD_RESULT_EXCLUDE_CONTROL', `Exclude control "${controlId}" from result set #${resultIndex + 1}`, (draft: any) => {
    const rs = getResultSet(draft, resultIndex);
    if (!rs) return;
    const rc = ensureReviewedControls(rs);
    if (!rc['control-selections'][selectionIndex]) {
      rc['control-selections'][selectionIndex] = {};
    }
    const sel = rc['control-selections'][selectionIndex];
    if (!sel['exclude-controls']) {
      sel['exclude-controls'] = [];
    }
    const existing = sel['exclude-controls'].find((c: any) => c['control-id'] === controlId);
    if (existing) {
      if (statementIds) {
        existing['statement-ids'] = statementIds;
      }
    } else {
      sel['exclude-controls'].push({
        'control-id': controlId,
        ...(statementIds && statementIds.length > 0 ? { 'statement-ids': statementIds } : {})
      });
    }
  });
}

export function removeResultExcludeControl(
  resultIndex: number,
  selectionIndex: number,
  controlId: string
): DocumentAction {
  return createAction('assessment-results', 'REMOVE_RESULT_EXCLUDE_CONTROL', `Remove excluded control "${controlId}" from result set #${resultIndex + 1}`, (draft: any) => {
    const rs = getResultSet(draft, resultIndex);
    if (!rs) return;
    const rc = ensureReviewedControls(rs);
    const sel = rc['control-selections']?.[selectionIndex];
    if (!sel || !sel['exclude-controls']) return;
    sel['exclude-controls'] = sel['exclude-controls'].filter((c: any) => c['control-id'] !== controlId);
  });
}

export function populateResultControlsFromAP(
  resultIndex: number,
  apControls: Array<{ controlId: string; statementIds?: string[] }>
): DocumentAction {
  return createAction('assessment-results', 'POPULATE_RESULT_CONTROLS_FROM_AP', `Populate controls from AP into result set #${resultIndex + 1}`, (draft: any) => {
    const rs = getResultSet(draft, resultIndex);
    if (!rs) return;
    const rc = ensureReviewedControls(rs);
    rc['control-selections'] = [
      {
        description: 'Evaluated baseline controls inherited from Assessment Plan',
        'include-controls': apControls.map(c => ({
          'control-id': c.controlId,
          ...(c.statementIds && c.statementIds.length > 0 ? { 'statement-ids': c.statementIds } : {})
        }))
      }
    ];
  });
}

// ============================================================================
// 3. Observation Actions
// ============================================================================

export function addObservation(resultIndex: number, observation?: Partial<Observation>): DocumentAction {
  return createAction('assessment-results', 'ADD_OBSERVATION', `Add observation to result set #${resultIndex + 1}`, (draft: any) => {
    const rs = getResultSet(draft, resultIndex);
    if (!rs) return;
    const observations = ensureObservations(rs);
    const newObs: Observation = {
      uuid: observation?.uuid || generateUUID(),
      title: observation?.title || '',
      description: observation?.description || '',
      methods: observation?.methods && observation.methods.length > 0 ? observation.methods : ['EXAMINE'],
      collected: observation?.collected || new Date().toISOString(),
      ...observation
    };
    observations.push(newObs);
  });
}

export function updateObservation(resultIndex: number, observationIndex: number, updates: Partial<Observation>): DocumentAction {
  return createAction('assessment-results', 'UPDATE_OBSERVATION', `Update observation #${observationIndex + 1} in result set #${resultIndex + 1}`, (draft: any) => {
    const rs = getResultSet(draft, resultIndex);
    if (!rs) return;
    const observations = ensureObservations(rs);
    if (observationIndex >= 0 && observationIndex < observations.length) {
      Object.assign(observations[observationIndex], updates);
    }
  });
}

export function removeObservation(resultIndex: number, observationIndex: number): DocumentAction {
  return createAction('assessment-results', 'REMOVE_OBSERVATION', `Remove observation #${observationIndex + 1} and cascade unlink from result set #${resultIndex + 1}`, (draft: any) => {
    const rs = getResultSet(draft, resultIndex);
    if (!rs) return;
    const observations = ensureObservations(rs);
    if (observationIndex < 0 || observationIndex >= observations.length) return;
    const removedUuid = observations[observationIndex].uuid;

    // 1. Remove the observation
    observations.splice(observationIndex, 1);

    // 2. Cascade unlink from findings in this result set
    if (rs.findings) {
      for (const finding of rs.findings) {
        if (finding['related-observations']) {
          finding['related-observations'] = finding['related-observations'].filter(
            ro => ro['observation-uuid'] !== removedUuid
          );
        }
      }
    }

    // 3. Cascade unlink from risks in this result set
    if (rs.risks) {
      for (const risk of rs.risks) {
        if (risk['related-observations']) {
          risk['related-observations'] = risk['related-observations'].filter(
            ro => ro['observation-uuid'] !== removedUuid
          );
        }
      }
    }
  });
}

export function toggleObservationMethod(
  resultIndex: number,
  observationIndex: number,
  method: 'EXAMINE' | 'INTERVIEW' | 'TEST' | 'UNKNOWN' | string
): DocumentAction {
  return createAction('assessment-results', 'TOGGLE_OBSERVATION_METHOD', `Toggle method "${method}" for observation #${observationIndex + 1}`, (draft: any) => {
    const rs = getResultSet(draft, resultIndex);
    if (!rs) return;
    const observations = ensureObservations(rs);
    const obs = observations[observationIndex];
    if (!obs) return;
    if (!obs.methods) obs.methods = ['EXAMINE'];

    const idx = obs.methods.indexOf(method);
    if (idx >= 0) {
      // Schema requires minItems: 1. If removing would make it empty, do not remove or keep 'UNKNOWN'
      if (obs.methods.length > 1) {
        obs.methods.splice(idx, 1);
      }
    } else {
      obs.methods.push(method);
    }
  });
}

export function setObservationMethods(resultIndex: number, observationIndex: number, methods: string[]): DocumentAction {
  return createAction('assessment-results', 'SET_OBSERVATION_METHODS', `Set methods for observation #${observationIndex + 1}`, (draft: any) => {
    const rs = getResultSet(draft, resultIndex);
    if (!rs) return;
    const observations = ensureObservations(rs);
    const obs = observations[observationIndex];
    if (!obs) return;
    obs.methods = methods && methods.length > 0 ? methods : ['EXAMINE'];
  });
}

export function setObservationTypes(resultIndex: number, observationIndex: number, types: string[]): DocumentAction {
  return createAction('assessment-results', 'SET_OBSERVATION_TYPES', `Set types for observation #${observationIndex + 1}`, (draft: any) => {
    const rs = getResultSet(draft, resultIndex);
    if (!rs) return;
    const observations = ensureObservations(rs);
    const obs = observations[observationIndex];
    if (!obs) return;
    obs.types = types;
  });
}

export function addObservationRelevantEvidence(
  resultIndex: number,
  observationIndex: number,
  evidence: { description: string; href?: string; remarks?: string }
): DocumentAction {
  return createAction('assessment-results', 'ADD_OBSERVATION_RELEVANT_EVIDENCE', `Add evidence to observation #${observationIndex + 1}`, (draft: any) => {
    const rs = getResultSet(draft, resultIndex);
    if (!rs) return;
    const observations = ensureObservations(rs);
    const obs = observations[observationIndex];
    if (!obs) return;
    if (!obs['relevant-evidence']) obs['relevant-evidence'] = [];
    obs['relevant-evidence'].push({
      description: evidence.description,
      ...(evidence.href ? { href: evidence.href } : {}),
      ...(evidence.remarks ? { remarks: evidence.remarks } : {})
    });
  });
}

export function removeObservationRelevantEvidence(
  resultIndex: number,
  observationIndex: number,
  evidenceIndex: number
): DocumentAction {
  return createAction('assessment-results', 'REMOVE_OBSERVATION_RELEVANT_EVIDENCE', `Remove evidence #${evidenceIndex + 1} from observation #${observationIndex + 1}`, (draft: any) => {
    const rs = getResultSet(draft, resultIndex);
    if (!rs) return;
    const observations = ensureObservations(rs);
    const obs = observations[observationIndex];
    if (!obs || !obs['relevant-evidence']) return;
    if (evidenceIndex >= 0 && evidenceIndex < obs['relevant-evidence'].length) {
      obs['relevant-evidence'].splice(evidenceIndex, 1);
    }
  });
}

export function addObservationSubject(resultIndex: number, observationIndex: number, subject: SubjectReference): DocumentAction {
  return createAction('assessment-results', 'ADD_OBSERVATION_SUBJECT', `Add subject to observation #${observationIndex + 1}`, (draft: any) => {
    const rs = getResultSet(draft, resultIndex);
    if (!rs) return;
    const observations = ensureObservations(rs);
    const obs = observations[observationIndex];
    if (!obs) return;
    if (!obs.subjects) obs.subjects = [];
    obs.subjects.push(subject);
  });
}

export function removeObservationSubject(resultIndex: number, observationIndex: number, subjectIndex: number): DocumentAction {
  return createAction('assessment-results', 'REMOVE_OBSERVATION_SUBJECT', `Remove subject #${subjectIndex + 1} from observation #${observationIndex + 1}`, (draft: any) => {
    const rs = getResultSet(draft, resultIndex);
    if (!rs) return;
    const observations = ensureObservations(rs);
    const obs = observations[observationIndex];
    if (!obs || !obs.subjects) return;
    if (subjectIndex >= 0 && subjectIndex < obs.subjects.length) {
      obs.subjects.splice(subjectIndex, 1);
    }
  });
}

// ============================================================================
// 4. Finding Actions
// ============================================================================

export function addFinding(resultIndex: number, finding?: Partial<Finding>): DocumentAction {
  return createAction('assessment-results', 'ADD_FINDING', `Add finding to result set #${resultIndex + 1}`, (draft: any) => {
    const rs = getResultSet(draft, resultIndex);
    if (!rs) return;
    const findings = ensureFindings(rs);
    const newFinding: Finding = {
      uuid: finding?.uuid || generateUUID(),
      title: finding?.title || 'New Finding',
      description: finding?.description || '',
      target: finding?.target || {
        type: 'statement-id',
        'target-id': '',
        status: {
          state: 'satisfied'
        }
      },
      ...finding
    };
    findings.push(newFinding);
  });
}

export function updateFinding(resultIndex: number, findingIndex: number, updates: Partial<Finding>): DocumentAction {
  return createAction('assessment-results', 'UPDATE_FINDING', `Update finding #${findingIndex + 1} in result set #${resultIndex + 1}`, (draft: any) => {
    const rs = getResultSet(draft, resultIndex);
    if (!rs) return;
    const findings = ensureFindings(rs);
    if (findingIndex >= 0 && findingIndex < findings.length) {
      Object.assign(findings[findingIndex], updates);
    }
  });
}

export function removeFinding(resultIndex: number, findingIndex: number): DocumentAction {
  return createAction('assessment-results', 'REMOVE_FINDING', `Remove finding #${findingIndex + 1} from result set #${resultIndex + 1}`, (draft: any) => {
    const rs = getResultSet(draft, resultIndex);
    if (!rs) return;
    const findings = ensureFindings(rs);
    if (findingIndex >= 0 && findingIndex < findings.length) {
      findings.splice(findingIndex, 1);
    }
  });
}

export function setFindingTarget(resultIndex: number, findingIndex: number, target: FindingTarget): DocumentAction {
  return createAction('assessment-results', 'SET_FINDING_TARGET', `Set target for finding #${findingIndex + 1}`, (draft: any) => {
    const rs = getResultSet(draft, resultIndex);
    if (!rs) return;
    const findings = ensureFindings(rs);
    const finding = findings[findingIndex];
    if (!finding) return;
    finding.target = target;
  });
}

export function updateFindingTarget(resultIndex: number, findingIndex: number, updates: Partial<FindingTarget>): DocumentAction {
  return createAction('assessment-results', 'UPDATE_FINDING_TARGET', `Update target for finding #${findingIndex + 1}`, (draft: any) => {
    const rs = getResultSet(draft, resultIndex);
    if (!rs) return;
    const findings = ensureFindings(rs);
    const finding = findings[findingIndex];
    if (!finding) return;
    if (!finding.target) {
      finding.target = {
        type: 'statement-id',
        'target-id': '',
        status: { state: 'satisfied' }
      };
    }
    Object.assign(finding.target, updates);
  });
}

export function linkFindingObservation(
  resultIndex: number,
  findingIndex: number,
  observationUuid: string,
  remarks?: string
): DocumentAction {
  return createAction('assessment-results', 'LINK_FINDING_OBSERVATION', `Link observation "${observationUuid}" to finding #${findingIndex + 1}`, (draft: any) => {
    const rs = getResultSet(draft, resultIndex);
    if (!rs) return;
    const findings = ensureFindings(rs);
    const finding = findings[findingIndex];
    if (!finding) return;
    if (!finding['related-observations']) finding['related-observations'] = [];
    const exists = finding['related-observations'].some(ro => ro['observation-uuid'] === observationUuid);
    if (!exists) {
      finding['related-observations'].push({
        'observation-uuid': observationUuid,
        ...(remarks ? { remarks } : {})
      });
    }
  });
}

export function unlinkFindingObservation(
  resultIndex: number,
  findingIndex: number,
  observationUuid: string
): DocumentAction {
  return createAction('assessment-results', 'UNLINK_FINDING_OBSERVATION', `Unlink observation "${observationUuid}" from finding #${findingIndex + 1}`, (draft: any) => {
    const rs = getResultSet(draft, resultIndex);
    if (!rs) return;
    const findings = ensureFindings(rs);
    const finding = findings[findingIndex];
    if (!finding || !finding['related-observations']) return;
    finding['related-observations'] = finding['related-observations'].filter(
      ro => ro['observation-uuid'] !== observationUuid
    );
  });
}

export function linkFindingRisk(
  resultIndex: number,
  findingIndex: number,
  riskUuid: string,
  remarks?: string
): DocumentAction {
  return createAction('assessment-results', 'LINK_FINDING_RISK', `Link risk "${riskUuid}" to finding #${findingIndex + 1}`, (draft: any) => {
    const rs = getResultSet(draft, resultIndex);
    if (!rs) return;
    const findings = ensureFindings(rs);
    const finding = findings[findingIndex];
    if (!finding) return;
    if (!finding['related-risks']) finding['related-risks'] = [];
    const exists = finding['related-risks'].some(rr => rr['risk-uuid'] === riskUuid);
    if (!exists) {
      finding['related-risks'].push({
        'risk-uuid': riskUuid,
        ...(remarks ? { remarks } : {})
      });
    }
  });
}

export function unlinkFindingRisk(
  resultIndex: number,
  findingIndex: number,
  riskUuid: string
): DocumentAction {
  return createAction('assessment-results', 'UNLINK_FINDING_RISK', `Unlink risk "${riskUuid}" from finding #${findingIndex + 1}`, (draft: any) => {
    const rs = getResultSet(draft, resultIndex);
    if (!rs) return;
    const findings = ensureFindings(rs);
    const finding = findings[findingIndex];
    if (!finding || !finding['related-risks']) return;
    finding['related-risks'] = finding['related-risks'].filter(
      rr => rr['risk-uuid'] !== riskUuid
    );
  });
}

// ============================================================================
// 5. Risk Actions
// ============================================================================

export function addRisk(resultIndex: number, risk?: Partial<Risk>): DocumentAction {
  return createAction('assessment-results', 'ADD_RISK', `Add risk to result set #${resultIndex + 1}`, (draft: any) => {
    const rs = getResultSet(draft, resultIndex);
    if (!rs) return;
    const risks = ensureRisks(rs);
    const newRisk: Risk = {
      uuid: risk?.uuid || generateUUID(),
      title: risk?.title || 'New Risk',
      description: risk?.description || '',
      statement: risk?.statement || 'Deficiency presents a potential security risk to system confidentiality, integrity, or availability.',
      status: risk?.status || 'open',
      ...risk
    };
    risks.push(newRisk);
  });
}

export function updateRisk(resultIndex: number, riskIndex: number, updates: Partial<Risk>): DocumentAction {
  return createAction('assessment-results', 'UPDATE_RISK', `Update risk #${riskIndex + 1} in result set #${resultIndex + 1}`, (draft: any) => {
    const rs = getResultSet(draft, resultIndex);
    if (!rs) return;
    const risks = ensureRisks(rs);
    if (riskIndex >= 0 && riskIndex < risks.length) {
      Object.assign(risks[riskIndex], updates);
    }
  });
}

export function removeRisk(resultIndex: number, riskIndex: number): DocumentAction {
  return createAction('assessment-results', 'REMOVE_RISK', `Remove risk #${riskIndex + 1} and cascade unlink from result set #${resultIndex + 1}`, (draft: any) => {
    const rs = getResultSet(draft, resultIndex);
    if (!rs) return;
    const risks = ensureRisks(rs);
    if (riskIndex < 0 || riskIndex >= risks.length) return;
    const removedUuid = risks[riskIndex].uuid;

    // 1. Remove risk
    risks.splice(riskIndex, 1);

    // 2. Cascade unlink from findings in this result set
    if (rs.findings) {
      for (const finding of rs.findings) {
        if (finding['related-risks']) {
          finding['related-risks'] = finding['related-risks'].filter(
            rr => rr['risk-uuid'] !== removedUuid
          );
        }
      }
    }
  });
}

export function setRiskStatus(
  resultIndex: number,
  riskIndex: number,
  status: string,
  userPartyUuid?: string,
  userRoleId?: string,
  remarks?: string
): DocumentAction {
  return createAction('assessment-results', 'SET_RISK_STATUS', `Set status "${status}" for risk #${riskIndex + 1} with automated audit log`, (draft: any) => {
    const rs = getResultSet(draft, resultIndex);
    if (!rs) return;
    const risks = ensureRisks(rs);
    const risk = risks[riskIndex];
    if (!risk) return;

    risk.status = status;

    // Automated Risk Log generation per DD-038 Decision 4.B
    if (!risk['risk-log']) {
      risk['risk-log'] = { entries: [] };
    }
    if (!risk['risk-log'].entries) {
      risk['risk-log'].entries = [];
    }

    const logEntry: RiskLogEntry = {
      uuid: generateUUID(),
      start: new Date().toISOString(),
      title: `Status updated to ${status}`,
      description: remarks || `Risk status changed to ${status}`,
      'status-change': status,
      ...(userPartyUuid
        ? {
            'logged-by': [
              {
                'party-uuid': userPartyUuid,
                ...(userRoleId ? { 'role-id': userRoleId } : {})
              }
            ]
          }
        : {})
    };
    risk['risk-log'].entries.push(logEntry);
  });
}

export function setRiskStatement(resultIndex: number, riskIndex: number, statement: string): DocumentAction {
  return createAction('assessment-results', 'SET_RISK_STATEMENT', `Set statement for risk #${riskIndex + 1}`, (draft: any) => {
    const rs = getResultSet(draft, resultIndex);
    if (!rs) return;
    const risks = ensureRisks(rs);
    const risk = risks[riskIndex];
    if (!risk) return;
    risk.statement = statement;
  });
}

export function addRiskCharacterizationFacet(
  resultIndex: number,
  riskIndex: number,
  facet: RiskFacet,
  charIndex: number = 0
): DocumentAction {
  return createAction('assessment-results', 'ADD_RISK_FACET', `Add characterization facet "${facet.name}" to risk #${riskIndex + 1}`, (draft: any) => {
    const rs = getResultSet(draft, resultIndex);
    if (!rs) return;
    const risks = ensureRisks(rs);
    const risk = risks[riskIndex];
    if (!risk) return;

    if (!risk.characterizations) {
      risk.characterizations = [];
    }
    if (!risk.characterizations[charIndex]) {
      const defaultChar: RiskCharacterization = {
        date: new Date().toISOString(),
        facets: []
      };
      risk.characterizations[charIndex] = defaultChar;
    }
    const char = risk.characterizations[charIndex];
    if (!char.facets) char.facets = [];

    const existingIdx = char.facets.findIndex(f => f.name === facet.name && f.system === facet.system);
    if (existingIdx >= 0) {
      char.facets[existingIdx] = { ...char.facets[existingIdx], ...facet };
    } else {
      char.facets.push(facet);
    }
  });
}

export function removeRiskCharacterizationFacet(
  resultIndex: number,
  riskIndex: number,
  facetIndex: number,
  charIndex: number = 0
): DocumentAction {
  return createAction('assessment-results', 'REMOVE_RISK_FACET', `Remove characterization facet #${facetIndex + 1} from risk #${riskIndex + 1}`, (draft: any) => {
    const rs = getResultSet(draft, resultIndex);
    if (!rs) return;
    const risks = ensureRisks(rs);
    const risk = risks[riskIndex];
    if (!risk || !risk.characterizations) return;
    const char = risk.characterizations[charIndex];
    if (!char || !char.facets) return;
    if (facetIndex >= 0 && facetIndex < char.facets.length) {
      char.facets.splice(facetIndex, 1);
    }
  });
}

export function addRiskThreatID(resultIndex: number, riskIndex: number, threat: RiskThreatID): DocumentAction {
  return createAction('assessment-results', 'ADD_RISK_THREAT_ID', `Add threat ID "${threat.id}" to risk #${riskIndex + 1}`, (draft: any) => {
    const rs = getResultSet(draft, resultIndex);
    if (!rs) return;
    const risks = ensureRisks(rs);
    const risk = risks[riskIndex];
    if (!risk) return;
    if (!risk['threat-ids']) risk['threat-ids'] = [];
    const exists = risk['threat-ids'].some(t => t.id === threat.id && t.system === threat.system);
    if (!exists) {
      risk['threat-ids'].push(threat);
    }
  });
}

export function removeRiskThreatID(resultIndex: number, riskIndex: number, threatIndex: number): DocumentAction {
  return createAction('assessment-results', 'REMOVE_RISK_THREAT_ID', `Remove threat ID #${threatIndex + 1} from risk #${riskIndex + 1}`, (draft: any) => {
    const rs = getResultSet(draft, resultIndex);
    if (!rs) return;
    const risks = ensureRisks(rs);
    const risk = risks[riskIndex];
    if (!risk || !risk['threat-ids']) return;
    if (threatIndex >= 0 && threatIndex < risk['threat-ids'].length) {
      risk['threat-ids'].splice(threatIndex, 1);
    }
  });
}

export function addRiskMitigatingFactor(
  resultIndex: number,
  riskIndex: number,
  factor: Partial<RiskMitigatingFactor>
): DocumentAction {
  return createAction('assessment-results', 'ADD_RISK_MITIGATING_FACTOR', `Add mitigating factor to risk #${riskIndex + 1}`, (draft: any) => {
    const rs = getResultSet(draft, resultIndex);
    if (!rs) return;
    const risks = ensureRisks(rs);
    const risk = risks[riskIndex];
    if (!risk) return;
    if (!risk['mitigating-factors']) risk['mitigating-factors'] = [];
    const newFactor: RiskMitigatingFactor = {
      uuid: factor.uuid || generateUUID(),
      description: factor.description || '',
      ...factor
    };
    risk['mitigating-factors'].push(newFactor);
  });
}

export function removeRiskMitigatingFactor(resultIndex: number, riskIndex: number, factorIndex: number): DocumentAction {
  return createAction('assessment-results', 'REMOVE_RISK_MITIGATING_FACTOR', `Remove mitigating factor #${factorIndex + 1} from risk #${riskIndex + 1}`, (draft: any) => {
    const rs = getResultSet(draft, resultIndex);
    if (!rs) return;
    const risks = ensureRisks(rs);
    const risk = risks[riskIndex];
    if (!risk || !risk['mitigating-factors']) return;
    if (factorIndex >= 0 && factorIndex < risk['mitigating-factors'].length) {
      risk['mitigating-factors'].splice(factorIndex, 1);
    }
  });
}

export function addRiskRemediation(resultIndex: number, riskIndex: number, remediation?: Partial<RiskResponse>): DocumentAction {
  return createAction('assessment-results', 'ADD_RISK_REMEDIATION', `Add remediation response to risk #${riskIndex + 1}`, (draft: any) => {
    const rs = getResultSet(draft, resultIndex);
    if (!rs) return;
    const risks = ensureRisks(rs);
    const risk = risks[riskIndex];
    if (!risk) return;
    if (!risk.remediations) risk.remediations = [];
    const newRem: RiskResponse = {
      uuid: remediation?.uuid || generateUUID(),
      lifecycle: remediation?.lifecycle || 'planned',
      title: remediation?.title || 'Remediation Response',
      description: remediation?.description || '',
      ...remediation
    };
    risk.remediations.push(newRem);
  });
}

export function updateRiskRemediation(
  resultIndex: number,
  riskIndex: number,
  remediationIndex: number,
  updates: Partial<RiskResponse>
): DocumentAction {
  return createAction('assessment-results', 'UPDATE_RISK_REMEDIATION', `Update remediation #${remediationIndex + 1} in risk #${riskIndex + 1}`, (draft: any) => {
    const rs = getResultSet(draft, resultIndex);
    if (!rs) return;
    const risks = ensureRisks(rs);
    const risk = risks[riskIndex];
    if (!risk || !risk.remediations) return;
    if (remediationIndex >= 0 && remediationIndex < risk.remediations.length) {
      Object.assign(risk.remediations[remediationIndex], updates);
    }
  });
}

export function removeRiskRemediation(resultIndex: number, riskIndex: number, remediationIndex: number): DocumentAction {
  return createAction('assessment-results', 'REMOVE_RISK_REMEDIATION', `Remove remediation #${remediationIndex + 1} from risk #${riskIndex + 1}`, (draft: any) => {
    const rs = getResultSet(draft, resultIndex);
    if (!rs) return;
    const risks = ensureRisks(rs);
    const risk = risks[riskIndex];
    if (!risk || !risk.remediations) return;
    if (remediationIndex >= 0 && remediationIndex < risk.remediations.length) {
      risk.remediations.splice(remediationIndex, 1);
    }
  });
}

export function addRiskRemediationAsset(
  resultIndex: number,
  riskIndex: number,
  remediationIndex: number,
  asset: { uuid?: string; description: string }
): DocumentAction {
  return createAction('assessment-results', 'ADD_RISK_REMEDIATION_ASSET', `Add required asset to remediation #${remediationIndex + 1}`, (draft: any) => {
    const rs = getResultSet(draft, resultIndex);
    if (!rs) return;
    const risks = ensureRisks(rs);
    const risk = risks[riskIndex];
    if (!risk || !risk.remediations) return;
    const rem = risk.remediations[remediationIndex];
    if (!rem) return;
    if (!rem['required-assets']) rem['required-assets'] = [];
    rem['required-assets'].push({
      uuid: asset.uuid || generateUUID(),
      description: asset.description
    });
  });
}

export function addRiskRemediationTask(
  resultIndex: number,
  riskIndex: number,
  remediationIndex: number,
  task: Partial<Task>
): DocumentAction {
  return createAction('assessment-results', 'ADD_RISK_REMEDIATION_TASK', `Add task to remediation #${remediationIndex + 1}`, (draft: any) => {
    const rs = getResultSet(draft, resultIndex);
    if (!rs) return;
    const risks = ensureRisks(rs);
    const risk = risks[riskIndex];
    if (!risk || !risk.remediations) return;
    const rem = risk.remediations[remediationIndex];
    if (!rem) return;
    if (!rem.tasks) rem.tasks = [];
    const newTask: Task = {
      uuid: task.uuid || generateUUID(),
      type: task.type || 'action',
      title: task.title || 'Remediation Action Task',
      description: task.description || '',
      ...task
    };
    rem.tasks.push(newTask);
  });
}

export function addRiskLogEntry(resultIndex: number, riskIndex: number, entry: Partial<RiskLogEntry>): DocumentAction {
  return createAction('assessment-results', 'ADD_RISK_LOG_ENTRY', `Add log entry to risk #${riskIndex + 1}`, (draft: any) => {
    const rs = getResultSet(draft, resultIndex);
    if (!rs) return;
    const risks = ensureRisks(rs);
    const risk = risks[riskIndex];
    if (!risk) return;
    if (!risk['risk-log']) risk['risk-log'] = { entries: [] };
    if (!risk['risk-log'].entries) risk['risk-log'].entries = [];
    const newEntry: RiskLogEntry = {
      uuid: entry.uuid || generateUUID(),
      start: entry.start || new Date().toISOString(),
      title: entry.title || 'Risk log event',
      description: entry.description || '',
      ...entry
    };
    risk['risk-log'].entries.push(newEntry);
  });
}

export function removeRiskLogEntry(resultIndex: number, riskIndex: number, entryIndex: number): DocumentAction {
  return createAction('assessment-results', 'REMOVE_RISK_LOG_ENTRY', `Remove log entry #${entryIndex + 1} from risk #${riskIndex + 1}`, (draft: any) => {
    const rs = getResultSet(draft, resultIndex);
    if (!rs) return;
    const risks = ensureRisks(rs);
    const risk = risks[riskIndex];
    if (!risk || !risk['risk-log'] || !risk['risk-log'].entries) return;
    if (entryIndex >= 0 && entryIndex < risk['risk-log'].entries.length) {
      risk['risk-log'].entries.splice(entryIndex, 1);
    }
  });
}

// ============================================================================
// 6. Assessment Log & Attestation Actions
// ============================================================================

export function addAssessmentLogEntry(resultIndex: number, entry?: Partial<AssessmentLogEntry>): DocumentAction {
  return createAction('assessment-results', 'ADD_ASSESSMENT_LOG_ENTRY', `Add assessment log entry to result set #${resultIndex + 1}`, (draft: any) => {
    const rs = getResultSet(draft, resultIndex);
    if (!rs) return;
    const log = ensureAssessmentLog(rs);
    const newEntry: AssessmentLogEntry = {
      uuid: entry?.uuid || generateUUID(),
      start: entry?.start || new Date().toISOString(),
      title: entry?.title || 'Assessment Activity Log',
      description: entry?.description || '',
      ...entry
    };
    log.entries.push(newEntry);
  });
}

export function updateAssessmentLogEntry(
  resultIndex: number,
  entryIndex: number,
  updates: Partial<AssessmentLogEntry>
): DocumentAction {
  return createAction('assessment-results', 'UPDATE_ASSESSMENT_LOG_ENTRY', `Update assessment log entry #${entryIndex + 1} in result set #${resultIndex + 1}`, (draft: any) => {
    const rs = getResultSet(draft, resultIndex);
    if (!rs) return;
    const log = ensureAssessmentLog(rs);
    if (entryIndex >= 0 && entryIndex < log.entries.length) {
      Object.assign(log.entries[entryIndex], updates);
    }
  });
}

export function removeAssessmentLogEntry(resultIndex: number, entryIndex: number): DocumentAction {
  return createAction('assessment-results', 'REMOVE_ASSESSMENT_LOG_ENTRY', `Remove assessment log entry #${entryIndex + 1} from result set #${resultIndex + 1}`, (draft: any) => {
    const rs = getResultSet(draft, resultIndex);
    if (!rs) return;
    const log = ensureAssessmentLog(rs);
    if (entryIndex >= 0 && entryIndex < log.entries.length) {
      log.entries.splice(entryIndex, 1);
    }
  });
}

export function addAttestation(resultIndex: number, attestation?: Partial<Attestation>): DocumentAction {
  return createAction('assessment-results', 'ADD_ATTESTATION', `Add attestation to result set #${resultIndex + 1}`, (draft: any) => {
    const rs = getResultSet(draft, resultIndex);
    if (!rs) return;
    const attestations = ensureAttestations(rs);
    const newAttestation: Attestation = {
      parts: attestation?.parts || [
        {
          uuid: generateUUID(),
          name: 'assessment-statement',
          title: 'Attestation of Assessment Results',
          prose: 'The lead assessor confirms that the findings, observations, and risks recorded herein accurately reflect the evaluated posture.'
        }
      ],
      ...attestation
    };
    attestations.push(newAttestation);
  });
}

export function updateAttestation(
  resultIndex: number,
  attestationIndex: number,
  updates: Partial<Attestation>
): DocumentAction {
  return createAction('assessment-results', 'UPDATE_ATTESTATION', `Update attestation #${attestationIndex + 1} in result set #${resultIndex + 1}`, (draft: any) => {
    const rs = getResultSet(draft, resultIndex);
    if (!rs) return;
    const attestations = ensureAttestations(rs);
    if (attestationIndex >= 0 && attestationIndex < attestations.length) {
      Object.assign(attestations[attestationIndex], updates);
    }
  });
}

export function removeAttestation(resultIndex: number, attestationIndex: number): DocumentAction {
  return createAction('assessment-results', 'REMOVE_ATTESTATION', `Remove attestation #${attestationIndex + 1} from result set #${resultIndex + 1}`, (draft: any) => {
    const rs = getResultSet(draft, resultIndex);
    if (!rs) return;
    const attestations = ensureAttestations(rs);
    if (attestationIndex >= 0 && attestationIndex < attestations.length) {
      attestations.splice(attestationIndex, 1);
    }
  });
}

export function addAttestationPart(resultIndex: number, attestationIndex: number, part: AssessmentPart): DocumentAction {
  return createAction('assessment-results', 'ADD_ATTESTATION_PART', `Add statement part to attestation #${attestationIndex + 1}`, (draft: any) => {
    const rs = getResultSet(draft, resultIndex);
    if (!rs) return;
    const attestations = ensureAttestations(rs);
    const attestation = attestations[attestationIndex];
    if (!attestation) return;
    if (!attestation.parts) attestation.parts = [];
    attestation.parts.push(part);
  });
}

export function removeAttestationPart(resultIndex: number, attestationIndex: number, partIndex: number): DocumentAction {
  return createAction('assessment-results', 'REMOVE_ATTESTATION_PART', `Remove statement part #${partIndex + 1} from attestation #${attestationIndex + 1}`, (draft: any) => {
    const rs = getResultSet(draft, resultIndex);
    if (!rs) return;
    const attestations = ensureAttestations(rs);
    const attestation = attestations[attestationIndex];
    if (!attestation || !attestation.parts) return;
    if (partIndex >= 0 && partIndex < attestation.parts.length) {
      attestation.parts.splice(partIndex, 1);
    }
  });
}

// ============================================================================
// 7. Local Definitions Actions (Two-Tier Separation)
// ============================================================================

// --- Root Level Local Definitions (Objectives & Activities) ---

export function addRootLocalObjective(objective: Partial<LocalObjective>): DocumentAction {
  return createAction('assessment-results', 'ADD_ROOT_LOCAL_OBJECTIVE', `Add root local objective for "${objective['control-id'] || 'control'}"`, (draft: any) => {
    const defs = ensureRootLocalDefinitions(draft);
    if (!defs) return;
    if (!defs['objectives-and-methods']) defs['objectives-and-methods'] = [];
    const controlId = objective['control-id'] || 'default-obj';
    const fullObj: LocalObjective = {
      'control-id': controlId,
      parts: objective.parts || [],
      ...objective
    };
    const idx = defs['objectives-and-methods'].findIndex((o: any) => o['control-id'] === controlId);
    if (idx >= 0) {
      defs['objectives-and-methods'][idx] = { ...defs['objectives-and-methods'][idx], ...fullObj };
    } else {
      defs['objectives-and-methods'].push(fullObj);
    }
  });
}

export function removeRootLocalObjective(objectiveControlId: string): DocumentAction {
  return createAction('assessment-results', 'REMOVE_ROOT_LOCAL_OBJECTIVE', `Remove root local objective "${objectiveControlId}"`, (draft: any) => {
    const defs = ensureRootLocalDefinitions(draft);
    if (!defs || !defs['objectives-and-methods']) return;
    defs['objectives-and-methods'] = defs['objectives-and-methods'].filter(
      (o: any) => o['control-id'] !== objectiveControlId
    );
  });
}

export function addRootLocalActivity(activity: Partial<LocalActivity>): DocumentAction {
  return createAction('assessment-results', 'ADD_ROOT_LOCAL_ACTIVITY', `Add root local activity "${activity.title || activity.uuid || 'new'}"`, (draft: any) => {
    const defs = ensureRootLocalDefinitions(draft);
    if (!defs) return;
    if (!defs.activities) defs.activities = [];
    const actUuid = activity.uuid || generateUUID();
    const fullAct: LocalActivity = {
      uuid: actUuid,
      title: activity.title || 'Assessment Activity',
      description: activity.description || '',
      ...activity
    };
    const idx = defs.activities.findIndex((a: any) => a.uuid === actUuid);
    if (idx >= 0) {
      defs.activities[idx] = { ...defs.activities[idx], ...fullAct };
    } else {
      defs.activities.push(fullAct);
    }
  });
}

export function removeRootLocalActivity(activityUuid: string): DocumentAction {
  return createAction('assessment-results', 'REMOVE_ROOT_LOCAL_ACTIVITY', `Remove root local activity "${activityUuid}"`, (draft: any) => {
    const defs = ensureRootLocalDefinitions(draft);
    if (!defs || !defs.activities) return;
    defs.activities = defs.activities.filter((a: any) => a.uuid !== activityUuid);
  });
}

// --- Result Level Local Definitions (Components, Users, Tasks) ---

export function addResultLocalComponent(resultIndex: number, component: Partial<SystemComponent>): DocumentAction {
  return createAction('assessment-results', 'ADD_RESULT_LOCAL_COMPONENT', `Add local component to result set #${resultIndex + 1}`, (draft: any) => {
    const rs = getResultSet(draft, resultIndex);
    if (!rs) return;
    const defs = ensureResultLocalDefinitions(rs);
    if (!defs.components) defs.components = [];
    const compUuid = component.uuid || generateUUID();
    const fullComp: SystemComponent = {
      uuid: compUuid,
      type: component.type || 'software',
      title: component.title || 'Local Component',
      description: component.description || '',
      status: component.status || { state: 'operational' },
      ...component
    };
    const idx = defs.components.findIndex((c: any) => c.uuid === compUuid);
    if (idx >= 0) {
      defs.components[idx] = { ...defs.components[idx], ...fullComp };
    } else {
      defs.components.push(fullComp);
    }
  });
}

export function updateResultLocalComponent(
  resultIndex: number,
  componentUuid: string,
  updates: Partial<SystemComponent>
): DocumentAction {
  return createAction('assessment-results', 'UPDATE_RESULT_LOCAL_COMPONENT', `Update local component "${componentUuid}" in result set #${resultIndex + 1}`, (draft: any) => {
    const rs = getResultSet(draft, resultIndex);
    if (!rs) return;
    const defs = ensureResultLocalDefinitions(rs);
    if (!defs.components) return;
    const idx = defs.components.findIndex((c: any) => c.uuid === componentUuid);
    if (idx >= 0) {
      defs.components[idx] = { ...defs.components[idx], ...updates };
    }
  });
}

export function removeResultLocalComponent(resultIndex: number, componentUuid: string): DocumentAction {
  return createAction('assessment-results', 'REMOVE_RESULT_LOCAL_COMPONENT', `Remove local component "${componentUuid}" from result set #${resultIndex + 1}`, (draft: any) => {
    const rs = getResultSet(draft, resultIndex);
    if (!rs) return;
    const defs = ensureResultLocalDefinitions(rs);
    if (!defs.components) return;
    defs.components = defs.components.filter((c: any) => c.uuid !== componentUuid);
  });
}

export function addResultLocalUser(resultIndex: number, user: Partial<SystemUser>): DocumentAction {
  return createAction('assessment-results', 'ADD_RESULT_LOCAL_USER', `Add local user to result set #${resultIndex + 1}`, (draft: any) => {
    const rs = getResultSet(draft, resultIndex);
    if (!rs) return;
    const defs = ensureResultLocalDefinitions(rs);
    if (!defs.users) defs.users = [];
    const userUuid = user.uuid || generateUUID();
    const fullUser: SystemUser = {
      uuid: userUuid,
      title: user.title || 'Assessment Assessor User',
      ...user
    };
    const idx = defs.users.findIndex((u: any) => u.uuid === userUuid);
    if (idx >= 0) {
      defs.users[idx] = { ...defs.users[idx], ...fullUser };
    } else {
      defs.users.push(fullUser);
    }
  });
}

export function updateResultLocalUser(
  resultIndex: number,
  userUuid: string,
  updates: Partial<SystemUser>
): DocumentAction {
  return createAction('assessment-results', 'UPDATE_RESULT_LOCAL_USER', `Update local user "${userUuid}" in result set #${resultIndex + 1}`, (draft: any) => {
    const rs = getResultSet(draft, resultIndex);
    if (!rs) return;
    const defs = ensureResultLocalDefinitions(rs);
    if (!defs.users) return;
    const idx = defs.users.findIndex((u: any) => u.uuid === userUuid);
    if (idx >= 0) {
      defs.users[idx] = { ...defs.users[idx], ...updates };
    }
  });
}

export function removeResultLocalUser(resultIndex: number, userUuid: string): DocumentAction {
  return createAction('assessment-results', 'REMOVE_RESULT_LOCAL_USER', `Remove local user "${userUuid}" from result set #${resultIndex + 1}`, (draft: any) => {
    const rs = getResultSet(draft, resultIndex);
    if (!rs) return;
    const defs = ensureResultLocalDefinitions(rs);
    if (!defs.users) return;
    defs.users = defs.users.filter((u: any) => u.uuid !== userUuid);
  });
}

export function addResultLocalTask(resultIndex: number, task: Partial<Task>): DocumentAction {
  return createAction('assessment-results', 'ADD_RESULT_LOCAL_TASK', `Add local task to result set #${resultIndex + 1}`, (draft: any) => {
    const rs = getResultSet(draft, resultIndex);
    if (!rs) return;
    const defs = ensureResultLocalDefinitions(rs);
    if (!defs.tasks) defs.tasks = [];
    const taskUuid = task.uuid || generateUUID();
    const fullTask: Task = {
      uuid: taskUuid,
      type: task.type || 'action',
      title: task.title || 'Assessment Task',
      description: task.description || '',
      ...task
    };
    const idx = defs.tasks.findIndex((t: any) => t.uuid === taskUuid);
    if (idx >= 0) {
      defs.tasks[idx] = { ...defs.tasks[idx], ...fullTask };
    } else {
      defs.tasks.push(fullTask);
    }
  });
}

export function updateResultLocalTask(
  resultIndex: number,
  taskUuid: string,
  updates: Partial<Task>
): DocumentAction {
  return createAction('assessment-results', 'UPDATE_RESULT_LOCAL_TASK', `Update local task "${taskUuid}" in result set #${resultIndex + 1}`, (draft: any) => {
    const rs = getResultSet(draft, resultIndex);
    if (!rs) return;
    const defs = ensureResultLocalDefinitions(rs);
    if (!defs.tasks) return;
    const idx = defs.tasks.findIndex((t: any) => t.uuid === taskUuid);
    if (idx >= 0) {
      defs.tasks[idx] = { ...defs.tasks[idx], ...updates };
    }
  });
}

export function removeResultLocalTask(resultIndex: number, taskUuid: string): DocumentAction {
  return createAction('assessment-results', 'REMOVE_RESULT_LOCAL_TASK', `Remove local task "${taskUuid}" from result set #${resultIndex + 1}`, (draft: any) => {
    const rs = getResultSet(draft, resultIndex);
    if (!rs) return;
    const defs = ensureResultLocalDefinitions(rs);
    if (!defs.tasks) return;
    defs.tasks = defs.tasks.filter((t: any) => t.uuid !== taskUuid);
  });
}

// ============================================================================
// 8. Pre-Serialization Empty Array Purging (DD-014 / DD-038)
// ============================================================================

const PRESERVE_EMPTY_ARRAYS = new Set<string>([]);

export function cleanAREmptyArrays(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    return obj
      .map(cleanAREmptyArrays)
      .filter((item: unknown) => item !== undefined);
  } else if (obj !== null && typeof obj === 'object') {
    const cleaned: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj)) {
      if (Array.isArray(val) && val.length === 0 && !PRESERVE_EMPTY_ARRAYS.has(key)) {
        continue;
      }
      cleaned[key] = cleanAREmptyArrays(val);
    }
    return cleaned;
  }
  return obj;
}

export function purgeAREmptyArrays(draft: any): void {
  function purgeInPlace(obj: any): void {
    if (obj && typeof obj === 'object') {
      if (Array.isArray(obj)) {
        for (let i = 0; i < obj.length; i++) {
          purgeInPlace(obj[i]);
        }
      } else {
        for (const [key, val] of Object.entries(obj)) {
          if (Array.isArray(val)) {
            if (val.length === 0 && !PRESERVE_EMPTY_ARRAYS.has(key)) {
              delete obj[key];
            } else {
              for (const item of val) {
                purgeInPlace(item);
              }
            }
          } else if (val && typeof val === 'object') {
            purgeInPlace(val);
          }
        }
      }
    }
  }

  const ar = getAR(draft);
  if (ar) {
    purgeInPlace(ar);
  }
}

// ============================================================================
// 9. Whole Document Replacement & Pure Reducer
// ============================================================================

export function replaceAssessmentResults(newAR: any): DocumentAction {
  return createAction('assessment-results', 'REPLACE_AR', 'Replace entire Assessment Results document', (draft: any) => {
    if (draft['assessment-results']) {
      draft['assessment-results'] = newAR;
    } else {
      Object.assign(draft, newAR);
    }
  });
}

/**
 * Pure Immer-based reducer function for Assessment Results documents.
 * Dispatches the given action against the document draft, returning a new immutable AssessmentResults.
 */
export function assessmentResultsReducer(
  doc: AssessmentResults | { 'assessment-results': AssessmentResults },
  action: DocumentAction
): any {
  return produce(doc, (draft: any) => {
    action.apply(draft);
  });
}
