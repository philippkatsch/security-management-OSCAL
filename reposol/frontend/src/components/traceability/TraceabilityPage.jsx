import React, { useState } from 'react';
import { authFetch } from '../../lib/api';
import './TraceabilityPage.css';

export function TraceabilityPage() {
  const [controlId, setControlId] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!controlId.trim()) return;

    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const stages = [
        { key: 'catalogs', root: 'catalog', name: 'Catalog' },
        { key: 'profiles', root: 'profile', name: 'Profile' },
        { key: 'component-definitions', root: 'component-definition', name: 'Component' },
        { key: 'ssps', root: 'system-security-plan', name: 'SSP' },
        { key: 'assessment-plans', root: 'assessment-plan', name: 'AP' },
        { key: 'assessment-results', root: 'assessment-results', name: 'AR' },
        { key: 'poams', root: 'plan-of-action-and-milestones', name: 'POAM' }
      ];

      const foundItems = [];
      const lowerCtrlId = controlId.trim().toLowerCase();

      await Promise.all(stages.map(async (stage) => {
        try {
          const res = await authFetch(`/api/documents/${stage.key}`);
          if (!res.ok) return;
          const docs = await res.json();

          for (const doc of docs) {
            const data = doc[stage.root];
            if (!data) continue;
            const strData = JSON.stringify(data).toLowerCase();
            if (strData.includes(`"${lowerCtrlId}"`) || strData.includes(`:${lowerCtrlId}`) || strData.includes(lowerCtrlId)) {
              foundItems.push({
                stageName: stage.name,
                stageKey: stage.key,
                title: data.metadata?.title || 'Untitled',
                uuid: data.uuid
              });
            }
          }
        } catch (e) {
          console.error('Error fetching', stage.key, e);
        }
      }));

      setResults(foundItems);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (stageName) => {
    switch (stageName) {
      case 'Catalog': return <span className="trace-badge badge-catalog">Catalog</span>;
      case 'Profile': return <span className="trace-badge badge-profile">Profile</span>;
      case 'Component': return <span className="trace-badge badge-component">Component</span>;
      case 'SSP': return <span className="trace-badge badge-ssp">SSP</span>;
      case 'AP': return <span className="trace-badge badge-ap">AP</span>;
      case 'AR': return <span className="trace-badge badge-ar">AR</span>;
      case 'POAM': return <span className="trace-badge badge-poam">POA&M</span>;
      default: return <span className="trace-badge">Found</span>;
    }
  };

  return (
    <div className="traceability-page">
      <div className="traceability-header">
        <h2>🔍 Control Traceability</h2>
        <p>Search for a control ID across all OSCAL documents in this workspace.</p>
      </div>

      <form className="traceability-search" onSubmit={handleSearch}>
        <input 
          type="text" 
          placeholder="Enter Control ID (e.g., ac-1)" 
          value={controlId} 
          onChange={(e) => setControlId(e.target.value)} 
          className="form-input"
        />
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Searching...' : 'Trace'}
        </button>
      </form>

      {error && <div className="error-message">Error: {error}</div>}

      {results && (
        <div className="traceability-results">
          <h3>Results for "{controlId}"</h3>
          {results.length === 0 ? (
            <p>No documents reference this control.</p>
          ) : (
            <div className="timeline-container">
              {results.map((r, i) => (
                <div key={i} className="timeline-item">
                  <div className="timeline-marker"></div>
                  <div className="timeline-content">
                    {getStatusBadge(r.stageName)}
                    <span className="timeline-title">{r.title}</span>
                    <a 
                      href={`/${r.stageKey === 'catalogs' ? 'catalog' : r.stageKey === 'profiles' ? 'profile' : r.stageKey === 'component-definitions' ? 'component-definition' : r.stageKey === 'ssps' ? 'ssp' : r.stageKey === 'assessment-plans' ? 'assessment-plan' : r.stageKey === 'assessment-results' ? 'assessment-result' : 'poam'}/${r.uuid}`}
                      target="_blank" 
                      rel="noreferrer"
                      className="timeline-link"
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
