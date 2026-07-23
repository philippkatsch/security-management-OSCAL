# DD-003: Profile Resolution Engine

## Status: Accepted
## Date: 2026-07-17
## Decision Makers: Development Team

## Context
The OSCAL Profile Resolution engine currently runs entirely client-side in the browser:
- `resolveProfileSync()` fetches all imported catalogs/profiles recursively
- `applyModify()` applies set-parameters, alters (adds/removes)
- Merge modes (as-is, flat, custom) with combine methods (use-first, merge, keep)
- Pattern matching (glob) for control selection

This code is duplicated in both `CatalogViewer.jsx` and `DocumentEditor.jsx`.

## Decision
Keep profile resolution client-side but extract it into a shared library module (`lib/profile-resolver.js`):
1. **Single source of truth:** One implementation used by all components
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

## Consequences
- Code duplication between CatalogViewer and DocumentEditor is eliminated
- Memory usage in the browser may be high for large catalogs (mitigated by caching)
- Resolution results are not persisted — they are computed on-demand
