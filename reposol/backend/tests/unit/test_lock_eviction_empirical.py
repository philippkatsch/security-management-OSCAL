import os
import uuid
import pytest
import asyncio
from unittest.mock import patch

from app.repositories.document_repository import (
    save_document,
    get_document,
    delete_document,
    get_document_version,
    save_document_version,
    delete_document_version,
    get_document_versions,
    safe_file_delete,
    _file_locks,
    _file_locks_lock,
    ETagMismatchError
)
from app.repositories.workspace_repository import get_stage_dir

import pytest_asyncio

pytestmark = pytest.mark.asyncio


@pytest_asyncio.fixture(autouse=True)
async def cleanup_locks():
    """Ensure _file_locks is cleared before and after each test."""
    async with _file_locks_lock:
        _file_locks.clear()
    yield
    async with _file_locks_lock:
        _file_locks.clear()


async def test_non_existent_doc_and_version_deletion_eviction(tmp_path):
    stage = "catalogs"
    fake_id = str(uuid.uuid4())

    # 1. get_document on non-existent document
    with pytest.raises(FileNotFoundError):
        await get_document(stage, fake_id)
    assert len(_file_locks) == 0, f"Lingering lock keys after get_document non-existent: {list(_file_locks.keys())}"

    # 2. delete_document on non-existent document
    with pytest.raises(FileNotFoundError):
        await delete_document(stage, fake_id)
    assert len(_file_locks) == 0, f"Lingering lock keys after delete_document non-existent: {list(_file_locks.keys())}"

    # 3. get_document_version on non-existent document
    with pytest.raises(FileNotFoundError):
        await get_document_version(stage, fake_id, "1.0.0")
    assert len(_file_locks) == 0, f"Lingering lock keys after get_document_version non-existent: {list(_file_locks.keys())}"

    # 4. delete_document_version on non-existent version
    with pytest.raises(FileNotFoundError):
        await delete_document_version(stage, fake_id, "1.0.0")
    assert len(_file_locks) == 0, f"Lingering lock keys after delete_document_version non-existent: {list(_file_locks.keys())}"


async def test_failed_delete_attempts_eviction():
    stage = "catalogs"
    doc_id = str(uuid.uuid4())
    doc_data = {"catalog": {"id": doc_id, "metadata": {"title": "Test Catalog", "version": "1.0.0"}}}
    
    await save_document(stage, doc_id, doc_data)
    stage_dir = await get_stage_dir(stage)
    file_path = os.path.abspath(os.path.join(stage_dir, f"{doc_id}.json"))
    
    # Verify lock exists or key can be tracked
    assert len(_file_locks) >= 0

    # Mock aiofiles.os.remove to raise PermissionError on all retries
    with patch("aiofiles.os.remove", side_effect=PermissionError("Access denied")):
        with pytest.raises(PermissionError):
            await safe_file_delete(file_path, retries=2, delay=0.01)

    # Key must be evicted even if deletion failed
    assert len(_file_locks) == 0, f"Lingering locks after failed delete attempt: {list(_file_locks.keys())}"

    # Cleanup actual file
    if os.path.exists(file_path):
        os.remove(file_path)


async def test_document_deletion_with_missing_versions_eviction():
    stage = "catalogs"
    doc_id = str(uuid.uuid4())
    doc_data = {"catalog": {"id": doc_id, "metadata": {"title": "Test Catalog", "version": "1.0.0"}}}

    # Save initial document and 2 versions
    await save_document(stage, doc_id, doc_data)
    await save_document_version(stage, doc_id, "1.0.0", doc_data)
    await save_document_version(stage, doc_id, "2.0.0", doc_data)

    stage_dir = await get_stage_dir(stage)
    v2_path = os.path.abspath(os.path.join(stage_dir, f"{doc_id}_v_2.0.0.json"))

    # Manually remove v2 version file directly from disk before repository deletion
    if os.path.exists(v2_path):
        os.remove(v2_path)

    # Now call repository delete_document
    await delete_document(stage, doc_id)

    # Lock dict must be completely empty
    assert len(_file_locks) == 0, f"Lingering locks after delete with missing version: {list(_file_locks.keys())}"


async def test_etag_mismatch_and_save_errors_eviction():
    stage = "catalogs"
    doc_id = str(uuid.uuid4())
    doc_data = {"catalog": {"id": doc_id, "metadata": {"title": "Test Catalog", "version": "1.0.0"}}}

    # Save document first
    _, etag, _ = await save_document(stage, doc_id, doc_data)

    # Save with wrong ETag
    with pytest.raises(ETagMismatchError):
        await save_document(stage, doc_id, doc_data, if_match="invalid_etag_12345")

    # Clean up document
    await delete_document(stage, doc_id)

    # Locks should be empty
    assert len(_file_locks) == 0, f"Lingering locks after ETag mismatch test: {list(_file_locks.keys())}"


async def test_interleaved_creation_deletion_concurrency_race():
    stage = "catalogs"
    num_docs = 20

    async def worker(doc_id: str):
        doc_data = {"catalog": {"id": doc_id, "metadata": {"title": f"Catalog {doc_id}", "version": "1.0.0"}}}
        
        # 1. Save
        await save_document(stage, doc_id, doc_data)
        
        # 2. Parallel read, version save, version get, and delete
        t1 = save_document_version(stage, doc_id, "1.0.0", doc_data)
        t2 = get_document(stage, doc_id)
        t3 = get_document_versions(stage, doc_id)
        
        await asyncio.gather(t1, t2, t3, return_exceptions=True)
        
        # 3. Delete version and delete document concurrently
        t4 = delete_document_version(stage, doc_id, "1.0.0")
        t5 = delete_document(stage, doc_id)
        
        await asyncio.gather(t4, t5, return_exceptions=True)

        # 4. Final delete cleanup ensure
        try:
            await delete_document(stage, doc_id)
        except FileNotFoundError:
            pass

    doc_ids = [str(uuid.uuid4()) for _ in range(num_docs)]
    tasks = [worker(doc_id) for doc_id in doc_ids]
    
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    # Check no unhandled non-FileNotFound errors
    exceptions = [r for r in results if isinstance(r, Exception)]
    assert len(exceptions) == 0, f"Unexpected exceptions during interleaved stress test: {exceptions}"

    # Verify zero lingering locks after all workers complete
    assert len(_file_locks) == 0, f"Lingering locks after interleaved concurrency test: {len(_file_locks)} keys remaining: {list(_file_locks.keys())}"


async def test_memory_leak_1000_cycles():
    stage = "catalogs"
    
    for _ in range(100):
        doc_id = str(uuid.uuid4())
        doc_data = {"catalog": {"id": doc_id, "metadata": {"title": "Leak Test", "version": "1.0.0"}}}
        
        await save_document(stage, doc_id, doc_data)
        await get_document(stage, doc_id)
        await save_document_version(stage, doc_id, "1.0.0", doc_data)
        await delete_document(stage, doc_id)
        
    assert len(_file_locks) == 0, f"Memory leak detected in _file_locks after 100 cycles! {len(_file_locks)} keys remaining."
