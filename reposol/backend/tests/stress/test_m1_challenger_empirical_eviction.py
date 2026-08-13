import pytest
import os
import asyncio
import tempfile
import uuid
import random
from app.repositories.document_repository import (
    _file_locks,
    _file_locks_lock,
    _get_lock_key,
    get_file_lock,
    _evict_file_lock,
    safe_file_delete,
    save_document,
    get_document,
    delete_document,
    get_document_versions,
    get_document_version,
    save_document_version,
    delete_document_version,
    atomic_write_json,
    document_exists,
)
from app.repositories.workspace_repository import get_stage_dir

@pytest.mark.asyncio
async def test_empirical_non_existent_file_deletion_eviction():
    """
    Verify that calling safe_file_delete and delete_document on non-existent files
    properly cleans up any requested locks and leaves zero lock leaks in _file_locks.
    """
    fake_path = os.path.abspath("non_existent_test_file_12345.json")
    
    # 1. Acquire lock for non-existent file
    lock = await get_file_lock(fake_path)
    async with lock:
        pass
    
    key = _get_lock_key(fake_path)
    async with _file_locks_lock:
        assert key in _file_locks, "Lock for non-existent file should be created upon get_file_lock"
    
    # 2. Call safe_file_delete on non-existent file
    deleted = await safe_file_delete(fake_path)
    assert deleted is True, "safe_file_delete on non-existent file should return True without throwing error"
    
    async with _file_locks_lock:
        assert key not in _file_locks, "safe_file_delete must evict lock key from _file_locks for non-existent file"

    # 3. Call delete_document for non-existent doc_id
    doc_id = str(uuid.uuid4())
    stage_dir = await get_stage_dir("catalogs")
    doc_path = os.path.abspath(os.path.join(stage_dir, f"{doc_id}.json"))
    await get_file_lock(doc_path) # ensure lock table hit
    try:
        await delete_document("catalogs", doc_id)
    except FileNotFoundError:
        pass
    
    doc_key = _get_lock_key(doc_path)
    
    async with _file_locks_lock:
        assert doc_key not in _file_locks, "delete_document must evict lock key when FileNotFoundError is raised"


@pytest.mark.asyncio
async def test_empirical_missing_document_version_eviction():
    """
    Verify missing document version eviction: get_document_version and delete_document_version
    on non-existent version files evicts locks from _file_locks.
    """
    doc_id = str(uuid.uuid4())
    fake_version = "v9.9.9"
    stage_dir = await get_stage_dir("catalogs")
    version_path = os.path.abspath(os.path.join(stage_dir, f"{doc_id}__v9_9_9.json"))
    version_key = _get_lock_key(version_path)

    # 1. Attempt get_document_version for missing version
    try:
        await get_document_version("catalogs", doc_id, fake_version)
    except FileNotFoundError:
        pass

    async with _file_locks_lock:
        assert version_key not in _file_locks, "get_document_version must evict lock key for non-existent version"

    # 2. Attempt delete_document_version for missing version
    try:
        await delete_document_version("catalogs", doc_id, fake_version)
    except FileNotFoundError:
        pass

    async with _file_locks_lock:
        assert version_key not in _file_locks, "delete_document_version must evict lock key for non-existent version"


@pytest.mark.asyncio
async def test_empirical_concurrency_lock_eviction_under_high_load():
    """
    Stress test concurrency lock eviction:
    100 concurrent tasks creating, versioning, reading, and deleting 10 documents simultaneously.
    Validates zero lock leaks, zero race condition crashes, and clean eviction of all file lock keys.
    """
    async with _file_locks_lock:
        initial_keys = set(_file_locks.keys())

    doc_ids = [str(uuid.uuid4()) for _ in range(10)]

    async def document_lifecycle_worker(doc_id: str, worker_id: int):
        doc_data = {
            "catalog": {
                "uuid": doc_id,
                "metadata": {
                    "title": f"Concurrent Doc {doc_id} Worker {worker_id}",
                    "version": "1.0",
                    "oscal-version": "1.1.2",
                    "last-modified": "2026-08-10T12:00:00Z"
                }
            }
        }
        # Save document
        await save_document("catalogs", doc_id, doc_data)
        
        # Save version
        v_data = dict(doc_data)
        v_data["catalog"]["metadata"]["version"] = f"1.{worker_id}"
        await save_document_version("catalogs", doc_id, f"1.{worker_id}", v_data)
        
        # Read versions
        versions = await get_document_versions("catalogs", doc_id)
        assert isinstance(versions, list)

        # Read active document
        try:
            doc, etag = await get_document("catalogs", doc_id)
            assert doc["catalog"]["uuid"] == doc_id
        except FileNotFoundError:
            pass

        # Random delete version or document
        if worker_id % 2 == 0:
            try:
                await delete_document_version("catalogs", doc_id, f"1.{worker_id}")
            except FileNotFoundError:
                pass
        
        if worker_id == 9:
            try:
                await delete_document("catalogs", doc_id)
            except FileNotFoundError:
                pass

    tasks = []
    for doc_id in doc_ids:
        for w in range(10):
            tasks.append(document_lifecycle_worker(doc_id, w))

    # Run 100 concurrent operations
    await asyncio.gather(*tasks, return_exceptions=False)

    # Clean up any remaining documents
    for doc_id in doc_ids:
        try:
            await delete_document("catalogs", doc_id)
        except FileNotFoundError:
            pass

    async with _file_locks_lock:
        final_keys = set(_file_locks.keys())
        leaked_keys = final_keys - initial_keys

    orphaned = [k for k in leaked_keys if not os.path.exists(k)]
    print(f"\n[STRESS EVICTION RESULT] Initial locks: {len(initial_keys)}, Final orphaned locks: {len(orphaned)}")
    assert len(orphaned) == 0, f"Lock eviction failed under concurrency! {len(orphaned)} orphaned locks remained in _file_locks."
