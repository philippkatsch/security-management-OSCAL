from app.api.document_routes import router as document_router
from app.api.version_routes import router as version_router
from app.api.workspace_routes import router as workspace_router
from app.api.import_routes import import_router
from app.api.auth_routes import router as auth_router
from app.api.member_routes import router as member_router
from app.api.audit_routes import router as audit_router
from app.api.resolution_routes import router as resolution_router

routers = [version_router, document_router, workspace_router, import_router, auth_router, member_router, audit_router, resolution_router]
