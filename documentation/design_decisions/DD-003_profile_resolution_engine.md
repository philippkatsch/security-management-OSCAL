# DD-003: Profile Resolution Engine

**Superseded by DD-028**: Profile resolution has been moved completely to the backend. See [DD-028](DD-028_backend_resolution_engine.md).

## Status: Superseded
## Date: 2026-07-17

## Context
The OSCAL Profile Resolution engine currently runs entirely client-side in the browser:
- `resolveProfileSync()` fetches all imported catalogs/profiles recursively
- `applyModify()` applies set-parameters, alters (adds/removes)
- Merge modes (as-is, flat, custom) with combine methods (use-first, merge, keep)
- Pattern matching (glob) for control selection

This logic is extracted into a shared library module (`lib/profile-resolver.js`) used by domain page components (`CatalogPage`, `ProfilePage`, `SSPPage`).

## Decision
Keep profile resolution client-side in a shared library module (`lib/profile-resolver.js`):
1. **Single source of truth:** One implementation used by all domain page components
2. **Caching:** Cache resolved profiles and fetched catalogs to avoid redundant API calls
3. **Lazy resolution:** Only resolve when the user explicitly requests a preview
4. **Future backend endpoint:** Design the API of `profile-resolver.js` so it can later be replaced by a backend call without changing consumer code

## Rationale for staying client-side (for now)
- Avoids backend complexity and additional API endpoints
- Allows interactive live-preview during editing (instant feedback)
- NIST catalog (10.7MB) is already fetched once and cached
- Resolution is CPU-bound but fast enough for single profiles

## Future consideration
If performance becomes an issue with very large catalogs or deeply nested profile imports, a backend endpoint `POST /api/resolve/profiles/{id}` can be introduced. The `lib/profile-resolver.js` module is designed to make this swap transparent.

### Cross-Document Resolution Beyond Profiles
This DD covers client-side resolution for the Catalog → Profile import chain only. For cross-document resolution across the full OSCAL lifecycle (SSP → Profile, AP → SSP, AR → AP, POA&M → SSP/AR, Mapping → Catalog/Profile), see [DD-016](DD-016_cross_document_import_resolution.md). DD-016 uses a backend endpoint `GET /api/resolve/{stage}/{uuid}` for lazy on-demand resolution with caching and stale detection, complementing this client-side approach.

## Consequences
- Single source of truth for profile resolution across all domain page components
- Memory usage in the browser may be high for large catalogs (mitigated by caching)
- Resolution results are not persisted — they are computed on-demand
