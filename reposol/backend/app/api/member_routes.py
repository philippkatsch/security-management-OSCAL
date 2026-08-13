from fastapi import APIRouter, Depends, HTTPException, status
import aiosqlite
from typing import List
from datetime import datetime, timezone

from ..auth.schemas import WorkspaceMemberResponse, WorkspaceInviteRequest, WorkspaceRoleUpdateRequest
from ..auth.database import get_db
from ..dependencies import get_current_user, require_role

router = APIRouter(prefix="/api/workspaces/{workspace_id}/members", tags=["members"])

@router.get("/", response_model=List[WorkspaceMemberResponse])
async def list_members(
    workspace_id: str,
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    await require_role(workspace_id, current_user, "viewer", db)
    
    query = """
    SELECT wm.user_id, u.email, u.name, wm.role, wm.created_at
    FROM workspace_members wm
    JOIN users u ON u.id = wm.user_id
    WHERE wm.workspace_id = ?
    """
    async with db.execute(query, (workspace_id,)) as cursor:
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]

@router.post("/", response_model=WorkspaceMemberResponse)
async def invite_member(
    workspace_id: str,
    request: WorkspaceInviteRequest,
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    await require_role(workspace_id, current_user, "owner", db)
    
    if request.role not in ["viewer", "editor", "owner"]:
        raise HTTPException(status_code=400, detail="Invalid role")
        
    async with db.execute("SELECT id, name FROM users WHERE email = ?", (request.email,)) as cursor:
        user = await cursor.fetchone()
        
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    now = datetime.now(timezone.utc).isoformat()
    try:
        await db.execute(
            """
            INSERT INTO workspace_members (user_id, workspace_id, role, invited_by, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (user["id"], workspace_id, request.role, current_user["user_id"], now)
        )
        await db.commit()
    except aiosqlite.IntegrityError:
        raise HTTPException(status_code=400, detail="User is already a member")
        
    return WorkspaceMemberResponse(
        user_id=user["id"],
        email=request.email,
        name=user["name"],
        role=request.role,
        created_at=now
    )

@router.put("/{user_id}", response_model=WorkspaceMemberResponse)
async def update_member_role(
    workspace_id: str,
    user_id: str,
    request: WorkspaceRoleUpdateRequest,
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    await require_role(workspace_id, current_user, "owner", db)
    
    if request.role not in ["viewer", "editor", "owner"]:
        raise HTTPException(status_code=400, detail="Invalid role")
        
    async with db.execute(
        "UPDATE workspace_members SET role = ? WHERE workspace_id = ? AND user_id = ?",
        (request.role, workspace_id, user_id)
    ) as cursor:
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Member not found")
            
    await db.commit()
    
    # fetch updated
    query = """
    SELECT wm.user_id, u.email, u.name, wm.role, wm.created_at
    FROM workspace_members wm
    JOIN users u ON u.id = wm.user_id
    WHERE wm.workspace_id = ? AND wm.user_id = ?
    """
    async with db.execute(query, (workspace_id, user_id)) as cursor:
        row = await cursor.fetchone()
        return dict(row)

@router.delete("/{user_id}")
async def remove_member(
    workspace_id: str,
    user_id: str,
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db)
):
    await require_role(workspace_id, current_user, "owner", db)
    
    async with db.execute(
        "DELETE FROM workspace_members WHERE workspace_id = ? AND user_id = ?",
        (workspace_id, user_id)
    ) as cursor:
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Member not found")
            
    await db.commit()
    return {"message": "Member removed"}
