import { createAction } from './types';

export function updateTitle(title: string) {
  return createAction('metadata', 'UPDATE_TITLE', `Update title to "${title}"`, 
    (draft: any) => { 
      const root = Object.keys(draft)[0];
      if (draft[root]) {
        if (!draft[root].metadata) draft[root].metadata = {};
        draft[root].metadata.title = title;
      }
    });
}

export function updateMetadata(metadata: any) {
  return createAction('metadata', 'UPDATE_METADATA', 'Update metadata',
    (draft: any) => {
      const root = Object.keys(draft)[0];
      if (draft[root]) {
        draft[root].metadata = metadata;
      }
    }
  );
}
