import { atom } from 'jotai';
import { getWorkspaceId } from '@lib/api';

/** The active workspace ID used for all API calls. */
export const workspaceIdAtom = atom<string>(getWorkspaceId());

/** Whether the backend has ALLOW_MASTER_EDIT enabled. Fetched from GET /api/config on startup. */
export const masterEditEnabledAtom = atom<boolean>(false);

/** Whether the user has toggled Master Template Mode on (only possible when masterEditEnabled is true). */
export const isMasterModeAtom = atom<boolean>(false);
