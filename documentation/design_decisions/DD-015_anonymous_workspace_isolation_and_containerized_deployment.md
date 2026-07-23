# DD-015: Anonymous Workspace Isolation & Containerized Fly.io Deployment

## Status: Accepted
## Date: 2026-07-23
## Decision Makers: Development Team

## Context
Reposol is being prepared for public online demonstration and open-source self-hosting.
When hosted publicly without authentication, multiple concurrent users editing documents against a shared storage directory would overwrite each other's OSCAL files. Furthermore, deploying separate frontend static hosting and backend API services introduces CORS configuration overhead and double maintenance.

To solve this without creating a forced authentication barrier for public demo users, we need an architecture that provides isolated document scopes per browser session and allows single-container deployment (Option A) on platforms like Fly.io.

## Decisions

### 1. Header-Driven Anonymous Workspace Isolation & Master Template Seeding
- The frontend (`api.js`) maintains an anonymous session UUID in browser `localStorage` (e.g. `session-8f3a9b12-...`) or URL query parameter (`?w=...`). All components (`CatalogViewer.jsx`, `DocumentEditor.jsx`, `ImportWizard.jsx`, `MappingViewer.jsx`, etc.) must use `authFetch` for all `/api/` endpoints.
- Every outgoing API request attaches the `X-Workspace-ID` HTTP header.
- The backend (`storage.py` and `routes.py`) inspects `X-Workspace-ID`. When present, storage functions resolve the data directory to `reposol/data/workspaces/{workspace_id}/{stage}/`.
- **Auto-Seeding**: When a workspace is first created, `storage.py` automatically copies master sample templates from `reposol/data/templates/{stage}/` into `reposol/data/workspaces/{workspace_id}/{stage}/` so new users are immediately greeted with sample OSCAL Catalogs, Profiles, and SSPs.
- When no header is provided (such as in local dev mode or automated Pytest runs), storage defaults to `reposol/data/{stage}/`.

### 2. Multi-Stage Docker Build Architecture
A root `Dockerfile` defines a two-stage build:
1. **Frontend Stage (`node:18-alpine`)**: Installs frontend dependencies and runs `npm run build` to generate `reposol/frontend/dist`.
2. **Runtime Stage (`python:3.11-slim`)**: Installs backend Python dependencies (`requirements.txt`), copies `reposol/backend`, injects the built static `dist/` directory, and copies master templates (`COPY reposol/data/templates ./data/templates`).

### 3. FastAPI Static Asset & SPA Route Serving
In `reposol/backend/app/main.py`:
- Static files are served at `/` using `fastapi.staticfiles.StaticFiles`.
- A fallback handler serves `index.html` for non-API client-side routes to support direct URL navigation without 404 errors.

### 4. Fly.io Deployment Configuration & Master Template Bundling
- `fly.toml` specifies Fly.io app configuration, mapping internal port 8000 to public HTTP/HTTPS ports 80/443 in region `fra` (Frankfurt).
- `.dockerignore` excludes temporary user session workspaces (`reposol/data/workspaces/*`) and uploads (`reposol/data/uploads/*`) while explicitly including master templates (`reposol/data/templates`) so they are available in remote container deployments.

### 5. Master Templates Admin Mode & Localhost Guard (`?w=master` / `?w=templates`)
- When `workspace_id` is set to `"master"` or `"templates"` (via URL parameter `?w=master` or `?w=templates`), `storage.py` inspects the request origin.
- **Localhost Guard**: Modification of Master Templates is **strictly restricted to requests originating from `localhost` / `127.0.0.1`** (or when `ALLOW_MASTER_EDIT=true` environment variable is set).
- On public deployments (such as Fly.io), any attempt to modify or delete documents in the `master` workspace is rejected with `403 Forbidden` to guarantee master template immutability online.
- When accessed locally on `localhost`, saves and deletions write directly to `reposol/data/templates/catalogs/` and `reposol/data/templates/profiles/`.
- Future user sessions (`session-xyz`) will automatically receive the newly edited master templates upon initial creation.
- The UI displays a `👑 Master Templates Mode (Local Admin)` indicator badge in the header/navigation bar to notify the maintainer that they are modifying global seed templates locally.


## Consequences
- **Zero Friction Demo**: Users can open the live site and immediately edit SSPs without signing up.
- **Multi-User Safety**: Concurrent demo users work in isolated workspaces without data collisions.
- **Zero Cost Hosting**: Fits within the free tier allowance of Fly.io or similar container hosts.
- **Future-Proof SaaS Path**: The storage abstraction (`get_stage_dir(stage, workspace_id)`) easily transitions to authenticated user/organization IDs (`user_id` / `org_id`) in future SaaS releases without changing frontend API integration.

