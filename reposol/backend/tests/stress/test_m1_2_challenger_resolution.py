"""
Adversarial Stress Test Suite for Backend Resolution & #resource-id Imports (Challenger M1_2).

Target focus:
1. Back-matter and Metadata #resource-id references with relative, absolute, and API rlinks.
2. Multiple rlinks handling (e.g. non-UUID rlinks followed by valid catalog UUID rlinks).
3. Missing resource and missing rlinks graceful fallback (no 500 error / no unhandled crash).
4. Direct fragment UUID references (#<uuid>) with no matching resource in back-matter.
5. Case sensitivity and whitespace resilience in fragment references (#UUID vs #uuid).
6. Circular import resolution between profiles using #resource-id references.
7. Multi-import resolution mixing direct hrefs, relative hrefs, and #resource-id hrefs.
"""
import uuid
import pytest
from tests.factories import CatalogFactory, ProfileFactory
from app.services.resolution_service import _resolve_resource_href, resolve_profile


class TestAdversarialResourceResolution:
    """Stress tests for _resolve_resource_href and profile resolution with back-matter resources."""

    def test_resolve_resource_href_direct_catalog_uuid(self):
        """Direct URI with catalog UUID."""
        cat_uuid = "11111111-2222-3333-4444-555555555555"
        profile = {}
        
        # Test variations of direct hrefs
        assert _resolve_resource_href(f"../catalogs/{cat_uuid}.json", profile) == cat_uuid
        assert _resolve_resource_href(f"/api/documents/catalogs/{cat_uuid}", profile) == cat_uuid
        assert _resolve_resource_href(f"catalogs/{cat_uuid}.json", profile) == cat_uuid
        assert _resolve_resource_href(f"http://example.com/catalogs/{cat_uuid}.json", profile) == cat_uuid
        assert _resolve_resource_href(cat_uuid, profile) == cat_uuid

    def test_resolve_resource_href_fragment_uuid_fallback(self):
        """Fragment is directly a valid UUID without resource defined in back-matter."""
        cat_uuid = "22222222-3333-4444-5555-666666666666"
        profile = {"back-matter": {"resources": []}}
        
        # Should fallback to UUID search in fragment
        assert _resolve_resource_href(f"#{cat_uuid}", profile) == cat_uuid
        assert _resolve_resource_href(f"  #{cat_uuid.upper()}  ", profile) == cat_uuid

    def test_resolve_resource_href_multiple_rlinks_traversal(self):
        """Resource contains multiple rlinks, some without UUID, finding the valid catalog UUID."""
        res_uuid = "res-multiple-rlinks"
        cat_uuid = "33333333-4444-5555-6666-777777777777"
        
        profile = {
            "back-matter": {
                "resources": [
                    {
                        "uuid": res_uuid,
                        "title": "Multi-rlink resource",
                        "rlinks": [
                            {"href": "https://example.com/documentation.pdf", "media-type": "application/pdf"},
                            {"href": "ftp://files.example.org/readme.txt"},
                            {"href": f"../catalogs/{cat_uuid}.json", "media-type": "application/json"},
                            {"href": "https://example.com/another.xml"}
                        ]
                    }
                ]
            }
        }
        
        assert _resolve_resource_href(f"#{res_uuid}", profile) == cat_uuid

    def test_resolve_resource_href_metadata_resources_match_by_id_or_uuid(self):
        """Resource is located in metadata.resources and matches by 'id' attribute."""
        cat_uuid = "44444444-5555-6666-7777-888888888888"
        profile = {
            "metadata": {
                "resources": [
                    {
                        "id": "custom-meta-resource-id",
                        "title": "Resource in Metadata",
                        "rlinks": [
                            {"href": f"/api/documents/catalogs/{cat_uuid}"}
                        ]
                    }
                ]
            }
        }
        
        assert _resolve_resource_href("#custom-meta-resource-id", profile) == cat_uuid
        # Case insensitivity test
        assert _resolve_resource_href("#CUSTOM-META-RESOURCE-ID", profile) == cat_uuid

    def test_resolve_resource_href_missing_and_empty_fallbacks(self):
        """Boundary and malformed inputs to _resolve_resource_href."""
        profile = {
            "back-matter": {
                "resources": [
                    {
                        "uuid": "empty-resource",
                        "title": "No rlinks resource",
                        "rlinks": []
                    },
                    {
                        "uuid": "no-uuid-in-rlink",
                        "title": "Invalid rlinks resource",
                        "rlinks": [{"href": "https://example.com/just-a-page"}]
                    }
                ]
            }
        }
        
        assert _resolve_resource_href(None, profile) is None
        assert _resolve_resource_href("", profile) is None
        assert _resolve_resource_href("   ", profile) is None
        assert _resolve_resource_href("#", profile) is None
        assert _resolve_resource_href("#missing-res-id", profile) is None
        assert _resolve_resource_href("#empty-resource", profile) is None
        assert _resolve_resource_href("#no-uuid-in-rlink", profile) is None
        assert _resolve_resource_href(12345, profile) is None  # Non-string input

    def test_end_to_end_profile_resolution_with_mixed_and_missing_resources(self, client, isolated_data_dir):
        """End-to-end API test for profile resolution with multi-source back-matter resources, direct paths, and missing fallback."""
        # 1. Create two base catalogs
        cat1 = CatalogFactory.build(
            title="Base Catalog 1",
            controls=[
                {"id": "ac-1", "title": "Access Control 1"},
                {"id": "ac-2", "title": "Access Control 2"}
            ]
        )
        cat1_uuid = cat1["catalog"]["uuid"]
        client.post("/api/documents/catalogs", json=cat1)

        cat2 = CatalogFactory.build(
            title="Base Catalog 2",
            controls=[
                {"id": "ia-1", "title": "Identification 1"}
            ]
        )
        cat2_uuid = cat2["catalog"]["uuid"]
        client.post("/api/documents/catalogs", json=cat2)

        # 2. Build Profile importing cat1 via back-matter resource #<res1>, cat2 via direct href, plus a missing resource import
        res1_uuid = str(uuid.uuid4())
        
        prof = ProfileFactory.build(
            title="Comprehensive Resource Profile",
            imports=[
                # Import 1: Back-matter resource reference
                {
                    "href": f"#{res1_uuid}",
                    "include-controls": [{"with-ids": ["ac-1"]}]
                },
                # Import 2: Direct catalog href
                {
                    "href": f"../catalogs/{cat2_uuid}.json",
                    "include-all": {}
                },
                # Import 3: Missing resource href (should not crash resolution)
                {
                    "href": "#non-existent-resource-uuid",
                    "include-all": {}
                }
            ],
            back_matter={
                "resources": [
                    {
                        "uuid": res1_uuid,
                        "title": "Catalog 1 Resource",
                        "rlinks": [
                            {"href": "https://external.org/info.html"},
                            {"href": f"../catalogs/{cat1_uuid}.json"}
                        ]
                    }
                ]
            }
        )
        
        prof_uuid = prof["profile"]["uuid"]
        res_save = client.post("/api/documents/profiles", json=prof)
        assert res_save.status_code == 201

        # 3. Resolve profile
        res_resolve = client.get(f"/api/resolve/profile/{prof_uuid}")
        assert res_resolve.status_code == 200
        resolved = res_resolve.json()
        
        # ac-1 and ia-1 should be resolved; missing import gracefully ignored
        control_ids = {c["id"] for c in resolved["controls"]}
        assert "ac-1" in control_ids
        assert "ia-1" in control_ids
        assert "ac-2" not in control_ids  # Excluded by include-controls

    def test_circular_profile_import_with_resource_references(self, client, isolated_data_dir):
        """Profile A references Profile B via resource rlink, and Profile B references Profile A via resource rlink."""
        prof_a_uuid = str(uuid.uuid4())
        prof_b_uuid = str(uuid.uuid4())
        
        res_a_uuid = str(uuid.uuid4())
        res_b_uuid = str(uuid.uuid4())

        # Create Profile A importing Profile B via resource
        prof_a = ProfileFactory.build(
            doc_id=prof_a_uuid,
            title="Profile A (Circular)",
            imports=[{"href": f"#{res_b_uuid}", "include-all": {}}],
            back_matter={
                "resources": [
                    {
                        "uuid": res_b_uuid,
                        "title": "Ref to Profile B",
                        "rlinks": [{"href": f"../profiles/{prof_b_uuid}.json"}]
                    }
                ]
            }
        )

        # Create Profile B importing Profile A via resource
        prof_b = ProfileFactory.build(
            doc_id=prof_b_uuid,
            title="Profile B (Circular)",
            imports=[{"href": f"#{res_a_uuid}", "include-all": {}}],
            back_matter={
                "resources": [
                    {
                        "uuid": res_a_uuid,
                        "title": "Ref to Profile A",
                        "rlinks": [{"href": f"../profiles/{prof_a_uuid}.json"}]
                    }
                ]
            }
        )

        client.post("/api/documents/profiles", json=prof_a)
        client.post("/api/documents/profiles", json=prof_b)

        # Resolving Profile A should safely detect circular profile import without infinite loop / recursion crash
        with pytest.raises(ValueError, match="Circular profile reference detected"):
            client.get(f"/api/resolve/profile/{prof_a_uuid}")
