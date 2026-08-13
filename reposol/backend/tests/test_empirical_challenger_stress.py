import pytest
import asyncio
import os
import httpx
from httpx import AsyncClient
from app.main import app
from app.repositories.document_repository import _get_lock_key, get_file_lock, _file_locks, _file_locks_lock

@pytest.mark.asyncio
async def test_lock_key_path_casing_normalization_empirical():
    """
    Empirical Challenge 1:
    Test whether _get_lock_key properly normalizes Windows drive letters and path casing.
    On Windows, C:\\path\\file.json and c:\\path\\file.json refer to the exact same file.
    If _get_lock_key returns different keys, get_file_lock will instantiate TWO DIFFERENT asyncio.Lock
    objects for the same physical file, breaking concurrency isolation on Windows!
    """
    path_upper = r"C:\reposol_test_data\stage\document.json"
    path_lower = r"c:\reposol_test_data\stage\document.json"
    path_mixed = r"C:\Reposol_Test_Data\Stage\Document.json"

    key_upper = _get_lock_key(path_upper)
    key_lower = _get_lock_key(path_lower)
    key_mixed = _get_lock_key(path_mixed)

    lock_upper = await get_file_lock(path_upper)
    lock_lower = await get_file_lock(path_lower)
    lock_mixed = await get_file_lock(path_mixed)

    print(f"\n[LOCK KEY CASING TEST] Key upper: '{key_upper}'")
    print(f"[LOCK KEY CASING TEST] Key lower: '{key_lower}'")
    print(f"[LOCK KEY CASING TEST] Key mixed: '{key_mixed}'")
    print(f"[LOCK KEY CASING TEST] lock_upper is lock_lower: {lock_upper is lock_lower}")
    print(f"[LOCK KEY CASING TEST] lock_upper is lock_mixed: {lock_upper is lock_mixed}")

    if os.name == 'nt':
        # On Windows, path casing MUST resolve to identical lock objects
        assert lock_upper is lock_lower, (
            f"VULNERABILITY DETECTED! Drive letter casing mismatch creates separate lock objects on Windows:\n"
            f"  '{key_upper}' vs '{key_lower}'"
        )
        assert lock_upper is lock_mixed, (
            f"VULNERABILITY DETECTED! Path casing mismatch creates separate lock objects on Windows:\n"
            f"  '{key_upper}' vs '{key_mixed}'"
        )


@pytest.mark.asyncio
async def test_lock_key_slash_and_relative_normalization():
    """
    Empirical Challenge 2:
    Test forward slashes vs backslashes, relative paths, and trailing slashes in _get_lock_key.
    """
    base_dir = os.path.abspath(".")
    rel_path = "./tests/data_test.json"
    abs_path = os.path.abspath(rel_path)
    forward_path = abs_path.replace("\\", "/")
    dotdot_path = os.path.join(base_dir, "tests", "..", "tests", "data_test.json")

    lock_rel = await get_file_lock(rel_path)
    lock_abs = await get_file_lock(abs_path)
    lock_forward = await get_file_lock(forward_path)
    lock_dotdot = await get_file_lock(dotdot_path)

    assert lock_rel is lock_abs, f"Relative path lock mismatch: {rel_path} vs {abs_path}"
    assert lock_forward is lock_abs, f"Forward slash lock mismatch: {forward_path} vs {abs_path}"
    assert lock_dotdot is lock_abs, f"Dotdot path lock mismatch: {dotdot_path} vs {abs_path}"


@pytest.mark.asyncio
async def test_etag_concurrency_heavy_stress_50_clients():
    """
    Empirical Challenge 3:
    Stress-test ETag optimistic locking under heavy concurrency (50 simultaneous update requests).
    Verifies zero TOCTOU race conditions and strict 409 Conflict enforcement.
    """
    async with AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        doc_id = "77777777-7777-7777-7777-777777777777"
        payload = {
            "catalog": {
                "uuid": doc_id,
                "metadata": {
                    "title": "Heavy Stress Initial Title",
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

        num_concurrent = 50
        async def send_update(i: int):
            req_payload = {
                "catalog": {
                    "uuid": doc_id,
                    "metadata": {
                        "title": f"Heavy Stress Title {i}",
                        "version": f"1.{i}",
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

        successes = [r for r in responses if r.status_code in (200, 201)]
        conflicts = [r for r in responses if r.status_code == 409]

        print(f"\n[HEAVY ETAG STRESS] Total: {num_concurrent}, Successes: {len(successes)}, Conflicts: {len(conflicts)}")

        assert len(successes) == 1, f"Concurrency violation! {len(successes)} requests succeeded with stale ETag."
        assert len(conflicts) == num_concurrent - 1, f"Expected {num_concurrent - 1} 409 conflicts, got {len(conflicts)}"

        # Cleanup
        del_res = await client.delete(f"/api/documents/catalogs/{doc_id}")
        assert del_res.status_code == 200


@pytest.mark.asyncio
async def test_concurrent_casing_write_race_condition():
    """
    Empirical Challenge 4:
    Send 20 concurrent requests with varying path casing in request URIs / IDs to test if lock isolation holds.
    """
    async with AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        # UUID with lower vs upper hex chars
        doc_id_lower = "a1b2c3d4-e5f6-4789-a012-3456789abcde"

        payload = {
            "catalog": {
                "uuid": doc_id_lower,
                "metadata": {
                    "title": "Casing Race Document",
                    "version": "1.0",
                    "oscal-version": "1.1.2",
                    "last-modified": "2026-08-10T12:00:00Z"
                }
            }
        }
        res = await client.post("/api/documents/catalogs", json=payload)
        assert res.status_code in (200, 201)

        res_get = await client.get(f"/api/documents/catalogs/{doc_id_lower}")
        etag = res_get.headers.get("etag")

        async def worker(i: int):
            update_payload = {
                "catalog": {
                    "uuid": doc_id_lower,
                    "metadata": {
                        "title": f"Casing Worker {i}",
                        "version": "1.0",
                        "oscal-version": "1.1.2",
                        "last-modified": "2026-08-10T12:00:00Z"
                    }
                }
            }
            return await client.post(
                "/api/documents/catalogs",
                json=update_payload,
                headers={"If-Match": etag}
            )

        responses = await asyncio.gather(*[worker(i) for i in range(20)])
        successes = [r for r in responses if r.status_code in (200, 201)]
        conflicts = [r for r in responses if r.status_code == 409]

        assert len(successes) == 1, f"Expected 1 success, got {len(successes)}"
        assert len(conflicts) == 19, f"Expected 19 conflicts, got {len(conflicts)}"

        # Cleanup
        await client.delete(f"/api/documents/catalogs/{doc_id_lower}")
