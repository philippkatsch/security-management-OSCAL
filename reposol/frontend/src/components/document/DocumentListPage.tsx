import React, { useState } from 'react';
import styles from '../layout/DocumentPageLayout.module.css';
import sharedStyles from '@components/shared/SharedComponents.module.css';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authFetch, getWorkspaceId } from '@lib/api';
import ImportWizard from './ImportWizard';
import { CreateDocumentDialog } from './CreateDocumentDialog';
import { useConfirm } from '@hooks/useConfirm';
import { ExportModal } from '@components/shared/ui/ExportModal';
import { TableSkeleton } from '@components/shared/ui/LoadingSpinner';
import { StageHelpModal } from '@components/shared/ui/StageHelpModal';
import { toast } from 'react-hot-toast';

const ROOT_KEYS: Record<string, string> = {
  catalogs: 'catalog',
  profiles: 'profile',
  ssps: 'system-security-plan',
  'component-definitions': 'component-definition',
  'assessment-plans': 'assessment-plan',
  'assessment-results': 'assessment-results',
  poams: 'plan-of-action-and-milestones',
  'control-mappings': 'mapping-collection',
};

const STAGE_LABELS: Record<string, string> = {
  catalogs: 'Catalogs',
  profiles: 'Profiles',
  ssps: 'System Security Plans',
  'component-definitions': 'Component Definitions',
  'assessment-plans': 'Assessment Plans',
  'assessment-results': 'Assessment Results',
  poams: 'POA&Ms',
  'control-mappings': 'Control Mappings',
};

const STAGE_ICONS: Record<string, string> = {
  catalogs: '📖',
  profiles: '⚙️',
  ssps: '📝',
  'component-definitions': '🧱',
  'assessment-plans': '📅',
  'assessment-results': '✅',
  poams: '⚠️',
  'control-mappings': '🔗',
};

const UNDER_DEV_STAGES = ['component-definitions', 'control-mappings', 'ssps', 'assessment-plans', 'assessment-results', 'poams'];

export const DocumentListPage = () => {
  const { stage } = useParams<{ stage: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { confirm } = useConfirm();

  const [searchQuery, setSearchQuery] = useState('');
  const [showEditor, setShowEditor] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [exportDoc, setExportDoc] = useState<{ id: string; title: string } | null>(null);

  const safeStage = stage || 'catalogs';
  const rootKey = ROOT_KEYS[safeStage];
  const label = STAGE_LABELS[safeStage] || safeStage;
  const isUnderDev = UNDER_DEV_STAGES.includes(safeStage);

  const fetchDocuments = async () => {
    const response = await authFetch(`/api/documents/${safeStage}`);
    if (!response.ok) throw new Error(`Error fetching ${safeStage}: ${response.statusText}`);
    return await response.json();
  };

  const { data: documents = [], isLoading: loading, error } = useQuery({
    queryKey: ['documents', safeStage],
    queryFn: fetchDocuments,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      try {
        await authFetch(`/api/documents/${safeStage}/${id}`, { method: 'DELETE' });
      } catch (err: any) {
        if (err?.status === 409 || (err?.name === 'ApiError' && err?.status === 409)) {
          const detail = err.message || '';
          const promptMsg = detail
            ? `${detail}\n\nDocument is referenced by other documents. Force delete?`
            : `Document is referenced by other documents. Force delete?`;
          const forceDelete = await confirm({
            title: 'Reference Conflict (409)',
            message: promptMsg,
            confirmLabel: 'Force Delete',
            cancelLabel: 'Cancel',
            variant: 'danger',
          });
          if (forceDelete) {
            await authFetch(`/api/documents/${safeStage}/${id}?force=true`, { method: 'DELETE' });
            return;
          }
          return;
        }
        throw err;
      }
    },
    onSuccess: () => {
      toast.success('Document deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['documents', safeStage] });
      queryClient.invalidateQueries({ queryKey: ['document-counts'] });
    },
    onError: (err: Error) => {
      if (err) {
        toast.error(`Error deleting document: ${err.message}`);
      }
    }
  });

  const handleDelete = async (id: string, title?: string) => {
    const confirmed = await confirm({
      title: 'Delete Document',
      message: title ? `Delete this document? Are you sure you want to delete "${title}"?` : 'Delete this document?',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      variant: 'danger',
    });
    if (confirmed) {
      deleteMutation.mutate(id);
    }
  };

  const handleExport = (id: string, title?: string) => {
    setExportDoc({ id, title: title || '' });
  };

  const navigateWithWs = (path: string) => {
    const wsId = getWorkspaceId();
    const sep = path.includes('?') ? '&' : '?';
    const target = wsId ? `${path}${sep}w=${wsId}` : path;
    navigate(target);
  };

  const handleSaved = (savedDoc: any) => {
    setShowEditor(false);
    queryClient.invalidateQueries({ queryKey: ['documents', safeStage] });
    queryClient.invalidateQueries({ queryKey: ['document-counts'] });

    if (savedDoc) {
      const docData = savedDoc[rootKey];
      if (docData && docData.uuid) {
        const viewParam = safeStage === 'profiles' ? '&view=imports' : '';
        navigateWithWs(`/${safeStage}/${docData.uuid}?edit=true${viewParam}`);
      }
    }
  };

  const filteredDocs = searchQuery.trim()
    ? documents.filter((doc: any) => {
        const data = doc[rootKey] || doc['control-mapping'] || doc['control-mappings'] || doc['mapping-collection'];
        if (!data) return false;
        const title = (data.metadata?.title || '').toLowerCase();
        const uuid = (data.uuid || '').toLowerCase();
        const q = searchQuery.toLowerCase();
        return title.includes(q) || uuid.includes(q);
      })
    : documents;

  return (
    <div className={styles['stage-view']}>
      <div className={styles['stage-header']}>
        <div>
          <h2>
            <span className={styles['stage-icon']}>{STAGE_ICONS[safeStage] || '📄'}</span>
            {label}
            {isUnderDev && <span className={styles['stage-dev-badge']} title="Under Active Development">🚧 Under Development</span>}
          </h2>
          <span className={styles['stage-meta']}>Manage OSCAL {label} documents.</span>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            type="button"
            className={sharedStyles['btn-secondary']}
            onClick={() => setShowHelp(true)}
            data-testid="stage-help-btn"
            title={`View ${label} guide & documentation`}
          >
            💡 Guide
          </button>
          <button className={sharedStyles['btn-secondary']} onClick={() => setShowImport(true)}>
            📥 Import {label.replace(/s$/, '')}
          </button>
          <button className={sharedStyles['btn-primary']} onClick={() => setShowEditor(true)}>
            + New {label.replace(/s$/, '')}
          </button>
        </div>
      </div>

      {isUnderDev && (
        <div className={styles['under-dev-banner']}>
          <span className={styles['under-dev-icon']}>🚧</span>
          <div className="under-dev-text">
            <strong>Stage Under Active Development:</strong> A specialized visual editor for {label} is currently in progress. Document creation, import/export, raw JSON editing, and schema validation are active and functional.
          </div>
        </div>
      )}

      {error && <div className={sharedStyles['error-message']}>⚠️ {(error as Error).message}</div>}

      {loading ? (
        <TableSkeleton rows={5} />
      ) : documents.length === 0 ? (
        <div className={sharedStyles['empty-state']}>
          <div className={sharedStyles['empty-icon']}>{STAGE_ICONS[safeStage] || '📄'}</div>
          <h3>No documents yet</h3>
          <p>Create your first {label.replace(/s$/, '')} document or import an existing one to get started.</p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '15px' }}>
            <button className={sharedStyles['btn-secondary']} onClick={() => setShowImport(true)}>
              📥 Import {label.replace(/s$/, '')}
            </button>
            <button className={sharedStyles['btn-primary']} onClick={() => setShowEditor(true)}>
              + New {label.replace(/s$/, '')}
            </button>
          </div>
        </div>
      ) : (
        <div className={sharedStyles['documents-section']}>
          <div className={sharedStyles['search-bar-container']}>
            <div className={sharedStyles['search-input-wrapper']}>
              <input
                type="text"
                className={sharedStyles['search-input']}
                placeholder={`Search ${label.toLowerCase()} by title or UUID…`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button className={sharedStyles['search-clear-btn']} onClick={() => setSearchQuery('')}>✕</button>
              )}
            </div>
            <span className={sharedStyles['search-results-count']}>{filteredDocs.length} of {documents.length}</span>
          </div>

          <table className={sharedStyles['documents-table']}>
            <thead>
              <tr>
                <th>UUID</th>
                <th>Title</th>
                <th>Version</th>
                <th>OSCAL Version</th>
                <th>Last Modified</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDocs.map((doc: any) => {
                const data = doc[rootKey] || doc['control-mapping'] || doc['control-mappings'] || doc['mapping-collection'];
                if (!data) return null;
                const lastMod = data.metadata?.['last-modified'];
                return (
                  <tr key={data.uuid}>
                    <td className={sharedStyles['uuid-cell']} title={data.uuid}>
                      {data.uuid.substring(0, 8)}…
                    </td>
                    <td className={sharedStyles['title-cell']}>
                      <span
                        className={sharedStyles['clickable-title']}
                        onClick={() => navigateWithWs(`/${safeStage}/${data.uuid}`)}
                        title="View document"
                      >
                        {data.metadata?.title || 'Untitled'}
                      </span>
                    </td>
                    <td>{data.metadata?.version || '—'}</td>
                    <td>{data.metadata?.['oscal-version'] || '—'}</td>
                    <td className={sharedStyles['date-cell']}>
                      {lastMod ? new Date(lastMod).toLocaleDateString() : '—'}
                    </td>
                    <td className={sharedStyles['actions-cell']}>
                      <div className={sharedStyles['action-buttons-row']}>
                        <button
                          className={[sharedStyles['btn-action'], sharedStyles['btn-view']].filter(Boolean).join(' ')}
                          onClick={() => navigateWithWs(`/${safeStage}/${data.uuid}`)}
                          title="View document"
                        >
                          👁
                        </button>
                        <button
                          className={[sharedStyles['btn-action'], sharedStyles['btn-edit']].filter(Boolean).join(' ')}
                          onClick={() => navigateWithWs(`/${safeStage}/${data.uuid}?edit=true`)}
                          title="Edit document"
                        >
                          ✏️
                        </button>
                        <button
                          className={[sharedStyles['btn-action'], sharedStyles['btn-export']].filter(Boolean).join(' ')}
                          onClick={() => handleExport(data.uuid, data.metadata?.title)}
                          title="Export document"
                          data-testid="export-btn"
                        >
                          📥
                        </button>
                        <button
                          className={[sharedStyles['btn-action'], sharedStyles['btn-delete']].filter(Boolean).join(' ')}
                          onClick={() => handleDelete(data.uuid, data.metadata?.title)}
                          title="Delete document"
                        >
                          🗑
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showEditor && (
        <CreateDocumentDialog
          stage={safeStage}
          onSaved={handleSaved}
          onCancel={() => setShowEditor(false)}
        />
      )}

      {showImport && (
        <ImportWizard
          stage={safeStage}
          onImported={() => {
            queryClient.invalidateQueries({ queryKey: ['documents', safeStage] });
            queryClient.invalidateQueries({ queryKey: ['document-counts'] });
          }}
          onClose={() => setShowImport(false)}
        />
      )}

      {exportDoc && (
        <ExportModal
          isOpen={Boolean(exportDoc)}
          docId={exportDoc.id}
          docTitle={exportDoc.title}
          stage={safeStage}
          onClose={() => setExportDoc(null)}
        />
      )}

      {showHelp && (
        <StageHelpModal
          isOpen={showHelp}
          stage={safeStage}
          onClose={() => setShowHelp(false)}
        />
      )}
    </div>
  );
};
