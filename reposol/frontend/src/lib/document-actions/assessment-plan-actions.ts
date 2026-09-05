import { createAction, DocumentAction } from './types';
import {
  AssessmentPlan,
  Metadata,
  ImportSSP,
  ReviewedControls,
  ControlSelection,
  SelectControlById,
  ControlObjectiveSelection,
  SelectObjectiveById,
  AssessmentSubject,
  SelectSubjectById,
  AssessmentSubjectType,
  AssessmentSubjectPlaceholder,
  AssessmentAssets,
  AssessmentPlatform,
  UsesComponent,
  LocalDefinitions,
  LocalObjective,
  LocalActivity,
  ActivityStep,
  AssessmentPart,
  TermsAndConditions,
  TermsPart,
  TermsPartNameEnum,
  Task,
  TaskTiming,
  TaskDependency,
  AssociatedActivity,
  SystemComponent,
  SystemUser,
  InventoryItem,
  Resource,
  Property,
  Link,
  ResponsibleRole,
  ResponsibleParty
} from '../types/oscal';
import { generateUUID } from '../oscal-utils';
import { produce } from 'immer';

// ============================================================================
// Internal Traversal & Ensure Helpers
// ============================================================================

function getAP(draft: any): AssessmentPlan | null {
  if (!draft) return null;
  return draft['assessment-plan'] || draft;
}

function ensureMetadata(draft: any): Metadata | null {
  const ap = getAP(draft);
  if (!ap) return null;
  if (!ap.metadata) {
    ap.metadata = {
      title: 'New Security Assessment Plan',
      version: '1.0.0',
      'oscal-version': '1.2.2'
    };
  }
  return ap.metadata;
}

function ensureImportSSP(draft: any): ImportSSP | null {
  const ap = getAP(draft);
  if (!ap) return null;
  if (!ap['import-ssp']) {
    ap['import-ssp'] = {
      href: ''
    };
  }
  return ap['import-ssp'];
}

function ensureReviewedControls(draft: any): ReviewedControls | null {
  const ap = getAP(draft);
  if (!ap) return null;
  if (!ap['reviewed-controls']) {
    ap['reviewed-controls'] = {
      'control-selections': [
        {
          'include-all': {}
        }
      ]
    };
  }
  if (!ap['reviewed-controls']['control-selections']) {
    ap['reviewed-controls']['control-selections'] = [];
  }
  return ap['reviewed-controls'];
}

function ensureAssessmentSubjects(draft: any): AssessmentSubject[] | null {
  const ap = getAP(draft);
  if (!ap) return null;
  if (!ap['assessment-subjects']) {
    ap['assessment-subjects'] = [];
  }
  return ap['assessment-subjects'];
}

function ensureAssessmentAssets(draft: any): AssessmentAssets | null {
  const ap = getAP(draft);
  if (!ap) return null;
  if (!ap['assessment-assets']) {
    ap['assessment-assets'] = {
      'assessment-platforms': []
    };
  }
  if (!ap['assessment-assets']['assessment-platforms']) {
    ap['assessment-assets']['assessment-platforms'] = [];
  }
  return ap['assessment-assets'];
}

function ensureLocalDefinitions(draft: any): LocalDefinitions | null {
  const ap = getAP(draft);
  if (!ap) return null;
  if (!ap['local-definitions']) {
    ap['local-definitions'] = {};
  }
  return ap['local-definitions'];
}

function ensureTermsAndConditions(draft: any): TermsAndConditions | null {
  const ap = getAP(draft);
  if (!ap) return null;
  if (!ap['terms-and-conditions']) {
    ap['terms-and-conditions'] = {
      parts: []
    };
  }
  if (!ap['terms-and-conditions'].parts) {
    ap['terms-and-conditions'].parts = [];
  }
  return ap['terms-and-conditions'];
}

function ensureTasks(draft: any): Task[] | null {
  const ap = getAP(draft);
  if (!ap) return null;
  if (!ap.tasks) {
    ap.tasks = [];
  }
  return ap.tasks;
}

function ensureBackMatter(draft: any): { resources?: Resource[] } | null {
  const ap = getAP(draft);
  if (!ap) return null;
  if (!ap['back-matter']) {
    ap['back-matter'] = {
      resources: []
    };
  }
  if (!ap['back-matter'].resources) {
    ap['back-matter'].resources = [];
  }
  return ap['back-matter'];
}

// ============================================================================
// DAG Cycle Detection Helper
// ============================================================================

export function hasTaskCycle(tasks: Task[], fromTaskUuid: string, toTaskUuid: string): boolean {
  if (fromTaskUuid === toTaskUuid) return true;

  // Build dependency map: taskUuid -> prerequisite taskUuids
  const adj = new Map<string, string[]>();
  for (const t of tasks) {
    const deps = (t.dependencies || []).map(d => d['task-uuid']).filter(Boolean);
    adj.set(t.uuid, [...deps]);
  }

  // Add the proposed new dependency: fromTaskUuid depends on toTaskUuid
  const existing = adj.get(fromTaskUuid) || [];
  adj.set(fromTaskUuid, [...existing, toTaskUuid]);

  // DFS to detect cycle
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function dfs(curr: string): boolean {
    visited.add(curr);
    recursionStack.add(curr);

    const neighbors = adj.get(curr) || [];
    for (const next of neighbors) {
      if (!visited.has(next)) {
        if (dfs(next)) return true;
      } else if (recursionStack.has(next)) {
        return true;
      }
    }

    recursionStack.delete(curr);
    return false;
  }

  for (const node of adj.keys()) {
    if (!visited.has(node)) {
      if (dfs(node)) return true;
    }
  }

  return false;
}

// ============================================================================
// 1. Overview & Metadata Actions
// ============================================================================

export function setImportSSP(href: string, remarks?: string): DocumentAction {
  return createAction('assessment-plan', 'SET_IMPORT_SSP', `Set target SSP to "${href}"`, (draft: any) => {
    const ssp = ensureImportSSP(draft);
    if (!ssp) return;
    ssp.href = href;
    if (remarks !== undefined) {
      if (remarks) {
        ssp.remarks = remarks;
      } else {
        delete ssp.remarks;
      }
    }
  });
}

export function setAssessmentPlanMetadata(updates: Partial<Metadata>): DocumentAction {
  return createAction('assessment-plan', 'SET_METADATA', 'Update Assessment Plan metadata', (draft: any) => {
    const meta = ensureMetadata(draft);
    if (!meta) return;
    Object.assign(meta, updates);
    meta['last-modified'] = new Date().toISOString();
  });
}

export function setAPTitle(title: string): DocumentAction {
  return createAction('assessment-plan', 'SET_TITLE', `Set Assessment Plan title to "${title}"`, (draft: any) => {
    const meta = ensureMetadata(draft);
    if (!meta) return;
    meta.title = title;
    meta['last-modified'] = new Date().toISOString();
  });
}

export function setAPVersion(version: string): DocumentAction {
  return createAction('assessment-plan', 'SET_VERSION', `Set Assessment Plan version to "${version}"`, (draft: any) => {
    const meta = ensureMetadata(draft);
    if (!meta) return;
    meta.version = version;
    meta['last-modified'] = new Date().toISOString();
  });
}

export function setAPRemarks(remarks: string): DocumentAction {
  return createAction('assessment-plan', 'SET_REMARKS', 'Set Assessment Plan remarks', (draft: any) => {
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

export function addAPRole(role: {
  id: string;
  title: string;
  description?: string;
  props?: Property[];
  links?: Link[];
}): DocumentAction {
  return createAction('assessment-plan', 'ADD_ROLE', `Add role "${role.id}"`, (draft: any) => {
    const meta = ensureMetadata(draft);
    if (!meta) return;
    if (!meta.roles) meta.roles = [];
    const idx = meta.roles.findIndex((r: any) => r.id === role.id);
    if (idx >= 0) {
      meta.roles[idx] = { ...meta.roles[idx], ...role };
    } else {
      meta.roles.push(role);
    }
    meta['last-modified'] = new Date().toISOString();
  });
}

export function removeAPRole(roleId: string): DocumentAction {
  return createAction('assessment-plan', 'REMOVE_ROLE', `Remove role "${roleId}"`, (draft: any) => {
    const meta = ensureMetadata(draft);
    if (!meta || !meta.roles) return;
    meta.roles = meta.roles.filter((r: any) => r.id !== roleId);
    meta['last-modified'] = new Date().toISOString();
  });
}

export function addAPParty(party: {
  uuid?: string;
  type: 'person' | 'organization';
  name: string;
  'email-addresses'?: string[];
  'telephone-numbers'?: Array<{ 'type'?: string; number: string }>;
  props?: Property[];
  links?: Link[];
  remarks?: string;
}): DocumentAction {
  return createAction('assessment-plan', 'ADD_PARTY', `Add party "${party.name}"`, (draft: any) => {
    const meta = ensureMetadata(draft);
    if (!meta) return;
    if (!meta.parties) meta.parties = [];
    const partyUuid = party.uuid || generateUUID();
    const newParty = { ...party, uuid: partyUuid };
    const idx = meta.parties.findIndex((p: any) => p.uuid === partyUuid);
    if (idx >= 0) {
      meta.parties[idx] = newParty;
    } else {
      meta.parties.push(newParty);
    }
    meta['last-modified'] = new Date().toISOString();
  });
}

export function removeAPParty(partyUuid: string): DocumentAction {
  return createAction('assessment-plan', 'REMOVE_PARTY', `Remove party "${partyUuid}"`, (draft: any) => {
    const meta = ensureMetadata(draft);
    if (!meta || !meta.parties) return;
    meta.parties = meta.parties.filter((p: any) => p.uuid !== partyUuid);
    meta['last-modified'] = new Date().toISOString();
  });
}

export function addAPResponsibleParty(roleId: string, partyUuids: string[]): DocumentAction {
  return createAction('assessment-plan', 'ADD_RESPONSIBLE_PARTY', `Assign responsible party for role "${roleId}"`, (draft: any) => {
    const meta = ensureMetadata(draft);
    if (!meta) return;
    if (!meta['responsible-parties']) meta['responsible-parties'] = [];
    const idx = meta['responsible-parties'].findIndex((rp: any) => rp['role-id'] === roleId);
    if (idx >= 0) {
      const existing = meta['responsible-parties'][idx] as any;
      const combined = Array.from(new Set([...(existing['party-uuids'] || []), ...partyUuids]));
      existing['party-uuids'] = combined;
    } else {
      meta['responsible-parties'].push({
        'role-id': roleId,
        'party-uuids': partyUuids
      });
    }
    meta['last-modified'] = new Date().toISOString();
  });
}

export function removeAPResponsibleParty(roleId: string): DocumentAction {
  return createAction('assessment-plan', 'REMOVE_RESPONSIBLE_PARTY', `Remove responsible party for role "${roleId}"`, (draft: any) => {
    const meta = ensureMetadata(draft);
    if (!meta || !meta['responsible-parties']) return;
    meta['responsible-parties'] = meta['responsible-parties'].filter((rp: any) => rp['role-id'] !== roleId);
    meta['last-modified'] = new Date().toISOString();
  });
}

export function setAPProp(name: string, value: string, ns?: string): DocumentAction {
  return createAction('assessment-plan', 'SET_PROP', `Set metadata property "${name}"`, (draft: any) => {
    const meta = ensureMetadata(draft);
    if (!meta) return;
    if (!meta.props) meta.props = [];
    const propIndex = meta.props.findIndex(p => p.name === name);
    if (propIndex >= 0) {
      meta.props[propIndex].value = value;
      if (ns) meta.props[propIndex].ns = ns;
    } else {
      meta.props.push({ name, value, ...(ns ? { ns } : {}) });
    }
    meta['last-modified'] = new Date().toISOString();
  });
}

export function removeAPProp(name: string): DocumentAction {
  return createAction('assessment-plan', 'REMOVE_PROP', `Remove metadata property "${name}"`, (draft: any) => {
    const meta = ensureMetadata(draft);
    if (!meta || !meta.props) return;
    meta.props = meta.props.filter(p => p.name !== name);
    meta['last-modified'] = new Date().toISOString();
  });
}

// ============================================================================
// 2. Reviewed Controls & Scope Actions
// ============================================================================

export function setReviewedControlsDescription(description: string): DocumentAction {
  return createAction('assessment-plan', 'SET_REVIEWED_CONTROLS_DESC', 'Set reviewed-controls description', (draft: any) => {
    const rc = ensureReviewedControls(draft);
    if (!rc) return;
    rc.description = description;
  });
}

export function addControlSelection(selection?: Partial<ControlSelection>): DocumentAction {
  return createAction('assessment-plan', 'ADD_CONTROL_SELECTION', 'Add control selection', (draft: any) => {
    const rc = ensureReviewedControls(draft);
    if (!rc) return;
    const newSel: ControlSelection = {
      ...(selection || { 'include-all': {} })
    };
    rc['control-selections'].push(newSel);
  });
}

export function removeControlSelection(index: number): DocumentAction {
  return createAction('assessment-plan', 'REMOVE_CONTROL_SELECTION', `Remove control selection at index ${index}`, (draft: any) => {
    const rc = ensureReviewedControls(draft);
    if (!rc || !rc['control-selections']) return;
    if (index >= 0 && index < rc['control-selections'].length) {
      rc['control-selections'].splice(index, 1);
    }
    if (rc['control-selections'].length === 0) {
      rc['control-selections'].push({ 'include-all': {} });
    }
  });
}

export function setControlSelections(selections: ControlSelection[]): DocumentAction {
  return createAction('assessment-plan', 'SET_CONTROL_SELECTIONS', 'Set control selections list', (draft: any) => {
    const rc = ensureReviewedControls(draft);
    if (!rc) return;
    rc['control-selections'] = selections.length > 0 ? selections : [{ 'include-all': {} }];
  });
}

export function setIncludeAllControls(selectionIndex: number = 0): DocumentAction {
  return createAction('assessment-plan', 'SET_INCLUDE_ALL_CONTROLS', `Set include-all for selection ${selectionIndex}`, (draft: any) => {
    const rc = ensureReviewedControls(draft);
    if (!rc) return;
    if (!rc['control-selections'][selectionIndex]) {
      rc['control-selections'][selectionIndex] = {};
    }
    const sel = rc['control-selections'][selectionIndex];
    sel['include-all'] = {};
    delete sel['include-controls'];
  });
}

export function addIncludeControl(controlId: string, selectionIndex: number = 0, statementIds?: string[]): DocumentAction {
  return createAction('assessment-plan', 'ADD_INCLUDE_CONTROL', `Add included control "${controlId}"`, (draft: any) => {
    const rc = ensureReviewedControls(draft);
    if (!rc) return;
    if (!rc['control-selections'][selectionIndex]) {
      rc['control-selections'][selectionIndex] = {};
    }
    const sel = rc['control-selections'][selectionIndex];
    delete sel['include-all'];
    if (!sel['include-controls']) {
      sel['include-controls'] = [];
    }
    const existingIdx = sel['include-controls'].findIndex(c => c['control-id'] === controlId);
    if (existingIdx >= 0) {
      if (statementIds && statementIds.length > 0) {
        sel['include-controls'][existingIdx]['statement-ids'] = statementIds;
      }
    } else {
      const newItem: SelectControlById = {
        'control-id': controlId,
        ...(statementIds && statementIds.length > 0 ? { 'statement-ids': statementIds } : {})
      };
      sel['include-controls'].push(newItem);
    }
  });
}

export function removeIncludeControl(controlId: string, selectionIndex: number = 0): DocumentAction {
  return createAction('assessment-plan', 'REMOVE_INCLUDE_CONTROL', `Remove included control "${controlId}"`, (draft: any) => {
    const rc = ensureReviewedControls(draft);
    if (!rc || !rc['control-selections'][selectionIndex]) return;
    const sel = rc['control-selections'][selectionIndex];
    if (!sel['include-controls']) return;
    sel['include-controls'] = sel['include-controls'].filter(c => c['control-id'] !== controlId);
  });
}

export function addExcludeControl(controlId: string, selectionIndex: number = 0, statementIds?: string[]): DocumentAction {
  return createAction('assessment-plan', 'ADD_EXCLUDE_CONTROL', `Add excluded control "${controlId}"`, (draft: any) => {
    const rc = ensureReviewedControls(draft);
    if (!rc) return;
    if (!rc['control-selections'][selectionIndex]) {
      rc['control-selections'][selectionIndex] = {};
    }
    const sel = rc['control-selections'][selectionIndex];
    if (!sel['exclude-controls']) {
      sel['exclude-controls'] = [];
    }
    const existingIdx = sel['exclude-controls'].findIndex(c => c['control-id'] === controlId);
    if (existingIdx >= 0) {
      if (statementIds && statementIds.length > 0) {
        sel['exclude-controls'][existingIdx]['statement-ids'] = statementIds;
      }
    } else {
      const newItem: SelectControlById = {
        'control-id': controlId,
        ...(statementIds && statementIds.length > 0 ? { 'statement-ids': statementIds } : {})
      };
      sel['exclude-controls'].push(newItem);
    }
  });
}

export function removeExcludeControl(controlId: string, selectionIndex: number = 0): DocumentAction {
  return createAction('assessment-plan', 'REMOVE_EXCLUDE_CONTROL', `Remove excluded control "${controlId}"`, (draft: any) => {
    const rc = ensureReviewedControls(draft);
    if (!rc || !rc['control-selections'][selectionIndex]) return;
    const sel = rc['control-selections'][selectionIndex];
    if (!sel['exclude-controls']) return;
    sel['exclude-controls'] = sel['exclude-controls'].filter(c => c['control-id'] !== controlId);
  });
}

export function toggleIncludeControl(controlId: string, selectionIndex: number = 0, statementIds?: string[]): DocumentAction {
  return createAction('assessment-plan', 'TOGGLE_INCLUDE_CONTROL', `Toggle included control "${controlId}"`, (draft: any) => {
    const rc = ensureReviewedControls(draft);
    if (!rc) return;
    if (!rc['control-selections'][selectionIndex]) {
      rc['control-selections'][selectionIndex] = {};
    }
    const sel = rc['control-selections'][selectionIndex];
    delete sel['include-all'];
    if (!sel['include-controls']) {
      sel['include-controls'] = [];
    }
    const existingIdx = sel['include-controls'].findIndex(c => c['control-id'] === controlId);
    if (existingIdx >= 0) {
      sel['include-controls'].splice(existingIdx, 1);
    } else {
      sel['include-controls'].push({
        'control-id': controlId,
        ...(statementIds && statementIds.length > 0 ? { 'statement-ids': statementIds } : {})
      });
    }
  });
}

export function toggleExcludeControl(controlId: string, selectionIndex: number = 0, statementIds?: string[]): DocumentAction {
  return createAction('assessment-plan', 'TOGGLE_EXCLUDE_CONTROL', `Toggle excluded control "${controlId}"`, (draft: any) => {
    const rc = ensureReviewedControls(draft);
    if (!rc) return;
    if (!rc['control-selections'][selectionIndex]) {
      rc['control-selections'][selectionIndex] = {};
    }
    const sel = rc['control-selections'][selectionIndex];
    if (!sel['exclude-controls']) {
      sel['exclude-controls'] = [];
    }
    const existingIdx = sel['exclude-controls'].findIndex(c => c['control-id'] === controlId);
    if (existingIdx >= 0) {
      sel['exclude-controls'].splice(existingIdx, 1);
    } else {
      sel['exclude-controls'].push({
        'control-id': controlId,
        ...(statementIds && statementIds.length > 0 ? { 'statement-ids': statementIds } : {})
      });
    }
  });
}

export function setStatementIDs(controlId: string, statementIds: string[], selectionIndex: number = 0): DocumentAction {
  return createAction('assessment-plan', 'SET_STATEMENT_IDS', `Set statement IDs for "${controlId}"`, (draft: any) => {
    const rc = ensureReviewedControls(draft);
    if (!rc || !rc['control-selections'][selectionIndex]) return;
    const sel = rc['control-selections'][selectionIndex];
    if (sel['include-controls']) {
      const item = sel['include-controls'].find(c => c['control-id'] === controlId);
      if (item) {
        if (statementIds.length > 0) {
          item['statement-ids'] = statementIds;
        } else {
          delete item['statement-ids'];
        }
      }
    }
    if (sel['exclude-controls']) {
      const item = sel['exclude-controls'].find(c => c['control-id'] === controlId);
      if (item) {
        if (statementIds.length > 0) {
          item['statement-ids'] = statementIds;
        } else {
          delete item['statement-ids'];
        }
      }
    }
  });
}

export function setControlObjectiveSelections(selections: ControlObjectiveSelection[]): DocumentAction {
  return createAction('assessment-plan', 'SET_OBJECTIVE_SELECTIONS', 'Set control objective selections', (draft: any) => {
    const rc = ensureReviewedControls(draft);
    if (!rc) return;
    rc['control-objective-selections'] = selections;
  });
}

export function addControlObjectiveSelection(selection?: Partial<ControlObjectiveSelection>): DocumentAction {
  return createAction('assessment-plan', 'ADD_OBJECTIVE_SELECTION', 'Add control objective selection', (draft: any) => {
    const rc = ensureReviewedControls(draft);
    if (!rc) return;
    if (!rc['control-objective-selections']) {
      rc['control-objective-selections'] = [];
    }
    rc['control-objective-selections'].push(selection || { 'include-all': {} });
  });
}

export function removeControlObjectiveSelection(index: number): DocumentAction {
  return createAction('assessment-plan', 'REMOVE_OBJECTIVE_SELECTION', `Remove control objective selection at index ${index}`, (draft: any) => {
    const rc = ensureReviewedControls(draft);
    if (!rc || !rc['control-objective-selections']) return;
    if (index >= 0 && index < rc['control-objective-selections'].length) {
      rc['control-objective-selections'].splice(index, 1);
    }
  });
}

export function populateControlsFromSSP(controlIds: string[]): DocumentAction {
  return createAction('assessment-plan', 'POPULATE_CONTROLS_FROM_SSP', `Populate ${controlIds.length} controls from target SSP`, (draft: any) => {
    const rc = ensureReviewedControls(draft);
    if (!rc) return;
    const items: SelectControlById[] = controlIds.map(cid => ({ 'control-id': cid }));
    rc['control-selections'] = [
      {
        'include-controls': items
      }
    ];
  });
}

// ============================================================================
// 3. Assessment Subjects Actions
// ============================================================================

export function addAssessmentSubject(subject: {
  type: AssessmentSubjectType;
  description?: string;
  includeAll?: boolean;
  includeSubjects?: SelectSubjectById[];
  excludeSubjects?: SelectSubjectById[];
  props?: Property[];
  links?: Link[];
  remarks?: string;
}): DocumentAction {
  return createAction('assessment-plan', 'ADD_ASSESSMENT_SUBJECT', `Add assessment subject for type "${subject.type}"`, (draft: any) => {
    const subjects = ensureAssessmentSubjects(draft);
    if (!subjects) return;
    const newSubj: AssessmentSubject = {
      type: subject.type,
      ...(subject.description ? { description: subject.description } : {}),
      ...(subject.includeAll ? { 'include-all': {} } : {}),
      ...(subject.includeSubjects && subject.includeSubjects.length > 0 ? { 'include-subjects': subject.includeSubjects } : {}),
      ...(subject.excludeSubjects && subject.excludeSubjects.length > 0 ? { 'exclude-subjects': subject.excludeSubjects } : {}),
      ...(subject.props && subject.props.length > 0 ? { props: subject.props } : {}),
      ...(subject.links && subject.links.length > 0 ? { links: subject.links } : {}),
      ...(subject.remarks ? { remarks: subject.remarks } : {})
    };
    subjects.push(newSubj);
  });
}

export function updateAssessmentSubject(index: number, updates: Partial<AssessmentSubject>): DocumentAction {
  return createAction('assessment-plan', 'UPDATE_ASSESSMENT_SUBJECT', `Update assessment subject at index ${index}`, (draft: any) => {
    const subjects = ensureAssessmentSubjects(draft);
    if (!subjects || !subjects[index]) return;
    Object.assign(subjects[index], updates);
  });
}

export function removeAssessmentSubject(index: number): DocumentAction {
  return createAction('assessment-plan', 'REMOVE_ASSESSMENT_SUBJECT', `Remove assessment subject at index ${index}`, (draft: any) => {
    const subjects = ensureAssessmentSubjects(draft);
    if (!subjects) return;
    if (index >= 0 && index < subjects.length) {
      subjects.splice(index, 1);
    }
  });
}

export function addSubjectReference(
  subjectIndex: number,
  item: SelectSubjectById,
  isExclude: boolean = false
): DocumentAction {
  return createAction('assessment-plan', 'ADD_SUBJECT_REFERENCE', `Add subject reference "${item['subject-uuid']}"`, (draft: any) => {
    const subjects = ensureAssessmentSubjects(draft);
    if (!subjects || !subjects[subjectIndex]) return;
    const target = subjects[subjectIndex];
    const key = isExclude ? 'exclude-subjects' : 'include-subjects';
    if (!target[key]) {
      target[key] = [];
    }
    const list = target[key] as SelectSubjectById[];
    const existingIdx = list.findIndex(s => s['subject-uuid'] === item['subject-uuid']);
    if (existingIdx >= 0) {
      list[existingIdx] = { ...list[existingIdx], ...item };
    } else {
      list.push(item);
    }
    if (!isExclude && target['include-all']) {
      delete target['include-all'];
    }
  });
}

export function removeSubjectReference(
  subjectIndex: number,
  subjectUuid: string,
  isExclude: boolean = false
): DocumentAction {
  return createAction('assessment-plan', 'REMOVE_SUBJECT_REFERENCE', `Remove subject reference "${subjectUuid}"`, (draft: any) => {
    const subjects = ensureAssessmentSubjects(draft);
    if (!subjects || !subjects[subjectIndex]) return;
    const target = subjects[subjectIndex];
    const key = isExclude ? 'exclude-subjects' : 'include-subjects';
    if (!target[key]) return;
    target[key] = (target[key] as SelectSubjectById[]).filter(s => s['subject-uuid'] !== subjectUuid);
  });
}

export function addAssessmentSubjectPlaceholder(placeholder: Partial<AssessmentSubjectPlaceholder>): DocumentAction {
  return createAction('assessment-plan', 'ADD_SUBJECT_PLACEHOLDER', 'Add assessment subject placeholder', (draft: any) => {
    const ap = getAP(draft);
    if (!ap) return;
    if (!ap['assessment-subjects']) ap['assessment-subjects'] = [];
    // Placeholders are structured as special subjects or stored with task linkage
    const placeholderUuid = placeholder.uuid || generateUUID();
    const item: AssessmentSubject = {
      type: 'component',
      description: placeholder.description || 'Dynamic Assessment Placeholder',
      props: [
        { name: 'placeholder-uuid', value: placeholderUuid },
        ...(placeholder.props || [])
      ],
      remarks: placeholder.remarks
    };
    ap['assessment-subjects'].push(item);
  });
}

export function removeAssessmentSubjectPlaceholder(placeholderUuid: string): DocumentAction {
  return createAction('assessment-plan', 'REMOVE_SUBJECT_PLACEHOLDER', `Remove placeholder "${placeholderUuid}"`, (draft: any) => {
    const subjects = ensureAssessmentSubjects(draft);
    if (!subjects) return;
    const ap = getAP(draft);
    if (ap && ap['assessment-subjects']) {
      ap['assessment-subjects'] = ap['assessment-subjects'].filter(
        s => !s.props?.some(p => p.name === 'placeholder-uuid' && p.value === placeholderUuid)
      );
    }
  });
}

// ============================================================================
// 4. Assessment Assets & Platforms Actions
// ============================================================================

export function addAssetComponent(component: Partial<SystemComponent>): DocumentAction {
  return createAction('assessment-plan', 'ADD_ASSET_COMPONENT', `Add asset component "${component.title || 'Untitled'}"`, (draft: any) => {
    const assets = ensureAssessmentAssets(draft);
    if (!assets) return;
    if (!assets.components) assets.components = [];
    const compUuid = component.uuid || generateUUID();
    const newComp: SystemComponent = {
      uuid: compUuid,
      type: component.type || 'software',
      title: component.title || 'New Assessment Tool',
      description: component.description || '',
      status: component.status || { state: 'operational' },
      ...component
    };
    assets.components.push(newComp);
  });
}

export function updateAssetComponent(componentUuid: string, updates: Partial<SystemComponent>): DocumentAction {
  return createAction('assessment-plan', 'UPDATE_ASSET_COMPONENT', `Update asset component "${componentUuid}"`, (draft: any) => {
    const assets = ensureAssessmentAssets(draft);
    if (!assets || !assets.components) return;
    const idx = assets.components.findIndex(c => c.uuid === componentUuid);
    if (idx >= 0) {
      assets.components[idx] = { ...assets.components[idx], ...updates };
    }
  });
}

export function removeAssetComponent(componentUuid: string): DocumentAction {
  return createAction('assessment-plan', 'REMOVE_ASSET_COMPONENT', `Remove asset component "${componentUuid}"`, (draft: any) => {
    const assets = ensureAssessmentAssets(draft);
    if (!assets || !assets.components) return;
    assets.components = assets.components.filter(c => c.uuid !== componentUuid);
  });
}

export function addAssessmentPlatform(platform: Partial<AssessmentPlatform>): DocumentAction {
  return createAction('assessment-plan', 'ADD_ASSESSMENT_PLATFORM', `Add assessment platform "${platform.title || 'Untitled'}"`, (draft: any) => {
    const assets = ensureAssessmentAssets(draft);
    if (!assets) return;
    const platUuid = platform.uuid || generateUUID();
    const newPlat: AssessmentPlatform = {
      uuid: platUuid,
      title: platform.title || 'New Assessment Platform',
      'uses-components': platform['uses-components'] || [],
      ...platform
    };
    assets['assessment-platforms'].push(newPlat);
  });
}

export function updateAssessmentPlatform(platformUuid: string, updates: Partial<AssessmentPlatform>): DocumentAction {
  return createAction('assessment-plan', 'UPDATE_ASSESSMENT_PLATFORM', `Update platform "${platformUuid}"`, (draft: any) => {
    const assets = ensureAssessmentAssets(draft);
    if (!assets || !assets['assessment-platforms']) return;
    const idx = assets['assessment-platforms'].findIndex(p => p.uuid === platformUuid);
    if (idx >= 0) {
      assets['assessment-platforms'][idx] = { ...assets['assessment-platforms'][idx], ...updates };
    }
  });
}

export function removeAssessmentPlatform(platformUuid: string): DocumentAction {
  return createAction('assessment-plan', 'REMOVE_ASSESSMENT_PLATFORM', `Remove platform "${platformUuid}"`, (draft: any) => {
    const assets = ensureAssessmentAssets(draft);
    if (!assets || !assets['assessment-platforms']) return;
    assets['assessment-platforms'] = assets['assessment-platforms'].filter(p => p.uuid !== platformUuid);
  });
}

export function addPlatformComponent(
  platformUuid: string,
  componentUuid: string,
  responsibleParties?: ResponsibleParty[]
): DocumentAction {
  return createAction('assessment-plan', 'ADD_PLATFORM_COMPONENT', `Add component "${componentUuid}" to platform "${platformUuid}"`, (draft: any) => {
    const assets = ensureAssessmentAssets(draft);
    if (!assets || !assets['assessment-platforms']) return;
    const plat = assets['assessment-platforms'].find(p => p.uuid === platformUuid);
    if (!plat) return;
    if (!plat['uses-components']) plat['uses-components'] = [];
    const idx = plat['uses-components'].findIndex(u => u['component-uuid'] === componentUuid);
    if (idx >= 0) {
      if (responsibleParties) {
        plat['uses-components'][idx]['responsible-parties'] = responsibleParties;
      }
    } else {
      plat['uses-components'].push({
        'component-uuid': componentUuid,
        ...(responsibleParties && responsibleParties.length > 0 ? { 'responsible-parties': responsibleParties } : {})
      });
    }
  });
}

export function removePlatformComponent(platformUuid: string, componentUuid: string): DocumentAction {
  return createAction('assessment-plan', 'REMOVE_PLATFORM_COMPONENT', `Remove component "${componentUuid}" from platform "${platformUuid}"`, (draft: any) => {
    const assets = ensureAssessmentAssets(draft);
    if (!assets || !assets['assessment-platforms']) return;
    const plat = assets['assessment-platforms'].find(p => p.uuid === platformUuid);
    if (!plat || !plat['uses-components']) return;
    plat['uses-components'] = plat['uses-components'].filter(u => u['component-uuid'] !== componentUuid);
  });
}

// ============================================================================
// 5. Local Definitions Actions
// ============================================================================

export function addLocalComponent(component: Partial<SystemComponent>): DocumentAction {
  return createAction('assessment-plan', 'ADD_LOCAL_COMPONENT', `Add local component "${component.title || 'Untitled'}"`, (draft: any) => {
    const ld = ensureLocalDefinitions(draft);
    if (!ld) return;
    if (!ld.components) ld.components = [];
    const compUuid = component.uuid || generateUUID();
    const newComp: SystemComponent = {
      uuid: compUuid,
      type: component.type || 'software',
      title: component.title || 'New Local Component',
      description: component.description || '',
      status: component.status || { state: 'operational' },
      ...component
    };
    ld.components.push(newComp);
  });
}

export function updateLocalComponent(componentUuid: string, updates: Partial<SystemComponent>): DocumentAction {
  return createAction('assessment-plan', 'UPDATE_LOCAL_COMPONENT', `Update local component "${componentUuid}"`, (draft: any) => {
    const ld = ensureLocalDefinitions(draft);
    if (!ld || !ld.components) return;
    const idx = ld.components.findIndex(c => c.uuid === componentUuid);
    if (idx >= 0) {
      ld.components[idx] = { ...ld.components[idx], ...updates };
    }
  });
}

export function removeLocalComponent(componentUuid: string): DocumentAction {
  return createAction('assessment-plan', 'REMOVE_LOCAL_COMPONENT', `Remove local component "${componentUuid}"`, (draft: any) => {
    const ld = ensureLocalDefinitions(draft);
    if (!ld || !ld.components) return;
    ld.components = ld.components.filter(c => c.uuid !== componentUuid);
  });
}

export function addLocalInventoryItem(item: Partial<InventoryItem>): DocumentAction {
  return createAction('assessment-plan', 'ADD_LOCAL_INVENTORY_ITEM', 'Add local inventory item', (draft: any) => {
    const ld = ensureLocalDefinitions(draft);
    if (!ld) return;
    if (!ld['inventory-items']) ld['inventory-items'] = [];
    const itemUuid = item.uuid || generateUUID();
    const newItem: InventoryItem = {
      uuid: itemUuid,
      description: item.description || 'New Local Inventory Item',
      ...item
    };
    ld['inventory-items'].push(newItem);
  });
}

export function updateLocalInventoryItem(itemUuid: string, updates: Partial<InventoryItem>): DocumentAction {
  return createAction('assessment-plan', 'UPDATE_LOCAL_INVENTORY_ITEM', `Update local inventory item "${itemUuid}"`, (draft: any) => {
    const ld = ensureLocalDefinitions(draft);
    if (!ld || !ld['inventory-items']) return;
    const idx = ld['inventory-items'].findIndex(i => i.uuid === itemUuid);
    if (idx >= 0) {
      ld['inventory-items'][idx] = { ...ld['inventory-items'][idx], ...updates };
    }
  });
}

export function removeLocalInventoryItem(itemUuid: string): DocumentAction {
  return createAction('assessment-plan', 'REMOVE_LOCAL_INVENTORY_ITEM', `Remove local inventory item "${itemUuid}"`, (draft: any) => {
    const ld = ensureLocalDefinitions(draft);
    if (!ld || !ld['inventory-items']) return;
    ld['inventory-items'] = ld['inventory-items'].filter(i => i.uuid !== itemUuid);
  });
}

export function addLocalUser(user: Partial<SystemUser>): DocumentAction {
  return createAction('assessment-plan', 'ADD_LOCAL_USER', `Add local user "${user.title || 'Untitled'}"`, (draft: any) => {
    const ld = ensureLocalDefinitions(draft);
    if (!ld) return;
    if (!ld.users) ld.users = [];
    const userUuid = user.uuid || generateUUID();
    const newUser: SystemUser = {
      uuid: userUuid,
      title: user.title || 'New Local User',
      ...user
    };
    ld.users.push(newUser);
  });
}

export function updateLocalUser(userUuid: string, updates: Partial<SystemUser>): DocumentAction {
  return createAction('assessment-plan', 'UPDATE_LOCAL_USER', `Update local user "${userUuid}"`, (draft: any) => {
    const ld = ensureLocalDefinitions(draft);
    if (!ld || !ld.users) return;
    const idx = ld.users.findIndex(u => u.uuid === userUuid);
    if (idx >= 0) {
      ld.users[idx] = { ...ld.users[idx], ...updates };
    }
  });
}

export function removeLocalUser(userUuid: string): DocumentAction {
  return createAction('assessment-plan', 'REMOVE_LOCAL_USER', `Remove local user "${userUuid}"`, (draft: any) => {
    const ld = ensureLocalDefinitions(draft);
    if (!ld || !ld.users) return;
    ld.users = ld.users.filter(u => u.uuid !== userUuid);
  });
}

export function addLocalObjective(objective: Partial<LocalObjective>): DocumentAction {
  return createAction('assessment-plan', 'ADD_LOCAL_OBJECTIVE', `Add local objective for control "${objective['control-id'] || 'unknown'}"`, (draft: any) => {
    const ld = ensureLocalDefinitions(draft);
    if (!ld) return;
    if (!ld['objectives-and-methods']) ld['objectives-and-methods'] = [];
    const controlId = objective['control-id'] || 'ac-1';
    const newObj: LocalObjective = {
      'control-id': controlId,
      parts: objective.parts || [
        {
          name: 'assessment-objective',
          prose: 'Evaluate control implementation.',
          props: [{ name: 'method-id', value: 'method-1' }]
        },
        {
          name: 'assessment-method',
          props: [{ name: 'method', value: 'EXAMINE' }],
          parts: [{ name: 'assessment-objects', prose: 'System documentation and configuration logs.' }]
        }
      ],
      ...objective
    };
    const idx = ld['objectives-and-methods'].findIndex(o => o['control-id'] === controlId);
    if (idx >= 0) {
      ld['objectives-and-methods'][idx] = newObj;
    } else {
      ld['objectives-and-methods'].push(newObj);
    }
  });
}

export function updateLocalObjective(controlId: string, updates: Partial<LocalObjective>): DocumentAction {
  return createAction('assessment-plan', 'UPDATE_LOCAL_OBJECTIVE', `Update local objective for control "${controlId}"`, (draft: any) => {
    const ld = ensureLocalDefinitions(draft);
    if (!ld || !ld['objectives-and-methods']) return;
    const idx = ld['objectives-and-methods'].findIndex(o => o['control-id'] === controlId);
    if (idx >= 0) {
      ld['objectives-and-methods'][idx] = { ...ld['objectives-and-methods'][idx], ...updates };
    }
  });
}

export function removeLocalObjective(controlId: string): DocumentAction {
  return createAction('assessment-plan', 'REMOVE_LOCAL_OBJECTIVE', `Remove local objective for control "${controlId}"`, (draft: any) => {
    const ld = ensureLocalDefinitions(draft);
    if (!ld || !ld['objectives-and-methods']) return;
    ld['objectives-and-methods'] = ld['objectives-and-methods'].filter(o => o['control-id'] !== controlId);
  });
}

export function addLocalActivity(activity: Partial<LocalActivity>): DocumentAction {
  return createAction('assessment-plan', 'ADD_LOCAL_ACTIVITY', `Add local activity "${activity.title || 'Untitled'}"`, (draft: any) => {
    const ld = ensureLocalDefinitions(draft);
    if (!ld) return;
    if (!ld.activities) ld.activities = [];
    const actUuid = activity.uuid || generateUUID();
    const newAct: LocalActivity = {
      uuid: actUuid,
      title: activity.title || 'New Assessment Activity',
      description: activity.description || '',
      steps: activity.steps || [],
      ...activity
    };
    ld.activities.push(newAct);
  });
}

export function updateLocalActivity(activityUuid: string, updates: Partial<LocalActivity>): DocumentAction {
  return createAction('assessment-plan', 'UPDATE_LOCAL_ACTIVITY', `Update local activity "${activityUuid}"`, (draft: any) => {
    const ld = ensureLocalDefinitions(draft);
    if (!ld || !ld.activities) return;
    const idx = ld.activities.findIndex(a => a.uuid === activityUuid);
    if (idx >= 0) {
      ld.activities[idx] = { ...ld.activities[idx], ...updates };
    }
  });
}

export function removeLocalActivity(activityUuid: string): DocumentAction {
  return createAction('assessment-plan', 'REMOVE_LOCAL_ACTIVITY', `Remove local activity "${activityUuid}"`, (draft: any) => {
    const ld = ensureLocalDefinitions(draft);
    if (!ld || !ld.activities) return;
    ld.activities = ld.activities.filter(a => a.uuid !== activityUuid);
  });
}

export function addActivityStep(activityUuid: string, step: Partial<ActivityStep>): DocumentAction {
  return createAction('assessment-plan', 'ADD_ACTIVITY_STEP', `Add step to activity "${activityUuid}"`, (draft: any) => {
    const ld = ensureLocalDefinitions(draft);
    if (!ld || !ld.activities) return;
    const act = ld.activities.find(a => a.uuid === activityUuid);
    if (!act) return;
    if (!act.steps) act.steps = [];
    const stepUuid = step.uuid || generateUUID();
    const newStep: ActivityStep = {
      uuid: stepUuid,
      title: step.title || `Step ${act.steps.length + 1}`,
      description: step.description || '',
      ...step
    };
    act.steps.push(newStep);
  });
}

export function updateActivityStep(activityUuid: string, stepUuid: string, updates: Partial<ActivityStep>): DocumentAction {
  return createAction('assessment-plan', 'UPDATE_ACTIVITY_STEP', `Update step "${stepUuid}" in activity "${activityUuid}"`, (draft: any) => {
    const ld = ensureLocalDefinitions(draft);
    if (!ld || !ld.activities) return;
    const act = ld.activities.find(a => a.uuid === activityUuid);
    if (!act || !act.steps) return;
    const idx = act.steps.findIndex(s => s.uuid === stepUuid);
    if (idx >= 0) {
      act.steps[idx] = { ...act.steps[idx], ...updates };
    }
  });
}

export function removeActivityStep(activityUuid: string, stepUuid: string): DocumentAction {
  return createAction('assessment-plan', 'REMOVE_ACTIVITY_STEP', `Remove step "${stepUuid}" from activity "${activityUuid}"`, (draft: any) => {
    const ld = ensureLocalDefinitions(draft);
    if (!ld || !ld.activities) return;
    const act = ld.activities.find(a => a.uuid === activityUuid);
    if (!act || !act.steps) return;
    act.steps = act.steps.filter(s => s.uuid !== stepUuid);
  });
}

export function reorderActivitySteps(activityUuid: string, fromIndex: number, toIndex: number): DocumentAction {
  return createAction('assessment-plan', 'REORDER_ACTIVITY_STEPS', `Reorder steps in activity "${activityUuid}" from ${fromIndex} to ${toIndex}`, (draft: any) => {
    const ld = ensureLocalDefinitions(draft);
    if (!ld || !ld.activities) return;
    const act = ld.activities.find(a => a.uuid === activityUuid);
    if (!act || !act.steps) return;
    if (fromIndex >= 0 && fromIndex < act.steps.length && toIndex >= 0 && toIndex < act.steps.length) {
      const [moved] = act.steps.splice(fromIndex, 1);
      act.steps.splice(toIndex, 0, moved);
    }
  });
}

// ============================================================================
// 6. Tasks & Timeline Actions
// ============================================================================

export function addTask(task: Partial<Task>): DocumentAction {
  return createAction('assessment-plan', 'ADD_TASK', `Add task "${task.title || 'Untitled'}"`, (draft: any) => {
    const tasks = ensureTasks(draft);
    if (!tasks) return;
    const taskUuid = task.uuid || generateUUID();
    const newTask: Task = {
      uuid: taskUuid,
      type: task.type || 'action',
      title: task.title || 'New Assessment Task',
      description: task.description || '',
      ...task
    };
    tasks.push(newTask);
  });
}

export function updateTask(taskUuid: string, updates: Partial<Task>): DocumentAction {
  return createAction('assessment-plan', 'UPDATE_TASK', `Update task "${taskUuid}"`, (draft: any) => {
    const tasks = ensureTasks(draft);
    if (!tasks) return;
    const idx = tasks.findIndex(t => t.uuid === taskUuid);
    if (idx >= 0) {
      tasks[idx] = { ...tasks[idx], ...updates };
    }
  });
}

export function removeTask(taskUuid: string): DocumentAction {
  return createAction('assessment-plan', 'REMOVE_TASK', `Remove task "${taskUuid}"`, (draft: any) => {
    const tasks = ensureTasks(draft);
    if (!tasks) return;
    const ap = getAP(draft);
    if (ap && ap.tasks) {
      ap.tasks = ap.tasks.filter(t => t.uuid !== taskUuid);
      // Clean up dependencies pointing to this deleted task
      for (const t of ap.tasks) {
        if (t.dependencies) {
          t.dependencies = t.dependencies.filter(d => d['task-uuid'] !== taskUuid);
        }
      }
    }
  });
}

export function setTaskTiming(taskUuid: string, timing: TaskTiming): DocumentAction {
  return createAction('assessment-plan', 'SET_TASK_TIMING', `Set timing for task "${taskUuid}"`, (draft: any) => {
    const tasks = ensureTasks(draft);
    if (!tasks) return;
    const task = tasks.find(t => t.uuid === taskUuid);
    if (!task) return;
    task.timing = timing;
  });
}

export function addTaskDependency(taskUuid: string, dependsOnTaskUuid: string, remarks?: string): DocumentAction {
  return createAction('assessment-plan', 'ADD_TASK_DEPENDENCY', `Add dependency: task "${taskUuid}" depends on "${dependsOnTaskUuid}"`, (draft: any) => {
    const tasks = ensureTasks(draft);
    if (!tasks) return;
    const task = tasks.find(t => t.uuid === taskUuid);
    if (!task) return;

    if (taskUuid === dependsOnTaskUuid) {
      throw new Error(`Task cannot depend on itself: "${taskUuid}"`);
    }

    if (hasTaskCycle(tasks, taskUuid, dependsOnTaskUuid)) {
      throw new Error(`Circular dependency detected: adding dependency from task "${taskUuid}" to "${dependsOnTaskUuid}" would create a cycle`);
    }

    if (!task.dependencies) task.dependencies = [];
    const idx = task.dependencies.findIndex(d => d['task-uuid'] === dependsOnTaskUuid);
    if (idx >= 0) {
      if (remarks) task.dependencies[idx].remarks = remarks;
    } else {
      task.dependencies.push({
        'task-uuid': dependsOnTaskUuid,
        ...(remarks ? { remarks } : {})
      });
    }
  });
}

export function removeTaskDependency(taskUuid: string, dependsOnTaskUuid: string): DocumentAction {
  return createAction('assessment-plan', 'REMOVE_TASK_DEPENDENCY', `Remove dependency on "${dependsOnTaskUuid}" from task "${taskUuid}"`, (draft: any) => {
    const tasks = ensureTasks(draft);
    if (!tasks) return;
    const task = tasks.find(t => t.uuid === taskUuid);
    if (!task || !task.dependencies) return;
    task.dependencies = task.dependencies.filter(d => d['task-uuid'] !== dependsOnTaskUuid);
  });
}

export function addTaskActivity(
  taskUuid: string,
  activityUuid: string,
  subjects: AssessmentSubject[] = [{ type: 'component', 'include-all': {} }],
  responsibleRoles?: ResponsibleRole[]
): DocumentAction {
  return createAction('assessment-plan', 'ADD_TASK_ACTIVITY', `Link activity "${activityUuid}" to task "${taskUuid}"`, (draft: any) => {
    const tasks = ensureTasks(draft);
    if (!tasks) return;
    const task = tasks.find(t => t.uuid === taskUuid);
    if (!task) return;
    if (!task['associated-activities']) task['associated-activities'] = [];
    const idx = task['associated-activities'].findIndex(a => a['activity-uuid'] === activityUuid);
    const newAssoc: AssociatedActivity = {
      'activity-uuid': activityUuid,
      subjects: subjects.length > 0 ? subjects : [{ type: 'component', 'include-all': {} }],
      ...(responsibleRoles && responsibleRoles.length > 0 ? { 'responsible-roles': responsibleRoles } : {})
    };
    if (idx >= 0) {
      task['associated-activities'][idx] = newAssoc;
    } else {
      task['associated-activities'].push(newAssoc);
    }
  });
}

export function removeTaskActivity(taskUuid: string, activityUuid: string): DocumentAction {
  return createAction('assessment-plan', 'REMOVE_TASK_ACTIVITY', `Remove activity "${activityUuid}" from task "${taskUuid}"`, (draft: any) => {
    const tasks = ensureTasks(draft);
    if (!tasks) return;
    const task = tasks.find(t => t.uuid === taskUuid);
    if (!task || !task['associated-activities']) return;
    task['associated-activities'] = task['associated-activities'].filter(a => a['activity-uuid'] !== activityUuid);
  });
}

export function addTaskSubject(taskUuid: string, subject: AssessmentSubject): DocumentAction {
  return createAction('assessment-plan', 'ADD_TASK_SUBJECT', `Add subject to task "${taskUuid}"`, (draft: any) => {
    const tasks = ensureTasks(draft);
    if (!tasks) return;
    const task = tasks.find(t => t.uuid === taskUuid);
    if (!task) return;
    if (!task.subjects) task.subjects = [];
    task.subjects.push(subject);
  });
}

export function removeTaskSubject(taskUuid: string, subjectIndex: number): DocumentAction {
  return createAction('assessment-plan', 'REMOVE_TASK_SUBJECT', `Remove subject at index ${subjectIndex} from task "${taskUuid}"`, (draft: any) => {
    const tasks = ensureTasks(draft);
    if (!tasks) return;
    const task = tasks.find(t => t.uuid === taskUuid);
    if (!task || !task.subjects) return;
    if (subjectIndex >= 0 && subjectIndex < task.subjects.length) {
      task.subjects.splice(subjectIndex, 1);
    }
  });
}

// ============================================================================
// 7. Terms & Conditions Actions
// ============================================================================

export function addTermsPart(part: Partial<TermsPart>): DocumentAction {
  return createAction('assessment-plan', 'ADD_TERMS_PART', `Add terms part "${part.name || 'rules-of-engagement'}"`, (draft: any) => {
    const tc = ensureTermsAndConditions(draft);
    if (!tc) return;
    const partUuid = part.uuid || generateUUID();
    const newPart: TermsPart = {
      uuid: partUuid,
      name: (part.name as TermsPartNameEnum) || 'rules-of-engagement',
      title: part.title || 'Rules of Engagement',
      prose: part.prose || '',
      ...part
    };
    tc.parts.push(newPart);
  });
}

export function updateTermsPart(indexOrUuid: number | string, updates: Partial<TermsPart>): DocumentAction {
  return createAction('assessment-plan', 'UPDATE_TERMS_PART', `Update terms part "${indexOrUuid}"`, (draft: any) => {
    const tc = ensureTermsAndConditions(draft);
    if (!tc || !tc.parts) return;
    let target: TermsPart | AssessmentPart | undefined;
    if (typeof indexOrUuid === 'number') {
      target = tc.parts[indexOrUuid];
    } else {
      target = tc.parts.find(p => p.uuid === indexOrUuid);
    }
    if (target) {
      Object.assign(target, updates);
    }
  });
}

export function removeTermsPart(indexOrUuid: number | string): DocumentAction {
  return createAction('assessment-plan', 'REMOVE_TERMS_PART', `Remove terms part "${indexOrUuid}"`, (draft: any) => {
    const tc = ensureTermsAndConditions(draft);
    if (!tc || !tc.parts) return;
    if (typeof indexOrUuid === 'number') {
      if (indexOrUuid >= 0 && indexOrUuid < tc.parts.length) {
        tc.parts.splice(indexOrUuid, 1);
      }
    } else {
      tc.parts = tc.parts.filter(p => p.uuid !== indexOrUuid);
    }
  });
}

// ============================================================================
// 8. Back-Matter Resource Attachments Actions
// ============================================================================

export function addResourceAttachment(resource: Partial<Resource>): DocumentAction {
  return createAction('assessment-plan', 'ADD_RESOURCE_ATTACHMENT', `Add resource "${resource.title || 'Untitled'}"`, (draft: any) => {
    const bm = ensureBackMatter(draft);
    if (!bm) return;
    if (!bm.resources) bm.resources = [];
    const resUuid = resource.uuid || generateUUID();
    const newRes: Resource = {
      uuid: resUuid,
      title: resource.title || 'Attachment',
      rlinks: resource.rlinks || [{ href: `#${resUuid}` }],
      ...resource
    };
    const idx = bm.resources.findIndex(r => r.uuid === resUuid);
    if (idx >= 0) {
      bm.resources[idx] = newRes;
    } else {
      bm.resources.push(newRes);
    }
  });
}

export function updateResourceAttachment(resourceUuid: string, updates: Partial<Resource>): DocumentAction {
  return createAction('assessment-plan', 'UPDATE_RESOURCE_ATTACHMENT', `Update resource "${resourceUuid}"`, (draft: any) => {
    const bm = ensureBackMatter(draft);
    if (!bm || !bm.resources) return;
    const idx = bm.resources.findIndex(r => r.uuid === resourceUuid);
    if (idx >= 0) {
      bm.resources[idx] = { ...bm.resources[idx], ...updates };
    }
  });
}

export function removeResourceAttachment(resourceUuid: string): DocumentAction {
  return createAction('assessment-plan', 'REMOVE_RESOURCE_ATTACHMENT', `Remove resource "${resourceUuid}"`, (draft: any) => {
    const bm = ensureBackMatter(draft);
    if (!bm || !bm.resources) return;
    bm.resources = bm.resources.filter(r => r.uuid !== resourceUuid);
  });
}

// ============================================================================
// 9. Empty Array Purging per DD-014 & Clean Utilities
// ============================================================================

const PRESERVE_EMPTY_ARRAYS = new Set(['maps', 'mappings', 'sources', 'targets']);

export function cleanAPEmptyArrays(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    return obj
      .map(cleanAPEmptyArrays)
      .filter((item: unknown) => item !== undefined);
  } else if (obj !== null && typeof obj === 'object') {
    const cleaned: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj)) {
      if (Array.isArray(val) && val.length === 0 && !PRESERVE_EMPTY_ARRAYS.has(key)) {
        continue;
      }
      cleaned[key] = cleanAPEmptyArrays(val);
    }
    return cleaned;
  }
  return obj;
}

export function purgeAPEmptyArrays(draft: any): void {
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

  const ap = getAP(draft);
  if (ap) {
    purgeInPlace(ap);
  }
}

// ============================================================================
// 10. General / Utility & Reducer Actions
// ============================================================================

export function updateAPField(path: (string | number)[], value: any): DocumentAction {
  return createAction('assessment-plan', 'UPDATE_FIELD', `Update AP field ${path.join('.')}`, (draft: any) => {
    let current = draft['assessment-plan'] || draft;
    for (let i = 0; i < path.length - 1; i++) {
      if (!current[path[i]]) current[path[i]] = {};
      current = current[path[i]];
    }
    current[path[path.length - 1]] = value;
  });
}

export function updateAPListItem(
  listPath: string[],
  itemUuid: string,
  updates: any
): DocumentAction {
  return createAction('assessment-plan', 'UPDATE_LIST_ITEM', `Update list item in ${listPath.join('.')}`, (draft: any) => {
    const apRef = draft['assessment-plan'] || draft;
    const list = listPath.reduce((obj, key) => (obj && obj[key]) || [], apRef);
    const idx = list.findIndex((x: any) => x.uuid === itemUuid);
    if (idx > -1) {
      list[idx] = { ...list[idx], ...updates };
    }
  });
}

export function replaceAssessmentPlan(newAP: any): DocumentAction {
  return createAction('assessment-plan', 'REPLACE_AP', 'Replace entire Assessment Plan document', (draft: any) => {
    if (draft['assessment-plan']) {
      draft['assessment-plan'] = newAP;
    } else {
      Object.assign(draft, newAP);
    }
  });
}

/**
 * Pure Immer-based reducer function for Assessment Plan documents.
 * Dispatches the given action against the document draft, returning a new immutable AssessmentPlan.
 */
export function assessmentPlanReducer(doc: AssessmentPlan, action: DocumentAction): AssessmentPlan {
  return produce(doc, (draft: any) => {
    action.apply(draft);
  });
}
