import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '@lib/api';
import { OscalStage, OscalDocument } from '@lib/types/oscal';
import { DocumentSummary, ValidationResult, VersionInfo } from '@lib/types/api';

export function useDocumentQuery(stage: OscalStage, docId: string) {
  return useQuery<OscalDocument>({
    queryKey: ['document', stage, docId],
    queryFn: () => api.fetchDocument(stage, docId),
    enabled: !!stage && !!docId,
  });
}

export function useDocumentListQuery(stage: OscalStage) {
  return useQuery<DocumentSummary[]>({
    queryKey: ['documents', stage],
    queryFn: () => api.fetchDocuments(stage),
    enabled: !!stage,
  });
}

export function useDocumentMutation(stage: OscalStage) {
  const queryClient = useQueryClient();
  return useMutation<OscalDocument, unknown, { docId: string; data: OscalDocument }>({
    mutationFn: ({ docId: _docId, data }: { docId: string; data: OscalDocument }): Promise<OscalDocument> =>
      api.saveDocument(stage, data),
    onSuccess: (_, { docId }) => {
      if (docId) {
        queryClient.invalidateQueries({ queryKey: ['document', stage, docId] });
      }
      queryClient.invalidateQueries({ queryKey: ['documents', stage] });
    },
  });
}

export function useDocumentDeleteMutation(stage: OscalStage) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ docId, force }: { docId: string; force?: boolean }): Promise<void> =>
      api.deleteDocument(stage, docId, force),
    onSuccess: (_, { docId }) => {
      if (docId) {
        queryClient.invalidateQueries({ queryKey: ['document', stage, docId] });
      }
      queryClient.invalidateQueries({ queryKey: ['documents', stage] });
    },
  });
}

export function useDocumentValidationMutation(stage: OscalStage) {
  return useMutation({
    mutationFn: (document: OscalDocument): Promise<ValidationResult> => api.validateDocument(stage, document),
  });
}

export function useVersionsQuery(stage: OscalStage, docId: string) {
  return useQuery<VersionInfo[]>({
    queryKey: ['versions', stage, docId],
    queryFn: () => api.fetchVersions(stage, docId),
    enabled: !!stage && !!docId,
  });
}

export function useSaveVersionMutation(stage: OscalStage, docId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ version, document, remarks, isDraft }: { version: string; document: OscalDocument; remarks?: string; isDraft?: boolean }): Promise<void> =>
      api.saveVersion(stage, docId, version, document, remarks, isDraft),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['versions', stage, docId] });
      queryClient.invalidateQueries({ queryKey: ['document', stage, docId] });
    },
  });
}

export function useDeleteVersionMutation(stage: OscalStage, docId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (version: string): Promise<void> => api.deleteVersion(stage, docId, version),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['versions', stage, docId] });
      queryClient.invalidateQueries({ queryKey: ['document', stage, docId] });
    },
  });
}

export function useTraceabilityQuery(searchControlId: string) {
  return useQuery({
    queryKey: ['traceability', searchControlId],
    queryFn: async () => {
      const stages: { key: OscalStage; root: string; name: string }[] = [
        { key: 'catalog', root: 'catalog', name: 'Catalog' },
        { key: 'profile', root: 'profile', name: 'Profile' },
        { key: 'component-definition', root: 'component-definition', name: 'Component' },
        { key: 'ssp', root: 'system-security-plan', name: 'SSP' },
        { key: 'assessment-plan', root: 'assessment-plan', name: 'AP' },
        { key: 'assessment-results', root: 'assessment-results', name: 'AR' },
        { key: 'poam', root: 'plan-of-action-and-milestones', name: 'POAM' }
      ];

      const foundItems: Array<{ stageName: string; stageKey: string; title: string; uuid: string }> = [];
      const lowerCtrlId = searchControlId.trim().toLowerCase();
      if (!lowerCtrlId) return [];

      await Promise.all(stages.map(async (stage) => {
        try {
          const summaries = await api.fetchDocuments(stage.key);
          await Promise.all(summaries.map(async (item: any) => {
            try {
              const inner = item[stage.root] || item;
              const uuid = inner.uuid || item.uuid || inner.id;
              if (!uuid) return;
              const fullDoc = await api.fetchDocument(stage.key, uuid);
              if (!fullDoc) return;
              const strData = JSON.stringify(fullDoc).toLowerCase();
              if (strData.includes(`"${lowerCtrlId}"`) || strData.includes(`:${lowerCtrlId}`) || strData.includes(lowerCtrlId)) {
                const fullInner = (fullDoc as any)[stage.root] || fullDoc;
                foundItems.push({
                  stageName: stage.name,
                  stageKey: stage.key === 'catalog' ? 'catalogs' : stage.key === 'profile' ? 'profiles' : stage.key,
                  title: fullInner.metadata?.title || inner.metadata?.title || 'Untitled',
                  uuid: uuid
                });
              }
            } catch (err) {
              // Ignore single doc fetch failure
            }
          }));
        } catch (e) {
          console.error('Error searching stage', stage.key, e);
        }
      }));

      return foundItems;
    },
    enabled: !!searchControlId && searchControlId.trim().length > 0,
  });
}

export function useImportARFindingsMutation(poamId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ arId, findingUuids }: { arId: string; findingUuids?: string[] }) =>
      api.importARFindings(poamId, arId, findingUuids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document', 'poam', poamId] });
      queryClient.invalidateQueries({ queryKey: ['documents', 'poam'] });
    },
  });
}

