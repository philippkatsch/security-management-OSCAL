"""
Integration tests for profile resolution and baseline diff endpoints.
"""
import pytest
from tests.factories import CatalogFactory, ProfileFactory

class TestResolutionDiff:
    """Tests for Profile Baseline Diff endpoint /api/resolve/profile/{profile_id}/diff/{catalog_id}."""

    def test_profile_baseline_diff(self, client, isolated_data_dir):
        # 1. Create source catalog with controls ac-1, ac-2, ac-3
        controls = [
            {"id": "ac-1", "title": "Access Control Policy", "params": [{"id": "ac-1_prm_1", "values": ["default"]}]},
            {"id": "ac-2", "title": "Account Management"},
            {"id": "ac-3", "title": "Access Enforcement"}
        ]
        cat_doc = CatalogFactory.build(title="Baseline Catalog Diff Source", controls=controls)
        cat_uuid = cat_doc["catalog"]["uuid"]
        
        res_cat = client.post("/api/documents/catalogs", json=cat_doc)
        assert res_cat.status_code == 201

        # 2. Create profile:
        # - Imports catalog
        # - Excludes ac-2 (removed)
        # - Alters ac-1 (modified)
        # - ac-3 is untouched
        alters = [
            {
                "control-id": "ac-1",
                "adds": [
                    {
                        "position": "ending",
                        "props": [{"name": "org-classification", "value": "mandatory"}]
                    }
                ]
            }
        ]
        exclude_controls = [{"with-ids": ["ac-2"]}]
        
        prof_doc = ProfileFactory.build(
            title="Tailored Baseline Profile",
            imports=[
                {
                    "href": f"#{cat_uuid}",
                    "include-all": {},
                    "exclude-controls": exclude_controls
                }
            ],
            modify={"alters": alters}
        )
        prof_uuid = prof_doc["profile"]["uuid"]

        res_prof = client.post("/api/documents/profiles", json=prof_doc)
        assert res_prof.status_code == 201

        # 3. Call GET /api/resolve/profile/{profile_id}/diff/{catalog_id}
        diff_url = f"/api/resolve/profile/{prof_uuid}/diff/{cat_uuid}"
        res_diff = client.get(diff_url)
        assert res_diff.status_code == 200

        data = res_diff.json()
        assert "summary" in data
        assert "deltas" in data

        summary = data["summary"]
        assert summary["added_count"] == 0
        assert summary["removed_count"] == 1
        assert summary["modified_count"] == 1
        assert summary["untouched_count"] == 1
        assert summary["total_baseline_controls"] == 3

        # Verify deltas array
        deltas = {d["id"]: d for d in data["deltas"]}
        assert "ac-1" in deltas
        assert deltas["ac-1"]["status"] == "modified"
        assert deltas["ac-1"]["baseline_control"] is not None
        assert deltas["ac-1"]["profile_control"] is not None

        assert "ac-2" in deltas
        assert deltas["ac-2"]["status"] == "removed"
        assert deltas["ac-2"]["baseline_control"] is not None
        assert deltas["ac-2"]["profile_control"] is None

        assert "ac-3" in deltas
        assert deltas["ac-3"]["status"] == "untouched"
        assert deltas["ac-3"]["baseline_control"] is not None
        assert deltas["ac-3"]["profile_control"] is not None
