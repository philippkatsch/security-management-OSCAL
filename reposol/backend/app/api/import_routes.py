import os
import json
from fastapi import APIRouter, HTTPException, UploadFile, File, Depends, Query
from pydantic import BaseModel
from typing import Optional

from app.dependencies import get_workspace_id, require_write_permission
from app.constants import STAGE_MAPPING, STAGE_ROOT_KEYS
from app.format_converter import parse_xml_to_oscal_dict, parse_yaml_to_dict
from app.services.import_service import fetch_remote_document, import_document, ImportServiceError, ImportValidationError
from app.repositories.workspace_repository import get_stage_dir

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
        "url": "https://raw.githubusercontent.com/BSI-Bund/Stand-der-Technik-Bibliothek/refs/heads/main/control_layer/Grundschutz%2B%2B/Grundschutz%2B%2B-resolved_catalog.json",
        "uuid": "9e2fc241-16e5-4a2d-bda7-f9e0556a1639",
    },
    # ── Component Definitions (Stage 3) ────────────────────────────────────
    {
        "id": "bsi-keycloak-component-definition",
        "title": "BSI IT-Grundschutz — Keycloak IAM Component Definition",
        "description": "Deutsches Bundesamt für Sicherheit in der Informationstechnik (BSI) Stand-der-Technik Keycloak IAM component definition implementing IT-Grundschutz controls.",
        "model": "component-definition",
        "source": "bsi",
        "url": "https://raw.githubusercontent.com/BSI-Bund/Stand-der-Technik-Bibliothek/refs/heads/main/implementation_layer/Keycloak/Keycloak-component_definition.json",
        "uuid": "a9c5ad63-9bc8-4e3e-8e54-e45f2f1daed7",
    },
    {
        "id": "bsi-aws-security-hub-component-definition",
        "title": "BSI IT-Grundschutz — AWS Security Hub Component Definition",
        "description": "Deutsches Bundesamt für Sicherheit in der Informationstechnik (BSI) Stand-der-Technik AWS Security Hub component definition.",
        "model": "component-definition",
        "source": "bsi",
        "url": "https://raw.githubusercontent.com/BSI-Bund/Stand-der-Technik-Bibliothek/refs/heads/main/implementation_layer/AWS%20Beispiel-Components/AWS%20Security%20Hub-component_definition.json",
        "uuid": "354a88d1-e935-4399-851e-263e7b3d4796",
    },
    {
        "id": "nist-example-component-definition",
        "title": "NIST OSCAL — MongoDB Example Component Definition",
        "description": "Official NIST OSCAL example component definition demonstrating hardware, software, and service components.",
        "model": "component-definition",
        "source": "nist",
        "url": "https://raw.githubusercontent.com/usnistgov/oscal-content/main/examples/component-definition/json/example-component-definition.json",
        "uuid": "bedec39a-6f8c-4d24-8b12-34458f387800",
    },
]

class ImportURLRequest(BaseModel):
    url: str
    validate_schema: Optional[bool] = True
    persist: Optional[bool] = True

class ParseDocumentRequest(BaseModel):
    document: Optional[dict] = None
    url: Optional[str] = None
    raw_text: Optional[str] = None
    format: Optional[str] = None
    validate_schema: Optional[bool] = True

@import_router.get("/api/import/registry")
async def list_registry(ws_id: str = Depends(get_workspace_id)):
    """Return the list of known importable OSCAL sources, annotated with import status and version."""
    annotated_sources = []
    for source in KNOWN_SOURCES:
        entry = dict(source)
        stage_alias = STAGE_MAPPING.get(entry["model"])
        is_imported = False
        workspace_version = None
        if stage_alias and "uuid" in entry:
            try:
                stage_dir = await get_stage_dir(stage_alias, workspace_id=ws_id)
                file_path = os.path.join(stage_dir, f"{entry['uuid']}.json")
                if not os.path.isfile(file_path) and ws_id:
                    root_stage_dir = await get_stage_dir(stage_alias, workspace_id=None)
                    file_path = os.path.join(root_stage_dir, f"{entry['uuid']}.json")
                if os.path.isfile(file_path):
                    is_imported = True
                    try:
                        with open(file_path, "r", encoding="utf-8") as f:
                            doc_data = json.load(f)
                            root_key = STAGE_ROOT_KEYS.get(stage_alias)
                            if root_key and root_key in doc_data:
                                workspace_version = doc_data[root_key].get("metadata", {}).get("version")
                    except Exception:
                        pass
            except ValueError:
                pass # stage dir not valid
        entry["is_imported"] = is_imported
        if workspace_version:
            entry["workspace_version"] = workspace_version
        annotated_sources.append(entry)
        
    return annotated_sources

@import_router.post("/api/import/url")
async def import_from_url(
    request_data: ImportURLRequest,
    persist: Optional[bool] = Query(None),
    ws_id: str = Depends(require_write_permission)
):
    """Fetch and import an OSCAL document from a URL (or parse only if persist=False)."""
    should_persist = persist if persist is not None else (request_data.persist if request_data.persist is not None else True)
    try:
        document = await fetch_remote_document(request_data.url)
        result = await import_document(
            document,
            validate=request_data.validate_schema if request_data.validate_schema is not None else True,
            workspace_id=ws_id,
            persist=should_persist
        )
        return result
    except ImportValidationError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except ImportServiceError as e:
        raise HTTPException(status_code=400, detail=str(e))

@import_router.post("/api/import/registry/{source_id}")
async def import_from_registry(
    source_id: str,
    persist: bool = Query(True),
    ws_id: str = Depends(require_write_permission)
):
    """Fetch and import a known OSCAL document from the built-in registry (or parse only if persist=False)."""
    entry = next((s for s in KNOWN_SOURCES if s["id"] == source_id), None)
    if not entry:
        raise HTTPException(status_code=404, detail=f"Registry entry '{source_id}' not found")

    try:
        document = await fetch_remote_document(entry["url"])
        result = await import_document(
            document,
            validate=True,
            workspace_id=ws_id,
            persist=persist
        )
        result["registry_id"] = source_id
        result["source"] = entry.get("source")
        return result
    except ImportValidationError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except ImportServiceError as e:
        raise HTTPException(status_code=400, detail=str(e))

@import_router.post("/api/import/file")
async def import_uploaded_file(
    file: UploadFile = File(...),
    persist: bool = Query(True),
    ws_id: str = Depends(require_write_permission)
):
    """Upload and import an OSCAL document (JSON, YAML, or XML) (or parse only if persist=False)."""
    MAX_UPLOAD_BYTES = 50 * 1024 * 1024  # 50 MB
    content = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File too large. Maximum upload size is 50 MB.")
    text = content.decode("utf-8", errors="ignore")
    filename_lower = (file.filename or "").lower()
    
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
        
    try:
        result = await import_document(document, validate=True, workspace_id=ws_id, persist=persist)
        return result
    except ImportValidationError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except ImportServiceError as e:
        raise HTTPException(status_code=400, detail=str(e))

@import_router.post("/api/import/parse")
async def parse_import_document(
    request_data: ParseDocumentRequest,
    ws_id: str = Depends(require_write_permission)
):
    """Parse and validate an OSCAL document without persisting to disk."""
    try:
        if request_data.url:
            document = await fetch_remote_document(request_data.url)
        elif request_data.document:
            document = request_data.document
        elif request_data.raw_text:
            text = request_data.raw_text
            fmt = (request_data.format or "").lower()
            if fmt in ("yaml", "yml") or text.strip().startswith("---"):
                document = parse_yaml_to_dict(text)
            elif fmt == "xml" or text.strip().startswith("<"):
                document = parse_xml_to_oscal_dict(text)
            else:
                try:
                    document = json.loads(text)
                except json.JSONDecodeError:
                    document = parse_yaml_to_dict(text)
        else:
            raise HTTPException(status_code=400, detail="Either 'document', 'url', or 'raw_text' must be provided.")
        
        if not isinstance(document, dict):
            raise HTTPException(status_code=400, detail="Invalid OSCAL document structure (must be a JSON object/dictionary).")

        result = await import_document(
            document,
            validate=request_data.validate_schema if request_data.validate_schema is not None else True,
            workspace_id=ws_id,
            persist=False
        )
        return result
    except ImportValidationError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except ImportServiceError as e:
        raise HTTPException(status_code=400, detail=str(e))
