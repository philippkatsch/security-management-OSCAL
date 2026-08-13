from fastapi import APIRouter, HTTPException, Depends
from app.dependencies import require_write_permission
from app.repositories.workspace_repository import delete_workspace

router = APIRouter()

@router.delete("/api/workspaces/{workspace_id}")
async def delete_workspace_endpoint(workspace_id: str, ws_id: str = Depends(require_write_permission)):
    """Delete an entire test workspace and all its documents.

    Protected workspace IDs (default, master, templates) cannot be deleted.
    """
    try:
        await delete_workspace(workspace_id)
        return {"status": "deleted", "workspace_id": workspace_id}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
