# DD-028: Backend Resolution Engine

## Status: Accepted
## Date: 2026-08-23
## Decision Makers: Development Team

## Context
Previously, OSCAL Profile resolution ran client-side in the browser via `profile-resolver.js`. While functional for small catalogs, large catalogs (like BSI Grundschutz with 1000+ controls) caused heavy memory consumption, slow UI blocking, and redundant API calls across clients. Furthermore, extending client-side resolution to SSPs and complex cross-document imports proved unreliable and difficult to maintain.

Additionally, the original backend resolution only operated on saved (disk-based) documents. During live editing, import changes were not reflected in the control tree until the user saved. This created a disconnect between the editor state and the resolved preview.

## Decisions

### 1. Server-Side Resolution Architecture
All resolution logic has been migrated to the backend in `resolution_service.py`. The frontend no longer resolves documents itself.

### 2. Service Methods (`resolution_service.py`)
- `_run_resolution_pipeline(workspace_id, profile, _resolving_stack)`: Core 3-phase pipeline (Import → Merge → Modify) shared by all resolution entry points.
- `resolve_profile(workspace_id, profile_id)`: Resolves a saved Profile from disk by reading it and calling `_run_resolution_pipeline`.
- `resolve_profile_inline(workspace_id, profile)`: Resolves an inline (unsaved) Profile dict for live preview during editing — does NOT read from disk.
- `resolve_ssp(ssp_id)`: Resolves an SSP's implemented requirements against its baseline Profile/Catalog.
- `get_control_tree(stage, doc_id)`: Returns a lightweight hierarchical representation of the control structure (groups and controls) for navigation without sending full prose payloads.
- `detect_modify_conflicts(profile, resolved_control_ids, resolved_param_ids)`: Detects orphaned `modify.alters` and `modify.set-parameters` entries that target controls/parameters not present in the resolved import set. Per NIST OSCAL spec, orphaned alters are inoperative (not errors) — they are silently ignored during resolution.
- `_collect_all_control_ids(resolved)`: Collects all control IDs from a resolved catalog result.
- `_collect_all_param_ids(resolved)`: Collects all parameter IDs from a resolved catalog result.

### 3. API Endpoints (`resolution_routes.py`)
Exposes dedicated endpoints for resolution:
- `GET /api/resolve/profile/{id}`
- `GET /api/resolve/ssp/{id}`
- `GET /api/resolve/tree/{stage}/{id}`
- `POST /api/resolve/profile/preview`: Accepts an inline profile JSON body, resolves it in-memory using `resolve_profile_inline`, and returns the resolved catalog plus a `conflicts` report (orphaned alters, orphaned params, orphaned custom group refs). Used by the frontend for debounced live preview during editing.

### 4. Caching Strategy
To ensure high performance and reduce CPU overhead, resolution results are cached on the server:
- Uses an LRU (Least Recently Used) cache in memory.
- **Cache Invalidation**: Automatic invalidation occurs upon saving/updating the underlying document or any of its dependencies (e.g., modifying the baseline catalog invalidates the profile's resolution cache).
- **Preview Bypass**: The `POST /preview` endpoint does NOT use the LRU cache since it operates on unsaved data. Results are returned directly.

### 5. Frontend Simplification
- Deprecated and removed the client-side `useProfileResolution` hook and `profile-resolver.js`.
- The frontend now simply fetches the resolved state using `@tanstack/react-query` against the new resolution endpoints.
- For live editing, `useProfileResolution` provides a debounced `previewResolve()` function that POSTs the in-memory profile to the preview endpoint (500ms debounce).

## Consequences
- **Performance**: Massive improvement in browser responsiveness and memory footprint. Backend can handle huge frameworks (like BSI Grundschutz) efficiently.
- **Reliability**: Single source of truth for resolution logic on the server.
- **Simplicity**: Frontend components only deal with pure data fetching, unburdened by complex OSCAL tree-merging logic.
- **Live Editing**: Tree updates within 500ms of edits. Orphaned modifications are detected and surfaced instantly.

