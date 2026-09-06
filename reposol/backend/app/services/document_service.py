import logging
import asyncio
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone

from app.constants import STAGE_ROOT_KEYS, DRAFT_SUFFIX
from app.validation import validate_document
from app.repositories.document_repository import (
    is_valid_uuid,
    list_raw_documents,
    get_document as repo_get_document,
    save_document as repo_save_document,
    delete_document as repo_delete_document,
    get_document_versions as repo_get_document_versions,
    get_document_version as repo_get_document_version,
    save_document_version as repo_save_document_version,
    delete_document_version as repo_delete_document_version,
)
from app.services.profile_service import (
    preprocess_profile_for_saving,
    postprocess_profile_for_loading,
    preprocess_catalog_for_saving,
    remove_empty_arrays,
    cleanup_local_catalogs,
)
from app.services.resolution_service import clear_resolution_cache

logger = logging.getLogger(__name__)


def _prune_doc_for_listing(doc: Dict[str, Any], stage: str) -> Dict[str, Any]:
    """Returns a lightweight summary of an OSCAL document for list endpoints."""
    root_key = STAGE_ROOT_KEYS.get(stage)
    if not root_key or root_key not in doc:
        return doc
    root = doc[root_key]
    summary_root = {
        "uuid": root.get("uuid"),
        "metadata": root.get("metadata", {}),
    }
    for k in ("id", "type", "href", "remarks", "import-profile", "import-ssp", "import-ap", "imports"):
        if k in root:
            summary_root[k] = root[k]
    
    result = {root_key: summary_root}
    if "_etag" in doc:
        result["_etag"] = doc["_etag"]
        
    return result


async def list_documents(stage: str, workspace_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """Lists all saved documents for a specific stage formatted for API listing."""
    raw_docs = await list_raw_documents(stage, workspace_id)
    processed_docs = []
    for doc in raw_docs:
        if stage == "profiles":
            doc = await postprocess_profile_for_loading(doc, workspace_id)
        elif stage in ("control-mappings", "control-mapping", "mapping-collections", "mapping-collection"):
            doc = postprocess_control_mapping_for_loading(doc)
        processed_docs.append(_prune_doc_for_listing(doc, stage))
    return processed_docs


async def get_document(
    stage: str,
    doc_id: str,
    *,
    for_ui: bool = True,
    include_draft: Optional[bool] = None,
    workspace_id: Optional[str] = None
) -> tuple[Dict[str, Any], str]:
    """Retrieves a document, applying profile/mapping postprocessing if requested for UI."""
    if include_draft is None:
        include_draft = for_ui
    doc, etag = await repo_get_document(stage, doc_id, include_draft=include_draft, workspace_id=workspace_id)
    if stage == "profiles" and for_ui:
        doc = await postprocess_profile_for_loading(doc, workspace_id)
    elif stage in ("control-mappings", "control-mapping", "mapping-collections", "mapping-collection") and for_ui:
        doc = postprocess_control_mapping_for_loading(doc)
    return doc, etag


def preprocess_control_mapping_for_saving(document: Dict[str, Any]) -> Dict[str, Any]:
    """Ensures mapping-collection strictly conforms to OSCAL v1.2.2 schema."""
    doc = remove_empty_arrays(document)
    root = doc.get("mapping-collection") or doc.get("control-mapping")
    if isinstance(root, dict):
        mappings = root.get("mappings")
        if isinstance(mappings, list):
            for m in mappings:
                if isinstance(m, dict):
                    # 1. source-resource and target-resource title props
                    for res_key in ("source-resource", "target-resource"):
                        res = m.get(res_key)
                        if isinstance(res, dict) and "title" in res:
                            title_val = res.pop("title")
                            if title_val and isinstance(title_val, str):
                                props = res.setdefault("props", [])
                                existing = next((p for p in props if isinstance(p, dict) and p.get("name") == "title"), None)
                                if existing:
                                    existing["value"] = title_val
                                else:
                                    props.append({"name": "title", "value": title_val})
                    
                    # 2. Sanitize individual map entries
                    maps = m.get("maps")
                    if isinstance(maps, list):
                        valid_maps = []
                        valid_subjects = {"source", "target", "both"}
                        valid_predicates = {"has-requirement", "has-incompatibility"}
                        valid_categories = {"restricted", "addressable", "blocked"}

                        for entry in maps:
                            if not isinstance(entry, dict):
                                continue

                            # Prune empty sources and targets
                            if "sources" in entry and isinstance(entry["sources"], list):
                                entry["sources"] = [s for s in entry["sources"] if isinstance(s, dict) and s.get("id-ref") and str(s.get("id-ref")).strip()]
                            if "targets" in entry and isinstance(entry["targets"], list):
                                entry["targets"] = [t for t in entry["targets"] if isinstance(t, dict) and t.get("id-ref") and str(t.get("id-ref")).strip()]

                            # Method belongs in props or provenance, not map
                            if "method" in entry:
                                method_val = entry.pop("method", None)
                                if method_val:
                                    props = entry.setdefault("props", [])
                                    existing = next((p for p in props if isinstance(p, dict) and p.get("name") == "method"), None)
                                    if existing:
                                        existing["value"] = str(method_val)
                                    else:
                                        props.append({"name": "method", "value": str(method_val)})

                            # matching-rationale enum validation: ['syntactic', 'semantic', 'functional']
                            valid_rationales = {"syntactic", "semantic", "functional"}
                            mr = entry.get("matching-rationale")
                            if mr:
                                if str(mr).lower() in valid_rationales:
                                    entry["matching-rationale"] = str(mr).lower()
                                else:
                                    props = entry.setdefault("props", [])
                                    existing = next((p for p in props if isinstance(p, dict) and p.get("name") == "rationale"), None)
                                    if existing:
                                        existing["value"] = str(mr)
                                    else:
                                        props.append({"name": "rationale", "value": str(mr)})
                                    entry["matching-rationale"] = "semantic"

                            # Confidence score must be { percentage: 0..1 } or { category: string }
                            if "confidence-score" in entry:
                                cs = entry.get("confidence-score")
                                if cs is None or cs == "":
                                    entry.pop("confidence-score", None)
                                elif isinstance(cs, (int, float)):
                                    pct = float(cs)
                                    if pct > 1.0:
                                        pct = round(pct / 100.0, 4)
                                    entry["confidence-score"] = {"percentage": pct}
                                elif isinstance(cs, str):
                                    try:
                                        pct = float(cs)
                                        if pct > 1.0:
                                            pct = round(pct / 100.0, 4)
                                        entry["confidence-score"] = {"percentage": pct}
                                    except ValueError:
                                        entry["confidence-score"] = {"category": cs}
                                elif isinstance(cs, dict):
                                    if "percentage" in cs and isinstance(cs["percentage"], (int, float)) and cs["percentage"] > 1.0:
                                        cs["percentage"] = round(cs["percentage"] / 100.0, 4)

                            # Qualifiers normalization
                            if "qualifiers" in entry and isinstance(entry["qualifiers"], list):
                                for q in entry["qualifiers"]:
                                    if isinstance(q, dict):
                                        subj = str(q.get("subject", "")).strip().lower()
                                        if subj not in valid_subjects:
                                            q["subject"] = "source" if "source" in subj else ("target" if "target" in subj else "both")
                                        pred = str(q.get("predicate", "")).strip().lower()
                                        if pred not in valid_predicates:
                                            q["predicate"] = "has-incompatibility" if "incompat" in pred else "has-requirement"
                                        cat = str(q.get("category", "")).strip().lower()
                                        if cat not in valid_categories:
                                            q["category"] = "restricted" if "restrict" in cat else ("blocked" if "block" in cat else "addressable")
                                        if not q.get("description"):
                                            q["description"] = "Qualifier details"

                            valid_maps.append(entry)
                        m["maps"] = valid_maps
    return doc


def postprocess_control_mapping_for_loading(document: Dict[str, Any]) -> Dict[str, Any]:
    """Exposes title on source-resource and target-resource and extracts map props for UI consumers."""
    root = document.get("mapping-collection") or document.get("control-mapping")
    if isinstance(root, dict):
        mappings = root.get("mappings")
        if isinstance(mappings, list):
            for m in mappings:
                if isinstance(m, dict):
                    for res_key in ("source-resource", "target-resource"):
                        res = m.get(res_key)
                        if isinstance(res, dict) and "props" in res and "title" not in res:
                            for p in res.get("props", []):
                                if isinstance(p, dict) and p.get("name") == "title" and p.get("value"):
                                    res["title"] = p.get("value")
                                    break
                    maps = m.get("maps")
                    if isinstance(maps, list):
                        for entry in maps:
                            if isinstance(entry, dict):
                                # Surface method from props if not present
                                if "method" not in entry and "props" in entry:
                                    method_prop = next((p for p in entry["props"] if isinstance(p, dict) and p.get("name") == "method"), None)
                                    if method_prop and method_prop.get("value"):
                                        entry["method"] = method_prop["value"]
                                # Surface confidence-score to UI string representation
                                if "confidence-score" in entry:
                                    cs = entry["confidence-score"]
                                    if isinstance(cs, dict):
                                        if "percentage" in cs and isinstance(cs["percentage"], (int, float)):
                                            pct = cs["percentage"]
                                            entry["confidence-score"] = str(int(round(pct * 100))) if (pct * 100).is_integer() else str(round(pct * 100, 2))
                                        elif "category" in cs:
                                            entry["confidence-score"] = str(cs["category"])
                                # Surface freeform rationale from props if present
                                if "props" in entry and isinstance(entry["props"], list):
                                    rat_prop = next((p for p in entry["props"] if isinstance(p, dict) and p.get("name") == "rationale"), None)
                                    if rat_prop and rat_prop.get("value"):
                                        entry["matching-rationale"] = rat_prop["value"]
    return document


async def save_document(
    stage: str,
    doc_id: str,
    document: Dict[str, Any],
    workspace_id: Optional[str] = None,
    skip_validation: bool = False,
    if_match: Optional[str] = None,
) -> tuple[Dict[str, Any], str, bool]:
    """Preprocesses, validates and saves or updates a document."""
    if stage == "profiles":
        document = await preprocess_profile_for_saving(document, persist_local_catalog=True, workspace_id=workspace_id)
    elif stage == "catalogs":
        document = preprocess_catalog_for_saving(document)
    elif stage in ("control-mappings", "control-mapping", "mapping-collections", "mapping-collection"):
        document = preprocess_control_mapping_for_saving(document)
    else:
        document = remove_empty_arrays(document)

    if not skip_validation and not doc_id.endswith("-draft"):
        await validate_document(stage, document, workspace_id=workspace_id)

    saved_doc, new_etag, existed = await repo_save_document(stage, doc_id, document, workspace_id=workspace_id, if_match=if_match)
    if stage == "profiles":
        saved_doc = await postprocess_profile_for_loading(saved_doc, workspace_id)
        await cleanup_local_catalogs(workspace_id=workspace_id)
    elif stage in ("control-mappings", "control-mapping", "mapping-collections", "mapping-collection"):
        saved_doc = postprocess_control_mapping_for_loading(saved_doc)
    clear_resolution_cache()
    return saved_doc, new_etag, existed


async def delete_document(stage: str, doc_id: str, force: bool = False, workspace_id: Optional[str] = None) -> None:
    """Deletes a document and its versions, checking referential integrity first unless forced."""
    if not force:
        referrers = []
        for s, root_key in STAGE_ROOT_KEYS.items():
            try:
                docs = await list_raw_documents(s, workspace_id=workspace_id)
            except Exception:
                docs = []
            for doc in docs:
                data = doc.get(root_key, {})
                doc_uuid = data.get("uuid")
                if not doc_uuid or doc_uuid == doc_id:
                    continue
                # Targeted check: scan only known reference fields for the target UUID
                def _contains_ref(obj, target):
                    if isinstance(obj, dict):
                        for k, v in obj.items():
                            if isinstance(v, str) and target in v:
                                return True
                            if isinstance(v, (dict, list)):
                                if _contains_ref(v, target):
                                    return True
                    elif isinstance(obj, list):
                        for item in obj:
                            if _contains_ref(item, target):
                                return True
                    return False
                if _contains_ref(data, doc_id):
                    meta = data.get("metadata", {})
                    referrers.append({
                        "uuid": doc_uuid,
                        "title": meta.get("title", "Untitled"),
                        "stage": s
                    })
        if referrers:
            ref_list = ", ".join(f"'{r['title']}' ({r['stage']})" for r in referrers)
            raise ValueError(
                f"This document is referenced by the following documents and cannot be easily deleted: {ref_list}. Use 'force=true' to delete."
            )

    await repo_delete_document(stage, doc_id, workspace_id=workspace_id)
    if stage == "profiles":
        await cleanup_local_catalogs(workspace_id=workspace_id)
    clear_resolution_cache()


async def get_document_versions(stage: str, doc_id: str, workspace_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """Lists all version entries for a document."""
    return await repo_get_document_versions(stage, doc_id, workspace_id=workspace_id)


async def get_document_version(stage: str, doc_id: str, version: str, workspace_id: Optional[str] = None) -> Dict[str, Any]:
    """Retrieves a specific document version."""
    doc = await repo_get_document_version(stage, doc_id, version, workspace_id=workspace_id)
    if stage == "profiles":
        doc = await postprocess_profile_for_loading(doc, workspace_id)
    elif stage in ("control-mappings", "control-mapping", "mapping-collections", "mapping-collection"):
        doc = postprocess_control_mapping_for_loading(doc)
    return doc


async def save_document_version(stage: str, doc_id: str, version: str, document: Dict[str, Any], is_draft: bool = False, remarks: Optional[str] = None, workspace_id: Optional[str] = None, skip_validation: bool = False) -> None:
    """Preprocesses, validates and saves a document version."""
    root_key = STAGE_ROOT_KEYS[stage]
    
    # Check if this is a draft version
    is_draft = bool(is_draft or version.endswith(DRAFT_SUFFIX) or "draft" in version.lower())
    
    # Automatic revision tracking (US 0.7) - Only for official versions
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    metadata = document[root_key].setdefault("metadata", {})
    metadata["last-modified"] = now_str
    
    if not is_draft:
        revisions = metadata.setdefault("revisions", [])
        new_rev = {
            "version": version,
            "last-modified": now_str,
            "oscal-version": metadata.get("oscal-version", "1.1.2"),
            "remarks": remarks or "Version saved"
        }
        revisions.insert(0, new_rev)

    if stage == "profiles":
        document = await preprocess_profile_for_saving(document, persist_local_catalog=True, workspace_id=workspace_id)
    elif stage == "catalogs":
        document = preprocess_catalog_for_saving(document)
    elif stage in ("control-mappings", "control-mapping", "mapping-collections", "mapping-collection"):
        document = preprocess_control_mapping_for_saving(document)
    else:
        document = remove_empty_arrays(document)

    if not skip_validation and not is_draft:
        await validate_document(stage, document, workspace_id=workspace_id)

    await repo_save_document_version(stage, doc_id, version, document, is_draft=is_draft, workspace_id=workspace_id)
    if stage == "profiles":
        await cleanup_local_catalogs(workspace_id=workspace_id)


async def delete_document_version(stage: str, doc_id: str, version: str, workspace_id: Optional[str] = None) -> None:
    """Deletes a specific document version."""
    await repo_delete_document_version(stage, doc_id, version, workspace_id=workspace_id)
    if stage == "profiles":
        await cleanup_local_catalogs(workspace_id=workspace_id)
