import { OscalStage } from './oscal';

export interface DocumentSummary {
  id: string;
  title: string;
  stage: string;
  last_modified: string;
  version: string;
  status: string;
}

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
  warnings?: string[];
}

export interface VersionInfo {
  version: string;
  timestamp: string;
  label?: string;
  is_active?: boolean;
  is_draft?: boolean;
}

export interface WorkspaceStats {
  [stage: string]: number;
}

export interface ImportResult {
  uuid: string;
  title: string;
  stage: string;
  status: string;
}

export interface ApiError {
  detail?: string;
  errors?: string[];
}
