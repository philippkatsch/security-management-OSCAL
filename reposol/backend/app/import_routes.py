"""
Import routes: fetch OSCAL documents from remote URLs (GitHub, OSCAL.io, custom URLs)
and import them directly into local storage.
"""
import httpx
import json
from fastapi import APIRouter, HTTPException, UploadFile, File

from pydantic import BaseModel
from typing import Optional
from app.validation import validate_document, STAGE_ROOT_KEYS
from app.storage import save_document, is_valid_uuid, preprocess_profile_for_saving
from jsonschema import ValidationError
from app.format_converter import parse_xml_to_oscal_dict, parse_yaml_to_dict

import_router = APIRouter()

# ─── Known OSCAL Content Registry ────────────────────────────────────────────
# All entries from usnistgov/oscal-content on GitHub (raw URLs, JSON format)
KNOWN_SOURCES = [
    # ── NIST SP 800-53 ──────────────────────────────────────────────────────
    {
        "id": "nist-800-53-rev5-catalog",
        "title": "NIST SP 800-53 Rev 5.2.0 — Full Catalog",
        "description": "Electronic OSCAL version of NIST SP 800-53 Rev 5.2.0 Controls and SP 800-53A Rev 5.2.0 Assessment Procedures.",
        "model": "catalog",
        "source": "nist",
        "url": "https://raw.githubusercontent.com/usnistgov/oscal-content/main/nist.gov/SP800-53/rev5/json/NIST_SP-800-53_rev5_catalog.json",
        "uuid": "ea7c7688-79c5-463b-a91b-0650f2d98623",
    },
    {
        "id": "nist-800-53-rev5-low-baseline",
        "title": "NIST SP 800-53 Rev 5 — LOW Baseline Profile",
        "description": "NIST SP 800-53 Rev 5 LOW impact baseline profile.",
        "model": "profile",
        "source": "nist",
        "url": "https://raw.githubusercontent.com/usnistgov/oscal-content/main/nist.gov/SP800-53/rev5/json/NIST_SP-800-53_rev5_LOW-baseline_profile.json",
        "uuid": "201765f8-6d45-4941-8789-9eef2effd7d0",
    },
    {
        "id": "nist-800-53-rev5-moderate-baseline",
        "title": "NIST SP 800-53 Rev 5 — MODERATE Baseline Profile",
        "description": "NIST SP 800-53 Rev 5 MODERATE impact baseline profile.",
        "model": "profile",
        "source": "nist",
        "url": "https://raw.githubusercontent.com/usnistgov/oscal-content/main/nist.gov/SP800-53/rev5/json/NIST_SP-800-53_rev5_MODERATE-baseline_profile.json",
        "uuid": "b07979a6-1b98-42dc-a776-60ee575b061e",
    },
    {
        "id": "nist-800-53-rev5-high-baseline",
        "title": "NIST SP 800-53 Rev 5 — HIGH Baseline Profile",
        "description": "NIST SP 800-53 Rev 5 HIGH impact baseline profile.",
        "model": "profile",
        "source": "nist",
        "url": "https://raw.githubusercontent.com/usnistgov/oscal-content/main/nist.gov/SP800-53/rev5/json/NIST_SP-800-53_rev5_HIGH-baseline_profile.json",
        "uuid": "b5c9c74d-b24d-4e80-815a-80936528fb6d",
    },
    {
        "id": "nist-800-53-rev4-catalog",
        "title": "NIST SP 800-53 Rev 4 — Full Catalog",
        "description": "Electronic OSCAL version of NIST SP 800-53 Rev 4 Security Controls.",
        "model": "catalog",
        "source": "nist",
        "url": "https://raw.githubusercontent.com/usnistgov/oscal-content/main/nist.gov/SP800-53/rev4/json/NIST_SP-800-53_rev4_catalog.json",
        "uuid": "f6b3db48-0676-47b2-b13c-04c3e76a6669",
    },
    # ── NIST CSF ────────────────────────────────────────────────────────────
    {
        "id": "nist-csf-2-catalog",
        "title": "NIST Cybersecurity Framework 2.0 — Catalog",
        "description": "Electronic OSCAL version of the NIST Cybersecurity Framework (CSF) 2.0.",
        "model": "catalog",
        "source": "nist",
        "url": "https://raw.githubusercontent.com/usnistgov/oscal-content/refs/heads/main/nist.gov/CSF/v2.0/json/NIST_CSF_v2.0_catalog.json",
        "uuid": "720a010b-253c-4a94-bb65-cb58400966f5",
    },
    # ── BSI IT-Grundschutz ──────────────────────────────────────────────────
    {
        "id": "bsi-it-grundschutz-catalog",
        "title": "BSI IT-Grundschutz — Kompendium Catalog",
        "description": "Deutsches Bundesamt für Sicherheit in der Informationstechnik (BSI) IT-Grundschutz Kompendium (Grundschutz++) OSCAL Catalog.",
        "model": "catalog",
        "source": "bsi",
        "url": "https://raw.githubusercontent.com/BSI-Bund/Stand-der-Technik-Bibliothek/refs/heads/main/Anwenderkataloge/Grundschutz%2B%2B/Grundschutz%2B%2B-catalog.json",
        "uuid": "7a35649f-1d8d-4a12-8869-709b4db74c77",
    },
]

# Stage aliases for routing
STAGE_ALIASES = {
    "catalog": "catalogs",
    "catalogs": "catalogs",
    "profile": "profiles",
    "profiles": "profiles",
    "ssp": "ssps",
    "ssps": "ssps",
    "system-security-plan": "ssps",
    "component-definition": "component-definitions",
    "component-definitions": "component-definitions",
    "assessment-plan": "assessment-plans",
    "assessment-plans": "assessment-plans",
    "assessment-results": "assessment-results",
    "poam": "poams",
    "poams": "poams",
}


class ImportURLRequest(BaseModel):
    url: str
    validate_schema: Optional[bool] = True


def detect_stage(document: dict) -> str:
    """Auto-detect the OSCAL stage from the document root key."""
    key_to_stage = {v: k for k, v in STAGE_ROOT_KEYS.items()}
    for root_key in document:
        if root_key in key_to_stage:
            return key_to_stage[root_key]
    raise HTTPException(
        status_code=400,
        detail=f"Cannot detect OSCAL stage. Unknown root keys: {list(document.keys())}"
    )


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
        raise HTTPException(status_code=504, detail=f"Timeout fetching URL: {url}")
    except httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=502,
            detail=f"Remote server returned {e.response.status_code} for URL: {url}"
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch URL: {str(e)}")


def import_document(document: dict, validate: bool = True, workspace_id: Optional[str] = None) -> dict:
    """Import a document into local storage, with optional validation."""
    stage = detect_stage(document)
    normalized_stage = STAGE_ALIASES.get(stage, stage)
    root_key = STAGE_ROOT_KEYS.get(normalized_stage)

    if not root_key:
        raise HTTPException(status_code=400, detail=f"Unsupported stage: {stage}")

    doc_data = document.get(root_key)
    if not doc_data:
        raise HTTPException(status_code=400, detail=f"Document missing root key '{root_key}'")

    doc_id = doc_data.get("uuid")
    if not doc_id:
        raise HTTPException(status_code=400, detail="Document missing 'uuid' field")

    if not is_valid_uuid(doc_id):
        raise HTTPException(status_code=400, detail=f"Invalid UUID format: '{doc_id}'")

    validation_doc = document
    if normalized_stage == "profiles":
        try:
            validation_doc = preprocess_profile_for_saving(document, persist_local_catalog=False)
        except ValidationError as e:
            errors = getattr(e, "errors", [])
            first_err_path = f" at {errors[0]['path']}" if errors else ""
            raise HTTPException(
                status_code=422,
                detail=f"Schema validation failed{first_err_path}: {e.message}"
            )

    if validate:
        try:
            validate_document(normalized_stage, validation_doc, check_refs=False, workspace_id=workspace_id)
        except ValidationError as e:
            errors = getattr(e, "errors", [])
            first_err_path = f" at {errors[0]['path']}" if errors else ""
            raise HTTPException(
                status_code=422,
                detail=f"Schema validation failed{first_err_path}: {e.message}"
            )
        except ValueError as e:
            raise HTTPException(status_code=422, detail=str(e))

    existed = save_document(normalized_stage, doc_id, document, workspace_id=workspace_id)

    return {
        "status": "updated" if existed else "created",
        "stage": normalized_stage,
        "uuid": doc_id,
        "title": doc_data.get("metadata", {}).get("title", "Untitled"),
        "oscal_version": doc_data.get("metadata", {}).get("oscal-version", "unknown"),
    }


# ─── Endpoints ────────────────────────────────────────────────────────────────

from fastapi import Request

def get_ws_id(request: Request) -> Optional[str]:
    """Extracts workspace ID from X-Workspace-ID header or w/workspace_id/workspace query parameter."""
    ws = (
        request.headers.get("x-workspace-id")
        or request.headers.get("X-Workspace-ID")
        or request.query_params.get("w")
        or request.query_params.get("workspace_id")
        or request.query_params.get("workspace")
    )
    import os
    if not ws and not os.environ.get("PYTEST_CURRENT_TEST"):
        return "default"
    return ws

@import_router.get("/api/import/registry")
def list_registry(request: Request):
    """Return the list of known importable OSCAL sources, annotated with import status."""
    import os
    from app.storage import get_stage_dir
    ws_id = get_ws_id(request)
    
    annotated_sources = []
    for source in KNOWN_SOURCES:
        entry = dict(source)
        stage_alias = STAGE_ALIASES.get(entry["model"])
        is_imported = False
        if stage_alias and "uuid" in entry:
            try:
                stage_dir = get_stage_dir(stage_alias, workspace_id=ws_id)
                file_path = os.path.join(stage_dir, f"{entry['uuid']}.json")
                if os.path.isfile(file_path):
                    is_imported = True
            except ValueError:
                pass # stage dir not valid
        entry["is_imported"] = is_imported
        annotated_sources.append(entry)
        
    return annotated_sources


@import_router.post("/api/import/url")
async def import_from_url(request_data: ImportURLRequest, request: Request):
    """Fetch and import an OSCAL document from a URL."""
    from app.routes import check_master_write_permission
    ws_id = get_ws_id(request)
    check_master_write_permission(request, ws_id)
    document = await fetch_remote_document(request_data.url)
    result = import_document(document, validate=request_data.validate_schema, workspace_id=ws_id)
    return result


@import_router.post("/api/import/registry/{source_id}")
async def import_from_registry(source_id: str, request: Request):
    """Fetch and import a known OSCAL document from the built-in registry."""
    from app.routes import check_master_write_permission
    ws_id = get_ws_id(request)
    check_master_write_permission(request, ws_id)
    entry = next((s for s in KNOWN_SOURCES if s["id"] == source_id), None)
    if not entry:
        raise HTTPException(status_code=404, detail=f"Registry entry '{source_id}' not found")

    document = await fetch_remote_document(entry["url"])
    result = import_document(document, validate=True, workspace_id=ws_id)
    result["registry_id"] = source_id
    result["source"] = entry.get("source")
    return result


@import_router.post("/api/import/file")
async def import_uploaded_file(request: Request, file: UploadFile = File(...)):
    """Upload and import an OSCAL document (JSON, YAML, or XML)."""
    from app.routes import check_master_write_permission
    ws_id = get_ws_id(request)
    check_master_write_permission(request, ws_id)
    content = await file.read()
    text = content.decode("utf-8", errors="ignore")
    filename_lower = file.filename.lower()
    
    document = None
    
    # Determine format and parse
    if filename_lower.endswith((".yaml", ".yml")):
        try:
            document = parse_yaml_to_dict(text)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to parse YAML: {str(e)}")
    elif filename_lower.endswith(".xml") or text.strip().startswith("<"):
        try:
            document = parse_xml_to_oscal_dict(text)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to parse XML: {str(e)}")
    else:
        # Try JSON, fallback to YAML if JSON fails
        try:
            document = json.loads(text)
        except json.JSONDecodeError:
            try:
                document = parse_yaml_to_dict(text)
            except Exception:
                raise HTTPException(status_code=400, detail="Failed to parse file as JSON or YAML.")
                
    if not isinstance(document, dict):
        raise HTTPException(status_code=400, detail="Invalid OSCAL document structure (must be a JSON object/dictionary).")
        
    result = import_document(document, validate=True, workspace_id=ws_id)
    return result
