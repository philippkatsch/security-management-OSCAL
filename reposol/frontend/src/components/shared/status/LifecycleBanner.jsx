import React, { useState, useEffect } from 'react';
import './Lifecycle.css';

export default function LifecycleBanner({ 
  status, 
  successorTitle, 
  successorId, 
  onReactivate, 
  onNavigateSuccessor, 
  onUpdateReference,
  documentId // Used for dismissible localStorage key
}) {
  const [dismissed, setDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (documentId) {
      const isDismissed = localStorage.getItem(`lifecycle-banner-dismissed-${documentId}-${status}`);
      if (isDismissed === 'true') {
        setDismissed(true);
      }
    }
  }, [documentId, status]);

  if (status === 'draft' || status === 'active' || dismissed) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    if (documentId) {
      localStorage.setItem(`lifecycle-banner-dismissed-${documentId}-${status}`, 'true');
    }
  };

  const bannerClass = `lifecycle-banner ${status} ${mounted ? 'mounted' : ''}`;

  if (status === 'archived') {
    return (
      <div className={bannerClass}>
        <div className="lifecycle-banner-content">
          <span className="lifecycle-banner-icon">📦</span>
          <span className="lifecycle-banner-text">
            This document is archived and read-only. Create a new version to make changes.
          </span>
        </div>
        <div className="lifecycle-banner-actions">
          {onReactivate && (
            <button className="btn btn-secondary btn-reactivate" onClick={onReactivate}>
              Reactivate
            </button>
          )}
          <button className="lifecycle-banner-close" onClick={handleDismiss} aria-label="Dismiss">
            ×
          </button>
        </div>
      </div>
    );
  }

  if (status === 'superseded') {
    return (
      <div className={bannerClass}>
        <div className="lifecycle-banner-content">
          <span className="lifecycle-banner-icon">🔄</span>
          <span className="lifecycle-banner-text">
            This document has been superseded{successorTitle ? ` by ${successorTitle}` : ''}.
          </span>
        </div>
        <div className="lifecycle-banner-actions">
          {onNavigateSuccessor && (
            <button className="btn btn-secondary" onClick={() => onNavigateSuccessor(successorId)}>
              View successor document
            </button>
          )}
          {onUpdateReference && (
            <button className="btn btn-primary" onClick={() => onUpdateReference(successorId)}>
              Update import reference
            </button>
          )}
          <button className="lifecycle-banner-close" onClick={handleDismiss} aria-label="Dismiss">
            ×
          </button>
        </div>
      </div>
    );
  }

  return null;
}
