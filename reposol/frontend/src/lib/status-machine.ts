export type OscalDocumentStatus = 
  | 'draft' 
  | 'active' 
  | 'revision' 
  | 'archived' 
  | 'superseded' 
  | 'withdrawn'
  | 'open'
  | 'investigating'
  | 'remediating'
  | 'deviation-requested'
  | 'deviation-approved'
  | 'closed'
  | 'recommendation'
  | 'planned'
  | 'completed';

const TRANSITIONS: Partial<Record<OscalDocumentStatus, OscalDocumentStatus[]>> = {
  'draft': ['active', 'archived'],
  'active': ['archived', 'superseded'],
  'archived': ['active'],
  'superseded': [],
  'open': ['investigating'],
  'investigating': ['remediating'],
  'remediating': ['deviation-requested', 'closed'],
  'deviation-requested': ['deviation-approved', 'closed'],
  'deviation-approved': ['closed'],
  'closed': ['open'],
  'recommendation': ['planned'],
  'planned': ['completed'],
  'completed': []
};

const NS = 'https://reposol.dev/ns';

export function getValidTransitions(currentState: OscalDocumentStatus): OscalDocumentStatus[] {
  return TRANSITIONS[currentState] || [];
}

export function isValidTransition(from: OscalDocumentStatus, to: OscalDocumentStatus): boolean {
  return getValidTransitions(from).includes(to);
}

export function isEditable(state: OscalDocumentStatus): boolean {
  return state === 'draft' || state === 'active';
}

export function isTerminal(state: OscalDocumentStatus): boolean {
  return state === 'superseded';
}

export function requiresVersionBump(state: OscalDocumentStatus): boolean {
  return state === 'active';
}

export function requiresSuccessor(to: OscalDocumentStatus): boolean {
  return to === 'superseded';
}

export function getEditabilityInfo(state: OscalDocumentStatus): { editable: boolean; reason: string | null; banner: Record<string, unknown> | null } {
  if (state === 'archived') {
    return {
      editable: false,
      reason: 'archived',
      banner: {
        type: 'warning',
        message: 'This document is archived and read-only. Create a new version to make changes.',
        action: 'Reactivate'
      }
    };
  }
  if (state === 'superseded') {
    return {
      editable: false,
      reason: 'superseded',
      banner: {
        type: 'info',
        message: 'This document has been superseded.',
        action: 'View successor'
      }
    };
  }
  return {
    editable: true,
    reason: null,
    banner: null
  };
}

export function createRevisionEntry(fromState: OscalDocumentStatus, toState: OscalDocumentStatus, version: string, remarks?: string): Record<string, unknown> {
  const defaultRemark = `Lifecycle status changed from ${fromState} to ${toState}.`;
  return {
    title: `Status changed to ${toState}`,
    published: new Date().toISOString(),
    version: version || '1.0.0',
    remarks: remarks || defaultRemark
  };
}

export function getDocumentStatus(document: Record<string, unknown>): OscalDocumentStatus {
  if (!document) return 'draft';

  const rootKey = Object.keys(document).find(k => k !== 'metadata' && typeof (document as any)[k] === 'object' && (document as any)[k] !== null);
  const rootData = rootKey ? (document[rootKey] as any) : document;
  const metadata = (document as any).metadata || rootData?.metadata;

  if (!metadata || !Array.isArray(metadata.props)) {
    return ((document as any).status || rootData?.status || 'draft') as OscalDocumentStatus;
  }

  const prop = metadata.props.find(
    (p: Record<string, unknown>) => (p.name === 'document-status' || p.name === 'status' || p.name === 'state')
  );

  return (prop ? prop.value : ((document as any).status || rootData?.status || 'draft')) as OscalDocumentStatus;
}

export function setDocumentStatus(document: Record<string, unknown>, newStatus: OscalDocumentStatus, successorUuid?: string): Record<string, unknown> {
  const newDoc = { ...document };

  const rootKey = Object.keys(newDoc).find(k => k !== 'metadata' && typeof (newDoc as any)[k] === 'object' && (newDoc as any)[k] !== null);
  const target = rootKey ? { ...(newDoc as any)[rootKey] } : newDoc;

  if (!target.metadata) {
    target.metadata = {};
  }

  const props = Array.isArray(target.metadata.props) ? [...target.metadata.props] : [];

  const filteredProps = props.filter(
    (p: Record<string, unknown>) => !(p.name === 'document-status' || p.name === 'status' || p.name === 'superseded-by')
  );

  filteredProps.push({
    name: 'document-status',
    value: newStatus,
    ns: NS
  });

  if (newStatus === 'superseded' && successorUuid) {
    filteredProps.push({
      name: 'superseded-by',
      value: successorUuid,
      ns: NS
    });
  }

  target.metadata = {
    ...target.metadata,
    props: filteredProps
  };

  if (rootKey) {
    (newDoc as any)[rootKey] = target;
  }

  return newDoc;
}

export function getEditableFields(docType: string, status: OscalDocumentStatus): string[] {
  if (status === 'archived' || status === 'superseded') {
    return [];
  }
  
  if (status === 'draft') {
    return ['all'];
  }
  
  if (status === 'active') {
    return ['status', 'remarks'];
  }
  
  return ['all'];
}
