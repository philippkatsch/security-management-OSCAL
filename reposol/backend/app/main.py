import os
import sys

# Ensure backend directory is in sys.path for app module imports in Docker / Uvicorn
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import routers
from app.storage import sync_master_templates
from app.auth.database import init_db

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    await sync_master_templates()
    yield

app = FastAPI(
    title="Reposol OSCAL Management Backend",
    description="Backend service for editing, modifying, and managing NIST OSCAL models.",
    version="1.0.0",
    lifespan=lifespan
)

# Explicitly allow React frontend origins or read from env
allowed_origins_env = os.getenv("REPOSOL_ALLOWED_ORIGINS", os.getenv("ALLOWED_ORIGINS", ""))
if allowed_origins_env:
    origins = [origin.strip() for origin in allowed_origins_env.split(",") if origin.strip()]
else:
    origins = [
        "http://127.0.0.1:1001",
        "http://localhost:1001",
        "http://[::1]:1001"
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.constants import OSCALValidationException
from fastapi import Request
from fastapi.exceptions import RequestValidationError

@app.exception_handler(RequestValidationError)
async def request_validation_exception_handler(request: Request, exc: RequestValidationError):
    from fastapi.responses import JSONResponse
    return JSONResponse(
        status_code=400,
        content={"detail": "Invalid JSON body"}
    )

@app.exception_handler(OSCALValidationException)
async def oscal_validation_exception_handler(request: Request, exc: OSCALValidationException):
    from fastapi.responses import JSONResponse
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail, "errors": exc.errors}
    )

for router in routers:
    app.include_router(router)

# Mount static assets and handle SPA routing fallback when built frontend is present
from pathlib import Path
from typing import Optional
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, RedirectResponse
from fastapi import HTTPException, Request

from app.constants import STAGE_MAPPING

dist_dir_relative = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../frontend/dist"))
dist_dir_docker = os.path.abspath("/app/frontend/dist")

frontend_dist = dist_dir_relative if os.path.exists(dist_dir_relative) else (dist_dir_docker if os.path.exists(dist_dir_docker) else None)

if frontend_dist:
    assets_dir = os.path.join(frontend_dist, "assets")
    if os.path.exists(assets_dir):
        class ImmutableStaticFiles(StaticFiles):
            async def get_response(self, path: str, scope):
                response = await super().get_response(path, scope)
                response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
                return response

        app.mount("/assets", ImmutableStaticFiles(directory=assets_dir), name="assets")

HTML_CACHE_HEADERS = {"Cache-Control": "no-cache, no-store, must-revalidate"}

LEGACY_ROUTE_REDIRECTS: dict[str, str] = {
    alias.lower(): canonical
    for alias, canonical in STAGE_MAPPING.items()
    if alias.lower() != canonical
}

def resolve_frontend_dist() -> Optional[str]:
    """Dynamically determine frontend dist directory if created after module startup."""
    global frontend_dist
    if frontend_dist and os.path.exists(frontend_dist):
        return frontend_dist
    if os.path.exists(dist_dir_relative):
        frontend_dist = dist_dir_relative
        return frontend_dist
    if os.path.exists(dist_dir_docker):
        frontend_dist = dist_dir_docker
        return frontend_dist
    return None

@app.api_route("/{full_path:path}", methods=["GET", "HEAD"])
async def serve_spa(full_path: str, request: Request = None):
    if full_path.startswith("api") or full_path.startswith("health"):
        raise HTTPException(status_code=404, detail="Not Found")

    # Defense-in-depth: immediately reject any explicit path traversal tokens
    raw_segments = full_path.replace("\\", "/").split("/")
    if ".." in raw_segments or any(seg.startswith("..") for seg in raw_segments):
        raise HTTPException(status_code=403, detail="Forbidden")

    # Strip any trailing 'index.html' segment to enforce canonical clean URLs
    # e.g. /index.html -> /, /catalogs/index.html -> /catalogs, /components/index.html -> /component-definitions
    normalized_segments = [seg for seg in full_path.replace("\\", "/").strip("/").split("/") if seg]
    is_index_html = False
    if normalized_segments and normalized_segments[-1].lower() == "index.html":
        is_index_html = True
        normalized_segments = normalized_segments[:-1]

    # Legacy/alias stage redirects (HTTP 301 Moved Permanently)
    # e.g. /components -> /component-definitions, /ssp -> /ssps, /poam -> /poams, /mappings -> /control-mappings
    if normalized_segments and normalized_segments[0].lower() in LEGACY_ROUTE_REDIRECTS:
        canonical_stage = LEGACY_ROUTE_REDIRECTS[normalized_segments[0].lower()]
        new_segments = [canonical_stage] + normalized_segments[1:]
        clean_path = "/" + "/".join(new_segments)
        query = request.url.query if request and getattr(request, "url", None) else ""
        target_url = f"{clean_path}?{query}" if query else clean_path
        return RedirectResponse(url=target_url, status_code=301)

    # Redirect /index.html -> / or /catalogs/index.html -> /catalogs (HTTP 301 Moved Permanently)
    if is_index_html:
        clean_path = "/" + "/".join(normalized_segments)
        query = request.url.query if request and getattr(request, "url", None) else ""
        target_url = f"{clean_path}?{query}" if query else clean_path
        return RedirectResponse(url=target_url, status_code=301)

    # Canonical URL enforcement: redirect trailing slashes to avoid duplicate indexing
    if full_path.endswith("/") and full_path.strip("/"):
        clean_path = f"/{full_path.rstrip('/')}"
        query = request.url.query if request and getattr(request, "url", None) else ""
        target_url = f"{clean_path}?{query}" if query else clean_path
        return RedirectResponse(url=target_url, status_code=308)

    current_dist = resolve_frontend_dist()
    if not current_dist:
        raise HTTPException(status_code=404, detail="Frontend root not found")

    base_dir = Path(current_dist).resolve()
    try:
        req_path = (base_dir / full_path).resolve()
    except (ValueError, RuntimeError):
        raise HTTPException(status_code=400, detail="Invalid path")

    # Prevent path traversal: ensure resolved path is strictly inside base_dir
    if not req_path.is_relative_to(base_dir):
        raise HTTPException(status_code=403, detail="Forbidden")

    # 1. Direct file match (e.g., /favicon.ico, /robots.txt, /sitemap.xml)
    if req_path.is_file():
        headers = HTML_CACHE_HEADERS if req_path.suffix == ".html" else None
        return FileResponse(str(req_path), headers=headers)

    # 2. Pre-rendered route index match (e.g. /catalogs -> dist/catalogs/index.html)
    prerendered_file = req_path / "index.html"
    if prerendered_file.is_file():
        return FileResponse(str(prerendered_file), headers=HTML_CACHE_HEADERS)

    # 3. SPA Root fallback
    root_index = base_dir / "index.html"
    if root_index.is_file():
        return FileResponse(str(root_index), headers=HTML_CACHE_HEADERS)

    raise HTTPException(status_code=404, detail="Frontend root not found")

if __name__ == "__main__":
    import uvicorn
    host = os.getenv("REPOSOL_API_HOST", os.getenv("HOST", "127.0.0.1"))
    port_env = os.getenv("REPOSOL_API_PORT", os.getenv("PORT", "1000"))
    try:
        port = int(port_env)
    except ValueError:
        port = 1000
    reload = os.getenv("REPOSOL_API_RELOAD", "True").lower() == "true"
    app_import = "app.main:app" if os.path.basename(os.getcwd()) != "app" else "main:app"
    uvicorn.run(app_import, host=host, port=port, reload=reload)
