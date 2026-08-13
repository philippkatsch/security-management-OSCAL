import React from 'react';
import styles from './ListEditor.module.css';
import { EmptyState } from './EmptyState';

export interface ItemHandlers<T> {
  updateItem: (updates: Partial<T>) => void;
  deleteItem: () => void;
}

interface ListEditorProps<T> {
  items: T[];
  onChange: (items: T[]) => void;
  renderItem: (item: T, index: number, handlers: ItemHandlers<T>) => React.ReactNode;
  createItem: () => T;
  getItemKey: (item: T) => string;
  emptyMessage?: string;
  addLabel?: string;
}

export function ListEditor<T>({
  items,
  onChange,
  renderItem,
  createItem,
  getItemKey,
  emptyMessage = 'No items found',
  addLabel = 'Add Item',
}: ListEditorProps<T>) {
  const handleAdd = () => {
    onChange([...items, createItem()]);
  };

  const handleUpdate = (index: number, updates: Partial<T>) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], ...updates };
    onChange(newItems);
  };

  const handleDelete = (index: number) => {
    const newItems = [...items];
    newItems.splice(index, 1);
    onChange(newItems);
  };

  return (
    <div className={styles.container}>
      {items.length === 0 ? (
        <EmptyState
          title={emptyMessage}
          action={{
            label: addLabel,
            onClick: handleAdd,
          }}
        />
      ) : (
        <>
          <div className={styles.header}>
            <button className={styles.btnAdd} onClick={handleAdd}>
              {addLabel}
            </button>
          </div>
          <div className={styles.list}>
            {items.map((item, index) =>
              renderItem(item, index, {
                updateItem: (updates) => handleUpdate(index, updates),
                deleteItem: () => handleDelete(index),
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}
