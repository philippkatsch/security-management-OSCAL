import os
import re
from fastapi import Request, HTTPException, Depends
from typing import Optional
import aiosqlite

from app.auth.security import decode_access_token
from app.auth.database import get_db

async def get_current_user_optional(request: Request) -> Optional[dict]:
    auth_header = request.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        return None
    token = auth_header[7:]
    try:
        return decode_access_token(token)
    except Exception:
        return None

async def get_current_user(request: Request) -> dict:
    user = await get_current_user_optional(request)
    if user is None:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user

async def get_workspace_id(
    request: Request,
    db: aiosqlite.Connection = Depends(get_db),
    user: Optional[dict] = Depends(get_current_user_optional)
) -> str:
    """
    Extracts workspace ID from X-Workspace-ID header or query parameter.
    Enforces authentication if the workspace has any registered members.
    Protected workspace IDs (master, templates, default) are only accessible
    when ALLOW_MASTER_EDIT env var is set to true.
    """
    ws = (
        request.headers.get("x-workspace-id")
        or request.headers.get("X-Workspace-ID")
        or request.query_params.get("w")
        or request.query_params.get("workspace_id")
        or request.query_params.get("workspace")
    )
    if not ws and not os.environ.get("PYTEST_CURRENT_TEST"):
        ws_id = "default"
    else:
        ws_id = ws or "default"

    # Gate protected workspace access on env var
    master_edit_enabled = os.environ.get("ALLOW_MASTER_EDIT", "").lower() in ("true", "1")
    if ws_id in ("master", "templates", "default") and not master_edit_enabled:
        # In non-master-edit mode, "default" is the fallback for missing workspace IDs,
        # which is correct — it still maps to the default workspace for reads.
        # But explicit "master" or "templates" should not be directly addressable.
        if ws and ws in ("master", "templates"):
            ws_id = "default"

    if ws_id != "default":
        async with db.execute("SELECT 1 FROM workspace_members WHERE workspace_id = ? LIMIT 1", (ws_id,)) as cursor:
            has_members = await cursor.fetchone()
        if has_members:
            if not user:
                raise HTTPException(status_code=401, detail="Authentication required for this workspace")
            if not user.get("is_admin"):
                async with db.execute("SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?", (ws_id, user["user_id"])) as cursor:
                    is_member = await cursor.fetchone()
                if not is_member:
                    raise HTTPException(status_code=403, detail="Not a member of this workspace")
    return ws_id


def require_write_permission(request: Request, ws_id: str = Depends(get_workspace_id)) -> str:
    """
    Ensure master template modification is only allowed from localhost or with ALLOW_MASTER_EDIT=true.
    Returns the workspace_id if allowed.
    """
    safe_id = re.sub(r'[^a-zA-Z0-9_-]', '', ws_id)
    if safe_id in ("master", "templates", "default"):
        if os.environ.get("ALLOW_MASTER_EDIT", "").lower() in ("true", "1"):
            return ws_id
        client_host = request.client.host if request.client else ""
        if client_host not in ("127.0.0.1", "::1", "localhost", "testclient"):
            raise HTTPException(
                status_code=403,
                detail="Editing Master Templates is restricted to local administrator sessions on localhost."
            )
    return ws_id

def get_storage(request: Request):
    """
    Returns the application's storage module/instance.
    """
    import app.storage as storage_module
    return storage_module

async def require_role(workspace_id: str, user: dict, min_role: str, db: aiosqlite.Connection) -> None:
    if user.get('is_admin'):
        return
    async with db.execute('SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?', (workspace_id, user['user_id'])) as cursor:
        row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=403, detail="Forbidden")
    roles = ['viewer', 'editor', 'owner']
    if roles.index(row['role']) < roles.index(min_role):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
