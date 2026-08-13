import { atom } from 'jotai';
import type { OscalDocument, OscalStage } from '@lib/types/oscal';
import type { DocumentSummary } from '@lib/types/api';

export const documentListAtom = atom<DocumentSummary[]>([]);
export const recentDocsAtom = atom<DocumentSummary[]>([]);
export const currentStageAtom = atom<OscalStage | null>(null);
export const currentDocIdAtom = atom<string | null>(null);
export const documentCountsAtom = atom<Record<OscalStage, number>>({} as Record<OscalStage, number>);
