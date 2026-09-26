import os
import json
import re
from fastapi import APIRouter, HTTPException, UploadFile, File, Depends, Query
from pydantic import BaseModel
from typing import Optional

from app.dependencies import get_workspace_id, require_write_permission
from app.constants import STAGE_MAPPING, STAGE_ROOT_KEYS
from app.format_converter import parse_xml_to_oscal_dict, parse_yaml_to_dict
from app.services.import_service import fetch_remote_document, import_document, ImportServiceError, ImportValidationError
from app.repositories.workspace_repository import get_stage_dir
from app.repositories.document_repository import list_raw_documents

import_router = APIRouter()

def _normalize_url(u: str) -> str:
    if not u:
        return ""
    u = u.strip().lower()
    u = u.replace("/refs/heads/main/", "/main/")
    return u.rstrip("/")

def _normalize_title(t: str) -> str:
    if not t:
        return ""
    t = re.sub(r'[\s\-_—–:;,\.()\[\]]+', ' ', t.lower()).strip()
    return t

def _get_doc_root(doc: dict, stage_alias: str) -> dict:
    if not isinstance(doc, dict):
        return {}
    canonical_key = STAGE_ROOT_KEYS.get(stage_alias)
    if canonical_key and canonical_key in doc and isinstance(doc[canonical_key], dict):
        return doc[canonical_key]
    for alt_key in (
        "catalog", "profile", "system-security-plan", "ssp",
        "component-definition", "component",
        "assessment-plan", "assessment-results",
        "plan-of-action-and-milestones", "poam",
        "mapping-collection", "control-mapping"
    ):
        if alt_key in doc and isinstance(doc[alt_key], dict):
            return doc[alt_key]
    return {}

# ─── Known OSCAL Content Registry ────────────────────────────────────────────
# Official entries from verified standard repositories (raw URLs, JSON format)
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
        "known_uuids": [
            "ea7c7688-79c5-463b-a91b-0650f2d98623",
        ],
        "known_titles": [
            "Electronic (OSCAL) Version of NIST SP 800-53 Rev 5.2.0 Controls and SP 800-53A Rev 5.2.0 Assessment Procedures",
            "NIST SP 800-53 Rev 5.2.0 — Full Catalog",
            "NIST SP 800-53 Rev 5.2.0",
            "NIST SP 800-53 Rev 5",
        ],
    },
    {
        "id": "nist-800-53-rev5-low-baseline",
        "title": "NIST SP 800-53 Rev 5 — LOW Baseline Profile",
        "description": "NIST SP 800-53 Rev 5 LOW impact baseline profile.",
        "model": "profile",
        "source": "nist",
        "url": "https://raw.githubusercontent.com/usnistgov/oscal-content/main/nist.gov/SP800-53/rev5/json/NIST_SP-800-53_rev5_LOW-baseline_profile.json",
        "uuid": "201765f8-6d45-4941-8789-9eef2effd7d0",
        "known_uuids": [
            "201765f8-6d45-4941-8789-9eef2effd7d0",
        ],
        "known_titles": [
            "Electronic (OSCAL) Version of NIST Special Publication 800-53 Revision 5.2.0 LOW IMPACT BASELINE",
            "NIST SP 800-53 Rev 5 — LOW Baseline Profile",
            "NIST SP 800-53 Rev 5 — LOW Baseline",
        ],
    },
    {
        "id": "nist-800-53-rev5-moderate-baseline",
        "title": "NIST SP 800-53 Rev 5 — MODERATE Baseline Profile",
        "description": "NIST SP 800-53 Rev 5 MODERATE impact baseline profile.",
        "model": "profile",
        "source": "nist",
        "url": "https://raw.githubusercontent.com/usnistgov/oscal-content/main/nist.gov/SP800-53/rev5/json/NIST_SP-800-53_rev5_MODERATE-baseline_profile.json",
        "uuid": "b07979a6-1b98-42dc-a776-60ee575b061e",
        "known_uuids": [
            "b07979a6-1b98-42dc-a776-60ee575b061e",
        ],
        "known_titles": [
            "Electronic (OSCAL) Version of NIST Special Publication 800-53 Revision 5.2.0 MODERATE IMPACT BASELINE",
            "NIST SP 800-53 Rev 5 — MODERATE Baseline Profile",
            "NIST SP 800-53 Rev 5 — MODERATE Baseline",
        ],
    },
    {
        "id": "nist-800-53-rev5-high-baseline",
        "title": "NIST SP 800-53 Rev 5 — HIGH Baseline Profile",
        "description": "NIST SP 800-53 Rev 5 HIGH impact baseline profile.",
        "model": "profile",
        "source": "nist",
        "url": "https://raw.githubusercontent.com/usnistgov/oscal-content/main/nist.gov/SP800-53/rev5/json/NIST_SP-800-53_rev5_HIGH-baseline_profile.json",
        "uuid": "b5c9c74d-b24d-4e80-815a-80936528fb6d",
        "known_uuids": [
            "b5c9c74d-b24d-4e80-815a-80936528fb6d",
        ],
        "known_titles": [
            "Electronic (OSCAL) Version of NIST Special Publication 800-53 Revision 5.1.1 HIGH IMPACT BASELINE",
            "NIST SP 800-53 Rev 5 — HIGH Baseline Profile",
            "NIST SP 800-53 Rev 5 — HIGH Baseline",
        ],
    },
    {
        "id": "nist-800-53-rev4-catalog",
        "title": "NIST SP 800-53 Rev 4 — Full Catalog",
        "description": "Electronic OSCAL version of NIST SP 800-53 Rev 4 Security Controls.",
        "model": "catalog",
        "source": "nist",
        "url": "https://raw.githubusercontent.com/usnistgov/oscal-content/main/nist.gov/SP800-53/rev4/json/NIST_SP-800-53_rev4_catalog.json",
        "uuid": "cd20580b-7b77-4031-8c06-28bd016f3104",
        "known_uuids": [
            "cd20580b-7b77-4031-8c06-28bd016f3104",
            "f6b3db48-0676-47b2-b13c-04c3e76a6669",
        ],
        "known_titles": [
            "NIST Special Publication 800-53 Revision 4: Security and Privacy Controls for Federal Information Systems and Organizations",
            "NIST SP 800-53 Rev 4 — Full Catalog",
            "NIST SP 800-53 Rev 4",
        ],
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
        "known_uuids": [
            "720a010b-253c-4a94-bb65-cb58400966f5",
        ],
        "known_titles": [
            "Electronic Version of NIST Cybersecurity Framework 2.0",
            "NIST Cybersecurity Framework 2.0 — Catalog",
            "NIST CSF 2.0",
        ],
    },
    # ── BSI IT-Grundschutz ──────────────────────────────────────────────────
    {
        "id": "bsi-it-grundschutz-catalog",
        "title": "BSI IT-Grundschutz — Kompendium Catalog",
        "description": "Deutsches Bundesamt für Sicherheit in der Informationstechnik (BSI) IT-Grundschutz Kompendium (Grundschutz++) OSCAL Catalog.",
        "model": "catalog",
        "source": "bsi",
        "url": "https://raw.githubusercontent.com/BSI-Bund/Stand-der-Technik-Bibliothek/refs/heads/main/control_layer/Grundschutz%2B%2B/Grundschutz%2B%2B-resolved_catalog.json",
        "uuid": "f556845b-fbb1-4bc0-a97c-ac1872d385f3",
        "known_uuids": [
            "f556845b-fbb1-4bc0-a97c-ac1872d385f3",
            "73f2d8f6-5a98-4e81-b600-b709e372e9cf",
            "9e2fc241-16e5-4a2d-bda7-f9e0556a1639",
            "7a35649f-1d8d-4a12-8869-709b4db74c77",
        ],
        "known_titles": [
            "Anwenderkatalog Grundschutz++",
            "BSI IT-Grundschutz — Kompendium Catalog",
            "BSI IT-Grundschutz",
            "Grundschutz++",
            "IT-Grundschutz Kompendium",
        ],
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
        "known_uuids": [
            "a9c5ad63-9bc8-4e3e-8e54-e45f2f1daed7",
        ],
        "known_titles": [
            "Entwurf Keycloak Component Definition",
            "BSI IT-Grundschutz — Keycloak IAM Component Definition",
            "Keycloak IAM Component Definition",
        ],
    },
    {
        "id": "bsi-aws-security-hub-component-definition",
        "title": "BSI IT-Grundschutz — AWS Security Hub Component Definition",
        "description": "Deutsches Bundesamt für Sicherheit in der Informationstechnik (BSI) Stand-der-Technik AWS Security Hub component definition.",
        "model": "component-definition",
        "source": "bsi",
        "url": "https://raw.githubusercontent.com/BSI-Bund/Stand-der-Technik-Bibliothek/refs/heads/main/implementation_layer/AWS%20Beispiel-Components/AWS%20Security%20Hub-component_definition.json",
        "uuid": "354a88d1-e935-4399-851e-263e7b3d4796",
        "known_uuids": [
            "354a88d1-e935-4399-851e-263e7b3d4796",
        ],
        "known_titles": [
            "Stand der Technik AWS Security Hub Version GA-Servicegeneration ab 2025-12-02, Essentials mit AWS Security Hub CSPM (Dienststand 2026-08-20)",
            "BSI IT-Grundschutz — AWS Security Hub Component Definition",
            "AWS Security Hub Component Definition",
        ],
    },
    {
        "id": "nist-example-component-definition",
        "title": "NIST OSCAL — MongoDB Example Component Definition",
        "description": "Official NIST OSCAL example component definition demonstrating hardware, software, and service components.",
        "model": "component-definition",
        "source": "nist",
        "url": "https://raw.githubusercontent.com/usnistgov/oscal-content/main/examples/component-definition/json/example-component-definition.json",
        "uuid": "bedec39a-6f8c-4d24-8b12-34458f387800",
        "known_uuids": [
            "bedec39a-6f8c-4d24-8b12-34458f387800",
        ],
        "known_titles": [
            "MongoDB Component Definition Example",
            "NIST OSCAL — MongoDB Example Component Definition",
        ],
    },
    # ── System Security Plans (Stage 4) ────────────────────────────────────
    {
        "id": "nist-example-ssp",
        "title": "NIST OSCAL — Enterprise Logging System Security Plan",
        "description": "Official NIST OSCAL example System Security Plan (SSP) demonstrating control implementation and components.",
        "model": "ssp",
        "source": "nist",
        "url": "https://raw.githubusercontent.com/usnistgov/oscal-content/main/examples/ssp/json/ssp-example.json",
        "uuid": "7db89308-6616-4b8a-8fe9-d2d9f2bb5292",
        "known_uuids": [
            "7db89308-6616-4b8a-8fe9-d2d9f2bb5292",
        ],
        "known_titles": [
            "Enterprise Logging and Auditing System Security Plan",
            "NIST OSCAL — Enterprise Logging System Security Plan",
            "NIST OSCAL Example System Security Plan",
        ],
    },
    # ── Assessment Plans (Stage 5) ─────────────────────────────────────────
    {
        "id": "nist-example-assessment-plan",
        "title": "NIST OSCAL — Enterprise Logging Assessment Plan",
        "description": "Official NIST OSCAL example Assessment Plan (AP) demonstrating assessment objectives and activities.",
        "model": "assessment-plan",
        "source": "nist",
        "url": "https://raw.githubusercontent.com/usnistgov/oscal-content/main/examples/assessment-plan/json/assessment-plan-example.json",
        "uuid": "c0a8012e-0000-4000-8000-000000000001",
        "known_uuids": [
            "c0a8012e-0000-4000-8000-000000000001",
        ],
        "known_titles": [
            "Enterprise Logging Assessment Plan",
            "NIST OSCAL — Enterprise Logging Assessment Plan",
            "NIST OSCAL Example Assessment Plan",
        ],
    },
    # ── Assessment Results (Stage 6) ───────────────────────────────────────
    {
        "id": "nist-example-assessment-results",
        "title": "NIST OSCAL — Enterprise Logging Assessment Results",
        "description": "Official NIST OSCAL example Assessment Results (AR) containing observations, findings, and risks.",
        "model": "assessment-results",
        "source": "nist",
        "url": "https://raw.githubusercontent.com/usnistgov/oscal-content/main/examples/assessment-results/json/assessment-results-example.json",
        "uuid": "d0a8012e-0000-4000-8000-000000000002",
        "known_uuids": [
            "d0a8012e-0000-4000-8000-000000000002",
        ],
        "known_titles": [
            "Enterprise Logging Assessment Results",
            "NIST OSCAL — Enterprise Logging Assessment Results",
            "NIST OSCAL Example Assessment Results",
        ],
    },
    # ── POA&M (Stage 7) ────────────────────────────────────────────────────
    {
        "id": "nist-example-poam",
        "title": "NIST OSCAL — Enterprise Logging Plan of Action and Milestones",
        "description": "Official NIST OSCAL example Plan of Action and Milestones (POA&M) document.",
        "model": "poam",
        "source": "nist",
        "url": "https://raw.githubusercontent.com/usnistgov/oscal-content/main/examples/poam/json/poam-example.json",
        "uuid": "e0a8012e-0000-4000-8000-000000000003",
        "known_uuids": [
            "e0a8012e-0000-4000-8000-000000000003",
        ],
        "known_titles": [
            "Enterprise Logging Plan of Action and Milestones",
            "NIST OSCAL — Enterprise Logging Plan of Action and Milestones",
            "NIST OSCAL Example Plan of Action and Milestones",
        ],
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
    # Pre-fetch all documents per required stage to make workspace resolution fast and robust
    stages_to_fetch = set()
    for source in KNOWN_SOURCES:
        stage_alias = STAGE_MAPPING.get(source["model"])
        if stage_alias:
            stages_to_fetch.add(stage_alias)

    stage_docs_cache = {}
    for stage_alias in stages_to_fetch:
        docs = []
        seen_uuids = set()
        # 1. Fetch from current workspace (if any)
        try:
            ws_docs = await list_raw_documents(stage_alias, workspace_id=ws_id)
            for d in ws_docs:
                doc_root = _get_doc_root(d, stage_alias)
                u = doc_root.get("uuid")
                if u:
                    docs.append(d)
                    seen_uuids.add(u.lower())
        except Exception:
            pass
        # 2. Inherit from default workspace if ws_id is custom
        if ws_id and ws_id != "default":
            try:
                root_docs = await list_raw_documents(stage_alias, workspace_id=None)
                for d in root_docs:
                    doc_root = _get_doc_root(d, stage_alias)
                    u = doc_root.get("uuid")
                    if u and u.lower() not in seen_uuids:
                        docs.append(d)
                        seen_uuids.add(u.lower())
            except Exception:
                pass
        stage_docs_cache[stage_alias] = docs

    annotated_sources = []
    for source in KNOWN_SOURCES:
        entry = dict(source)
        stage_alias = STAGE_MAPPING.get(entry["model"])
        is_imported = False
        workspace_version = None
        workspace_doc_id = None

        if stage_alias:
            stage_docs = stage_docs_cache.get(stage_alias, [])

            candidate_uuids = {entry.get("uuid", "").lower()}
            for u in entry.get("known_uuids", []):
                if u:
                    candidate_uuids.add(u.lower())

            candidate_titles = []
            if entry.get("title"):
                candidate_titles.append(entry["title"])
            for t in entry.get("known_titles", []):
                if t:
                    candidate_titles.append(t)

            norm_entry_url = _normalize_url(entry.get("url") or "")
            entry_id = (entry.get("id") or "").strip().lower()

            matching_docs = []
            for doc in stage_docs:
                doc_root = _get_doc_root(doc, stage_alias)
                doc_uuid = (doc_root.get("uuid") or "").lower()
                doc_meta = doc_root.get("metadata", {})
                doc_title = (doc_meta.get("title") or "").strip()
                raw_version = doc_meta.get("version")
                doc_version = str(raw_version) if raw_version is not None else None
                doc_last_mod = doc_meta.get("last-modified", "")
                doc_links = doc_meta.get("links", [])
                doc_props = doc_meta.get("props", [])

                matched = False
                matched_id_or_primary = False

                # 1. Direct UUID or Known UUID match
                if doc_uuid and doc_uuid in candidate_uuids:
                    matched = True
                    if doc_uuid == (entry.get("uuid") or "").lower():
                        matched_id_or_primary = True

                # 2. Source URL link match in metadata
                if not matched and norm_entry_url and isinstance(doc_links, list):
                    for link in doc_links:
                        if isinstance(link, dict):
                            link_href = _normalize_url(link.get("href") or "")
                            if link_href and link_href == norm_entry_url:
                                matched = True
                                break

                # 3. Source Registry ID prop match in metadata
                if not matched and entry_id and isinstance(doc_props, list):
                    for prop in doc_props:
                        if isinstance(prop, dict) and prop.get("name") in ("source-registry-id", "registry-id"):
                            if (prop.get("value") or "").strip().lower() == entry_id:
                                matched = True
                                matched_id_or_primary = True
                                break

                # 4. Normalized title match
                if not matched and doc_title:
                    norm_doc = _normalize_title(doc_title)
                    for ct in candidate_titles:
                        norm_cand = _normalize_title(ct)
                        if not norm_cand:
                            continue
                        # Exact normalized match
                        if norm_doc == norm_cand:
                            matched = True
                            break
                        # Or specific prefix match if candidate title is long and specific (>= 25 chars)
                        if len(norm_cand) >= 25 and norm_doc.startswith(norm_cand):
                            matched = True
                            break

                if matched:
                    matching_docs.append((doc_uuid, doc_version, doc_last_mod, matched_id_or_primary))

            if matching_docs:
                is_imported = True
                # Pick best match: prefer exact match on primary uuid or source-registry-id,
                # then latest last-modified date, then latest version string
                primary_uuid = (entry.get("uuid") or "").lower()
                matching_docs.sort(
                    key=lambda m: (
                        1 if (m[0] == primary_uuid or m[3]) else 0,
                        m[2] or "",
                        m[1] or ""
                    ),
                    reverse=True
                )
                best_match = matching_docs[0]
                workspace_doc_id = best_match[0]
                workspace_version = best_match[1]

        entry["is_imported"] = is_imported
        if workspace_version:
            entry["workspace_version"] = workspace_version
        if workspace_doc_id:
            entry["workspace_doc_id"] = workspace_doc_id
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
        stage = entry["model"]
        stage_alias = STAGE_MAPPING.get(stage, stage)
        doc_root = _get_doc_root(document, stage_alias)
        if doc_root and isinstance(doc_root, dict):
            meta = doc_root.setdefault("metadata", {})
            props = meta.setdefault("props", [])
            if not any(isinstance(p, dict) and p.get("name") == "source-registry-id" for p in props):
                props.append({"name": "source-registry-id", "value": source_id})

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
