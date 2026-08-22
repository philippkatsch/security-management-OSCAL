from fastapi import APIRouter, Depends
from typing import Dict, Any

from app.dependencies import get_workspace_id
from app.services.resolution_service import resolve_profile, resolve_ssp, get_control_tree, get_profile_baseline_diff

router = APIRouter(prefix="/api/resolve", tags=["resolution"])

@router.get("/profile/{profile_id}")
async def resolve_profile_endpoint(profile_id: str, workspace_id: str = Depends(get_workspace_id)) -> Dict[str, Any]:
    return await resolve_profile(workspace_id, profile_id)

@router.get("/profile/{profile_id}/diff/{catalog_id}")
async def get_profile_baseline_diff_endpoint(
    profile_id: str,
    catalog_id: str,
    workspace_id: str = Depends(get_workspace_id)
) -> Dict[str, Any]:
    return await get_profile_baseline_diff(workspace_id, profile_id, catalog_id)

@router.get("/ssp/{ssp_id}")
async def resolve_ssp_endpoint(ssp_id: str, workspace_id: str = Depends(get_workspace_id)) -> Dict[str, Any]:
    return await resolve_ssp(workspace_id, ssp_id)

@router.get("/tree/{stage}/{doc_id}")
async def get_control_tree_endpoint(stage: str, doc_id: str, workspace_id: str = Depends(get_workspace_id)) -> Dict[str, Any]:
    return await get_control_tree(workspace_id, stage, doc_id)

