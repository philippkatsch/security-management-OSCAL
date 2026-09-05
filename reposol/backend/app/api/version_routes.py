from fastapi import APIRouter, HTTPException, Depends, Request, Body
from typing import List, Dict, Any, Optional
from jsonschema import ValidationError

from app.dependencies import get_workspace_id, require_write_permission
from app.constants import normalize_stage, validation_error_response, STAGE_ROOT_KEYS, DRAFT_SUFFIX
from app.services.document_service import (
    get_document_versions,
    get_document_version,
    save_document_version,
    delete_document_version,
)
from app.validation import validate_document
from app.repositories.document_repository import is_valid_uuid

router = APIRouter()

@router.get("/api/documents/{stage}/{doc_id:path}/versions", response_model=List[Dict[str, Any]])
async def list_doc_versions(stage: str, doc_id: str, ws_id: str = Depends(get_workspace_id)):
    """List all versions of a specific document."""
    normalized = normalize_stage(stage)
    if not is_valid_uuid(doc_id):
        raise HTTPException(status_code=400, detail=f"Invalid UUID format: '{doc_id}'")
    try:
        return await get_document_versions(normalized, doc_id, workspace_id=ws_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/documents/{stage}/{doc_id:path}/versions/{version}", response_model=Dict[str, Any])
async def get_doc_version(stage: str, doc_id: str, version: str, ws_id: str = Depends(get_workspace_id)):
    """Get a specific version of a document."""
    normalized = normalize_stage(stage)
    if not is_valid_uuid(doc_id):
        raise HTTPException(status_code=400, detail=f"Invalid UUID format: '{doc_id}'")
    try:
        return await get_document_version(normalized, doc_id, version, workspace_id=ws_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Version {version} of document {doc_id} not found")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/api/documents/{stage}/{doc_id:path}/versions/{version}")
async def delete_doc_version(stage: str, doc_id: str, version: str, ws_id: str = Depends(require_write_permission)):
    """Delete a specific version of a document."""
    normalized = normalize_stage(stage)
    if not is_valid_uuid(doc_id):
        raise HTTPException(status_code=400, detail=f"Invalid UUID format: '{doc_id}'")
    try:
        await delete_document_version(normalized, doc_id, version, workspace_id=ws_id)
        return {"status": "success", "message": f"Version {version} deleted successfully"}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Version {version} of document {doc_id} not found")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/documents/{stage}/{doc_id:path}/versions")
async def save_doc_version(stage: str, doc_id: str, body: Dict[str, Any] = Body(...), remarks: Optional[str] = None, is_draft: bool = False, ws_id: str = Depends(get_workspace_id)):
    """Save a specific version of a document."""
    normalized = normalize_stage(stage)
    if not is_valid_uuid(doc_id):
        raise HTTPException(status_code=400, detail=f"Invalid UUID format: '{doc_id}'")

    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    # Extract version
    root_key = STAGE_ROOT_KEYS[normalized]
    try:
        version = body[root_key]["metadata"]["version"]
    except (KeyError, TypeError):
        raise HTTPException(status_code=400, detail="Missing version in document metadata")

    is_draft = bool(is_draft or version.endswith(DRAFT_SUFFIX) or "draft" in version.lower())

    try:
        await save_document_version(normalized, doc_id, version, body, is_draft=is_draft, remarks=remarks, workspace_id=ws_id)
        return {"status": "success", "version": version}
    except ValidationError as e:
        return validation_error_response(e)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal persistence error: {str(e)}")
