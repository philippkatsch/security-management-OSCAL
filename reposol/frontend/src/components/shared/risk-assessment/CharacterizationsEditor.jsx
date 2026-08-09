import React from 'react';
import './OscalEditors.css';
import { PropsEditor } from '../PropsEditor';

export function CharacterizationsEditor({ value, isEditMode, onChange }) {
  const characterizations = value || [];

  const updateChar = (index, updated) => {
    const next = [...characterizations];
    next[index] = updated;
    onChange(next);
  };

  const addChar = () => {
    onChange([...characterizations, { origin: { actors: [] }, facets: [] }]);
  };

  const removeChar = (index) => {
    const next = [...characterizations];
    next.splice(index, 1);
    onChange(next);
  };

  if (!isEditMode) {
    if (characterizations.length === 0) return <div className="read-only-val">No characterizations</div>;
    return (
      <div className="oscal-editor-list">
        {characterizations.map((char, i) => (
          <div key={i} className="oscal-editor-item">
            {char.origin?.actors?.length > 0 && (
              <div className="oscal-editor-sublist">
                <h5>Origin Actors</h5>
                {char.origin.actors.map((a, j) => (
                  <div key={j} className="read-only-val">{a.type}: {a['actor-uuid']}</div>
                ))}
              </div>
            )}
            {char.facets?.length > 0 && (
              <div className="oscal-editor-sublist">
                <h5>Facets</h5>
                {char.facets.map((f, j) => (
                  <div key={j} className="read-only-val">
                    <strong>{f.name}:</strong> {f.value} {f.system ? `(${f.system})` : ''}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="oscal-editor-section">
      <div className="oscal-editor-list">
        {characterizations.map((char, i) => (
          <div key={i} className="oscal-editor-item">
            <div className="oscal-editor-item-header">
              <span>Characterization {i + 1}</span>
              <button className="btn-remove" onClick={() => removeChar(i)}>Remove</button>
            </div>

            <div className="oscal-editor-sublist">
              <h5>Origin Actors</h5>
              {(char.origin?.actors || []).map((actor, j) => (
                <div key={j} className="oscal-editor-row">
                  <select 
                    value={actor.type || ''} 
                    onChange={e => {
                      const newActors = [...(char.origin?.actors || [])];
                      newActors[j] = { ...actor, type: e.target.value };
                      updateChar(i, { ...char, origin: { ...char.origin, actors: newActors } });
                    }}
                  >
                    <option value="">Select Type</option>
                    <option value="tool">Tool</option>
                    <option value="assessment-platform">Platform</option>
                    <option value="party">Party</option>
                  </select>
                  <input 
                    type="text" 
                    placeholder="Actor UUID" 
                    value={actor['actor-uuid'] || ''}
                    onChange={e => {
                      const newActors = [...(char.origin?.actors || [])];
                      newActors[j] = { ...actor, 'actor-uuid': e.target.value };
                      updateChar(i, { ...char, origin: { ...char.origin, actors: newActors } });
                    }}
                  />
                  <button className="btn-remove" onClick={() => {
                    const newActors = [...(char.origin?.actors || [])];
                    newActors.splice(j, 1);
                    updateChar(i, { ...char, origin: { ...char.origin, actors: newActors } });
                  }}>X</button>
                </div>
              ))}
              <button className="btn-add" onClick={() => {
                const newActors = [...(char.origin?.actors || []), { type: 'tool', 'actor-uuid': '' }];
                updateChar(i, { ...char, origin: { ...char.origin, actors: newActors } });
              }}>+ Add Origin Actor</button>
            </div>

            <div className="oscal-editor-sublist">
              <h5>Facets</h5>
              {(char.facets || []).map((facet, j) => (
                <div key={j} style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid var(--color-border)' }}>
                  <div className="oscal-editor-row">
                    <select 
                      value={facet.name || ''} 
                      onChange={e => {
                        const newFacets = [...(char.facets || [])];
                        newFacets[j] = { ...facet, name: e.target.value };
                        updateChar(i, { ...char, facets: newFacets });
                      }}
                    >
                      <option value="">Select Name</option>
                      <option value="likelihood">Likelihood</option>
                      <option value="impact">Impact</option>
                      <option value="exposure">Exposure</option>
                      <option value="AV">CVSS: AV (Access Vector)</option>
                      <option value="AC">CVSS: AC (Access Complexity)</option>
                      <option value="PR">CVSS: PR (Privileges Required)</option>
                      <option value="UI">CVSS: UI (User Interaction)</option>
                      <option value="S">CVSS: S (Scope)</option>
                      <option value="C">CVSS: C (Confidentiality)</option>
                      <option value="I">CVSS: I (Integrity)</option>
                      <option value="A">CVSS: A (Availability)</option>
                    </select>
                    
                    <input 
                      type="text" 
                      placeholder="System (e.g. CVSSv3.1)" 
                      value={facet.system || ''}
                      onChange={e => {
                        const newFacets = [...(char.facets || [])];
                        newFacets[j] = { ...facet, system: e.target.value };
                        updateChar(i, { ...char, facets: newFacets });
                      }}
                    />

                    {['likelihood', 'impact', 'exposure'].includes(facet.name) ? (
                      <select 
                        value={facet.value || ''} 
                        onChange={e => {
                          const newFacets = [...(char.facets || [])];
                          newFacets[j] = { ...facet, value: e.target.value };
                          updateChar(i, { ...char, facets: newFacets });
                        }}
                      >
                        <option value="">Select Value</option>
                        <option value="low">Low</option>
                        <option value="moderate">Moderate</option>
                        <option value="high">High</option>
                        <option value="critical">Critical</option>
                      </select>
                    ) : (
                      <input 
                        type="text" 
                        placeholder="Value" 
                        value={facet.value || ''}
                        onChange={e => {
                          const newFacets = [...(char.facets || [])];
                          newFacets[j] = { ...facet, value: e.target.value };
                          updateChar(i, { ...char, facets: newFacets });
                        }}
                      />
                    )}

                    <button className="btn-remove" onClick={() => {
                      const newFacets = [...(char.facets || [])];
                      newFacets.splice(j, 1);
                      updateChar(i, { ...char, facets: newFacets });
                    }}>X</button>
                  </div>
                  
                  <div style={{ paddingLeft: '12px' }}>
                    <PropsEditor 
                      properties={facet.props || []} 
                      isEditMode={true} 
                      onChange={(newProps) => {
                        const newFacets = [...(char.facets || [])];
                        newFacets[j] = { ...facet, props: newProps };
                        updateChar(i, { ...char, facets: newFacets });
                      }} 
                    />
                  </div>
                </div>
              ))}
              <button className="btn-add" onClick={() => {
                const newFacets = [...(char.facets || []), { name: '', system: '', value: '' }];
                updateChar(i, { ...char, facets: newFacets });
              }}>+ Add Facet</button>
            </div>
            
          </div>
        ))}
      </div>
      <button className="btn-add" onClick={addChar}>+ Add Characterization</button>
    </div>
  );
}
