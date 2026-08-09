import os
import json
import re
import glob
import time
import logging
from typing import List, Dict, Any, Optional
from filelock import FileLock
from app.constants import STAGE_ROOT_KEYS
from app.repositories.workspace_repository import get_stage_dir, is_safe_subdir

logger = logging.getLogger(__name__)

UUID_PATTERN = re.compile(r"^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$")
UUID_SEARCH_PATTERN = re.compile(r"[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}")


def is_valid_uuid(uuid_str: str) -> bool:
    """Verifies that uuid_str strictly matches the UUIDv4 format."""
    if not uuid_str or not isinstance(uuid_str, str):
        return False
    return bool(UUID_PATTERN.match(uuid_str.strip()))


def _catalog_uuid_from_href(href: str) -> Optional[str]:
    """Extract a catalog UUID from an OSCAL URI reference used by this workspace."""
    match = UUID_SEARCH_PATTERN.search(href or "")
    return match.group(0).lower() if match else None


def _catalog_uuid_from_href(href: str) -> Optional[str]:
    """Extract a catalog UUID from an OSCAL URI reference used by this workspace."""
    match = UUID_SEARCH_PATTERN.search(href or "")
    return match.group(0).lower() if match else None


def get_file_lock(filepath: str) -> FileLock:
    """Returns a FileLock instance for the target file path."""
    lock_path = f"{filepath}.lock"
    return FileLock(lock_path, timeout=10.0)


def atomic_write_json(filepath: str, data: Dict[str, Any]) -> None:
    """
    Writes JSON data to a temporary file (.tmp) and atomically replaces the target file.
    Uses FileLock to prevent concurrent write race conditions.
    """
    tmp_filepath = f"{filepath}.tmp"
    lock = get_file_lock(filepath)
    with lock:
        with open(tmp_filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp_filepath, filepath)


def safe_file_delete(filepath: str, retries: int = 5, delay: float = 0.1) -> bool:
    """Delete a file with lock and retry logic for Windows file locking."""
    lock = get_file_lock(filepath)
    with lock:
        for attempt in range(retries):
            try:
                if os.path.exists(filepath):
                    os.remove(filepath)
                return True
            except (PermissionError, OSError):
                if attempt < retries - 1:
                    time.sleep(delay)
                else:
                    raise
    return False


def list_raw_documents(stage: str, workspace_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """Reads all saved document JSON objects for a stage directly from storage."""
    stage_dir = get_stage_dir(stage, workspace_id)
    seen_ids = set()
    documents = []

    if not os.path.exists(stage_dir):
        return []

    for filename in os.listdir(stage_dir):
        if filename.endswith(".json") and not filename.endswith("_draft.json") and not filename.endswith(".tmp.json"):
            doc_id = filename[:-5]
            if not is_valid_uuid(doc_id) or doc_id in seen_ids:
                continue
            file_path = os.path.join(stage_dir, filename)
            try:
                lock = get_file_lock(file_path)
                with lock:
                    with open(file_path, "r", encoding="utf-8") as f:
                        doc = json.load(f)
                        documents.append(doc)
                        seen_ids.add(doc_id)
            except (json.JSONDecodeError, OSError):
                continue

    return documents


def get_document(stage: str, doc_id: str, *, workspace_id: Optional[str] = None) -> Dict[str, Any]:
    """Retrieves details of a specific document from disk."""
    if ".." in doc_id:
        raise ValueError("Directory traversal attempt detected via document ID.")
    if not is_valid_uuid(doc_id):
        raise ValueError(f"Invalid document UUID format: '{doc_id}'")

    stage_dir = get_stage_dir(stage, workspace_id)
    draft_file_path = os.path.abspath(os.path.join(stage_dir, f"{doc_id}_draft.json"))
    if os.path.isfile(draft_file_path):
        file_path = draft_file_path
    else:
        file_path = os.path.abspath(os.path.join(stage_dir, f"{doc_id}.json"))

    if not os.path.isfile(file_path) and workspace_id:
        root_stage_dir = get_stage_dir(stage, workspace_id=None)
        root_draft = os.path.abspath(os.path.join(root_stage_dir, f"{doc_id}_draft.json"))
        root_main = os.path.abspath(os.path.join(root_stage_dir, f"{doc_id}.json"))
        if os.path.isfile(root_draft):
            file_path = root_draft
            stage_dir = root_stage_dir
        elif os.path.isfile(root_main):
            file_path = root_main
            stage_dir = root_stage_dir

    if not is_safe_subdir(stage_dir, file_path):
        raise ValueError("Directory traversal attempt detected via document ID.")

    if not os.path.isfile(file_path):
        raise FileNotFoundError(f"Document {doc_id} not found in stage {stage}")

    lock = get_file_lock(file_path)
    with lock:
        with open(file_path, "r", encoding="utf-8") as f:
            return json.load(f)


def save_document(stage: str, doc_id: str, document: Dict[str, Any], workspace_id: Optional[str] = None) -> bool:
    """Saves or updates a document atomically."""
    if ".." in doc_id:
        raise ValueError("Directory traversal attempt detected via document ID.")
    if not is_valid_uuid(doc_id):
        raise ValueError(f"Invalid document UUID format: '{doc_id}'")

    stage_dir = get_stage_dir(stage, workspace_id)
    file_path = os.path.abspath(os.path.join(stage_dir, f"{doc_id}.json"))

    if not is_safe_subdir(stage_dir, file_path):
        raise ValueError("Directory traversal attempt detected via document ID.")

    existed = os.path.isfile(file_path)
    atomic_write_json(file_path, document)
    return existed


def delete_document(stage: str, doc_id: str, workspace_id: Optional[str] = None) -> None:
    """Deletes a document and all of its saved versions."""
    if ".." in doc_id:
        raise ValueError("Directory traversal attempt detected via document ID.")
    if not is_valid_uuid(doc_id):
        raise ValueError(f"Invalid document UUID format: '{doc_id}'")

    stage_dir = get_stage_dir(stage, workspace_id)
    file_path = os.path.abspath(os.path.join(stage_dir, f"{doc_id}.json"))

    if not is_safe_subdir(stage_dir, file_path):
        raise ValueError("Directory traversal attempt detected via document ID.")

    if not os.path.isfile(file_path):
        raise FileNotFoundError(f"Document {doc_id} not found in stage {stage}")

    safe_file_delete(file_path)

    pattern = os.path.join(stage_dir, f"{doc_id}_v*.json")
    for filepath in glob.glob(pattern):
        if is_safe_subdir(stage_dir, filepath):
            safe_file_delete(filepath, retries=3)


def get_document_versions(stage: str, doc_id: str, workspace_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """Lists all version entries for a document."""
    if ".." in doc_id:
        raise ValueError("Directory traversal attempt detected via document ID.")
    if not is_valid_uuid(doc_id):
        raise ValueError(f"Invalid document UUID format: '{doc_id}'")

    stage_dir = get_stage_dir(stage, workspace_id)
    versions = []

    if not os.path.exists(stage_dir):
        return []

    draft_path = os.path.join(stage_dir, f"{doc_id}_draft.json")
    if os.path.isfile(draft_path):
        if is_safe_subdir(stage_dir, draft_path):
            try:
                lock = get_file_lock(draft_path)
                with lock:
                    with open(draft_path, "r", encoding="utf-8") as f:
                        doc = json.load(f)
                        root_key = STAGE_ROOT_KEYS[stage]
                        metadata = doc.get(root_key, {}).get("metadata", {})
                        version_str = metadata.get("version", "")
                        last_mod = metadata.get("last-modified", "")
                        title = metadata.get("title", "")
                        if not version_str.endswith("-draft"):
                            version_str = f"{version_str}-draft"
                        versions.append({
                            "version": version_str,
                            "last-modified": last_mod,
                            "title": title,
                            "remarks": "Temporarily saved (Draft)",
                            "is_draft": True,
                            "filename": os.path.basename(draft_path)
                        })
            except Exception:
                logger.warning("Failed to read draft version file %s", draft_path, exc_info=True)

    pattern = os.path.join(stage_dir, f"{doc_id}_v*.json")
    for filepath in glob.glob(pattern):
        if not is_safe_subdir(stage_dir, filepath):
            continue
        try:
            lock = get_file_lock(filepath)
            with lock:
                with open(filepath, "r", encoding="utf-8") as f:
                    doc = json.load(f)
                    root_key = STAGE_ROOT_KEYS[stage]
                    metadata = doc.get(root_key, {}).get("metadata", {})
                    version_str = metadata.get("version", "")
                    last_mod = metadata.get("last-modified", "")
                    title = metadata.get("title", "")
                    remarks = "No remarks"
                    revisions = metadata.get("revisions", [])
                    if revisions and isinstance(revisions, list):
                        for rev in revisions:
                            if rev.get("version") == version_str:
                                remarks = rev.get("remarks", remarks)
                                break
                    versions.append({
                        "version": version_str,
                        "last-modified": last_mod,
                        "title": title,
                        "remarks": remarks,
                        "filename": os.path.basename(filepath)
                    })
        except Exception:
            logger.warning("Failed to read version file %s", filepath, exc_info=True)
            continue

    active_path = os.path.join(stage_dir, f"{doc_id}.json")
    if os.path.isfile(active_path):
        try:
            lock = get_file_lock(active_path)
            with lock:
                with open(active_path, "r", encoding="utf-8") as f:
                    doc = json.load(f)
                    root_key = STAGE_ROOT_KEYS[stage]
                    metadata = doc.get(root_key, {}).get("metadata", {})
                    active_version = metadata.get("version", "")
                    if not any(v["version"] == active_version for v in versions):
                        versions.append({
                            "version": active_version,
                            "last-modified": metadata.get("last-modified", ""),
                            "title": metadata.get("title", ""),
                            "remarks": "Active version",
                            "filename": f"{doc_id}.json"
                        })
        except Exception:
            logger.warning("Failed to read active document %s", active_path, exc_info=True)

    versions.sort(key=lambda x: x["last-modified"], reverse=True)
    return versions


def get_document_version(stage: str, doc_id: str, version: str, workspace_id: Optional[str] = None) -> Dict[str, Any]:
    """Retrieves a specific version JSON of a document from disk."""
    if ".." in doc_id or ".." in version:
        raise ValueError("Directory traversal attempt detected via version name.")
    if not is_valid_uuid(doc_id):
        raise ValueError(f"Invalid document UUID format: '{doc_id}'")

    stage_dir = get_stage_dir(stage, workspace_id)

    if version.endswith("-draft") or "draft" in version.lower():
        file_path = os.path.abspath(os.path.join(stage_dir, f"{doc_id}_draft.json"))
    else:
        safe_version = re.sub(r'[^a-zA-Z0-9.-]', '_', version)
        file_path = os.path.abspath(os.path.join(stage_dir, f"{doc_id}_v{safe_version}.json"))

    if not is_safe_subdir(stage_dir, file_path):
        raise ValueError("Directory traversal attempt detected via version name.")

    if not os.path.isfile(file_path):
        active_path = os.path.abspath(os.path.join(stage_dir, f"{doc_id}.json"))
        if os.path.isfile(active_path):
            lock = get_file_lock(active_path)
            with lock:
                with open(active_path, "r", encoding="utf-8") as f:
                    doc = json.load(f)
                    root_key = STAGE_ROOT_KEYS[stage]
                    if doc.get(root_key, {}).get("metadata", {}).get("version") == version:
                        return doc
        raise FileNotFoundError(f"Version {version} of document {doc_id} not found.")

    lock = get_file_lock(file_path)
    with lock:
        with open(file_path, "r", encoding="utf-8") as f:
            return json.load(f)


def save_document_version(stage: str, doc_id: str, version: str, document: Dict[str, Any], is_draft: bool = False, workspace_id: Optional[str] = None) -> None:
    """Saves a document version atomically, and updates active file if not draft."""
    if ".." in doc_id or ".." in version:
        raise ValueError("Directory traversal attempt detected.")
    if not is_valid_uuid(doc_id):
        raise ValueError(f"Invalid document UUID format: '{doc_id}'")

    stage_dir = get_stage_dir(stage, workspace_id)

    if is_draft:
        version_file_path = os.path.abspath(os.path.join(stage_dir, f"{doc_id}_draft.json"))
    else:
        safe_version = re.sub(r'[^a-zA-Z0-9.-]', '_', version)
        version_file_path = os.path.abspath(os.path.join(stage_dir, f"{doc_id}_v{safe_version}.json"))
        active_file_path = os.path.abspath(os.path.join(stage_dir, f"{doc_id}.json"))

    if not is_safe_subdir(stage_dir, version_file_path):
        raise ValueError("Directory traversal attempt detected.")

    atomic_write_json(version_file_path, document)

    if not is_draft:
        if os.path.isfile(active_file_path):
            try:
                lock = get_file_lock(active_file_path)
                with lock:
                    with open(active_file_path, "r", encoding="utf-8") as f:
                        existing_doc = json.load(f)
                        root_key = STAGE_ROOT_KEYS.get(stage, stage[:-1] if stage.endswith('s') else stage)
                        old_ver = existing_doc.get(root_key, {}).get("metadata", {}).get("version")
                        if old_ver and old_ver != version:
                            safe_old_ver = re.sub(r'[^a-zA-Z0-9.-]', '_', old_ver)
                            old_ver_path = os.path.abspath(os.path.join(stage_dir, f"{doc_id}_v{safe_old_ver}.json"))
                            if not os.path.isfile(old_ver_path):
                                atomic_write_json(old_ver_path, existing_doc)
            except Exception:
                pass

        if not is_safe_subdir(stage_dir, active_file_path):
            raise ValueError("Directory traversal attempt detected.")
        atomic_write_json(active_file_path, document)

        draft_path = os.path.join(stage_dir, f"{doc_id}_draft.json")
        if os.path.isfile(draft_path):
            try:
                safe_file_delete(draft_path)
            except Exception:
                logger.warning("Failed to delete draft file %s", draft_path, exc_info=True)


def delete_document_version(stage: str, doc_id: str, version: str, workspace_id: Optional[str] = None) -> None:
    """Deletes a specific saved version of a document."""
    if ".." in doc_id or ".." in version:
        raise ValueError("Directory traversal attempt detected.")
    if not is_valid_uuid(doc_id):
        raise ValueError(f"Invalid document UUID format: '{doc_id}'")

    stage_dir = get_stage_dir(stage, workspace_id)
    if version.endswith("-draft") or "draft" in version.lower():
        file_path = os.path.abspath(os.path.join(stage_dir, f"{doc_id}_draft.json"))
    else:
        safe_version = re.sub(r'[^a-zA-Z0-9.-]', '_', version)
        file_path = os.path.abspath(os.path.join(stage_dir, f"{doc_id}_v{safe_version}.json"))

    if not is_safe_subdir(stage_dir, file_path):
        raise ValueError("Directory traversal attempt detected.")

    if not os.path.isfile(file_path):
        raise FileNotFoundError(f"Version {version} of document {doc_id} not found.")

    safe_file_delete(file_path)
