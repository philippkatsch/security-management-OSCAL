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
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, RedirectResponse
from fastapi import HTTPException

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

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        if full_path.startswith("api") or full_path.startswith("health"):
            raise HTTPException(status_code=404, detail="Not Found")

        # Canonical URL enforcement: redirect trailing slashes to avoid duplicate indexing
        if full_path.endswith("/") and full_path.strip("/"):
            return RedirectResponse(url=f"/{full_path.rstrip('/')}", status_code=308)

        # Defense-in-depth: immediately reject any explicit path traversal tokens
        normalized_segments = full_path.replace("\\", "/").split("/")
        if ".." in normalized_segments or any(seg.startswith("..") for seg in normalized_segments):
            raise HTTPException(status_code=403, detail="Forbidden")

        base_dir = Path(frontend_dist).resolve()
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
