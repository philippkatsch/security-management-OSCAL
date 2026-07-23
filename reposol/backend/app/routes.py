import json
import re
from fastapi import APIRouter, HTTPException, Response, Request, UploadFile, File
from fastapi.responses import JSONResponse, FileResponse
from typing import List, Dict, Any, Optional
from jsonschema import ValidationError
import shutil
import uuid
import os
from app.validation import validate_document, STAGE_ROOT_KEYS
from app.storage import (
    list_documents, get_document, save_document, delete_document, is_valid_uuid,
    DATA_DIR, is_safe_subdir, get_document_versions, get_document_version, save_document_version,
    delete_document_version, preprocess_profile_for_saving, preprocess_catalog_for_saving
)

router = APIRouter()

# Stage normalization mapping
STAGE_MAPPING = {
    "catalog": "catalogs",
    "catalogs": "catalogs",
    "profile": "profiles",
    "profiles": "profiles",
    "ssp": "ssps",
    "ssps": "ssps",
    "component": "component-definitions",
    "components": "component-definitions",
    "component-definition": "component-definitions",
    "component-definitions": "component-definitions",
    "assessment-plan": "assessment-plans",
    "assessment-plans": "assessment-plans",
    "assessment-result": "assessment-results",
    "assessment-results": "assessment-results",
    "poam": "poams",
    "poams": "poams",
    "control-mapping": "control-mappings",
    "control-mappings": "control-mappings",
    "mapping": "control-mappings",
    "mappings": "control-mappings",
}

def normalize_stage(stage: str) -> str:
    """Normalizes the stage name based on the specification mapping."""
    normalized = STAGE_MAPPING.get(stage.lower())
    if not normalized:
        raise HTTPException(status_code=400, detail=f"Invalid stage: {stage}")
    return normalized

def get_ws_id(request: Request) -> Optional[str]:
    """Extracts workspace ID from X-Workspace-ID header or w/workspace_id/workspace query parameter."""
    ws = (
        request.headers.get("x-workspace-id")
        or request.headers.get("X-Workspace-ID")
        or request.query_params.get("w")
        or request.query_params.get("workspace_id")
        or request.query_params.get("workspace")
    )
    if not ws and not os.environ.get("PYTEST_CURRENT_TEST"):
        return "default"
    return ws

def check_master_write_permission(request: Request, ws_id: Optional[str]):
    """Ensure master template modification is only allowed from localhost or with ALLOW_MASTER_EDIT=true."""
    if not ws_id:
        return
    safe_id = re.sub(r'[^a-zA-Z0-9_-]', '', ws_id)
    if safe_id in ("master", "templates"):
        if os.environ.get("ALLOW_MASTER_EDIT", "").lower() in ("true", "1"):
            return
        client_host = request.client.host if request.client else ""
        host_header = request.headers.get("host", "").split(":")[0]
        if not (client_host in ("127.0.0.1", "::1", "localhost") or host_header in ("127.0.0.1", "localhost")):
            raise HTTPException(
                status_code=403,
                detail="Editing Master Templates is restricted to local administrator sessions on localhost."
            )

@router.get("/health")
def health_check():
    """Health check endpoint."""
    return {"status": "ok"}

@router.get("/api/documents/{stage}", response_model=List[Dict[str, Any]])
def list_docs(stage: str, request: Request):
    """List all saved documents for a specific stage."""
    normalized = normalize_stage(stage)
    ws_id = get_ws_id(request)
    return list_documents(normalized, workspace_id=ws_id)

@router.get("/api/documents/{stage}/{doc_id:path}/versions", response_model=List[Dict[str, Any]])
def list_doc_versions(stage: str, doc_id: str, request: Request):
    """List all versions of a specific document."""
    normalized = normalize_stage(stage)
    if not is_valid_uuid(doc_id):
        raise HTTPException(status_code=400, detail=f"Invalid UUID format: '{doc_id}'")
    try:
        ws_id = get_ws_id(request)
        return get_document_versions(normalized, doc_id, workspace_id=ws_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/documents/{stage}/{doc_id:path}/versions/{version}", response_model=Dict[str, Any])
def get_doc_version(stage: str, doc_id: str, version: str, request: Request):
    """Get a specific version of a document."""
    normalized = normalize_stage(stage)
    if not is_valid_uuid(doc_id):
        raise HTTPException(status_code=400, detail=f"Invalid UUID format: '{doc_id}'")
    try:
        ws_id = get_ws_id(request)
        return get_document_version(normalized, doc_id, version, workspace_id=ws_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Version {version} of document {doc_id} not found")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/api/documents/{stage}/{doc_id:path}/versions/{version}")
def delete_doc_version(stage: str, doc_id: str, version: str, request: Request):
    """Delete a specific version of a document."""
    normalized = normalize_stage(stage)
    if not is_valid_uuid(doc_id):
        raise HTTPException(status_code=400, detail=f"Invalid UUID format: '{doc_id}'")
    try:
        ws_id = get_ws_id(request)
        delete_document_version(normalized, doc_id, version, workspace_id=ws_id)
        return {"status": "success", "message": f"Version {version} deleted successfully"}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Version {version} of document {doc_id} not found")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/documents/{stage}/{doc_id:path}/versions")
async def save_doc_version(stage: str, doc_id: str, request: Request, remarks: Optional[str] = None, is_draft: bool = False):
    """Save a specific version of a document."""
    normalized = normalize_stage(stage)
    ws_id = get_ws_id(request)
    if not is_valid_uuid(doc_id):
        raise HTTPException(status_code=400, detail=f"Invalid UUID format: '{doc_id}'")
        
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")
        
    # Extract version
    root_key = STAGE_ROOT_KEYS[normalized]
    try:
        version = body[root_key]["metadata"]["version"]
    except KeyError:
        raise HTTPException(status_code=400, detail="Missing version in document metadata")

    # Automatic revision tracking (US 0.7) - Only for official versions
    from datetime import datetime
    now_str = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    
    metadata = body[root_key].setdefault("metadata", {})
    metadata["last-modified"] = now_str
    
    if not is_draft:
        revisions = metadata.setdefault("revisions", [])
        # Prepend new revision entry
        new_rev = {
            "version": version,
            "last-modified": now_str,
            "oscal-version": metadata.get("oscal-version", "1.1.2"),
            "remarks": remarks or "Version saved"
        }
        revisions.insert(0, new_rev)
        
    if not is_draft:
        try:
            if normalized == "profiles":
                validation_body = preprocess_profile_for_saving(body, persist_local_catalog=False)
            elif normalized == "catalogs":
                validation_body = preprocess_catalog_for_saving(body)
            else:
                validation_body = body
            # Validate schema
            validate_document(normalized, validation_body)
        except ValidationError as e:
            errors = getattr(e, "errors", [])
            return JSONResponse(
                status_code=400,
                content={
                    "detail": f"Validation failed: {e.message}",
                    "errors": errors
                }
            )
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        
    try:
        save_document_version(normalized, doc_id, version, body, is_draft=is_draft, workspace_id=ws_id)
        return {"status": "success", "version": version}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal persistence error: {str(e)}")

@router.get("/api/documents/{stage}/{doc_id:path}", response_model=Dict[str, Any])
def get_doc(stage: str, doc_id: str, request: Request):
    """Get detail of a specific document."""
    normalized = normalize_stage(stage)
    if not is_valid_uuid(doc_id):
        raise HTTPException(status_code=400, detail=f"Invalid UUID format: '{doc_id}'")
    try:
        ws_id = get_ws_id(request)
        return get_document(normalized, doc_id, workspace_id=ws_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Document {doc_id} not found in stage {normalized}")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/api/documents/{stage}")
async def save_doc(stage: str, request: Request, response: Response):
    """Save or update a document (checks schema validation)."""
    normalized = normalize_stage(stage)
    ws_id = get_ws_id(request)
    
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    try:
        if normalized == "profiles":
            validation_body = preprocess_profile_for_saving(body, persist_local_catalog=False, workspace_id=ws_id)
        elif normalized == "catalogs":
            validation_body = preprocess_catalog_for_saving(body)
        else:
            validation_body = body
        # Validate schema
        validate_document(normalized, validation_body, workspace_id=ws_id)
    except ValidationError as e:
        errors = getattr(e, "errors", [])
        return JSONResponse(
            status_code=400,
            content={
                "detail": f"Validation failed: {e.message}",
                "errors": errors
            }
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Extract UUID
    root_key = STAGE_ROOT_KEYS[normalized]
    try:
        doc_id = validation_body[root_key]["uuid"]
    except KeyError:
        raise HTTPException(status_code=400, detail=f"Missing uuid under root key '{root_key}'")

    if not is_valid_uuid(doc_id):
        raise HTTPException(status_code=400, detail=f"Invalid UUID format in document: '{doc_id}'")

    try:
        existed = save_document(normalized, doc_id, body, workspace_id=ws_id)
        response.status_code = 200 if existed else 201
        return get_document(normalized, doc_id, workspace_id=ws_id) if normalized == "profiles" else body
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal persistence error: {str(e)}")

@router.delete("/api/documents/{stage}/{doc_id:path}")
def delete_doc(stage: str, doc_id: str, request: Request, force: bool = False):
    """Delete a document with optional reference integrity check."""
    normalized = normalize_stage(stage)
    ws_id = get_ws_id(request)
    check_master_write_permission(request, ws_id)
    if not is_valid_uuid(doc_id):
        raise HTTPException(status_code=400, detail=f"Invalid UUID format: '{doc_id}'")

    if not force:
        referrers = []
        for s, root_key in STAGE_ROOT_KEYS.items():
            try:
                docs = list_documents(s, workspace_id=ws_id)
            except Exception:
                docs = []
            for doc in docs:
                data = doc.get(root_key, {})
                doc_uuid = data.get("uuid")
                if not doc_uuid or doc_uuid == doc_id:
                    continue
                # Simple check: stringify and check if target UUID is present
                doc_str = json.dumps(doc)
                if doc_id in doc_str:
                    meta = data.get("metadata", {})
                    referrers.append({
                        "uuid": doc_uuid,
                        "title": meta.get("title", "Untitled"),
                        "stage": s
                    })
        if referrers:
            ref_list = ", ".join(f"'{r['title']}' ({r['stage']})" for r in referrers)
            raise HTTPException(
                status_code=409,
                detail=f"This document is referenced by the following documents and cannot be easily deleted: {ref_list}. Use 'force=true' to delete."
            )

    try:
        delete_document(normalized, doc_id, workspace_id=ws_id)
        return {"status": "success", "message": f"Document {doc_id} deleted"}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Document {doc_id} not found in stage {normalized}")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/api/validate/{stage}")
async def validate_doc(stage: str, request: Request):
    """Validate a document against the stage's schema without saving."""
    normalized = normalize_stage(stage)
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")
        
    try:
        if normalized == "profiles":
            validation_body = preprocess_profile_for_saving(body, persist_local_catalog=False)
        elif normalized == "catalogs":
            validation_body = preprocess_catalog_for_saving(body)
        else:
            validation_body = remove_empty_arrays(body)
        validate_document(normalized, validation_body)
        return JSONResponse(status_code=200, content={"status": "valid", "stage": normalized})
    except ValidationError as e:
        errors = getattr(e, "errors", [])
        return JSONResponse(
            status_code=400,
            content={
                "detail": f"Validation failed: {e.message}",
                "errors": errors
            }
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/api/export/{stage}/{doc_id:path}")
def export_doc(stage: str, doc_id: str, request: Request, format: str = "json"):
    """Export a document as a downloadable file (JSON, YAML, or XML)."""
    normalized = normalize_stage(stage)
    ws_id = get_ws_id(request)
    if not is_valid_uuid(doc_id):
        raise HTTPException(status_code=400, detail=f"Invalid UUID format: '{doc_id}'")
    try:
        doc = get_document(normalized, doc_id, for_ui=False, workspace_id=ws_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Document {doc_id} not found in stage {normalized}")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    root_key = STAGE_ROOT_KEYS[normalized]
    title = doc.get(root_key, {}).get("metadata", {}).get("title", "document")
    safe_title = "".join(c if c.isalnum() or c in " -_" else "" for c in title).strip().replace(" ", "_")
    
    format_lower = format.lower()
    if format_lower == "yaml":
        from app.format_converter import serialize_dict_to_yaml
        filename = f"{safe_title}_{doc_id[:8]}.yaml"
        content = serialize_dict_to_yaml(doc)
        media_type = "application/x-yaml"
    elif format_lower == "xml":
        from app.format_converter import serialize_oscal_dict_to_xml
        filename = f"{safe_title}_{doc_id[:8]}.xml"
        try:
            content = serialize_oscal_dict_to_xml(doc)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to serialize to XML: {str(e)}")
        media_type = "application/xml"
    else:
        filename = f"{safe_title}_{doc_id[:8]}.json"
        content = json.dumps(doc, indent=2, ensure_ascii=False)
        media_type = "application/json"

    return Response(
        content=content,
        media_type=media_type,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )

@router.get("/api/recent-documents")
def recent_documents(request: Request):
    """Return a flat list of the most recently modified documents across all stages."""
    ws_id = get_ws_id(request)
    all_docs = []
    for stage, root_key in STAGE_ROOT_KEYS.items():
        try:
            docs = list_documents(stage, workspace_id=ws_id)
            for doc in docs:
                data = doc.get(root_key, {})
                meta = data.get("metadata", {})
                all_docs.append({
                    "stage": stage,
                    "uuid": data.get("uuid", ""),
                    "title": meta.get("title", "Untitled"),
                    "last-modified": meta.get("last-modified", ""),
                    "version": meta.get("version", ""),
                })
        except Exception:
            continue
    all_docs.sort(key=lambda d: d.get("last-modified", ""), reverse=True)
    return all_docs[:10]

# Versions routes moved upstream to avoid wildcard collision


