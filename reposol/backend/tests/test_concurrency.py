import pytest
import httpx
from httpx import AsyncClient
from app.main import app

@pytest.mark.asyncio
async def test_etag_concurrency():
    async with AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        # Create a document
        doc_id = "11111111-2222-3333-4444-555555555555"
        payload = {
            "catalog": {
                "uuid": doc_id,
                "metadata": {"title": "Test ETag", "version": "1.0", "oscal-version": "1.1.2", "last-modified": "2026-08-10T12:00:00Z"}
            }
        }
        resp = await client.post("/api/documents/catalogs", json=payload)
        assert resp.status_code in (200, 201)
        
        # Test: GET returns ETag header
        resp = await client.get(f"/api/documents/catalogs/{doc_id}")
        assert resp.status_code == 200
        etag = resp.headers.get("etag")
        assert etag is not None
        
        # Test: PUT with correct If-Match succeeds
        payload["catalog"]["metadata"]["title"] = "Updated Title"
        resp = await client.post("/api/documents/catalogs", json=payload, headers={"If-Match": etag})
        assert resp.status_code == 200
        new_etag = resp.headers.get("etag")
        assert new_etag != etag
        
        # Test: PUT with stale If-Match returns 409
        payload["catalog"]["metadata"]["title"] = "Conflict Title"
        resp = await client.post("/api/documents/catalogs", json=payload, headers={"If-Match": etag})
        assert resp.status_code == 409
        assert "current_document" in resp.json()
        
        # Test: Update without If-Match header
        payload["catalog"]["metadata"]["title"] = "No ETag Title"
        resp = await client.post("/api/documents/catalogs", json=payload)
        assert resp.status_code == 200
        
        # Test: PUT without If-Match works for drafts even if there's conflict logic
        draft_id = f"{doc_id}-draft"
        draft_payload = {
            "catalog": {
                "uuid": draft_id,
                "metadata": {"title": "Draft Title", "version": "1.0", "oscal-version": "1.1.2", "last-modified": "2026-08-10T12:00:00Z"}
            }
        }
        resp = await client.post("/api/documents/catalogs", json=draft_payload)
        assert resp.status_code in (200, 201)
        resp = await client.post("/api/documents/catalogs", json=draft_payload, headers={"If-Match": "invalid-etag"})
        assert resp.status_code == 200
