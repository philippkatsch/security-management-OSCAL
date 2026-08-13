import { atom } from 'jotai';

export const sidebarOpenAtom = atom<boolean>(true);
export const editModeAtom = atom<boolean>(false);
export const activeTabAtom = atom<string>('overview');
export const saveStatusAtom = atom<'idle' | 'saving' | 'saved' | 'error'>('idle');
export const globalErrorAtom = atom<string | null>(null);
