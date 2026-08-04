import React, { useState } from 'react';
import ReadOnlyParts from '../ReadOnlyParts';
import './ControlReferenceCard.css';

export default function ControlReferenceCard({ 
  controlId, 
  controlTitle, 
  controlParts = [], 
  controlParams = [], 
  sourceDocument, 
  className = '' 
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className={`control-reference-card ${expanded ? 'expanded' : 'collapsed'} ${className}`}>
      <div 
        className="control-reference-card-header" 
        onClick={() => setExpanded(!expanded)}
      >
        <div className="control-reference-card-title-group">
          <span className="control-reference-card-id">{controlId}</span>
          <span className="control-reference-card-title">{controlTitle}</span>
        </div>
        <span className="control-reference-card-toggle">
          {expanded ? '▲' : '▼'}
        </span>
      </div>
      
      {expanded && (
        <div className="control-reference-card-body">
          {controlParts && controlParts.length > 0 && (
            <div className="control-reference-card-parts">
              <ReadOnlyParts parts={controlParts} />
            </div>
          )}
          
          {controlParams && controlParams.length > 0 && (
            <div className="control-reference-card-params">
              <div className="control-reference-card-params-label">Parameters:</div>
              <div className="control-reference-card-params-list">
                {controlParams.map(param => (
                  <span key={param.id} className="control-reference-card-param-badge">
                    <span className="param-badge-id">{param.id}</span>
                    {param.label && <span className="param-badge-label">{param.label}</span>}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {sourceDocument && (
            <div className="control-reference-card-footer">
              Source: {sourceDocument}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
