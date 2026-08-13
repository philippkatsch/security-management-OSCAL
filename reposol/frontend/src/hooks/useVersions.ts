import { useState, useCallback } from 'react';
import { produce, Draft } from 'immer';
import { getVersion } from '@lib/api';
import { useVersionsQuery, useSaveVersionMutation, useDeleteVersionMutation } from './useDocumentQuery';
import { OscalDocument, OscalStage } from '@lib/types/oscal';
import { VersionInfo } from '@lib/types/api';

/** Maps stage names to their OSCAL document root keys (mirrors backend STAGE_ROOT_KEYS). */
const STAGE_ROOT_KEYS: Record<string, keyof OscalDocument> = {
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
 * Hook for managing document versions using React Query.
 */
export function useVersions(stage: OscalStage, documentId: string) {
  const versionsQuery = useVersionsQuery(stage, documentId);
  const saveMutation = useSaveVersionMutation(stage, documentId);
  const deleteMutation = useDeleteVersionMutation(stage, documentId);

  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);
  const [showDrawer, setShowDrawer] = useState<boolean>(false);

  const versions: VersionInfo[] = versionsQuery.data || [];

  const loadVersions = useCallback(async () => {
    const res = await versionsQuery.refetch();
    return res.data || [];
  }, [versionsQuery]);

  const save = useCallback(async (versionNumber: string, document: OscalDocument, remarks?: string) => {
    const rootKey = STAGE_ROOT_KEYS[stage] || stage.replace(/s$/, '') as keyof OscalDocument;
    const docWithVersion = produce(document, (draft: Draft<OscalDocument>) => {
      const root = draft[rootKey] as Record<string, unknown>;
      if (root?.metadata) {
        root.metadata.version = versionNumber;
      }
    });
    return await saveMutation.mutateAsync({
      version: versionNumber,
      document: docWithVersion,
      remarks,
      isDraft: false
    });
  }, [stage, saveMutation]);

  const saveDraft = useCallback(async (document: OscalDocument) => {
    const rootKey = STAGE_ROOT_KEYS[stage] || stage.replace(/s$/, '') as keyof OscalDocument;
    const rootDoc = document[rootKey] as Record<string, unknown>;
    let version = rootDoc?.metadata?.version || '1.0.0';
    const cleanVersion = version.replace(/-draft$/, '');
    const draftVersion = `${cleanVersion}-draft`;

    const docWithVersion = produce(document, (draft: Draft<OscalDocument>) => {
      const root = draft[rootKey] as Record<string, unknown>;
      if (root?.metadata) {
        root.metadata.version = draftVersion;
      }
    });

    return await saveMutation.mutateAsync({
      version: draftVersion,
      document: docWithVersion,
      remarks: 'Temporary Draft',
      isDraft: true
    });
  }, [stage, saveMutation]);

  const remove = useCallback(async (version: string) => {
    return await deleteMutation.mutateAsync(version);
  }, [deleteMutation]);

  const switchTo = useCallback(async (version: string) => {
    const data = await getVersion(stage, documentId, version);
    setSelectedVersion(version);
    return data;
  }, [stage, documentId]);

  const currentVersion = versions.find((v: VersionInfo) => v.is_active)?.version || null;

  return {
    versions,
    loading: versionsQuery.isLoading,
    showDrawer,
    setShowDrawer,
    selectedVersion,
    setSelectedVersion,
    currentVersion,
    save,
    saveDraft,
    remove,
    switchTo,
    reload: loadVersions
  };
}
