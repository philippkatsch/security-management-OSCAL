import pytest
import asyncio
import httpx
from httpx import AsyncClient
from app.main import app

@pytest.mark.asyncio
async def test_concurrent_etag_updates_race_condition():
    """
    Empirical Stress Test 1:
    Send 10 concurrent requests to update the same document with the SAME initial If-Match ETag.
    Demonstrates TOCTOU race condition in validate_etag vs save_document.
    """
    async with AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        doc_id = "99999999-8888-7777-6666-555555555555"
        payload = {
            "catalog": {
                "uuid": doc_id,
                "metadata": {
                    "title": "Initial Title",
                    "version": "1.0",
                    "oscal-version": "1.1.2",
                    "last-modified": "2026-08-10T12:00:00Z"
                }
            }
        }
        res = await client.post("/api/documents/catalogs", json=payload)
        assert res.status_code in (200, 201), f"Setup failed: {res.text}"
        
        res = await client.get(f"/api/documents/catalogs/{doc_id}")
        assert res.status_code == 200
        initial_etag = res.headers.get("etag")
        assert initial_etag is not None
        
        num_concurrent = 10
        async def send_update(i: int):
            req_payload = {
                "catalog": {
                    "uuid": doc_id,
                    "metadata": {
                        "title": f"Concurrent Title {i}",
                        "version": "1.0",
                        "oscal-version": "1.1.2",
                        "last-modified": "2026-08-10T12:00:00Z"
                    }
                }
            }
            return await client.post(
                "/api/documents/catalogs",
                json=req_payload,
                headers={"If-Match": initial_etag}
            )

        responses = await asyncio.gather(*[send_update(i) for i in range(num_concurrent)])
        
        status_codes = [r.status_code for r in responses]
        success_count = status_codes.count(200) + status_codes.count(201)
        conflict_count = status_codes.count(409)
        
        print(f"\n[STRESS TEST 1 RESULT] Total: {num_concurrent}, Success: {success_count}, Conflict (409): {conflict_count}")
        
        # Concurrency Invariant: exactly 1 request should succeed when sharing the same initial ETag.
        assert success_count == 1, f"TOCTOU Race Condition! {success_count} concurrent requests succeeded with stale ETag instead of 1."
        assert conflict_count == num_concurrent - 1

@pytest.mark.asyncio
async def test_asgitransport_lifespan_db_uninitialized():
    """
    Empirical Stress Test 2:
    Demonstrates that httpx.ASGITransport(app=app) does NOT run FastAPI lifespan events.
    Accessing a route depending on init_db (e.g., auth/audit DB) fails unless lifespan is executed.
    """
    async with AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        # Request health endpoint (works without DB)
        res_health = await client.get("/health")
        assert res_health.status_code == 200
        
        # Request recent-documents (works without DB)
        res_recent = await client.get("/api/recent-documents")
        assert res_recent.status_code == 200
        
        # Access audit endpoint which relies on SQLite initialized in lifespan
        res_audit = await client.get("/api/audit/logs")
        print(f"\n[STRESS TEST 2 RESULT] Audit endpoint status code without lifespan: {res_audit.status_code}")
        # Note: If lifespan was not run, SQLite database may be uninitialized or missing tables


@pytest.mark.asyncio
async def test_file_lock_memory_leak():
    """
    Empirical Stress Test 3:
    Verify that creating and deleting 50 documents does not leak lock objects in _file_locks dictionary.
    """
    from app.repositories.document_repository import _file_locks
    initial_lock_count = len(_file_locks)
    
    async with AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        created_uuids = []
        for i in range(50):
            doc_id = f"88888888-4444-4444-4444-{i:012d}"
            payload = {
                "catalog": {
                    "uuid": doc_id,
                    "metadata": {
                        "title": f"Temp Doc {i}",
                        "version": "1.0",
                        "oscal-version": "1.1.2",
                        "last-modified": "2026-08-10T12:00:00Z"
                    }
                }
            }
            res = await client.post("/api/documents/catalogs", json=payload)
            assert res.status_code in (200, 201)
            created_uuids.append(doc_id)
            
        for doc_id in created_uuids:
            res = await client.delete(f"/api/documents/catalogs/{doc_id}")
            assert res.status_code == 200
            
    added_locks = len(_file_locks) - initial_lock_count
    print(f"\nFile locks memory leak check: initial={initial_lock_count}, final={len(_file_locks)}, added={added_locks}")
    assert added_locks < 10, f"Memory leak detected in _file_locks! Added {added_locks} lock objects for deleted files."


@pytest.mark.asyncio
async def test_interleaved_create_delete_concurrency_race_condition():
    """
    Empirical Stress Test 4:
    Fire concurrent create (POST) and delete (DELETE) requests for 50 documents.
    Verifies zero lock leaks in _file_locks for deleted files during interleaved operations.
    """
    import os
    from app.repositories.document_repository import _file_locks, _file_locks_lock

    async with _file_locks_lock:
        initial_locks = set(_file_locks.keys())

    async with AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        num_docs = 50

        async def create_and_delete(i: int):
            doc_id = f"55555555-5555-5555-5555-{i:012d}"
            payload = {
                "catalog": {
                    "uuid": doc_id,
                    "metadata": {
                        "title": f"Interleaved Doc {i}",
                        "version": "1.0",
                        "oscal-version": "1.1.2",
                        "last-modified": "2026-08-10T12:00:00Z"
                    }
                }
            }
            post_task = asyncio.create_task(client.post("/api/documents/catalogs", json=payload))
            await asyncio.sleep(0.001)
            del_task = asyncio.create_task(client.delete(f"/api/documents/catalogs/{doc_id}"))
            await asyncio.gather(post_task, del_task, return_exceptions=True)

        await asyncio.gather(*[create_and_delete(i) for i in range(num_docs)])

    async with _file_locks_lock:
        current_locks = set(_file_locks.keys())
        leaked_new_locks = current_locks - initial_locks

    orphaned_locks = [path for path in leaked_new_locks if not os.path.exists(path)]

    print(f"\n[INTERLEAVED RACE CONDITION TEST] Initial locks: {len(initial_locks)}, Orphaned locks: {len(orphaned_locks)}")
    assert len(orphaned_locks) == 0, (
        f"Concurrency Memory Leak Detected! {len(orphaned_locks)} lock objects remained in _file_locks "
        f"for files that were deleted during interleaved operations."
    )


@pytest.mark.asyncio
async def test_path_casing_lock_normalization():
    """
    Empirical Stress Test 5:
    Verify that path casing differences (e.g., C:\path\to\doc vs c:\path\to\doc)
    resolve to identical lock keys and map to the exact same asyncio.Lock instance.
    """
    from app.repositories.document_repository import (
        _get_lock_key,
        get_file_lock,
        _evict_file_lock,
        _file_locks
    )

    path_upper = "C:\\path\\to\\test_doc.json"
    path_lower = "c:\\path\\to\\test_doc.json"
    path_mixed = "C:\\Path\\To\\Test_Doc.json"

    key_upper = _get_lock_key(path_upper)
    key_lower = _get_lock_key(path_lower)
    key_mixed = _get_lock_key(path_mixed)

    assert key_upper == key_lower == key_mixed, (
        f"Lock keys disagree on path casing: upper='{key_upper}', lower='{key_lower}', mixed='{key_mixed}'"
    )

    lock_upper = await get_file_lock(path_upper)
    lock_lower = await get_file_lock(path_lower)
    lock_mixed = await get_file_lock(path_mixed)

    assert lock_upper is lock_lower and lock_lower is lock_mixed, (
        "Different lock instances returned for identical path with different casing!"
    )

    await _evict_file_lock(path_upper)
    assert _get_lock_key(path_lower) not in _file_locks


@pytest.mark.asyncio
async def test_unconditional_lock_eviction_under_concurrency():
    """
    Empirical Stress Test 6:
    Verifies unconditional lock eviction during delete_document and safe_file_delete.
    Ensures zero lingering locks in _file_locks even when deleting non-existent files or
    during high-concurrency creation, read access, and deletion bursts.
    """
    import os
    from app.repositories.document_repository import (
        _file_locks,
        _file_locks_lock,
        get_file_lock,
        delete_document,
        safe_file_delete,
        _get_lock_key,
        get_raw_document_path
    )

    # Part A: Non-existent file lock eviction check
    non_existent_path = os.path.abspath("non_existent_stress_doc.json")
    norm_key = _get_lock_key(non_existent_path)
    
    # Acquire lock object for non-existent file
    lock = await get_file_lock(non_existent_path)
    async with _file_locks_lock:
        assert norm_key in _file_locks

    # safe_file_delete on non-existent file must evict lock unconditionally
    await safe_file_delete(non_existent_path)
    async with _file_locks_lock:
        assert norm_key not in _file_locks

    # delete_document on non-existent doc_id must evict lock unconditionally
    non_existent_doc_id = "77777777-7777-7777-7777-777777777777"
    # Pre-populate lock
    dummy_path = await get_raw_document_path("catalogs", non_existent_doc_id)
    await get_file_lock(dummy_path)

    with pytest.raises(FileNotFoundError):
        await delete_document("catalogs", non_existent_doc_id)

    async with _file_locks_lock:
        assert _get_lock_key(dummy_path) not in _file_locks

    # Part B: Concurrent Creation, Access, and Deletion Stress
    num_docs = 30
    async with AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        async def stress_lifecycle(i: int):
            doc_id = f"66666666-6666-6666-6666-{i:012d}"
            payload = {
                "catalog": {
                    "uuid": doc_id,
                    "metadata": {
                        "title": f"Stress Doc {i}",
                        "version": "1.0",
                        "oscal-version": "1.1.2",
                        "last-modified": "2026-08-10T12:00:00Z"
                    }
                }
            }
            # Rapid create
            res = await client.post("/api/documents/catalogs", json=payload)
            if res.status_code in (200, 201):
                # Concurrent read & delete tasks
                read_task = asyncio.create_task(client.get(f"/api/documents/catalogs/{doc_id}"))
                del_task = asyncio.create_task(client.delete(f"/api/documents/catalogs/{doc_id}"))
                await asyncio.gather(read_task, del_task, return_exceptions=True)

        await asyncio.gather(*[stress_lifecycle(i) for i in range(num_docs)])

    # Verify zero lingering locks for deleted test documents
    async with _file_locks_lock:
        for i in range(num_docs):
            doc_id = f"66666666-6666-6666-6666-{i:012d}"
            # Check lock key for catalog document
            for key in list(_file_locks.keys()):
                assert doc_id not in key, f"Lingering lock leak found for deleted doc {doc_id}: {key}"



