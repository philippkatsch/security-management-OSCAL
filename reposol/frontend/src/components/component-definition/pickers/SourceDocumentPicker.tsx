import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@lib/api-client';
import sharedStyles from '@components/shared/SharedComponents.module.css';

export interface SourceDocumentPickerProps {
  value: string;
  onChange: (source: string) => void;
  disabled?: boolean;
}

interface WorkspaceDoc {
  stage: 'catalogs' | 'profiles';
  uuid: string;
  title: string;
  version?: string;
  lastModified?: string;
  oscalVersion?: string;
}

export const SourceDocumentPicker: React.FC<SourceDocumentPickerProps> = ({
  value = '',
  onChange,
  disabled = false
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'all' | 'catalogs' | 'profiles' | 'custom'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [customUriInput, setCustomUriInput] = useState(value);

  // 1. Fetch Catalogs and Profiles from Workspace
  const { data: catalogs = [], isLoading: loadingCatalogs } = useQuery<WorkspaceDoc[]>({
    queryKey: ['documents', 'catalogs'],
    queryFn: async () => {
      const res = await apiClient('/documents/catalogs');
      const data = await res.json();
      return (data || []).map((item: any) => {
        const cat = item.catalog || item;
        return {
          stage: 'catalogs',
          uuid: cat.uuid || cat.id,
          title: cat.metadata?.title || item.title || 'Untitled Catalog',
          version: cat.metadata?.version || item.version,
          lastModified: cat.metadata?.['last-modified'] || item.last_modified,
          oscalVersion: cat.metadata?.['oscal-version'] || item.oscal_version
        };
      });
    },
    enabled: isModalOpen
  });

  const { data: profiles = [], isLoading: loadingProfiles } = useQuery<WorkspaceDoc[]>({
    queryKey: ['documents', 'profiles'],
    queryFn: async () => {
      const res = await apiClient('/documents/profiles');
      const data = await res.json();
      return (data || []).map((item: any) => {
        const prof = item.profile || item;
        return {
          stage: 'profiles',
          uuid: prof.uuid || prof.id,
          title: prof.metadata?.title || item.title || 'Untitled Profile',
          version: prof.metadata?.version || item.version,
          lastModified: prof.metadata?.['last-modified'] || item.last_modified,
          oscalVersion: prof.metadata?.['oscal-version'] || item.oscal_version
        };
      });
    },
    enabled: isModalOpen
  });

  const allDocs = useMemo(() => [...catalogs, ...profiles], [catalogs, profiles]);

  const filteredDocs = useMemo(() => {
    let list = allDocs;
    if (selectedTab === 'catalogs') list = catalogs;
    if (selectedTab === 'profiles') list = profiles;

    const query = searchQuery.trim().toLowerCase();
    if (!query) return list;

    return list.filter(d => 
      d.title.toLowerCase().includes(query) ||
      d.uuid.toLowerCase().includes(query) ||
      (d.version && d.version.toLowerCase().includes(query))
    );
  }, [allDocs, catalogs, profiles, selectedTab, searchQuery]);

  const handleSelectDoc = (doc: WorkspaceDoc) => {
    // Generate standard workspace relative URI reference
    const sourceUri = `${doc.stage}/${doc.uuid}`;
    onChange(sourceUri);
    setIsModalOpen(false);
  };

  const handleApplyCustomUri = () => {
    const trimmed = customUriInput.trim();
    if (trimmed) {
      onChange(trimmed);
      setIsModalOpen(false);
    }
  };

  const getSourceBadge = (src: string) => {
    if (!src) return null;
    if (src.startsWith('catalogs/') || src.includes('/catalogs/')) {
      return <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>📚 Catalog</span>;
    }
    if (src.startsWith('profiles/') || src.includes('/profiles/')) {
      return <span style={{ background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>🎯 Profile</span>;
    }
    return <span style={{ background: '#f3f4f6', color: '#4b5563', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>🔗 External URI</span>;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <input
          type="text"
          className="form-input"
          style={{ flex: 1, fontFamily: 'monospace', fontSize: '13px' }}
          placeholder="e.g. catalogs/uuid or profiles/uuid or https://..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        />
        {!disabled && (
          <button
            type="button"
            className={['btn', sharedStyles['btn-secondary'], sharedStyles['btn-sm']].filter(Boolean).join(' ')}
            onClick={() => {
              setCustomUriInput(value);
              setIsModalOpen(true);
            }}
            title="Browse workspace catalogs and profiles"
          >
            🔍 Browse...
          </button>
        )}
      </div>

      {value && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--color-text-muted, #6b7280)' }}>
          {getSourceBadge(value)}
          <span>Active reference: <code>{value}</code></span>
        </div>
      )}

      {/* Workspace Document Browser Modal */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1050,
            padding: '16px'
          }}
          onClick={() => setIsModalOpen(false)}
        >
          <div
            style={{
              background: 'var(--color-surface, #ffffff)',
              borderRadius: '8px',
              border: '1px solid var(--color-border, #e5e7eb)',
              width: '100%',
              maxWidth: '680px',
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              overflow: 'hidden'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border, #e5e7eb)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: 'var(--color-text, #111827)' }}>
                  Select Framework Source Document
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--color-text-muted, #6b7280)' }}>
                  Choose a Catalog or Profile from the workspace, or enter an external URI reference.
                </p>
              </div>
              <button
                type="button"
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: 'var(--color-text-muted, #6b7280)' }}
                onClick={() => setIsModalOpen(false)}
              >
                ✕
              </button>
            </div>

            {/* Navigation Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border, #e5e7eb)', background: 'var(--surface-alt, #f9fafb)', padding: '0 16px' }}>
              {[
                { id: 'all', label: `All (${allDocs.length})` },
                { id: 'catalogs', label: `📚 Catalogs (${catalogs.length})` },
                { id: 'profiles', label: `🎯 Profiles (${profiles.length})` },
                { id: 'custom', label: '🔗 Custom URI' }
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  style={{
                    padding: '10px 16px',
                    border: 'none',
                    background: 'transparent',
                    borderBottom: selectedTab === tab.id ? '2px solid var(--color-accent, #3b82f6)' : '2px solid transparent',
                    fontWeight: selectedTab === tab.id ? 600 : 400,
                    color: selectedTab === tab.id ? 'var(--color-accent, #3b82f6)' : 'var(--color-text-muted, #6b7280)',
                    cursor: 'pointer',
                    fontSize: '13px'
                  }}
                  onClick={() => setSelectedTab(tab.id as any)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Modal Body */}
            <div style={{ padding: '16px 20px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {selectedTab !== 'custom' ? (
                <>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Search documents by title, UUID or version..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoFocus
                  />

                  {(loadingCatalogs || loadingProfiles) ? (
                    <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-muted, #6b7280)' }}>
                      Loading workspace documents...
                    </div>
                  ) : filteredDocs.length === 0 ? (
                    <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-muted, #6b7280)' }}>
                      No documents found in workspace.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {filteredDocs.map(doc => {
                        const isCurrent = value === `${doc.stage}/${doc.uuid}`;
                        return (
                          <div
                            key={doc.uuid}
                            style={{
                              padding: '12px 16px',
                              borderRadius: '6px',
                              border: isCurrent ? '2px solid var(--color-accent, #3b82f6)' : '1px solid var(--color-border, #e5e7eb)',
                              background: isCurrent ? 'rgba(59, 130, 246, 0.05)' : 'var(--color-surface, #ffffff)',
                              cursor: 'pointer',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              transition: 'all 0.15s ease'
                            }}
                            onClick={() => handleSelectDoc(doc)}
                          >
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--color-text, #111827)' }}>
                                  {doc.title}
                                </span>
                                {getSourceBadge(`${doc.stage}/${doc.uuid}`)}
                              </div>
                              <span style={{ fontSize: '12px', fontFamily: 'monospace', color: 'var(--color-text-muted, #6b7280)' }}>
                                UUID: {doc.uuid} {doc.version ? `| v${doc.version}` : ''}
                              </span>
                            </div>

                            <button
                              type="button"
                              className={['btn', isCurrent ? sharedStyles['btn-primary'] : sharedStyles['btn-secondary'], sharedStyles['btn-sm']].filter(Boolean).join(' ')}
                            >
                              {isCurrent ? 'Selected' : 'Select'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <label className="form-label" style={{ fontSize: '13px', fontWeight: 500 }}>
                    Custom URI Reference or External Catalog URL
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="https://raw.githubusercontent.com/usnistgov/oscal-content/master/nist.gov/SP800-53/rev5/json/NIST_SP-800-53_rev5_catalog.json"
                    value={customUriInput}
                    onChange={(e) => setCustomUriInput(e.target.value)}
                  />
                  <span style={{ fontSize: '12px', color: 'var(--color-text-muted, #6b7280)' }}>
                    Enter any valid URI reference, external URL, or relative resource fragment identifier.
                  </span>
                  <button
                    type="button"
                    className={['btn', sharedStyles['btn-primary'], sharedStyles['btn-sm']].filter(Boolean).join(' ')}
                    style={{ alignSelf: 'flex-start', marginTop: '8px' }}
                    onClick={handleApplyCustomUri}
                  >
                    Apply Custom URI
                  </button>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--color-border, #e5e7eb)', display: 'flex', justifyContent: 'flex-end', gap: '8px', background: 'var(--surface-alt, #f9fafb)' }}>
              <button
                type="button"
                className={['btn', sharedStyles['btn-secondary'], sharedStyles['btn-sm']].filter(Boolean).join(' ')}
                onClick={() => setIsModalOpen(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SourceDocumentPicker;
