import { useState, useEffect, useCallback } from 'react';
import { fetchVersions, saveVersion, deleteVersion, getVersion } from '../lib/api';

/** Maps stage names to their OSCAL document root keys (mirrors backend STAGE_ROOT_KEYS). */
const STAGE_ROOT_KEYS = {
  catalogs: 'catalog',
  profiles: 'profile',
  ssps: 'system-security-plan',
  'component-definitions': 'component-definition',
  'assessment-plans': 'assessment-plan',
  'assessment-results': 'assessment-results',
  poams: 'plan-of-action-and-milestones',
  'control-mappings': 'mapping-collection'
};

/**
 * Hook for managing document versions.
 * @param {string} stage
 * @param {string} documentId
 * @returns {object}
 */
export function useVersions(stage, documentId) {
  const [versions, setVersions] = useState([]);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);

  const loadVersions = useCallback(async () => {
    if (!documentId) return;
    setLoading(true);
    try {
      const data = await fetchVersions(stage, documentId);
      setVersions(data);
    } catch (err) {
      console.error('Failed to load versions:', err);
    } finally {
      setLoading(false);
    }
  }, [stage, documentId]);

  useEffect(() => { loadVersions(); }, [loadVersions]);

  const save = useCallback(async (versionNumber, document, remarks) => {
    // Look up root key from the mapping
    const rootKey = STAGE_ROOT_KEYS[stage] || stage.replace(/s$/, '');
    
    // Deep clone document to avoid mutating caller's state
    const docWithVersion = JSON.parse(JSON.stringify(document));
    
    // Inject the user-entered version number into the document metadata
    // (US 0.P2: metadata.version must match the entered version)
    if (docWithVersion[rootKey]?.metadata) {
      docWithVersion[rootKey].metadata.version = versionNumber;
    }
    
    const result = await saveVersion(stage, documentId, versionNumber, docWithVersion, remarks);
    await loadVersions();
    return result;
  }, [stage, documentId, loadVersions]);

  const saveDraft = useCallback(async (document) => {
    // Look up root key from the mapping
    const rootKey = STAGE_ROOT_KEYS[stage] || stage.replace(/s$/, '');
    
    // Deep clone document to avoid mutating caller's state
    const docWithVersion = JSON.parse(JSON.stringify(document));
    
    let version = docWithVersion[rootKey]?.metadata?.version || '1.0.0';
    // Remove existing draft suffix if present before formatting to avoid doubling it
    const cleanVersion = version.replace(/-draft$/, '');
    const draftVersion = `${cleanVersion}-draft`;
    
    if (docWithVersion[rootKey]?.metadata) {
      docWithVersion[rootKey].metadata.version = draftVersion;
    }
    
    const result = await saveVersion(stage, documentId, draftVersion, docWithVersion, 'Temporary Draft', true);
    await loadVersions();
    return result;
  }, [stage, documentId, loadVersions]);

  const remove = useCallback(async (version) => {
    await deleteVersion(stage, documentId, version);
    await loadVersions();
  }, [stage, documentId, loadVersions]);

  const switchTo = useCallback(async (version) => {
    const data = await getVersion(stage, documentId, version);
    setSelectedVersion(version);
    return data;
  }, [stage, documentId]);

  const currentVersion = versions.find(v => v.is_active)?.version || null;

  return {
    versions, loading, showDrawer, setShowDrawer,
    selectedVersion, setSelectedVersion,
    currentVersion, save, saveDraft, remove, switchTo, reload: loadVersions
  };
}
