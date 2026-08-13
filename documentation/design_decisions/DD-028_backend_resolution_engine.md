# DD-028: Backend Resolution Engine

## Status: Accepted
## Date: 2026-08-10
## Decision Makers: Development Team

## Context
Previously, OSCAL Profile resolution ran client-side in the browser via `profile-resolver.js`. While functional for small catalogs, large catalogs (like BSI Grundschutz with 1000+ controls) caused heavy memory consumption, slow UI blocking, and redundant API calls across clients. Furthermore, extending client-side resolution to SSPs and complex cross-document imports proved unreliable and difficult to maintain.

## Decisions

### 1. Server-Side Resolution Architecture
All resolution logic has been migrated to the backend in `resolution_service.py`. The frontend no longer resolves documents itself.

### 2. Service Methods (`resolution_service.py`)
- `resolve_profile(profile_id)`: Recursively resolves a Profile into a flat or structured Catalog, evaluating `modify.alters` and `modify.set-parameters`.
- `resolve_ssp(ssp_id)`: Resolves an SSP's implemented requirements against its baseline Profile/Catalog.
- `get_control_tree(stage, doc_id)`: Returns a lightweight hierarchical representation of the control structure (groups and controls) for navigation without sending full prose payloads.

### 3. API Endpoints (`resolution_routes.py`)
Exposes dedicated endpoints for resolution:
- `GET /api/resolve/profile/{id}`
- `GET /api/resolve/ssp/{id}`
- `GET /api/resolve/tree/{stage}/{id}`

### 4. Caching Strategy
To ensure high performance and reduce CPU overhead, resolution results are cached on the server:
- Uses an LRU (Least Recently Used) cache in memory.
- **Cache Invalidation**: Automatic invalidation occurs upon saving/updating the underlying document or any of its dependencies (e.g., modifying the baseline catalog invalidates the profile's resolution cache).

### 5. Frontend Simplification
- Deprecated and removed the client-side `useProfileResolution` hook and `profile-resolver.js`.
- The frontend now simply fetches the resolved state using `@tanstack/react-query` against the new resolution endpoints.

## Consequences
- **Performance**: Massive improvement in browser responsiveness and memory footprint. Backend can handle huge frameworks (like BSI Grundschutz) efficiently.
- **Reliability**: Single source of truth for resolution logic on the server.
- **Simplicity**: Frontend components only deal with pure data fetching, unburdened by complex OSCAL tree-merging logic.
