import logging
from typing import List, Dict, Any, Optional

from app.constants import STAGE_ROOT_KEYS
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
    cleanup_local_catalogs,
)

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
    for k in ("id", "type", "href", "remarks", "import-profile", "imports"):
        if k in root:
            summary_root[k] = root[k]
    return {root_key: summary_root}


def list_documents(stage: str, workspace_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """Lists all saved documents for a specific stage formatted for API listing."""
    raw_docs = list_raw_documents(stage, workspace_id)
    processed_docs = []
    for doc in raw_docs:
        if stage == "profiles":
            doc = postprocess_profile_for_loading(doc, workspace_id)
        processed_docs.append(_prune_doc_for_listing(doc, stage))
    return processed_docs


def get_document(stage: str, doc_id: str, *, for_ui: bool = True, workspace_id: Optional[str] = None) -> Dict[str, Any]:
    """Retrieves a document, applying profile postprocessing if requested for UI."""
    doc = repo_get_document(stage, doc_id, workspace_id=workspace_id)
    if stage == "profiles" and for_ui:
        doc = postprocess_profile_for_loading(doc, workspace_id)
    return doc


def save_document(stage: str, doc_id: str, document: Dict[str, Any], workspace_id: Optional[str] = None) -> bool:
    """Preprocesses and saves or updates a document."""
    if stage == "profiles":
        document = preprocess_profile_for_saving(document, workspace_id=workspace_id)
    elif stage == "catalogs":
        document = preprocess_catalog_for_saving(document)

    existed = repo_save_document(stage, doc_id, document, workspace_id=workspace_id)
    cleanup_local_catalogs(workspace_id=workspace_id)
    return existed


def delete_document(stage: str, doc_id: str, workspace_id: Optional[str] = None) -> None:
    """Deletes a document and its versions, cleaning up associated caches."""
    repo_delete_document(stage, doc_id, workspace_id=workspace_id)
    cleanup_local_catalogs(workspace_id=workspace_id)


def get_document_versions(stage: str, doc_id: str, workspace_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """Lists all version entries for a document."""
    return repo_get_document_versions(stage, doc_id, workspace_id=workspace_id)


def get_document_version(stage: str, doc_id: str, version: str, workspace_id: Optional[str] = None) -> Dict[str, Any]:
    """Retrieves a specific document version."""
    doc = repo_get_document_version(stage, doc_id, version, workspace_id=workspace_id)
    if stage == "profiles":
        doc = postprocess_profile_for_loading(doc, workspace_id)
    return doc


def save_document_version(stage: str, doc_id: str, version: str, document: Dict[str, Any], is_draft: bool = False, workspace_id: Optional[str] = None) -> None:
    """Preprocesses and saves a document version."""
    if stage == "profiles":
        document = preprocess_profile_for_saving(document, workspace_id=workspace_id)
    elif stage == "catalogs":
        document = preprocess_catalog_for_saving(document)

    repo_save_document_version(stage, doc_id, version, document, is_draft=is_draft, workspace_id=workspace_id)
    cleanup_local_catalogs(workspace_id=workspace_id)


def delete_document_version(stage: str, doc_id: str, version: str, workspace_id: Optional[str] = None) -> None:
    """Deletes a specific document version."""
    repo_delete_document_version(stage, doc_id, version, workspace_id=workspace_id)
    cleanup_local_catalogs(workspace_id=workspace_id)
