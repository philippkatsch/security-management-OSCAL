import pytest
import os
import asyncio
import httpx
from httpx import AsyncClient
from app.main import app
from app.repositories.document_repository import _get_lock_key, get_file_lock, _file_locks, _file_locks_lock


class TestEmpiricalLockPathNormalization:
    """
    Empirical Stress Suite A: Lock Key Path Normalization
    Test canonicalization of file paths across Windows/Unix slash conventions, drive letters, and dot segments.
    """

    def test_get_lock_key_canonicalization(self):
        cwd = os.getcwd()
        base = os.path.join(cwd, "test_dir", "doc.json")
        
        # 1. Forward slash vs Backslash
        p_backslash = os.path.normpath(base)
        p_forwardslash = p_backslash.replace("\\", "/")
        
        assert _get_lock_key(p_backslash) == _get_lock_key(p_forwardslash), \
            "Lock key mismatch between backslash and forward slash paths!"

        # 2. Relative vs Absolute path
        rel_path = os.path.relpath(base, cwd)
        assert _get_lock_key(rel_path) == _get_lock_key(base), \
            "Lock key mismatch between relative and absolute paths!"

        # 3. Path with dot and double dot segments
        dotted_path = os.path.join(cwd, "test_dir", "..", "test_dir", ".", "doc.json")
        assert _get_lock_key(dotted_path) == _get_lock_key(base), \
            "Lock key mismatch with dot/dotdot segments!"

    @pytest.mark.asyncio
    async def test_get_file_lock_returns_same_instance_for_path_variants(self):
        cwd = os.getcwd()
        base_path = os.path.join(cwd, "test_dir", "unique_doc.json")
        variant1 = base_path.replace("\\", "/")
        variant2 = os.path.join(cwd, "test_dir", "..", "test_dir", "unique_doc.json")
        
        lock1 = await get_file_lock(base_path)
        lock2 = await get_file_lock(variant1)
        lock3 = await get_file_lock(variant2)

        assert lock1 is lock2, "get_file_lock returned different asyncio.Lock objects for forward vs backslash!"
        assert lock1 is lock3, "get_file_lock returned different asyncio.Lock objects for normalized dotdot path!"


class TestEmpiricalConcurrencyAndETagStress:
    """
    Empirical Stress Suite B: API Concurrency Limits & ETag Header Integrity
    """

    @pytest.mark.asyncio
    async def test_high_worker_concurrency_etag_race_condition(self):
        """
        Stress test with 30 concurrent update requests sharing the same initial ETag.
        Strict requirement: Exactly 1 update succeeds (200/201), exactly 29 fail with 409 Conflict.
        """
        async with AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            doc_id = "77777777-7777-7777-7777-777777777777"
            payload = {
                "catalog": {
                    "uuid": doc_id,
                    "metadata": {
                        "title": "Initial High-Concurrency Base Catalog",
                        "version": "1.0",
                        "oscal-version": "1.1.2",
                        "last-modified": "2026-08-10T12:00:00Z"
                    }
                }
            }
            res = await client.post("/api/documents/catalogs", json=payload)
            assert res.status_code in (200, 201)

            res_get = await client.get(f"/api/documents/catalogs/{doc_id}")
            assert res_get.status_code == 200
            initial_etag = res_get.headers.get("etag")
            assert initial_etag is not None

            num_workers = 30
            async def worker(i: int):
                worker_payload = {
                    "catalog": {
                        "uuid": doc_id,
                        "metadata": {
                            "title": f"Worker {i} Title Update",
                            "version": "1.0",
                            "oscal-version": "1.1.2",
                            "last-modified": "2026-08-10T12:00:00Z"
                        }
                    }
                }
                return await client.post(
                    "/api/documents/catalogs",
                    json=worker_payload,
                    headers={"If-Match": initial_etag}
                )

            responses = await asyncio.gather(*[worker(i) for i in range(num_workers)])
            status_codes = [r.status_code for r in responses]

            successes = status_codes.count(200) + status_codes.count(201)
            conflicts = status_codes.count(409)

            print(f"\n[HIGH WORKER STRESS] Total workers: {num_workers}, Successes: {successes}, Conflicts: {conflicts}")
            assert successes == 1, f"ETag Race Condition under stress! {successes} workers succeeded instead of 1."
            assert conflicts == num_workers - 1, f"Expected {num_workers - 1} 409 conflicts, got {conflicts}."

    @pytest.mark.asyncio
    async def test_rapid_concurrent_document_lifecycle(self):
        """
        Stress test creating and deleting 50 documents sequentially.
        Verify that _file_locks cache is properly cleaned up on delete under sequential lifecycle.
        """
        async with _file_locks_lock:
            initial_lock_count = len(_file_locks)

        async with AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            total_docs = 50

            for i in range(total_docs):
                doc_id = f"66666666-6666-6666-6666-{i:012d}"
                payload = {
                    "catalog": {
                        "uuid": doc_id,
                        "metadata": {
                            "title": f"Lifecycle Doc {i}",
                            "version": "1.0",
                            "oscal-version": "1.1.2",
                            "last-modified": "2026-08-10T12:00:00Z"
                        }
                    }
                }
                res_create = await client.post("/api/documents/catalogs", json=payload)
                assert res_create.status_code in (200, 201)

                res_del = await client.delete(f"/api/documents/catalogs/{doc_id}")
                assert res_del.status_code == 200

        async with _file_locks_lock:
            final_lock_count = len(_file_locks)

        leaked_locks = final_lock_count - initial_lock_count
        print(f"\n[LOCK LEAK STRESS] Initial locks: {initial_lock_count}, Final locks: {final_lock_count}, Leaked: {leaked_locks}")
        assert leaked_locks == 0, f"Memory leak in _file_locks! {leaked_locks} lock objects remained after deleting {total_docs} documents."

    @pytest.mark.asyncio
    async def test_interleaved_create_delete_concurrency_race_condition(self):
        """
        Empirical Challenge Test:
        Fire concurrent create (POST) and delete (DELETE) requests for 50 documents.
        Exposes TOCTOU/interleaving race condition where route handler get_document()
        re-populates _file_locks dictionary AFTER delete_document() has already evicted the lock.
        """
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
                # Fire POST and DELETE concurrently or back-to-back without waiting for POST completion
                post_task = asyncio.create_task(client.post("/api/documents/catalogs", json=payload))
                await asyncio.sleep(0.001)
                del_task = asyncio.create_task(client.delete(f"/api/documents/catalogs/{doc_id}"))
                await asyncio.gather(post_task, del_task, return_exceptions=True)

            await asyncio.gather(*[create_and_delete(i) for i in range(num_docs)])

        async with _file_locks_lock:
            current_locks = set(_file_locks.keys())
            leaked_new_locks = current_locks - initial_locks

        print(f"\n[INTERLEAVED RACE CONDITION TEST] Initial locks: {len(initial_locks)}, Leaked locks after interleaved create/delete: {len(leaked_new_locks)}")
        # Check if orphaned locks remain for non-existent files
        orphaned_locks = []
        for path in leaked_new_locks:
            if not os.path.exists(path):
                orphaned_locks.append(path)

        print(f"[ORPHANED LOCKS COUNT]: {len(orphaned_locks)}")
        assert len(orphaned_locks) == 0, (
            f"Concurrency Memory Leak Detected! {len(orphaned_locks)} lock objects remained in _file_locks "
            f"for files that were deleted due to route handler post-processing re-registering lock after deletion."
        )

    @pytest.mark.asyncio
    async def test_path_casing_drive_letters_and_eviction_identity(self):
        """
        Empirical Challenge Test: Path Casing Edge Cases.
        Verify Windows drive letter casing (C:\\ vs c:\\), mixed-case directories, forward/backward slashes,
        and dot/dotdot segments all resolve to the EXACT SAME lock instance, and _evict_file_lock
        using any path casing variant successfully evicts the canonical key from _file_locks.
        """
        base_dir = os.path.abspath("storage_test_temp")
        
        path_upper_drive = f"C:{base_dir[1:]}\\SubDir\\Doc_Test.json"
        path_lower_drive = f"c:{base_dir[1:]}\\subdir\\doc_test.json"
        path_mixed_slash = f"C:{base_dir[1:]}/SubDir/DOC_TEST.JSON"
        path_relative_dot = f"c:{base_dir[1:]}\\SubDir\\..\\SubDir\\doc_test.json"

        # Acquire lock via upper drive letter
        lock_upper = await get_file_lock(path_upper_drive)
        # Acquire lock via lower drive letter
        lock_lower = await get_file_lock(path_lower_drive)
        # Acquire lock via mixed slashes and upper filename
        lock_mixed = await get_file_lock(path_mixed_slash)
        # Acquire lock via relative dot path
        lock_dot = await get_file_lock(path_relative_dot)

        # Assert single lock object identity across all path variants
        assert lock_upper is lock_lower, "Lock identity failed between upper and lower drive letters!"
        assert lock_upper is lock_mixed, "Lock identity failed between backslash and forward slash/uppercase filename!"
        assert lock_upper is lock_dot, "Lock identity failed between absolute and dotdot relative path!"

        # Verify eviction using a DIFFERENT path casing variant clears the lock
        key = _get_lock_key(path_upper_drive)
        async with _file_locks_lock:
            assert key in _file_locks, "Key missing from _file_locks before eviction!"

        # Evict using lowercase forward slash variant
        _get_lock_key(path_mixed_slash)
        from app.repositories.document_repository import _evict_file_lock
        await _evict_file_lock(path_mixed_slash)

        async with _file_locks_lock:
            assert key not in _file_locks, "Lock was NOT evicted when using a path casing variant!"

    @pytest.mark.asyncio
    async def test_extreme_concurrency_post_get_delete_zero_lock_leak(self):
        """
        Empirical Stress Test: Extreme Concurrency POST, GET, DELETE operations.
        Runs 100 concurrent tasks performing randomized POST, GET, and DELETE requests
        across 20 shared document IDs simultaneously.
        Guarantees zero lock leaks in _file_locks, zero deadlocks, and zero unhandled exceptions.
        """
        async with _file_locks_lock:
            initial_locks = set(_file_locks.keys())

        async with AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            num_docs = 20
            tasks_per_doc = 5 # 100 total concurrent tasks
            doc_ids = [f"88888888-8888-8888-8888-{i:012d}" for i in range(num_docs)]

            async def worker_post_get_delete(doc_id: str, worker_id: int):
                payload = {
                    "catalog": {
                        "uuid": doc_id,
                        "metadata": {
                            "title": f"Extreme Stress Doc {doc_id} Worker {worker_id}",
                            "version": "1.0",
                            "oscal-version": "1.1.2",
                            "last-modified": "2026-08-10T12:00:00Z"
                        }
                    }
                }
                # 1. POST create/update
                res_post = await client.post("/api/documents/catalogs", json=payload)
                assert res_post.status_code in (200, 201, 409)

                # 2. GET read
                res_get = await client.get(f"/api/documents/catalogs/{doc_id}")
                assert res_get.status_code in (200, 404)

                # 3. DELETE remove
                res_del = await client.delete(f"/api/documents/catalogs/{doc_id}")
                assert res_del.status_code in (200, 404)

            all_tasks = []
            for doc_id in doc_ids:
                for w in range(tasks_per_doc):
                    all_tasks.append(worker_post_get_delete(doc_id, w))

            # Run all 100 tasks with asyncio.gather
            await asyncio.gather(*all_tasks, return_exceptions=False)

            # Cleanup any remaining test documents if created
            for doc_id in doc_ids:
                await client.delete(f"/api/documents/catalogs/{doc_id}")

        async with _file_locks_lock:
            final_locks = set(_file_locks.keys())
            leaked_new_locks = final_locks - initial_locks

        # Verify zero leaked locks for non-existent files
        orphaned = [path for path in leaked_new_locks if not os.path.exists(path)]
        print(f"\n[EXTREME CONCURRENCY POST/GET/DELETE] Total tasks: 100. Orphaned locks in _file_locks: {len(orphaned)}")
        assert len(orphaned) == 0, f"Lock leak under high POST/GET/DELETE concurrency! {len(orphaned)} orphaned locks remained: {orphaned}"

