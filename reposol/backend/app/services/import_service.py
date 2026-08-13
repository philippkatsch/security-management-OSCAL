import httpx
from typing import Optional, Dict, Any
from app.constants import STAGE_ROOT_KEYS, STAGE_MAPPING
from app.validation import validate_document
from app.services.document_service import save_document
from app.repositories.document_repository import is_valid_uuid

class ImportServiceError(Exception):
    pass

class ImportValidationError(ImportServiceError):
    pass

def detect_stage(document: dict) -> str:
    """Auto-detect the OSCAL stage from the document root key."""
    key_to_stage = {v: k for k, v in STAGE_ROOT_KEYS.items()}
    for root_key in document:
        if root_key in key_to_stage:
            return key_to_stage[root_key]
    raise ImportServiceError(f"Cannot detect OSCAL stage. Unknown root keys: {list(document.keys())}")


async def fetch_remote_document(url: str) -> dict:
    """Fetch JSON document from a remote URL."""
    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            headers = {
                "Accept": "application/json",
                "User-Agent": "Reposol-OSCAL-Manager/1.0",
            }
            response = await client.get(url, headers=headers)
            response.raise_for_status()
            return response.json()
    except httpx.TimeoutException:
        raise ImportServiceError(f"Timeout fetching URL: {url}")
    except httpx.HTTPStatusError as e:
        raise ImportServiceError(f"Remote server returned {e.response.status_code} for URL: {url}")
    except Exception as e:
        raise ImportServiceError(f"Failed to fetch URL: {str(e)}")


async def import_document(document: dict, validate: bool = True, workspace_id: Optional[str] = None) -> dict:
    """Import a document into local storage, with optional validation."""
    stage = detect_stage(document)
    normalized_stage = STAGE_MAPPING.get(stage, stage)
    root_key = STAGE_ROOT_KEYS.get(normalized_stage)

    if not root_key:
        raise ImportServiceError(f"Unsupported stage: {stage}")

    doc_data = document.get(root_key)
    if not doc_data:
        raise ImportServiceError(f"Document missing root key '{root_key}'")

    doc_id = doc_data.get("uuid")
    if not doc_id:
        raise ImportServiceError("Document missing 'uuid' field")

    if not is_valid_uuid(doc_id):
        raise ImportServiceError(f"Invalid UUID format: '{doc_id}'")

    if validate:
        try:
            await validate_document(normalized_stage, document, check_refs=False, workspace_id=workspace_id)
        except Exception as e:
            raise ImportValidationError(f"Schema validation failed: {str(e)}")

    _, _, existed = await save_document(normalized_stage, doc_id, document, workspace_id=workspace_id, skip_validation=True)

    return {
        "status": "updated" if existed else "created",
        "stage": normalized_stage,
        "uuid": doc_id,
        "title": doc_data.get("metadata", {}).get("title", "Untitled"),
        "oscal_version": doc_data.get("metadata", {}).get("oscal-version", "unknown"),
    }
