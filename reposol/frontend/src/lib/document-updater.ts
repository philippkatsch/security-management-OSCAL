import { produce, Draft } from 'immer';

export function updateDocumentField<T>(doc: T, path: (string | number)[], value: unknown): T {
  return produce(doc, (draft: Draft<T>) => {
    let current: any = draft;
    for (let i = 0; i < path.length - 1; i++) {
      if (current[path[i]] === undefined) {
        current[path[i]] = typeof path[i + 1] === 'number' ? [] : {};
      }
      current = current[path[i]];
    }
    current[path[path.length - 1]] = value;
  });
}

export function updateDocumentWith<T>(doc: T, recipe: (draft: Draft<T>) => void): T {
  return produce(doc, recipe);
}

export function deepClone<T>(obj: T): T {
  return produce(obj, () => {}) as T;
}
