import { useState } from 'react';

export function useEntityList<T extends { uuid: string }>(
  items: T[],
  onChange: (items: T[]) => void
) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const add = (item: T) => onChange([...items, item]);

  const remove = (uuid: string) => onChange(items.filter((i) => i.uuid !== uuid));

  const update = (uuid: string, updates: Partial<T>) =>
    onChange(items.map((i) => (i.uuid === uuid ? { ...i, ...updates } : i)));

  const selected = items.find((i) => i.uuid === selectedId) || null;

  return { items, add, remove, update, selectedId, setSelectedId, selected };
}
