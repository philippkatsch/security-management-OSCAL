import logging
import asyncio
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone

from app.constants import STAGE_ROOT_KEYS
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
    """Retrieves a document, applying profile postprocessing if requested for UI."""
    if include_draft is None:
        include_draft = for_ui
    doc, etag = await repo_get_document(stage, doc_id, include_draft=include_draft, workspace_id=workspace_id)
    if stage == "profiles" and for_ui:
        doc = await postprocess_profile_for_loading(doc, workspace_id)
    return doc, etag


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
    else:
        document = remove_empty_arrays(document)

    if not skip_validation and not doc_id.endswith("-draft"):
        await validate_document(stage, document, workspace_id=workspace_id)

    saved_doc, new_etag, existed = await repo_save_document(stage, doc_id, document, workspace_id=workspace_id, if_match=if_match)
    if stage == "profiles":
        saved_doc = await postprocess_profile_for_loading(saved_doc, workspace_id)
    await cleanup_local_catalogs(workspace_id=workspace_id)
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
    return doc


async def save_document_version(stage: str, doc_id: str, version: str, document: Dict[str, Any], is_draft: bool = False, remarks: Optional[str] = None, workspace_id: Optional[str] = None, skip_validation: bool = False) -> None:
    """Preprocesses, validates and saves a document version."""
    root_key = STAGE_ROOT_KEYS[stage]
    
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
    else:
        document = remove_empty_arrays(document)

    if not skip_validation:
        await validate_document(stage, document, workspace_id=workspace_id)

    await repo_save_document_version(stage, doc_id, version, document, is_draft=is_draft, workspace_id=workspace_id)
    await cleanup_local_catalogs(workspace_id=workspace_id)


async def delete_document_version(stage: str, doc_id: str, version: str, workspace_id: Optional[str] = None) -> None:
    """Deletes a specific document version."""
    await repo_delete_document_version(stage, doc_id, version, workspace_id=workspace_id)
    await cleanup_local_catalogs(workspace_id=workspace_id)
