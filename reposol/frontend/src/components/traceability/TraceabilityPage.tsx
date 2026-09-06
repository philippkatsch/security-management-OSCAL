import React, { useState } from 'react';
import { useTraceabilityQuery } from '@hooks/useDocumentQuery';
import styles from './TraceabilityPage.module.css';
import sharedStyles from '@components/shared/SharedComponents.module.css';

export function TraceabilityPage() {
  const [controlIdInput, setControlIdInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: results, isLoading: loading, error } = useTraceabilityQuery(searchQuery);

  const handleSearch = (e) => {
    e.preventDefault();
    if (!controlIdInput.trim()) return;
    setSearchQuery(controlIdInput.trim());
  };

  const getStatusBadge = (stageName) => {
    switch (stageName) {
      case 'Catalog': return <span className={[styles['trace-badge'], styles['badge-catalog']].filter(Boolean).join(' ')}>Catalog</span>;
      case 'Profile': return <span className={[styles['trace-badge'], styles['badge-profile']].filter(Boolean).join(' ')}>Profile</span>;
      case 'Component': return <span className={[styles['trace-badge'], styles['badge-component']].filter(Boolean).join(' ')}>Component</span>;
      case 'SSP': return <span className={[styles['trace-badge'], styles['badge-ssp']].filter(Boolean).join(' ')}>SSP</span>;
      case 'AP': return <span className={[styles['trace-badge'], styles['badge-ap']].filter(Boolean).join(' ')}>AP</span>;
      case 'AR': return <span className={[styles['trace-badge'], styles['badge-ar']].filter(Boolean).join(' ')}>AR</span>;
      case 'POAM': return <span className={[styles['trace-badge'], styles['badge-poam']].filter(Boolean).join(' ')}>POA&M</span>;
      case 'Mapping': return <span className={[styles['trace-badge'], styles['badge-mapping']].filter(Boolean).join(' ')}>Mapping</span>;
      default: return <span className={styles['trace-badge']}>Found</span>;
    }
  };

  return (
    <div className={styles['traceability-page']}>
      <div className={styles['traceability-header']}>
        <h2>🔍 Control Traceability</h2>
        <p>Search for a control ID across all OSCAL documents in this workspace.</p>
      </div>

      <form className={styles['traceability-search']} onSubmit={handleSearch}>
        <input 
          type="text" 
          placeholder="Enter Control ID (e.g., ac-1)" 
          value={controlIdInput} 
          onChange={(e) => setControlIdInput(e.target.value)} 
          className={styles['form-input']}
        />
        <button type="submit" className={sharedStyles['btn-primary']} disabled={loading}>
          {loading ? 'Searching...' : 'Trace'}
        </button>
      </form>

      {error && <div className={sharedStyles['error-message']}>Error: {error.message || String(error)}</div>}

      {searchQuery && results && (
        <div className={`traceability-results ${styles['traceability-results']}`}>
          <h3>Results for "{searchQuery}"</h3>
          {results.length === 0 ? (
            <p>No documents reference this control.</p>
          ) : (
            <div className={styles['timeline-container']}>
              {results.map((r) => (
                <div key={`${r.stageKey}-${r.uuid}`} className={styles['timeline-item']}>
                  <div className={styles['timeline-marker']}></div>
                  <div className={styles['timeline-content']}>
                    {getStatusBadge(r.stageName)}
                    <span className={styles['timeline-title']}>{r.title}</span>
                    <a 
                      href={`/${r.stageKey}/${r.uuid}`}
                      target="_blank" 
                      rel="noreferrer"
                      className={styles['timeline-link']}
                    >
                      Open ↗
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default TraceabilityPage;
