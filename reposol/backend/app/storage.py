"""
Storage Facade Layer for OSCAL workspace management and document persistence.
Delegates data access to app.repositories and domain transformations to app.services.
"""

from app.repositories.workspace_repository import (
    DATA_DIR,
    TEMPLATES_DIR,
    PROTECTED_WORKSPACE_IDS,
    is_safe_subdir,
    sync_master_templates,
    get_stage_dir,
    delete_workspace,
)

from app.repositories.document_repository import (
    is_valid_uuid,
    safe_file_delete,
    UUID_PATTERN,
    UUID_SEARCH_PATTERN,
    _catalog_uuid_from_href,
)

from app.services.profile_service import (
    preprocess_profile_for_saving,
    postprocess_profile_for_loading,
    preprocess_catalog_for_saving,
    remove_empty_arrays,
    prune_orphaned_alters,
    cleanup_local_catalogs,
    _normalize_replacement_part_ids,
)

from app.services.document_service import (
    _prune_doc_for_listing,
    list_documents,
    get_document,
    save_document,
    delete_document,
    get_document_versions,
    get_document_version,
    save_document_version,
    delete_document_version,
)

REPOSOL_NAMESPACE = "https://reposol.org/ns"

