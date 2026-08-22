import React, { useState, useMemo } from 'react';
import styles from './ProfileBaselineDiffView.module.css';
import { useProfileDiffQuery } from '../../hooks/useProfileResolution';

export interface ProfileBaselineDiffViewProps {
  profileId: string;
  profileDoc: any;
  availableCatalogs?: any[];
}

export function ProfileBaselineDiffView({
  profileId,
  profileDoc,
  availableCatalogs = []
}: ProfileBaselineDiffViewProps) {
  // Extract catalog UUID from profile imports
  const importedCatalogId = useMemo(() => {
    const imports = profileDoc?.profile?.imports || profileDoc?.imports || [];
    if (imports.length > 0 && imports[0].href) {
      const href = imports[0].href;
      return href.replace('#', '');
    }
    return '';
  }, [profileDoc]);

  const [selectedCatalogId, setSelectedCatalogId] = useState<string>(importedCatalogId);
  const [activeFilter, setActiveFilter] = useState<'all' | 'added' | 'removed' | 'modified' | 'untouched'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Sync selected catalog if imported catalog updates
  React.useEffect(() => {
    if (importedCatalogId && !selectedCatalogId) {
      setSelectedCatalogId(importedCatalogId);
    }
  }, [importedCatalogId, selectedCatalogId]);

  const activeCatId = selectedCatalogId || importedCatalogId;

  const { data: diffData, isLoading, error } = useProfileDiffQuery(profileId, activeCatId);

  const summary = diffData?.summary || {
    added_count: 0,
    removed_count: 0,
    modified_count: 0,
    untouched_count: 0,
    total_baseline_controls: 0
  };

  const deltas = useMemo(() => diffData?.deltas || [], [diffData]);

  const filteredDeltas = useMemo(() => {
    return deltas.filter((delta: any) => {
      const matchesFilter = activeFilter === 'all' || delta.status === activeFilter;
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        !term ||
        (delta.id && delta.id.toLowerCase().includes(term)) ||
        (delta.title && delta.title.toLowerCase().includes(term));
      return matchesFilter && matchesSearch;
    });
  }, [deltas, activeFilter, searchTerm]);

  return (
    <div className={styles['diff-container']}>
      {/* 1. Source Catalog Selector */}
      <div className={styles['catalog-selector-bar']}>
        <span className={styles['selector-label']}>⚖️ Baseline Source Catalog:</span>
        {availableCatalogs.length > 0 ? (
          <select
            className={styles['selector-select']}
            value={activeCatId}
            onChange={(e) => setSelectedCatalogId(e.target.value)}
          >
            <option value="" disabled>Select baseline catalog...</option>
            {availableCatalogs.map((cat, index) => {
              const uuid = cat.uuid || cat.id || `catalog-${index}`;
              return (
                <option key={`${uuid}-${index}`} value={uuid}>
                  {cat.title || 'Untitled'} {uuid ? `(${uuid.substring(0, 8)}...)` : ''}
                </option>
              );
            })}
          </select>
        ) : (
          <input
            type="text"
            className={styles['selector-select']}
            value={activeCatId}
            placeholder="Catalog UUID / ID..."
            onChange={(e) => setSelectedCatalogId(e.target.value)}
          />
        )}
      </div>

      {/* 2. Metric Count Cards */}
      <div className={styles['metrics-grid']}>
        <div
          className={`${styles['metric-card']} ${styles['metric-added']}`}
          onClick={() => setActiveFilter('added')}
        >
          <div className={styles['metric-value']}>{summary.added_count}</div>
          <div className={styles['metric-label']}>Added Controls</div>
        </div>

        <div
          className={`${styles['metric-card']} ${styles['metric-removed']}`}
          onClick={() => setActiveFilter('removed')}
        >
          <div className={styles['metric-value']}>{summary.removed_count}</div>
          <div className={styles['metric-label']}>Removed Controls</div>
        </div>

        <div
          className={`${styles['metric-card']} ${styles['metric-modified']}`}
          onClick={() => setActiveFilter('modified')}
        >
          <div className={styles['metric-value']}>{summary.modified_count}</div>
          <div className={styles['metric-label']}>Modified Controls</div>
        </div>

        <div
          className={`${styles['metric-card']} ${styles['metric-untouched']}`}
          onClick={() => setActiveFilter('untouched')}
        >
          <div className={styles['metric-value']}>{summary.untouched_count}</div>
          <div className={styles['metric-label']}>Untouched Controls</div>
        </div>
      </div>

      {/* 3. Filter Bar & Search */}
      <div className={styles['filter-bar']}>
        <div className={styles['filter-buttons']}>
          {(['all', 'added', 'removed', 'modified', 'untouched'] as const).map((filter) => (
            <button
              key={filter}
              type="button"
              className={`${styles['filter-btn']} ${activeFilter === filter ? styles['filter-btn-active'] : ''}`}
              onClick={() => setActiveFilter(filter)}
            >
              {filter.charAt(0).toUpperCase() + filter.slice(1)}
              {filter === 'all' ? ` (${deltas.length})` : ''}
            </button>
          ))}
        </div>

        <input
          type="text"
          className={styles['search-input']}
          placeholder="Search by ID or title..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Loading / Error States */}
      {isLoading && (
        <div className={styles['diff-empty-state']}>Calculating profile baseline diff...</div>
      )}

      {error && (
        <div className={styles['diff-empty-state']} style={{ color: '#ef4444' }}>
          Error calculating diff: {String(error)}
        </div>
      )}

      {!isLoading && !error && filteredDeltas.length === 0 && (
        <div className={styles['diff-empty-state']}>
          No control deltas match the selected filter or search term.
        </div>
      )}

      {/* 4. Side-by-side Dual Column Comparison View */}
      {!isLoading && !error && (
        <div className={styles['comparison-list']}>
          {filteredDeltas.map((delta: any) => {
            const status = delta.status;
            const catCtrl = delta.baseline_control;
            const profCtrl = delta.profile_control;

            const pillClass =
              status === 'added'
                ? styles['pill-added']
                : status === 'removed'
                ? styles['pill-removed']
                : status === 'modified'
                ? styles['pill-modified']
                : styles['pill-untouched'];

            const bgClass =
              status === 'added'
                ? styles['diff-added-bg']
                : status === 'removed'
                ? styles['diff-removed-bg']
                : status === 'modified'
                ? styles['diff-modified-bg']
                : '';

            return (
              <div key={delta.id} className={`${styles['comparison-card']} ${bgClass}`}>
                <div className={styles['comparison-header']}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span className={styles['control-id-badge']}>{delta.id}</span>
                    <span style={{ fontWeight: 600 }}>{delta.title || 'Untitled Control'}</span>
                  </div>
                  <span className={`${styles['status-pill']} ${pillClass}`}>{status}</span>
                </div>

                <div className={styles['comparison-grid']}>
                  {/* Left Column: Baseline Catalog Control */}
                  <div className={styles['column-baseline']}>
                    <div className={styles['column-title']}>📖 Catalog Baseline</div>
                    {catCtrl ? (
                      <div>
                        <div style={{ fontWeight: 600, marginBottom: '6px' }}>{catCtrl.title}</div>
                        {catCtrl.parts?.map((p: any, i: number) => (
                          <div
                            key={p.id || i}
                            className={status === 'removed' ? styles['diff-strikethrough'] : ''}
                            style={{ fontSize: '0.85rem', color: '#334155', marginBottom: '4px' }}
                          >

                            <strong>[{p.name || 'part'}]:</strong> {p.prose}
                          </div>
                        ))}
                        {catCtrl.params?.length > 0 && (
                          <div style={{ marginTop: '8px', fontSize: '0.8rem', color: '#64748b' }}>
                            <strong>Params:</strong>{' '}
                            {catCtrl.params.map((param: any) => `${param.id} (${(param.values || []).join(', ') || 'unset'})`).join('; ')}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ fontStyle: 'italic', color: '#94a3b8', fontSize: '0.85rem' }}>
                        Not present in source baseline catalog.
                      </div>
                    )}
                  </div>

                  {/* Right Column: Resolved Profile Control */}
                  <div className={styles['column-profile']}>
                    <div className={styles['column-title']}>⚙️ Resolved Profile</div>
                    {profCtrl ? (
                      <div>
                        <div style={{ fontWeight: 600, marginBottom: '6px' }}>{profCtrl.title}</div>
                        {profCtrl.parts?.map((p: any, i: number) => (
                          <div
                            key={p.id || i}
                            style={{ fontSize: '0.85rem', color: '#334155', marginBottom: '4px' }}
                          >
                            <strong>[{p.name || 'part'}]:</strong> {p.prose}
                          </div>
                        ))}
                        {profCtrl.params?.length > 0 && (
                          <div style={{ marginTop: '8px', fontSize: '0.8rem', color: '#64748b' }}>
                            <strong>Params:</strong>{' '}
                            {profCtrl.params.map((param: any) => `${param.id} (${(param.values || []).join(', ') || 'unset'})`).join('; ')}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div
                        className={styles['diff-strikethrough']}
                        style={{ fontStyle: 'italic', fontSize: '0.85rem' }}
                      >
                        Control removed from profile baseline.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ProfileBaselineDiffView;
