import json
from fastapi import APIRouter, HTTPException, Depends, Request, Response, Body
from fastapi.responses import JSONResponse
from typing import List, Dict, Any, Optional
from jsonschema import ValidationError

from app.dependencies import get_workspace_id, require_write_permission, get_storage
from app.constants import normalize_stage, validation_error_response, STAGE_ROOT_KEYS
from app.services.document_service import (
    list_documents,
    get_document,
    save_document,
    delete_document,
)
from app.validation import validate_document
from app.repositories.document_repository import is_valid_uuid, validate_etag, get_document as repo_get_document, ETagMismatchError
from app.format_converter import serialize_dict_to_yaml, serialize_oscal_dict_to_xml
from app.services.profile_service import preprocess_profile_for_saving, preprocess_catalog_for_saving, remove_empty_arrays

router = APIRouter()

@router.get("/health")
def health_check():
    """Health check endpoint."""
    return {"status": "ok"}

@router.get("/api/documents/{stage}/count")
async def count_docs(stage: str, ws_id: str = Depends(get_workspace_id)):
    """Return the number of documents for a specific stage (lightweight)."""
    normalized = normalize_stage(stage)
    docs = await list_documents(normalized, workspace_id=ws_id)
    return {"stage": normalized, "count": len(docs)}

@router.get("/api/documents/{stage}", response_model=List[Dict[str, Any]])
async def list_docs(stage: str, ws_id: str = Depends(get_workspace_id)):
    """List all saved documents for a specific stage."""
    normalized = normalize_stage(stage)
    return await list_documents(normalized, workspace_id=ws_id)

@router.get("/api/documents/{stage}/{doc_id:path}", response_model=Dict[str, Any])
async def get_doc(stage: str, doc_id: str, response: Response, ws_id: str = Depends(get_workspace_id)):
    """Get detail of a specific document."""
    normalized = normalize_stage(stage)
    if not is_valid_uuid(doc_id):
        raise HTTPException(status_code=400, detail=f"Invalid UUID format: '{doc_id}'")
    try:
        doc, etag = await get_document(normalized, doc_id, workspace_id=ws_id)
        response.headers["ETag"] = f'"{etag}"'
        return doc
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Document {doc_id} not found in stage {normalized}")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/api/documents/{stage}")
async def save_doc(request: Request, stage: str, response: Response, body: Dict[str, Any] = Body(...), ws_id: str = Depends(get_workspace_id)):
    """Save or update a document (checks schema validation and atomic ETag validation)."""
    normalized = normalize_stage(stage)
    
    root_key = STAGE_ROOT_KEYS[normalized]
    try:
        doc_id = body[root_key]["uuid"]
    except KeyError:
        raise HTTPException(status_code=400, detail=f"Missing uuid under root key '{root_key}'")

    if not is_valid_uuid(doc_id):
        raise HTTPException(status_code=400, detail=f"Invalid UUID format in document: '{doc_id}'")

    if_match = request.headers.get("If-Match")

    try:
        saved_doc, new_etag, existed = await save_document(normalized, doc_id, body, workspace_id=ws_id, if_match=if_match)
        response.status_code = 200 if existed else 201
        response.headers["ETag"] = f'"{new_etag}"'
        
        return saved_doc if normalized == "profiles" else body
    except ETagMismatchError as e:
        return JSONResponse(
            status_code=409,
            content={
                "detail": e.detail,
                "current_document": e.current_doc,
                "current_etag": e.current_etag
            },
            headers={"ETag": f'"{e.current_etag}"'}
        )
    except ValidationError as e:
        return validation_error_response(e)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal persistence error: {str(e)}")

@router.delete("/api/documents/{stage}/{doc_id:path}")
async def delete_doc(stage: str, doc_id: str, force: bool = False, ws_id: str = Depends(require_write_permission)):
    """Delete a document with optional reference integrity check."""
    normalized = normalize_stage(stage)
    if not is_valid_uuid(doc_id):
        raise HTTPException(status_code=400, detail=f"Invalid UUID format: '{doc_id}'")

    try:
        await delete_document(normalized, doc_id, force=force, workspace_id=ws_id)
        return {"status": "success", "message": f"Document {doc_id} deleted"}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Document {doc_id} not found in stage {normalized}")
    except ValueError as e:
        if "referenced by the following documents" in str(e):
            raise HTTPException(status_code=409, detail=str(e))
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/api/validate/{stage}")
async def validate_doc(stage: str, body: Dict[str, Any] = Body(...), ws_id: str = Depends(get_workspace_id)):
    """Validate a document against the stage's schema without saving."""
    normalized = normalize_stage(stage)
        
    try:
        if normalized == "profiles":
            validation_body = await preprocess_profile_for_saving(body, persist_local_catalog=False, workspace_id=ws_id)
        elif normalized == "catalogs":
            validation_body = preprocess_catalog_for_saving(body)
        else:
            validation_body = remove_empty_arrays(body)
        await validate_document(normalized, validation_body, workspace_id=ws_id)
        return {"status": "valid", "stage": normalized}
    except ValidationError as e:
        return validation_error_response(e)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Validation failed: {str(e)}")

@router.get("/api/export/{stage}/{doc_id:path}")
async def export_doc(stage: str, doc_id: str, format: str = "json", ws_id: str = Depends(get_workspace_id)):
    """Export a document as a downloadable file (JSON, YAML, or XML)."""
    normalized = normalize_stage(stage)
    if not is_valid_uuid(doc_id):
        raise HTTPException(status_code=400, detail=f"Invalid UUID format: '{doc_id}'")
    try:
        doc, _ = await get_document(normalized, doc_id, for_ui=False, workspace_id=ws_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Document {doc_id} not found in stage {normalized}")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    root_key = STAGE_ROOT_KEYS[normalized]
    title = doc.get(root_key, {}).get("metadata", {}).get("title", "document")
    safe_title = "".join(c if c.isalnum() or c in " -_" else "" for c in title).strip().replace(" ", "_")
    
    format_lower = format.lower()
    if format_lower == "yaml":
        filename = f"{safe_title}_{doc_id[:8]}.yaml"
        content = serialize_dict_to_yaml(doc)
        media_type = "application/x-yaml"
    elif format_lower == "xml":
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
async def recent_documents(ws_id: str = Depends(get_workspace_id)):
    """Return a flat list of the most recently modified documents across all stages."""
    all_docs = []
    for stage, root_key in STAGE_ROOT_KEYS.items():
        try:
            docs = await list_documents(stage, workspace_id=ws_id)
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


from pydantic import BaseModel
from app.services.import_service import import_findings_from_ar

class ImportFindingsRequest(BaseModel):
    finding_uuids: Optional[List[str]] = None

@router.post("/api/documents/poams/{poam_id}/import-findings/{ar_id}")
async def import_ar_findings_to_poam(
    poam_id: str,
    ar_id: str,
    request_data: Optional[ImportFindingsRequest] = Body(None),
    ws_id: str = Depends(get_workspace_id),
):
    """
    Import unsatisfied findings from Assessment Results (AR) into a POA&M document (US 7.6 & DD-017).
    """
    finding_uuids = request_data.finding_uuids if request_data else None
    try:
        result = await import_findings_from_ar(
            poam_id=poam_id,
            ar_id=ar_id,
            finding_uuids=finding_uuids,
            workspace_id=ws_id,
        )
        return result
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ValidationError as e:
        return validation_error_response(e)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal persistence error: {str(e)}")

