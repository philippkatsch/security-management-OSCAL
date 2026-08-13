import React from 'react';
import { useFormContext } from '../FormContext';
import styles from '../Form.module.css';

interface ArrayFieldProps<T> {
  label: string;
  items: T[];
  onChange: (items: T[]) => void;
  renderItem: (item: T, index: number, handlers: { update: (updates: Partial<T>) => void; remove: () => void }) => React.ReactNode;
  createItem: () => T;
  addLabel?: string;
  emptyMessage?: string;
  name: string;
  disabled?: boolean;
}

export function ArrayField<T>({
  label,
  items = [],
  onChange,
  renderItem,
  createItem,
  addLabel = 'Add Item',
  emptyMessage = 'No items added yet.',
  name,
  disabled
}: ArrayFieldProps<T>) {
  const { isEditing, setFieldTouched } = useFormContext();
  const actualDisabled = disabled || !isEditing;

  const handleAdd = () => {
    onChange([...(items || []), createItem()]);
    setFieldTouched(name);
  };

  const handleUpdate = (index: number, updates: Partial<T>) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], ...updates };
    onChange(newItems);
    setFieldTouched(name);
  };

  const handleRemove = (index: number) => {
    const newItems = [...items];
    newItems.splice(index, 1);
    onChange(newItems);
    setFieldTouched(name);
  };

  return (
    <div className={styles.arrayField}>
      <div className={styles.arrayHeader}>
        <label className={styles.label}>{label}</label>
        {!actualDisabled && (
          <button type="button" className={styles.addButton} onClick={handleAdd}>
            {addLabel}
          </button>
        )}
      </div>
      
      <div className={styles.arrayList}>
        {(!items || items.length === 0) ? (
          <div className={styles.emptyMessage}>{emptyMessage}</div>
        ) : (
          items.map((item, index) => (
            <div key={index} className={styles.arrayItem}>
              {renderItem(item, index, {
                update: (updates) => handleUpdate(index, updates),
                remove: () => handleRemove(index)
              })}
              {!actualDisabled && (
                <button
                  type="button"
                  className={styles.removeButton}
                  onClick={() => handleRemove(index)}
                  title="Remove item"
                >
                  🗑️
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
