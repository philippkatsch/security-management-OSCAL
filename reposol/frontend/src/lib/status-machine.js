/**
 * @fileoverview Document lifecycle state management utilities.
 * Handles transitions between 'draft', 'active', 'archived', and 'superseded' states.
 */

const TRANSITIONS = {
  'draft': ['active', 'archived'],
  'active': ['archived', 'superseded'],
  'archived': ['active'],
  'superseded': [],  // terminal state
  // risk-status transitions
  'open': ['investigating'],
  'investigating': ['remediating'],
  'remediating': ['deviation-requested', 'closed'],
  'deviation-requested': ['deviation-approved', 'closed'],
  'deviation-approved': ['closed'],
  'closed': ['open'],
  // remediation-lifecycle transitions
  'recommendation': ['planned'],
  'planned': ['completed'],
  'completed': []
};

const NS = 'https://reposol.dev/ns';

/**
 * Returns an array of valid next states for a given state.
 * @param {string} currentState The current lifecycle state.
 * @returns {string[]} Array of valid next states.
 */
export function getValidTransitions(currentState) {
  return TRANSITIONS[currentState] || [];
}

/**
 * Checks if a transition from one state to another is valid.
 * @param {string} from The current state.
 * @param {string} to The desired next state.
 * @returns {boolean} True if the transition is valid, false otherwise.
 */
export function isValidTransition(from, to) {
  return getValidTransitions(from).includes(to);
}

/**
 * Checks if a document in the given state is editable.
 * @param {string} state The lifecycle state.
 * @returns {boolean} True if 'draft' or 'active'.
 */
export function isEditable(state) {
  return state === 'draft' || state === 'active';
}

/**
 * Checks if a state is terminal (no further transitions allowed).
 * @param {string} state The lifecycle state.
 * @returns {boolean} True if 'superseded'.
 */
export function isTerminal(state) {
  return state === 'superseded';
}

/**
 * Checks if modifying a document in this state requires a version bump.
 * @param {string} state The lifecycle state.
 * @returns {boolean} True if 'active'.
 */
export function requiresVersionBump(state) {
  return state === 'active';
}

/**
 * Checks if transitioning to a state requires a successor UUID.
 * @param {string} to The target state.
 * @returns {boolean} True if 'superseded'.
 */
export function requiresSuccessor(to) {
  return to === 'superseded';
}

/**
 * Gets editability information including UI banner hints for a given state.
 * @param {string} state The lifecycle state.
 * @returns {Object} Editability info object.
 */
export function getEditabilityInfo(state) {
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

/**
 * Creates an OSCAL revision entry for a state transition.
 * @param {string} fromState Previous state.
 * @param {string} toState New state.
 * @param {string} version Document version.
 * @param {string} remarks Optional remarks.
 * @returns {Object} OSCAL revision object.
 */
export function createRevisionEntry(fromState, toState, version, remarks) {
  const defaultRemark = `Lifecycle status changed from ${fromState} to ${toState}.`;
  return {
    title: `Status changed to ${toState}`,
    published: new Date().toISOString(),
    version: version || '1.0.0',
    remarks: remarks || defaultRemark
  };
}

/**
 * Extracts the lifecycle status from a document's metadata properties.
 * @param {Object} document The root OSCAL document object (e.g. catalog, profile).
 * @returns {string} The lifecycle state, defaults to 'draft'.
 */
export function getDocumentStatus(document) {
  if (!document || !document.metadata || !Array.isArray(document.metadata.props)) {
    return 'draft';
  }
  const prop = document.metadata.props.find(
    p => p.name === 'document-status' && p.ns === NS
  );
  return prop ? prop.value : 'draft';
}

/**
 * Sets the document status in the document's metadata properties.
 * returns a new document with updated metadata, without mutating the original.
 * @param {Object} document The root OSCAL document object.
 * @param {string} newStatus The new lifecycle state.
 * @param {string} [successorUuid] Optional successor UUID if superseded.
 * @returns {Object} New document object with updated status.
 */
export function setDocumentStatus(document, newStatus, successorUuid) {
  const newDoc = { ...document };
  
  if (!newDoc.metadata) {
    newDoc.metadata = {};
  }
  
  const props = Array.isArray(newDoc.metadata.props) ? [...newDoc.metadata.props] : [];
  
  // Remove existing status and superseded-by props
  const filteredProps = props.filter(
    p => !(p.ns === NS && (p.name === 'document-status' || p.name === 'superseded-by'))
  );
  
  // Add new status prop
  filteredProps.push({
    name: 'document-status',
    value: newStatus,
    ns: NS
  });
  
  // Add superseded-by prop if needed
  if (newStatus === 'superseded' && successorUuid) {
    filteredProps.push({
      name: 'superseded-by',
      value: successorUuid,
      ns: NS
    });
  }
  
  newDoc.metadata = {
    ...newDoc.metadata,
    props: filteredProps
  };
  
  return newDoc;
}

/**
 * Returns which fields are editable based on document lifecycle status and docType.
 * @param {string} docType The type of document (e.g. 'catalog', 'profile').
 * @param {string} status The current status.
 * @returns {string[]} Array of editable field names.
 */
export function getEditableFields(docType, status) {
  if (status === 'archived' || status === 'superseded') {
    return [];
  }
  
  if (status === 'draft') {
    return ['all']; // simplified, means all fields editable
  }
  
  // if active, maybe restrict some fields depending on docType
  if (status === 'active') {
    return ['status', 'remarks']; // only status and remarks can be changed without new version
  }
  
  return ['all'];
}
