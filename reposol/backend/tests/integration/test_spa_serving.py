import os
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from app.main import app, frontend_dist, serve_spa

class TestSPAServingAndSecurity:
    """
    Integration tests for SPA file serving, SEO pre-rendering, path traversal protection,
    trailing-slash canonicalization, legacy route 301 redirects, HEAD request handling,
    and Cache-Control headers.
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

    def test_trailing_slash_preserves_query_params(self, client: TestClient):
        if not frontend_dist or not os.path.exists(frontend_dist):
            pytest.skip("frontend_dist not present in test environment")

        res = client.get("/catalogs/?w=default&view=tree", follow_redirects=False)
        assert res.status_code == 308
        assert res.headers["location"] == "/catalogs?w=default&view=tree"

    @pytest.mark.parametrize("legacy_path,expected_canonical", [
        ("/components", "/component-definitions"),
        ("/component", "/component-definitions"),
        ("/component-definition", "/component-definitions"),
        ("/ssp", "/ssps"),
        ("/system-security-plan", "/ssps"),
        ("/system-security-plans", "/ssps"),
        ("/poam", "/poams"),
        ("/mappings", "/control-mappings"),
        ("/mapping", "/control-mappings"),
        ("/control-mapping", "/control-mappings"),
        ("/mapping-collections", "/control-mappings"),
        ("/mapping-collection", "/control-mappings"),
        ("/catalog", "/catalogs"),
        ("/profile", "/profiles"),
        ("/assessment-plan", "/assessment-plans"),
        ("/assessment-result", "/assessment-results"),
    ])
    def test_legacy_routes_301_redirect_to_canonical(self, client: TestClient, legacy_path: str, expected_canonical: str):
        res = client.get(legacy_path, follow_redirects=False)
        assert res.status_code == 301
        assert res.headers["location"] == expected_canonical

    def test_legacy_route_preserves_query_string_and_subpath(self, client: TestClient):
        res = client.get("/components/uuid-456?w=default&filter=active", follow_redirects=False)
        assert res.status_code == 301
        assert res.headers["location"] == "/component-definitions/uuid-456?w=default&filter=active"

        # Trailing slash on legacy alias should redirect straight to canonical without trailing slash in a single 301 hop
        res2 = client.get("/components/?w=default", follow_redirects=False)
        assert res2.status_code == 301
        assert res2.headers["location"] == "/component-definitions?w=default"

    def test_head_requests_return_200_with_empty_body(self, client: TestClient):
        if not frontend_dist or not os.path.exists(frontend_dist):
            pytest.skip("frontend_dist not present in test environment")

        # Root HEAD
        res_root = client.head("/")
        assert res_root.status_code == 200
        assert res_root.headers.get("content-length")
        assert len(res_root.content) == 0

        # Canonical route HEAD
        res_cat = client.head("/catalogs")
        assert res_cat.status_code == 200
        assert "text/html" in res_cat.headers.get("content-type", "")
        assert len(res_cat.content) == 0

        # Component definitions HEAD
        res_comp = client.head("/component-definitions")
        assert res_comp.status_code == 200
        assert len(res_comp.content) == 0

        # Static SEO files HEAD
        res_robots = client.head("/robots.txt")
        assert res_robots.status_code == 200
        assert len(res_robots.content) == 0

        res_sitemap = client.head("/sitemap.xml")
        assert res_sitemap.status_code == 200
        assert len(res_sitemap.content) == 0

    def test_head_request_on_legacy_route_returns_301(self, client: TestClient):
        res = client.head("/components?w=default", follow_redirects=False)
        assert res.status_code == 301
        assert res.headers["location"] == "/component-definitions?w=default"
        assert len(res.content) == 0

        res2 = client.head("/ssp", follow_redirects=False)
        assert res2.status_code == 301
        assert res2.headers["location"] == "/ssps"
        assert len(res2.content) == 0

    @pytest.mark.parametrize("route_path,expected_snippet,expected_canonical", [
        ("/", "Reposol — Open-Source NIST OSCAL Management Platform", "https://security-management-oscal.fly.dev/"),
        ("/catalogs", "OSCAL Security Control Catalogs", "https://security-management-oscal.fly.dev/catalogs"),
        ("/profiles", "OSCAL Profile Tailoring", "https://security-management-oscal.fly.dev/profiles"),
        ("/component-definitions", "OSCAL Component Definitions", "https://security-management-oscal.fly.dev/component-definitions"),
        ("/ssps", "OSCAL System Security Plans", "https://security-management-oscal.fly.dev/ssps"),
        ("/assessment-plans", "OSCAL Assessment Plans", "https://security-management-oscal.fly.dev/assessment-plans"),
        ("/assessment-results", "OSCAL Assessment Results", "https://security-management-oscal.fly.dev/assessment-results"),
        ("/poams", "Plan of Action &amp; Milestones", "https://security-management-oscal.fly.dev/poams"),
        ("/control-mappings", "OSCAL Control Mappings", "https://security-management-oscal.fly.dev/control-mappings"),
        ("/traceability", "Traceability Matrix", "https://security-management-oscal.fly.dev/traceability"),
    ])
    def test_all_canonical_seo_prerendered_routes(self, client: TestClient, route_path: str, expected_snippet: str, expected_canonical: str):
        if not frontend_dist or not os.path.exists(frontend_dist):
            pytest.skip("frontend_dist not present in test environment")

        res = client.get(route_path)
        assert res.status_code == 200
        assert "no-cache" in res.headers.get("Cache-Control", "")
        assert expected_snippet in res.text
        assert f'<link rel="canonical" href="{expected_canonical}"' in res.text

    def test_static_seo_files_served_correctly(self, client: TestClient):
        if not frontend_dist or not os.path.exists(frontend_dist):
            pytest.skip("frontend_dist not present in test environment")

        res_robots = client.get("/robots.txt")
        assert res_robots.status_code == 200
        assert "User-agent: *" in res_robots.text
        assert "Sitemap: https://security-management-oscal.fly.dev/sitemap.xml" in res_robots.text

        res_sitemap = client.get("/sitemap.xml")
        assert res_sitemap.status_code == 200
        assert "<urlset" in res_sitemap.text
        assert "<loc>https://security-management-oscal.fly.dev/catalogs</loc>" in res_sitemap.text
        assert "<loc>https://security-management-oscal.fly.dev/component-definitions</loc>" in res_sitemap.text

    @pytest.mark.asyncio
    async def test_path_traversal_blocked_direct(self):
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

    def test_api_route_not_served_by_spa(self, client: TestClient):
        res = client.get("/api/unknown-endpoint")
        assert res.status_code == 404

    def test_legacy_redirect_works_even_without_dist(self, client: TestClient, monkeypatch):
        import app.main as main_mod
        monkeypatch.setattr(main_mod, "resolve_frontend_dist", lambda: None)

        # Legacy routes still 301 redirect even if dist is not compiled
        res = client.get("/components", follow_redirects=False)
        assert res.status_code == 301
        assert res.headers["location"] == "/component-definitions"

        # Trailing slash still redirects
        res_slash = client.get("/catalogs/", follow_redirects=False)
        assert res_slash.status_code == 308
        assert res_slash.headers["location"] == "/catalogs"

        # Unknown route returns 404 when dist is missing
        res_404 = client.get("/unknown-page")
        assert res_404.status_code == 404

    @pytest.mark.parametrize("input_path,expected_target", [
        ("/index.html", "/"),
        ("/catalogs/index.html", "/catalogs"),
        ("/component-definitions/index.html", "/component-definitions"),
        ("/components/index.html", "/component-definitions"),
        ("/ssp/index.html?w=custom", "/ssps?w=custom"),
        ("/plan-of-action-and-milestones", "/poams"),
        ("/plan-of-action-and-milestones/index.html", "/poams"),
        ("/plans-of-action-and-milestones?view=tree", "/poams?view=tree"),
    ])
    def test_canonical_index_html_and_extended_aliases(self, client: TestClient, input_path: str, expected_target: str):
        res = client.get(input_path, follow_redirects=False)
        assert res.status_code == 301
        assert res.headers["location"] == expected_target

        # Verify HEAD also 301 redirects properly with empty body
        res_head = client.head(input_path, follow_redirects=False)
        assert res_head.status_code == 301
        assert res_head.headers["location"] == expected_target
        assert len(res_head.content) == 0

    def test_subpage_json_ld_breadcrumbs_present(self, client: TestClient):
        if not frontend_dist or not os.path.exists(frontend_dist):
            pytest.skip("frontend_dist not present in test environment")

        res = client.get("/catalogs")
        assert res.status_code == 200
        assert '"@type": "WebPage"' in res.text
        assert '"@type": "BreadcrumbList"' in res.text
        assert '"name": "OSCAL Security Control Catalogs"' in res.text
        assert 'https://security-management-oscal.fly.dev/catalogs' in res.text


