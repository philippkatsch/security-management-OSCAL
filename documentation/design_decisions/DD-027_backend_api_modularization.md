# DD-027: Backend API Modularization

## Status: Accepted
## Date: 2026-08-09
## Decision Makers: Development Team

## Context
`routes.py` (17KB) and `import_routes.py` (13KB) contain mixed business logic and routing. `async def` routes call synchronous blocking file I/O, blocking the FastAPI event loop. Workspace ID extraction and permission checks are duplicated in every route.

## Decisions
1. Full async I/O using `aiofiles` for all file operations.
2. Split `routes.py` into domain-specific routers in `app/api/` (`document_routes.py`, `version_routes.py`, `workspace_routes.py`, `import_routes.py`).
3. Extract business logic to service layer (`document_service.py`, `import_service.py`).
4. Create `app/dependencies.py` for FastAPI `Depends()` injection (`get_workspace_id`, `require_write_permission`).
5. Centralize magic strings in `constants.py`.

## Consequences
Non-blocking I/O under concurrent load, clean separation of concerns, DRY route handlers, easier unit testing of services.
