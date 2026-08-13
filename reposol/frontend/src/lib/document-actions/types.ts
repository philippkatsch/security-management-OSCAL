export interface DocumentAction<T = unknown> {
  type: string;
  domain: string;
  description: string;
  payload?: T;
  apply: (draft: any) => void;
}

export type ActionDispatcher = (action: DocumentAction) => void;

export interface ActionContext {
  document: any;
  updateDocument: (updater: (draft: any) => void) => void;
  stage: string;
}

export function createAction<T>(
  domain: string,
  type: string,
  description: string,
  applyFn: (draft: any) => void,
  payload?: T
): DocumentAction<T> {
  return {
    domain,
    type,
    description,
    payload,
    apply: applyFn
  };
}
