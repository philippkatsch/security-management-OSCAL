import os
import json
import re
import glob
import logging
import asyncio
import aiofiles
import aiofiles.os
from typing import List, Dict, Any, Optional
from app.constants import STAGE_ROOT_KEYS, DRAFT_SUFFIX, VERSION_SEPARATOR, TEMP_EXTENSION
from app.repositories.workspace_repository import get_stage_dir, is_safe_subdir

logger = logging.getLogger(__name__)

UUID_PATTERN = re.compile(r"^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$")
UUID_SEARCH_PATTERN = re.compile(r"[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}")

_file_locks: Dict[str, asyncio.Lock] = {}
_file_locks_lock = asyncio.Lock()

import inspect
import functools

def validate_doc_id(func):
    @functools.wraps(func)
    async def wrapper(*args, **kwargs):
        bound = inspect.signature(func).bind(*args, **kwargs)
        bound.apply_defaults()
        doc_id = bound.arguments.get('doc_id', '')
        if ".." in doc_id or "/" in doc_id or "\\" in doc_id:
            raise ValueError(f"Directory traversal detected: '{doc_id}'")
        if not is_valid_uuid(str(doc_id)):
            raise ValueError(f'Invalid document UUID format: {doc_id}')
        return await func(*args, **kwargs)
    return wrapper


def is_valid_uuid(uuid_str: str) -> bool:
    """Verifies that uuid_str strictly matches the UUIDv4 format (allowing optional -draft suffix)."""
    if not uuid_str or not isinstance(uuid_str, str):
        return False
    clean_str = uuid_str.strip()
    if clean_str.endswith("-draft"):
        clean_str = clean_str[:-6]
    return bool(UUID_PATTERN.match(clean_str))


def _catalog_uuid_from_href(href: str) -> Optional[str]:
    """Extract a catalog UUID from an OSCAL URI reference used by this workspace."""
    match = UUID_SEARCH_PATTERN.search(href or "")
    return match.group(0).lower() if match else None


class ETagMismatchError(Exception):
    """Raised when an If-Match ETag check fails during document persistence."""
    def __init__(self, current_doc: Dict[str, Any], current_etag: str):
        self.current_doc = current_doc
        self.current_etag = current_etag
        self.detail = "Document has been modified by another user"
        super().__init__(self.detail)


def _get_lock_key(path: str) -> str:
    """Canonicalize a file path to ensure consistent dictionary key representation for file locks."""
    return os.path.normcase(os.path.abspath(os.path.normpath(str(path))))


async def get_file_lock(filepath: str) -> asyncio.Lock:
    """Returns an asyncio.Lock instance for the target file path using canonicalized key."""
    key = _get_lock_key(filepath)
    async with _file_locks_lock:
        if key not in _file_locks:
            _file_locks[key] = asyncio.Lock()
        return _file_locks[key]


async def _evict_file_lock(filepath: str) -> None:
    """Remove lock entry for filepath from _file_locks if present."""
    norm_key = _get_lock_key(filepath)
    async with _file_locks_lock:
        _file_locks.pop(norm_key, None)


async def _atomic_write_json_unlocked(filepath: str, data: Dict[str, Any]) -> None:
    """Writes JSON data to a temporary file (.tmp) and replaces target without re-acquiring lock."""
    tmp_filepath = f"{filepath}{TEMP_EXTENSION}"
    async with aiofiles.open(tmp_filepath, "w", encoding="utf-8") as f:
        await f.write(json.dumps(data, indent=2, ensure_ascii=False))
        await f.flush()
        os.fsync(f.fileno())
    await aiofiles.os.replace(tmp_filepath, filepath)


async def atomic_write_json(filepath: str, data: Dict[str, Any]) -> None:
    """Writes JSON data atomically under per-file lock."""
    lock = await get_file_lock(filepath)
    async with lock:
        await _atomic_write_json_unlocked(filepath, data)


async def safe_file_delete(filepath: str, retries: int = 5, delay: float = 0.1) -> bool:
    """Delete a file with lock, retry logic, and lock cache eviction."""
    norm_key = _get_lock_key(filepath)
    lock = await get_file_lock(filepath)
    deleted = False
    try:
        async with lock:
            for attempt in range(retries):
                try:
                    if await aiofiles.os.path.exists(filepath):
                        await aiofiles.os.remove(filepath)
                    deleted = True
                    break
                except (PermissionError, OSError):
                    if attempt < retries - 1:
                        await asyncio.sleep(delay)
                    else:
                        raise
    finally:
        async with _file_locks_lock:
            _file_locks.pop(norm_key, None)
    return deleted


async def list_raw_documents(stage: str, workspace_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """Reads all saved document JSON objects for a stage directly from storage."""
    stage_dir = await get_stage_dir(stage, workspace_id)
    seen_ids = set()
    documents = []

    if not await aiofiles.os.path.exists(stage_dir):
        return []

    stage_dir_list = await aiofiles.os.listdir(stage_dir)
    for filename in stage_dir_list:
        if filename.endswith(".json") and not filename.endswith(f"{DRAFT_SUFFIX}.json") and not filename.endswith(f"{TEMP_EXTENSION}.json"):
            doc_id = filename[:-5]
            if not is_valid_uuid(doc_id) or doc_id in seen_ids:
                continue
            file_path = os.path.join(stage_dir, filename)
            try:
                if not await aiofiles.os.path.exists(file_path):
                    await _evict_file_lock(file_path)
                    continue
                lock = await get_file_lock(file_path)
                async with lock:
                    if not await aiofiles.os.path.exists(file_path):
                        await _evict_file_lock(file_path)
                        continue
                    async with aiofiles.open(file_path, "rb") as f:
                        content = await f.read()
                        doc = json.loads(content)
                        doc["_etag"] = compute_etag(content)
                        documents.append(doc)
                        seen_ids.add(doc_id)
            except (json.JSONDecodeError, OSError):
                await _evict_file_lock(file_path)
                continue

    return documents


async def list_documents_by_stage(stage: str, workspace_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """Returns a list of all documents for a stage."""
    return await list_raw_documents(stage, workspace_id)

async def document_exists(stage: str, doc_id: str, workspace_id: Optional[str] = None) -> bool:
    """Checks if a document exists by ID, checking workspace and falling back to default."""
    stage_dir = await get_stage_dir(stage, workspace_id)
    file_path = os.path.abspath(os.path.join(stage_dir, f"{doc_id}.json"))
    if await aiofiles.os.path.exists(file_path):
        return True
    if workspace_id:
        root_stage_dir = await get_stage_dir(stage, workspace_id=None)
        root_file_path = os.path.abspath(os.path.join(root_stage_dir, f"{doc_id}.json"))
        return await aiofiles.os.path.exists(root_file_path)
    return False

async def get_raw_document_path(stage: str, doc_id: str, workspace_id: Optional[str] = None) -> str:
    """Gets the file path for a document."""
    stage_dir = await get_stage_dir(stage, workspace_id)
    return os.path.abspath(os.path.join(stage_dir, f"{doc_id}.json"))

import hashlib

def compute_etag(content: bytes) -> str:
    """Compute ETag from file content."""
    return hashlib.sha256(content).hexdigest()[:16]

@validate_doc_id
async def get_document(
    stage: str,
    doc_id: str,
    *,
    include_draft: bool = False,
    workspace_id: Optional[str] = None
) -> tuple[Dict[str, Any], str]:
    """Retrieves details of a specific document from disk."""
    stage_dir = await get_stage_dir(stage, workspace_id)
    if include_draft:
        draft_file_path = os.path.abspath(os.path.join(stage_dir, f"{doc_id}{DRAFT_SUFFIX}.json"))
        if await aiofiles.os.path.exists(draft_file_path):
            file_path = draft_file_path
        else:
            file_path = os.path.abspath(os.path.join(stage_dir, f"{doc_id}.json"))
    else:
        file_path = os.path.abspath(os.path.join(stage_dir, f"{doc_id}.json"))

    if not await aiofiles.os.path.exists(file_path) and workspace_id:
        root_stage_dir = await get_stage_dir(stage, workspace_id=None)
        root_draft = os.path.abspath(os.path.join(root_stage_dir, f"{doc_id}{DRAFT_SUFFIX}.json"))
        root_main = os.path.abspath(os.path.join(root_stage_dir, f"{doc_id}.json"))
        if include_draft and await aiofiles.os.path.exists(root_draft):
            file_path = root_draft
            stage_dir = root_stage_dir
        elif await aiofiles.os.path.exists(root_main):
            file_path = root_main
            stage_dir = root_stage_dir

    if not is_safe_subdir(stage_dir, file_path):
        raise ValueError("Directory traversal attempt detected via document ID.")

    norm_key = _get_lock_key(file_path)
    if not await aiofiles.os.path.exists(file_path):
        async with _file_locks_lock:
            _file_locks.pop(norm_key, None)
        raise FileNotFoundError(f"Document {doc_id} not found in stage {stage}")

    lock = await get_file_lock(file_path)
    try:
        async with lock:
            if not await aiofiles.os.path.exists(file_path):
                async with _file_locks_lock:
                    _file_locks.pop(norm_key, None)
                raise FileNotFoundError(f"Document {doc_id} not found in stage {stage}")
            async with aiofiles.open(file_path, "rb") as f:
                content = await f.read()
    except FileNotFoundError:
        async with _file_locks_lock:
            _file_locks.pop(norm_key, None)
        raise
    
    etag = compute_etag(content)
    doc = json.loads(content)
    return doc, etag

async def validate_etag(stage: str, doc_id: str, client_etag: str, workspace_id: Optional[str] = None) -> bool:
    """Check if client's ETag matches current file."""
    try:
        _, current_etag = await get_document(stage, doc_id, workspace_id=workspace_id)
        return client_etag == current_etag
    except FileNotFoundError:
        return False



@validate_doc_id
async def save_document(stage: str, doc_id: str, document: Dict[str, Any], workspace_id: Optional[str] = None, if_match: Optional[str] = None) -> tuple[Dict[str, Any], str, bool]:
    """Saves or updates a document atomically with optional ETag validation under lock."""

    stage_dir = await get_stage_dir(stage, workspace_id)
    file_path = _get_lock_key(os.path.join(stage_dir, f"{doc_id}.json"))

    if not is_safe_subdir(stage_dir, file_path):
        raise ValueError("Directory traversal attempt detected via document ID.")

    lock = await get_file_lock(file_path)
    async with lock:
        existed = await aiofiles.os.path.exists(file_path)
        if if_match and existed and not doc_id.endswith("-draft"):
            async with aiofiles.open(file_path, "rb") as f:
                content = await f.read()
            current_etag = compute_etag(content)
            clean_if_match = if_match.strip('"')
            if clean_if_match != current_etag:
                current_doc = json.loads(content)
                raise ETagMismatchError(current_doc=current_doc, current_etag=current_etag)

        content = json.dumps(document, indent=2, ensure_ascii=False).encode('utf-8')
        new_etag = compute_etag(content)
        await _atomic_write_json_unlocked(file_path, document)
        return document, new_etag, existed


@validate_doc_id
async def delete_document(stage: str, doc_id: str, workspace_id: Optional[str] = None) -> None:
    """Deletes a document and all of its saved versions."""

    stage_dir = await get_stage_dir(stage, workspace_id)
    file_path = os.path.abspath(os.path.join(stage_dir, f"{doc_id}.json"))

    if not is_safe_subdir(stage_dir, file_path):
        raise ValueError("Directory traversal attempt detected via document ID.")

    if not await aiofiles.os.path.exists(file_path):
        await _evict_file_lock(file_path)
        raise FileNotFoundError(f"Document {doc_id} not found in stage {stage}")

    await safe_file_delete(file_path)

    pattern = os.path.join(stage_dir, f"{doc_id}{VERSION_SEPARATOR}*.json")
    for filepath in glob.glob(pattern):
        if is_safe_subdir(stage_dir, filepath):
            await safe_file_delete(filepath, retries=3)


@validate_doc_id
async def get_document_versions(stage: str, doc_id: str, workspace_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """Lists all version entries for a document."""

    stage_dir = await get_stage_dir(stage, workspace_id)
    versions = []

    if not await aiofiles.os.path.exists(stage_dir):
        return []

    draft_path = os.path.join(stage_dir, f"{doc_id}{DRAFT_SUFFIX}.json")
    if await aiofiles.os.path.exists(draft_path):
        if is_safe_subdir(stage_dir, draft_path):
            try:
                if not await aiofiles.os.path.exists(draft_path):
                    await _evict_file_lock(draft_path)
                else:
                    lock = await get_file_lock(draft_path)
                    async with lock:
                        if not await aiofiles.os.path.exists(draft_path):
                            await _evict_file_lock(draft_path)
                        else:
                            async with aiofiles.open(draft_path, "r", encoding="utf-8") as f:
                                doc = json.loads(await f.read())
                                root_key = STAGE_ROOT_KEYS[stage]
                                metadata = doc.get(root_key, {}).get("metadata", {})
                                version_str = metadata.get("version", "")
                                last_mod = metadata.get("last-modified", "")
                                title = metadata.get("title", "")
                                if not version_str.endswith(DRAFT_SUFFIX):
                                    version_str = f"{version_str}{DRAFT_SUFFIX}"
                                versions.append({
                                    "version": version_str,
                                    "last-modified": last_mod,
                                    "title": title,
                                    "remarks": "Temporarily saved (Draft)",
                                    "is_draft": True,
                                    "filename": os.path.basename(draft_path)
                                })
            except Exception:
                await _evict_file_lock(draft_path)
                logger.warning("Failed to read draft version file %s", draft_path, exc_info=True)

    pattern = os.path.join(stage_dir, f"{doc_id}{VERSION_SEPARATOR}*.json")
    for filepath in glob.glob(pattern):
        if not is_safe_subdir(stage_dir, filepath):
            continue
        try:
            if not await aiofiles.os.path.exists(filepath):
                await _evict_file_lock(filepath)
                continue
            lock = await get_file_lock(filepath)
            async with lock:
                if not await aiofiles.os.path.exists(filepath):
                    await _evict_file_lock(filepath)
                    continue
                async with aiofiles.open(filepath, "r", encoding="utf-8") as f:
                    doc = json.loads(await f.read())
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
            await _evict_file_lock(filepath)
            logger.warning("Failed to read version file %s", filepath, exc_info=True)
            continue

    active_path = os.path.join(stage_dir, f"{doc_id}.json")
    if await aiofiles.os.path.exists(active_path):
        try:
            if not await aiofiles.os.path.exists(active_path):
                await _evict_file_lock(active_path)
            else:
                lock = await get_file_lock(active_path)
                async with lock:
                    if not await aiofiles.os.path.exists(active_path):
                        await _evict_file_lock(active_path)
                    else:
                        async with aiofiles.open(active_path, "r", encoding="utf-8") as f:
                            doc = json.loads(await f.read())
                            root_key = STAGE_ROOT_KEYS[stage]
                            metadata = doc.get(root_key, {}).get("metadata", {})
                            active_version = metadata.get("version", "")
                            matched = False
                            for v in versions:
                                if v.get("version") == active_version:
                                    v["is_active"] = True
                                    matched = True
                            if not matched and active_version:
                                versions.append({
                                    "version": active_version,
                                    "last-modified": metadata.get("last-modified", ""),
                                    "title": metadata.get("title", ""),
                                    "remarks": "Active version",
                                    "is_active": True,
                                    "filename": f"{doc_id}.json"
                                })
        except Exception:
            await _evict_file_lock(active_path)
            logger.warning("Failed to read active document %s", active_path, exc_info=True)

    versions.sort(key=lambda x: x["last-modified"], reverse=True)
    return versions


@validate_doc_id
async def get_document_version(stage: str, doc_id: str, version: str, workspace_id: Optional[str] = None) -> Dict[str, Any]:
    """Retrieves a specific version JSON of a document from disk."""
    if ".." in version:
        raise ValueError("Directory traversal attempt detected via version name.")

    stage_dir = await get_stage_dir(stage, workspace_id)

    if version.endswith(DRAFT_SUFFIX) or "draft" in version.lower():
        file_path = os.path.abspath(os.path.join(stage_dir, f"{doc_id}{DRAFT_SUFFIX}.json"))
    else:
        safe_version = re.sub(r'[^a-zA-Z0-9.-]', '_', version)
        file_path = os.path.abspath(os.path.join(stage_dir, f"{doc_id}{VERSION_SEPARATOR}{safe_version}.json"))

    if not is_safe_subdir(stage_dir, file_path):
        raise ValueError("Directory traversal attempt detected via version name.")

    if not await aiofiles.os.path.exists(file_path):
        active_path = os.path.abspath(os.path.join(stage_dir, f"{doc_id}.json"))
        if await aiofiles.os.path.exists(active_path):
            try:
                if not await aiofiles.os.path.exists(active_path):
                    await _evict_file_lock(active_path)
                else:
                    lock = await get_file_lock(active_path)
                    async with lock:
                        if not await aiofiles.os.path.exists(active_path):
                            await _evict_file_lock(active_path)
                        else:
                            async with aiofiles.open(active_path, "r", encoding="utf-8") as f:
                                doc = json.loads(await f.read())
                                root_key = STAGE_ROOT_KEYS[stage]
                                if doc.get(root_key, {}).get("metadata", {}).get("version") == version:
                                    return doc
            except Exception:
                await _evict_file_lock(active_path)
        await _evict_file_lock(file_path)
        raise FileNotFoundError(f"Version {version} of document {doc_id} not found.")

    lock = await get_file_lock(file_path)
    try:
        async with lock:
            if not await aiofiles.os.path.exists(file_path):
                await _evict_file_lock(file_path)
                raise FileNotFoundError(f"Version {version} of document {doc_id} not found.")
            async with aiofiles.open(file_path, "r", encoding="utf-8") as f:
                return json.loads(await f.read())
    except Exception:
        await _evict_file_lock(file_path)
        raise


@validate_doc_id
async def save_document_version(stage: str, doc_id: str, version: str, document: Dict[str, Any], is_draft: bool = False, workspace_id: Optional[str] = None) -> None:
    """Saves a document version atomically, and updates active file if not draft."""
    if ".." in version:
        raise ValueError("Directory traversal attempt detected.")

    stage_dir = await get_stage_dir(stage, workspace_id)

    if is_draft:
        version_file_path = os.path.abspath(os.path.join(stage_dir, f"{doc_id}{DRAFT_SUFFIX}.json"))
    else:
        safe_version = re.sub(r'[^a-zA-Z0-9.-]', '_', version)
        version_file_path = os.path.abspath(os.path.join(stage_dir, f"{doc_id}{VERSION_SEPARATOR}{safe_version}.json"))
        active_file_path = os.path.abspath(os.path.join(stage_dir, f"{doc_id}.json"))

    if not is_safe_subdir(stage_dir, version_file_path):
        raise ValueError("Directory traversal attempt detected.")

    await atomic_write_json(version_file_path, document)

    if not is_draft:
        if await aiofiles.os.path.exists(active_file_path):
            try:
                lock = await get_file_lock(active_file_path)
                async with lock:
                    async with aiofiles.open(active_file_path, "r", encoding="utf-8") as f:
                        existing_doc = json.loads(await f.read())
                        root_key = STAGE_ROOT_KEYS.get(stage, stage[:-1] if stage.endswith('s') else stage)
                        old_ver = existing_doc.get(root_key, {}).get("metadata", {}).get("version")
                        if old_ver and old_ver != version:
                            safe_old_ver = re.sub(r'[^a-zA-Z0-9.-]', '_', old_ver)
                            old_ver_path = os.path.abspath(os.path.join(stage_dir, f"{doc_id}{VERSION_SEPARATOR}{safe_old_ver}.json"))
                            if not await aiofiles.os.path.exists(old_ver_path):
                                await atomic_write_json(old_ver_path, existing_doc)
            except Exception:
                pass

        if not is_safe_subdir(stage_dir, active_file_path):
            raise ValueError("Directory traversal attempt detected.")
        await atomic_write_json(active_file_path, document)

        draft_path = os.path.join(stage_dir, f"{doc_id}{DRAFT_SUFFIX}.json")
        if await aiofiles.os.path.exists(draft_path):
            try:
                await safe_file_delete(draft_path)
            except Exception:
                logger.warning("Failed to delete draft file %s", draft_path, exc_info=True)


@validate_doc_id
async def delete_document_version(stage: str, doc_id: str, version: str, workspace_id: Optional[str] = None) -> None:
    """Deletes a specific saved version of a document."""
    if ".." in version:
        raise ValueError("Directory traversal attempt detected.")

    stage_dir = await get_stage_dir(stage, workspace_id)
    if version.endswith(DRAFT_SUFFIX) or "draft" in version.lower():
        file_path = os.path.abspath(os.path.join(stage_dir, f"{doc_id}{DRAFT_SUFFIX}.json"))
    else:
        safe_version = re.sub(r'[^a-zA-Z0-9.-]', '_', version)
        file_path = os.path.abspath(os.path.join(stage_dir, f"{doc_id}{VERSION_SEPARATOR}{safe_version}.json"))

    if not is_safe_subdir(stage_dir, file_path):
        raise ValueError("Directory traversal attempt detected.")

    if not await aiofiles.os.path.exists(file_path):
        await _evict_file_lock(file_path)
        raise FileNotFoundError(f"Version {version} of document {doc_id} not found.")

    await safe_file_delete(file_path)
