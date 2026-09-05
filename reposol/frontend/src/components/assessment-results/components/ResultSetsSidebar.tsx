import React from 'react';
import styles from '../ARPage.module.css';
import { Result } from '../../../lib/types/oscal';

export interface ResultSetsSidebarProps {
  results: Result[];
  activeResultSetId: string | null;
  onSelectResultSet: (id: string) => void;
  onAddResultSet: () => void;
  isEditing: boolean;
}

export function ResultSetsSidebar({
  results,
  activeResultSetId,
  onSelectResultSet,
  onAddResultSet,
  isEditing,
}: ResultSetsSidebarProps) {
  return (
    <aside className={styles['result-sets-sidebar']}>
      <div className={styles['rs-header-actions']}>
        <h3>Result Sets</h3>
        {isEditing && (
          <button
            type="button"
            className={styles['btn-primary']}
            onClick={onAddResultSet}
          >
            + New
          </button>
        )}
      </div>

      <div className={styles['result-set-list']}>
        {results.length === 0 ? (
          <div className={styles['empty-hint']}>No result sets defined.</div>
        ) : (
          results.map((r, index) => {
            const isActive = r.uuid === activeResultSetId;
            const title = r.title || `Result Set ${index + 1}`;
            const startDate = r.start ? new Date(r.start).toLocaleDateString() : 'N/A';
            const endDate = r.end ? new Date(r.end).toLocaleDateString() : 'Ongoing';

            return (
              <button
                key={r.uuid || index}
                type="button"
                role="button"
                className={`${styles['result-set-item-btn']} ${isActive ? styles['active'] : ''}`}
                onClick={() => onSelectResultSet(r.uuid)}
              >
                <div className={styles['rs-title']}>{title}</div>
                <div className={styles['rs-dates']}>
                  {startDate} — {endDate}
                </div>
                <div className={styles['rs-badge-count']}>
                  <span>F: {r.findings?.length || 0}</span>
                  <span>O: {r.observations?.length || 0}</span>
                  <span>R: {r.risks?.length || 0}</span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}
