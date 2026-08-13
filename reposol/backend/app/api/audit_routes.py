from fastapi import APIRouter, Depends, Query
import aiosqlite
from typing import List

from ..auth.schemas import AuditLogEntry
from ..auth.database import get_db
from ..dependencies import get_current_user, require_role

router = APIRouter(prefix="/api/audit-log", tags=["audit"])

@router.get("/", response_model=List[AuditLogEntry])
async def get_audit_log(
    workspace_id: str = Query(...),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    await require_role(workspace_id, current_user, "owner", db)
    
    query = """
    SELECT id, user_email, action, resource_type, resource_id, timestamp, details
    FROM audit_log
    WHERE workspace_id = ?
    ORDER BY timestamp DESC
    LIMIT ? OFFSET ?
    """
    
    async with db.execute(query, (workspace_id, limit, offset)) as cursor:
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]
