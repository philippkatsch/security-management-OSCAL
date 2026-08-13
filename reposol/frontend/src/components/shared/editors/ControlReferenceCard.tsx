import React, { useState } from 'react';
import styles from './Editors.module.css';
import ReadOnlyParts from '../ReadOnlyParts';

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
    <div className={`control-reference-card ${expanded ? 'expanded' : styles['collapsed']} ${className}`}>
      <div 
        className={styles['control-reference-card-header']} 
        onClick={() => setExpanded(!expanded)}
      >
        <div className={styles['control-reference-card-title-group']}>
          <span className={styles['control-reference-card-id']}>{controlId}</span>
          <span className={styles['control-reference-card-title']}>{controlTitle}</span>
        </div>
        <span className={styles['control-reference-card-toggle']}>
          {expanded ? '▲' : '▼'}
        </span>
      </div>
      
      {expanded && (
        <div className={styles['control-reference-card-body']}>
          {controlParts && controlParts.length > 0 && (
            <div className={styles['control-reference-card-parts']}>
              <ReadOnlyParts parts={controlParts} />
            </div>
          )}
          
          {controlParams && controlParams.length > 0 && (
            <div className={styles['control-reference-card-params']}>
              <div className={styles['control-reference-card-params-label']}>Parameters:</div>
              <div className={styles['control-reference-card-params-list']}>
                {controlParams.map(param => (
                  <span key={param.id} className={styles['control-reference-card-param-badge']}>
                    <span className={styles['param-badge-id']}>{param.id}</span>
                    {param.label && <span className={styles['param-badge-label']}>{param.label}</span>}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {sourceDocument && (
            <div className={styles['control-reference-card-footer']}>
              Source: {sourceDocument}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
