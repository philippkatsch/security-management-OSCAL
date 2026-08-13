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
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi import HTTPException

dist_dir_relative = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../frontend/dist"))
dist_dir_docker = os.path.abspath("/app/frontend/dist")

frontend_dist = dist_dir_relative if os.path.exists(dist_dir_relative) else (dist_dir_docker if os.path.exists(dist_dir_docker) else None)

if frontend_dist:
    assets_dir = os.path.join(frontend_dist, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        if full_path.startswith("api") or full_path.startswith("health"):
            raise HTTPException(status_code=404, detail="Not Found")
        file_path = os.path.abspath(os.path.join(frontend_dist, full_path))
        # Prevent path traversal: ensure resolved path stays within frontend_dist
        if not file_path.startswith(os.path.abspath(frontend_dist)):
            raise HTTPException(status_code=403, detail="Forbidden")
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(frontend_dist, "index.html"))

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
