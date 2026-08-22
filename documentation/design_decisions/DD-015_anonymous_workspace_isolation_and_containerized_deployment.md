# DD-015: Anonymous Workspace Isolation & Containerized Fly.io Deployment

## Status: Accepted
## Date: 2026-08-04
## Decision Makers: Development Team

## Context
Reposol is being prepared for public online demonstration and open-source self-hosting.
When hosted publicly without authentication, multiple concurrent users editing documents against a shared storage directory would overwrite each other's OSCAL files. Furthermore, deploying separate frontend static hosting and backend API services introduces CORS configuration overhead and double maintenance.

To solve this without creating a forced authentication barrier for public demo users, we need an architecture that provides isolated document scopes per browser session and allows single-container deployment (Option A) on platforms like Fly.io with persistent data storage across container deployments.

## Decisions

### 1. Header-Driven Anonymous Workspace Isolation & Master Template Seeding
- The frontend (`api.js`) maintains an anonymous session UUID in browser `localStorage` (e.g. `session-8f3a9b12-...`) or URL query parameter (`?w=...`). All components (`CatalogPage.jsx`, `ProfilePage.jsx`, `SSPPage.jsx`, `MappingPage.jsx`, `ImportWizard.jsx`, etc.) must use `authFetch` for all `/api/` endpoints.
- Every outgoing API request attaches the `X-Workspace-ID` HTTP header.
- The backend (`storage.py` and `routes.py`) inspects `X-Workspace-ID`. When present, storage functions resolve the data directory to `reposol/data/workspaces/{workspace_id}/{stage}/`.
- **Master Template Single Store (`data/workspaces/default/`)**: Master templates are stored under `reposol/data/workspaces/default/`. Legacy folders `reposol/data/templates/` and `reposol/data/catalogs/` are deprecated and removed.
- **Auto-Seeding**: When a workspace is first created, `storage.py` automatically copies master sample templates from `reposol/data/workspaces/default/{stage}/` into `reposol/data/workspaces/{workspace_id}/{stage}/` so new users are immediately greeted with sample OSCAL Catalogs, Profiles, and SSPs.
- When no header is provided in non-test mode, storage defaults to `reposol/data/workspaces/default/{stage}/`.

### 2. Multi-Stage Docker Build Architecture
A root `Dockerfile` defines a two-stage build:
1. **Frontend Stage (`node:18-alpine`)**: Installs frontend dependencies and runs `npm run build` to generate `reposol/frontend/dist`.
2. **Runtime Stage (`python:3.11-slim`)**: Installs backend Python dependencies (`requirements.txt`), copies `reposol/backend`, injects the built static `dist/` directory, and copies master templates to a seed location (`COPY reposol/data/workspaces/default /app/templates_seed`).

### 3. FastAPI Static Asset & SPA Route Serving
In `reposol/backend/app/main.py`:
- Static files are served at `/` using `fastapi.staticfiles.StaticFiles`.
- A fallback handler serves `index.html` for non-API client-side routes to support direct URL navigation without 404 errors.

### 4. Fly.io Persistent Volume Storage & Master Template Syncing
- `fly.toml` specifies Fly.io app configuration, mapping internal port 8000 to public HTTP/HTTPS ports 80/443 in region `fra` (Frankfurt).
- **Persistent Volume Mount**: A persistent Fly volume (`oscal_data`) is attached to `/app/data` via `[mounts] source = "oscal_data"`, `destination = "/app/data"`. This guarantees that user workspaces (`/app/data/workspaces/`), uploads (`/app/data/uploads/`), and user-modified files persist permanently across container deployments and restarts.
- **Startup Master Template Synchronization**: Because mounting an external volume over `/app/data` masks pre-baked files in the Docker container image, master templates are copied to `/app/templates_seed` during image creation. On FastAPI backend startup (`main.py` lifespan / `storage.py` initialization), a helper function `sync_master_templates()` automatically copies/syncs updated master templates from `/app/templates_seed/` into `/app/data/workspaces/default/` on the mounted volume. This ensures new deployments instantly reflect updated master templates while keeping all user session workspaces completely untouched and persistent.
- `.dockerignore` excludes temporary user session workspaces (`reposol/data/workspaces/session-*`) and uploads (`reposol/data/uploads/*`) while explicitly including master templates (`reposol/data/workspaces/default`) so they are available in remote container deployments.


### 5. Master Templates Admin Mode — Backend-Driven Feature Flag (`ALLOW_MASTER_EDIT`)
- Master Template editing is **exclusively controlled by the backend environment variable `ALLOW_MASTER_EDIT`**. There are no URL parameters (`?w=master`, `?w=templates`) for this purpose — these reserved workspace IDs are blocked from URL-based activation in both the frontend (`getWorkspaceId()` rejects them) and backend (`get_workspace_id()` ignores them when the env var is not set).
- **Backend Config Endpoint (`GET /api/config`)**: On startup, the frontend fetches `GET /api/config` which returns `{ "masterEditEnabled": true/false }` based on the `ALLOW_MASTER_EDIT` env var. This is the single source of truth for whether master editing is available.
- **Frontend Sidebar Toggle**: When `masterEditEnabled` is `true`, a `👑 Master Templates` toggle button appears in the navigation sidebar footer. Clicking it activates Master Template Mode (with a confirmation dialog). All API calls then use `X-Workspace-ID: default` to target the master workspace. Clicking `Exit ✕` deactivates the mode and reloads the page.
- **Localhost Guard (Defense-in-Depth)**: Even with `ALLOW_MASTER_EDIT=true`, the backend's `require_write_permission()` additionally restricts write access to protected workspace IDs (`default`, `master`, `templates`) to requests originating from `localhost` / `127.0.0.1` unless the env var explicitly overrides this check.
- **Production Safety**: On public deployments (e.g., Fly.io), `ALLOW_MASTER_EDIT` is never set, so the master mode toggle does not appear in the UI, and any attempt to write to the default workspace is rejected with `403 Forbidden`.
- **No localStorage Persistence**: The master/templates workspace IDs are never stored in `localStorage`. Navigating away or reloading the page without the toggle exits master mode automatically.
- The UI displays a prominent `👑 Master Templates` badge with a purple gradient when master mode is active.



## Consequences
- **Zero Friction Demo**: Users can open the live site and immediately edit SSPs without signing up.
- **Multi-User Safety**: Concurrent demo users work in isolated workspaces without data collisions.
- **Zero Cost Hosting**: Fits within the free tier allowance of Fly.io or similar container hosts.
- **Future-Proof SaaS Path**: The storage abstraction (`get_stage_dir(stage, workspace_id)`) easily transitions to authenticated user/organization IDs (`user_id` / `org_id`) in future SaaS releases without changing frontend API integration.

