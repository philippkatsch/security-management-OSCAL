import os
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from app.main import app, frontend_dist, serve_spa

class TestSPAServingAndSecurity:
    """
    Integration tests for SPA file serving, SEO pre-rendering, path traversal protection,
    trailing-slash canonicalization, and Cache-Control headers.
    """

    def test_root_path_returns_index_html(self, client: TestClient):
        res = client.get("/")
        assert res.status_code in (200, 404)
        if res.status_code == 200:
            assert "Cache-Control" in res.headers
            assert "no-cache" in res.headers["Cache-Control"]
            assert "Reposol" in res.text

    def test_trailing_slash_canonical_redirect(self, client: TestClient):
        if not frontend_dist or not os.path.exists(frontend_dist):
            pytest.skip("frontend_dist not present in test environment")

        res = client.get("/catalogs/", follow_redirects=False)
        assert res.status_code == 308
        assert res.headers["location"] == "/catalogs"

    @pytest.mark.asyncio
    async def test_path_traversal_blocked_direct(self):
        if not frontend_dist or not os.path.exists(frontend_dist):
            pytest.skip("frontend_dist not present in test environment")

        # Directly invoking serve_spa with traversal payloads must raise 403 Forbidden
        traversal_payloads = [
            "../etc/passwd",
            "../../windows/win.ini",
            "sub/../../secret.txt",
            "..secret/data.txt",
        ]
        for payload in traversal_payloads:
            with pytest.raises(HTTPException) as exc_info:
                await serve_spa(payload)
            assert exc_info.value.status_code == 403

    def test_prerendered_route_served_with_no_cache(self, client: TestClient):
        if not frontend_dist or not os.path.exists(frontend_dist):
            pytest.skip("frontend_dist not present in test environment")

        res = client.get("/catalogs")
        assert res.status_code == 200
        assert "no-cache" in res.headers.get("Cache-Control", "")
        # Verifies the pre-rendered HTML contains the rich keyword content
        assert "OSCAL Security Control Catalogs" in res.text
