import React, { useState } from 'react';
import styles from './EditableCard.module.css';

interface EditableCardProps {
  title: string;
  children: React.ReactNode;
  onDelete?: () => void;
  defaultExpanded?: boolean;
}

export function EditableCard({ title, children, onDelete, defaultExpanded = true }: EditableCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h4 className={styles.title}>{title}</h4>
        <div className={styles.actions}>
          <button className={styles.btn} onClick={() => setExpanded(!expanded)}>
            {expanded ? 'Collapse' : 'Expand'}
          </button>
          {onDelete && (
            <button className={`${styles.btn} ${styles.btnDanger}`} onClick={onDelete}>
              Delete
            </button>
          )}
        </div>
      </div>
      {expanded && <div className={styles.content}>{children}</div>}
    </div>
  );
}
