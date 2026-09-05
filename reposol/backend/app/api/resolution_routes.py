from fastapi import APIRouter, Body, Depends
from typing import Dict, Any, Optional

from app.dependencies import get_workspace_id
from app.services.resolution_service import (
    resolve_profile, resolve_profile_inline, resolve_ssp, resolve_ssp_inline,
    resolve_assessment_plan, resolve_assessment_plan_inline,
    get_control_tree,
    detect_modify_conflicts, _collect_all_control_ids, _collect_all_param_ids
)

router = APIRouter(prefix="/api/resolve", tags=["resolution"])

@router.get("/profile/{profile_id}")
async def resolve_profile_endpoint(profile_id: str, workspace_id: str = Depends(get_workspace_id)) -> Dict[str, Any]:
    return await resolve_profile(workspace_id, profile_id)

@router.post("/profile/preview")
async def preview_resolve_profile(
    body: Dict[str, Any] = Body(...),
    workspace_id: str = Depends(get_workspace_id)
) -> Dict[str, Any]:
    """
    Resolves an unsaved profile document in-memory.
    Returns resolved catalog + conflict report for live preview.
    """
    profile = body.get("profile", body)
    while isinstance(profile, dict) and "profile" in profile and len(profile) == 1:
        profile = profile["profile"]
    resolved = await resolve_profile_inline(workspace_id, profile)
    conflicts = resolved.get("conflicts")

    return {
        "controls": resolved.get("controls", []),
        "groups": resolved.get("groups", []),
        "all_controls": resolved.get("all_controls", []),
        "all_groups": resolved.get("all_groups", []),
        "imported_sources": resolved.get("imported_sources", []),
        "excluded_control_ids": resolved.get("excluded_control_ids", []),
        "source_catalog_id": resolved.get("source_catalog_id"),
        "source_catalog_title": resolved.get("source_catalog_title"),
        "conflicts": conflicts
    }

@router.get("/ssp/{ssp_id}")
async def resolve_ssp_endpoint(ssp_id: str, workspace_id: str = Depends(get_workspace_id)) -> Dict[str, Any]:
    return await resolve_ssp(workspace_id, ssp_id)

@router.post("/ssp/preview")
async def preview_resolve_ssp(
    body: Dict[str, Any] = Body(...),
    workspace_id: str = Depends(get_workspace_id)
) -> Dict[str, Any]:
    """
    Resolves an unsaved SSP document in-memory.
    Returns resolved control tree + parameter cascade + implementation summary for live preview.
    """
    ssp = body.get("system-security-plan", body)
    while isinstance(ssp, dict) and "system-security-plan" in ssp and len(ssp) == 1:
        ssp = ssp["system-security-plan"]
    resolved = await resolve_ssp_inline(workspace_id, ssp)
    return resolved

@router.get("/assessment-plan/{ap_id}")
@router.get("/assessment-plans/{ap_id}")
async def resolve_assessment_plan_endpoint(ap_id: str, workspace_id: str = Depends(get_workspace_id)) -> Dict[str, Any]:
    """
    Resolves a saved Assessment Plan document from disk.
    Returns target SSP resolution, scoping coverage metrics, subjects, and timeline preview.
    """
    return await resolve_assessment_plan(workspace_id, ap_id)

@router.post("/assessment-plan/preview")
@router.post("/assessment-plans/preview")
async def preview_resolve_assessment_plan(
    body: Dict[str, Any] = Body(...),
    workspace_id: str = Depends(get_workspace_id)
) -> Dict[str, Any]:
    """
    Resolves an unsaved Assessment Plan document in-memory.
    Returns target SSP resolution, scoping coverage metrics, subjects, and timeline preview.
    """
    ap = body.get("assessment-plan", body)
    while isinstance(ap, dict) and "assessment-plan" in ap and len(ap) == 1:
        ap = ap["assessment-plan"]
    ssp = body.get("ssp") or body.get("system-security-plan")
    return await resolve_assessment_plan_inline(workspace_id, ap, ssp=ssp)

@router.get("/tree/{stage}/{doc_id}")
async def get_control_tree_endpoint(stage: str, doc_id: str, workspace_id: str = Depends(get_workspace_id)) -> Dict[str, Any]:
    return await get_control_tree(workspace_id, stage, doc_id)

