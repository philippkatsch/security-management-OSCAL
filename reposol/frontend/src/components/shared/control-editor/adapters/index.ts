import { CatalogAdapter } from './CatalogAdapter';
import { ProfileAdapter } from './ProfileAdapter';
import { SSPAdapter } from './SSPAdapter';

export const ADAPTERS = {
  catalog: CatalogAdapter,
  profile: ProfileAdapter,
  ssp: SSPAdapter,
} as const;
