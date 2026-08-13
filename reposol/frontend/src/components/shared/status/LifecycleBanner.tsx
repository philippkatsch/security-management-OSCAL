import React, { useState, useEffect } from 'react';
import styles from './Status.module.css';
import sharedStyles from '../SharedComponents.module.css';

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

  const bannerClass = [
    styles['lifecycle-banner'] || '',
    'lifecycle-banner',
    styles[status] || '',
    status,
    mounted ? 'mounted' : ''
  ].filter(Boolean).join(' ');

  if (status === 'archived') {
    return (
      <div className={bannerClass} data-testid="lifecycle-banner">
        <div className={styles['banner-content'] || styles['lifecycle-banner-content']}>
          <span className={styles['banner-icon'] || styles['lifecycle-banner-icon']}>📦</span>
          <span className={styles['banner-text'] || styles['lifecycle-banner-text']}>
            This document is archived and read-only. Create a new version to make changes.
          </span>
        </div>
        <div className={styles['banner-actions'] || styles['lifecycle-banner-actions']}>
          {onReactivate && (
            <button className={['btn', sharedStyles['btn-secondary'], 'btn-reactivate'].filter(Boolean).join(' ')} onClick={onReactivate}>
              Reactivate
            </button>
          )}
          <button className={styles['banner-close'] || styles['lifecycle-banner-close']} onClick={handleDismiss} aria-label="Dismiss">
            ×
          </button>
        </div>
      </div>
    );
  }

  if (status === 'superseded') {
    return (
      <div className={bannerClass} data-testid="lifecycle-banner">
        <div className={styles['banner-content'] || styles['lifecycle-banner-content']}>
          <span className={styles['banner-icon'] || styles['lifecycle-banner-icon']}>🔄</span>
          <span className={styles['banner-text'] || styles['lifecycle-banner-text']}>
            This document has been superseded{successorTitle ? ` by ${successorTitle}` : ''}.
          </span>
        </div>
        <div className={styles['banner-actions'] || styles['lifecycle-banner-actions']}>
          {onNavigateSuccessor && (
            <button className={['btn', sharedStyles['btn-secondary']].filter(Boolean).join(' ')} onClick={() => onNavigateSuccessor(successorId)}>
              View successor document
            </button>
          )}
          {onUpdateReference && (
            <button className={['btn', sharedStyles['btn-primary']].filter(Boolean).join(' ')} onClick={() => onUpdateReference(successorId)}>
              Update import reference
            </button>
          )}
          <button className={styles['banner-close'] || styles['lifecycle-banner-close']} onClick={handleDismiss} aria-label="Dismiss">
            ×
          </button>
        </div>
      </div>
    );
  }

  return null;
}
