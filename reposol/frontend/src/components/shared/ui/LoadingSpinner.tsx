import React from 'react';
import styles from './LoadingSpinner.module.css';

export interface LoadingSpinnerProps {
  variant?: 'skeleton' | 'spinner' | 'table' | 'list' | 'inline';
  message?: string;
  subtext?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  rows?: number;
}

export const WorkspaceSkeleton: React.FC<{ message?: string }> = ({
  message = 'Loading workspace...'
}) => {
  return (
    <div className={styles['workspace-skeleton']} data-testid="workspace-skeleton">
      {/* Top Mock Toolbar */}
      <div className={styles['skeleton-toolbar']}>
        <div className={styles['toolbar-left']}>
          <div className={`${styles.shimmer} ${styles['skeleton-btn-sm']}`} />
          <div className={`${styles.shimmer} ${styles['skeleton-badge']}`} />
          <div className={`${styles.shimmer} ${styles['skeleton-title']}`} />
        </div>
        <div className={styles['toolbar-right']}>
          <div className={`${styles.shimmer} ${styles['skeleton-pill']}`} />
          <div className={`${styles.shimmer} ${styles['skeleton-btn-sm']}`} />
        </div>
      </div>

      {/* Main Split Layout */}
      <div className={styles['skeleton-body']}>
        {/* Left Sidebar */}
        <aside className={styles['skeleton-sidebar']}>
          <div className={`${styles.shimmer} ${styles['skeleton-search']}`} />
          <div className={styles['skeleton-sidebar-nav']}>
            <div className={`${styles.shimmer} ${styles['skeleton-nav-item']}`} style={{ width: '85%' }} />
            <div className={`${styles.shimmer} ${styles['skeleton-nav-item']}`} style={{ width: '70%' }} />
            <div className={`${styles.shimmer} ${styles['skeleton-nav-item']}`} style={{ width: '92%' }} />
            <div className={`${styles.shimmer} ${styles['skeleton-nav-item']}`} style={{ width: '60%' }} />
            <div className={`${styles.shimmer} ${styles['skeleton-nav-item']}`} style={{ width: '80%' }} />
            <div className={`${styles.shimmer} ${styles['skeleton-nav-item']}`} style={{ width: '75%' }} />
          </div>
        </aside>

        {/* Right Editor Area */}
        <main className={styles['skeleton-main']}>
          <div className={styles['skeleton-tabs']}>
            <div className={`${styles.shimmer} ${styles['skeleton-tab']}`} />
            <div className={`${styles.shimmer} ${styles['skeleton-tab']}`} />
            <div className={`${styles.shimmer} ${styles['skeleton-tab']}`} />
          </div>

          <div className={styles['skeleton-content-area']}>
            <div className={`${styles.shimmer} ${styles['skeleton-banner']}`} />

            <div className={styles['skeleton-metrics-grid']}>
              <div className={`${styles.shimmer} ${styles['skeleton-metric-card']}`} />
              <div className={`${styles.shimmer} ${styles['skeleton-metric-card']}`} />
              <div className={`${styles.shimmer} ${styles['skeleton-metric-card']}`} />
              <div className={`${styles.shimmer} ${styles['skeleton-metric-card']}`} />
            </div>

            <div className={`${styles.shimmer} ${styles['skeleton-card']}`} />

            {message && (
              <div className={styles['skeleton-status-footer']}>
                <span className={styles['skeleton-dot']} />
                <span>{message}</span>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export const TableSkeleton: React.FC<{ rows?: number }> = ({ rows = 4 }) => {
  return (
    <div className={styles['table-skeleton-container']} data-testid="table-skeleton">
      <div className={`${styles.shimmer} ${styles['skeleton-search']}`} style={{ width: '320px', height: '36px' }} />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={styles['table-skeleton-row']}>
          <div className={`${styles.shimmer} ${styles['table-skeleton-cell']}`} style={{ width: '120px' }} />
          <div className={`${styles.shimmer} ${styles['table-skeleton-cell']}`} style={{ width: '40%' }} />
          <div className={`${styles.shimmer} ${styles['table-skeleton-cell']}`} style={{ width: '80px' }} />
          <div className={`${styles.shimmer} ${styles['table-skeleton-cell']}`} style={{ width: '100px' }} />
          <div className={`${styles.shimmer} ${styles['table-skeleton-cell']}`} style={{ width: '90px', marginLeft: 'auto' }} />
        </div>
      ))}
    </div>
  );
};

export const CardListSkeleton: React.FC<{ items?: number }> = ({ items = 3 }) => {
  return (
    <div className={styles['list-skeleton-container']} data-testid="card-list-skeleton">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className={styles['list-skeleton-item']}>
          <div className={`${styles.shimmer} ${styles['list-skeleton-icon']}`} />
          <div className={styles['list-skeleton-text-group']}>
            <div className={`${styles.shimmer}`} style={{ height: '16px', width: `${65 + (i % 3) * 10}%` }} />
            <div className={`${styles.shimmer}`} style={{ height: '12px', width: '40%' }} />
          </div>
        </div>
      ))}
    </div>
  );
};

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  variant = 'skeleton',
  message,
  subtext,
  size = 'md',
  className = '',
  rows = 4
}) => {
  if (variant === 'skeleton') {
    return <WorkspaceSkeleton message={message} />;
  }

  if (variant === 'table') {
    return <TableSkeleton rows={rows} />;
  }

  if (variant === 'list') {
    return <CardListSkeleton items={rows} />;
  }

  const ringSizeClass = size === 'sm' ? styles['spinner-ring-sm'] : size === 'lg' ? styles['spinner-ring-lg'] : '';

  return (
    <div className={`${styles['spinner-container']} ${className}`} role="status" aria-live="polite">
      <div className={`${styles['spinner-ring']} ${ringSizeClass}`} />
      {message && <div className={styles['spinner-text']}>{message}</div>}
      {subtext && <div className={styles['spinner-subtext']}>{subtext}</div>}
    </div>
  );
};

export default LoadingSpinner;
